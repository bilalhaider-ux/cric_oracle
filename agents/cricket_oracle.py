import os
import sys
from dotenv import load_dotenv

# Load local environment configuration setup
load_dotenv()

# Secure token retrieval from the active sandbox runtime boundary
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    raise ValueError("[SECURITY ALERT] Critical Execution Key Missing from Environment Registry!")

import asyncio
import pandas as pd
import numpy as np
import xgboost as xgb
from google.adk.agents import Agent, SequentialAgent
from google.adk.tools import ToolContext, FunctionTool
from google.genai import types

# Define paths
BASE_DIR = r"C:\Users\bilal\OneDrive\Desktop\cric_oracle"
CSV_PATH = os.path.join(BASE_DIR, "cricket_features.csv")

# ── Match-type classifier ─────────────────────────────────────────────────
#
# Keyword list curated from the tournament column distribution.
# Any tournament whose name contains one of these strings (case-insensitive)
# is classified as "league"; everything else is "international".
#
# Verified counts (from check_tournaments.py):
#   LEAGUE rows    : 118,500
#   INTERNATIONAL  : 79,120
#
LEAGUE_KEYWORDS = [
    # IPL / India
    "Indian Premier League",
    # Pakistan
    "Pakistan Super League",
    # Australia
    "Big Bash League",
    # Caribbean
    "Caribbean Premier League",
    # Bangladesh
    "Bangladesh Premier League",
    # England
    "Vitality Blast", "NatWest T20 Blast", "T20 Blast", "The Hundred",
    # South Africa
    "SA20",
    # UAE
    "International League T20",
    # Sri Lanka
    "Lanka Premier League",
    # USA
    "Major League Cricket",
    # Nepal
    "Nepal Premier League",
    # New Zealand
    "Super Smash",
    # South Africa (old)
    "Ram Slam", "Mzansi Super League",
    # Canada
    "Global T20",
    # T10 tournaments
    "Abu Dhabi T10", "T10 League",
    # Afghanistan
    "Afghanistan Premier League",
    # Gulf
    "Gulf T20",
    # Europe
    "Euro T20 Slam",
]


def classify_match_type(tournament: str) -> str:
    """
    Returns "league" if the tournament name matches a known franchise/domestic
    league, otherwise returns "international".

    Classification is purely keyword-based (case-insensitive substring match).
    To correct a mis-classification, add or remove keywords from LEAGUE_KEYWORDS
    above.

    Args:
        tournament: The tournament name string from cricket_features.csv.

    Returns:
        "league" | "international"
    """
    if not isinstance(tournament, str):
        return "international"
    t_upper = tournament.upper()
    for kw in LEAGUE_KEYWORDS:
        if kw.upper() in t_upper:
            return "league"
    return "international"


# Ensure parent directory is in path for easy database imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)
from database import get_db_connection

def get_player_rows(player_name: str) -> pd.DataFrame:
    conn = get_db_connection()
    query = "SELECT * FROM cricket_features WHERE player = ? COLLATE NOCASE"
    df = pd.read_sql_query(query, conn, params=[player_name])
    if df.empty:
        query = "SELECT * FROM cricket_features WHERE player LIKE ?"
        df = pd.read_sql_query(query, conn, params=[f"%{player_name}%"])
    conn.close()
    return df

def find_matching_venue_sr(venue_query):
    if not venue_query:
        return None
    conn = get_db_connection()
    query = "SELECT bat_runs, bat_balls FROM cricket_features WHERE venue LIKE ?"
    df = pd.read_sql_query(query, conn, params=[f"%{venue_query}%"])
    conn.close()
    if df.empty:
        return None
    total_runs = df["bat_runs"].sum()
    total_balls = df["bat_balls"].sum()
    if total_balls > 0:
        return (total_runs / total_balls) * 100.0
    return None


def load_player_data(
    player_name: str,
    venue_name: str = "",
    match_filter: str = "all",
    tool_context: ToolContext = None,
) -> dict:
    """
    Loads historical cricket features for a specific player and filters their
    latest stats.

    Args:
        player_name:  The name of the player to load.
        venue_name:   Optional name of the venue to adjust strike rate.
        match_filter: "all" | "international" | "league" — filters the
                      player's historical rows by match type before computing
                      rolling averages and form score.
        tool_context: ADK ToolContext to store/read state.

    Returns:
        A dictionary containing the player's context and metrics.
    """
    try:
        player_df = get_player_rows(player_name)
    except Exception as e:
        return {"status": "error", "message": f"Error loading database: {e}"}

    if player_df.empty:
        return {"status": "error", "message": f"Player '{player_name}' not found in the dataset."}

    # ── Apply match_filter ────────────────────────────────────────────────
    if match_filter != "all":
        player_df["match_type"] = player_df["tournament"].apply(classify_match_type)
        player_df = player_df[player_df["match_type"] == match_filter].copy()

        if len(player_df) < 5:
            return {
                "status": "insufficient_data",
                "message": (
                    f"Not enough {match_filter} matches for this player to generate "
                    f"a reliable prediction. Only {len(player_df)} match(es) found "
                    f"(minimum 5 required)."
                ),
            }

    # Sort chronologically
    player_df["date"] = pd.to_datetime(player_df["date"])
    player_df = player_df.sort_values(by="date")

    # Get latest metrics
    latest_row = player_df.iloc[-1]
    actual_player_name = latest_row["player"]
    total_filtered_matches = len(player_df)

    # Extract last 10 matches for context
    last_10 = player_df.tail(10)
    last_10_list = []
    for _, row in last_10.iterrows():
        # Handle string datetime compatibility (if date comes back as string from sql)
        d_val = row["date"] if isinstance(row["date"], pd.Timestamp) else pd.to_datetime(row["date"])
        last_10_list.append({
            "date":         str(d_val.date()),
            "opponent":     row["opponent"],
            "runs":         int(row["bat_runs"]),
            "balls":        int(row["bat_balls"]),
            "strike_rate":  float(row["bat_strike_rate"]),
            "dismissed":    bool(row["bat_dismissed"]),
        })

    # Get latest stats (from filtered data so rolling values reflect the filter)
    elo  = float(latest_row["elo_rating"])
    form = float(latest_row["recent_form_score"])

    # Venue adjustment (uses SQLite query for venue baseline, filtered career SR)
    venue_sr = find_matching_venue_sr(venue_name)
    if venue_sr is not None:
        cum_runs  = player_df["bat_runs"].sum()
        cum_balls = player_df["bat_balls"].sum()
        career_sr = (cum_runs / cum_balls * 100.0) if cum_balls > 0 else 100.0
        venue_adjusted_sr = career_sr - venue_sr
        venue_info = f"Adjusted for venue '{venue_name}' (Baseline SR: {venue_sr:.2f})"
    else:
        venue_adjusted_sr = float(latest_row["venue_adjusted_sr"])
        venue_info = "Using player's default venue adjusted strike rate"

    rolling_avg = float(latest_row["rolling_10_bat_avg"])
    rolling_sr  = float(latest_row["rolling_10_bat_sr"])

    # Save to state
    if tool_context:
        tool_context.state["player_name"]        = actual_player_name
        tool_context.state["elo_rating"]         = elo
        tool_context.state["recent_form_score"]  = form
        tool_context.state["venue_adjusted_sr"]  = venue_adjusted_sr
        tool_context.state["rolling_10_bat_avg"] = rolling_avg
        tool_context.state["rolling_10_bat_sr"]  = rolling_sr
        tool_context.state["last_10_matches"]    = last_10_list
        tool_context.state["venue_info"]         = venue_info
        tool_context.state["match_filter"]       = match_filter
        tool_context.state["total_filtered_matches"] = total_filtered_matches

    return {
        "status":           "success",
        "player_name":      actual_player_name,
        "elo_rating":       elo,
        "recent_form_score": form,
        "venue_adjusted_sr": venue_adjusted_sr,
        "rolling_10_bat_avg": rolling_avg,
        "rolling_10_bat_sr":  rolling_sr,
        "venue_info":         venue_info,
        "last_10_matches":    last_10_list,
        "match_filter":       match_filter,
        "total_filtered_matches": total_filtered_matches,
    }


def verify_agent_output_safety(predicted_runs):
    """
    Core context validation guardrail to ensure output matrix integrity.
    """
    # Clamp absolute bounds based on realistic athletic capacities
    MIN_SAFE_BOUND = 0.0
    MAX_SAFE_BOUND = 175.0 # Max realistic individual score in T20s
    
    if not (MIN_SAFE_BOUND <= predicted_runs <= MAX_SAFE_BOUND):
        # Override corrupted outliers with dynamic historical baseline
        return float(np.clip(predicted_runs, MIN_SAFE_BOUND, MAX_SAFE_BOUND))
        
    return predicted_runs


def predict_runs(
    player_name: str,
    match_filter: str = "all",
    tool_context: ToolContext = None,
) -> dict:
    """
    Trains an XGBoost model on the fly for the player and predicts runs with a
    95% bootstrapped CI.

    Args:
        player_name:  The name of the player to predict runs for.
        match_filter: "all" | "international" | "league" — same filter applied
                      to the training data so the model is trained only on the
                      relevant match type.
        tool_context: ADK ToolContext to read/write state.

    Returns:
        A dictionary containing prediction, CI bounds, and status.
    """
    try:
        player_df = get_player_rows(player_name)
    except Exception as e:
        return {"status": "error", "message": f"Error loading database: {e}"}

    if player_df.empty:
        return {"status": "error", "message": f"Player '{player_name}' not found."}

    # ── Apply match_filter ────────────────────────────────────────────────
    if match_filter != "all":
        player_df["match_type"] = player_df["tournament"].apply(classify_match_type)
        player_df = player_df[player_df["match_type"] == match_filter].copy()

    # Filter out rows with NaNs in features
    features = [
        "rolling_10_bat_avg",
        "rolling_10_bat_sr",
        "recent_form_score",
        "venue_adjusted_sr",
        "elo_rating",
    ]
    target = "bat_runs"

    player_df = player_df.dropna(subset=features + [target])

    if len(player_df) < 5:
        insufficient_msg = (
            f"Not enough {match_filter} matches for this player to generate a "
            f"reliable prediction. Only {len(player_df)} match(es) with complete "
            f"features found (minimum 5 required)."
            if match_filter != "all"
            else "insufficient data: Too few historical matches to build model."
        )
        return {"status": "insufficient_data", "message": insufficient_msg}

    # Prepare data
    X = player_df[features].values
    y = player_df[target].values

    # Latest features (from state if available, else from last filtered row)
    if tool_context and "elo_rating" in tool_context.state:
        latest_features = np.array([[
            tool_context.state["rolling_10_bat_avg"],
            tool_context.state["rolling_10_bat_sr"],
            tool_context.state["recent_form_score"],
            tool_context.state["venue_adjusted_sr"],
            tool_context.state["elo_rating"],
        ]])
    else:
        latest_row = player_df.iloc[-1]
        latest_features = np.array([[
            latest_row["rolling_10_bat_avg"],
            latest_row["rolling_10_bat_sr"],
            latest_row["recent_form_score"],
            latest_row["venue_adjusted_sr"],
            latest_row["elo_rating"],
        ]])

    # Train model
    model = xgb.XGBRegressor(
        n_estimators=50, max_depth=3, learning_rate=0.1, random_state=42
    )
    model.fit(X, y)
    raw_prediction = float(model.predict(latest_features)[0])
    point_prediction = verify_agent_output_safety(raw_prediction)

    # Bootstrapping (100 samples for 95% CI)
    bootstrap_predictions = []
    np.random.seed(42)
    n_samples = len(player_df)

    for i in range(100):
        indices   = np.random.choice(n_samples, size=n_samples, replace=True)
        X_boot    = X[indices]
        y_boot    = y[indices]
        boot_model = xgb.XGBRegressor(
            n_estimators=30, max_depth=3, learning_rate=0.1, random_state=i
        )
        boot_model.fit(X_boot, y_boot)
        bootstrap_predictions.append(boot_model.predict(latest_features)[0])

    ci_lower = float(np.percentile(bootstrap_predictions, 2.5))
    ci_upper = float(np.percentile(bootstrap_predictions, 97.5))
    ci_width = ci_upper - ci_lower

    if ci_width > 40:
        msg = (
            f"insufficient data: Prediction confidence is low (95% CI width is "
            f"{ci_width:.2f}, which is greater than 40)."
        )
        if tool_context:
            tool_context.state["predicted_runs"] = "insufficient data"
            tool_context.state["ci_lower"]  = ci_lower
            tool_context.state["ci_upper"]  = ci_upper
            tool_context.state["ci_width"]  = ci_width
        return {"status": "insufficient_data", "message": msg}

    if tool_context:
        tool_context.state["predicted_runs"] = point_prediction
        tool_context.state["ci_lower"]  = ci_lower
        tool_context.state["ci_upper"]  = ci_upper
        tool_context.state["ci_width"]  = ci_width

    return {
        "status":          "success",
        "predicted_runs":  point_prediction,
        "ci_lower":        ci_lower,
        "ci_upper":        ci_upper,
        "ci_width":        ci_width,
        "match_filter":    match_filter,
        "training_rows":   int(n_samples),
    }


# ── Agent factories ───────────────────────────────────────────────────────

def create_feature_agent():
    return Agent(
        name="FeatureAgent",
        model="gemini-2.5-flash",
        instruction="""You are the FeatureAgent. Your job is to extract player features and recent stats.
Always use the load_player_data tool to retrieve the stats for the requested player and venue.
Summarize the retrieved stats and save them to the session state.""",
        description="Extracts player features, Elo rating, form, and venue-adjusted strike rate.",
        tools=[load_player_data],
    )


def create_predictor_agent():
    return Agent(
        name="PredictorAgent",
        model="gemini-2.5-flash",
        instruction="""You are the PredictorAgent. Your job is to predict batting runs for the requested player.
Always use the predict_runs tool to train the model and generate the point prediction and confidence intervals.
Summarize the results. If the confidence interval width is greater than 40, explicitly say 'insufficient data'.""",
        description="Trains XGBoost and predicts runs with bootstrapped confidence intervals.",
        tools=[predict_runs],
    )


def create_narrator_agent():
    return Agent(
        name="NarratorAgent",
        model="gemini-2.5-flash",
        instruction="""You are the NarratorAgent. Your job is to compile the stats and predictions into a broadcast-quality cricket analyst insight.
You must return exactly a 3-sentence insight.
Sentence 1: Mention the predicted runs (or if there is insufficient data) and the opponent/venue context.
Sentence 2: Discuss their recent form trend and Elo rating.
Sentence 3: Reflect on the venue factor (venue adjusted strike rate) and summarize their outlook.""",
        description="Generates a 3-sentence broadcast-quality analyst narration.",
    )


def create_planner_agent():
    return SequentialAgent(
        name="PlannerAgent",
        sub_agents=[
            create_feature_agent(),
            create_predictor_agent(),
            create_narrator_agent(),
        ],
    )


async def run_oracle_async(question: str) -> str:
    """
    Runs the multi-agent system asynchronously using the SequentialAgent pipeline.
    """
    from google.adk.sessions import InMemorySessionService
    from google.adk.runners import Runner

    session_service = InMemorySessionService()
    session_id = "s1"
    app_name = "cricket_oracle"

    await session_service.create_session(
        app_name=app_name, user_id="default_user", session_id=session_id
    )

    pipeline = create_planner_agent()
    runner   = Runner(agent=pipeline, app_name=app_name, session_service=session_service)

    user_message = types.Content(role="user", parts=[types.Part.from_text(text=question)])

    final_output = ""
    async for event in runner.run_async(
        user_id="default_user",
        session_id=session_id,
        new_message=user_message,
    ):
        if event.is_final_response():
            if event.content and event.content.parts:
                final_output = event.content.parts[0].text

    return final_output


def run_oracle(question: str) -> str:
    """Synchronous wrapper to run the oracle pipeline."""
    return asyncio.run(run_oracle_async(question))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
    else:
        question = input("Ask CricketOracle: ")

    if "GOOGLE_API_KEY" not in os.environ:
        print("WARNING: GOOGLE_API_KEY environment variable not set.")

    result = run_oracle(question)
    print("\n--- Oracle Response ---")
    print(result)

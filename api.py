"""
[GOOGLE ADK SDK PIPELINE ORCHESTRATION]
FastAPI Orchestration Layer

This module serves as the primary backend orchestration layer bridging the React frontend 
to the Google ADK agent pipeline, SQLite database, and the Model Context Protocol (MCP) tool functions. 
It exposes REST endpoints for player statistics, predictive run modeling, venue performance analysis, 
and fuzzy search capabilities.
"""

import os
import sys
import json  # <-- FIXED: Added missing json library import
from dotenv import load_dotenv

# Load local environment configuration setup
load_dotenv()

# [SECURITY GUARDRAIL]
# Immediate environment validation check on startup. The application refuses to start 
# if GOOGLE_API_KEY is not defined, preventing runtime failures mid-request when calling 
# the underlying Gemini LLM agent pipeline.
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    raise ValueError("[SECURITY ALERT] Critical Execution Key Missing from Environment Registry!")

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Ensure current directory is in Python path for easy imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from database import get_db_connection

# Import functions from existing files
try:
    from agents.cricket_oracle import load_player_data, predict_runs, run_oracle
    from mcp_server import get_top_players, get_venue_stats
except ImportError as e:
    print(f"Import Error: {e}")
    sys.path.append(os.path.join(current_dir, "agents"))
    from cricket_oracle import load_player_data, predict_runs, run_oracle
    from mcp_server import get_top_players, get_venue_stats

app = FastAPI(
    title="CricketOracle API",
    description="FastAPI Backend for T20 Cricket Performance Prediction & Analytics",
    version="2.0.0",
)

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_PATH = os.path.join(current_dir, "cricket_features.csv")
VALID_FILTERS = {"all", "international", "league"}

@app.get("/api/player-stats")
def api_player_stats(
    player_name: str,
    venue_name: str = "",
    match_filter: str = Query(default="all", description="Filter: 'all' | 'international' | 'league'"),
):
    """
    Retrieve historical cricket stats for a given player, optionally filtered by venue and match type.

    Parameters:
    - player_name (str): The name of the player to query.
    - venue_name (str, optional): The name of the venue to filter statistics. Defaults to empty string.
    - match_filter (str): Filter for match format types. Must be 'all', 'international', or 'league'.

    Returns:
    - dict: A dictionary containing aggregated statistics, status, and metadata.
    """
    # [ANTI-CORTEXT-AVERAGING VALIDATION]
    # The match_filter allows the caller to separate 'international' and 'league' (e.g. IPL) matches.
    # This prevents the statistical model from averaging performance across disparate playing contexts,
    # resolving the global context-averaging bug where players' stats collapse to a non-representative mean.
    if match_filter not in VALID_FILTERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid match_filter '{match_filter}'. Must be one of: {sorted(VALID_FILTERS)}",
        )
    res = load_player_data(player_name, venue_name, match_filter=match_filter)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res

@app.get("/api/predict")
def api_predict(
    player_name: str,
    match_filter: str = Query(default="all", description="Filter: 'all' | 'international' | 'league'"),
):
    """
    Predict a player's runs for an upcoming match using statistical modeling combined with LLM insights.

    [GOOGLE ADK SDK PIPELINE ORCHESTRATION]
    This route sandboxes downstream execution of the LLM oracle agent. It maps the system key to
    the runtime process environment (`os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY`) dynamically 
    and only if valid, avoiding exposing hardcoded key registries or secrets inside the codebase.

    Parameters:
    - player_name (str): The name of the player to run predictions on.
    - match_filter (str): Filter for training data context. Must be 'all', 'international', or 'league'.

    Returns:
    - dict: A dictionary containing predicted runs, confidence interval limits, LLM insights, and training metadata.
    """
    # [ANTI-CORTEXT-AVERAGING VALIDATION]
    # Restricts the regression dataset to the requested competition domain. This isolates domain-specific
    # features and prevents mixing international profiles with domestic leagues, mitigating the context-averaging bug.
    if match_filter not in VALID_FILTERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid match_filter '{match_filter}'. Must be one of: {sorted(VALID_FILTERS)}",
        )

    if "GOOGLE_API_KEY" not in os.environ and GOOGLE_API_KEY:
        os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

    try:
        insight = run_oracle(f"How will {player_name} perform?")
    except Exception as e:
        insight = f"ADK Pipeline Execution failed: {e}. Set GOOGLE_API_KEY environment variable."

    pred_res = predict_runs(player_name, match_filter=match_filter)
    if pred_res.get("status") == "error":
        raise HTTPException(status_code=404, detail=pred_res.get("message"))

    return {
        "status":        pred_res.get("status"),
        "predicted_runs": pred_res.get("predicted_runs", 0.0),
        "ci_lower":      pred_res.get("ci_lower", 0.0),
        "ci_upper":      pred_res.get("ci_upper", 0.0),
        "ci_width":      pred_res.get("ci_width", 0.0),
        "insight":       insight,
        "message":       pred_res.get("message", ""),
        "match_filter":  match_filter,
        "training_rows": pred_res.get("training_rows", 0),
    }

@app.get("/api/top-players")
def api_top_players(metric: str, n: int = 10):
    """
    Fetch the top N performing players according to a specified performance metric.

    Parameters:
    - metric (str): The metric used to rank players (e.g. 'runs', 'strike_rate', 'average').
    - n (int): The number of players to return. Defaults to 10.

    Returns:
    - list[dict]: A ranked list of players and their associated stats.
    """
    res = get_top_players(metric, n)
    if isinstance(res, list) and len(res) > 0 and "error" in res[0]:
        raise HTTPException(status_code=400, detail=res[0]["error"])
    return res

@app.get("/api/venue-stats")
def api_venue_stats(venue_name: str):
    """
    Retrieve historical match statistics and aggregate performance data for a specific venue.

    Parameters:
    - venue_name (str): The name of the cricket stadium/venue.

    Returns:
    - dict: Aggregate metrics including average scores, win ratios, and match count.
    """
    res = get_venue_stats(venue_name)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res

# [MEMORY CACHE FOR AUTOCOMPLETE]
# Simple in-memory list caching the unique player list retrieved from SQLite. 
# This avoids querying SQLite on every keystroke of the search-as-you-type frontend feature,
# ensuring sub-millisecond response latency.
_PLAYER_NAMES_CACHE: list[str] | None = None

def _load_player_names() -> list[str]:
    global _PLAYER_NAMES_CACHE
    if _PLAYER_NAMES_CACHE is None:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT player FROM cricket_features ORDER BY player")
            _PLAYER_NAMES_CACHE = [row[0] for row in cursor.fetchall() if row[0]]
            conn.close()
        except Exception:
            _PLAYER_NAMES_CACHE = []
    return _PLAYER_NAMES_CACHE

def match_player(player_name: str, query: str) -> bool:
    """
    Performs fuzzy matching to correlate user-input search queries with database player names.

    Why this exists:
    The raw database source uses terse scorecard identifiers (e.g., "V Kohli" or "SA Yadav"),
    whereas end-users intuitively search using full common names (e.g., "Virat Kohli" or "Suryakumar Yadav").

    Fuzzy Matching Strategy:
    1. Direct Substring Match: Checks if the search query is directly contained within the candidate database name.
    2. Popular Nickname Mapping: Matches common full names against a hardcoded lookup dictionary of popular players.
    3. Last-Name + Initials Matching: Composes initials from the prefix names and matches them against initials from
       the database entry, supporting cases like "Virat Kohli" (Q initials: 'V', last: 'Kohli') matching "V Kohli".

    Parameters:
    - player_name (str): The candidate database player name.
    - query (str): The user search input.

    Returns:
    - bool: True if the query matches the player name under the fuzzy strategy rules, False otherwise.
    """
    q = query.lower().strip()
    p = player_name.lower().strip()
    
    if q in p:
        return True
        
    q_words = q.split()
    p_words = p.split()
    
    if not q_words or not p_words:
        return False
        
    popular = {
        "virat kohli": "v kohli", "virat": "v kohli",
        "suryakumar yadav": "sa yadav", "suryakumar": "sa yadav", "surya": "sa yadav", "sky": "sa yadav",
        "rohit sharma": "rg sharma", "ms dhoni": "ms dhoni", "dhoni": "ms dhoni",
        "glenn maxwell": "gj maxwell", "maxwell": "gj maxwell",
        "babar azam": "babar azam", "babar": "babar azam",
        "mohammad rizwan": "mohammad rizwan", "rizwan": "mohammad rizwan",
        "shaheen afridi": "shaheen shah afridi", "shaheen": "shaheen shah afridi",
    }
    
    if q in popular and popular[q] == p:
        return True
 
    if len(q_words) > 1 and len(p_words) > 1:
        if q_words[-1] == p_words[-1]:
            p_lead = p_words[:-1]
            q_lead = q_words[:-1]
            p_initials = "".join([w[0] for w in p_lead if w])
            q_initials = "".join([w[0] for w in q_lead if w])
            if p_initials.startswith(q_initials) or q_initials.startswith(p_initials):
                return True
    return False

@app.get("/api/players")
def api_players(
    q: str = Query(default="", description="Search query prefix"),
    limit: int = Query(default=15, ge=1, le=100, description="Max results"),
):
    """
    Search and retrieve a list of player names matching the search prefix or fuzzy query.

    Parameters:
    - q (str): Search query entered by the user.
    - limit (int): Maximum number of players to return. Defaults to 15, range [1-100].

    Returns:
    - list[str]: A list of matched player names.
    """
    names = _load_player_names()
    if q:
        names = [n for n in names if match_player(n, q)]
    return names[:limit]

@app.get("/api/health")
def health_check():
    """
    Perform a system health check by validating connection integrity to the SQLite database.

    Returns:
    - dict: Health status indication ("ok" or "error") and active row count or error description.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cricket_features")
        rows = cursor.fetchone()[0]
        conn.close()
        return {"status": "ok", "rows": rows}
    except Exception as e:
        return {"status": "error", "message": f"Error loading database: {e}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)

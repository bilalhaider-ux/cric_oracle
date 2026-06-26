"""
FastAPI service layer for Cricket Oracle.

Bridges the React frontend to the Google ADK agent pipeline, SQLite database,
and MCP tool functions. Exposes REST endpoints for player statistics, run
predictions, top-player leaderboards, venue analytics, and player search.
"""

import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY is not set. Add it to your .env file.")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
    # match_filter separates 'international' from franchise 'league' data so the
    # model is trained only on the relevant competition context.
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
    Predict a player's runs using the per-player XGBoost model, then generate a
    broadcast-quality narrative via the ADK multi-agent pipeline.

    The statistical prediction (point estimate + 95% CI) is computed first so the
    NarratorAgent's insight is grounded in the exact numbers returned to the caller —
    keeping the UI values and the narrative text consistent.

    Parameters:
    - player_name: Player name (case-insensitive, fuzzy-matched).
    - match_filter: 'all' | 'international' | 'league' — scopes the training data.
    """
    if match_filter not in VALID_FILTERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid match_filter '{match_filter}'. Must be one of: {sorted(VALID_FILTERS)}",
        )

    # Step 1: Run statistical prediction first so we have concrete numbers.
    pred_res = predict_runs(player_name, match_filter=match_filter)
    if pred_res.get("status") == "error":
        raise HTTPException(status_code=404, detail=pred_res.get("message"))

    # Step 2: Build an oracle query that includes the actual prediction numbers so
    # the NarratorAgent's commentary matches what the UI displays.
    if "GOOGLE_API_KEY" not in os.environ and GOOGLE_API_KEY:
        os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

    if pred_res.get("status") == "insufficient_data":
        oracle_query = (
            f"How will {player_name} perform? Note: the statistical model returned "
            f"insufficient data (CI width {pred_res.get('ci_width', 0):.1f} runs)."
        )
    else:
        oracle_query = (
            f"How will {player_name} perform? The model predicts "
            f"{pred_res.get('predicted_runs', 0):.1f} runs "
            f"(95% CI: {pred_res.get('ci_lower', 0):.1f}–{pred_res.get('ci_upper', 0):.1f})."
        )

    try:
        insight = run_oracle(oracle_query)
    except Exception as e:
        insight = f"Narrative generation failed: {e}"

    return {
        "status":         pred_res.get("status"),
        "predicted_runs": pred_res.get("predicted_runs", 0.0),
        "ci_lower":       pred_res.get("ci_lower", 0.0),
        "ci_upper":       pred_res.get("ci_upper", 0.0),
        "ci_width":       pred_res.get("ci_width", 0.0),
        "insight":        insight,
        "message":        pred_res.get("message", ""),
        "match_filter":   match_filter,
        "training_rows":  pred_res.get("training_rows", 0),
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


# In-memory cache for venue names used by the search autocomplete.
_VENUE_NAMES_CACHE: list[str] | None = None

def _load_venue_names() -> list[str]:
    """Load all distinct venue names from the DB, sorted by match count (most-played first)."""
    global _VENUE_NAMES_CACHE
    if _VENUE_NAMES_CACHE is None:
        try:
            from database import get_db_connection
            conn = get_db_connection()
            rows = conn.execute(
                """SELECT venue FROM cricket_features
                   GROUP BY venue ORDER BY COUNT(*) DESC"""
            ).fetchall()
            _VENUE_NAMES_CACHE = [row[0] for row in rows if row[0]]
            conn.close()
        except Exception:
            _VENUE_NAMES_CACHE = []
    return _VENUE_NAMES_CACHE


@app.get("/api/venues")
def api_venues(
    q: str = Query(default="", description="Venue search query"),
    limit: int = Query(default=10, ge=1, le=50),
):
    """
    Autocomplete endpoint for venue names.
    Returns venues whose name contains the query string (case-insensitive),
    ranked by total match count so the most prominent grounds appear first.
    """
    names = _load_venue_names()
    if q:
        ql = q.lower()
        names = [n for n in names if ql in n.lower()]
    return names[:limit]

# In-memory cache for the player name list used by the search autocomplete.
# Populated on first request, avoids hitting SQLite on every keystroke.
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
    Fuzzy match a user search query against a DB player name.

    DB names use scorecard format: "V Kohli", "RG Sharma", "SA Yadav".
    Users type full names, last names, or popular nicknames.

    Matching strategies (applied in order):
    1. Direct substring — "babar" in "babar azam" ✓
    2. Popular name map — "virat" → "v kohli", "rohit" → "rg sharma", etc.
    3. Last-name match — "kohli" matches the last word of "v kohli"
    4. Initials + last name — "virat kohli" → initials "v", last "kohli" → "v kohli"
    """
    q = query.lower().strip()
    p = player_name.lower().strip()

    if not q:
        return False

    # 1. Direct substring
    if q in p:
        return True

    q_words = q.split()
    p_words = p.split()

    if not q_words or not p_words:
        return False

    # 2. Popular name / nickname map
    popular = {
        # India
        "virat kohli": "v kohli",   "virat": "v kohli",
        "rohit sharma": "rg sharma", "rohit": "rg sharma",
        "ms dhoni": "ms dhoni",      "dhoni": "ms dhoni",      "mahi": "ms dhoni",
        "suryakumar yadav": "sa yadav", "suryakumar": "sa yadav", "surya": "sa yadav", "sky": "sa yadav",
        "hardik pandya": "h pandya", "hardik": "h pandya",
        "jasprit bumrah": "jj bumrah", "bumrah": "jj bumrah",
        "shubman gill": "s gill",    "shubman": "s gill",
        "rishabh pant": "rr pant",   "pant": "rr pant",
        "ks bharat": "ks bharat",
        "yashasvi jaiswal": "y jaiswal", "jaiswal": "y jaiswal",
        # Pakistan
        "babar azam": "babar azam",  "babar": "babar azam",
        "mohammad rizwan": "mohammad rizwan", "rizwan": "mohammad rizwan",
        "shaheen afridi": "shaheen shah afridi", "shaheen": "shaheen shah afridi",
        "shadab khan": "shadab khan", "shadab": "shadab khan",
        "fakhar zaman": "fakhar zaman", "fakhar": "fakhar zaman",
        "imam ul haq": "imam-ul-haq", "imam": "imam-ul-haq",
        # Australia
        "glenn maxwell": "gj maxwell", "maxwell": "gj maxwell",
        "david warner": "da warner",   "warner": "da warner",
        "pat cummins": "pj cummins",   "cummins": "pj cummins",
        "steve smith": "spm smith",    "steven smith": "spm smith",
        "travis head": "tm head",      "head": "tm head",
        "mitchell starc": "ma starc",  "starc": "ma starc",
        "marcus stoinis": "mp stoinis","stoinis": "mp stoinis",
        # England
        "jos buttler": "jc buttler",   "buttler": "jc buttler",
        "ben stokes": "ben stokes",    "stokes": "ben stokes",
        "liam livingstone": "ls livingstone", "livingstone": "ls livingstone",
        "jason roy": "jj roy",         "roy": "jj roy",
        "alex hales": "ad hales",      "hales": "ad hales",
        "mark wood": "ma wood",
        # West Indies
        "kieron pollard": "ka pollard","pollard": "ka pollard",
        "sunil narine": "sp narine",   "narine": "sp narine",
        "andre russell": "ad russell", "russell": "ad russell",
        "dj bravo": "dj bravo",        "bravo": "dj bravo",
        "nicholas pooran": "n pooran", "pooran": "n pooran",
        "shimron hetmyer": "so hetmyer","hetmyer": "so hetmyer",
        "evin lewis": "e lewis",
        # South Africa
        "david miller": "da miller",   "miller": "da miller",
        "quinton de kock": "q de kock","de kock": "q de kock",
        "faf du plessis": "f du plessis","faf": "f du plessis",
        "rassie van der dussen": "hd van der dussen","rassie": "hd van der dussen",
        "aiden markram": "ag markram", "markram": "ag markram",
        "kagiso rabada": "k rabada",   "rabada": "k rabada",
        # New Zealand
        "kane williamson": "kane williamson","kane": "kane williamson",
        "martin guptill": "mj guptill","guptill": "mj guptill",
        "devon conway": "dp conway",   "conway": "dp conway",
        "trent boult": "ta boult",     "boult": "ta boult",
        # Sri Lanka
        "kusal mendis": "bkg mendis",  "mendis": "bkg mendis",
        "dasun shanaka": "md shanaka", "shanaka": "md shanaka",
        "wanindu hasaranga": "pwd hasaranga","hasaranga": "pwd hasaranga",
        # Bangladesh
        "shakib al hasan": "shakib al hasan","shakib": "shakib al hasan",
        "mushfiqur rahim": "mushfiqur rahim","mushfiqur": "mushfiqur rahim",
        "litton das": "litton kumar das","litton": "litton kumar das",
        # Afghanistan
        "rashid khan": "rashid khan",  "rashid": "rashid khan",
        "mohammad nabi": "mohammad nabi","nabi": "mohammad nabi",
        "hazratullah zazai": "hazratullah zazai","zazai": "hazratullah zazai",
    }

    if q in popular and popular[q] == p:
        return True

    # 3. Single-word query: match against any word in the DB name (covers last names)
    if len(q_words) == 1:
        return any(q_words[0] in word for word in p_words)

    # 4. Multi-word: last word must match, then check initials of preceding words
    if q_words[-1] == p_words[-1]:
        p_initials = "".join(w[0] for w in p_words[:-1] if w)
        q_initials = "".join(w[0] for w in q_words[:-1] if w)
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

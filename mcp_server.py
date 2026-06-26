"""
MCP server for Cricket Oracle (FastMCP).

Exposes the SQLite feature database as four typed MCP tools that can be called
independently from the agent pipeline:
  - get_player_stats    → latest career metrics for one player
  - get_player_last10   → last 10 match scorecards for one player
  - get_top_players     → leaderboard ranked by a chosen metric
  - get_venue_stats     → aggregate run/SR stats for a venue

Running this as a standalone process decouples the data layer from agent logic,
so the database can be queried, tested, or swapped without touching agent code.
"""

import os
import sys
import pandas as pd
import json
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv

# Ensure parent and agents directories are in path for easy imports
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)
agents_dir = os.path.join(current_dir, "agents")
if agents_dir not in sys.path:
    sys.path.append(agents_dir)

from database import get_db_connection, CSV_PATH
from data_pipeline import extract_isolated_features

# Initialize FastMCP Server
mcp = FastMCP("CricketOracle")

@mcp.tool()
def get_player_stats(player_name: str) -> dict:
    """
    Get the latest career statistics for a specific cricket player.
    
    Args:
        player_name: The name of the player (case-insensitive).
        
    Returns:
        A dictionary containing the player's latest Elo rating, recent form, rolling batting average,
        rolling batting strike rate, and venue adjusted strike rate.
    """
    try:
        conn = get_db_connection()
        # Direct exact match (case insensitive)
        query = "SELECT * FROM cricket_features WHERE player = ? COLLATE NOCASE ORDER BY date DESC LIMIT 1"
        row = conn.execute(query, [player_name]).fetchone()
        
        if not row:
            # Try substring match
            query = "SELECT * FROM cricket_features WHERE player LIKE ? ORDER BY date DESC LIMIT 1"
            row = conn.execute(query, [f"%{player_name}%"]).fetchone()
            
        if not row:
            conn.close()
            return {"error": f"Player '{player_name}' not found."}
            
        data = {
            "player": row["player"],
            "team": row["team"],
            "latest_match_date": str(row["date"]),
            "elo_rating": float(row["elo_rating"]),
            "recent_form_score": float(row["recent_form_score"]),
            "rolling_10_bat_avg": float(row["rolling_10_bat_avg"]),
            "rolling_10_bat_sr": float(row["rolling_10_bat_sr"]),
            "venue_adjusted_sr": float(row["venue_adjusted_sr"])
        }
        conn.close()
        return data
    except Exception as e:
        return {"error": f"Error querying database: {e}"}

@mcp.tool()
def get_player_last10(player_name: str) -> list:
    """
    Get the last 10 matches for a specific cricket player.
    
    Args:
        player_name: The name of the player (case-insensitive).
        
    Returns:
        A list of dicts representing the last 10 matches with date, opponent, runs, balls, strike rate, and dismissal status.
    """
    try:
        conn = get_db_connection()
        query = "SELECT DISTINCT player FROM cricket_features WHERE player = ? COLLATE NOCASE"
        actual_name = conn.execute(query, [player_name]).fetchone()
        
        if not actual_name:
            query = "SELECT DISTINCT player FROM cricket_features WHERE player LIKE ?"
            actual_name = conn.execute(query, [f"%{player_name}%"]).fetchone()
            
        if not actual_name:
            conn.close()
            return [{"error": f"Player '{player_name}' not found."}]
            
        player = actual_name["player"]
        
        query = """
            SELECT date, opponent, bat_runs, bat_balls, bat_strike_rate, bat_dismissed
            FROM cricket_features
            WHERE player = ?
            ORDER BY date DESC
            LIMIT 10
        """
        rows = conn.execute(query, [player]).fetchall()
        conn.close()
        
        result = []
        for row in reversed(rows):
            result.append({
                "date": str(row["date"]),
                "opponent": row["opponent"],
                "runs": int(row["bat_runs"]),
                "balls": int(row["bat_balls"]),
                "strike_rate": float(row["bat_strike_rate"]),
                "dismissed": bool(row["bat_dismissed"])
            })
        return result
    except Exception as e:
        return [{"error": f"Error querying database: {e}"}]

@mcp.tool()
def get_top_players(metric: str, n: int = 10) -> list:
    """
    Get the top N players sorted by a specific career metric.
    
    Args:
        metric: The sorting metric. Must be one of: "elo_rating", "recent_form_score", "rolling_10_bat_avg", "rolling_10_bat_sr".
        n: Number of top players to return (default is 10).
        
    Returns:
        A list of players and their scores sorted in descending order.
    """
    valid_metrics = ["elo_rating", "recent_form_score", "rolling_10_bat_avg", "rolling_10_bat_sr"]
    if metric not in valid_metrics:
        return [{"error": f"Invalid metric '{metric}'. Choose from: {', '.join(valid_metrics)}"}]
        
    try:
        conn = get_db_connection()
        query = f"""
            SELECT player, team, {metric}
            FROM cricket_features
            WHERE (player, date) IN (
                SELECT player, MAX(date) FROM cricket_features GROUP BY player
            )
            ORDER BY {metric} DESC
            LIMIT ?
        """
        rows = conn.execute(query, [n]).fetchall()
        conn.close()
        
        result = []
        for row in rows:
            result.append({
                "rank": len(result) + 1,
                "player": row["player"],
                "team": row["team"],
                "score": float(row[metric])
            })
        return result
    except Exception as e:
        return [{"error": f"Error querying database: {e}"}]

@mcp.tool()
def get_venue_stats(venue_name: str) -> dict:
    """
    Get aggregated match statistics for a specific cricket venue.
    
    Args:
        venue_name: The name or partial name of the venue (case-insensitive).
        
    Returns:
        A dictionary containing total matches, average runs per match, and average strike rate.
    """
    try:
        conn = get_db_connection()
        query = "SELECT DISTINCT venue FROM cricket_features WHERE venue LIKE ?"
        venue_row = conn.execute(query, [f"%{venue_name}%"]).fetchone()
        
        if not venue_row:
            conn.close()
            return {"error": f"Venue matching '{venue_name}' not found."}
            
        actual_venue = venue_row["venue"]
        
        query = """
            SELECT 
                COUNT(DISTINCT file_name) as total_matches,
                SUM(bat_runs) as total_runs,
                SUM(bat_balls) as total_balls
            FROM cricket_features
            WHERE venue = ?
        """
        stats = conn.execute(query, [actual_venue]).fetchone()
        conn.close()
        
        total_matches = int(stats["total_matches"] or 0)
        total_runs = int(stats["total_runs"] or 0)
        total_balls = int(stats["total_balls"] or 0)
        
        avg_runs_per_match = (total_runs / total_matches) if total_matches > 0 else 0.0
        avg_strike_rate = (total_runs / total_balls * 100.0) if total_balls > 0 else 0.0
        
        return {
            "venue": actual_venue,
            "total_matches": total_matches,
            "average_runs_per_match": round(avg_runs_per_match, 2),
            "average_strike_rate": round(avg_strike_rate, 2)
        }
    except Exception as e:
        return {"error": f"Error querying database: {e}"}

# ── Class-Based MCP Handler for Custom tool calls ─────────────────────────────
load_dotenv()

class CricketMCPServer:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY is not set. Add it to your .env file.")
        self.dataset_path = CSV_PATH

    def process_tool_call(self, tool_name, arguments):
        """Dispatch a tool call by name and return a JSON-encoded result."""
        if tool_name == "get_player_context":
            player = arguments.get("player_name")
            venue = arguments.get("venue_name")

            metrics = extract_isolated_features(self.dataset_path, player, venue)

            context_payload = {
                "player": player,
                "venue": venue,
                "elo_rating": metrics["elo_rating"],
                "recent_form_10_avg": metrics["recent_form_runs"],
                "venue_adjusted_sr": metrics["venue_strike_rate"],
            }
            return json.dumps(context_payload)

        raise ValueError(f"Unknown tool: {tool_name}")

server = CricketMCPServer()

@mcp.tool()
def get_player_context(player_name: str, venue_name: str = "") -> str:
    """
    Return Elo rating, recent form average, and venue-adjusted strike rate
    for a player as a JSON string.
    """
    return server.process_tool_call("get_player_context", {
        "player_name": player_name,
        "venue_name": venue_name,
    })

if __name__ == "__main__":
    mcp.run()


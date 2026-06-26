# API Reference

CricketOracle exposes REST endpoints on port `8001` and connects to local Model Context Protocol (MCP) clients.

---

## 1. REST Endpoints

### GET `/api/player-stats`
*   **Description**: Get latest metrics and last 10 innings records.
*   **Parameters**:
    - `player_name` (required, string)
    - `venue_name` (optional, string)
    - `match_filter` (optional, `"all" | "international" | "league"`)

### GET `/api/predict`
*   **Description**: Runs the full ADK multi-agent pipeline and returns XGBoost prediction with confidence interval.
*   **Parameters**:
    - `player_name` (required, string)
    - `match_filter` (optional, `"all" | "international" | "league"`)

### GET `/api/players`
*   **Description**: Player name search with fuzzy matching and nickname aliases.
*   **Parameters**:
    - `q` (required search query, string)
    - `limit` (max results, default `15`)

### GET `/api/venues`
*   **Description**: Venue name autocomplete, sorted by match count.
*   **Parameters**:
    - `q` (optional filter string)
    - `limit` (max results, default `10`)

### GET `/api/health`
*   **Description**: Server status and database row count.

---

## 2. MCP Tools (FastMCP)

The MCP server exposes 4 typed tools that agents call via `ToolContext`:

*   **`get_player_stats(player_name)`** — Latest career averages, ELO rating, form score, venue-adjusted SR.
*   **`get_player_last10(player_name)`** — Last 10 innings scorecards with date, opponent, and venue.
*   **`get_top_players(metric, n)`** — Leaderboard ranked by `elo_rating`, `recent_form_score`, or `rolling_10_bat_avg`.
*   **`get_venue_stats(venue_name)`** — Aggregated match stats for a stadium.

Example `get_player_stats` response:
```json
{
  "player": "V Kohli",
  "elo_rating": 2004.7,
  "recent_form_score": 40.3,
  "rolling_10_bat_avg": 38.1,
  "rolling_10_bat_sr": 128.4,
  "venue_adjusted_sr": -12.4
}
```

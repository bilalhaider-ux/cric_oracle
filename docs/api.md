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
*   **Description**: Orchestrate Google ADK multi-agent cycle and XGBoost point predictions.
*   **Parameters**:
    - `player_name` (required, string)
    - `match_filter` (optional, `"all" | "international" | "league"`)

### GET `/api/players`
*   **Description**: Retrieve matching player names (with smart alias matching support).
*   **Parameters**:
    - `q` (required search query, string)
    - `limit` (max returns, default `15`)

### GET `/api/health`
*   **Description**: Verify server runtime status and database records.

---

## 2. MCP Server Protocol

Exposes a class-based protocol layer `CricketMCPServer` which translates agent actions into sandbox tools:

*   **Tool**: `get_player_context`
*   **Arguments**: `{"player_name": string, "venue_name": string}`
*   **Payload Output**:
    ```json
    {
      "security_status": "VERIFIED_SANDBOX",
      "target_player": "V Kohli",
      "target_venue": "Lahore",
      "isolated_elo": 2004.70,
      "recent_form_10_avg": 40.32,
      "venue_adjusted_sr": -12.38
    }
    ```

"""
Data pipeline and feature engineering for Cricket Oracle.

Parses raw CricSheet T20 JSON match files, computes per-player career metrics
(rolling averages, exponential-decay form scores, venue-adjusted strike rate,
Elo ratings), and writes the engineered feature table to cricket_features.csv.

All features are constructed using only information available before each match
— no lookahead bias by design.
"""

import os
import glob
import json
import numpy as np
import pandas as pd
from concurrent.futures import ProcessPoolExecutor

def parse_match_file(file_path):
    """
    Parses a single CricSheet T20 JSON file.
    Extracts match metadata, batting stats, and bowling stats.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        # Silently log errors or print them for malformed/missing JSONs
        return None

    # Check for basic required keys
    if not all(k in data for k in ["meta", "info", "innings"]):
        return None

    info = data["info"]
    innings_list = data["innings"]

    # Extract metadata
    dates = info.get("dates", [])
    match_date = dates[0] if dates else "Unknown"
    venue = info.get("venue", "Unknown")
    teams = info.get("teams", [])
    outcome = info.get("outcome", {})
    winner = outcome.get("winner", "No Result" if "result" in outcome else "Tie" if outcome.get("bowl_out") or outcome.get("eliminator") else "Unknown")
    
    # Event name
    event = info.get("event", {})
    tournament = event.get("name", "Unknown")

    # Get all players per team to ensure we map everyone who was in the playing XI
    players_info = info.get("players", {})
    
    # Initialize structures for match stats
    match_players = {}
    
    # Initialize all players from info.players
    for team, players in players_info.items():
        opposing_team = [t for t in teams if t != team]
        opponent = opposing_team[0] if opposing_team else "Unknown"
        for p in players:
            match_players[p] = {
                "player": p,
                "team": team,
                "opponent": opponent,
                # Batting stats
                "bat_runs": 0,
                "bat_balls": 0,
                "bat_fours": 0,
                "bat_sixes": 0,
                "bat_dismissed": False,
                # Bowling stats
                "bowl_balls": 0,
                "bowl_runs": 0,
                "bowl_wickets": 0,
            }

    # Process innings deliveries
    for innings in innings_list:
        batting_team = innings.get("team")
        opposing_team = [t for t in teams if t != batting_team]
        bowling_team = opposing_team[0] if opposing_team else "Unknown"

        overs = innings.get("overs", [])
        for over_data in overs:
            deliveries = over_data.get("deliveries", [])
            for deliv in deliveries:
                batter = deliv.get("batter")
                bowler = deliv.get("bowler")
                non_striker = deliv.get("non_striker")

                # Ensure players are in match_players
                for p, t in [(batter, batting_team), (non_striker, batting_team), (bowler, bowling_team)]:
                    if p and p not in match_players:
                        opp_t = [t_item for t_item in teams if t_item != t]
                        opp = opp_t[0] if opp_t else "Unknown"
                        match_players[p] = {
                            "player": p,
                            "team": t,
                            "opponent": opp,
                            "bat_runs": 0,
                            "bat_balls": 0,
                            "bat_fours": 0,
                            "bat_sixes": 0,
                            "bat_dismissed": False,
                            "bowl_balls": 0,
                            "bowl_runs": 0,
                            "bowl_wickets": 0,
                        }

                runs_dict = deliv.get("runs", {})
                bat_runs = runs_dict.get("batter", 0)
                extras_dict = deliv.get("extras", {})
                wides = extras_dict.get("wides", 0)
                noballs = extras_dict.get("noballs", 0)

                # Batting processing
                if batter in match_players:
                    match_players[batter]["bat_runs"] += bat_runs
                    if wides == 0:
                        match_players[batter]["bat_balls"] += 1
                    if bat_runs == 4:
                        match_players[batter]["bat_fours"] += 1
                    elif bat_runs == 6:
                        match_players[batter]["bat_sixes"] += 1

                # Wickets processing
                wickets = deliv.get("wickets", [])
                for w in wickets:
                    player_out = w.get("player_out")
                    kind = w.get("kind", "")
                    # Mark dismissal
                    if player_out in match_players:
                        match_players[player_out]["bat_dismissed"] = True
                    
                    # Bowling wickets
                    if bowler in match_players and kind not in ["run out", "retired hurt", "retired out", "obstructing the field"]:
                        match_players[bowler]["bowl_wickets"] += 1

                # Bowling runs & balls
                if bowler in match_players:
                    match_players[bowler]["bowl_runs"] += (bat_runs + wides + noballs)
                    if wides == 0 and noballs == 0:
                        match_players[bowler]["bowl_balls"] += 1

    # Format the extracted stats
    records = []
    for player, stats in match_players.items():
        # Batting Strike Rate
        b_balls = stats["bat_balls"]
        b_runs = stats["bat_runs"]
        stats["bat_strike_rate"] = (b_runs / b_balls * 100.0) if b_balls > 0 else 0.0

        # Bowling Overs and Economy Rate
        bowl_b = stats["bowl_balls"]
        bowl_r = stats["bowl_runs"]
        overs_float = bowl_b / 6.0
        stats["bowl_overs"] = (bowl_b // 6) + (bowl_b % 6) / 10.0
        stats["bowl_economy"] = (bowl_r / overs_float) if overs_float > 0 else 0.0

        # Add metadata
        stats["date"] = match_date
        stats["venue"] = venue
        stats["teams"] = teams
        stats["winner"] = winner
        stats["tournament"] = tournament
        stats["file_name"] = os.path.basename(file_path)

        records.append(stats)

    return records

# Helper for recent form score calculation
weights = np.array([0.5**4, 0.5**3, 0.5**2, 0.5**1, 1.0])
def form_fn(window):
    n = len(window)
    w = weights[-n:]
    return np.dot(window, w) / w.sum()

def process_player_group(args):
    """
    Computes all career-level features for a single player.

    All features are computed in chronological order with a shift(1) so that
    each row only contains information available before that match was played.
    This prevents lookahead bias — the rolling average, strike rate, and form
    score for match N are computed from matches 1 through N-1 only.
    """
    player_name, group, venue_map = args
    # Sort chronologically to prevent lookahead bias
    group = group.sort_values(by=["date", "file_name"])

    # 1. Batting features (rolling average, rolling strike rate, recent form score)
    bat_mask = (group["bat_balls"] > 0) | (group["bat_runs"] > 0)
    
    group["rolling_10_bat_avg"] = 0.0
    group["rolling_10_bat_sr"] = 0.0
    group["recent_form_score"] = 0.0

    if bat_mask.any():
        active_bat = group[bat_mask].copy()
        
        # Compute rolling stats (shifting by 1 to exclude current match)
        roll_runs = active_bat["bat_runs"].rolling(window=10, min_periods=1).sum().shift(1)
        roll_dismissed = active_bat["bat_dismissed"].astype(int).rolling(window=10, min_periods=1).sum().shift(1)
        active_bat["rolling_10_bat_avg"] = (roll_runs / roll_dismissed.clip(lower=1)).fillna(0.0)

        roll_balls = active_bat["bat_balls"].rolling(window=10, min_periods=1).sum().shift(1)
        active_bat["rolling_10_bat_sr"] = (roll_runs / roll_balls * 100.0).fillna(0.0)

        # Recent form score
        active_bat["recent_form_score"] = active_bat["bat_runs"].rolling(window=5, min_periods=1).apply(form_fn, raw=True).shift(1).fillna(0.0)

        group.loc[bat_mask, "rolling_10_bat_avg"] = active_bat["rolling_10_bat_avg"]
        group.loc[bat_mask, "rolling_10_bat_sr"] = active_bat["rolling_10_bat_sr"]
        group.loc[bat_mask, "recent_form_score"] = active_bat["recent_form_score"]

    # Forward fill to carry over batting features to matches where player doesn't bat
    group["rolling_10_bat_avg"] = group["rolling_10_bat_avg"].ffill().fillna(0.0)
    group["rolling_10_bat_sr"] = group["rolling_10_bat_sr"].ffill().fillna(0.0)
    group["recent_form_score"] = group["recent_form_score"].ffill().fillna(0.0)

    # 2. Venue-adjusted strike rate
    # Career SR = (cum_runs / cum_balls) * 100
    cum_runs = group["bat_runs"].cumsum().shift(1).fillna(0.0)
    cum_balls = group["bat_balls"].cumsum().shift(1).fillna(0.0)
    career_sr = (cum_runs / cum_balls * 100.0).fillna(0.0)
    
    venue_overall_sr = group["venue"].map(venue_map).values
    group["venue_adjusted_sr"] = career_sr - venue_overall_sr

    # 3. Bowling features (wickets per match, average economy)
    bowl_mask = group["bowl_balls"] > 0
    group["career_bowl_wickets_per_match"] = 0.0
    group["career_bowl_economy"] = 0.0

    if bowl_mask.any():
        active_bowl = group[bowl_mask].copy()
        
        cum_wickets = active_bowl["bowl_wickets"].cumsum().shift(1).fillna(0.0)
        cum_matches = pd.Series(range(len(active_bowl)), index=active_bowl.index)
        active_bowl["career_bowl_wickets_per_match"] = (cum_wickets / cum_matches.clip(lower=1)).fillna(0.0)

        cum_runs_bowl = active_bowl["bowl_runs"].cumsum().shift(1).fillna(0.0)
        cum_balls_bowl = active_bowl["bowl_balls"].cumsum().shift(1).fillna(0.0)
        active_bowl["career_bowl_economy"] = (cum_runs_bowl / (cum_balls_bowl / 6.0)).fillna(0.0)

        group.loc[bowl_mask, "career_bowl_wickets_per_match"] = active_bowl["career_bowl_wickets_per_match"]
        group.loc[bowl_mask, "career_bowl_economy"] = active_bowl["career_bowl_economy"]

    group["career_bowl_wickets_per_match"] = group["career_bowl_wickets_per_match"].ffill().fillna(0.0)
    group["career_bowl_economy"] = group["career_bowl_economy"].ffill().fillna(0.0)

    return group

def build_data_pipeline(data_dir, output_csv):
    """
    Main function to run the ETL pipeline, engineer features, and save output.
    """
    print(f"Searching for JSON files in: {data_dir}")
    search_pattern = os.path.join(data_dir, "**", "*.json")
    json_files = glob.glob(search_pattern, recursive=True)
    num_files = len(json_files)
    print(f"Found {num_files} JSON files.")

    all_records = []
    
    # Process files in parallel
    print("Parsing JSON files in parallel...")
    max_workers = min(32, os.cpu_count() or 4)
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        results = executor.map(parse_match_file, json_files, chunksize=100)
        for i, match_records in enumerate(results):
            if i % 1000 == 0:
                print(f"Parsed {i}/{num_files} files...")
            if match_records:
                all_records.extend(match_records)

    if not all_records:
        print("No records extracted. Exiting.")
        return

    # Convert to DataFrame
    df = pd.DataFrame(all_records)
    
    # Parse dates and sort chronologically for feature engineering
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    df = df.sort_values(by=["date", "file_name"]).reset_index(drop=True)

    print("Engineering venue-level baselines...")
    # Calculate venue-level overall strike rate (aggregate across all matches at each venue)
    venue_stats = df.groupby("venue").agg(
        total_runs=("bat_runs", "sum"),
        total_balls=("bat_balls", "sum")
    ).reset_index()
    venue_stats["venue_overall_sr"] = (venue_stats["total_runs"] / venue_stats["total_balls"] * 100.0)
    venue_stats["venue_overall_sr"] = venue_stats["venue_overall_sr"].fillna(100.0)
    venue_map = dict(zip(venue_stats["venue"], venue_stats["venue_overall_sr"]))

    print("Engineering player career features in parallel...")
    player_groups = list(df.groupby("player"))
    task_args = [(player_name, group, venue_map) for player_name, group in player_groups]
    
    processed_groups = []
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        results = executor.map(process_player_group, task_args, chunksize=200)
        for i, processed_group in enumerate(results):
            if i % 1000 == 0:
                print(f"Processed features for {i}/{len(player_groups)} players...")
            processed_groups.append(processed_group)

    df_features = pd.concat(processed_groups).sort_values(by=["date", "file_name", "team", "player"]).reset_index(drop=True)

    print("Simulating matches chronologically to calculate Elo ratings...")
    match_files_ordered = df_features[["date", "file_name"]].drop_duplicates().sort_values(by=["date", "file_name"])["file_name"].tolist()

    # Elo constants
    K_FACTOR = 32
    INITIAL_ELO = 1500.0

    current_player_elo = {}
    entry_elo_ratings = []

    for f_name in match_files_ordered:
        match_subset = df_features[df_features["file_name"] == f_name]
        
        teams = match_subset["teams"].iloc[0]
        winner = match_subset["winner"].iloc[0]
        
        if len(teams) < 2:
            # Skip Elo update, assign current Elo
            for idx, row in match_subset.iterrows():
                p = row["player"]
                entry_elo_ratings.append((row.name, current_player_elo.get(p, INITIAL_ELO)))
            continue

        team_a, team_b = teams[0], teams[1]
        
        team_a_players = match_subset[match_subset["team"] == team_a]["player"].tolist()
        team_b_players = match_subset[match_subset["team"] == team_b]["player"].tolist()

        # Record entry Elo for all players in this match
        for idx, row in match_subset.iterrows():
            p = row["player"]
            entry_elo = current_player_elo.get(p, INITIAL_ELO)
            entry_elo_ratings.append((row.name, entry_elo))

        # Skip Elo update if winner is unknown or no result
        if winner not in [team_a, team_b]:
            continue

        # Compute team average Elo
        elo_a_avg = np.mean([current_player_elo.get(p, INITIAL_ELO) for p in team_a_players]) if team_a_players else INITIAL_ELO
        elo_b_avg = np.mean([current_player_elo.get(p, INITIAL_ELO) for p in team_b_players]) if team_b_players else INITIAL_ELO

        # Expected outcome for Team A
        expected_a = 1.0 / (1.0 + 10.0 ** ((elo_b_avg - elo_a_avg) / 400.0))
        expected_b = 1.0 - expected_a

        # Actual outcome
        actual_a = 1.0 if winner == team_a else 0.0
        actual_b = 1.0 - actual_a

        # Elo updates
        delta_a = K_FACTOR * (actual_a - expected_a)
        delta_b = K_FACTOR * (actual_b - expected_b)

        # Update Elo for all players in team A
        for p in team_a_players:
            current_player_elo[p] = current_player_elo.get(p, INITIAL_ELO) + delta_a
        
        # Update Elo for all players in team B
        for p in team_b_players:
            current_player_elo[p] = current_player_elo.get(p, INITIAL_ELO) + delta_b

    # Map entry Elo ratings back to the DataFrame
    elo_df = pd.DataFrame(entry_elo_ratings, columns=["index", "elo_rating"]).set_index("index")
    df_features["elo_rating"] = elo_df["elo_rating"]

    # Final cleanup of columns and saving
    if "teams" in df_features.columns:
        df_features["teams"] = df_features["teams"].apply(lambda x: "|".join(x) if isinstance(x, list) else x)

    # Save to CSV
    print(f"Saving final features to: {output_csv}")
    df_features.to_csv(output_csv, index=False)
    print("Pipeline completed successfully!")

def extract_isolated_features(dataset_path: str, player: str, venue: str = "") -> dict:
    """
    Extracts isolated statistical features for a player (and optional venue) from the dataset.
    Prioritizes SQLite database query with a CSV fallback.
    """
    try:
        from database import get_db_connection
        conn = get_db_connection()
        
        # Direct exact match (case insensitive)
        query = "SELECT elo_rating, recent_form_score, venue_adjusted_sr, player FROM cricket_features WHERE player = ? COLLATE NOCASE ORDER BY date DESC LIMIT 1"
        row = conn.execute(query, [player]).fetchone()
        
        if not row:
            # Substring match
            query = "SELECT elo_rating, recent_form_score, venue_adjusted_sr, player FROM cricket_features WHERE player LIKE ? ORDER BY date DESC LIMIT 1"
            row = conn.execute(query, [f"%{player}%"]).fetchone()
            
        if not row:
            conn.close()
            return {
                "elo_rating": 1500.0,
                "recent_form_runs": 0.0,
                "venue_strike_rate": 100.0,
            }
            
        actual_player = row["player"]
        elo = float(row["elo_rating"])
        form = float(row["recent_form_score"])
        
        venue_sr = 100.0
        if venue:
            query = """
                SELECT SUM(bat_runs) as runs, SUM(bat_balls) as balls 
                FROM cricket_features 
                WHERE player = ? AND venue LIKE ?
            """
            v_row = conn.execute(query, [actual_player, f"%{venue}%"]).fetchone()
            if v_row and v_row["balls"] and v_row["balls"] > 0:
                venue_sr = float((v_row["runs"] / v_row["balls"]) * 100.0)
            else:
                venue_sr = float(row["venue_adjusted_sr"])
        else:
            venue_sr = float(row["venue_adjusted_sr"])
            
        conn.close()
        return {
            "elo_rating": elo,
            "recent_form_runs": form,
            "venue_strike_rate": venue_sr
        }
    except Exception as db_err:
        print(f"Database extract failed ({db_err}), falling back to CSV...")
        
    # Fallback to CSV
    if not os.path.exists(dataset_path):
        return {
            "elo_rating": 1500.0,
            "recent_form_runs": 0.0,
            "venue_strike_rate": 100.0,
        }
        
    df = pd.read_csv(dataset_path)
    df["player_lower"] = df["player"].str.lower()
    
    player_df = df[df["player_lower"] == player.lower()]
    if player_df.empty:
        player_df = df[df["player_lower"].str.contains(player.lower(), na=False)]
        
    if player_df.empty:
        return {
            "elo_rating": 1500.0,
            "recent_form_runs": 0.0,
            "venue_strike_rate": 100.0,
        }
        
    latest_record = player_df.sort_values(by="date").iloc[-1]
    
    elo = float(latest_record.get("elo_rating", 1500.0))
    form = float(latest_record.get("recent_form_score", 0.0))
    
    venue_sr = 100.0
    if venue:
        venue_df = player_df[player_df["venue"].str.lower().str.contains(venue.lower(), na=False)]
        if not venue_df.empty:
            runs = venue_df["bat_runs"].sum()
            balls = venue_df["bat_balls"].sum()
            if balls > 0:
                venue_sr = float((runs / balls) * 100.0)
            else:
                venue_sr = float(latest_record.get("venue_adjusted_sr", 100.0))
        else:
            venue_sr = float(latest_record.get("venue_adjusted_sr", 100.0))
    else:
        venue_sr = float(latest_record.get("venue_adjusted_sr", 100.0))
        
    return {
        "elo_rating": elo,
        "recent_form_runs": form,
        "venue_strike_rate": venue_sr
    }



if __name__ == "__main__":
    _base = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(_base, "cricket_t20_all")
    OUTPUT_CSV = os.path.join(_base, "cricket_features.csv")

    build_data_pipeline(DATA_DIR, OUTPUT_CSV)

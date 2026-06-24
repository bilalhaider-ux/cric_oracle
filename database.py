import os
import sqlite3
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "cricket_oracle.db")
CSV_PATH = os.path.join(BASE_DIR, "cricket_features.csv")

def get_db_connection():
    """
    Returns a connection to the SQLite database.
    Performs auto-migration if the database is missing.
    """
    if not os.path.exists(DB_PATH):
        init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Creates the SQLite database from the CSV dataset and indexes it.
    """
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"Source CSV dataset not found at {CSV_PATH}")

    print("Initializing SQLite database from CSV. This is a one-time migration...")
    try:
        # Load the CSV file
        df = pd.read_csv(CSV_PATH)
        
        # Connect to SQLite
        conn = sqlite3.connect(DB_PATH)
        
        # Write dataset to SQLite table
        df.to_sql("cricket_features", conn, if_exists="replace", index=False)
        
        # Create indexes for high-speed queries
        cursor = conn.cursor()
        print("Creating indexes on 'player', 'venue', and 'date'...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_player ON cricket_features(player);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_player_lower ON cricket_features(player COLLATE NOCASE);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_venue ON cricket_features(venue COLLATE NOCASE);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_date ON cricket_features(date);")
        conn.commit()
        conn.close()
        print("SQLite Database successfully initialized and indexed!")
    except Exception as e:
        print(f"Error during SQLite migration: {e}")
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        raise e

if __name__ == "__main__":
    init_db()

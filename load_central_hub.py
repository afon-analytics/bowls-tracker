"""
Load Central_Hub.xlsx → Supabase

Reads the Data Feed sheet from Central_Hub.xlsx and inserts rows into
the existing games, ends, and deliveries tables.

Prerequisites:
  pip install pandas openpyxl supabase python-dotenv

Environment variables:
  SUPABASE_URL          – e.g. https://ckgppsxswmpzrngzpacv.supabase.co
  SUPABASE_SERVICE_KEY  – service-role key (not the anon key)

Place Central_Hub.xlsx in the same directory before running.
"""

import pandas as pd
import os
import sys
from supabase import create_client

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "Central_Hub.xlsx")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("Error: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.")

if not os.path.exists(EXCEL_PATH):
    sys.exit(f"Error: {EXCEL_PATH} not found. Place Central_Hub.xlsx alongside this script.")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Read Excel ────────────────────────────────────────────────────────────────
xl = pd.ExcelFile(EXCEL_PATH)
df_feed = pd.read_excel(xl, sheet_name="Data Feed", header=0)

print(f"Raw Data Feed rows: {len(df_feed)}")

# ── Filter to real rows only (drop set-score summary rows) ────────────────────
# Set column contains strings like "Set 1 Score" on summary rows — drop those
df = df_feed[pd.to_numeric(df_feed["Set"], errors="coerce").notna()].copy()
df["Set"] = df["Set"].astype(int)
df["End"] = df["End"].astype("Int64")
df["Bowl"] = df["Bowl"].astype("Int64")
df["Date"] = pd.to_datetime(df["Date"]).dt.date.astype(str)
df["Session"] = pd.to_numeric(df["Session"], errors="coerce").astype("Int64")

# Cast score-related columns safely
df["Score"] = pd.to_numeric(df["Score"], errors="coerce").astype("Int64")
df["Shots For"] = pd.to_numeric(df["Shots For"], errors="coerce").astype("Int64")
df["Shots Against"] = pd.to_numeric(df["Shots Against"], errors="coerce").astype("Int64")

print(f"Filtered bowl-level rows: {len(df)}")

# ── 1. GAMES ──────────────────────────────────────────────────────────────────
# One game per unique (Game, Date, Format) combination
game_cols = ["Game", "Date", "Format"]
games_df = df[game_cols].drop_duplicates().reset_index(drop=True)

game_id_map = {}  # (Game, Date, Format) → uuid

for _, row in games_df.iterrows():
    record = {
        "date": row["Date"],
        "format": row["Format"],
        "tournament_name": row["Game"],
        "game_type": "game",
        "match_structure": "traditional",
        "total_ends": 21,
        "current_end": 1,
        "completed": True,
        "bowls_per_player": 4,
        "players_per_team": 1,
        "your_players": [],
        "opponent_players": [],
        "away_players": [],
        "set_scores": [],
        "end_notes": {},
    }
    result = sb.table("games").insert(record).execute()
    if result.data:
        key = (row["Game"], row["Date"], row["Format"])
        game_id_map[key] = result.data[0]["id"]

print(f"Loaded {len(game_id_map)} games")

# ── 2. ENDS ───────────────────────────────────────────────────────────────────
# Source: rows where EndWon is set ("Yes"/"No") — these carry the end scores
end_rows = df[df["EndWon"].isin(["Yes", "No"])].copy()
end_rows = end_rows.drop_duplicates(subset=["Game", "Date", "Format", "Set", "End"])

end_id_map = {}  # (Game, Date, Format, Set, End) → uuid

for _, row in end_rows.iterrows():
    game_key = (row["Game"], row["Date"], row["Format"])
    game_id = game_id_map.get(game_key)
    if not game_id:
        continue

    record = {
        "game_id": game_id,
        "end_number": int(row["End"]),
        "your_score": int(row["Shots For"]) if pd.notna(row["Shots For"]) else 0,
        "opponent_score": int(row["Shots Against"]) if pd.notna(row["Shots Against"]) else 0,
        "notes": "",
    }
    result = sb.table("ends").insert(record).execute()
    if result.data:
        end_key = (row["Game"], row["Date"], row["Format"], row["Set"], int(row["End"]))
        end_id_map[end_key] = result.data[0]["id"]

print(f"Loaded {len(end_id_map)} ends")

# ── 3. DELIVERIES ─────────────────────────────────────────────────────────────
# Source: rows where Bowl is not null — one row per actual bowl
bowl_rows = df[df["Bowl"].notna()].copy()

# Try to match player names to existing players table
players_result = sb.table("players").select("id, name").execute()
player_name_map = {p["name"]: p["id"] for p in (players_result.data or [])}

delivery_records = []
for _, row in bowl_rows.iterrows():
    game_key = (row["Game"], row["Date"], row["Format"])
    end_key = (row["Game"], row["Date"], row["Format"], row["Set"], int(row["End"]))

    game_id = game_id_map.get(game_key)
    end_id = end_id_map.get(end_key)
    player_id = player_name_map.get(row["Player"])  # None if not in players table

    if not game_id:
        continue

    score = int(row["Score"]) if pd.notna(row["Score"]) else None

    delivery_records.append({
        "game_id": game_id,
        "end_number": int(row["End"]),
        "player_name": str(row["Player"]),
        "player_id": player_id,
        "team": "yours",
        "hand": row["Hand played"] if pd.notna(row.get("Hand played")) else None,
        "shot_type": row["Selection 1"] if pd.notna(row.get("Selection 1")) else None,
        "quality": row["Selection 2"] if pd.notna(row.get("Selection 2")) else None,
        "score_value": score if score is not None else 0,
        "mat_length": row["Mat Length"] if pd.notna(row.get("Mat Length")) else None,
        "jack_length": row["Jack Length"] if pd.notna(row.get("Jack Length")) else None,
        "is_dead": False,
        "notes": str(row["Comments"]) if pd.notna(row.get("Comments")) else "",
        "x": 0,
        "y": 0,
        "distance_in_feet": 0,
        "timestamp": f"{row['Date']}T00:00:00Z",
    })

# Insert in batches of 500
for i in range(0, len(delivery_records), 500):
    chunk = delivery_records[i:i + 500]
    sb.table("deliveries").insert(chunk).execute()
    print(f"  Inserted deliveries {i}–{i + len(chunk)}")

print(f"Total deliveries loaded: {len(delivery_records)}")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n── Summary ─────────────────────────────────────")
print(f"  Games:      {len(game_id_map)}")
print(f"  Ends:       {len(end_id_map)}")
print(f"  Deliveries: {len(delivery_records)}")
print("Done.")

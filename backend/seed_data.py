import psycopg2
import os
import random
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

def seed_dummy_data():
    # Use localhost if running from outside docker, otherwise use DATABASE_URL as is
    db_url = os.getenv("DATABASE_URL")
    if "@db:" in db_url:
        db_url = db_url.replace("@db:", "@localhost:")
    
    print(f"Connecting to database at {db_url}...")
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    # 1. Ensure a demo user exists
    cursor.execute(
        "INSERT INTO users (github_id, username, avatar_url) "
        "VALUES (%s, %s, %s) ON CONFLICT (github_id) DO NOTHING;",
        ("000000", "demo_user", "https://api.dicebear.com/7.x/avataaars/svg?seed=demo")
    )
    
    # 2. Define dummy repos and metrics
    repos = ["demo/awesome-project", "demo/legacy-app"]
    metrics_config = {
        "open_issues_count": {"base": 50, "variation": 20, "trend": 0.5},
        "avg_pr_merge_time_hours": {"base": 48, "variation": 24, "trend": -0.2},
        "weekly_commit_count": {"base": 15, "variation": 10, "trend": 0.1},
        "weekly_code_additions": {"base": 500, "variation": 300, "trend": 5}
    }

    now = datetime.now(timezone.utc)
    
    print("Seeding metrics for the last 30 days...")
    
    for repo in repos:
        # We'll create one ingestion run per day for the last 30 days
        for day in range(30, -1, -1):
            timestamp = now - timedelta(days=day)
            
            # Insert ingestion run
            cursor.execute(
                "INSERT INTO ingestion_runs (fetched_at, repo, status) "
                "VALUES (%s, %s, %s) RETURNING id;",
                (timestamp, repo, "success")
            )
            run_id = cursor.fetchone()[0]
            
            # Insert metrics with some "random walk" + trend logic
            for metric_name, cfg in metrics_config.items():
                # Value = base + (day_index * trend) + random_variation
                # day_index goes from 0 (30 days ago) to 30 (today)
                day_index = 30 - day
                value = cfg["base"] + (day_index * cfg["trend"]) + random.uniform(-cfg["variation"], cfg["variation"])
                value = max(0, value) # No negative values
                
                cursor.execute(
                    "INSERT INTO metrics (run_id, timestamp, repo, metric_name, value) "
                    "VALUES (%s, %s, %s, %s, %s);",
                    (run_id, timestamp, repo, metric_name, value)
                )
    
    conn.commit()
    cursor.close()
    conn.close()
    print("Successfully seeded dummy data for 30 days!")

if __name__ == "__main__":
    seed_dummy_data()

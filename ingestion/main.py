import psycopg2
import os
import requests
import math
from models import IngestionRun, MetricRecord
from datetime import datetime


# Fetch open issues function
def fetch_open_issues(repo: str, token: str) -> float:
    response = requests.get(f"https://api.github.com/repos/{repo}", 
                            headers={"Authorization": f"Bearer {token}"})
    data = response.json()
    return float(data["open_issues_count"])

# Fetch weekly commits
def fetch_weekly_commits(repo, token) -> float:
    response = requests.get(f"https://api.github.com/repos/{repo}/stats/commit_activity", 
                            headers={"Authorization": f"Bearer {token}"})
    data = response.json()
    return float(data[-1]["total"])

# Fetch weekly additions
def fetch_weekly_additions(repo, token) -> float:
    response = requests.get(f"https://api.github.com/repos/{repo}/stats/code_frequency", 
                            headers={"Authorization": f"Bearer {token}"})
    data = response.json()
    return float(data[-1][1])

# Fetch average PR merge time
def fetch_avg_pr_merge_time(repo, token) -> float:
    response = requests.get(f"https://api.github.com/repos/{repo}/pulls?state=closed&per_page=20", 
                            headers={"Authorization": f"Bearer {token}"})
    data = response.json()
    
    total_hours = 0
    count = 0
    for pr in data:
        if pr["merged_at"] is None:
            continue
        created = datetime.fromisoformat(pr["created_at"].replace("Z", "+00:00"))
        merged = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
        total_hours += (merged - created).total_seconds() / 3600
        count += 1
    return total_hours / count if count > 0 else 0.0
        


# ----- INSERT FUNCTIONS ----- #
def insert_ingestion_run(cursor, run: IngestionRun) -> int:
    cursor.execute(
        "INSERT INTO ingestion_runs (fetched_at, repo, status) " \
        "VALUES (%s, %s, %s) " \
        "RETURNING id;",
        (run.fetched_at, run.repo, run.status)
    )
    return cursor.fetchone()[0] # return the run_id

def insert_metric(cursor, run_id: int, metric: MetricRecord):
    cursor.execute(
        "INSERT INTO metrics (run_id, timestamp, repo, metric_name, value) " \
        "VALUES (%s, %s, %s, %s, %s);",
        (run_id, metric.timestamp, metric.repo, metric.metric_name, metric.value)
    )


# ----- MAIN ----- #
def main():
    # Connect to the database
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cursor = conn.cursor()

    # Fetch all users with a token
    cursor.execute("SELECT username, github_access_token FROM users WHERE github_access_token IS NOT NULL;")
    users = cursor.fetchall()

    for username, token in users:
        repo = f"{username}/pulseBoard"

        # Insert ingestion run
        run = IngestionRun(repo=repo, status="success")
        run_id = insert_ingestion_run(cursor, run)

        # Fetch -> validate -> insert each metric
        metric_to_fetch = [
            ("open_issues_count", fetch_open_issues),
            ("weekly_commit_count", fetch_weekly_commits),
            ("weekly_code_additions", fetch_weekly_additions),
            ("avg_pr_merge_time_hours", fetch_avg_pr_merge_time)
        ]

        for metric_name, fetch_fn in metric_to_fetch:
            value = fetch_fn(repo, token)
            metric = MetricRecord(repo=repo, metric_name=metric_name, value=value)
            insert_metric(cursor, run_id, metric)
            
        conn.commit()

    cursor.close()
    conn.close()

if __name__ == "__main__":
    main()



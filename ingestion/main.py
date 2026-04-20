import psycopg2
import os
import requests
import sys
import time
from models import IngestionRun, MetricRecord
from datetime import datetime, timezone
from apscheduler.schedulers.blocking import BlockingScheduler

GITHUB_HEADERS = lambda token: {"Authorization": f"Bearer {token}"}


def fetch_github_stats(url: str, token: str, retries: int = 3, wait: int = 5):
    """
    GitHub stats endpoints return 202 while they compute data in the background.
    Retries up to `retries` times with `wait` seconds between attempts.
    Returns the parsed JSON on 200, or None if still not ready after all retries.
    """
    for attempt in range(retries + 1):
        response = requests.get(url, headers=GITHUB_HEADERS(token))
        if response.status_code == 200:
            return response.json()
        if response.status_code == 202:
            if attempt < retries:
                print(f"[INFO] GitHub computing stats ({attempt + 1}/{retries}), retrying in {wait}s… {url}")
                time.sleep(wait)
            continue
        response.raise_for_status()
    print(f"[WARN] Stats not ready after {retries} retries, skipping: {url}")
    return None


# Fetch open issues function
def fetch_open_issues(repo: str, token: str) -> float:
    response = requests.get(
        f"https://api.github.com/repos/{repo}",
        headers=GITHUB_HEADERS(token),
    )
    response.raise_for_status()
    return float(response.json()["open_issues_count"])

# Fetch weekly commits
def fetch_weekly_commits(repo, token) -> float:
    data = fetch_github_stats(
        f"https://api.github.com/repos/{repo}/stats/commit_activity", token
    )
    if not isinstance(data, list) or len(data) == 0:
        return 0.0
    return float(data[-1]["total"])

# Fetch weekly additions
def fetch_weekly_additions(repo, token) -> float:
    data = fetch_github_stats(
        f"https://api.github.com/repos/{repo}/stats/code_frequency", token
    )
    if not isinstance(data, list) or len(data) == 0:
        return 0.0
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


# Run the ingestion pipeline
def run_ingestion():
    # Connect to the database
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    cursor = conn.cursor()

    # Fetch all users with a token
    cursor.execute("SELECT username, github_access_token FROM users WHERE github_access_token IS NOT NULL;")
    users = cursor.fetchall()

    for username, token in users:
        # Fetch all repos owned by this user from GitHub
        gh_response = requests.get(
            "https://api.github.com/user/repos",
            headers={"Authorization": f"Bearer {token}"},
            params={"per_page": 100, "sort": "updated", "affiliation": "owner"},
        )
        if gh_response.status_code != 200:
            print(f"[WARN] Could not fetch repos for {username}: {gh_response.status_code}")
            continue

        repos = [r["full_name"] for r in gh_response.json() if not r["fork"]]

        metric_to_fetch = [
            ("open_issues_count", fetch_open_issues),
            ("weekly_commit_count", fetch_weekly_commits),
            ("weekly_code_additions", fetch_weekly_additions),
            ("avg_pr_merge_time_hours", fetch_avg_pr_merge_time)
        ]

        for repo in repos:
            # Insert ingestion run
            run = IngestionRun(repo=repo, status="success")
            run_id = insert_ingestion_run(cursor, run)
            conn.commit()

            # Fetch -> validate -> insert each metric
            try:
                for metric_name, fetch_fn in metric_to_fetch:
                    value = fetch_fn(repo, token)
                    metric = MetricRecord(repo=repo, metric_name=metric_name, value=value)
                    insert_metric(cursor, run_id, metric)

                conn.commit()
            except Exception as e:
                # Undo all the changes for this repo
                conn.rollback()
                print(f"[ERROR] Failed run for {repo}: {e}")

                # Update the run status to "error"
                cursor.execute(
                    "UPDATE ingestion_runs SET status = %s WHERE id = %s;",
                    ("error", run_id)
                )
                conn.commit()


    cursor.close()
    conn.close()

# ----- MAIN ----- #
def main():
    """
    Two run modes:

    - default (local docker compose): start the BlockingScheduler and loop forever.
    - one-shot (Render Cron, GitHub Actions, etc.): pass --once or set
      RUN_ONCE=1 to ingest a single batch and exit. The external scheduler is
      then responsible for invoking us every N minutes.
    """
    once = "--once" in sys.argv or os.getenv("RUN_ONCE") == "1"

    print(f"[{datetime.now(timezone.utc)}] Starting ingestion service...")
    run_ingestion()

    if once:
        print("RUN_ONCE set, exiting after a single ingestion.")
        return

    scheduler = BlockingScheduler()
    scheduler.add_job(run_ingestion, "interval", minutes=10)
    print("Scheduler running every 10 minutes")
    scheduler.start()


if __name__ == "__main__":
    main()



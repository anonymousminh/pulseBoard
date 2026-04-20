from auth import app, get_current_user
import psycopg2
import psycopg2.extras
import os
import requests
from datetime import datetime, timezone, timedelta
from fastapi import Depends, HTTPException


# How long since the last successful ingestion run before we mark a repo's
# data as stale. Tuned to be ~3x the ingestion interval (10 min) so we don't
# flap on a single missed run.
STALE_WARN_MINUTES = 30
STALE_CRIT_MINUTES = 120

# Per-metric thresholds. `warn` raises a yellow alert, `crit` raises a red one.
# `direction` controls whether high or low values are bad.
METRIC_THRESHOLDS = {
    "open_issues_count": {
        "label": "Open issues",
        "warn": 50,
        "crit": 200,
        "direction": "high",
        "unit": "",
    },
    "avg_pr_merge_time_hours": {
        "label": "Avg PR merge time",
        "warn": 72,
        "crit": 168,
        "direction": "high",
        "unit": "h",
    },
    "weekly_commit_count": {
        "label": "Weekly commits",
        "warn": 1,
        "crit": 0,
        "direction": "low",
        "unit": "",
    },
}


# health endpoint
@app.get("/health")
async def get_health():
    return {"status": "ok"}


def _get_user_repos(user_id: str):
    """Fetch the authenticated user's GitHub-owned, non-fork repos."""
    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT github_access_token FROM users WHERE username = %s;",
            (user_id,),
        )
        row = cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="User token not found")

    token = row[0]
    gh_response = requests.get(
        "https://api.github.com/user/repos",
        headers={"Authorization": f"Bearer {token}"},
        params={"per_page": 100, "sort": "updated", "affiliation": "owner"},
        timeout=10,
    )

    if gh_response.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch repos from GitHub")

    return [r["full_name"] for r in gh_response.json() if not r["fork"]]


# repos endpoint
@app.get("/repos")
async def get_repos(user_id: str = Depends(get_current_user)):
    return {"repos": _get_user_repos(user_id)}


# metrics endpoint
@app.get("/metrics")
async def get_metrics(repo: str, metric_name: str = None, user_id: str = Depends(get_current_user)):
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        cursor = conn.cursor()

        if metric_name:
            cursor.execute(
                "SELECT metric_name, value, timestamp FROM metrics "
                "WHERE repo = %s AND metric_name = %s "
                "ORDER BY timestamp DESC LIMIT 100;",
                (repo, metric_name),
            )
        else:
            cursor.execute(
                "SELECT metric_name, value, timestamp FROM metrics "
                "WHERE repo = %s ORDER BY timestamp DESC LIMIT 100;",
                (repo,),
            )

        metrics = cursor.fetchall()
        if not metrics:
            raise HTTPException(status_code=404, detail="No metrics found")
    finally:
        cursor.close()
        conn.close()

    return [{"metric_name": m[0], "value": m[1], "timestamp": m[2]} for m in metrics]


def _evaluate_threshold(metric_name: str, value):
    """Return (severity, threshold, message) or None if value is healthy."""
    cfg = METRIC_THRESHOLDS.get(metric_name)
    if cfg is None or value is None:
        return None

    direction = cfg["direction"]
    warn = cfg["warn"]
    crit = cfg["crit"]
    unit = cfg["unit"]
    label = cfg["label"]

    def fmt(v):
        return f"{v:g}{unit}"

    if direction == "high":
        if value >= crit:
            return ("critical", crit, f"{label} is {fmt(value)} (>= {fmt(crit)})")
        if value >= warn:
            return ("warning", warn, f"{label} is {fmt(value)} (>= {fmt(warn)})")
    else:  # low: smaller is worse
        if value <= crit:
            return ("critical", crit, f"{label} is {fmt(value)} (<= {fmt(crit)})")
        if value <= warn:
            return ("warning", warn, f"{label} is {fmt(value)} (<= {fmt(warn)})")
    return None


def _staleness(last_run_at):
    """Return ('fresh'|'stale_warn'|'stale_crit'|'unknown', age_minutes)."""
    if last_run_at is None:
        return ("unknown", None)

    now = datetime.now(timezone.utc)
    if last_run_at.tzinfo is None:
        last_run_at = last_run_at.replace(tzinfo=timezone.utc)
    age_minutes = (now - last_run_at).total_seconds() / 60

    if age_minutes >= STALE_CRIT_MINUTES:
        return ("stale_crit", age_minutes)
    if age_minutes >= STALE_WARN_MINUTES:
        return ("stale_warn", age_minutes)
    return ("fresh", age_minutes)


def _repo_status(last_run_status, stale_state, alerts):
    """Roll a repo's signals up to a single green/yellow/red status."""
    has_critical_alert = any(a["severity"] == "critical" for a in alerts)
    has_warning_alert = any(a["severity"] == "warning" for a in alerts)

    if (
        last_run_status == "error"
        or stale_state == "stale_crit"
        or has_critical_alert
    ):
        return "red"
    if (
        last_run_status == "partial"
        or stale_state in ("stale_warn", "unknown")
        or has_warning_alert
    ):
        return "yellow"
    return "green"


# repos health endpoint - powers the RepoHealthTable + AlertPanel
@app.get("/repos/health")
async def get_repos_health(user_id: str = Depends(get_current_user)):
    repos = _get_user_repos(user_id)

    if not repos:
        return {"repos": [], "alerts": []}

    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        cursor.execute(
            """
            SELECT DISTINCT ON (repo) repo, fetched_at, status
            FROM ingestion_runs
            WHERE repo = ANY(%s)
            ORDER BY repo, fetched_at DESC;
            """,
            (repos,),
        )
        last_runs = {row["repo"]: row for row in cursor.fetchall()}

        cursor.execute(
            """
            SELECT DISTINCT ON (repo, metric_name)
                   repo, metric_name, value, timestamp
            FROM metrics
            WHERE repo = ANY(%s)
            ORDER BY repo, metric_name, timestamp DESC;
            """,
            (repos,),
        )
        latest_metrics = {}
        for row in cursor.fetchall():
            latest_metrics.setdefault(row["repo"], {})[row["metric_name"]] = {
                "value": row["value"],
                "timestamp": row["timestamp"],
            }
    finally:
        cursor.close()
        conn.close()

    repo_payloads = []
    all_alerts = []

    for repo in repos:
        run = last_runs.get(repo)
        last_run_at = run["fetched_at"] if run else None
        last_run_status = run["status"] if run else None

        stale_state, age_minutes = _staleness(last_run_at)
        metrics = latest_metrics.get(repo, {})

        repo_alerts = []
        for metric_name, metric in metrics.items():
            evaluated = _evaluate_threshold(metric_name, metric["value"])
            if evaluated is None:
                continue
            severity, threshold, message = evaluated
            alert = {
                "repo": repo,
                "metric_name": metric_name,
                "value": metric["value"],
                "threshold": threshold,
                "severity": severity,
                "message": message,
                "timestamp": metric["timestamp"],
            }
            repo_alerts.append(alert)
            all_alerts.append(alert)

        status = _repo_status(last_run_status, stale_state, repo_alerts)

        repo_payloads.append({
            "repo": repo,
            "status": status,
            "last_run_at": last_run_at,
            "last_run_status": last_run_status,
            "age_minutes": age_minutes,
            "stale_state": stale_state,
            "metrics": {
                name: {
                    "value": data["value"],
                    "timestamp": data["timestamp"],
                }
                for name, data in metrics.items()
            },
            "alerts": repo_alerts,
        })

    severity_rank = {"critical": 0, "warning": 1}
    all_alerts.sort(key=lambda a: (severity_rank.get(a["severity"], 9), a["repo"]))

    return {"repos": repo_payloads, "alerts": all_alerts}

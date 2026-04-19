from auth import app, get_current_user
import psycopg2
import os
import requests
from fastapi import Depends, HTTPException


# health endpoint
@app.get("/health")
async def get_health():
    return {"status": "ok"}

# repos endpoint
@app.get("/repos")
async def get_repos(user_id: str = Depends(get_current_user)):
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        cursor = conn.cursor()
        cursor.execute(
            "SELECT github_access_token FROM users WHERE username = %s;",
            (user_id,)
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
    )

    if gh_response.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch repos from GitHub")

    repos = [r["full_name"] for r in gh_response.json() if not r["fork"]]
    return {"repos": repos}


# metrics endpoint
@app.get("/metrics")
async def get_metrics(repo: str, metric_name: str = None, user_id: str = Depends(get_current_user)):
    try:
        # Connect to the database
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        cursor = conn.cursor()

        # Query the metrics table
        if metric_name:
            cursor.execute("SELECT metric_name, value, timestamp FROM metrics WHERE repo = %s AND metric_name = %s ORDER BY timestamp DESC LIMIT 100;", (repo, metric_name))
        else:
            cursor.execute("SELECT metric_name, value, timestamp FROM metrics WHERE repo = %s ORDER BY timestamp DESC LIMIT 100;", (repo,))

        metrics = cursor.fetchall()
        if not metrics:
            raise HTTPException(status_code=404, detail="No metrics found")
    finally:
        cursor.close()
        conn.close()

    return [{"metric_name": m[0], "value": m[1], "timestamp": m[2]} for m in metrics]




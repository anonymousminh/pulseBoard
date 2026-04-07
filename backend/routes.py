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
    # Use the user_id to look up the username in users table
    try:
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        cursor = conn.cursor()

        cursor.execute("SELECT username FROM users WHERE id = %s;", (user_id,))
        row = cursor.fetchone()
        if row is None:  # Check if fetchone return None -> it should raise an error
            raise HTTPException(status_code=404, detail="User not found")
        username = row[0]
    finally:
        cursor.close()
        conn.close()

    return {"repos": [f"{username}/pulseBoard"]}


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




"""
Idempotent schema bootstrap.

Locally, postgres:15 runs `db/init.sql` once via docker-entrypoint-initdb.d.
On managed databases (Render Postgres, Neon, Supabase) there's no equivalent
hook, so the backend ensures its own schema on startup. CREATE TABLE IF NOT
EXISTS keeps this safe to call every boot.
"""
import os
import psycopg2

SCHEMA = """
CREATE TABLE IF NOT EXISTS ingestion_runs (
    id         SERIAL PRIMARY KEY,
    fetched_at TIMESTAMP NOT NULL,
    repo       VARCHAR(255) NOT NULL,
    status     VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS metrics (
    id          SERIAL PRIMARY KEY,
    run_id      INT REFERENCES ingestion_runs(id),
    timestamp   TIMESTAMP NOT NULL,
    repo        VARCHAR(255) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value       FLOAT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    github_id     VARCHAR(100) UNIQUE NOT NULL,
    username      VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    email         VARCHAR(255),
    github_access_token TEXT,
    first_login   TIMESTAMP DEFAULT NOW(),
    last_login    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metrics_repo_metric_ts_idx
    ON metrics (repo, metric_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS ingestion_runs_repo_fetched_idx
    ON ingestion_runs (repo, fetched_at DESC);
"""


def bootstrap_schema():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("[bootstrap] DATABASE_URL not set, skipping schema bootstrap.")
        return
    try:
        conn = psycopg2.connect(url)
        try:
            with conn.cursor() as cur:
                cur.execute(SCHEMA)
            conn.commit()
            print("[bootstrap] schema ensured.")
        finally:
            conn.close()
    except Exception as e:
        # Don't crash boot if the DB is briefly unavailable; let request-time
        # errors surface in the normal way.
        print(f"[bootstrap] schema bootstrap failed: {e}")

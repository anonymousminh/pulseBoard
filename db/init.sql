-- Run once by docker-entrypoint-initdb.d on the first `db` container start.
-- The backend also runs an idempotent version of this on every boot via
-- backend/db_bootstrap.py, so managed Postgres providers (Render, Neon,
-- Supabase) work without any manual migration step.

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

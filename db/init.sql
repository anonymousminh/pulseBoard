CREATE TABLE ingestion_runs (
    id         SERIAL PRIMARY KEY,
    fetched_at TIMESTAMP NOT NULL,
    repo       VARCHAR(255) NOT NULL,
    status     VARCHAR(50)
);

CREATE TABLE metrics (
    id          SERIAL PRIMARY KEY,
    run_id      INT REFERENCES ingestion_runs(id),
    timestamp   TIMESTAMP NOT NULL,
    repo        VARCHAR(255) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value       FLOAT NOT NULL
);

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    github_id     VARCHAR(100) UNIQUE NOT NULL,
    username      VARCHAR(255) NOT NULL,
    avatar_url    TEXT,
    email         VARCHAR(255),
    first_login   TIMESTAMP DEFAULT NOW(),
    last_login    TIMESTAMP DEFAULT NOW()
);
import { useEffect, useState } from "react";
import { getToken } from "../utils/auth";
import Spinner from "./Spinner";

const API_BASE = "http://localhost:8000";

export const METRIC_OPTIONS = [
  { value: "weekly_commit_count", label: "Weekly commits" },
  { value: "open_issues_count", label: "Open issues" },
  { value: "avg_pr_merge_time_hours", label: "Avg PR merge time (hours)" },
  { value: "weekly_code_additions", label: "Weekly code additions" },
];

const TIME_RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All data" },
];

export default function FilterBar({
  repo,
  metricName,
  timeRange,
  onRepoChange,
  onMetricChange,
  onTimeRangeChange,
}) {
  const [repos, setRepos] = useState([]);
  const [reposStatus, setReposStatus] = useState("idle");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setRepos([]);
      setReposStatus("error");
      return;
    }

    const controller = new AbortController();

    async function loadRepos() {
      setReposStatus("loading");
      try {
        const res = await fetch(`${API_BASE}/repos`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.status === 401) {
          setRepos([]);
          setReposStatus("error");
          return;
        }
        if (!res.ok) throw new Error(`repos ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data.repos) ? data.repos : [];
        setRepos(list);
        setReposStatus("success");
      } catch (e) {
        if (e.name === "AbortError") return;
        setRepos([]);
        setReposStatus("error");
      }
    }

    loadRepos();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (reposStatus !== "success" || repos.length === 0) return;
    if (!repo || !repos.includes(repo)) {
      onRepoChange(repos[0]);
    }
  }, [repos, reposStatus, repo, onRepoChange]);

  const repoDisabled = reposStatus === "loading" || repos.length === 0;
  const filtersDisabled = repoDisabled || reposStatus === "error";

  return (
    <div style={styles.bar}>
      <label style={styles.field}>
        <span style={styles.label}>
          Repository
          {reposStatus === "loading" && (
            <span style={styles.inlineSpinner}>
              <Spinner size={12} />
            </span>
          )}
        </span>
        <select
          value={repoDisabled ? "" : repo}
          onChange={(e) => onRepoChange(e.target.value)}
          disabled={repoDisabled}
          style={styles.select}
        >
          {reposStatus === "loading" && <option value="">Loading…</option>}
          {reposStatus === "success" &&
            repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          {reposStatus === "error" && (
            <option value="">Could not load repos</option>
          )}
          {reposStatus === "success" && repos.length === 0 && (
            <option value="">No repositories</option>
          )}
        </select>
      </label>

      <label style={styles.field}>
        <span style={styles.label}>Metric</span>
        <select
          value={metricName}
          onChange={(e) => onMetricChange(e.target.value)}
          disabled={filtersDisabled}
          style={styles.select}
        >
          {METRIC_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label style={styles.field}>
        <span style={styles.label}>Time range</span>
        <select
          value={timeRange}
          onChange={(e) => onTimeRangeChange(e.target.value)}
          disabled={filtersDisabled}
          style={styles.select}
        >
          {TIME_RANGE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

const styles = {
  bar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    alignItems: "flex-end",
    padding: "1rem",
    backgroundColor: "#fafafa",
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
    marginTop: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    minWidth: "12rem",
  },
  label: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#444",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  inlineSpinner: {
    display: "inline-flex",
    alignItems: "center",
  },
  select: {
    padding: "0.45rem 0.5rem",
    borderRadius: "4px",
    border: "1px solid #ccc",
    fontSize: "0.95rem",
    backgroundColor: "#fff",
  },
};
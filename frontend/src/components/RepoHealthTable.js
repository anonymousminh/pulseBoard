import Spinner from "./Spinner";

const STATUS_META = {
  green: { color: "#1f9d55", bg: "#e6f6ec", label: "Healthy" },
  yellow: { color: "#b07c00", bg: "#fff7d6", label: "Watch" },
  red: { color: "#b1361e", bg: "#fdecea", label: "Unhealthy" },
};

function formatRelative(minutes) {
  if (minutes == null) return "never";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h ago`;
  return `${(hours / 24).toFixed(1)} d ago`;
}

function reasonsFor(repo) {
  const reasons = [];
  if (repo.last_run_status === "error") reasons.push("Last ingestion failed");
  if (repo.last_run_status === "partial") reasons.push("Partial ingestion");
  if (repo.stale_state === "stale_crit") reasons.push("Data is very stale");
  else if (repo.stale_state === "stale_warn") reasons.push("Data is stale");
  else if (repo.stale_state === "unknown") reasons.push("Waiting for first ingestion");
  if (repo.alerts && repo.alerts.length) {
    reasons.push(`${repo.alerts.length} alert${repo.alerts.length > 1 ? "s" : ""}`);
  }
  return reasons.length ? reasons.join(" · ") : "All checks passing";
}

export default function RepoHealthTable({
  repos,
  loading,
  error,
  onRetry,
  selectedRepo,
  onSelectRepo,
}) {
  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <h2 style={styles.title}>Repository health</h2>
        {loading && <Spinner label="Refreshing…" size={14} />}
      </header>

      {error && (
        <div style={styles.errorBox}>
          <span>{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry} style={styles.retryBtn}>
              Retry
            </button>
          )}
        </div>
      )}

      {!error && !loading && repos.length === 0 && (
        <div style={styles.empty}>
          No repository data yet. The ingestion service collects metrics every
          10 minutes — check back shortly after first login.
        </div>
      )}

      {repos.length > 0 && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Repository</th>
                <th style={styles.th}>Last ingestion</th>
                <th style={styles.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {repos.map((repo) => {
                const meta = STATUS_META[repo.status] || STATUS_META.yellow;
                const isSelected = repo.repo === selectedRepo;
                return (
                  <tr
                    key={repo.repo}
                    onClick={() => onSelectRepo && onSelectRepo(repo.repo)}
                    style={{
                      ...styles.row,
                      backgroundColor: isSelected ? "#f0f6ff" : "transparent",
                      cursor: onSelectRepo ? "pointer" : "default",
                    }}
                  >
                    <td style={styles.td}>
                      <span
                        title={meta.label}
                        style={{
                          ...styles.badge,
                          color: meta.color,
                          backgroundColor: meta.bg,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{ ...styles.dot, backgroundColor: meta.color }}
                        />
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{repo.repo}</td>
                    <td style={styles.td}>
                      {formatRelative(repo.age_minutes)}
                      {repo.last_run_status && (
                        <span style={styles.muted}>
                          {" "}
                          · {repo.last_run_status}
                        </span>
                      )}
                    </td>
                    <td style={{ ...styles.td, color: "#555" }}>
                      {reasonsFor(repo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const styles = {
  wrapper: {
    marginTop: "1.5rem",
    padding: "1rem",
    backgroundColor: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.75rem",
  },
  title: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#222",
  },
  errorBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    padding: "0.75rem 1rem",
    color: "#a32d1f",
    backgroundColor: "#fdecea",
    border: "1px solid #f5b7b1",
    borderRadius: "4px",
  },
  retryBtn: {
    padding: "0.35rem 0.75rem",
    border: "1px solid #a32d1f",
    backgroundColor: "transparent",
    color: "#a32d1f",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  empty: {
    padding: "1rem",
    color: "#666",
    fontSize: "0.9rem",
    backgroundColor: "#fafafa",
    border: "1px dashed #ccc",
    borderRadius: "4px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.92rem",
  },
  th: {
    textAlign: "left",
    padding: "0.5rem 0.75rem",
    borderBottom: "1px solid #e0e0e0",
    fontSize: "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "#666",
    fontWeight: 600,
  },
  row: {
    transition: "background-color 0.15s ease",
  },
  td: {
    padding: "0.6rem 0.75rem",
    borderBottom: "1px solid #f0f0f0",
    verticalAlign: "middle",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.15rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.78rem",
    fontWeight: 600,
  },
  dot: {
    display: "inline-block",
    width: "0.55rem",
    height: "0.55rem",
    borderRadius: "50%",
  },
  muted: {
    color: "#888",
    fontSize: "0.85rem",
  },
};

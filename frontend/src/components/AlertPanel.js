import { METRIC_OPTIONS } from "./FilterBar";

const SEVERITY_META = {
  critical: { color: "#b1361e", bg: "#fdecea", border: "#f5b7b1", label: "Critical" },
  warning: { color: "#b07c00", bg: "#fff7d6", border: "#f1d68a", label: "Warning" },
};

function metricLabel(metricName) {
  const found = METRIC_OPTIONS.find((m) => m.value === metricName);
  return found ? found.label : metricName;
}

export default function AlertPanel({ alerts, loading, error, onAlertClick }) {
  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <h2 style={styles.title}>
          Alerts
          {alerts.length > 0 && (
            <span style={styles.count}>{alerts.length}</span>
          )}
        </h2>
      </header>

      {error && <div style={styles.errorBox}>{error}</div>}

      {!error && !loading && alerts.length === 0 && (
        <div style={styles.empty}>
          No metrics are crossing alert thresholds. You're in the clear.
        </div>
      )}

      {alerts.length > 0 && (
        <ul style={styles.list}>
          {alerts.map((alert, idx) => {
            const meta =
              SEVERITY_META[alert.severity] || SEVERITY_META.warning;
            const clickable = typeof onAlertClick === "function";
            return (
              <li
                key={`${alert.repo}-${alert.metric_name}-${idx}`}
                onClick={clickable ? () => onAlertClick(alert) : undefined}
                style={{
                  ...styles.item,
                  borderLeftColor: meta.color,
                  backgroundColor: meta.bg,
                  cursor: clickable ? "pointer" : "default",
                }}
              >
                <div style={styles.itemHeader}>
                  <span
                    style={{
                      ...styles.severityBadge,
                      color: meta.color,
                      borderColor: meta.border,
                    }}
                  >
                    {meta.label}
                  </span>
                  <span style={styles.repo}>{alert.repo}</span>
                </div>
                <div style={styles.itemBody}>
                  <strong>{metricLabel(alert.metric_name)}</strong>:{" "}
                  {alert.message}
                </div>
              </li>
            );
          })}
        </ul>
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
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  count: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "1.4rem",
    height: "1.4rem",
    padding: "0 0.4rem",
    borderRadius: "999px",
    backgroundColor: "#b1361e",
    color: "#fff",
    fontSize: "0.75rem",
    fontWeight: 700,
  },
  errorBox: {
    padding: "0.75rem 1rem",
    color: "#a32d1f",
    backgroundColor: "#fdecea",
    border: "1px solid #f5b7b1",
    borderRadius: "4px",
  },
  empty: {
    padding: "1rem",
    color: "#666",
    fontSize: "0.9rem",
    backgroundColor: "#fafafa",
    border: "1px dashed #ccc",
    borderRadius: "4px",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  item: {
    padding: "0.6rem 0.85rem",
    borderLeft: "4px solid",
    borderRadius: "4px",
  },
  itemHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    marginBottom: "0.25rem",
  },
  severityBadge: {
    padding: "0.05rem 0.5rem",
    borderRadius: "999px",
    border: "1px solid",
    backgroundColor: "transparent",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  repo: {
    fontWeight: 600,
    color: "#333",
    fontSize: "0.9rem",
  },
  itemBody: {
    color: "#444",
    fontSize: "0.9rem",
  },
};

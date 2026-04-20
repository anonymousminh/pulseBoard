import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Spinner from "./Spinner";

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTooltipLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MetricsChart({
  data,
  metricLabel,
  loading,
  error,
  staleWarning,
  onRetry,
}) {
  if (loading && (!data || data.length === 0)) {
    return (
      <div style={styles.placeholder}>
        <Spinner label="Loading chart data…" />
      </div>
    );
  }

  if (error && (!data || data.length === 0)) {
    return (
      <div style={styles.placeholderError}>
        <div>{error}</div>
        {onRetry && (
          <button type="button" onClick={onRetry} style={styles.retryBtn}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={styles.placeholder}>
        No data available for this selection.
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.titleRow}>
        {metricLabel && <p style={styles.title}>{metricLabel}</p>}
        {loading && <Spinner size={14} label="Updating…" />}
      </div>

      {staleWarning && (
        <div style={styles.staleBanner} role="status">
          {staleWarning}
        </div>
      )}

      {error && (
        <div style={styles.inlineError} role="alert">
          {error}
          {onRetry && (
            <button type="button" onClick={onRetry} style={styles.inlineRetry}>
              Retry
            </button>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12, fill: "#666" }}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#666" }}
            width={50}
          />
          <Tooltip
            labelFormatter={formatTooltipLabel}
            formatter={(value) => [value, metricLabel || "Value"]}
            contentStyle={{ fontSize: "0.85rem" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#007bff"
            strokeWidth={2}
            dot={data.length <= 30}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
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
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  title: {
    margin: 0,
    fontWeight: 600,
    fontSize: "0.95rem",
    color: "#333",
  },
  placeholder: {
    marginTop: "1.5rem",
    padding: "2rem",
    textAlign: "center",
    color: "#888",
    backgroundColor: "#fafafa",
    border: "1px dashed #ccc",
    borderRadius: "6px",
    fontSize: "0.95rem",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderError: {
    marginTop: "1.5rem",
    padding: "2rem",
    textAlign: "center",
    color: "#c0392b",
    backgroundColor: "#fff5f5",
    border: "1px dashed #e88",
    borderRadius: "6px",
    fontSize: "0.95rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    alignItems: "center",
  },
  retryBtn: {
    padding: "0.4rem 0.9rem",
    border: "1px solid #c0392b",
    backgroundColor: "transparent",
    color: "#c0392b",
    borderRadius: "4px",
    cursor: "pointer",
  },
  staleBanner: {
    padding: "0.5rem 0.75rem",
    backgroundColor: "#fff7d6",
    border: "1px solid #f1d68a",
    color: "#8a6700",
    borderRadius: "4px",
    fontSize: "0.85rem",
    marginBottom: "0.75rem",
  },
  inlineError: {
    padding: "0.5rem 0.75rem",
    backgroundColor: "#fff5f5",
    border: "1px solid #f5b7b1",
    color: "#a32d1f",
    borderRadius: "4px",
    fontSize: "0.85rem",
    marginBottom: "0.75rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.75rem",
  },
  inlineRetry: {
    padding: "0.25rem 0.6rem",
    border: "1px solid #a32d1f",
    backgroundColor: "transparent",
    color: "#a32d1f",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
};

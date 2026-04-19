import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

export default function MetricsChart({ data, metricLabel, loading, error }) {
  if (loading) {
    return <div style={styles.placeholder}>Loading chart data…</div>;
  }

  if (error) {
    return <div style={styles.placeholderError}>{error}</div>;
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
      {metricLabel && <p style={styles.title}>{metricLabel}</p>}
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
  title: {
    margin: "0 0 0.75rem 0",
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
  },
};

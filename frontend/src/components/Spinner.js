export default function Spinner({ size = 18, color = "#007bff", label }) {
  return (
    <span style={styles.wrapper} role="status" aria-live="polite">
      <span
        aria-hidden="true"
        style={{
          ...styles.spinner,
          width: size,
          height: size,
          borderColor: `${color}33`,
          borderTopColor: color,
        }}
      />
      {label && <span style={styles.label}>{label}</span>}
      <style>{keyframes}</style>
    </span>
  );
}

const keyframes = `
@keyframes pb-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

const styles = {
  wrapper: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "#555",
    fontSize: "0.9rem",
  },
  spinner: {
    display: "inline-block",
    border: "2px solid",
    borderRadius: "50%",
    animation: "pb-spin 0.8s linear infinite",
    boxSizing: "border-box",
  },
  label: {
    color: "#555",
  },
};

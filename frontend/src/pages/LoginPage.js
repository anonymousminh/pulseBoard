import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../utils/config";

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // If user already has token, redirect to dashboard
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/dashboard");
    }

    // Check if token is in URL
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token");
    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      // Clear URL and redirect
      window.history.replaceState({}, document.title, window.location.pathname);
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleGitHubLogin = () => {
    window.location.href = `${API_BASE}/auth/github/login`;
  };

  return (
    <div style={styles.container}>
      <h1>Welcome to pulseBoard</h1>
      <button onClick={handleGitHubLogin} style={styles.button}>
        Login with GitHub
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#f5f5f5",
  },
  button: {
    padding: "0.75rem 1.5rem",
    backgroundColor: "#24292e",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
    marginTop: "1rem",
  },
};
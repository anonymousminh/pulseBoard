import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getUser } from "../utils/auth";
import Header from "../components/Header";
import FilterBar, { METRIC_OPTIONS } from "../components/FilterBar";
import MetricsChart from "../components/MetricsChart";

const API_BASE = "http://localhost:8000";
const POLL_INTERVAL_MS = 60_000;

const RANGE_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

function applyTimeRange(points, range) {
  const windowMs = RANGE_MS[range];
  if (!windowMs) return points;
  const cutoff = Date.now() - windowMs;
  return points.filter((p) => new Date(p.timestamp).getTime() >= cutoff);
}

export default function DashboardPage() {
  const [username, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const [repo, setRepo] = useState("");
  const [metricName, setMetricName] = useState("weekly_commit_count");
  const [timeRange, setTimeRange] = useState("7d");

  const [series, setSeries] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);

  const handleRepoChange = useCallback((r) => setRepo(r), []);
  const handleMetricChange = useCallback((m) => setMetricName(m), []);
  const handleTimeRangeChange = useCallback((t) => setTimeRange(t), []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
    } else {
      try {
        const user = getUser();
        setUserName(user.sub);
        setAvatarUrl(user.avatar_url);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching user: ", error);
        setIsLoading(false);
      }
    }
  }, [navigate]);

  const latestFilters = useRef({ repo, metricName });
  useEffect(() => {
    latestFilters.current = { repo, metricName };
  }, [repo, metricName]);

  useEffect(() => {
    if (!repo) return;

    const controller = new AbortController();

    async function fetchMetrics() {
      const token = getToken();
      if (!token) {
        navigate("/");
        return;
      }

      setChartLoading(true);
      setChartError(null);

      try {
        const url = new URL(`${API_BASE}/metrics`);
        url.searchParams.set("repo", latestFilters.current.repo);
        url.searchParams.set("metric_name", latestFilters.current.metricName);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (res.status === 401) {
          navigate("/");
          return;
        }

        if (res.status === 404) {
          setSeries([]);
          setChartLoading(false);
          return;
        }

        if (!res.ok) throw new Error(`metrics ${res.status}`);

        const raw = await res.json();
        const sorted = [...raw].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        setSeries(sorted);
      } catch (e) {
        if (e.name === "AbortError") return;
        setChartError("Failed to load metrics. Retrying in 60 seconds.");
      } finally {
        setChartLoading(false);
      }
    }

    fetchMetrics();
    const intervalId = setInterval(fetchMetrics, POLL_INTERVAL_MS);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [repo, metricName, navigate]);

  const visibleData = applyTimeRange(series, timeRange);

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === metricName)?.label;

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <Header username={username} avatarUrl={avatarUrl} />
      <div style={styles.page}>
        <h1 style={styles.welcome}>Welcome, {username}</h1>
        <FilterBar
          repo={repo}
          metricName={metricName}
          timeRange={timeRange}
          onRepoChange={handleRepoChange}
          onMetricChange={handleMetricChange}
          onTimeRangeChange={handleTimeRangeChange}
        />
        <MetricsChart
          data={visibleData}
          metricLabel={metricLabel}
          loading={chartLoading}
          error={chartError}
        />
      </div>
    </>
  );
}

const styles = {
  page: {
    maxWidth: "1100px",
    margin: "0 auto",
    padding: "0 1rem 2rem",
  },
  welcome: {
    fontSize: "1.4rem",
    fontWeight: 600,
    margin: "1.25rem 0 0",
    color: "#222",
  },
};

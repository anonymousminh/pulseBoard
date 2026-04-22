import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, getUser } from "../utils/auth";
import Header from "../components/Header";
import FilterBar, { METRIC_OPTIONS } from "../components/FilterBar";
import MetricsChart from "../components/MetricsChart";
import RepoHealthTable from "../components/RepoHealthTable";
import AlertPanel from "../components/AlertPanel";
import Spinner from "../components/Spinner";
import { API_BASE } from "../utils/config";

const POLL_INTERVAL_MS = 60_000;
const STALE_DATA_WARN_MINUTES = 30;

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

function describeStale(latestTimestamp) {
  if (!latestTimestamp) return null;
  const ageMinutes =
    (Date.now() - new Date(latestTimestamp).getTime()) / (1000 * 60);
  if (ageMinutes < STALE_DATA_WARN_MINUTES) return null;
  if (ageMinutes < 60) {
    return `Data may be stale — newest sample is ${Math.round(
      ageMinutes
    )} min old.`;
  }
  const hours = (ageMinutes / 60).toFixed(1);
  return `Data may be stale — newest sample is ${hours} h old.`;
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
  const [chartReloadKey, setChartReloadKey] = useState(0);

  const [healthRepos, setHealthRepos] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState(null);
  const [healthReloadKey, setHealthReloadKey] = useState(0);

  const handleRepoChange = useCallback((r) => setRepo(r), []);
  const handleMetricChange = useCallback((m) => setMetricName(m), []);
  const handleTimeRangeChange = useCallback((t) => setTimeRange(t), []);
  const retryChart = useCallback(() => setChartReloadKey((k) => k + 1), []);
  const retryHealth = useCallback(() => setHealthReloadKey((k) => k + 1), []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    try {
      const user = getUser();
      if (!user) {
        navigate("/");
        return;
      }
      setUserName(user.sub);
      setAvatarUrl(user.avatar_url);
    } catch (error) {
      console.error("Error fetching user: ", error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // Latest filters used by the polling closure
  const latestFilters = useRef({ repo, metricName });
  useEffect(() => {
    latestFilters.current = { repo, metricName };
  }, [repo, metricName]);

  // Fetch metrics for the currently selected repo + metric
  useEffect(() => {
    if (!repo) return;

    const controller = new AbortController();
    let cancelled = false;

    async function fetchMetrics() {
      const token = getToken();
      if (!token) {
        navigate("/");
        return;
      }

      setChartLoading(true);

      try {
        const url = new URL(`${API_BASE}/metrics`);
        url.searchParams.set("repo", latestFilters.current.repo);
        url.searchParams.set("metric_name", latestFilters.current.metricName);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (cancelled) return;

        if (res.status === 401) {
          navigate("/");
          return;
        }

        if (res.status === 404) {
          setSeries([]);
          setChartError(null);
          return;
        }

        if (!res.ok) throw new Error(`metrics ${res.status}`);

        const raw = await res.json();
        const sorted = [...raw].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
        setSeries(sorted);
        setChartError(null);
      } catch (e) {
        if (e.name === "AbortError" || cancelled) return;
        setChartError(
          "Couldn't load metrics. We'll try again automatically in 60 seconds."
        );
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    }

    fetchMetrics();
    const intervalId = setInterval(fetchMetrics, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(intervalId);
    };
  }, [repo, metricName, navigate, chartReloadKey]);

  // Fetch repo health (independent of selected repo)
  useEffect(() => {
    if (loading) return;

    const controller = new AbortController();
    let cancelled = false;

    async function fetchHealth() {
      const token = getToken();
      if (!token) {
        navigate("/");
        return;
      }

      setHealthLoading(true);

      try {
        const res = await fetch(`${API_BASE}/repos/health`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (cancelled) return;

        if (res.status === 401) {
          navigate("/");
          return;
        }
        if (!res.ok) throw new Error(`repos/health ${res.status}`);

        const data = await res.json();
        setHealthRepos(Array.isArray(data.repos) ? data.repos : []);
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        setHealthError(null);
      } catch (e) {
        if (e.name === "AbortError" || cancelled) return;
        setHealthError(
          "Couldn't load repository health. Retrying in 60 seconds."
        );
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    }

    fetchHealth();
    const intervalId = setInterval(fetchHealth, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(intervalId);
    };
  }, [loading, navigate, healthReloadKey]);

  const visibleData = useMemo(
    () => applyTimeRange(series, timeRange),
    [series, timeRange]
  );

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === metricName)?.label;
  const latestTimestamp = series.length
    ? series[series.length - 1].timestamp
    : null;
  const staleWarning = describeStale(latestTimestamp);

  const handleAlertClick = useCallback((alert) => {
    setRepo(alert.repo);
    if (alert.metric_name) setMetricName(alert.metric_name);
  }, []);

  if (loading) {
    return (
      <div style={styles.fullPageLoading}>
        <Spinner label="Loading dashboard…" size={22} />
      </div>
    );
  }

  return (
    <>
      <Header username={username} avatarUrl={avatarUrl} />
      <div style={styles.page}>
        <h1 style={styles.welcome}>Welcome, {username}</h1>

        <RepoHealthTable
          repos={healthRepos}
          loading={healthLoading}
          error={healthError}
          onRetry={retryHealth}
          selectedRepo={repo}
          onSelectRepo={handleRepoChange}
        />

        <AlertPanel
          alerts={alerts}
          loading={healthLoading}
          error={healthError}
          onAlertClick={handleAlertClick}
        />

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
          staleWarning={staleWarning}
          onRetry={retryChart}
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
  fullPageLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#f5f5f5",
  },
};

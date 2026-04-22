import { HashRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

// HashRouter is used instead of BrowserRouter because GitHub Pages serves from
// a subpath (/pulseBoard/) and doesn't support SPA URL rewrites, so deep links
// like /dashboard would 404 on refresh. HashRouter side-steps that by keeping
// the route in the URL fragment (e.g. .../pulseBoard/#/dashboard).
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </HashRouter>
  );
}
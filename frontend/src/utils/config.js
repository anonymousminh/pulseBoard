// Single source of truth for the backend URL.
// Set via REACT_APP_BACKEND_URL at build time (Vercel env var or .env files).
// Falls back to localhost for local dev so `npm start` keeps working.
export const API_BASE =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

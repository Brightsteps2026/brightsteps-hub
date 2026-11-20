import "./lib/windowStorage";
// School fonts, served with the Hub itself (Google Fonts is blocked by the
// security headers, so the fonts never loaded before).
import "@fontsource/fraunces/latin-500.css";
import "@fontsource/fraunces/latin-600.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/fraunces/latin-500-italic.css";
import "@fontsource/work-sans/latin-400.css";
import "@fontsource/work-sans/latin-500.css";
import "@fontsource/work-sans/latin-600.css";
import "@fontsource/work-sans/latin-700.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import LoginGate from "./LoginGate.jsx";
import ApplyPage from "./ApplyPage.jsx";
import { registerServiceWorker } from "./lib/push";

registerServiceWorker();

// Public admissions page, no login needed (20 Nov 2026).
const isApply = window.location.pathname.replace(/\/+$/, "") === "/apply";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isApply ? <ApplyPage /> : (
      <LoginGate>
        <App />
      </LoginGate>
    )}
  </React.StrictMode>
);

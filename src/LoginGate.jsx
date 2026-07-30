import React, { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "./lib/supabaseClient";

const AuthContext = createContext(null);
export function useAuth() {
  return useContext(AuthContext);
}

const BRAND_BURGUNDY = "#801524";

export default function LoginGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setProfileError("");
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setProfileError(
            "Your account was created, but no profile has been set up for you yet. Please ask your BrightSteps administrator to add you in the profiles table."
          );
          setProfile(null);
        } else {
          setProfile(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (error) {
      setFormError(`${error.message} (code: ${error.status || "unknown"})`);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (session === undefined) {
    return (
      <div style={styles.centerScreen}>
        <p style={{ color: "#666" }}>Loading BrightSteps Hub...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.card}>
          <h1 style={styles.title}>BrightSteps Hub</h1>
          <p style={styles.subtitle}>Please sign in to continue</p>
          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoComplete="username"
            />
            <label style={styles.label}>Password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoComplete="current-password"
            />
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <span style={{ marginLeft: 6 }}>Show password</span>
            </label>
            {formError && <p style={styles.error}>{formError}</p>}
            <button type="submit" disabled={submitting} style={styles.button}>
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p style={styles.footnote}>
            Don't have an account? Ask your BrightSteps administrator to create one for you.
          </p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.card}>
          <h1 style={styles.title}>BrightSteps Hub</h1>
          <p style={{ color: "#801524", marginTop: 16 }}>{profileError}</p>
          <button onClick={handleSignOut} style={{ ...styles.button, marginTop: 20 }}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={styles.centerScreen}>
        <p style={{ color: "#666" }}>Loading your account...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, profile, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

const styles = {
  centerScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f7f3f2",
    padding: 20,
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "32px 28px",
    width: "100%",
    maxWidth: 360,
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    textAlign: "center",
  },
  title: { color: BRAND_BURGUNDY, margin: 0, fontSize: 24 },
  subtitle: { color: "#666", marginTop: 8, marginBottom: 20, fontSize: 14 },
  label: {
    display: "block",
    textAlign: "left",
    fontSize: 13,
    color: "#444",
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #ddd",
    fontSize: 15,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    marginTop: 20,
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: BRAND_BURGUNDY,
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "#c0392b", fontSize: 13, marginTop: 10 },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    marginTop: 8,
    fontSize: 13,
    color: "#555",
  },
  footnote: { fontSize: 12, color: "#999", marginTop: 20 },
};

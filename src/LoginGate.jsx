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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSetError, setPasswordSetError] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

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

  async function handleSetFirstPassword(e) {
    e.preventDefault();
    setPasswordSetError("");
    if (newPassword.length < 6) {
      setPasswordSetError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordSetError("Passwords don't match.");
      return;
    }
    setSettingPassword(true);
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    if (pwError) {
      setSettingPassword(false);
      setPasswordSetError(`Could not set password: ${pwError.message} (code: ${pwError.status || "unknown"})`);
      return;
    }
    // Changing the password can momentarily refresh the session token, so
    // make sure we have a current one before writing to the profiles table.
    await supabase.auth.refreshSession();
    let { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ password_changed: true })
      .eq("id", session.user.id);
    if (profileUpdateError) {
      // One retry in case the refreshed session hadn't propagated yet.
      await new Promise((r) => setTimeout(r, 800));
      ({ error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ password_changed: true })
        .eq("id", session.user.id));
    }
    setSettingPassword(false);
    if (profileUpdateError) {
      setPasswordSetError(`Password was set, but we couldn't finish setup: ${profileUpdateError.message}`);
      return;
    }
    setProfile((p) => (p ? { ...p, password_changed: true } : p));
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

  if (!profile.password_changed) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.card}>
          <h1 style={styles.title}>Welcome to BrightSteps Hub</h1>
          <p style={styles.subtitle}>
            For your security, please choose your own password before continuing.
          </p>
          <form onSubmit={handleSetFirstPassword}>
            <label style={styles.label}>New password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
            <label style={styles.label}>Confirm new password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              autoComplete="new-password"
            />
            {passwordSetError && <p style={styles.error}>{passwordSetError}</p>}
            <button type="submit" disabled={settingPassword} style={styles.button}>
              {settingPassword ? "Setting password..." : "Set password and continue"}
            </button>
          </form>
          <button
            onClick={handleSignOut}
            style={{ ...styles.button, marginTop: 12, background: "transparent", color: "#801524", border: "1px solid #801524" }}
          >
            Sign out
          </button>
        </div>
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

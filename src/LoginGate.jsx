import React, { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "./lib/supabaseClient";

const AuthContext = createContext(null);
export function useAuth() {
  return useContext(AuthContext);
}

const BRAND_BURGUNDY = "#801524";
// Students log in with just their ID, not a real email. Under the hood we turn
// that ID into a fake-but-valid email address, since Supabase accounts need one.
const STUDENT_LOGIN_DOMAIN = "students.brightstepshub.local";

// Kept simple and self-contained here, since the login screen renders before
// the rest of the app's translation system has anything to work with.
const LOGIN_TEXT = {
  en: {
    title: "BrightSteps Hub",
    subtitle: "Please sign in to continue",
    staffParent: "Staff & Parent",
    student: "Student",
    email: "Email",
    studentId: "Student ID",
    studentIdPlaceholder: "e.g. 2026001",
    password: "Password",
    showPassword: "Show password",
    signIn: "Sign in",
    signingIn: "Signing in...",
    noAccount: "Don't have an account? Ask your BrightSteps administrator to create one for you.",
  },
  fr: {
    title: "BrightSteps Hub",
    subtitle: "Veuillez vous connecter pour continuer",
    staffParent: "Personnel et parents",
    student: "Élève",
    email: "E-mail",
    studentId: "Identifiant élève",
    studentIdPlaceholder: "ex. 2026001",
    password: "Mot de passe",
    showPassword: "Afficher le mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion...",
    noAccount: "Vous n'avez pas de compte ? Demandez à votre administrateur BrightSteps d'en créer un pour vous.",
  }
};

export default function LoginGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [loginMode, setLoginMode] = useState("staff"); // "staff" or "student"
  const [loginLang, setLoginLang] = useState(() => {
    try { return localStorage.getItem("bsf-login-lang") || "en"; } catch { return "en"; }
  });
  const lt = LOGIN_TEXT[loginLang];
  const setLoginLangPersisted = (lang) => {
    setLoginLang(lang);
    try { localStorage.setItem("bsf-login-lang", lang); } catch {}
  };
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
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
    // The logo lives in its own small, separate row, safely readable before
    // signing in, without exposing anything else about the school's data.
    let cancelled = false;
    supabase
      .from("app_storage")
      .select("value")
      .eq("key", "brightsteps-hub-logo")
      .eq("shared", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data?.value) return;
        setLogoUrl(data.value);
      });
    return () => { cancelled = true; };
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

  // Signs someone out automatically after 10 minutes of no activity, a normal
  // safety practice for a system holding student and family information.
  useEffect(() => {
    if (!session) return;
    const IDLE_LIMIT_MS = 10 * 60 * 1000;
    let idleTimer;

    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        supabase.auth.signOut();
      }, IDLE_LIMIT_MS);
    };

    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [session]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const loginEmail = loginMode === "student"
      ? `${studentId.trim().toLowerCase()}@${STUDENT_LOGIN_DOMAIN}`
      : email.trim();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
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
        <BrandStyles />
        <p style={{ color: "#F0D9DD", fontFamily: "'Work Sans', sans-serif" }}>Loading BrightSteps Hub...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <div style={styles.card}>
          <div style={styles.langToggle}>
            <button
              type="button"
              onClick={() => setLoginLangPersisted("en")}
              style={{ ...styles.langButton, ...(loginLang === "en" ? styles.langButtonActive : {}) }}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLoginLangPersisted("fr")}
              style={{ ...styles.langButton, ...(loginLang === "fr" ? styles.langButtonActive : {}) }}
            >
              FR
            </button>
          </div>
          <Logo url={logoUrl} />
          <h1 style={styles.title}>{lt.title}</h1>
          <p style={styles.subtitle}>{lt.subtitle}</p>

          <div style={styles.modeToggle}>
            <button
              type="button"
              onClick={() => setLoginMode("staff")}
              style={{ ...styles.modeButton, ...(loginMode === "staff" ? styles.modeButtonActive : {}) }}
            >
              {lt.staffParent}
            </button>
            <button
              type="button"
              onClick={() => setLoginMode("student")}
              style={{ ...styles.modeButton, ...(loginMode === "student" ? styles.modeButtonActive : {}) }}
            >
              {lt.student}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {loginMode === "student" ? (
              <>
                <label style={styles.label}>{lt.studentId}</label>
                <input
                  type="text"
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  style={styles.input}
                  className="bsh-input"
                  autoComplete="username"
                  placeholder={lt.studentIdPlaceholder}
                />
              </>
            ) : (
              <>
                <label style={styles.label}>{lt.email}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                  className="bsh-input"
                  autoComplete="username"
                />
              </>
            )}
            <label style={styles.label}>{lt.password}</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              className="bsh-input"
              autoComplete="current-password"
            />
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <span style={{ marginLeft: 6 }}>{lt.showPassword}</span>
            </label>
            {formError && <p style={styles.error}>{formError}</p>}
            <button type="submit" disabled={submitting} style={styles.button} className="bsh-btn">
              {submitting ? lt.signingIn : lt.signIn}
            </button>
          </form>
          <p style={styles.footnote}>
            {lt.noAccount}
          </p>
        </div>
        <div style={styles.footerBar}>
          <p style={styles.footerBarText}>2026 BrightSteps International School. All rights reserved.</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <div style={styles.card}>
          <Logo url={logoUrl} />
          <h1 style={styles.title}>BrightSteps Hub</h1>
          <p style={{ color: "#801524", marginTop: 16, fontFamily: "'Work Sans', sans-serif", fontSize: 14 }}>{profileError}</p>
          <button onClick={handleSignOut} style={{ ...styles.button, marginTop: 20 }} className="bsh-btn">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <p style={{ color: "#F0D9DD", fontFamily: "'Work Sans', sans-serif" }}>Loading your account...</p>
      </div>
    );
  }

  if (!profile.password_changed) {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <div style={styles.card}>
          <Logo url={logoUrl} />
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
              className="bsh-input"
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
              className="bsh-input"
              autoComplete="new-password"
            />
            {passwordSetError && <p style={styles.error}>{passwordSetError}</p>}
            <button type="submit" disabled={settingPassword} style={styles.button} className="bsh-btn">
              {settingPassword ? "Setting password..." : "Set password and continue"}
            </button>
          </form>
          <button
            onClick={handleSignOut}
            style={{ ...styles.button, marginTop: 12, background: "transparent", color: "#801524", border: "1px solid #E2C6CB", boxShadow: "none" }}
            className="bsh-btn-ghost"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, profile, signOut: handleSignOut, updateProfileLocal: (patch) => setProfile((p) => (p ? { ...p, ...patch } : p)) }}>
      {children}
    </AuthContext.Provider>
  );
}

function BrandStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;0,700&family=Work+Sans:wght@400;500;600;700&display=swap');
      .bsh-input:focus {
        outline: none;
        border-color: #801524 !important;
        box-shadow: 0 0 0 3px rgba(128, 21, 36, 0.12);
      }
      .bsh-btn:hover { box-shadow: 0 6px 16px rgba(128, 21, 36, 0.38); transform: translateY(-1px); }
      .bsh-btn:active { transform: translateY(0); }
      .bsh-btn-ghost:hover { background: #FBF1F2 !important; }
    `}</style>
  );
}

function Logo({ url }) {
  if (url) {
    return (
      <img
        src={url}
        alt="School logo"
        style={{
          width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
          objectFit: "contain", display: "block",
          boxShadow: "0 6px 16px rgba(128, 21, 36, 0.2)"
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 52, height: 52, borderRadius: 14, margin: "0 auto 16px",
        background: "linear-gradient(135deg, #801524, #A02E3B)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, color: "#fff",
        boxShadow: "0 6px 16px rgba(128, 21, 36, 0.35)"
      }}
    >
      B
    </div>
  );
}

const styles = {
  centerScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(165deg, #801524 0%, #5C0F1A 55%, #2A0A10 100%)",
    padding: "20px 20px 56px",
    fontFamily: "'Work Sans', sans-serif",
    position: "relative",
  },
  footerBar: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(135deg, #5C0F1A 0%, #2A0A10 100%)",
    padding: "16px 20px",
    textAlign: "center",
    zIndex: 10,
  },
  footerBarText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "'Work Sans', sans-serif",
    margin: 0,
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "36px 30px",
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
    textAlign: "center",
  },
  title: { color: "#241012", margin: 0, fontSize: 25, fontFamily: "'Fraunces', serif", fontWeight: 600 },
  subtitle: { color: "#7A6A6C", marginTop: 8, marginBottom: 22, fontSize: 14, lineHeight: 1.4 },
  label: {
    display: "block",
    textAlign: "left",
    fontSize: 12.5,
    fontWeight: 600,
    color: "#3B2426",
    marginTop: 14,
    marginBottom: 5,
  },
  input: {
    width: "100%",
    padding: "11px 13px",
    borderRadius: 10,
    border: "1px solid #E5D9DA",
    fontSize: 15,
    fontFamily: "'Work Sans', sans-serif",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  button: {
    width: "100%",
    marginTop: 22,
    padding: "13px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #801524, #9c1c2c)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(128, 21, 36, 0.3)",
    transition: "box-shadow 0.15s ease, transform 0.15s ease",
  },
  error: { color: "#c0392b", fontSize: 13, marginTop: 10 },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    marginTop: 10,
    fontSize: 13,
    color: "#7A6A6C",
  },
  footnote: { fontSize: 12.5, color: "#A69698", marginTop: 22, lineHeight: 1.5 },
  modeToggle: {
    display: "flex",
    background: "#F5E4E6",
    borderRadius: 10,
    padding: 3,
    marginBottom: 6,
  },
  modeButton: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "#7A2A34",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Work Sans', sans-serif",
    cursor: "pointer",
  },
  modeButtonActive: {
    background: "#fff",
    color: "#801524",
    boxShadow: "0 1px 3px rgba(128, 21, 36, 0.18)",
  },
  langToggle: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 4,
    marginBottom: 10,
  },
  langButton: {
    padding: "4px 10px",
    borderRadius: 100,
    border: "1px solid #EFD9DB",
    background: "transparent",
    color: "#A67680",
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: "'Work Sans', sans-serif",
    cursor: "pointer",
    letterSpacing: "0.02em",
  },
  langButtonActive: {
    background: "#801524",
    borderColor: "#801524",
    color: "#fff",
  },
};

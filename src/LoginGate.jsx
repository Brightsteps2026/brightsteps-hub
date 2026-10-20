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
    signingIn: "Signing in…",
    noAccount: "Don't have an account? Ask your BrightSteps administrator to create one for you.",
    invalidLogin: "That email or password is not right. Please check and try again.",
    invalidStudentLogin: "That student ID or password is not right. Please check and try again.",
    loginFailed: "We could not sign you in. Please check your connection and try again.",
    loading: "Loading BrightSteps Hub…",
    loadingAccount: "Loading your account…",
    noProfile: "Your account was created, but no profile has been set up for you yet. Please ask your BrightSteps administrator to add you in the profiles table.",
    signOut: "Sign out",
    welcome: "Welcome to BrightSteps Hub",
    choosePassword: "For your security, please choose your own password before continuing.",
    newPassword: "New password",
    newPasswordPlaceholder: "At least 8 characters",
    confirmPassword: "Confirm new password",
    settingPassword: "Setting password…",
    setPassword: "Set password and continue",
    passwordTooShort: "Password must be at least 8 characters.",
    passwordMismatch: "Passwords don't match.",
    passwordSetFailed: "Your password could not be saved. Please try again.",
    passwordSetupIncomplete: "Your password was saved, but we could not finish setting up your account. Please try again.",
    mfaSetupTitle: "Set up two-step sign-in",
    mfaSetupIntro: "Your admin account can see all school data, so it needs a second step. Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or similar) and scan this code.",
    mfaSecretLabel: "Can't scan? Enter this key in the app instead. Keep a copy somewhere safe: it also lets you set up a new phone.",
    mfaSetupCode: "Then enter the 6-digit code the app shows",
    mfaVerifyTitle: "Two-step sign-in",
    mfaVerifyIntro: "Open your authenticator app and enter the 6-digit code for BrightSteps Hub.",
    mfaCode: "6-digit code",
    mfaConfirm: "Confirm",
    mfaChecking: "Checking…",
    mfaWrongCode: "That code is not right or has expired. Please try the new code in the app.",
    mfaFailed: "Two-step sign-in could not be loaded. Please check your connection and try again.",
    footer: "© BrightSteps International School",
  },
  fr: {
    title: "BrightSteps Hub",
    subtitle: "Veuillez vous connecter pour continuer",
    staffParent: "Personnel et parents",
    student: "Élève",
    email: "E-mail",
    studentId: "Identifiant élève",
    studentIdPlaceholder: "ex. : 2026001",
    password: "Mot de passe",
    showPassword: "Afficher le mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion…",
    noAccount: "Vous n'avez pas de compte ? Demandez à l'administration de BrightSteps de vous en créer un.",
    invalidLogin: "L'adresse e-mail ou le mot de passe est incorrect. Veuillez vérifier et réessayer.",
    invalidStudentLogin: "L'identifiant élève ou le mot de passe est incorrect. Veuillez vérifier et réessayer.",
    loginFailed: "Connexion impossible. Veuillez vérifier votre connexion internet et réessayer.",
    loading: "Chargement de BrightSteps Hub…",
    loadingAccount: "Chargement de votre compte…",
    noProfile: "Votre compte a bien été créé, mais votre profil n'est pas encore configuré. Veuillez demander à l'administration de BrightSteps de l'ajouter.",
    signOut: "Se déconnecter",
    welcome: "Bienvenue sur BrightSteps Hub",
    choosePassword: "Pour votre sécurité, veuillez choisir votre propre mot de passe avant de continuer.",
    newPassword: "Nouveau mot de passe",
    newPasswordPlaceholder: "Au moins 8 caractères",
    confirmPassword: "Confirmer le nouveau mot de passe",
    settingPassword: "Enregistrement du mot de passe…",
    setPassword: "Enregistrer et continuer",
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères.",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
    passwordSetFailed: "Votre mot de passe n'a pas pu être enregistré. Veuillez réessayer.",
    passwordSetupIncomplete: "Votre mot de passe a été enregistré, mais la configuration de votre compte n'a pas pu être finalisée. Veuillez réessayer.",
    mfaSetupTitle: "Activer la connexion en deux étapes",
    mfaSetupIntro: "Votre compte administrateur a accès à toutes les données de l'école ; il lui faut donc une deuxième étape. Ouvrez une application d'authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator ou similaire) et scannez ce code.",
    mfaSecretLabel: "Impossible de scanner ? Saisissez plutôt cette clé dans l'application. Gardez-en une copie en lieu sûr : elle permet aussi de configurer un nouveau téléphone.",
    mfaSetupCode: "Saisissez ensuite le code à 6 chiffres affiché par l'application",
    mfaVerifyTitle: "Connexion en deux étapes",
    mfaVerifyIntro: "Ouvrez votre application d'authentification et saisissez le code à 6 chiffres de BrightSteps Hub.",
    mfaCode: "Code à 6 chiffres",
    mfaConfirm: "Valider",
    mfaChecking: "Vérification…",
    mfaWrongCode: "Ce code est incorrect ou a expiré. Veuillez essayer le nouveau code affiché dans l'application.",
    mfaFailed: "La connexion en deux étapes n'a pas pu être chargée. Veuillez vérifier votre connexion et réessayer.",
    footer: "© BrightSteps International School",
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
  const lt = LOGIN_TEXT[loginLang] || LOGIN_TEXT.en;
  // "bsf-login-lang-chosen" tells the app (lib/i18n.jsx) that this choice was
  // made just now, so it carries over to the parent's screens after sign-in.
  const setLoginLangPersisted = (lang) => {
    setLoginLang(lang);
    try {
      localStorage.setItem("bsf-login-lang", lang);
      localStorage.setItem("bsf-login-lang-chosen", "1");
    } catch {}
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
  // Two-step sign-in (admin accounts only).
  // mfaStep: "checking" | "enroll" | "verify" | "done" | "error"
  const [mfaStep, setMfaStep] = useState("checking");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaQr, setMfaQr] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [mfaRetry, setMfaRetry] = useState(0);

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
          setProfileError("noProfile");
          setProfile(null);
        } else {
          setProfile(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Two-step sign-in: admin accounts must confirm a code from an authenticator
  // app before the Hub opens. Everyone else goes straight in. The database also
  // refuses admin rights until this step is done, so this is not just a screen.
  const userId = session?.user?.id;
  const profileRole = profile?.role;
  const passwordReady = !!profile?.password_changed;
  useEffect(() => {
    if (!userId) {
      setMfaStep("checking");
      setMfaCode("");
      setMfaError("");
      return;
    }
    if (!profileRole || !passwordReady) return;
    if (profileRole !== "admin") {
      setMfaStep("done");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalError) throw aalError;
        if (cancelled) return;
        if (aal.currentLevel === "aal2") {
          setMfaStep("done");
          return;
        }
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
        if (listError) throw listError;
        if (cancelled) return;
        const verified = (factors.totp || []).filter((f) => f.status === "verified");
        if (verified.length > 0) {
          setMfaFactorId(verified[0].id);
          setMfaStep("verify");
          return;
        }
        // No phone set up yet. Clear any half-finished setup, then start a fresh one.
        for (const f of factors.all || []) {
          if (f.factor_type === "totp" && f.status !== "verified") {
            await supabase.auth.mfa.unenroll({ factorId: f.id });
          }
        }
        const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `BrightSteps Hub ${new Date().toISOString().slice(0, 10)}`,
          issuer: "BrightSteps Hub",
        });
        if (enrollError) throw enrollError;
        if (cancelled) return;
        setMfaFactorId(enrolled.id);
        setMfaQr(enrolled.totp.qr_code);
        setMfaSecret(enrolled.totp.secret);
        setMfaStep("enroll");
      } catch (err) {
        console.error("Two-step sign-in could not load", err);
        if (!cancelled) setMfaStep("error");
      }
    })();
    return () => { cancelled = true; };
  }, [userId, profileRole, passwordReady, mfaRetry]);

  async function handleMfaSubmit(e) {
    e.preventDefault();
    setMfaError("");
    const code = mfaCode.replace(/\D/g, "");
    if (code.length !== 6) {
      setMfaError("mfaWrongCode");
      return;
    }
    setMfaSubmitting(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code });
    setMfaSubmitting(false);
    if (error) {
      console.error("Two-step code rejected", error);
      setMfaError("mfaWrongCode");
      setMfaCode("");
      return;
    }
    setMfaCode("");
    setMfaQr("");
    setMfaSecret("");
    setMfaStep("done");
  }

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
      // Show a friendly message, never the raw Supabase error or code.
      console.error("Sign-in failed", error);
      const badCredentials = error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message || "");
      setFormError(badCredentials ? (loginMode === "student" ? "invalidStudentLogin" : "invalidLogin") : "loginFailed");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleSetFirstPassword(e) {
    e.preventDefault();
    setPasswordSetError("");
    if (newPassword.length < 8) {
      setPasswordSetError("passwordTooShort");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordSetError("passwordMismatch");
      return;
    }
    setSettingPassword(true);
    const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
    if (pwError) {
      setSettingPassword(false);
      console.error("Could not set password", pwError);
      setPasswordSetError("passwordSetFailed");
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
      console.error("Could not finish account setup", profileUpdateError);
      setPasswordSetError("passwordSetupIncomplete");
      return;
    }
    setProfile((p) => (p ? { ...p, password_changed: true } : p));
  }

  if (session === undefined) {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <p style={{ color: "#F0D9DD", fontFamily: "'Work Sans', sans-serif" }}>{lt.loading}</p>
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
            {formError && <p style={styles.error}>{lt[formError] || formError}</p>}
            <button type="submit" disabled={submitting} style={styles.button} className="bsh-btn">
              {submitting ? lt.signingIn : lt.signIn}
            </button>
          </form>
          <p style={styles.footnote}>
            {lt.noAccount}
          </p>
        </div>
        <div style={styles.footerBar}>
          <p style={styles.footerBarText}>{lt.footer}</p>
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
          <p style={{ color: "#801524", marginTop: 16, fontFamily: "'Work Sans', sans-serif", fontSize: 14 }}>{lt[profileError] || profileError}</p>
          <button onClick={handleSignOut} style={{ ...styles.button, marginTop: 20 }} className="bsh-btn">
            {lt.signOut}
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <p style={{ color: "#F0D9DD", fontFamily: "'Work Sans', sans-serif" }}>{lt.loadingAccount}</p>
      </div>
    );
  }

  if (!profile.password_changed) {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <div style={styles.card}>
          <Logo url={logoUrl} />
          <h1 style={styles.title}>{lt.welcome}</h1>
          <p style={styles.subtitle}>
            {lt.choosePassword}
          </p>
          <form onSubmit={handleSetFirstPassword}>
            <label style={styles.label}>{lt.newPassword}</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              className="bsh-input"
              autoComplete="new-password"
              placeholder={lt.newPasswordPlaceholder}
            />
            <label style={styles.label}>{lt.confirmPassword}</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              className="bsh-input"
              autoComplete="new-password"
            />
            {passwordSetError && <p style={styles.error}>{lt[passwordSetError] || passwordSetError}</p>}
            <button type="submit" disabled={settingPassword} style={styles.button} className="bsh-btn">
              {settingPassword ? lt.settingPassword : lt.setPassword}
            </button>
          </form>
          <button
            onClick={handleSignOut}
            style={{ ...styles.button, marginTop: 12, background: "transparent", color: "#801524", border: "1px solid #E2C6CB", boxShadow: "none" }}
            className="bsh-btn-ghost"
          >
            {lt.signOut}
          </button>
        </div>
      </div>
    );
  }

  if (mfaStep === "checking") {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <p style={{ color: "#F0D9DD", fontFamily: "'Work Sans', sans-serif" }}>{lt.loadingAccount}</p>
      </div>
    );
  }

  if (mfaStep === "error") {
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <div style={styles.card}>
          <Logo url={logoUrl} />
          <h1 style={styles.title}>{lt.mfaVerifyTitle}</h1>
          <p style={{ ...styles.error, marginTop: 16 }}>{lt.mfaFailed}</p>
          <button onClick={() => { setMfaStep("checking"); setMfaRetry((n) => n + 1); }} style={styles.button} className="bsh-btn">
            {lt.mfaConfirm}
          </button>
          <button
            onClick={handleSignOut}
            style={{ ...styles.button, marginTop: 12, background: "transparent", color: "#801524", border: "1px solid #E2C6CB", boxShadow: "none" }}
            className="bsh-btn-ghost"
          >
            {lt.signOut}
          </button>
        </div>
      </div>
    );
  }

  if (mfaStep === "enroll" || mfaStep === "verify") {
    const enrolling = mfaStep === "enroll";
    return (
      <div style={styles.centerScreen}>
        <BrandStyles />
        <div style={styles.card}>
          <Logo url={logoUrl} />
          <h1 style={styles.title}>{enrolling ? lt.mfaSetupTitle : lt.mfaVerifyTitle}</h1>
          <p style={styles.subtitle}>{enrolling ? lt.mfaSetupIntro : lt.mfaVerifyIntro}</p>
          {enrolling && (
            <>
              {mfaQr && (
                <img
                  src={mfaQr}
                  alt="QR code"
                  style={{ width: 180, height: 180, display: "block", margin: "0 auto", background: "#fff", borderRadius: 12, border: "1px solid #EFD9DB", padding: 8 }}
                />
              )}
              <p style={{ ...styles.footnote, marginTop: 14, color: "#7A6A6C" }}>{lt.mfaSecretLabel}</p>
              <code style={styles.secret}>{mfaSecret}</code>
            </>
          )}
          <form onSubmit={handleMfaSubmit}>
            <label style={styles.label}>{enrolling ? lt.mfaSetupCode : lt.mfaCode}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9 ]*"
              maxLength={7}
              required
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              style={{ ...styles.input, textAlign: "center", fontSize: 22, letterSpacing: "0.3em" }}
              className="bsh-input"
              autoComplete="one-time-code"
              placeholder="000000"
            />
            {mfaError && <p style={styles.error}>{lt[mfaError] || mfaError}</p>}
            <button type="submit" disabled={mfaSubmitting} style={styles.button} className="bsh-btn">
              {mfaSubmitting ? lt.mfaChecking : lt.mfaConfirm}
            </button>
          </form>
          <button
            onClick={handleSignOut}
            style={{ ...styles.button, marginTop: 12, background: "transparent", color: "#801524", border: "1px solid #E2C6CB", boxShadow: "none" }}
            className="bsh-btn-ghost"
          >
            {lt.signOut}
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
  secret: {
    display: "block",
    marginTop: 8,
    padding: "8px 10px",
    borderRadius: 8,
    background: "#FBF1F2",
    color: "#3B2426",
    fontSize: 13,
    wordBreak: "break-all",
    userSelect: "all",
  },
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

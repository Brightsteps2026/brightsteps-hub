import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { X, Send, Bell } from "lucide-react";
import { useAuth } from "../LoginGate";
import { useLanguage } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import { pushStatus, turnOnPush, turnOffPush } from "../lib/push";
import { GRADES } from "../data/constants";

// Two private threads per student, kept in the hub_messages table
// (see supabase/stage1-messages.sql):
//   "family":  parents and teachers. Students never see it.
//   "student": a Grade 3+ student and teachers. Parents never see it.
// Staff switch between the two for Grade 3+ students. The database decides who
// may read and write each thread, and stamps who sent each message.

const MESSAGE_ROLE_LABELS = {
  en: { parent: "parent", student: "student", teacher: "teacher", admin: "school", learning_assistant: "assistant" },
  fr: { parent: "parent", student: "élève", teacher: "enseignant(e)", admin: "école", learning_assistant: "assistant(e)" }
};

const POLL_MS = 30 * 1000;

const localDay = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toMessage = (r) => ({
  id: r.id,
  author: r.author_name,
  authorId: r.author_id,
  role: r.author_role,
  text: r.body,
  date: localDay(r.created_at),
  createdAt: r.created_at
});

// Tells the bell and unread counts to refresh.
const messagesChanged = () => window.dispatchEvent(new Event("bs-messages-changed"));

// Unread messages for the signed-in person: { "<studentId>:<thread>": count }.
function useUnreadMessages(profile) {
  const [map, setMap] = useState({});
  useEffect(() => {
    if (!profile?.id || !["admin", "teacher", "parent", "student"].includes(profile.role)) { setMap({}); return; }
    let cancelled = false;
    const load = async () => {
      const { data: rows, error } = await supabase.rpc("my_unread_messages");
      if (cancelled || error) return;
      const m = {};
      (rows || []).forEach((r) => { m[`${r.student_id}:${r.thread}`] = r.unread; });
      setMap(m);
    };
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    window.addEventListener("bs-messages-changed", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("bs-messages-changed", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [profile?.id, profile?.role]);
  return map;
}

// Unread threads for the bell, one entry per student: [{ id, name, count }].
// Teachers only count the students of their own grades (as before).
function useUnreadThreads(profile, data) {
  const map = useUnreadMessages(profile);
  return useMemo(() => {
    const teacherGrades = profile?.role === "teacher" ? (profile.grades_assigned || []) : null;
    const byStudent = {};
    Object.entries(map).forEach(([key, n]) => {
      const sid = key.slice(0, key.lastIndexOf(":"));
      byStudent[sid] = (byStudent[sid] || 0) + n;
    });
    return Object.entries(byStudent)
      .map(([sid, count]) => {
        const s = (data?.students || []).find((x) => x.id === sid);
        return s ? { id: sid, name: s.name, grade: s.grade, count } : null;
      })
      .filter((t) => t && t.count > 0 && (!teacherGrades || teacherGrades.includes(t.grade)))
      .map(({ grade, ...t }) => t)
      .sort((a, b) => b.count - a.count || (a.name || "").localeCompare(b.name || ""));
  }, [map, data?.students, profile?.role, profile?.grades_assigned]);
}

// The messages of one thread, kept current while it is open.
function useThreadMessages(studentId, thread) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!studentId) return;
    const { data: rows, error: e } = await supabase
      .from("hub_messages")
      .select("id, author_id, author_name, author_role, body, created_at")
      .eq("student_id", studentId).eq("thread", thread)
      .order("created_at", { ascending: true });
    if (e) setError(e.message); else { setError(""); setMessages((rows || []).map(toMessage)); }
    setLoading(false);
  }, [studentId, thread]);
  useEffect(() => {
    setLoading(true); setMessages([]);
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    window.addEventListener("bs-messages-changed", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("bs-messages-changed", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);
  return { messages, setMessages, loading, error, reload: load };
}

function StudentMessages({ student }) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const fr = language === "fr";
  const role = profile?.role;
  const isStudentUser = role === "student";
  const isParentUser = role === "parent";
  const isStaffUser = !isStudentUser && !isParentUser;
  const isAssistantUser = role === "learning_assistant";
  // Learning assistants can read the parents' thread but never write in it,
  // and never see a Grade 3+ student's private thread.
  const hasStudentThread = !isAssistantUser && GRADES.indexOf(student.grade) >= GRADES.indexOf("Grade 3");
  const unread = useUnreadMessages(profile);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [staffThread, setStaffThread] = useState("family");
  const [pickedThread, setPickedThread] = useState(false);
  const thread = isStudentUser ? "student" : isParentUser ? "family" : (hasStudentThread ? staffThread : "family");
  const canPost = role !== "viewer" && role !== "learning_assistant" && role !== "accountant";
  const { messages, setMessages, loading, error } = useThreadMessages(student.id, thread);
  const unreadOf = (k) => unread[`${student.id}:${k}`] || 0;

  // Staff: open the student's thread first when only that one has something new.
  useEffect(() => {
    if (pickedThread || !isStaffUser || !hasStudentThread) return;
    if (unreadOf("student") > 0 && unreadOf("family") === 0) setStaffThread("student");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread, student.id]);
  useEffect(() => { setPickedThread(false); setStaffThread("family"); setSendError(""); }, [student.id]);

  // Mark the thread as read when it is opened and whenever new messages arrive.
  useEffect(() => {
    if (!profile?.id || !student?.id || loading) return;
    if (role === "viewer" || role === "learning_assistant" || role === "accountant") return;
    if (unreadOf(thread) === 0) return;
    supabase.rpc("mark_hub_thread_read", { p_student: student.id, p_thread: thread })
      .then(({ error: e }) => { if (!e) messagesChanged(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, thread, messages.length, loading, unread]);

  const addMessage = async () => {
    const text = messageText.trim();
    if (!text || sending) return;
    setSending(true); setSendError("");
    const { data: row, error: e } = await supabase.rpc("send_hub_message", { p_student: student.id, p_thread: thread, p_body: text });
    setSending(false);
    if (e || !row) {
      // Keep the text in the box so nothing is lost.
      setSendError(fr ? "Le message n'a pas été envoyé. Vérifiez la connexion et réessayez." : "The message wasn't sent. Check the connection and try again.");
      return;
    }
    setMessageText("");
    setMessages((list) => (list.some((m) => m.id === row.id) ? list : [...list, toMessage(row)]));
    messagesChanged();
    // Email only for the parents' thread.
    if (thread === "family") {
      supabase.functions
        .invoke("notify-message", { body: { studentId: student.id, senderRole: role || "", senderName: (profile && profile.full_name) || "Someone", messageId: row.id } })
        .catch((err) => console.error("notify-message failed", err));
    }
  };

  const removeMessage = async (msgId) => {
    if (!window.confirm(fr ? "Supprimer ce message ?" : "Remove this message?")) return;
    const { error: e } = await supabase.rpc("remove_hub_message", { p_id: msgId });
    if (e) { setSendError(fr ? "Impossible de supprimer ce message." : "This message couldn't be removed."); return; }
    setMessages((list) => list.filter((m) => m.id !== msgId));
    messagesChanged();
  };

  const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const dateLabel = (d) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d;
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(fr ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "long" });
  };
  const roleLabel = (r) => (MESSAGE_ROLE_LABELS[fr ? "fr" : "en"][r] || r);

  let lastDate = null;

  const intro = isStudentUser
    ? "A private thread between you and your teachers."
    : isParentUser
      ? (fr ? `Échanges privés entre les parents et les enseignants au sujet de ${student.name}.` : `A private thread between parents and teachers about ${student.name}.`)
      : isAssistantUser
        ? `The parents' thread about ${student.name}. You can read it; only teachers reply.`
      : thread === "student"
        ? `A private thread between ${student.name} and teachers. Parents don't see it.`
        : `A private thread between parents and teachers about ${student.name}. ${student.name} doesn't see it.`;

  return (
    <>
      <div className="bsf-msg-header">
        <div>
          <h3 className="bsf-subheading" style={{ margin: 0 }}>Messages</h3>
          <p className="bsf-muted">{intro}</p>
        </div>
      </div>
      {isStaffUser && hasStudentThread && (
        <div className="bsf-chiprow" style={{ marginBottom: 10 }}>
          {["family", "student"].map((k) => {
            const n = unreadOf(k);
            return (
              <button key={k} className={`bsf-chip ${thread === k ? "active" : ""}`} onClick={() => { setPickedThread(true); setStaffThread(k); }}>
                {k === "family" ? "Parents" : "Student"}{n > 0 ? ` (${n})` : ""}
              </button>
            );
          })}
        </div>
      )}
      <div className="bsf-chatthread">
        {loading && <p className="bsf-empty">{fr ? "Chargement…" : "Loading…"}</p>}
        {!loading && error && <p className="bsf-empty">{fr ? "Impossible de charger les messages." : "Messages couldn't be loaded."}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="bsf-empty">
            {isStudentUser ? "No messages yet. Say hello to your teacher below." : fr && isParentUser ? "Aucun message pour l'instant. Écrivez ci-dessous." : "No messages yet. Say hello below."}
          </p>
        )}
        {messages.map((m) => {
          const isMine = profile && (m.authorId ? m.authorId === profile.id : (m.author === profile.full_name && m.role === role));
          const showDateDivider = m.date !== lastDate;
          lastDate = m.date;
          return (
            <Fragment key={m.id}>
              {showDateDivider && <div className="bsf-chatdate">{dateLabel(m.date)}</div>}
              <div className={`bsf-chatrow ${isMine ? "mine" : ""}`}>
                {!isMine && <div className="bsf-chatavatar">{initials(m.author)}</div>}
                <div className="bsf-chatbubble">
                  {!isMine && <div className="bsf-chatauthor">{m.author}{m.role ? ` · ${roleLabel(m.role)}` : ""}</div>}
                  <p>{fr && m.textFr ? m.textFr : m.text}</p>
                  {(role === "admin" || (isMine && (isStaffUser || m.authorId === profile?.id))) && (
                    <button className="bsf-chatremove" onClick={() => removeMessage(m.id)} aria-label={fr ? "Supprimer le message" : "Remove message"}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      {sendError && <p className="bsf-muted" style={{ color: "#B23A3A", margin: "6px 0" }}>{sendError}</p>}
      {canPost && (
        <div className="bsf-chatinputbar">
          <textarea
            rows={1}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={fr && isParentUser ? "Écrire un message…" : "Write a message…"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addMessage(); }
            }}
          />
          <button className="bsf-chatsendbtn" onClick={addMessage} aria-label={fr ? "Envoyer" : "Send message"} disabled={!messageText.trim() || sending}>
            <Send size={18} />
          </button>
        </div>
      )}
    </>
  );
}

// Absence notices: created each school morning by the notify-absences function.
// The bell adds these to its count; the "My child" screen shows them at the top.
function useUnreadNoticeCount(profile) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!profile?.id) { setCount(0); return; }
    let cancelled = false;
    const load = async () => {
      const { count: n, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .is("read_at", null);
      if (!cancelled && !error) setCount(n || 0);
    };
    load();
    // Keep the badge current: every minute while the Hub is open, and when it comes back to the front.
    const id = setInterval(() => { if (!document.hidden) load(); }, 60 * 1000);
    const onVisible = () => { if (!document.hidden) load(); };
    window.addEventListener("bs-notices-changed", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("bs-notices-changed", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [profile?.id, profile?.role]);
  return count;
}

// Only notices about this child (absence alerts and reports). School-wide
// notices such as the lunch menu stay in the bell.
function AbsenceNotices({ profile, studentId }) {
  const { language } = useLanguage();
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    if (!profile?.id) return;
    const load = () => {
      let q = supabase
        .from("notifications")
        .select("id, title, title_fr, body, body_fr, created_at")
        .eq("user_id", profile.id)
        .is("read_at", null)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
      q = studentId
        ? q.or(`student_id.eq.${studentId},and(student_id.is.null,kind.ilike.*absence*)`)
        : q.ilike("kind", "*absence*");
      return q.order("created_at", { ascending: false })
        .then(({ data: rows, error }) => { if (!error) setNotices(rows || []); });
    };
    load();
    window.addEventListener("bs-notices-changed", load);
    return () => window.removeEventListener("bs-notices-changed", load);
  }, [profile?.id, studentId]);

  const markRead = async (id) => {
    setNotices((list) => list.filter((n) => n.id !== id));
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) console.error("Could not mark notice as read", error);
    window.dispatchEvent(new Event("bs-notices-changed"));
  };

  if (notices.length === 0) return null;
  const fr = language === "fr";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
      {notices.map((n) => (
        <div key={n.id} style={{ background: "#FBF3E4", border: "1px solid #E8D2A6", borderRadius: 12, padding: "12px 14px" }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#6B4A12" }}>{fr && n.title_fr ? n.title_fr : n.title}</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5, color: "#6B4A12" }}>{fr && n.body_fr ? n.body_fr : n.body}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button className="bsf-btn-ghost" onClick={() => markRead(n.id)}>{fr ? "Marquer comme lu" : "Mark as read"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// The bell in the top bar: opens a small panel with unread notices and a link to unread messages.
// "Notifications on this phone": turns phone notifications (push) on or off.
function PhoneNotifications({ fr }) {
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { pushStatus().then(setStatus).catch(() => setStatus("unsupported")); }, []);
  if (status === "loading" || status === "unsupported") return null;

  const toggle = async () => {
    setBusy(true); setError("");
    try {
      setStatus(status === "on" ? await turnOffPush() : await turnOnPush());
    } catch (e) {
      setError(fr ? "Impossible d'activer les notifications. Réessayez." : "Notifications couldn't be turned on. Please try again.");
    }
    setBusy(false);
  };

  const box = { background: "#FCFAF4", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: 13, lineHeight: 1.5, color: "var(--ink)" };
  if (status === "ios-home-screen") {
    return (
      <div style={box}>
        {fr
          ? "Pour recevoir les notifications sur iPhone : dans Safari, touchez Partager puis « Sur l'écran d'accueil », puis ouvrez le Hub depuis cette icône."
          : "To get notifications on iPhone: in Safari, tap Share, then \u201cAdd to Home Screen\u201d, then open the Hub from that icon."}
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div style={box}>
        {fr
          ? "Les notifications sont bloquées pour le Hub sur cet appareil. Autorisez-les dans les réglages du navigateur."
          : "Notifications are blocked for the Hub on this device. Allow them in the browser's settings."}
      </div>
    );
  }
  return (
    <div style={{ ...box, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1 }}>
        {status === "on"
          ? (fr ? "Notifications activées sur cet appareil." : "Notifications are on for this device.")
          : (fr ? "Recevez une notification pour chaque nouveau message ou avis." : "Get a notification for each new message or notice.")}
        {error && <span style={{ display: "block", color: "#B23A3A" }}>{error}</span>}
      </span>
      <button onClick={toggle} disabled={busy}
        style={{ fontSize: 13, padding: "6px 12px", borderRadius: 8, border: status === "on" ? "1px solid var(--line)" : "none", background: status === "on" ? "#fff" : "#801524", color: status === "on" ? "var(--ink)" : "#fff", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        {busy ? "…" : status === "on" ? (fr ? "Désactiver" : "Turn off") : (fr ? "Activer" : "Turn on")}
      </button>
    </div>
  );
}

function NotificationBell({ profile, unreadThreads, unreadNoticeCount, onOpenThread, onOpenNotice }) {
  const unreadMessageCount = (unreadThreads || []).reduce((n, t) => n + t.count, 0);
  const { language } = useLanguage();
  const fr = language === "fr";
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const total = unreadMessageCount + unreadNoticeCount;

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("notifications")
      .select("id, title, title_fr, body, body_fr, created_at")
      .eq("user_id", profile.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error) setNotices(rows || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    load();
    const onChange = () => load();
    window.addEventListener("bs-notices-changed", onChange);
    return () => window.removeEventListener("bs-notices-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile?.id]);

  const markRead = async (ids) => {
    if (ids.length === 0) return;
    setNotices((list) => list.filter((n) => !ids.includes(n.id)));
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (error) console.error("Could not mark notices as read", error);
    window.dispatchEvent(new Event("bs-notices-changed"));
  };

  const when = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(fr ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
  };

  const smallBtn = { fontSize: 12, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontFamily: "inherit", color: "var(--ink)" };

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        className="bsf-iconbtn bsf-settingsbtn"
        onClick={() => setOpen((o) => !o)}
        aria-label={fr ? "Notifications" : "Notifications"}
        aria-expanded={open}
        title="Notifications"
        style={{ position: "relative" }}
      >
        <Bell size={18} />
        {total > 0 && (
          <span
            style={{
              position: "absolute", top: -2, right: -2, background: "#801524", color: "#fff",
              borderRadius: "50%", fontSize: 10, lineHeight: "16px", minWidth: 16, height: 16,
              textAlign: "center", padding: "0 3px", fontWeight: 600
            }}
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
          <div
            role="dialog"
            aria-label="Notifications"
            style={{
              // Fixed to the screen edge so it never opens off-screen on phones
              // (the bell isn't the right-most button in the top bar).
              position: "fixed", top: 62, right: 12, zIndex: 91,
              width: "min(360px, calc(100vw - 24px))", maxHeight: "70vh", overflowY: "auto",
              background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
              boxShadow: "0 8px 24px rgba(36,16,18,0.14)", padding: "12px 14px", textAlign: "left"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 15, color: "var(--ink)" }}>Notifications</strong>
              {notices.length > 0 && (
                <button onClick={() => markRead(notices.map((n) => n.id))} style={{ background: "none", border: "none", color: "#801524", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  {fr ? "Tout marquer comme lu" : "Mark all as read"}
                </button>
              )}
            </div>

            <PhoneNotifications fr={fr} />

            {onOpenThread && (unreadThreads || []).map((t) => (
              <button
                key={t.id}
                onClick={() => { setOpen(false); onOpenThread(t.id); }}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, border: "none", background: "#F5E4E6", color: "#801524", cursor: "pointer", fontFamily: "inherit", fontSize: 14, marginBottom: 6, textAlign: "left" }}
              >
                <Send size={16} />
                <span style={{ flex: 1 }}>
                  <strong>{t.name}</strong>
                  {" · "}
                  {fr
                    ? `${t.count} message${t.count > 1 ? "s" : ""} non lu${t.count > 1 ? "s" : ""}`
                    : `${t.count} unread message${t.count > 1 ? "s" : ""}`}
                </span>
                <span style={{ fontSize: 13 }}>{fr ? "Ouvrir" : "Open"} →</span>
              </button>
            ))}

            {loading && notices.length === 0 && <p className="bsf-muted" style={{ margin: "8px 0" }}>{fr ? "Chargement…" : "Loading…"}</p>}

            {!loading && notices.length === 0 && !(onOpenThread && unreadMessageCount > 0) && (
              <p className="bsf-muted" style={{ margin: "8px 0" }}>{fr ? "Rien de nouveau." : "You're all caught up."}</p>
            )}

            {notices.map((n) => (
              <div key={n.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 14, color: "var(--ink)" }}>{fr && n.title_fr ? n.title_fr : n.title}</strong>
                  <span className="bsf-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{when(n.created_at)}</span>
                </div>
                <p style={{ margin: "3px 0 8px", fontSize: 13, lineHeight: 1.5, color: "var(--ink)" }}>{fr && n.body_fr ? n.body_fr : n.body}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={smallBtn} onClick={() => markRead([n.id])}>{fr ? "Marquer comme lu" : "Mark as read"}</button>
                  {onOpenNotice && (
                    <button style={smallBtn} onClick={() => { setOpen(false); onOpenNotice(); }}>{onOpenNotice.label}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

export { StudentMessages, useUnreadNoticeCount, useUnreadThreads, AbsenceNotices, NotificationBell };

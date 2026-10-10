import { useState, useEffect, Fragment } from "react";
import { X, Send, Bell } from "lucide-react";
import { useAuth } from "../LoginGate";
import { useLanguage } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import { GRADES } from "../data/constants";
import { uid, todayStr } from "../lib/format";

// Two private threads per student:
//   "family"  (messages / lastRead): parents and teachers. Students never see it.
//   "student" (studentMessages / studentLastRead): a Grade 3+ student and teachers.
//             Parents never see it.
// Staff switch between the two for Grade 3+ students. The database stamps who
// sent each family or student message, and they can only add to their thread.
const THREAD_FIELDS = {
  family: { msgs: "messages", read: "lastRead" },
  student: { msgs: "studentMessages", read: "studentLastRead" }
};

const MESSAGE_ROLE_LABELS = {
  en: { parent: "parent", student: "student", teacher: "teacher", admin: "school", learning_assistant: "assistant" },
  fr: { parent: "parent", student: "élève", teacher: "enseignant(e)", admin: "école", learning_assistant: "assistant(e)" }
};

const unreadIn = (student, thread, userId, fromFamily) => {
  const f = THREAD_FIELDS[thread];
  const seen = ((student[f.read] || {})[userId]) || "";
  return (student[f.msgs] || []).filter((m) => {
    const isFamily = m.role === "parent" || m.role === "student";
    return (fromFamily ? isFamily : !isFamily) && (m.createdAt || m.date || "") > seen;
  }).length;
};

function StudentMessages({ student, data, persist }) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const fr = language === "fr";
  const role = profile?.role;
  const isStudentUser = role === "student";
  const isParentUser = role === "parent";
  const isStaffUser = !isStudentUser && !isParentUser;
  const hasStudentThread = GRADES.indexOf(student.grade) >= GRADES.indexOf("Grade 3");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [staffThread, setStaffThread] = useState(() =>
    isStaffUser && hasStudentThread && profile?.id &&
    unreadIn(student, "student", profile.id, true) > 0 && unreadIn(student, "family", profile.id, true) === 0
      ? "student" : "family"
  );
  const thread = isStudentUser ? "student" : isParentUser ? "family" : (hasStudentThread ? staffThread : "family");
  const F = THREAD_FIELDS[thread];
  const canPost = role !== "viewer" && role !== "learning_assistant" && role !== "accountant";

  useEffect(() => {
    if (!profile?.id || !student?.id) return;
    if (role === "viewer") return;
    // Only save "last read" when there is actually something new to mark as read.
    const seen = (student[F.read] || {})[profile.id] || "";
    const hasNew = (student[F.msgs] || []).some((m) => (m.createdAt || m.date || "") > seen);
    if (!hasNew) return;
    persist({
      ...data,
      students: data.students.map((s) =>
        s.id === student.id ? { ...s, [F.read]: { ...(s[F.read] || {}), [profile.id]: new Date().toISOString() } } : s
      )
    });
    // Only re-run when switching student or thread, not on every persist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, profile?.id, thread]);

  const addMessage = async () => {
    if (!messageText.trim() || sending) return;
    const message = {
      id: uid(),
      author: (profile && profile.full_name) || "Someone",
      authorId: profile?.id,
      role: role || "",
      text: messageText.trim(),
      date: todayStr(),
      createdAt: new Date().toISOString()
    };
    setSending(true);
    const ok = await persist({
      ...data,
      students: data.students.map((s) =>
        s.id === student.id
          ? { ...s, [F.msgs]: [...(s[F.msgs] || []), message], [F.read]: { ...(s[F.read] || {}), [profile.id]: message.createdAt } }
          : s
      )
    });
    setSending(false);
    if (!ok) return; // keep the text in the box; the top bar says "Not saved"
    setMessageText("");
    // Only email once the message is really saved (family thread only: emails go to parents).
    if (thread === "family") {
      supabase.functions
        .invoke("notify-message", { body: { studentId: student.id, senderRole: role || "", senderName: (profile && profile.full_name) || "Someone" } })
        .catch((e) => console.error("notify-message failed", e));
    }
  };

  const removeMessage = (msgId) => {
    if (!window.confirm(fr ? "Supprimer ce message ?" : "Remove this message?")) return;
    persist({
      ...data,
      students: data.students.map((s) => (s.id === student.id ? { ...s, [F.msgs]: (s[F.msgs] || []).filter((m) => m.id !== msgId) } : s))
    });
  };

  const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const dateLabel = (d) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d;
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd).toLocaleDateString(fr ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "long" });
  };
  const roleLabel = (r) => (MESSAGE_ROLE_LABELS[fr ? "fr" : "en"][r] || r);

  const messages = student[F.msgs] || [];
  let lastDate = null;

  const intro = isStudentUser
    ? "A private thread between you and your teachers."
    : isParentUser
      ? (fr ? `Échanges privés entre les parents et les enseignants au sujet de ${student.name}.` : `A private thread between parents and teachers about ${student.name}.`)
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
            const n = profile?.id ? unreadIn(student, k, profile.id, true) : 0;
            return (
              <button key={k} className={`bsf-chip ${thread === k ? "active" : ""}`} onClick={() => setStaffThread(k)}>
                {k === "family" ? "Parents" : "Student"}{n > 0 ? ` (${n})` : ""}
              </button>
            );
          })}
        </div>
      )}
      <div className="bsf-chatthread">
        {messages.length === 0 && (
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

function AbsenceNotices({ profile }) {
  const { language } = useLanguage();
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    if (!profile?.id) return;
    const load = () => supabase
      .from("notifications")
      .select("id, title, title_fr, body, body_fr, created_at")
      .eq("user_id", profile.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .then(({ data: rows, error }) => { if (!error) setNotices(rows || []); });
    load();
    window.addEventListener("bs-notices-changed", load);
    return () => window.removeEventListener("bs-notices-changed", load);
  }, [profile?.id]);

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

export { StudentMessages, useUnreadNoticeCount, AbsenceNotices, NotificationBell };

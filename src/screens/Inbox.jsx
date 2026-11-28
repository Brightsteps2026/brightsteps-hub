import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { pending } from "../data/pending";
import { StudentMessages } from "./Messages";

// Staff Messages inbox (Myri, 28 Nov 2026): every conversation in one list,
// newest first, instead of opening each student's profile. Tap a row to open
// the conversation. The database decides which conversations each person sees
// (public.my_message_threads, same rules as the messages themselves).

const POLL_MS = 30 * 1000;
const THREAD_NAMES = { family: "Parents", student: "Student", office: "Office", director: "Director" };
const DIRECTOR_ID = "c7938eac-08fb-4ac9-933d-0cb24d27082b";

const initials = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

function when(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const days = (now - d) / 86400000;
  if (days < 6) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function InboxTab({ data, profile }) {
  const role = profile?.role;
  const isDirector = profile?.id === DIRECTOR_ID;
  const canWrite = role === "admin" || role === "teacher";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null); // { studentId, thread }
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    const { data: r, error: e } = await supabase.rpc("my_message_threads");
    if (e) setError("Messages couldn't be loaded."); else { setError(""); setRows(r || []); }
    setLoading(false);
  }, []);

  useEffect(() => {
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

  // The bell: open that student's conversation straight away.
  useEffect(() => {
    if (pending.messageStudentId) { setOpen({ studentId: pending.messageStudentId, thread: null }); pending.messageStudentId = null; }
    const onOpen = (e) => { pending.messageStudentId = null; setPicking(false); setOpen({ studentId: e.detail, thread: null }); };
    window.addEventListener("bs-open-thread", onOpen);
    return () => window.removeEventListener("bs-open-thread", onOpen);
  }, []);

  const students = data?.students || [];
  const byId = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const teacherGrades = role === "teacher" ? (profile.grades_assigned || []) : null;
  const myStudents = useMemo(
    () => students
      .filter((s) => !s.withdrawnOn && (!teacherGrades || teacherGrades.includes(s.grade)))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, role, profile?.grades_assigned]
  );

  const list = rows
    .filter((r) => byId[r.student_id])
    .filter((r) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (byId[r.student_id].name || "").toLowerCase().includes(q) || (r.last_author_name || "").toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.last_at) - new Date(a.last_at));

  // Sorted for you (Myri, 28 Nov 2026), no filters to tap:
  // first the conversations where a family wrote last and you can answer,
  // then the rest by type.
  const canAnswer = (r) => role !== "learning_assistant" && (r.thread === "office" || r.thread === "director" ? isDirector : true);
  const waiting = list.filter((r) => (r.last_author_role === "parent" || r.last_author_role === "student") && canAnswer(r));
  const rest = list.filter((r) => !waiting.includes(r));
  const sections = [
    { key: "waiting", title: "Waiting for a reply", rows: waiting },
    { key: "director", title: "Director · private", rows: rest.filter((r) => r.thread === "director") },
    { key: "office", title: "School office", rows: rest.filter((r) => r.thread === "office") },
    { key: "family", title: "Parents and teachers", rows: rest.filter((r) => r.thread === "family") },
    { key: "student", title: "Students", rows: rest.filter((r) => r.thread === "student") }
  ].filter((sec) => sec.rows.length > 0);

  const unreadTotal = rows.filter((r) => byId[r.student_id]).reduce((n, r) => n + (r.unread || 0), 0);

  // ---- One conversation, full screen ----
  if (open && byId[open.studentId]) {
    const s = byId[open.studentId];
    return (
      <div className="bsf-screen">
        <button className="bsf-btn-ghost" onClick={() => { setOpen(null); load(); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <ArrowLeft size={16} /> All messages
        </button>
        <section className="bsf-card">
          <p style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 600 }}>
            {s.name}{s.grade ? <span className="bsf-muted" style={{ fontWeight: 400, fontSize: 14 }}> · {s.grade}</span> : null}
          </p>
          <StudentMessages key={`${s.id}:${open.thread || ""}`} student={s} data={data} initialThread={open.thread} />
        </section>
      </div>
    );
  }

  // ---- The list ----
  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Messages</p>
        <h1>{unreadTotal > 0 ? `${unreadTotal} unread message${unreadTotal === 1 ? "" : "s"}` : "Your conversations"}</h1>
      </div>

      <section className="bsf-card">
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 10, padding: "0 10px", background: "#fff" }}>
            <Search size={15} color="#6B7578" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a student or parent"
              style={{ border: "none", outline: "none", padding: "9px 0", flex: 1, fontSize: 14, fontFamily: "inherit", background: "transparent", minWidth: 0 }}
            />
          </div>
          {canWrite && (
            <button className="bsf-btn" onClick={() => setPicking((p) => !p)} style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Plus size={16} /> New message
            </button>
          )}
        </div>

        {picking && (
          <div style={{ background: "#FCFAF4", border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>Write to the parents of…</p>
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) { setPicking(false); setOpen({ studentId: e.target.value, thread: "family" }); } }}
              style={{ width: "100%" }}
            >
              <option value="" disabled>Choose a student</option>
              {myStudents.map((s) => <option key={s.id} value={s.id}>{s.name}{s.grade ? ` · ${s.grade}` : ""}</option>)}
            </select>
          </div>
        )}


        {loading && <p className="bsf-empty">Loading…</p>}
        {!loading && error && <p className="bsf-empty">{error}</p>}
        {!loading && !error && list.length === 0 && (
          <p className="bsf-empty">{search ? "No conversation matches your search." : "No conversations yet."}</p>
        )}

        {sections.map((sec) => (
          <div key={sec.key} style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: sec.key === "waiting" ? "#801524" : "#6B7578" }}>
              {sec.title} · {sec.rows.length}
            </p>
        {sec.rows.map((r) => {
          const s = byId[r.student_id];
          const fromFamily = r.last_author_role === "parent" || r.last_author_role === "student";
          const sub = `${THREAD_NAMES[r.thread] || r.thread} · ${fromFamily ? `from ${r.last_author_name}` : `${r.last_author_name} replied`}`;
          const isNew = r.unread > 0;
          return (
            <button
              key={`${r.student_id}:${r.thread}`}
              onClick={() => setOpen({ studentId: r.student_id, thread: r.thread })}
              style={{ display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "11px 2px", border: "none", borderTop: "1px solid var(--line)", background: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--ink)" }}
            >
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: isNew ? "#F5E4E6" : "#F4EFEF", color: isNew ? "#801524" : "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flex: "none" }}>
                {initials(s.name)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: isNew ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.name}{s.grade ? ` · ${s.grade}` : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "#6B7578", whiteSpace: "nowrap" }}>{when(r.last_at)}</span>
                </span>
                <span style={{ display: "block", fontSize: 12, color: r.thread === "director" || r.thread === "office" ? "#801524" : "#6B7578" }}>{sub}</span>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: isNew ? "var(--ink)" : "#6B7578", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.last_body}</span>
                  {isNew && (
                    <span style={{ background: "#801524", color: "#fff", borderRadius: 100, fontSize: 11, padding: "1px 7px", fontWeight: 600, flex: "none" }}>{r.unread}</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
          </div>
        ))}
      </section>
    </div>
  );
}

export { InboxTab };

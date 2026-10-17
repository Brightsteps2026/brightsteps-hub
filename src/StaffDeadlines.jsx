// Staff deadlines card (Dashboard), Oct 2026.
// Teachers and assistants: the next deadlines that are for them, with a countdown and a
// "Mark as done" button, plus the next school calendar dates for their information.
// Admin: every deadline with who has done it and who has not, a "Remind" button that only
// reaches the people still pending, and a form to add a deadline.
// Reminders (bell, phone, email) are sent by the database: see supabase/staff-deadlines.sql.
// Staff screens are English only.

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { COLORS, TONES, input, primaryBtn, ghostBtn, pill } from "./ui/tokens";
import { todayStr } from "./lib/format";

const GOLD = "#E0A526";
const ROLES_FOR = [
  { id: "teacher", label: "Teachers", roles: ["teacher"] },
  { id: "both", label: "Teachers and assistants", roles: ["teacher", "learning_assistant"] }
];

// ---------- dates ----------
function parse(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(from, to) {
  return Math.round((parse(to) - parse(from)) / 86400000);
}
const shortDay = (s) => parse(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const month = (s) => parse(s).toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
const dayNum = (s) => parse(s).getDate();

// Countdown text and colour for a deadline that is not done yet.
function urgency(due, today) {
  const n = daysBetween(today, due);
  if (n < 0) return { tone: TONES.bad, text: `${-n} day${n === -1 ? "" : "s"} overdue` };
  if (n === 0) return { tone: TONES.bad, text: "Due today" };
  if (n === 1) return { tone: TONES.warn, text: "Tomorrow" };
  if (n <= 3) return { tone: TONES.warn, text: `In ${n} days` };
  return { tone: TONES.info, text: `In ${n} days` };
}

const shell = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 16,
  overflow: "hidden",
  marginBottom: 16,
  boxShadow: "0 1px 3px rgba(36,16,18,0.06)"
};
const row = { display: "flex", gap: 14, padding: "14px 18px", borderTop: `1px solid ${COLORS.line}`, alignItems: "center", flexWrap: "wrap" };
const small = { fontSize: 13, color: COLORS.muted };

function Header({ eyebrow, title, badge }) {
  return (
    <div style={{ background: COLORS.brand, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#F2D79A" }}>{eyebrow}</p>
        <h2 style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: "#fff" }}>{title}</h2>
      </div>
      {badge && <span style={{ background: GOLD, color: "#3D0B15", fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 999 }}>{badge}</span>}
    </div>
  );
}

function DateBlock({ date, tone }) {
  return (
    <div style={{ width: 50, flexShrink: 0, textAlign: "center", borderRadius: 10, background: tone.bg, color: tone.fg, padding: "5px 0" }} aria-hidden="true">
      <div style={{ fontSize: 11, fontWeight: 700 }}>{month(date)}</div>
      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.1 }}>{dayNum(date)}</div>
    </div>
  );
}

function Check({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

export default function StaffDeadlinesCard({ profile, events, onNavigate }) {
  const role = profile?.role;
  if (role === "admin") return <AdminDeadlines profile={profile} />;
  if (role === "teacher" || role === "learning_assistant") return <MyDeadlines profile={profile} events={events} onNavigate={onNavigate} />;
  return null;
}

// ===========================================================================
// Teachers and assistants
// ===========================================================================

function MyDeadlines({ profile, events, onNavigate }) {
  const today = todayStr();
  const [deadlines, setDeadlines] = useState(null);
  const [done, setDone] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [d, x] = await Promise.all([
        supabase.from("staff_deadlines").select("id, title, note, due_date").gte("due_date", addDays(today, -30)).order("due_date"),
        supabase.from("staff_deadline_done").select("deadline_id, done_at").eq("user_id", profile.id)
      ]);
      if (!alive) return;
      if (d.error || x.error) { setDeadlines([]); return; } // not switched on yet: the card stays hidden
      setDeadlines(d.data || []);
      setDone(Object.fromEntries((x.data || []).map((r) => [r.deadline_id, r.done_at])));
    })();
    return () => { alive = false; };
  }, [profile.id]);

  async function toggle(id) {
    setBusy(id); setError("");
    if (done[id]) {
      const { error: e } = await supabase.from("staff_deadline_done").delete().eq("deadline_id", id).eq("user_id", profile.id);
      if (e) setError("Not saved: " + e.message);
      else setDone((m) => { const n = { ...m }; delete n[id]; return n; });
    } else {
      const stamp = new Date().toISOString();
      const { error: e } = await supabase.from("staff_deadline_done").insert({ deadline_id: id, user_id: profile.id });
      if (e) setError("Not saved: " + e.message);
      else setDone((m) => ({ ...m, [id]: stamp }));
    }
    setBusy(null);
  }

  if (!deadlines) return null;

  // Done ones stay visible for a week, then leave the card.
  const weekAgo = addDays(today, -7);
  const todo = deadlines.filter((d) => !done[d.id]);
  const finished = deadlines.filter((d) => done[d.id] && done[d.id].slice(0, 10) >= weekAgo);
  const info = (events || [])
    .filter((e) => e.date >= today && e.date <= addDays(today, 14))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  if (todo.length === 0 && finished.length === 0 && info.length === 0) return null;

  const items = [
    ...todo.map((d) => ({ kind: "todo", date: d.due_date, d })),
    ...info.map((e) => ({ kind: "info", date: e.date, e }))
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "todo" ? -1 : 1));
  const all = [...items, ...finished.map((d) => ({ kind: "done", date: d.due_date, d }))];
  const shown = showAll ? all : all.slice(0, 5);
  const firstName = (profile?.full_name || "").split(" ")[0];

  return (
    <section style={shell} aria-label="Upcoming deadlines">
      <Header eyebrow={firstName ? `For you, ${firstName}` : "For you"} title="Upcoming deadlines"
        badge={todo.length ? `${todo.length} to do` : "All done"} />

      {shown.map((it) => {
        if (it.kind === "info") {
          const e = it.e;
          const n = daysBetween(today, e.date);
          return (
            <div key={"e" + e.id + e.date} style={row}>
              <DateBlock date={e.date} tone={TONES.info} />
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{e.title}</div>
                <div style={small}>{shortDay(e.date)}{e.endDate && e.endDate !== e.date ? ` – ${shortDay(e.endDate)}` : ""} · {n === 0 ? "Today" : n === 1 ? "Tomorrow" : `in ${n} days`}</div>
              </div>
              <span style={pill("info")}>For your info</span>
            </div>
          );
        }
        const d = it.d;
        if (it.kind === "done") {
          return (
            <div key={d.id} style={row}>
              <DateBlock date={d.due_date} tone={TONES.ok} />
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.muted, textDecoration: "line-through" }}>{d.title}</div>
                <div style={small}>Done on {shortDay(done[d.id].slice(0, 10))}</div>
              </div>
              <button type="button" onClick={() => toggle(d.id)} disabled={busy === d.id}
                style={{ ...ghostBtn, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.ok }}
                aria-label={`Undo done: ${d.title}`}>
                <Check color={COLORS.ok} /> Done · Undo
              </button>
            </div>
          );
        }
        const u = urgency(d.due_date, today);
        return (
          <div key={d.id} style={row}>
            <DateBlock date={d.due_date} tone={u.tone} />
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{d.title}</div>
              <div style={small}>{shortDay(d.due_date)} · <strong style={{ color: u.tone.fg }}>{u.text}</strong></div>
              {d.note && <div style={{ ...small, marginTop: 2 }}>{d.note}</div>}
            </div>
            <button type="button" onClick={() => toggle(d.id)} disabled={busy === d.id}
              style={{ ...primaryBtn, minHeight: 44, opacity: busy === d.id ? 0.6 : 1 }}>
              {busy === d.id ? "Saving…" : "Mark as done"}
            </button>
          </div>
        );
      })}

      {error && <p style={{ margin: 0, padding: "8px 18px", fontSize: 13, color: COLORS.bad }}>{error}</p>}
      <div style={{ ...row, justifyContent: "space-between", padding: "12px 18px" }}>
        <span style={{ fontSize: 12, color: COLORS.muted }}>Reminders come by bell and email 3 days before, and on the day.</span>
        <span style={{ display: "flex", gap: 16 }}>
          {all.length > 5 && (
            <button type="button" onClick={() => setShowAll(!showAll)} style={linkBtn}>{showAll ? "Show less" : `Show all ${all.length}`}</button>
          )}
          {onNavigate && <button type="button" onClick={() => onNavigate("calendar")} style={linkBtn}>Full calendar</button>}
        </span>
      </div>
    </section>
  );
}

const linkBtn = { background: "none", border: "none", padding: 0, minHeight: 32, color: COLORS.brand, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

// ===========================================================================
// Admin
// ===========================================================================

function AdminDeadlines({ profile }) {
  const today = todayStr();
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", due_date: "", forId: "teacher", note: "" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const [d, x, p] = await Promise.all([
      supabase.from("staff_deadlines").select("*").gte("due_date", addDays(today, -30)).order("due_date"),
      supabase.from("staff_deadline_done").select("deadline_id, user_id, done_at"),
      supabase.rpc("staff_deadline_people")
    ]);
    const err = d.error || x.error || p.error;
    if (err) {
      setError(/staff_deadline/.test(err.message) ? "Staff deadlines aren't switched on yet. Please run staff-deadlines.sql in Supabase." : err.message);
      return;
    }
    setError("");
    setState({ deadlines: d.data || [], done: x.data || [], people: p.data || [] });
  }
  useEffect(() => { load(); }, []);

  async function add() {
    const title = form.title.trim();
    if (title.length < 2 || !form.due_date) { setMsg("Please give a title and a due date."); return; }
    setBusy("add"); setMsg("");
    const roles = ROLES_FOR.find((r) => r.id === form.forId).roles;
    const { error: e } = await supabase.from("staff_deadlines").insert({ title, due_date: form.due_date, for_roles: roles, note: form.note.trim() || null });
    setBusy("");
    if (e) { setMsg("Not saved: " + e.message); return; }
    setForm({ title: "", due_date: "", forId: "teacher", note: "" });
    setAdding(false);
    load();
  }

  async function remove(d) {
    if (!window.confirm(`Delete the deadline "${d.title}"? Staff will no longer see it.`)) return;
    setBusy(d.id);
    const { error: e } = await supabase.from("staff_deadlines").delete().eq("id", d.id);
    setBusy("");
    if (e) { setMsg("Not deleted: " + e.message); return; }
    load();
  }

  async function remind(d, names) {
    setBusy(d.id); setMsg("");
    const { data: n, error: e } = await supabase.rpc("staff_deadline_remind", { p_id: d.id });
    setBusy("");
    if (e) { setMsg("Reminder not sent: " + e.message); return; }
    setMsg(n ? `Reminder sent to ${names.join(", ")}.` : "Everyone has already done it.");
  }

  if (error) return <section style={{ ...shell, padding: 16, color: COLORS.bad }}>{error}</section>;
  if (!state) return null;

  const weekAgo = addDays(today, -7);
  const list = state.deadlines.map((d) => {
    const people = state.people.filter((p) => d.for_roles.includes(p.role));
    const doneIds = new Set(state.done.filter((x) => x.deadline_id === d.id).map((x) => x.user_id));
    const pending = people.filter((p) => !doneIds.has(p.id));
    return { d, people, doneIds, pending };
  })
    // Fully done deadlines from more than a week ago leave the card.
    .filter((r) => r.pending.length > 0 || r.d.due_date >= weekAgo);
  const pendingPeople = new Set(list.flatMap((r) => (r.d.due_date <= addDays(today, 14) ? r.pending.map((p) => p.id) : [])));

  return (
    <section style={shell} aria-label="Staff deadlines">
      <Header eyebrow="Admin · only you see this" title="Staff deadlines"
        badge={pendingPeople.size ? `${pendingPeople.size} ${pendingPeople.size === 1 ? "person" : "people"} pending` : list.length ? "All on track" : null} />

      {list.length === 0 && !adding && (
        <p style={{ ...small, margin: 0, padding: "14px 18px" }}>No deadlines yet. Add one and it appears on every teacher's Dashboard.</p>
      )}

      {list.map(({ d, people, doneIds, pending }) => {
        const n = people.length - pending.length;
        const allDone = people.length > 0 && pending.length === 0;
        const u = urgency(d.due_date, today);
        const pct = people.length ? Math.round((100 * n) / people.length) : 0;
        return (
          <div key={d.id} style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{d.title}</div>
                <div style={small}>
                  {shortDay(d.due_date)} · {allDone ? <strong style={{ color: COLORS.ok }}>All done</strong> : <strong style={{ color: u.tone.fg }}>{u.text}</strong>}
                  {" · "}{d.for_roles.includes("learning_assistant") ? "Teachers and assistants" : "Teachers"}
                </div>
                {d.note && <div style={{ ...small, marginTop: 2 }}>{d.note}</div>}
              </div>
              <strong style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6, color: allDone ? COLORS.ok : COLORS.ink }}>
                {allDone && <Check color={COLORS.ok} />}{n} of {people.length}
              </strong>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: COLORS.line, overflow: "hidden" }} role="img" aria-label={`${n} of ${people.length} done`}>
              <div style={{ width: `${pct}%`, height: 8, background: COLORS.ok }} />
            </div>
            {!allDone && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {people.map((p) => (
                  <span key={p.id} style={pill(doneIds.has(p.id) ? "ok" : d.due_date < today ? "bad" : "warn")}>
                    {p.name} · {doneIds.has(p.id) ? "done" : "pending"}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {pending.length > 0 && (
                <button type="button" disabled={busy === d.id} onClick={() => remind(d, pending.map((p) => p.name))}
                  style={{ ...(d.due_date <= today ? primaryBtn : { ...ghostBtn, color: COLORS.brand, borderColor: COLORS.brand }), minHeight: 44, opacity: busy === d.id ? 0.6 : 1 }}>
                  {busy === d.id ? "Sending…" : pending.length === 1 ? `Remind ${pending[0].name}` : `Remind the ${pending.length} pending`}
                </button>
              )}
              <button type="button" onClick={() => remove(d)} disabled={busy === d.id} style={{ ...linkBtn, color: COLORS.muted, fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        );
      })}

      {adding && (
        <div style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 10, background: COLORS.surface2 }}>
          <strong style={{ fontSize: 15 }}>New deadline</strong>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
            What needs to be done
            <input value={form.title} maxLength={140} placeholder="e.g. Submit final grades and comments"
              onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ ...input, fontWeight: 400 }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
              Due date
              <input type="date" value={form.due_date} min={today} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={{ ...input, fontWeight: 400 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
              For
              <select value={form.forId} onChange={(e) => setForm({ ...form, forId: e.target.value })} style={{ ...input, fontWeight: 400 }}>
                {ROLES_FOR.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
            Note for staff (optional)
            <input value={form.note} maxLength={500} placeholder="e.g. Report cards go out on Tuesday 8 December"
              onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...input, fontWeight: 400 }} />
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={{ ...primaryBtn, minHeight: 44, opacity: busy === "add" ? 0.6 : 1 }} disabled={busy === "add"} onClick={add}>
              {busy === "add" ? "Saving…" : "Add deadline"}
            </button>
            <button type="button" style={{ ...ghostBtn, minHeight: 44 }} onClick={() => { setAdding(false); setMsg(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {msg && <p style={{ margin: 0, padding: "8px 18px", fontSize: 13, color: /^Not|not sent/.test(msg) ? COLORS.bad : COLORS.ok }}>{msg}</p>}
      <div style={{ ...row, justifyContent: "space-between", padding: "12px 18px" }}>
        <span style={{ fontSize: 12, color: COLORS.muted }}>Staff who haven't marked a deadline done are reminded 3 days before and on the day.</span>
        {!adding && <button type="button" onClick={() => { setAdding(true); setMsg(""); }} style={linkBtn}>+ Add a deadline</button>}
      </div>
    </section>
  );
}

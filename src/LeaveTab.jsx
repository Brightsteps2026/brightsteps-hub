import { useEffect, useMemo, useState } from "react";
import { CalendarOff } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment, getAttachmentUrl } from "./lib/attachments";

export { CalendarOff as LeaveIcon };

// Staff screen, English only.
const BURGUNDY = "#801524";
const LINE = "#EAD7DA";
const MUTED = "#6E7B7D";
const TONES = {
  ok: { bg: "#E6F2EC", fg: "#2F7A5C" },
  warn: { bg: "#FBF0DC", fg: "#8A5A0B" },
  danger: { bg: "#FCE8E8", fg: "#B23A3A" },
  info: { bg: "#F5E4E6", fg: BURGUNDY },
  muted: { bg: "#F1EFEF", fg: "#5F5E5A" }
};

const wrap = { padding: "16px 16px 90px" };
const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: "0 1px 3px rgba(36,16,18,0.06)" };
const chip = { border: `1px solid ${LINE}`, borderRadius: 100, padding: "7px 13px", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#3B4A4C", fontFamily: "inherit" };
const chipOn = { ...chip, background: BURGUNDY, borderColor: BURGUNDY, color: "#fff" };
const optBtn = { ...chip, borderRadius: 10, padding: "10px 8px", textAlign: "center" };
const optOn = { ...optBtn, background: "#F5E4E6", borderColor: BURGUNDY, color: BURGUNDY };
const primaryBtn = { background: BURGUNDY, color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", fontFamily: "inherit" };
const secondaryBtn = { ...chip, borderRadius: 10, padding: "9px 14px" };
const input = { width: "100%", padding: "9px 10px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, background: "#FCFAF4", boxSizing: "border-box", fontFamily: "inherit" };
const label = { display: "block", fontSize: 13, color: MUTED, margin: "12px 0 5px" };
const heading = { margin: "0 0 12px", fontSize: 18, fontWeight: 600 };
const grid2 = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 };

const TYPES = [
  { id: "half_am", label: "Half day (morning)" },
  { id: "half_pm", label: "Half day (afternoon)" },
  { id: "full_day", label: "Full day" },
  { id: "multi_day", label: "Several days" }
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));

const STATUS = {
  pending: { label: "Pending", tone: TONES.warn },
  info_needed: { label: "Info needed", tone: TONES.info },
  approved: { label: "Approved", tone: TONES.ok },
  denied: { label: "Denied", tone: TONES.danger }
};

function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function fmtDate(s) {
  if (!s) return "";
  return new Date(s + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function dateRange(r) {
  return r.start_date === r.end_date ? fmtDate(r.start_date) : `${fmtDate(r.start_date)} to ${fmtDate(r.end_date)}`;
}

// Counts school days (Mon to Fri), with half days as 0.5.
function dayCount(r) {
  if (r.leave_type === "half_am" || r.leave_type === "half_pm") return 0.5;
  let n = 0;
  const d = new Date(r.start_date + "T12:00:00");
  const end = new Date(r.end_date + "T12:00:00");
  while (d <= end) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) n += 1;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function Pill({ tone, children }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 100, background: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

async function openPlans(path) {
  try {
    const url = await getAttachmentUrl(path);
    window.open(url, "_blank", "noopener");
  } catch (e) {
    alert("Couldn't open the sub plans: " + e.message);
  }
}

function coverLabel(r, names) {
  if (r.cover_teacher_id) return names[r.cover_teacher_id] || "Staff member";
  if (r.cover_other) return r.cover_other;
  return "Not set";
}

export default function LeaveTab({ profile }) {
  const role = profile?.role;
  if (role === "admin") return <AdminView />;
  if (role === "teacher" || role === "learning_assistant") return <TeacherView profile={profile} />;
  if (role === "accountant") return <PayrollView />;
  return (
    <div style={wrap}>
      <p style={{ ...card, fontSize: 14, color: MUTED }}>Leave requests are only available to staff.</p>
    </div>
  );
}

// ---------- Teacher ----------

function TeacherView({ profile }) {
  const [view, setView] = useState("list");
  const [rows, setRows] = useState([]);
  const [covers, setCovers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const [r, c, s] = await Promise.all([
      supabase.from("leave_requests").select("*").eq("teacher_id", profile.id).order("start_date", { ascending: false }),
      supabase.rpc("leave_my_covers"),
      supabase.rpc("leave_staff")
    ]);
    const err = r.error || c.error || s.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setRows(r.data || []);
    setCovers(c.data || []);
    setStaff(s.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const names = useMemo(() => Object.fromEntries(staff.map((x) => [x.id, x.full_name])), [staff]);

  if (loading) return <div style={wrap}><p style={{ color: MUTED }}>Loading…</p></div>;
  if (error) return <div style={wrap}><p style={{ ...card, color: TONES.danger.fg }}>Couldn't load leave requests: {error}</p></div>;

  if (view === "new") {
    return (
      <div style={wrap}>
        <RequestForm
          profile={profile}
          staff={staff.filter((x) => x.id !== profile.id)}
          onCancel={() => setView("list")}
          onSaved={() => { setView("list"); setNotice("Request sent. You'll see the answer here."); load(); }}
        />
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ ...heading, margin: 0 }}>Leave requests</h2>
        <button style={{ ...primaryBtn, width: "auto" }} onClick={() => { setNotice(""); setView("new"); }}>New request</button>
      </div>

      {notice && <p style={{ ...card, padding: "10px 14px", fontSize: 14, color: TONES.ok.fg, background: TONES.ok.bg, borderColor: TONES.ok.bg }}>{notice}</p>}

      {covers.length > 0 && (
        <div style={{ ...card, background: "#FBF3E4", borderColor: "#E8D2A6" }}>
          <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>You're covering</p>
          {covers.map((c) => (
            <div key={c.id} style={{ padding: "6px 0", fontSize: 14 }}>
              <strong>{c.teacher_name}</strong> · {TYPE_LABEL[c.leave_type]} · {dateRange(c)}
              {c.status !== "approved" && <span style={{ color: MUTED }}> (not approved yet)</span>}
              <div style={{ marginTop: 4 }}>
                {c.sub_plans_path
                  ? <button style={secondaryBtn} onClick={() => openPlans(c.sub_plans_path)}>Open sub plans</button>
                  : <span style={{ fontSize: 13, color: MUTED }}>{c.sub_plans_ready ? "Sub plans are ready, ask the teacher where they are." : "Sub plans not ready yet."}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && <p style={{ ...card, fontSize: 14, color: MUTED }}>Your leave requests will appear here.</p>}
      {rows.map((r) => <MyRequestCard key={r.id} r={r} names={names} reload={load} />)}
    </div>
  );
}

function MyRequestCard({ r, names, reload }) {
  const [reply, setReply] = useState(r.teacher_reply || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const st = STATUS[r.status];

  async function sendReply() {
    if (!reply.trim()) { setErr("Write your answer first."); return; }
    setBusy(true);
    const { error } = await supabase.from("leave_requests").update({ teacher_reply: reply.trim() }).eq("id", r.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    reload();
  }

  async function cancel() {
    if (!window.confirm("Cancel this request?")) return;
    setBusy(true);
    const { error } = await supabase.from("leave_requests").delete().eq("id", r.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    reload();
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{TYPE_LABEL[r.leave_type]}</span>
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>{dateRange(r)} · {r.reason}</p>
      <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>Cover: {coverLabel(r, names)} · Sub plans: {r.sub_plans_ready ? "ready" : "not yet"}</p>

      {r.director_comment && (
        <div style={{ marginTop: 10, background: TONES.info.bg, borderRadius: 10, padding: "8px 12px", fontSize: 14 }}>
          <span style={{ fontSize: 12, color: BURGUNDY, fontWeight: 600 }}>From the Director</span>
          <p style={{ margin: "2px 0 0" }}>{r.director_comment}</p>
        </div>
      )}

      {r.status === "info_needed" && (
        <div>
          <label style={label}>Your answer</label>
          <textarea style={{ ...input, minHeight: 70 }} value={reply} onChange={(e) => { setReply(e.target.value); setErr(""); }} />
          <button style={{ ...primaryBtn, marginTop: 8 }} disabled={busy} onClick={sendReply}>{busy ? "Sending…" : "Send answer"}</button>
        </div>
      )}
      {r.status !== "info_needed" && r.teacher_reply && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: MUTED }}>Your answer: {r.teacher_reply}</p>
      )}

      {r.status === "pending" && (
        <button style={{ ...secondaryBtn, marginTop: 10 }} disabled={busy} onClick={cancel}>Cancel request</button>
      )}
      {err && <p style={{ margin: "6px 0 0", fontSize: 13, color: TONES.danger.fg }}>{err}</p>}
    </div>
  );
}

function RequestForm({ profile, staff, onCancel, onSaved }) {
  const [f, setF] = useState({
    leave_type: "full_day",
    start_date: todayStr(),
    end_date: todayStr(),
    reason: "",
    note: "",
    cover: "",
    cover_other: "",
    sub_plans_ready: null
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErr(""); };
  const multi = f.leave_type === "multi_day";

  async function submit() {
    if (!f.start_date) return setErr("Choose a date.");
    if (multi && (!f.end_date || f.end_date < f.start_date)) return setErr("The end date must be on or after the start date.");
    if (!f.reason.trim()) return setErr("Write a reason.");
    if (!f.cover) return setErr("Choose who will cover your class.");
    if (f.cover === "other" && !f.cover_other.trim()) return setErr("Write the name of the person covering.");
    if (f.sub_plans_ready === null) return setErr("Say whether your sub plans are ready.");

    setBusy(true);
    let sub_plans_path = null;
    if (file) {
      try {
        const up = await uploadAttachment(file, `leave/${profile.id}`);
        sub_plans_path = up.path;
      } catch (e) {
        setBusy(false);
        return setErr("Couldn't upload the sub plans: " + e.message);
      }
    }
    const row = {
      leave_type: f.leave_type,
      start_date: f.start_date,
      end_date: multi ? f.end_date : f.start_date,
      reason: f.reason.trim(),
      note: f.note.trim() || null,
      cover_teacher_id: f.cover === "other" ? null : f.cover,
      cover_other: f.cover === "other" ? f.cover_other.trim() : null,
      sub_plans_ready: f.sub_plans_ready || !!sub_plans_path,
      sub_plans_path
    };
    const { error } = await supabase.from("leave_requests").insert(row);
    setBusy(false);
    if (error) return setErr("Couldn't send: " + error.message);
    onSaved();
  }

  return (
    <div style={card}>
      <h2 style={heading}>New leave request</h2>

      <label style={{ ...label, marginTop: 0 }}>How long</label>
      <div style={grid2}>
        {TYPES.map((t) => (
          <button key={t.id} style={f.leave_type === t.id ? optOn : optBtn} onClick={() => set("leave_type", t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={multi ? grid2 : undefined}>
        <div>
          <label style={label}>{multi ? "First day" : "Date"}</label>
          <input type="date" style={input} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </div>
        {multi && (
          <div>
            <label style={label}>Last day</label>
            <input type="date" style={input} value={f.end_date} min={f.start_date} onChange={(e) => set("end_date", e.target.value)} />
          </div>
        )}
      </div>

      <label style={label}>Reason</label>
      <input style={input} value={f.reason} placeholder="Medical appointment" onChange={(e) => set("reason", e.target.value)} />

      <label style={label}>Note (optional)</label>
      <textarea style={{ ...input, minHeight: 60 }} value={f.note} onChange={(e) => set("note", e.target.value)} />

      <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 16, paddingTop: 4 }}>
        <label style={label}>Who will cover your class?</label>
        <select style={input} value={f.cover} onChange={(e) => set("cover", e.target.value)}>
          <option value="">Choose…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          <option value="other">Someone else (outside substitute)</option>
        </select>
        {f.cover === "other" && (
          <input style={{ ...input, marginTop: 8 }} value={f.cover_other} placeholder="Full name" onChange={(e) => set("cover_other", e.target.value)} />
        )}

        <label style={label}>Are sub plans ready?</label>
        <div style={grid2}>
          <button style={f.sub_plans_ready === true ? optOn : optBtn} onClick={() => set("sub_plans_ready", true)}>Yes</button>
          <button style={f.sub_plans_ready === false ? optOn : optBtn} onClick={() => set("sub_plans_ready", false)}>Not yet</button>
        </div>

        <label style={label}>Attach sub plans (optional)</label>
        <input type="file" style={{ fontSize: 13 }} onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <p style={{ margin: "4px 0 0", fontSize: 12, color: MUTED }}>The person covering your class will be able to open this file.</p>
      </div>

      {err && <p style={{ margin: "12px 0 0", fontSize: 13, color: TONES.danger.fg }}>{err}</p>}
      <button style={{ ...primaryBtn, marginTop: 16 }} disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send request"}</button>
      <button style={{ ...secondaryBtn, width: "100%", marginTop: 8 }} onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ---------- Director ----------

function AdminView() {
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [filter, setFilter] = useState("todo");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const [r, s] = await Promise.all([
      supabase.from("leave_requests").select("*").order("start_date", { ascending: false }).limit(500),
      supabase.rpc("leave_staff")
    ]);
    const err = r.error || s.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setRows(r.data || []);
    setStaff(s.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const names = useMemo(() => Object.fromEntries(staff.map((x) => [x.id, x.full_name])), [staff]);

  if (loading) return <div style={wrap}><p style={{ color: MUTED }}>Loading…</p></div>;
  if (error) return <div style={wrap}><p style={{ ...card, color: TONES.danger.fg }}>Couldn't load leave requests: {error}</p></div>;

  const todo = rows.filter((r) => r.status === "pending" || r.status === "info_needed");
  const shown = filter === "todo" ? todo : rows;

  return (
    <div style={wrap}>
      <h2 style={heading}>Leave requests</h2>
      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        <button style={filter === "todo" ? chipOn : chip} onClick={() => setFilter("todo")}>To decide ({todo.length})</button>
        <button style={filter === "all" ? chipOn : chip} onClick={() => setFilter("all")}>All</button>
      </div>
      {shown.length === 0 && <p style={{ ...card, fontSize: 14, color: MUTED }}>{filter === "todo" ? "No requests waiting for you." : "No leave requests yet."}</p>}
      {shown.map((r) => <DecisionCard key={r.id} r={r} names={names} reload={load} />)}
    </div>
  );
}

function DecisionCard({ r, names, reload }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const st = STATUS[r.status];
  const open = r.status === "pending" || r.status === "info_needed";

  async function decide(status) {
    if (status === "info_needed" && !comment.trim()) { setErr("Write your question first."); return; }
    setBusy(true);
    const patch = { status, director_comment: comment.trim() || null };
    if (status === "info_needed") patch.teacher_reply = null;
    const { error } = await supabase.from("leave_requests").update(patch).eq("id", r.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    reload();
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{names[r.teacher_id] || "Staff member"}</span>
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>{TYPE_LABEL[r.leave_type]} · {dateRange(r)} · {dayCount(r)} day{dayCount(r) === 1 ? "" : "s"}</p>
      <p style={{ margin: "2px 0 0", fontSize: 14 }}>{r.reason}</p>
      {r.note && <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>{r.note}</p>}
      <p style={{ margin: "8px 0 0", fontSize: 13 }}>
        Cover: <strong>{coverLabel(r, names)}</strong>
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {r.sub_plans_ready
          ? <Pill tone={TONES.ok}>Sub plans ready</Pill>
          : <Pill tone={TONES.warn}>Sub plans not ready</Pill>}
        {r.sub_plans_path && <button style={secondaryBtn} onClick={() => openPlans(r.sub_plans_path)}>Open sub plans</button>}
      </div>

      {r.director_comment && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: MUTED }}>You wrote: {r.director_comment}</p>
      )}
      {r.teacher_reply && (
        <div style={{ marginTop: 8, background: TONES.info.bg, borderRadius: 10, padding: "8px 12px", fontSize: 14 }}>
          <span style={{ fontSize: 12, color: BURGUNDY, fontWeight: 600 }}>Teacher's answer</span>
          <p style={{ margin: "2px 0 0" }}>{r.teacher_reply}</p>
        </div>
      )}

      {open && (
        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 12 }}>
          <label style={label}>Comment or question (optional for approve or deny)</label>
          <textarea style={{ ...input, minHeight: 56 }} value={comment} onChange={(e) => { setComment(e.target.value); setErr(""); }} />
          <div style={{ ...grid2, marginTop: 8 }}>
            <button style={{ ...optBtn, background: TONES.ok.bg, color: TONES.ok.fg, borderColor: TONES.ok.bg }} disabled={busy} onClick={() => decide("approved")}>Approve</button>
            <button style={{ ...optBtn, background: TONES.danger.bg, color: TONES.danger.fg, borderColor: TONES.danger.bg }} disabled={busy} onClick={() => decide("denied")}>Deny</button>
          </div>
          <button style={{ ...secondaryBtn, width: "100%", marginTop: 8 }} disabled={busy} onClick={() => decide("info_needed")}>Ask for more info</button>
          {err && <p style={{ margin: "6px 0 0", fontSize: 13, color: TONES.danger.fg }}>{err}</p>}
        </div>
      )}
    </div>
  );
}

// ---------- Accountant ----------

function PayrollView() {
  const [rows, setRows] = useState([]);
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("leave_requests_payroll").select("*").order("start_date", { ascending: false })
      .then(({ data, error: e }) => {
        if (e) setError(e.message); else setRows(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={wrap}><p style={{ color: MUTED }}>Loading…</p></div>;
  if (error) return <div style={wrap}><p style={{ ...card, color: TONES.danger.fg }}>Couldn't load approved leave: {error}</p></div>;

  const shown = rows.filter((r) => r.start_date.slice(0, 7) === month || r.end_date.slice(0, 7) === month);
  const totals = {};
  shown.forEach((r) => { totals[r.teacher_name] = (totals[r.teacher_name] || 0) + dayCount(r); });

  return (
    <div style={wrap}>
      <h2 style={heading}>Approved leave</h2>
      <label style={{ ...label, marginTop: 0 }}>Month</label>
      <input type="month" style={{ ...input, marginBottom: 14 }} value={month} onChange={(e) => setMonth(e.target.value)} />

      {Object.keys(totals).length > 0 && (
        <div style={card}>
          <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>Days per person</p>
          {Object.entries(totals).map(([n, d]) => (
            <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "3px 0" }}>
              <span>{n}</span><strong>{d}</strong>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        {shown.length === 0 && <p style={{ margin: 0, fontSize: 14, color: MUTED }}>No approved leave this month.</p>}
        {shown.map((r, i) => (
          <div key={r.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${LINE}`, padding: "8px 0" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{r.teacher_name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>{TYPE_LABEL[r.leave_type]} · {dateRange(r)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment, getAttachmentUrl } from "./lib/attachments";
import { COLORS, card as cardToken, primaryBtn, ghostBtn, input, label, pill } from "./ui/tokens";

// Staff side, shown inside the Leave tab (Myri, 20 Nov 2026): staff answer absence
// explanation requests and upload emergency lesson plans here. Staff files themselves
// stay private to the Director and HR. Staff screen, English only.
const card = { ...cardToken, marginBottom: 12 };
const small = { fontSize: 13, color: COLORS.muted, margin: 0 };
const row = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const folder = (id) => `staff-file/${id}`;
const fmtDate = (s) => (s ? new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "");
const fmtDateTime = (s) => (s ? new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

const REASONS = [
  ["sudden_illness", "Sudden illness"],
  ["family_emergency", "Family emergency"],
  ["forgot_check_in", "I was at school but forgot to check in"],
  ["transport", "Transport problem"],
  ["other", "Other"]
];
const REASON = Object.fromEntries(REASONS);
const STATUS = {
  awaiting: ["Waiting for your explanation", "warn"],
  answered: ["Sent to the Director", "info"],
  accepted: ["Explanation accepted", "ok"],
  not_accepted: ["Explanation not accepted", "bad"]
};

export function AbsenceExplanations({ profile }) {
  const [rows, setRows] = useState([]);
  const load = () => supabase.rpc("my_absence_requests").then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600 }}>Absence explanations</p>
      {rows.map((r) => <Request key={r.id} r={r} profile={profile} reload={load} />)}
    </div>
  );
}

function Request({ r, profile, reload }) {
  const [reason, setReason] = useState("sudden_illness");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [label0, tone] = STATUS[r.status] || ["", "neutral"];
  async function send() {
    if (!text.trim()) return setErr("Write your explanation first.");
    setBusy(true); setErr("");
    try {
      let up = null;
      if (file) up = await uploadAttachment(file, folder(profile.id));
      const { error } = await supabase.rpc("staff_file_reply", { p_id: r.id, p_reason: reason, p_reply: text.trim(), p_proof_path: up?.path || null, p_proof_name: up ? file.name : null });
      if (error) throw error;
      reload();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <div style={{ ...card, borderColor: r.status === "awaiting" ? COLORS.warn : COLORS.line }}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600 }}>Absence on {fmtDate(r.entry_date)}</span>
        <span style={pill(tone)}>{label0}</span>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 14, color: COLORS.text2 }}>{r.details}</p>
      {r.status === "awaiting" && r.reply_due_at && (
        <p style={{ ...small, marginTop: 6, color: new Date(r.reply_due_at) < new Date() ? COLORS.bad : COLORS.muted }}>Please reply by {fmtDateTime(r.reply_due_at)}</p>
      )}
      {r.replied_at && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: COLORS.surface2, border: `1px solid ${COLORS.line}` }}>
          <p style={{ ...small, fontWeight: 600 }}>Your explanation · {fmtDateTime(r.replied_at)}</p>
          {r.staff_reason && <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>{REASON[r.staff_reason]}</p>}
          <p style={{ margin: "4px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{r.staff_reply}</p>
          {r.reply_proof_name && <p style={small}>Proof attached: {r.reply_proof_name}</p>}
        </div>
      )}
      {r.decision_note && <p style={{ ...small, marginTop: 8 }}>Director: {r.decision_note}</p>}
      {r.status === "awaiting" && (
        <div style={{ marginTop: 6 }}>
          <span style={label}>Reason</span>
          <select style={input} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
          <span style={label}>Your explanation</span>
          <textarea style={{ ...input, minHeight: 70 }} value={text} onChange={(e) => setText(e.target.value)} />
          <label style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", marginTop: 8 }}>
            {file ? file.name : "Attach proof (doctor's note…)"}
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {err && <p style={{ color: COLORS.bad, fontSize: 13 }}>{err}</p>}
          <div style={{ marginTop: 8 }}><button style={{ ...primaryBtn, width: "auto" }} disabled={busy} onClick={send}>{busy ? "Sending…" : "Send explanation"}</button></div>
        </div>
      )}
    </div>
  );
}

export function EmergencyPlansCard({ profile }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => supabase.rpc("my_emergency_plans").then(({ data }) => setS(data?.[0] || {}));
  useEffect(() => { load(); }, []);
  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadAttachment(file, folder(profile.id));
      const { error } = await supabase.rpc("staff_submit_emergency_plans", { p_path: up.path, p_name: file.name });
      if (error) throw error;
      load();
    } catch (e) { alert("Couldn't upload the emergency plans: " + e.message); }
    setBusy(false);
  }
  async function open() {
    try { window.open(await getAttachmentUrl(s.file_path), "_blank", "noopener"); } catch (e) { alert(e.message); }
  }
  if (!s || profile?.role !== "teacher") return null;
  return (
    <div style={{ ...card, ...row, justifyContent: "space-between" }}>
      <div style={{ flex: "1 1 260px" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Emergency lesson plans</p>
        <p style={small}>3 days of lessons any colleague can teach, with your class list, routines and students' needs.</p>
        <p style={{ ...small, marginTop: 4, color: s.submitted_at ? COLORS.ok : COLORS.warn }}>
          {s.submitted_at ? `Submitted ${fmtDate(s.submitted_at)}${s.file_name ? ` · ${s.file_name}` : ""}` : "Not submitted yet: due Friday 4 December 2026"}
        </p>
      </div>
      <span style={row}>
        {s.file_path && <button style={ghostBtn} onClick={open}>Open</button>}
        <label style={{ ...primaryBtn, width: "auto", display: "inline-flex", alignItems: "center" }}>
          {busy ? "Uploading…" : s.submitted_at ? "Replace file" : "Upload plans"}
          <input type="file" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </label>
      </span>
    </div>
  );
}

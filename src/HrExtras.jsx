import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment, getAttachmentUrl } from "./lib/attachments";
import { COLORS, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, label, pill } from "./ui/tokens";

// HR additions (Myri, 20 Nov 2026): payroll summary, signatures, contracts,
// documents and training, leave balance, onboarding. Staff screen, English only.
const card = { ...cardToken, marginBottom: 12 };
const small = { fontSize: 13, color: COLORS.muted, margin: 0 };
const row = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const h3 = { margin: "0 0 8px", fontSize: 15, fontWeight: 600 };
const th = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: COLORS.muted, borderBottom: `1px solid ${COLORS.line}`, whiteSpace: "nowrap" };
const td = { padding: "6px 8px", fontSize: 13, borderBottom: `1px solid ${COLORS.line}` };

const fmtDate = (s) => (s ? new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (d) => (d ? Math.round((new Date(d + "T12:00:00") - new Date(today() + "T12:00:00")) / 864e5) : null);
async function openFile(path) {
  try { window.open(await getAttachmentUrl(path), "_blank", "noopener"); } catch (e) { alert("Couldn't open the file: " + e.message); }
}
const folder = (id) => `staff-file/${id}`;

// ---------- Monthly payroll summary ----------

export function PayrollSummary() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.rpc("hr_payroll_month", { p_month: month + "-01" }).then(({ data, error }) => {
      setErr(error ? error.message : "");
      setRows(data || []);
    });
  }, [month]);

  function download() {
    const head = ["Name", "Days present", "Days late", "Minutes late", "Approved leave (days)", "Unauthorised absences (unpaid)", "Absences with accepted explanation", "Missing check-outs"];
    const lines = rows.map((r) => [r.full_name, r.days_present, r.days_late, r.minutes_late, r.leave_days, r.unauthorised_days, r.justified_days, r.missing_checkouts]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = `brightsteps-payroll-${month}.csv`;
    a.click();
  }

  return (
    <div>
      <div style={{ ...row, marginBottom: 12 }}>
        <input type="month" style={{ ...input, width: 180 }} value={month} onChange={(e) => setMonth(e.target.value)} />
        <button style={ghostBtn} onClick={download} disabled={!rows.length}>Download for payroll (CSV)</button>
      </div>
      <p style={{ ...small, marginBottom: 10 }}>From staff check-in and the Leave tab. Unauthorised absences are days absent without approved leave and without an accepted explanation.</p>
      {err && <p style={{ color: COLORS.bad }}>{err}</p>}
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Name</th><th style={th}>Present</th><th style={th}>Late</th><th style={th}>Min. late</th>
            <th style={th}>Leave</th><th style={th}>Unpaid</th><th style={th}>Justified</th><th style={th}>No check-out</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.staff_id}>
                <td style={{ ...td, fontWeight: 600 }}>{r.full_name}</td>
                <td style={td}>{r.days_present}</td>
                <td style={td}>{r.days_late}</td>
                <td style={td}>{r.minutes_late}</td>
                <td style={td}>{Number(r.leave_days)}</td>
                <td style={{ ...td, color: r.unauthorised_days ? COLORS.bad : undefined, fontWeight: r.unauthorised_days ? 600 : 400 }}>{r.unauthorised_days}</td>
                <td style={td}>{r.justified_days}</td>
                <td style={td}>{r.missing_checkouts}</td>
              </tr>
            ))}
            {!rows.length && <tr><td style={td} colSpan={8}>No attendance recorded for this month.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Policy signatures ----------

export function SignaturesOverview() {
  const [rows, setRows] = useState([]);
  useEffect(() => { supabase.rpc("hr_signatures").then(({ data }) => setRows(data || [])); }, []);
  const docs = [...new Map(rows.map((r) => [r.resource_id, r.resource_title])).entries()];
  const people = [...new Map(rows.map((r) => [r.staff_id, r.full_name])).entries()];
  const at = Object.fromEntries(rows.map((r) => [`${r.staff_id}|${r.resource_id}`, r.signed_at]));
  if (!docs.length) return <p style={{ ...card, ...small }}>No signed documents yet. Documents staff sign in Resources appear here.</p>;
  return (
    <div style={{ ...card, padding: 0, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Name</th>{docs.map(([id, t]) => <th key={id} style={th}>{t}</th>)}</tr></thead>
        <tbody>
          {people.map(([pid, name]) => (
            <tr key={pid}>
              <td style={{ ...td, fontWeight: 600 }}>{name}</td>
              {docs.map(([id]) => (
                <td key={id} style={td}>
                  {at[`${pid}|${id}`] ? <span style={pill("ok")}>Signed {fmtDate(at[`${pid}|${id}`])}</span> : <span style={pill("bad")}>Not signed</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Contract ----------

const CONTRACT_TYPES = [
  ["cdi", "CDI (permanent)"], ["cdd", "CDD (fixed term)"], ["trial", "Trial period"],
  ["part_time", "Part time"], ["consultant", "Consultant"], ["intern", "Intern"]
];
const CT = Object.fromEntries(CONTRACT_TYPES);

export function ContractCard({ staffId, canEdit }) {
  const [c, setC] = useState(null);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({});
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  async function load() {
    const { data } = await supabase.from("staff_contracts").select("*").eq("staff_id", staffId).order("start_date", { ascending: false }).limit(1);
    setC(data?.[0] || null);
  }
  useEffect(() => { load(); }, [staffId]);

  async function save() {
    setErr("");
    try {
      let up = null;
      if (file) up = await uploadAttachment(file, folder(staffId));
      const patch = {
        contract_type: f.contract_type || "cdd", job_title: f.job_title || null,
        start_date: f.start_date || null, end_date: f.end_date || null, trial_end: f.trial_end || null, note: f.note || null,
        ...(up ? { file_path: up.path, file_name: file.name } : {}), updated_at: new Date().toISOString()
      };
      const { error } = c
        ? await supabase.from("staff_contracts").update(patch).eq("id", c.id)
        : await supabase.from("staff_contracts").insert({ ...patch, staff_id: staffId });
      if (error) throw error;
      setEditing(false); setFile(null); load();
    } catch (e) { setErr(e.message); }
  }

  const left = daysUntil(c?.end_date);
  const trialLeft = daysUntil(c?.trial_end);
  return (
    <div style={card}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <p style={h3}>Contract</p>
        {canEdit && !editing && <button style={ghostBtn} onClick={() => { setF(c || { contract_type: "cdd" }); setEditing(true); }}>{c ? "Edit" : "Add contract"}</button>}
      </div>
      {!editing && !c && <p style={small}>No contract recorded.</p>}
      {!editing && c && (
        <>
          <p style={{ margin: 0, fontSize: 14 }}><strong>{CT[c.contract_type]}</strong>{c.job_title ? ` · ${c.job_title}` : ""}</p>
          <p style={small}>Started {fmtDate(c.start_date) || "date not set"}{c.end_date ? ` · ends ${fmtDate(c.end_date)}` : ""}{c.trial_end ? ` · trial period until ${fmtDate(c.trial_end)}` : ""}</p>
          <div style={{ ...row, marginTop: 6 }}>
            {left !== null && left <= 30 && left >= 0 && <span style={pill("warn")}>Ends in {left} days</span>}
            {left !== null && left < 0 && <span style={pill("bad")}>Ended {fmtDate(c.end_date)}</span>}
            {trialLeft !== null && trialLeft <= 30 && trialLeft >= 0 && <span style={pill("warn")}>Trial ends in {trialLeft} days</span>}
            {c.file_path && <button style={ghostBtn} onClick={() => openFile(c.file_path)}>Open contract</button>}
          </div>
          {c.note && <p style={{ ...small, marginTop: 6 }}>{c.note}</p>}
        </>
      )}
      {editing && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <div><span style={label}>Type</span>
              <select style={input} value={f.contract_type || "cdd"} onChange={(e) => setF({ ...f, contract_type: e.target.value })}>
                {CONTRACT_TYPES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select></div>
            <div><span style={label}>Job title</span><input style={input} value={f.job_title || ""} onChange={(e) => setF({ ...f, job_title: e.target.value })} placeholder="Kindergarten homeroom teacher" /></div>
            <div><span style={label}>Start date</span><input type="date" style={input} value={f.start_date || ""} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
            <div><span style={label}>End date (CDD)</span><input type="date" style={input} value={f.end_date || ""} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
            <div><span style={label}>Trial period ends</span><input type="date" style={input} value={f.trial_end || ""} onChange={(e) => setF({ ...f, trial_end: e.target.value })} /></div>
            <div><span style={label}>Signed contract (file)</span>
              <label style={{ ...ghostBtn, display: "flex", alignItems: "center" }}>{file ? file.name : c?.file_name || "Choose file"}<input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} /></label></div>
          </div>
          <span style={label}>Note</span><input style={input} value={f.note || ""} onChange={(e) => setF({ ...f, note: e.target.value })} />
          {err && <p style={{ color: COLORS.bad, fontSize: 13 }}>{err}</p>}
          <div style={{ ...row, marginTop: 10 }}><button style={primaryBtn} onClick={save}>Save</button><button style={ghostBtn} onClick={() => setEditing(false)}>Cancel</button></div>
        </>
      )}
    </div>
  );
}

// ---------- Documents and training ----------

const DOC_KINDS = [
  ["id", "ID / passport copy"], ["diploma", "Diploma"], ["criminal_record", "Criminal record certificate"],
  ["medical", "Medical fitness certificate"], ["cv", "CV"], ["reference", "Reference"], ["training", "Training certificate"], ["other", "Other"]
];
const DK = Object.fromEntries(DOC_KINDS);

export function DocumentsCard({ staffId, canEdit }) {
  const [docs, setDocs] = useState([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ kind: "training", title: "", issued_on: "", expires_on: "" });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  async function load() {
    const { data } = await supabase.from("staff_documents").select("*").eq("staff_id", staffId).order("created_at", { ascending: false });
    setDocs(data || []);
  }
  useEffect(() => { load(); }, [staffId]);

  async function add() {
    if (!f.title.trim()) return setErr("Give the document a name.");
    setErr("");
    try {
      let up = null;
      if (file) up = await uploadAttachment(file, folder(staffId));
      const { error } = await supabase.from("staff_documents").insert({
        staff_id: staffId, kind: f.kind, title: f.title.trim(), issued_on: f.issued_on || null, expires_on: f.expires_on || null,
        ...(up ? { file_path: up.path, file_name: file.name } : {})
      });
      if (error) throw error;
      setAdding(false); setFile(null); setF({ kind: "training", title: "", issued_on: "", expires_on: "" }); load();
    } catch (e) { setErr(e.message); }
  }
  async function remove(id) {
    if (!window.confirm("Delete this document?")) return;
    await supabase.from("staff_documents").delete().eq("id", id);
    load();
  }

  return (
    <div style={card}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <p style={h3}>Documents and training</p>
        {canEdit && !adding && <button style={ghostBtn} onClick={() => setAdding(true)}>Add document</button>}
      </div>
      {!docs.length && !adding && <p style={small}>No documents yet.</p>}
      {docs.map((d) => {
        const left = daysUntil(d.expires_on);
        return (
          <div key={d.id} style={{ ...row, justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${COLORS.line}` }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{d.title}</p>
              <p style={small}>{DK[d.kind]}{d.issued_on ? ` · issued ${fmtDate(d.issued_on)}` : ""}{d.expires_on ? ` · expires ${fmtDate(d.expires_on)}` : ""}</p>
            </div>
            <span style={row}>
              {left !== null && left < 0 && <span style={pill("bad")}>Expired</span>}
              {left !== null && left >= 0 && left <= 30 && <span style={pill("warn")}>Expires in {left} days</span>}
              {d.file_path && <button style={ghostBtn} onClick={() => openFile(d.file_path)}>Open</button>}
              {canEdit && <button style={{ ...ghostBtn, color: COLORS.bad }} onClick={() => remove(d.id)}>Delete</button>}
            </span>
          </div>
        );
      })}
      {adding && (
        <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <div><span style={label}>Type</span>
              <select style={input} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                {DOC_KINDS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
              </select></div>
            <div><span style={label}>Name</span><input style={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Safeguarding training" /></div>
            <div><span style={label}>Issued on</span><input type="date" style={input} value={f.issued_on} onChange={(e) => setF({ ...f, issued_on: e.target.value })} /></div>
            <div><span style={label}>Expires on (optional)</span><input type="date" style={input} value={f.expires_on} onChange={(e) => setF({ ...f, expires_on: e.target.value })} /></div>
          </div>
          <label style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", marginTop: 8 }}>{file ? file.name : "Attach file"}<input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
          {err && <p style={{ color: COLORS.bad, fontSize: 13 }}>{err}</p>}
          <div style={{ ...row, marginTop: 10 }}><button style={primaryBtn} onClick={add}>Save</button><button style={ghostBtn} onClick={() => setAdding(false)}>Cancel</button></div>
        </div>
      )}
    </div>
  );
}

// ---------- Leave balance ----------

export function LeaveBalanceCard({ staffId, canEdit }) {
  const [s, setS] = useState(null);
  const [taken, setTaken] = useState(0);
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState("");
  async function load() {
    const { data } = await supabase.from("staff_file_status").select("annual_leave_days, leave_year_start").eq("staff_id", staffId).maybeSingle();
    const st = data || { annual_leave_days: 26.4, leave_year_start: "2026-09-01" };
    setS(st);
    const t = await supabase.rpc("hr_leave_taken", { p_staff: staffId, p_from: st.leave_year_start || "2026-09-01" });
    setTaken(Number(t.data || 0));
  }
  useEffect(() => { load(); }, [staffId]);
  async function save() {
    const n = Number(days);
    if (!(n >= 0)) return;
    const { error } = await supabase.from("staff_file_status").upsert({ staff_id: staffId, annual_leave_days: n }, { onConflict: "staff_id" });
    if (error) return alert(error.message);
    setEditing(false); load();
  }
  if (!s) return null;
  const total = Number(s.annual_leave_days ?? 26.4);
  const left = Math.round((total - taken) * 10) / 10;
  return (
    <div style={card}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <p style={h3}>Annual leave</p>
        {canEdit && !editing && <button style={ghostBtn} onClick={() => { setDays(String(total)); setEditing(true); }}>Change entitlement</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {[["Entitlement", total], ["Taken", taken], ["Remaining", left]].map(([l, v]) => (
          <div key={l} style={{ background: COLORS.neutralBg, borderRadius: 10, padding: "8px 12px" }}>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>{l}</p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: l === "Remaining" && v < 0 ? COLORS.bad : COLORS.ink }}>{v}</p>
          </div>
        ))}
      </div>
      <p style={{ ...small, marginTop: 6 }}>Working days since {fmtDate(s.leave_year_start || "2026-09-01")}. Approved leave requests only. Legal minimum: 2.2 working days per month of service (26.4 a year).</p>
      {editing && (
        <div style={{ ...row, marginTop: 8 }}>
          <input type="number" step="0.5" style={{ ...input, width: 120 }} value={days} onChange={(e) => setDays(e.target.value)} />
          <button style={primaryBtn} onClick={save}>Save</button><button style={ghostBtn} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ---------- Onboarding ----------

export const ONBOARDING_ITEMS = [
  "Contract signed",
  "Copy of ID and diplomas received",
  "Criminal record certificate received",
  "Hub account created and password changed",
  "Staff Handbook and amendment signed",
  "Safeguarding briefing with the DSL",
  "Emergency lesson plans uploaded",
  "Staff check-in set up on phone",
  "Introduced to class and families"
];

export function OnboardingCard({ staffId, canEdit }) {
  const [done, setDone] = useState({});
  async function load() {
    const { data } = await supabase.from("staff_onboarding").select("item, done_at").eq("staff_id", staffId);
    setDone(Object.fromEntries((data || []).filter((d) => d.done_at).map((d) => [d.item, d.done_at])));
  }
  useEffect(() => { load(); }, [staffId]);
  async function toggle(item) {
    if (!canEdit) return;
    const { error } = await supabase.from("staff_onboarding").upsert({ staff_id: staffId, item, done_at: done[item] ? null : new Date().toISOString() });
    if (error) return alert(error.message);
    load();
  }
  const n = ONBOARDING_ITEMS.filter((i) => done[i]).length;
  return (
    <div style={card}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <p style={h3}>Onboarding checklist</p>
        <span style={pill(n === ONBOARDING_ITEMS.length ? "ok" : "neutral")}>{n} of {ONBOARDING_ITEMS.length}</span>
      </div>
      {ONBOARDING_ITEMS.map((item) => (
        <label key={item} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 14, cursor: canEdit ? "pointer" : "default" }}>
          <input type="checkbox" checked={!!done[item]} disabled={!canEdit} onChange={() => toggle(item)} />
          <span style={{ flex: 1 }}>{item}</span>
          {done[item] && <span style={small}>{fmtDate(done[item])}</span>}
        </label>
      ))}
    </div>
  );
}

export function SectionChips({ value, onChange, options }) {
  return (
    <div style={{ ...row, marginBottom: 12 }}>
      {options.map(([id, l]) => <button key={id} style={value === id ? chipOn : chip} onClick={() => onChange(id)}>{l}</button>)}
    </div>
  );
}

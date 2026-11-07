// Student records and withdrawals (Myri, 7 Nov 2026).
// - Print student record: a one-page summary for any child (profile, family, attendance, marks).
// - Withdraw: the admin takes a child off the active list without deleting anything. The full
//   Hub record is archived (student_archive) and the child is marked withdrawn (students.withdrawn_on),
//   which hides them from every class list and blocks publishing their report cards.
// - Withdrawn students: the admin sees past students, prints their record, or brings them back.
// Staff screens are English only.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { Modal, Field } from "./ui/common";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const longDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");
const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const monthName = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// Attendance of one child from the school data: { "2026-10-01": "present", ... }
export function attendanceOf(data, legacyId) {
  const out = {};
  Object.entries(data?.attendance || {}).forEach(([day, v]) => {
    if (v && typeof v === "object" && v[legacyId]) out[day] = v[legacyId];
  });
  return out;
}

async function marksOf(legacyId) {
  const st = await supabase.from("students").select("id").eq("legacy_id", legacyId).maybeSingle();
  if (!st.data) return [];
  const m = await supabase.from("gb_marks").select("assessment_id, points, letter, level, excused").eq("student_id", st.data.id);
  const ids = (m.data || []).map((x) => x.assessment_id);
  if (!ids.length) return [];
  const a = await supabase.from("gb_assessments").select("id, subject, title, assessed_on, max_points").in("id", ids);
  const byId = Object.fromEntries((a.data || []).map((x) => [x.id, x]));
  return (m.data || []).map((x) => {
    const as = byId[x.assessment_id] || {};
    const result = x.excused ? "Excused" : x.points != null ? `${Number(x.points)}${as.max_points ? ` / ${Number(as.max_points)}` : ""}` : x.letter || x.level || "—";
    return { date: as.assessed_on, subject: as.subject || "", title: as.title || "", result };
  }).sort((p, q) => String(p.date).localeCompare(String(q.date)));
}

// Prints a one-page student record (hidden frame, no pop-up). `withdrawn` = { date, note } or null.
export async function printStudentRecord({ student, attendance, withdrawn = null, logoUrl = "/logo.png" }) {
  const s = student || {};
  const marks = await marksOf(s.id);
  const days = Object.keys(attendance || {}).sort();
  const count = (k) => days.filter((d) => attendance[d] === k).length;
  const months = {};
  days.forEach((d) => { const m = (months[d.slice(0, 7)] = months[d.slice(0, 7)] || { present: 0, absent: 0, excused: 0 }); m[attendance[d]] = (m[attendance[d]] || 0) + 1; });
  const lastPresent = [...days].reverse().find((d) => attendance[d] === "present");
  const notPresent = days.filter((d) => attendance[d] !== "present");
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${v || "—"}</td></tr>`;
  const guardian = (n) => s[`guardian${n}Name`]
    ? row(s[`guardian${n}Relationship`] || `Guardian ${n}`, `${esc(s[`guardian${n}Name`])}<br><span class="muted">${esc([s[`guardian${n}Email`], s[`guardian${n}Phone`]].filter(Boolean).join(" · "))}</span>`)
    : "";
  const medical = [s.allergies && `Allergies: ${s.allergies}`, s.medicalConditions && `Medical: ${s.medicalConditions}`].filter(Boolean).join("<br>");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Student record — ${esc(s.name)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Work Sans", Arial, sans-serif; color: #241012; font-size: 10.5pt; line-height: 1.4; margin: 0; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #801524; padding-bottom: 8px; margin-bottom: 10px; }
  header img { width: 44px; height: 44px; object-fit: contain; }
  .school { font-weight: 700; color: #801524; }
  h1 { font-family: Fraunces, Georgia, serif; font-size: 19pt; font-weight: 600; margin: 4px 0 0; }
  h2 { font-size: 11.5pt; color: #801524; margin: 14px 0 4px; }
  .muted { color: #6B5A4E; font-size: 9.5pt; }
  .badge { display: inline-block; background: #FBF1F2; color: #801524; border-radius: 6px; padding: 2px 8px; font-size: 9.5pt; font-weight: 600; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 6px 4px 0; border-top: 1px solid #EFE6E0; vertical-align: top; }
  table.kv th { width: 34%; font-weight: 600; }
  table.grid th { background: #FBF7F4; font-size: 9.5pt; }
  footer { margin-top: 18px; font-size: 9pt; color: #6B5A4E; border-top: 1px solid #EFE6E0; padding-top: 6px; }
</style></head><body>
<header><img src="${esc(logoUrl.startsWith("http") ? logoUrl : window.location.origin + logoUrl)}" alt=""><div><div class="school">BrightSteps International School</div><div class="muted">Grand-Bassam · Student record</div></div></header>
<h1>${esc(s.name)}</h1>
${withdrawn ? `<span class="badge">Withdrawn · last day ${esc(longDate(withdrawn.date))}</span>` : `<span class="muted">Printed ${esc(longDate(todayIso()))}</span>`}
<h2>Student</h2>
<table class="kv">
${row("Student ID", esc(s.studentIdNumber))}${row("Date of birth", esc(longDate(s.dob)))}${row("Gender", esc(s.gender))}
${row("Nationality", esc((s.nationalities || []).join(", ") || s.nationality))}${row(withdrawn ? "Class when withdrawn" : "Class", esc(s.grade))}
${row("Enrolment date", s.enrollmentDate ? esc(longDate(s.enrollmentDate)) : "Not recorded")}${s.previousSchool ? row("Previous school", esc(s.previousSchool)) : ""}
${s.homeAddress ? row("Home address", esc(s.homeAddress)) : ""}${row("Medical / allergies", medical ? esc(medical).replace(/&lt;br&gt;/g, "<br>") : "None recorded")}
${withdrawn?.note ? row("Reason for leaving", esc(withdrawn.note)) : ""}
</table>
<h2>Family and contacts</h2>
<table class="kv">${guardian(1)}${guardian(2)}
${s.emergencyContactName ? row(`Emergency contact${s.emergencyContactRelationship ? ` (${s.emergencyContactRelationship})` : ""}`, esc([s.emergencyContactName, s.emergencyContactPhone].filter(Boolean).join(" · "))) : ""}</table>
<h2>Attendance</h2>
${days.length ? `<p style="margin:0 0 6px">${days.length} school days recorded, ${esc(longDate(days[0]))} to ${esc(longDate(days[days.length - 1]))}:
<b>${count("present")} present</b>, ${count("absent")} absent, ${count("excused")} excused.${lastPresent ? ` Last day present: ${esc(longDate(lastPresent))}.` : ""}</p>
<table class="grid"><tr><th>Month</th><th>Present</th><th>Absent</th><th>Excused</th></tr>
${Object.entries(months).map(([m, v]) => `<tr><td>${esc(monthName(m))}</td><td>${v.present || 0}</td><td>${v.absent || 0}</td><td>${v.excused || 0}</td></tr>`).join("")}</table>
${notPresent.length ? `<p class="muted" style="margin-top:6px">Days not present: ${notPresent.map((d) => `${esc(shortDate(d))} (${attendance[d] === "excused" ? "excused" : "absent"})`).join(", ")}.</p>` : ""}`
    : `<p class="muted" style="margin:0">No attendance recorded yet.</p>`}
<h2>Gradebook</h2>
${marks.length ? `<table class="grid"><tr><th>Date</th><th>Subject</th><th>Assessment</th><th>Result</th></tr>
${marks.map((m) => `<tr><td>${esc(m.date ? longDate(m.date) : "")}</td><td>${esc(m.subject)}</td><td>${esc(m.title)}</td><td>${esc(m.result)}</td></tr>`).join("")}</table>`
    : `<p class="muted" style="margin:0">No gradebook marks recorded.</p>`}
<footer>${withdrawn ? "This child was not deleted: the full record is kept on the Hub (Students → Withdrawn students) and can be brought back. " : ""}Confidential — for school use only.</footer>
</body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open(); doc.write(html); doc.close();
  const go = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 60 * 1000); };
  const img = doc.querySelector("img");
  if (img && !img.complete) { img.onload = go; img.onerror = go; } else { setTimeout(go, 50); }
}

// ---------------------------------------------------------------------------
// Withdraw dialog (admin)
// ---------------------------------------------------------------------------

export function WithdrawStudentModal({ student, data, persist, onClose, onDelete }) {
  const [lastDay, setLastDay] = useState(todayIso());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const withdraw = async () => {
    setBusy(true); setError("");
    const { error: e } = await supabase.rpc("withdraw_student", { p_legacy_id: student.id, p_last_day: lastDay, p_note: note || null });
    if (e) { setBusy(false); setError("Could not withdraw this student. Please try again."); return; }
    try {
      const ok = await persist({ ...data, students: data.students.filter((s) => s.id !== student.id) });
      if (ok === false) throw new Error("save failed");
      setDone(true);
    } catch {
      setError("The record was archived, but the list could not be saved. Please refresh the page and try again.");
    }
    setBusy(false);
  };

  if (done) {
    return (
      <Modal title="Student withdrawn" onClose={onClose}>
        <p>{student.name} is off the student list. Nothing was deleted: the full record is kept under <b>Withdrawn students</b>, where you can print it or bring {student.firstName || "them"} back.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="bsf-btn" onClick={() => printStudentRecord({ student, attendance: attendanceOf(data, student.id), withdrawn: { date: lastDay, note } })}>Print student record</button>
          <button className="bsf-btn bsf-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Withdraw ${student.name}`} onClose={onClose}>
      <p className="bsf-muted" style={{ marginTop: 0 }}>
        {student.name} will be taken off every class list and the student count. Nothing is deleted: profile, family details, attendance, marks, report cards and payments are all kept, and you can bring them back later.
      </p>
      <Field label="Last day at BrightSteps">
        <input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
      </Field>
      <Field label="Reason (optional, staff only)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Family moving abroad" />
      </Field>
      {error && <p className="bsf-formerror">{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button className="bsf-btn" disabled={busy || !lastDay} onClick={withdraw}>{busy ? "Working…" : "Withdraw student"}</button>
        <button className="bsf-btn bsf-btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
      {onDelete && (
        <p className="bsf-muted" style={{ marginTop: 16, fontSize: 13 }}>
          Added by mistake?{" "}
          <button type="button" onClick={onDelete} style={{ background: "none", border: "none", padding: 0, color: "inherit", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
            Delete this student instead
          </button>
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Withdrawn students (admin)
// ---------------------------------------------------------------------------

export function WithdrawnStudents({ data, persist }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: rows } = await supabase.from("student_archive")
      .select("legacy_id, full_name, grade, withdrawn_on, note, record, attendance").order("withdrawn_on", { ascending: false });
    setList(rows || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const bringBack = async (r) => {
    if (!window.confirm(`Bring ${r.full_name} back to the student list in ${r.grade}?`)) return;
    setBusy(true); setMsg("");
    try {
      if (!data.students.some((s) => s.id === r.legacy_id)) {
        const ok = await persist({ ...data, students: [...data.students, { ...r.record, id: r.legacy_id }] });
        if (ok === false) throw new Error("save failed");
      }
      const { error } = await supabase.rpc("restore_student", { p_legacy_id: r.legacy_id });
      if (error) throw error;
      setMsg(`${r.full_name} is back on the student list.`);
      load();
    } catch {
      setMsg("Could not bring this student back. Please refresh the page and try again.");
    }
    setBusy(false);
  };

  if (!list || !list.length) return null;
  return (
    <section className="bsf-card" style={{ marginTop: 18 }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", padding: 0, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", font: "inherit", color: "inherit" }}>
        <h2 style={{ margin: 0 }}>Withdrawn students · {list.length}</h2>
        <span className="bsf-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <p className="bsf-muted" style={{ marginTop: 0 }}>Not counted in the student list and hidden from classes. Their full record is kept.</p>
          {list.map((r) => (
            <div key={r.legacy_id} style={{ borderTop: "1px solid #EFE6E0", padding: "10px 0", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div style={{ flex: "1 1 200px" }}>
                <strong>{r.full_name}</strong>
                <p className="bsf-muted" style={{ margin: 0 }}>{r.grade} · last day {longDate(r.withdrawn_on)}{r.note ? ` · ${r.note}` : ""}</p>
              </div>
              <button className="bsf-btn bsf-btn-ghost" disabled={busy}
                onClick={() => printStudentRecord({ student: { ...r.record, id: r.legacy_id, name: r.record?.name || r.full_name, grade: r.grade }, attendance: r.attendance || {}, withdrawn: { date: r.withdrawn_on, note: r.note } })}>
                Print record
              </button>
              <button className="bsf-btn bsf-btn-ghost" disabled={busy} onClick={() => bringBack(r)}>Bring back</button>
            </div>
          ))}
          {msg && <p className={/Could not/.test(msg) ? "bsf-formerror" : "bsf-muted"}>{msg}</p>}
        </div>
      )}
    </section>
  );
}

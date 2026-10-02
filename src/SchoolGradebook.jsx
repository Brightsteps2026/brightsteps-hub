import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";

// Staff screen, English only.
// Gradebook backed by the gb_* tables (see gradebook-setup.sql).
//   Grade 3 to Grade 7: marks, term % (70% summative + 30% formative) and letter.
//   Admin sees and edits everything; teachers edit their own grades;
//   assistants (and a teacher's assistant grades) can only view.

const SCHOOL_YEAR = "2026-2027";
const UPPER = ["Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
const EARLY = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2"];
const ALL_GRADES = [...EARLY, ...UPPER];
const SUBJECTS = ["English Language Arts", "Math", "French", "Unit of Inquiry", "Art", "Music", "Physical Education"];

const BURGUNDY = "#801524";
const LINE = "#EAD7DA";
const MUTED = "#6E7B7D";
const INK = "#241012";

const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: "0 1px 3px rgba(36,16,18,0.06)" };
const chip = { border: `1px solid ${LINE}`, borderRadius: 100, padding: "7px 13px", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#3B4A4C", fontFamily: "inherit" };
const chipOn = { ...chip, background: BURGUNDY, borderColor: BURGUNDY, color: "#fff" };
const primaryBtn = { background: BURGUNDY, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const secondaryBtn = { ...chip, borderRadius: 10, padding: "9px 14px" };
const dangerBtn = { ...secondaryBtn, borderColor: "#F09595", color: "#A32D2D" };
const input = { width: "100%", padding: "9px 10px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, background: "#FCFAF4", boxSizing: "border-box", fontFamily: "inherit" };
const label = { display: "block", fontSize: 13, color: MUTED, margin: "12px 0 5px" };
const statLabel = { fontSize: 11, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" };
const statValue = { fontSize: 18, fontWeight: 700, marginTop: 4 };

const TONES = {
  A: { bg: "#E3F1EA", fg: "#1F6A4C" },
  B: { bg: "#E4EDF7", fg: "#2F5E8A" },
  C: { bg: "#FBF0D9", fg: "#7A5410" },
  D: { bg: "#FCE6D8", fg: "#8E4214" },
  F: { bg: "#FBE3E3", fg: "#A12E2E" }
};

const SCALE = [
  [97, "A+"], [93, "A"], [90, "A−"], [87, "B+"], [83, "B"], [80, "B−"],
  [77, "C+"], [73, "C"], [70, "C−"], [67, "D+"], [63, "D"], [60, "D−"]
];

function letterFor(pct) {
  if (pct == null) return null;
  for (const [min, l] of SCALE) if (pct >= min) return l;
  return "F";
}

function listOf(v) {
  return Array.isArray(v) ? v : [];
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function LetterChip({ letter }) {
  if (!letter) return <span style={{ color: MUTED }}>—</span>;
  const tone = TONES[letter.charAt(0)] || TONES.F;
  return (
    <span style={{ display: "inline-block", minWidth: 34, textAlign: "center", padding: "3px 8px", borderRadius: 100, fontSize: 13, fontWeight: 700, background: tone.bg, color: tone.fg }}>
      {letter}
    </span>
  );
}

// Works out formative %, summative % and the term grade for one student.
function termFor(studentId, assessments, marks) {
  let fp = 0, fm = 0, sp = 0, sm = 0;
  assessments.forEach((a) => {
    const m = marks[`${a.id}:${studentId}`];
    if (!m || m.points == null || m.excused) return;
    if (a.kind === "formative") { fp += Number(m.points); fm += Number(a.max_points); }
    else { sp += Number(m.points); sm += Number(a.max_points); }
  });
  const f = fm > 0 ? (100 * fp) / fm : null;
  const s = sm > 0 ? (100 * sp) / sm : null;
  const term = f != null && s != null ? Math.round(0.7 * s + 0.3 * f) : s != null ? Math.round(s) : f != null ? Math.round(f) : null;
  return { f: f == null ? null : Math.round(f), s: s == null ? null : Math.round(s), term, letter: letterFor(term) };
}

export default function SchoolGradebook({ profile }) {
  const role = profile?.role;
  const isAdmin = role === "admin";
  const assigned = listOf(profile?.grades_assigned);
  const assistantOf = listOf(profile?.assistant_grades);

  const editGrades = isAdmin ? ALL_GRADES : role === "teacher" ? assigned.filter((g) => !assistantOf.includes(g)) : [];
  const viewGrades = isAdmin
    ? ALL_GRADES
    : Array.from(new Set([...editGrades, ...assistantOf, ...(role === "learning_assistant" ? assigned : [])]));

  const myUpper = UPPER.filter((g) => viewGrades.includes(g));
  const myEarly = EARLY.filter((g) => viewGrades.includes(g));

  const [section, setSection] = useState(myUpper.length ? "academic" : myEarly.length ? "early" : "skills");

  if (viewGrades.length === 0) {
    return (
      <div style={{ padding: "16px 16px 90px" }}>
        <div style={card}>No class is assigned to your account yet. Please ask the school office to add your grades.</div>
      </div>
    );
  }

  const sections = [
    myUpper.length > 0 && { id: "academic", label: "Academic · Grade 3–7" },
    myEarly.length > 0 && { id: "early", label: "Observations · Pre-N–Grade 2" },
    { id: "skills", label: "ATL · SEL · Life skills" }
  ].filter(Boolean);

  return (
    <div style={{ padding: "16px 16px 90px", color: INK }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {sections.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} style={section === s.id ? chipOn : chip}>{s.label}</button>
        ))}
      </div>

      {section === "academic" && <AcademicGradebook grades={myUpper} editGrades={editGrades} />}
      {section !== "academic" && (
        <div style={card}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>
            {section === "early" ? "Observations (Pre-N to Grade 2)" : "ATL · SEL · Life skills"}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>This part of the gradebook is coming next.</p>
        </div>
      )}
    </div>
  );
}

function AcademicGradebook({ grades, editGrades }) {
  const [grade, setGrade] = useState(grades[0]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [term, setTerm] = useState(1);

  const [counts, setCounts] = useState({});
  const [usedSubjects, setUsedSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [marks, setMarks] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", kind: "formative", max_points: "", assessed_on: todayISO() });
  const [saving, setSaving] = useState(false);

  const canEdit = editGrades.includes(grade);

  // Student counts for the class buttons.
  useEffect(() => {
    supabase.from("students").select("grade").in("grade", grades).then(({ data }) => {
      const c = {};
      (data || []).forEach((s) => { c[s.grade] = (c[s.grade] || 0) + 1; });
      setCounts(c);
    });
  }, [grades.join("|")]);

  // Subjects already used in this grade (so nothing is ever hidden).
  useEffect(() => {
    supabase.from("gb_assessments").select("subject").eq("grade", grade).eq("school_year", SCHOOL_YEAR).then(({ data }) => {
      setUsedSubjects(Array.from(new Set((data || []).map((r) => r.subject))));
    });
  }, [grade]);

  async function load() {
    setLoading(true);
    setError("");
    const st = await supabase.from("students").select("id, full_name, grade").eq("grade", grade).order("full_name");
    if (st.error) { setError(st.error.message); setLoading(false); return; }
    const as = await supabase
      .from("gb_assessments")
      .select("id, title, kind, max_points, assessed_on, created_at")
      .eq("grade", grade).eq("subject", subject).eq("term", term).eq("school_year", SCHOOL_YEAR)
      .order("assessed_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (as.error) { setError(as.error.message); setLoading(false); return; }
    let m = {};
    const ids = (as.data || []).map((a) => a.id);
    if (ids.length) {
      const mk = await supabase.from("gb_marks").select("assessment_id, student_id, points, excused").in("assessment_id", ids);
      if (mk.error) { setError(mk.error.message); setLoading(false); return; }
      (mk.data || []).forEach((r) => { m[`${r.assessment_id}:${r.student_id}`] = r; });
    }
    setStudents(st.data || []);
    setAssessments(as.data || []);
    setMarks(m);
    setDrafts({});
    setLoading(false);
  }

  useEffect(() => { load(); setStatus(""); setFormOpen(false); }, [grade, subject, term]);

  const subjectList = useMemo(
    () => [...SUBJECTS, ...usedSubjects.filter((s) => !SUBJECTS.includes(s))],
    [usedSubjects]
  );

  const results = useMemo(() => {
    const r = {};
    students.forEach((s) => { r[s.id] = termFor(s.id, assessments, marks); });
    return r;
  }, [students, assessments, marks]);

  const withTerm = students.filter((s) => results[s.id]?.term != null);
  const classAvg = withTerm.length ? Math.round(withTerm.reduce((n, s) => n + results[s.id].term, 0) / withTerm.length) : null;
  const below70 = withTerm.filter((s) => results[s.id].term < 70).length;
  const nF = assessments.filter((a) => a.kind === "formative").length;
  const nS = assessments.length - nF;

  async function saveMark(a, studentId) {
    const key = `${a.id}:${studentId}`;
    if (!(key in drafts)) return;
    const raw = String(drafts[key]).trim().replace(",", ".");
    const before = marks[key]?.points ?? null;
    let points = null;
    if (raw !== "") {
      points = Number(raw);
      if (Number.isNaN(points) || points < 0 || points > Number(a.max_points)) {
        setStatus(`Marks for "${a.title}" must be between 0 and ${a.max_points}.`);
        setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
        return;
      }
    }
    if (points === (before == null ? null : Number(before))) {
      setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
      return;
    }
    const { error: err } = await supabase
      .from("gb_marks")
      .upsert({ assessment_id: a.id, student_id: studentId, points, excused: false }, { onConflict: "assessment_id,student_id" });
    if (err) { setStatus(`Not saved: ${err.message}`); return; }
    setMarks((m) => ({ ...m, [key]: { assessment_id: a.id, student_id: studentId, points, excused: false } }));
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
    setStatus("");
  }

  function openNew() {
    setEditingId(null);
    setForm({ title: "", kind: "formative", max_points: "", assessed_on: todayISO() });
    setFormOpen(true);
    setStatus("");
  }

  function openEdit(a) {
    if (!canEdit) return;
    setEditingId(a.id);
    setForm({ title: a.title, kind: a.kind, max_points: String(a.max_points), assessed_on: a.assessed_on || "" });
    setFormOpen(true);
    setStatus("");
  }

  async function saveAssessment() {
    const title = form.title.trim();
    const max = Number(String(form.max_points).replace(",", "."));
    if (!title) { setStatus("Give the assessment a name."); return; }
    if (!(max > 0)) { setStatus("Enter the total marks (for example 20)."); return; }
    if (editingId) {
      const highest = Object.values(marks).filter((m) => m.assessment_id === editingId && m.points != null).reduce((n, m) => Math.max(n, Number(m.points)), 0);
      if (max < highest) { setStatus(`Some marks are already higher than ${max}. Change those first.`); return; }
    }
    setSaving(true);
    const row = { title, kind: form.kind, max_points: max, assessed_on: form.assessed_on || null };
    const { error: err } = editingId
      ? await supabase.from("gb_assessments").update(row).eq("id", editingId)
      : await supabase.from("gb_assessments").insert({ ...row, grade, subject, term, school_year: SCHOOL_YEAR });
    setSaving(false);
    if (err) { setStatus(`Not saved: ${err.message}`); return; }
    setFormOpen(false);
    if (!usedSubjects.includes(subject)) setUsedSubjects((u) => [...u, subject]);
    load();
  }

  async function deleteAssessment() {
    const a = assessments.find((x) => x.id === editingId);
    if (!a) return;
    if (!window.confirm(`Delete "${a.title}" and all its marks? This cannot be undone.`)) return;
    const { error: err } = await supabase.from("gb_assessments").delete().eq("id", a.id);
    if (err) { setStatus(`Not deleted: ${err.message}`); return; }
    setFormOpen(false);
    load();
  }

  function downloadCsv() {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Student", ...assessments.map((a) => `${a.title} (${a.kind}, /${a.max_points})`), "Formative %", "Summative %", "Term %", "Letter"];
    const lines = [head.map(q).join(",")];
    students.forEach((s) => {
      const r = results[s.id];
      lines.push([
        s.full_name,
        ...assessments.map((a) => marks[`${a.id}:${s.id}`]?.points ?? ""),
        r.f ?? "", r.s ?? "", r.term ?? "", r.letter ?? ""
      ].map(q).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Gradebook ${grade} ${subject} Term ${term}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const th = { padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#3B4A4C", textAlign: "center", background: "#F7EEEF", borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", fontSize: 14, textAlign: "center", borderBottom: "1px solid #F1E4E6", whiteSpace: "nowrap" };
  const nameCell = { ...td, textAlign: "left", fontWeight: 600, position: "sticky", left: 0, background: "#fff", zIndex: 1, minWidth: 150 };

  return (
    <>
      <div style={card}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: MUTED }}>{grades.length > 1 ? "My classes" : "My class"}</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
          {grades.map((g) => (
            <button key={g} onClick={() => setGrade(g)} style={grade === g ? chipOn : chip}>
              {g}{counts[g] != null ? ` · ${counts[g]}` : ""}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13, color: MUTED, flex: "1 1 200px" }}>
            Subject
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...input, marginTop: 5 }}>
              {subjectList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 5 }}>Term</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3].map((t) => (
                <button key={t} onClick={() => setTerm(t)} style={term === t ? chipOn : chip}>Term {t}</button>
              ))}
            </div>
          </div>
        </div>
        {!canEdit && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#8A5A0B", background: "#FBF0DC", borderRadius: 8, padding: "8px 10px" }}>
            You can view this class but not change marks.
          </p>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={statLabel}>Weighting</div>
          <div style={{ ...statValue, fontSize: 15 }}>Summative 70% · Formative 30%</div>
        </div>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={statLabel}>Class average</div>
          <div style={statValue}>{classAvg == null ? "—" : `${classAvg}% · ${letterFor(classAvg)}`}</div>
        </div>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={statLabel}>Below 70%</div>
          <div style={{ ...statValue, color: below70 ? "#A12E2E" : INK }}>{below70} {below70 === 1 ? "student" : "students"}</div>
        </div>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={statLabel}>Assessments</div>
          <div style={statValue}>{nF} formative · {nS} summative</div>
        </div>
      </div>

      {formOpen && canEdit && (
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>{editingId ? "Edit assessment" : "New assessment"}</p>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{grade} · {subject} · Term {term}</p>
          <label style={label}>Name</label>
          <input style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Unit 1 test" />
          <label style={label}>Type</label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <button onClick={() => setForm({ ...form, kind: "formative" })} style={form.kind === "formative" ? chipOn : chip}>Formative (30%)</button>
            <button onClick={() => setForm({ ...form, kind: "summative" })} style={form.kind === "summative" ? chipOn : chip}>Summative (70%)</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <div>
              <label style={label}>Out of</label>
              <input style={input} inputMode="decimal" value={form.max_points} onChange={(e) => setForm({ ...form, max_points: e.target.value })} placeholder="20" />
            </div>
            <div>
              <label style={label}>Date</label>
              <input style={input} type="date" value={form.assessed_on} onChange={(e) => setForm({ ...form, assessed_on: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button style={primaryBtn} disabled={saving} onClick={saveAssessment}>{saving ? "Saving…" : "Save"}</button>
            <button style={secondaryBtn} onClick={() => setFormOpen(false)}>Cancel</button>
            {editingId && <button style={{ ...dangerBtn, marginLeft: "auto" }} onClick={deleteAssessment}>Delete</button>}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{grade} · {subject} · Term {term}</p>
          <div style={{ display: "flex", gap: 8 }}>
            {students.length > 0 && <button style={secondaryBtn} onClick={downloadCsv}>Download</button>}
            {canEdit && !formOpen && <button style={primaryBtn} onClick={openNew}>+ New assessment</button>}
          </div>
        </div>

        {status && <p style={{ margin: "0 0 10px", fontSize: 13, color: "#A12E2E" }}>{status}</p>}

        {loading ? (
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Loading…</p>
        ) : error ? (
          <p style={{ margin: 0, fontSize: 14, color: "#A12E2E" }}>Could not load: {error}</p>
        ) : students.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>No students in {grade}.</p>
        ) : (
          <>
            {assessments.length === 0 && (
              <p style={{ margin: "0 0 10px", fontSize: 14, color: MUTED }}>
                No assessments yet for this subject and term.{canEdit ? " Add one to start entering marks." : ""}
              </p>
            )}
            <div style={{ overflowX: "auto", border: `1px solid ${LINE}`, borderRadius: 12 }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", position: "sticky", left: 0, zIndex: 2 }}>Student</th>
                    {assessments.map((a) => (
                      <th key={a.id} style={th}>
                        {canEdit ? (
                          <button onClick={() => openEdit(a)} title="Edit assessment" style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 600, color: "#3B4A4C", cursor: "pointer", textDecoration: "underline dotted" }}>
                            {a.title}
                          </button>
                        ) : a.title}
                        <div style={{ fontWeight: 500, marginTop: 3, color: a.kind === "summative" ? BURGUNDY : "#2F5E8A" }}>
                          {a.kind === "summative" ? "Summative" : "Formative"} · /{Number(a.max_points)}
                        </div>
                      </th>
                    ))}
                    <th style={th}>Formative</th>
                    <th style={th}>Summative</th>
                    <th style={th}>Term</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const r = results[s.id];
                    return (
                      <tr key={s.id}>
                        <td style={nameCell}>{s.full_name}</td>
                        {assessments.map((a) => {
                          const key = `${a.id}:${s.id}`;
                          const saved = marks[key]?.points;
                          const value = key in drafts ? drafts[key] : saved == null ? "" : String(Number(saved));
                          return (
                            <td key={a.id} style={td}>
                              {canEdit ? (
                                <input
                                  aria-label={`${s.full_name}, ${a.title}`}
                                  inputMode="decimal"
                                  value={value}
                                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                                  onBlur={() => saveMark(a, s.id)}
                                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                                  style={{ width: 56, padding: "7px 6px", textAlign: "center", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: "#FCFAF4" }}
                                />
                              ) : (
                                <span>{value || "—"}</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ ...td, color: MUTED }}>{r.f == null ? "—" : `${r.f}%`}</td>
                        <td style={{ ...td, color: MUTED }}>{r.s == null ? "—" : `${r.s}%`}</td>
                        <td style={td}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <strong>{r.term == null ? "" : `${r.term}%`}</strong>
                            <LetterChip letter={r.letter} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: MUTED }}>
              Marks save when you leave the box. Leave a box empty if the work was not done yet; it is not counted.
              Scale: A+ 97–100 · A 93–96 · A− 90–92 · B+ 87–89 · B 83–86 · B− 80–82 · C+ 77–79 · C 73–76 · C− 70–72 · D+ 67–69 · D 63–66 · D− 60–62 · F below 60.
            </p>
          </>
        )}
      </div>
    </>
  );
}

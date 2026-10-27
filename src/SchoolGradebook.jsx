import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { COLORS, FONT, TONES, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, label, pill } from "./ui/tokens";
import { AssessmentTab } from "./screens/Assessment";
import EarlyYearsAssessment from "./EarlyYearsAssessment";
import { TermReportsStaff } from "./TermReports";
import { EY_GRADES } from "./data/earlyYears";

// Staff screen, English only.
// Gradebook backed by the gb_* tables (see gradebook-setup.sql and
// gradebook-types-letters-levels.sql).
//   Grade 3 to Grade 7: each assessment is graded with marks (e.g. 14/20) or a
//   letter (A+ ... F). Term % = 70% summative + 30% formative, then a letter.
//   A letter counts at the middle of its band (B+ = 88%).
//   Pre-N to Grade 2: the same grid with levels (Emerging, Developing,
//   Meeting, Exceeding); the term level is the one the child got most often.
//   Admin sees and edits everything; teachers edit their own grades;
//   assistants (and a teacher's assistant grades) can only view.

const SCHOOL_YEAR = "2026-2027";
const UPPER = ["Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
const EARLY = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2"];
const ALL_GRADES = [...EARLY, ...UPPER];
const SUBJECTS = ["English Language Arts", "Math", "French", "Unit of Inquiry", "Art", "Music", "Physical Education", "Swimming", "Technology"];
// Specials: graded with levels in every grade, and with a written appreciation
// (no levels) in Pre-N, PreK and Kindergarten.
const SPECIALS = ["Art", "Music", "Physical Education", "Swimming", "Technology"];
const COMMENT_GRADES = ["Pre-N", "PreK", "Kindergarten"];

const card = { ...cardToken, marginBottom: 14 };
const secondaryBtn = ghostBtn;
const dangerBtn = { ...ghostBtn, borderColor: "#F09595", color: COLORS.bad };
const statLabel = { fontSize: FONT.xs, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" };
const statValue = { fontSize: 18, fontWeight: 700, marginTop: 4 };

// Letter-grade badge tones (D keeps its own orange; no shared token for it).
const LETTER_TONES = {
  A: TONES.ok,
  B: TONES.brand,
  C: TONES.warn,
  D: { bg: "#FCE6D8", fg: "#8E4214" },
  F: TONES.bad
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

// Assessment types, and what each counts as by default (the teacher can change it).
const TYPES = [
  { id: "quiz", label: "Quiz", kind: "formative" },
  { id: "test", label: "Test", kind: "summative" },
  { id: "informal", label: "Informal assessment", kind: "formative" },
  { id: "project", label: "Project", kind: "summative" },
  { id: "presentation", label: "Presentation", kind: "summative" },
  { id: "homework", label: "Homework", kind: "formative" }
];
const typeLabel = (id) => TYPES.find((t) => t.id === id)?.label || "";

// Letters a teacher can give, and the % each one counts as (same as the database).
const LETTERS = ["A+", "A", "A−", "B+", "B", "B−", "C+", "C", "C−", "D+", "D", "D−", "F"];
const LETTER_POINTS = { "A+": 98, "A": 95, "A−": 91, "B+": 88, "B": 85, "B−": 81, "C+": 78, "C": 75, "C−": 71, "D+": 68, "D": 65, "D−": 61, "F": 55 };

// Early-years levels (Pre-N to Grade 2).
const LEVELS = [
  { id: "emerging", short: "E", label: "Emerging", tone: TONES.bad },
  { id: "developing", short: "D", label: "Developing", tone: TONES.warn },
  { id: "meeting", short: "M", label: "Meeting", tone: TONES.ok },
  { id: "exceeding", short: "Ex", label: "Exceeding", tone: TONES.info }
];
const levelOf = (id) => LEVELS.find((l) => l.id === id);

function shortDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NoteIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LevelChip({ level }) {
  const l = levelOf(level);
  if (!l) return <span style={{ color: COLORS.muted }}>—</span>;
  return (
    <span title={l.label} style={{ ...pill(l.tone), minWidth: 30, textAlign: "center", padding: "3px 8px", fontSize: 13, fontWeight: 700 }}>
      {l.short}
    </span>
  );
}

// The level a child got most often this term. A tie goes to the most recent one.
function termLevelFor(studentId, assessments, marks) {
  const count = {}, last = {};
  assessments.forEach((a, i) => {
    const lv = marks[`${a.id}:${studentId}`]?.level;
    if (!lv) return;
    count[lv] = (count[lv] || 0) + 1;
    last[lv] = i;
  });
  let best = null;
  Object.keys(count).forEach((lv) => {
    if (!best || count[lv] > count[best] || (count[lv] === count[best] && last[lv] > last[best])) best = lv;
  });
  return best;
}

function listOf(v) {
  return Array.isArray(v) ? v : [];
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function LetterChip({ letter }) {
  if (!letter) return <span style={{ color: COLORS.muted }}>—</span>;
  const tone = LETTER_TONES[letter.charAt(0)] || LETTER_TONES.F;
  return (
    <span style={{ ...pill(tone), minWidth: 34, textAlign: "center", padding: "3px 8px", fontSize: 13, fontWeight: 700 }}>
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

// The staff "Assessment" tab: gradebook, early-years levels, ATL · SEL · Life
// skills, and the older one-student-at-a-time notes (with Standards and Rubrics).
export default function SchoolGradebook({ profile, data, persist }) {
  const role = profile?.role;
  const isAdmin = role === "admin";
  const assigned = listOf(profile?.grades_assigned);
  const assistantOf = listOf(profile?.assistant_grades);

  const editGrades = isAdmin ? ALL_GRADES : role === "teacher" ? assigned.filter((g) => !assistantOf.includes(g)) : [];
  const viewGrades = isAdmin || role === "viewer"
    ? ALL_GRADES
    : Array.from(new Set([...editGrades, ...assistantOf, ...(role === "learning_assistant" ? assigned : [])]));

  const myUpper = UPPER.filter((g) => viewGrades.includes(g));
  const myEY = EY_GRADES.filter((g) => viewGrades.includes(g));
  const myEarly = EARLY.filter((g) => viewGrades.includes(g) && !EY_GRADES.includes(g));
  const myAll = ALL_GRADES.filter((g) => viewGrades.includes(g));
  const hasNotes = !!data && !!persist;

  // Youngest classes first.
  const sections = [
    myEY.length > 0 && { id: "ey", label: "Early years · Pre-N–KG" },
    myEarly.length > 0 && { id: "early", label: "Levels · Grade 1–2" },
    myUpper.length > 0 && { id: "academic", label: "Gradebook · Grade 3–7" },
    myAll.length > 0 && { id: "skills", label: "ATL · SEL · Life skills" },
    myAll.length > 0 && { id: "reports", label: "Report cards" },
    hasNotes && { id: "notes", label: "Student notes" }
  ].filter(Boolean);
  const [section, setSection] = useState(sections[0]?.id || "skills");

  return (
    <div style={{ padding: "16px 16px 90px", color: COLORS.ink }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {sections.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} style={section === s.id ? chipOn : chip}>{s.label}</button>
        ))}
      </div>

      {myAll.length === 0 && section !== "notes" && (
        <div style={card}>No class is assigned to your account yet. Please ask the school office to add your grades.</div>
      )}
      {section === "ey" && myEY.length > 0 && (
        <EarlyYearsAssessment grades={myEY} editGrades={editGrades} profile={profile} data={data} persist={persist} SubjectComments={SubjectComments} />
      )}
      {section === "reports" && myAll.length > 0 && <TermReportsStaff profile={profile} data={data} />}
      {section === "academic" && myUpper.length > 0 && <ClassGradebook key="academic" grades={myUpper} editGrades={editGrades} early={false} />}
      {section === "early" && myEarly.length > 0 && <ClassGradebook key="early" grades={myEarly} editGrades={editGrades} early />}
      {section === "skills" && myAll.length > 0 && <SkillsGradebook grades={myAll} editGrades={editGrades} />}
      {section === "notes" && hasNotes && (
        <div style={{ margin: "0 -16px" }}>
          <AssessmentTab data={data} persist={persist} profile={profile} />
        </div>
      )}
    </div>
  );
}

function ClassGradebook({ grades, editGrades, early: earlySection }) {
  const [grade, setGrade] = useState(grades[0]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [term, setTerm] = useState(1);

  // "early" below means: graded with levels (Pre-N to Grade 2, and specials in every grade).
  const isSpecial = SPECIALS.includes(subject);
  const early = earlySection || isSpecial;
  const appreciationOnly = earlySection && isSpecial && COMMENT_GRADES.includes(grade);
  // "marks" (the grid) or "comments" (one report-card line per child).
  const [view, setView] = useState("marks");
  const commentMode = appreciationOnly || view === "comments";

  const [counts, setCounts] = useState({});
  const [usedSubjects, setUsedSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [marks, setMarks] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const blankForm = () => ({ title: "", assess_type: "quiz", kind: "formative", grading: early ? "level" : "marks", max_points: "", assessed_on: todayISO(), shared: false });
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [canShare, setCanShare] = useState(true);
  const [justAdded, setJustAdded] = useState(null);

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
    const pickAssessments = (cols) => supabase
      .from("gb_assessments")
      .select(cols)
      .eq("grade", grade).eq("subject", subject).eq("term", term).eq("school_year", SCHOOL_YEAR)
      .order("assessed_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    let as = await pickAssessments("id, title, kind, max_points, assessed_on, created_at, assess_type, grading, shared_with_families");
    const sharingReady = !(as.error && /shared_with_families/.test(as.error.message));
    if (!sharingReady) as = await pickAssessments("id, title, kind, max_points, assessed_on, created_at, assess_type, grading");
    setCanShare(sharingReady);
    if (as.error) {
      setError(/assess_type|grading/.test(as.error.message)
        ? "The gradebook update hasn't been switched on yet. Please ask the office to run the latest gradebook script."
        : as.error.message);
      setLoading(false);
      return;
    }
    let m = {};
    const ids = (as.data || []).map((a) => a.id);
    if (ids.length) {
      const mk = await supabase.from("gb_marks").select("assessment_id, student_id, points, excused, letter, level, note").in("assessment_id", ids);
      if (mk.error) { setError(mk.error.message); setLoading(false); return; }
      (mk.data || []).forEach((r) => { m[`${r.assessment_id}:${r.student_id}`] = r; });
    }
    setStudents(st.data || []);
    setAssessments(as.data || []);
    setMarks(m);
    setDrafts({});
    setLoading(false);
  }

  useEffect(() => { load(); setStatus(""); setFormOpen(false); setJustAdded(null); }, [grade, subject, term]);

  useEffect(() => {
    if (!justAdded || loading) return;
    const box = document.querySelector(`[data-gb-col="${justAdded}"]`);
    if (box) { box.scrollIntoView({ block: "nearest", inline: "center" }); box.focus(); }
  }, [justAdded, loading]);

  const subjectList = useMemo(
    () => [...SUBJECTS, ...usedSubjects.filter((s) => !SUBJECTS.includes(s))],
    [usedSubjects]
  );

  const results = useMemo(() => {
    const r = {};
    students.forEach((s) => {
      r[s.id] = early ? { level: termLevelFor(s.id, assessments, marks) } : termFor(s.id, assessments, marks);
    });
    return r;
  }, [students, assessments, marks, early]);

  // Summary numbers
  const withTerm = students.filter((s) => results[s.id]?.term != null);
  const classAvg = withTerm.length ? Math.round(withTerm.reduce((n, s) => n + results[s.id].term, 0) / withTerm.length) : null;
  const below70 = withTerm.filter((s) => results[s.id].term < 70).length;
  const nF = assessments.filter((a) => a.kind === "formative").length;
  const nS = assessments.length - nF;
  const nEmerging = early ? students.filter((s) => results[s.id]?.level === "emerging").length : 0;
  const nMeetingUp = early ? students.filter((s) => ["meeting", "exceeding"].includes(results[s.id]?.level)).length : 0;

  function dropDraft(key) {
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
  }

  // Marks typed into a box (saved when the teacher leaves the box).
  async function saveMark(a, studentId) {
    const key = `${a.id}:${studentId}`;
    if (!(key in drafts)) return;
    const raw = String(drafts[key]).trim().replace(",", ".");
    const before = marks[key]?.points ?? null;
    let points = null;
    if (raw !== "") {
      points = Number(raw);
      if (Number.isNaN(points) || points < 0 || points > Number(a.max_points)) {
        setStatus(`Marks for "${a.title}" must be between 0 and ${Number(a.max_points)}.`);
        dropDraft(key);
        return;
      }
    }
    if (points === (before == null ? null : Number(before))) { dropDraft(key); return; }
    const { error: err } = await supabase
      .from("gb_marks")
      .upsert({ assessment_id: a.id, student_id: studentId, points, excused: false }, { onConflict: "assessment_id,student_id" });
    if (err) { setStatus(`Not saved: ${err.message}`); return; }
    setMarks((m) => ({ ...m, [key]: { ...(m[key] || {}), assessment_id: a.id, student_id: studentId, points, excused: false } }));
    dropDraft(key);
    setStatus("");
  }

  // A letter or a level picked from a list (saved straight away).
  async function savePick(a, studentId, value) {
    const key = `${a.id}:${studentId}`;
    const field = a.grading === "letter" ? "letter" : "level";
    const v = value || null;
    const row = { assessment_id: a.id, student_id: studentId, excused: false, [field]: v };
    const { error: err } = await supabase.from("gb_marks").upsert(row, { onConflict: "assessment_id,student_id" });
    if (err) { setStatus(`Not saved: ${err.message}`); return; }
    const points = field === "letter" && v ? LETTER_POINTS[v] : null;
    setMarks((m) => ({ ...m, [key]: { ...(m[key] || {}), ...row, points } }));
    setStatus("");
  }

  // A short comment for one child on one assessment (families see it once the assessment is shared).
  async function editNote(a, s) {
    const key = `${a.id}:${s.id}`;
    const before = marks[key]?.note || "";
    const next = window.prompt(`Comment for ${s.full_name} on "${a.title}" (families see it when the assessment is shared):`, before);
    if (next === null) return;
    const note = next.trim() || null;
    if ((note || "") === before) return;
    const { error: err } = await supabase.from("gb_marks")
      .upsert({ assessment_id: a.id, student_id: s.id, note }, { onConflict: "assessment_id,student_id" });
    if (err) { setStatus(`Comment not saved: ${err.message}`); return; }
    setMarks((m) => ({ ...m, [key]: { excused: false, ...(m[key] || {}), assessment_id: a.id, student_id: s.id, note } }));
    setStatus("");
  }

  const hasMarks = (id) => Object.values(marks).some((m) => m.assessment_id === id && (m.points != null || m.letter || m.level));

  function openNew() {
    setEditingId(null);
    setForm(blankForm());
    setFormOpen(true);
    setStatus("");
  }

  function openEdit(a) {
    if (!canEdit) return;
    setEditingId(a.id);
    setForm({
      title: a.title,
      assess_type: a.assess_type || "",
      kind: a.kind,
      grading: a.grading || (early ? "level" : "marks"),
      max_points: a.grading === "marks" || !a.grading ? String(Number(a.max_points)) : "",
      assessed_on: a.assessed_on || "",
      shared: !!a.shared_with_families
    });
    setFormOpen(true);
    setStatus("");
  }

  function pickType(id) {
    const t = TYPES.find((x) => x.id === id);
    setForm((f) => ({ ...f, assess_type: id, kind: early ? "formative" : t.kind }));
  }

  async function saveAssessment() {
    const title = form.title.trim();
    if (!title) { setStatus("Give the assessment a name."); return; }
    if (!form.assess_type) { setStatus("Choose the type of assessment."); return; }
    let max = 100;
    if (form.grading === "marks") {
      max = Number(String(form.max_points).replace(",", "."));
      if (!(max > 0)) { setStatus("Enter the total marks (for example 20)."); return; }
      if (editingId) {
        const highest = Object.values(marks).filter((m) => m.assessment_id === editingId && m.points != null).reduce((n, m) => Math.max(n, Number(m.points)), 0);
        if (max < highest) { setStatus(`Some marks are already higher than ${max}. Change those first.`); return; }
      }
    }
    setSaving(true);
    const row = {
      title,
      assess_type: form.assess_type,
      kind: early ? "formative" : form.kind,
      grading: form.grading,
      max_points: max,
      assessed_on: form.assessed_on || null,
      ...(canShare ? { shared_with_families: !!form.shared } : {})
    };
    const { data: savedRow, error: err } = editingId
      ? await supabase.from("gb_assessments").update(row).eq("id", editingId).select("id").maybeSingle()
      : await supabase.from("gb_assessments").insert({ ...row, grade, subject, term, school_year: SCHOOL_YEAR }).select("id").single();
    setSaving(false);
    if (err) { setStatus(`Not saved: ${err.message}`); return; }
    setFormOpen(false);
    if (!usedSubjects.includes(subject)) setUsedSubjects((u) => [...u, subject]);
    if (!editingId && savedRow?.id) setJustAdded(savedRow.id);
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

  // What a cell shows as text (for viewers and the download).
  function cellText(a, studentId) {
    const m = marks[`${a.id}:${studentId}`];
    if (!m) return "";
    if (a.grading === "letter") return m.letter || "";
    if (a.grading === "level") return levelOf(m.level)?.label || "";
    return m.points == null ? "" : String(Number(m.points));
  }

  function columnSub(a) {
    const parts = [];
    if (a.assess_type) parts.push(typeLabel(a.assess_type));
    if (!early) parts.push(a.kind === "summative" ? "Summative" : "Formative");
    if (a.assessed_on) parts.push(shortDate(a.assessed_on));
    if (!early) parts.push(a.grading === "letter" ? "Letter" : `/${Number(a.max_points)}`);
    return parts.join(" · ");
  }

  function downloadCsv() {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Student", ...assessments.map((a) => `${a.title} (${columnSub(a)})`),
      ...(early ? ["Term level"] : ["Formative %", "Summative %", "Term %", "Letter"])];
    const lines = [head.map(q).join(",")];
    students.forEach((s) => {
      const r = results[s.id];
      lines.push([
        s.full_name,
        ...assessments.map((a) => cellText(a, s.id)),
        ...(early ? [levelOf(r.level)?.label || ""] : [r.f ?? "", r.s ?? "", r.term ?? "", r.letter ?? ""])
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

  const th = { padding: "10px 8px", fontSize: 12, fontWeight: 600, color: COLORS.text2, textAlign: "center", background: "#F7EEEF", borderBottom: `1px solid ${COLORS.line}`, whiteSpace: "nowrap" };
  const td = { padding: "6px 8px", fontSize: 14, textAlign: "center", borderBottom: "1px solid #F1E4E6", whiteSpace: "nowrap" };
  const nameCell = { ...td, textAlign: "left", fontWeight: 600, position: "sticky", left: 0, background: "#fff", zIndex: 1, minWidth: 150 };
  const pickStyle = { ...input, width: 74, minHeight: 36, padding: "6px 4px", textAlign: "center" };
  const editing = editingId ? assessments.find((x) => x.id === editingId) : null;
  const gradingLocked = !!editing && hasMarks(editing.id);

  function renderCell(a, s) {
    const key = `${a.id}:${s.id}`;
    const m = marks[key];

    if (a.grading === "letter") {
      if (!canEdit) return m?.letter ? <LetterChip letter={m.letter} /> : <span style={{ color: COLORS.muted }}>—</span>;
      return (
        <select data-gb-col={a.id} aria-label={`${s.full_name}, ${a.title}`} value={m?.letter || ""} onChange={(e) => savePick(a, s.id, e.target.value)} style={pickStyle}>
          <option value="">—</option>
          {LETTERS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      );
    }

    if (a.grading === "level") {
      if (!canEdit) return <LevelChip level={m?.level} />;
      const lv = levelOf(m?.level);
      return (
        <select
          data-gb-col={a.id}
          aria-label={`${s.full_name}, ${a.title}`}
          value={m?.level || ""}
          onChange={(e) => savePick(a, s.id, e.target.value)}
          style={{ ...pickStyle, fontWeight: 700, ...(lv ? { background: lv.tone.bg, color: lv.tone.fg, borderColor: lv.tone.bg } : {}) }}
        >
          <option value="">—</option>
          {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.short} · {l.label}</option>)}
        </select>
      );
    }

    const saved = m?.points;
    const value = key in drafts ? drafts[key] : saved == null ? "" : String(Number(saved));
    if (!canEdit) return <span>{value || "—"}</span>;
    return (
      <input
        data-gb-col={a.id}
        aria-label={`${s.full_name}, ${a.title}`}
        placeholder={`/${Number(a.max_points)}`}
        inputMode="decimal"
        value={value}
        onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
        onBlur={() => saveMark(a, s.id)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        style={{ ...input, width: 56, minHeight: 36, padding: "7px 6px", textAlign: "center" }}
      />
    );
  }

  return (
    <>
      <div style={card}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: COLORS.muted }}>{grades.length > 1 ? "My classes" : "My class"}</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
          {grades.map((g) => (
            <button key={g} onClick={() => setGrade(g)} style={grade === g ? chipOn : chip}>
              {g}{counts[g] != null ? ` · ${counts[g]}` : ""}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ fontSize: 13, color: COLORS.muted, flex: "1 1 200px" }}>
            Subject
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...input, marginTop: 5 }}>
              {subjectList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 5 }}>Term</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3].map((t) => (
                <button key={t} onClick={() => setTerm(t)} style={term === t ? chipOn : chip}>Term {t}</button>
              ))}
            </div>
          </div>
        </div>
        {!appreciationOnly && (
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button onClick={() => setView("marks")} style={view === "marks" ? chipOn : chip}>{early ? "Levels" : "Marks"}</button>
            <button onClick={() => setView("comments")} style={view === "comments" ? chipOn : chip}>Report comments</button>
          </div>
        )}
        {!canEdit && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: COLORS.warn, background: COLORS.warnBg, borderRadius: 8, padding: "8px 10px" }}>
            You can view this class but not change marks.
          </p>
        )}
      </div>

      {commentMode ? (
        <SubjectComments grade={grade} subject={subject} term={term} canEdit={canEdit} oneLine={!appreciationOnly} />
      ) : (<>
      {early ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={statLabel}>Levels</div>
            <div style={{ ...statValue, fontSize: 14, fontWeight: 600 }}>E Emerging · D Developing · M Meeting · Ex Exceeding</div>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={statLabel}>Meeting or above</div>
            <div style={statValue}>{nMeetingUp} {nMeetingUp === 1 ? "student" : "students"}</div>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={statLabel}>Emerging</div>
            <div style={{ ...statValue, color: nEmerging ? COLORS.bad : COLORS.ink }}>{nEmerging} {nEmerging === 1 ? "student" : "students"}</div>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={statLabel}>Assessments</div>
            <div style={statValue}>{assessments.length}</div>
          </div>
        </div>
      ) : (
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
            <div style={{ ...statValue, color: below70 ? COLORS.bad : COLORS.ink }}>{below70} {below70 === 1 ? "student" : "students"}</div>
          </div>
          <div style={{ ...card, marginBottom: 0 }}>
            <div style={statLabel}>Assessments</div>
            <div style={statValue}>{nF} formative · {nS} summative</div>
          </div>
        </div>
      )}

      {formOpen && canEdit && (
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>{editingId ? "Edit assessment" : "New assessment"}</p>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>{grade} · {subject} · Term {term}</p>

          <label style={label}>Name</label>
          <input style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={early ? "e.g. Letter sounds check" : "e.g. Fractions quiz"} />

          <label style={label}>Type</label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => pickType(t.id)} style={form.assess_type === t.id ? chipOn : chip}>{t.label}</button>
            ))}
          </div>

          {!early && (
            <>
              <label style={label}>Counts as</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button onClick={() => setForm({ ...form, kind: "formative" })} style={form.kind === "formative" ? chipOn : chip}>Formative (30%)</button>
                <button onClick={() => setForm({ ...form, kind: "summative" })} style={form.kind === "summative" ? chipOn : chip}>Summative (70%)</button>
              </div>

              <label style={label}>How will you grade it?</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button disabled={gradingLocked} onClick={() => setForm({ ...form, grading: "marks" })} style={form.grading === "marks" ? chipOn : chip}>Marks (e.g. 14/20)</button>
                <button disabled={gradingLocked} onClick={() => setForm({ ...form, grading: "letter" })} style={form.grading === "letter" ? chipOn : chip}>Letter grade (A+ to F)</button>
              </div>
              {gradingLocked && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.muted }}>Marks are already entered, so this can't change. Make a new assessment instead.</p>
              )}
            </>
          )}

          <div style={{ display: "grid", gridTemplateColumns: !early && form.grading === "marks" ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: 10 }}>
            {!early && form.grading === "marks" && (
              <div>
                <label style={label}>Out of</label>
                <input style={input} inputMode="decimal" value={form.max_points} onChange={(e) => setForm({ ...form, max_points: e.target.value })} placeholder="20" />
              </div>
            )}
            <div>
              <label style={label}>Date</label>
              <input style={input} type="date" value={form.assessed_on} onChange={(e) => setForm({ ...form, assessed_on: e.target.value })} />
            </div>
          </div>

          {canShare ? (
            <label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 14, padding: 14, borderRadius: 12, background: COLORS.tint, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })}
                style={{ width: 22, height: 22, margin: 0, accentColor: COLORS.brand, flex: "0 0 auto" }} />
              <span>
                <span style={{ display: "block", fontWeight: 600, fontSize: 15 }}>Share with families</span>
                <span style={{ display: "block", fontSize: 13, color: COLORS.text2, marginTop: 3, lineHeight: 1.45 }}>
                  Parents see each child's result and your comment. Tick when all marks are checked. You can untick it later.
                </span>
              </span>
            </label>
          ) : (
            <p style={{ margin: "14px 0 0", fontSize: 12, color: COLORS.muted }}>Sharing with families isn't switched on yet. Please ask the office to run the latest gradebook script.</p>
          )}

          {status && <p style={{ margin: "10px 0 0", fontSize: 13, color: COLORS.bad }}>{status}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <button style={primaryBtn} disabled={saving} onClick={saveAssessment}>{saving ? "Saving…" : "Save"}</button>
            <button style={secondaryBtn} onClick={() => { setFormOpen(false); setStatus(""); }}>Cancel</button>
            {editingId && <button style={{ ...dangerBtn, marginLeft: "auto" }} onClick={deleteAssessment}>Delete</button>}
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{grade} · {subject} · Term {term}</p>
          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && !formOpen && <button style={primaryBtn} onClick={openNew}>+ New assessment</button>}
          </div>
        </div>

        {status && !formOpen && <p style={{ margin: "0 0 10px", fontSize: 13, color: COLORS.bad }}>{status}</p>}

        {loading ? (
          <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>Loading…</p>
        ) : error ? (
          <p style={{ margin: 0, fontSize: 14, color: COLORS.bad }}>Could not load: {error}</p>
        ) : students.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>No students in {grade}.</p>
        ) : (
          <>
            {assessments.length === 0 && (canEdit ? (
              <div style={{ margin: "0 0 12px", padding: 14, borderRadius: 12, background: COLORS.tint }}>
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>Enter {early ? "levels" : "grades"} right here, next to each student</p>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: COLORS.text2, lineHeight: 1.5 }}>
                  1. Add the assessment (name, type, date{early ? "" : ", marks or letter"}).<br />
                  2. A box appears next to every student's name. Type or pick each {early ? "level" : "grade"}; it saves by itself. Nothing to download or upload.
                </p>
                {!formOpen && <button style={primaryBtn} onClick={openNew}>+ Add the first assessment</button>}
              </div>
            ) : (
              <p style={{ margin: "0 0 10px", fontSize: 14, color: COLORS.muted }}>No assessments yet for this subject and term.</p>
            ))}
            <div style={{ overflowX: "auto", border: `1px solid ${COLORS.line}`, borderRadius: 12 }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", position: "sticky", left: 0, zIndex: 2 }}>Student</th>
                    {assessments.map((a) => (
                      <th key={a.id} style={th}>
                        {canEdit ? (
                          <button onClick={() => openEdit(a)} title="Edit assessment" style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 600, color: COLORS.text2, cursor: "pointer", textDecoration: "underline dotted" }}>
                            {a.title}
                          </button>
                        ) : a.title}
                        <div style={{ fontWeight: 500, marginTop: 3, color: !early && a.kind === "summative" ? COLORS.brand : COLORS.info }}>
                          {columnSub(a)}
                        </div>
                        {canShare && (
                          <div style={{ marginTop: 5 }}>
                            <span style={{ ...pill(a.shared_with_families ? TONES.ok : TONES.warn), fontSize: 11, padding: "2px 8px" }}>
                              {a.shared_with_families ? "Shared" : "Not shared yet"}
                            </span>
                          </div>
                        )}
                      </th>
                    ))}
                    {canEdit && (
                      <th style={{ ...th, background: "#fff" }}>
                        <button onClick={openNew} disabled={formOpen} title="Add another assessment"
                          style={{ ...secondaryBtn, minHeight: 34, padding: "5px 10px", fontSize: 12 }}>+ Add</button>
                      </th>
                    )}
                    {early ? (
                      <th style={th}>Term level</th>
                    ) : (
                      <>
                        <th style={th}>Formative</th>
                        <th style={th}>Summative</th>
                        <th style={th}>Term</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const r = results[s.id];
                    return (
                      <tr key={s.id}>
                        <td style={nameCell}>{s.full_name}</td>
                        {assessments.map((a) => (
                          <td key={a.id} style={a.id === justAdded ? { ...td, background: COLORS.tint } : td}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              {renderCell(a, s)}
                              {canEdit ? (
                                <button onClick={() => editNote(a, s)} aria-label={`Comment for ${s.full_name} on ${a.title}`}
                                  title={marks[`${a.id}:${s.id}`]?.note || "Add a comment"}
                                  style={{ background: "none", border: "none", padding: 6, cursor: "pointer", color: marks[`${a.id}:${s.id}`]?.note ? COLORS.brand : "#C9B5B8", display: "inline-flex" }}>
                                  <NoteIcon filled={!!marks[`${a.id}:${s.id}`]?.note} />
                                </button>
                              ) : marks[`${a.id}:${s.id}`]?.note ? (
                                <span title={marks[`${a.id}:${s.id}`].note} style={{ color: COLORS.brand, display: "inline-flex", padding: 6 }}><NoteIcon filled /></span>
                              ) : null}
                            </span>
                          </td>
                        ))}
                        {canEdit && <td style={{ ...td, background: "#FCFAFA" }} />}
                        {early ? (
                          <td style={td}><LevelChip level={r.level} /></td>
                        ) : (
                          <>
                            <td style={{ ...td, color: COLORS.muted }}>{r.f == null ? "—" : `${r.f}%`}</td>
                            <td style={{ ...td, color: COLORS.muted }}>{r.s == null ? "—" : `${r.s}%`}</td>
                            <td style={td}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <strong>{r.term == null ? "" : `${r.term}%`}</strong>
                                <LetterChip letter={r.letter} />
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {assessments.length > 0 && (
              <button onClick={downloadCsv} style={{ background: "none", border: "none", padding: 0, marginTop: 10, color: COLORS.muted, fontSize: 12, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
                Optional: save a copy as a spreadsheet
              </button>
            )}
            {early ? (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: COLORS.muted }}>
                Pick a level in each box; it saves straight away. Leave it empty if the child wasn't assessed yet.
                The term level is the level the child got most often this term (a tie goes to the most recent).
              </p>
            ) : (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: COLORS.muted }}>
                Marks save when you leave the box; letters save as soon as you pick one. Leave a box empty if the work was not done yet; it is not counted.
                A letter counts as the middle of its band (A+ 98 · A 95 · A− 91 · B+ 88 · B 85 · B− 81 · C+ 78 · C 75 · C− 71 · D+ 68 · D 65 · D− 61 · F 55).
                Scale: A+ 97–100 · A 93–96 · A− 90–92 · B+ 87–89 · B 83–86 · B− 80–82 · C+ 77–79 · C 73–76 · C− 70–72 · D+ 67–69 · D 63–66 · D− 60–62 · F below 60.
              </p>
            )}
          </>
        )}
      </div>
      </>)}
    </>
  );
}

// ---------- "Suggest a starter draft" (AI) ----------
// Collects one child's results for the term as plain text. No name or ID goes
// to the AI: the child is "STUDENT" and the first name is put back afterwards.
async function commentFacts(studentId, grade, term, subject) {
  let q = supabase.from("gb_assessments").select("id, title, subject, kind, grading, max_points, assess_type")
    .eq("grade", grade).eq("term", term).eq("school_year", SCHOOL_YEAR);
  if (subject) q = q.eq("subject", subject);
  const as = await q;
  if (as.error) throw as.error;
  const list = as.data || [];
  const marks = {};
  if (list.length) {
    const mk = await supabase.from("gb_marks").select("assessment_id, student_id, points, letter, level, excused")
      .eq("student_id", studentId).in("assessment_id", list.map((a) => a.id));
    if (mk.error) throw mk.error;
    (mk.data || []).forEach((m) => { marks[`${m.assessment_id}:${m.student_id}`] = m; });
  }
  const lines = [];
  const subjects = Array.from(new Set(list.map((a) => a.subject)));
  subjects.forEach((sub) => {
    const mine = list.filter((a) => a.subject === sub);
    const leveled = EARLY.includes(grade) || SPECIALS.includes(sub) || mine.some((a) => a.grading === "level");
    const overall = leveled
      ? levelOf(termLevelFor(studentId, mine, marks))?.label
      : termFor(studentId, mine, marks).letter;
    if (!overall && !subject) return;
    lines.push(`${sub}: overall ${overall ? (leveled ? overall : "grade band " + overall.charAt(0)) : "not assessed yet"}`);
    if (subject) {
      mine.forEach((a) => {
        const m = marks[`${a.id}:${studentId}`];
        if (!m || m.excused) return;
        const r = m.level ? levelOf(m.level)?.label : m.letter ? "band " + m.letter.charAt(0)
          : m.points != null && a.max_points ? Math.round((100 * m.points) / a.max_points) >= 80 ? "strong" : Math.round((100 * m.points) / a.max_points) >= 65 ? "secure" : "still developing" : null;
        if (r) lines.push(`- ${a.title || typeLabel(a.assess_type) || "Assessment"}${a.assess_type ? " (" + typeLabel(a.assess_type) + ")" : ""}: ${r}`);
      });
    }
  });
  if (!subject) {
    const [sk, rt] = await Promise.all([
      supabase.from("gb_skills").select("id, area, name_en").eq("active", true).order("sort"),
      supabase.from("gb_skill_ratings").select("skill_id, rating").eq("student_id", studentId).eq("term", term).eq("school_year", SCHOOL_YEAR)
    ]);
    const byId = {};
    (sk.data || []).forEach((k) => { byId[k.id] = k; });
    const rated = (rt.data || []).filter((r) => byId[r.skill_id]);
    if (rated.length) {
      lines.push("Approaches to learning, social-emotional and life skills:");
      rated.forEach((r) => lines.push(`- ${byId[r.skill_id].name_en}: ${RATINGS.find((x) => x.id === r.rating)?.label || r.rating}`));
    }
  }
  return lines.join("\n");
}

function SuggestDraft({ kind, grade, term, subject, student, current, onDraft }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    if (busy) return;
    if ((current || "").trim() && !window.confirm("Replace what is in the box with a new starter draft? Your words will be used as notes for it.")) return;
    setBusy(true); setErr("");
    try {
      const first = (student.full_name || "").trim().split(/\s+/)[0] || "Your child";
      const facts = await commentFacts(student.id, grade, term, subject);
      const notes = (current || "").split(first).join("STUDENT");
      const { data: res, error } = await supabase.functions.invoke("suggest-comment", { body: { kind, grade, term, subject, facts, current: notes } });
      if (error || res?.error || !res?.draft) throw new Error(res?.error || error?.message || "No draft came back.");
      onDraft(res.draft.replace(/STUDENT/g, first));
    } catch (e) {
      setErr("Couldn't make a draft. " + (e?.message || ""));
    }
    setBusy(false);
  }
  return (
    <div style={{ marginTop: 4 }}>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={go} disabled={busy}
        style={{ background: "none", border: "none", padding: 0, color: COLORS.brand, fontSize: 13, cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>
        {busy ? "Writing a draft…" : "Suggest a starter draft"}
      </button>
      {err && <span style={{ marginLeft: 8, fontSize: 12, color: COLORS.bad }}>{err}</span>}
    </div>
  );
}

// Pre-N, PreK and Kindergarten specials: one written appreciation per child,
// per subject and term (no levels).
function SubjectComments({ grade, subject, term, canEdit, oneLine = false }) {
  const [students, setStudents] = useState([]);
  const [comments, setComments] = useState({});
  const [drafts, setDrafts] = useState({});
  const [aiDrafts, setAiDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(""); setStatus(""); setDrafts({}); setAiDrafts({});
      const st = await supabase.from("students").select("id, full_name").eq("grade", grade).order("full_name");
      if (st.error) { if (alive) { setError(st.error.message); setLoading(false); } return; }
      const ids = (st.data || []).map((x) => x.id);
      let c = {};
      if (ids.length) {
        const cm = await supabase.from("gb_subject_comments").select("student_id, comment")
          .in("student_id", ids).eq("subject", subject).eq("term", term).eq("school_year", SCHOOL_YEAR);
        if (cm.error) {
          if (alive) {
            setError(/gb_subject_comments/.test(cm.error.message)
              ? "Appreciations aren't switched on yet. Please ask the office to run the latest gradebook script."
              : cm.error.message);
            setLoading(false);
          }
          return;
        }
        (cm.data || []).forEach((r) => { c[r.student_id] = r.comment || ""; });
      }
      if (alive) { setStudents(st.data || []); setComments(c); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [grade, subject, term]);

  async function save(studentId) {
    if (!(studentId in drafts)) return;
    const text = drafts[studentId].trim();
    if (text === (comments[studentId] || "")) {
      setDrafts((d) => { const n = { ...d }; delete n[studentId]; return n; });
      return;
    }
    const { error: err } = await supabase.from("gb_subject_comments").upsert(
      { student_id: studentId, school_year: SCHOOL_YEAR, term, subject, comment: text || null },
      { onConflict: "student_id,school_year,term,subject" }
    );
    if (err) { setStatus(`Not saved: ${err.message}`); return; }
    setComments((c) => ({ ...c, [studentId]: text }));
    setDrafts((d) => { const n = { ...d }; delete n[studentId]; return n; });
    setStatus("");
  }

  const done = students.filter((s) => (comments[s.id] || "").trim()).length;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{grade} · {subject} · Term {term} · {oneLine ? "Report comment" : "Appreciation"}</p>
        {!loading && !error && <span style={{ fontSize: 13, color: COLORS.muted }}>{done} of {students.length} written</span>}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: COLORS.muted }}>
        {oneLine
          ? "One sentence per child for the report card: what they do well in this subject, or what comes next. It saves when you leave the box."
          : "2–3 sentences per child: what they enjoy, a skill they have shown, and one thing to work on next. It saves when you leave the box."}
      </p>
      {status && <p style={{ margin: "0 0 10px", fontSize: 13, color: COLORS.bad }}>{status}</p>}
      {loading ? (
        <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>Loading…</p>
      ) : error ? (
        <p style={{ margin: 0, fontSize: 14, color: COLORS.bad }}>Could not load: {error}</p>
      ) : students.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>No students in {grade}.</p>
      ) : (
        students.map((s) => {
          const value = s.id in drafts ? drafts[s.id] : comments[s.id] || "";
          return (
            <div key={s.id} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "10px 0" }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }} htmlFor={`cm-${s.id}`}>{s.full_name}</label>
              {canEdit ? (
                <textarea
                  id={`cm-${s.id}`}
                  rows={oneLine ? 2 : 3}
                  value={value}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                  onBlur={() => save(s.id)}
                  placeholder={oneLine ? "e.g. Explains her reasoning clearly in multi-step problems." : "e.g. Ama loves singing and now keeps the beat with the class. Next, she will work on singing in a small group."}
                  style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
                />
              ) : null}
              {canEdit && (
                <>
                  {aiDrafts[s.id] && s.id in drafts && <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.warn }}>Starter draft: read it, change what you need, then click outside the box to save it.</p>}
                  <SuggestDraft kind={oneLine ? "line" : "appreciation"} grade={grade} term={term} subject={subject} student={s} current={value}
                    onDraft={(text) => { setDrafts((d) => ({ ...d, [s.id]: text })); setAiDrafts((a) => ({ ...a, [s.id]: true })); }} />
                </>
              )}
              {canEdit ? null : (
                <p style={{ margin: 0, fontSize: 14, color: value ? COLORS.ink : COLORS.muted }}>{value || "Not written yet."}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ATL · SEL · Life skills: each child rated Rarely / Sometimes / Usually /
// Consistently on every skill, per term, plus one general comment per term.
const RATINGS = [
  { id: "rarely", short: "R", label: "Rarely", tone: TONES.bad },
  { id: "sometimes", short: "S", label: "Sometimes", tone: TONES.warn },
  { id: "usually", short: "U", label: "Usually", tone: TONES.ok },
  { id: "consistently", short: "C", label: "Consistently", tone: TONES.info }
];
const AREAS = [
  { id: "atl", label: "ATL" },
  { id: "sel", label: "SEL" },
  { id: "life", label: "Life skills" },
  { id: "comment", label: "General comment" }
];

function SkillsGradebook({ grades, editGrades }) {
  const [grade, setGrade] = useState(grades[0]);
  const [term, setTerm] = useState(1);
  const [area, setArea] = useState("atl");
  const [skills, setSkills] = useState([]);
  const [students, setStudents] = useState([]);
  const [ratings, setRatings] = useState({});
  const [notes, setNotes] = useState({});
  const [drafts, setDrafts] = useState({});
  const [aiDrafts, setAiDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const canEdit = editGrades.includes(grade);

  useEffect(() => {
    supabase.from("gb_skills").select("id, area, name_en, sort").eq("active", true).order("sort")
      .then(({ data, error: err }) => { if (err) setError(err.message); else setSkills(data || []); });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(""); setStatus(""); setDrafts({}); setAiDrafts({});
      const st = await supabase.from("students").select("id, full_name").eq("grade", grade).order("full_name");
      if (st.error) { if (alive) { setError(st.error.message); setLoading(false); } return; }
      const ids = (st.data || []).map((x) => x.id);
      const r = {}, n = {};
      if (ids.length) {
        const [rt, nt] = await Promise.all([
          supabase.from("gb_skill_ratings").select("student_id, skill_id, rating").in("student_id", ids).eq("term", term).eq("school_year", SCHOOL_YEAR),
          supabase.from("gb_term_notes").select("student_id, note").in("student_id", ids).eq("term", term).eq("school_year", SCHOOL_YEAR)
        ]);
        const err = rt.error || nt.error;
        if (err) { if (alive) { setError(err.message); setLoading(false); } return; }
        (rt.data || []).forEach((x) => { r[`${x.student_id}:${x.skill_id}`] = x.rating; });
        (nt.data || []).forEach((x) => { n[x.student_id] = x.note || ""; });
      }
      if (alive) { setStudents(st.data || []); setRatings(r); setNotes(n); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [grade, term]);

  const areaSkills = skills.filter((k) => k.area === area);

  async function saveRating(studentId, skillId, value) {
    const key = `${studentId}:${skillId}`;
    const { error: err } = value
      ? await supabase.from("gb_skill_ratings").upsert(
          { student_id: studentId, skill_id: skillId, school_year: SCHOOL_YEAR, term, rating: value },
          { onConflict: "student_id,skill_id,school_year,term" })
      : await supabase.from("gb_skill_ratings").delete()
          .eq("student_id", studentId).eq("skill_id", skillId).eq("school_year", SCHOOL_YEAR).eq("term", term);
    if (err) { setStatus(`Not saved: ${err.message}`); return; }
    setRatings((r) => { const n = { ...r }; if (value) n[key] = value; else delete n[key]; return n; });
    setStatus("");
  }

  async function saveNote(studentId) {
    if (!(studentId in drafts)) return;
    const text = drafts[studentId].trim();
    if (text === (notes[studentId] || "")) {
      setDrafts((d) => { const n = { ...d }; delete n[studentId]; return n; });
      return;
    }
    const { error: err } = await supabase.from("gb_term_notes").upsert(
      { student_id: studentId, school_year: SCHOOL_YEAR, term, note: text || null },
      { onConflict: "student_id,school_year,term" });
    if (err) { setStatus(`Not saved: ${err.message}`); return; }
    setNotes((c) => ({ ...c, [studentId]: text }));
    setDrafts((d) => { const n = { ...d }; delete n[studentId]; return n; });
    setStatus("");
  }

  const totalCells = students.length * areaSkills.length;
  const doneCells = students.reduce((n, s) => n + areaSkills.filter((k) => ratings[`${s.id}:${k.id}`]).length, 0);
  const doneNotes = students.filter((s) => (notes[s.id] || "").trim()).length;
  const areaLabel = AREAS.find((a) => a.id === area)?.label;

  const th = { padding: "10px 8px", fontSize: 12, fontWeight: 600, color: COLORS.text2, textAlign: "center", background: "#F7EEEF", borderBottom: `1px solid ${COLORS.line}` };
  const td = { padding: "6px 8px", fontSize: 14, textAlign: "center", borderBottom: "1px solid #F1E4E6", whiteSpace: "nowrap" };
  const nameCell = { ...td, textAlign: "left", fontWeight: 600, position: "sticky", left: 0, background: "#fff", zIndex: 1, minWidth: 150 };

  return (
    <>
      <div style={card}>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: COLORS.muted }}>{grades.length > 1 ? "My classes" : "My class"}</p>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
          {grades.map((g) => <button key={g} onClick={() => setGrade(g)} style={grade === g ? chipOn : chip}>{g}</button>)}
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 5 }}>Term</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[1, 2, 3].map((t) => <button key={t} onClick={() => setTerm(t)} style={term === t ? chipOn : chip}>Term {t}</button>)}
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 5 }}>Area</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {AREAS.map((a) => <button key={a.id} onClick={() => setArea(a.id)} style={area === a.id ? chipOn : chip}>{a.label}</button>)}
        </div>
        {!canEdit && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: COLORS.warn, background: COLORS.warnBg, borderRadius: 8, padding: "8px 10px" }}>
            You can view this class but not change ratings.
          </p>
        )}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{grade} · {areaLabel} · Term {term}</p>
          {!loading && !error && (
            <span style={{ fontSize: 13, color: COLORS.muted }}>
              {area === "comment" ? `${doneNotes} of ${students.length} written` : `${doneCells} of ${totalCells} rated`}
            </span>
          )}
        </div>
        {status && <p style={{ margin: "0 0 10px", fontSize: 13, color: COLORS.bad }}>{status}</p>}

        {loading ? (
          <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>Loading…</p>
        ) : error ? (
          <p style={{ margin: 0, fontSize: 14, color: COLORS.bad }}>Could not load: {error}</p>
        ) : students.length === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>No students in {grade}.</p>
        ) : area === "comment" ? (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: COLORS.muted }}>
              The general comment for the report card: how the child is doing overall this term and one next step. It saves when you leave the box.
            </p>
            {students.map((s) => {
              const value = s.id in drafts ? drafts[s.id] : notes[s.id] || "";
              return (
                <div key={s.id} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "10px 0" }}>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }} htmlFor={`tn-${s.id}`}>{s.full_name}</label>
                  {canEdit ? (
                    <textarea
                      id={`tn-${s.id}`}
                      rows={3}
                      value={value}
                      onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                      onBlur={() => saveNote(s.id)}
                      style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
                    />
                  ) : null}
                  {canEdit && (
                    <>
                      {aiDrafts[s.id] && s.id in drafts && <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.warn }}>Starter draft: read it, change what you need, then click outside the box to save it.</p>}
                      <SuggestDraft kind="general" grade={grade} term={term} subject={null} student={s} current={value}
                        onDraft={(text) => { setDrafts((d) => ({ ...d, [s.id]: text })); setAiDrafts((a) => ({ ...a, [s.id]: true })); }} />
                    </>
                  )}
                  {canEdit ? null : (
                    <p style={{ margin: 0, fontSize: 14, color: value ? COLORS.ink : COLORS.muted }}>{value || "Not written yet."}</p>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <>
            <div style={{ overflowX: "auto", border: `1px solid ${COLORS.line}`, borderRadius: 12 }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", position: "sticky", left: 0, zIndex: 2 }}>Student</th>
                    {areaSkills.map((k) => <th key={k.id} style={th}>{k.name_en}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td style={nameCell}>{s.full_name}</td>
                      {areaSkills.map((k) => {
                        const v = ratings[`${s.id}:${k.id}`];
                        const r = RATINGS.find((x) => x.id === v);
                        if (!canEdit) {
                          return (
                            <td key={k.id} style={td}>
                              {r ? <span title={r.label} style={{ ...pill(r.tone), minWidth: 26, textAlign: "center", padding: "3px 8px", fontSize: 13, fontWeight: 700 }}>{r.short}</span>
                                 : <span style={{ color: COLORS.muted }}>—</span>}
                            </td>
                          );
                        }
                        return (
                          <td key={k.id} style={td}>
                            <select
                              aria-label={`${s.full_name}, ${k.name_en}`}
                              value={v || ""}
                              onChange={(e) => saveRating(s.id, k.id, e.target.value)}
                              style={{ ...input, width: 74, minHeight: 36, padding: "6px 4px", textAlign: "center", fontWeight: 700,
                                ...(r ? { background: r.tone.bg, color: r.tone.fg, borderColor: r.tone.bg } : {}) }}
                            >
                              <option value="">—</option>
                              {RATINGS.map((x) => <option key={x.id} value={x.id}>{x.short} · {x.label}</option>)}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: COLORS.muted }}>
              R Rarely · S Sometimes · U Usually · C Consistently. Saves as soon as you pick.
            </p>
          </>
        )}
      </div>
    </>
  );
}

// Shared with the term report cards (TermReports.jsx).
export { SCHOOL_YEAR, EARLY, SUBJECTS, SPECIALS, COMMENT_GRADES, termFor, termLevelFor };

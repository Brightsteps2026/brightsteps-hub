import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { COLORS, FONT, TONES, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, label, pill } from "./ui/tokens";

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
    myEarly.length > 0 && { id: "early", label: "Levels · Pre-N–Grade 2" },
    { id: "skills", label: "ATL · SEL · Life skills" }
  ].filter(Boolean);

  return (
    <div style={{ padding: "16px 16px 90px", color: COLORS.ink }}>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        {sections.map((s) => (
          <button key={s.id} onClick={() => setSection(s.id)} style={section === s.id ? chipOn : chip}>{s.label}</button>
        ))}
      </div>

      {section === "academic" && <ClassGradebook key="academic" grades={myUpper} editGrades={editGrades} early={false} />}
      {section === "early" && <ClassGradebook key="early" grades={myEarly} editGrades={editGrades} early />}
      {section === "skills" && (
        <div style={card}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>ATL · SEL · Life skills</p>
          <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>This part of the gradebook is coming next.</p>
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
  const commentMode = earlySection && isSpecial && COMMENT_GRADES.includes(grade);

  const [counts, setCounts] = useState({});
  const [usedSubjects, setUsedSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [marks, setMarks] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const blankForm = () => ({ title: "", assess_type: "quiz", kind: "formative", grading: early ? "level" : "marks", max_points: "", assessed_on: todayISO() });
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
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
      .select("id, title, kind, max_points, assessed_on, created_at, assess_type, grading")
      .eq("grade", grade).eq("subject", subject).eq("term", term).eq("school_year", SCHOOL_YEAR)
      .order("assessed_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
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
      const mk = await supabase.from("gb_marks").select("assessment_id, student_id, points, excused, letter, level").in("assessment_id", ids);
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
    setMarks((m) => ({ ...m, [key]: { assessment_id: a.id, student_id: studentId, points, excused: false } }));
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
    setMarks((m) => ({ ...m, [key]: { ...row, points } }));
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
      assessed_on: a.assessed_on || ""
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
      assessed_on: form.assessed_on || null
    };
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
        <select aria-label={`${s.full_name}, ${a.title}`} value={m?.letter || ""} onChange={(e) => savePick(a, s.id, e.target.value)} style={pickStyle}>
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
        aria-label={`${s.full_name}, ${a.title}`}
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
        {!canEdit && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: COLORS.warn, background: COLORS.warnBg, borderRadius: 8, padding: "8px 10px" }}>
            You can view this class but not change marks.
          </p>
        )}
      </div>

      {commentMode ? (
        <SubjectComments grade={grade} subject={subject} term={term} canEdit={canEdit} />
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
            {students.length > 0 && <button style={secondaryBtn} onClick={downloadCsv}>Download</button>}
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
            {assessments.length === 0 && (
              <p style={{ margin: "0 0 10px", fontSize: 14, color: COLORS.muted }}>
                No assessments yet for this subject and term.{canEdit ? " Add one to start entering marks." : ""}
              </p>
            )}
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
                      </th>
                    ))}
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
                          <td key={a.id} style={td}>{renderCell(a, s)}</td>
                        ))}
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

// Pre-N, PreK and Kindergarten specials: one written appreciation per child,
// per subject and term (no levels).
function SubjectComments({ grade, subject, term, canEdit }) {
  const [students, setStudents] = useState([]);
  const [comments, setComments] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(""); setStatus(""); setDrafts({});
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
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{grade} · {subject} · Term {term} · Appreciation</p>
        {!loading && !error && <span style={{ fontSize: 13, color: COLORS.muted }}>{done} of {students.length} written</span>}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: COLORS.muted }}>
        2–3 sentences per child: what they enjoy, a skill they have shown, and one thing to work on next. It saves when you leave the box.
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
                  rows={3}
                  value={value}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                  onBlur={() => save(s.id)}
                  placeholder="e.g. Ama loves singing and now keeps the beat with the class. Next, she will work on singing in a small group."
                  style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
                />
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: value ? COLORS.ink : COLORS.muted }}>{value || "Not written yet."}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

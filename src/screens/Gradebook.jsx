import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GRADES, ASSESS_LEVELS, LETTER_GRADES, letterFromScore, LETTER_GRADE_COLOR } from "../data/constants";
import { uid, todayStr } from "../lib/format";
import { Field, Modal } from "../ui/common";
import { StandardsLibraryModal } from "./Assessment";

const emptyGradeForm = { studentId: "", subject: "", term: "", scoreType: "Percentage", score: "", letter: "", standardId: "", comments: "" };

function GradebookTab({ data, persist, profile, onNavigate }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [showStandards, setShowStandards] = useState(false);
  const [form, setForm] = useState(emptyGradeForm);
  const [formError, setFormError] = useState("");

  const isStudent = profile?.role === "student";
  const myStudentId = isStudent ? (profile.student_ids || [])[0] : null;

  // Grades this person actually teaches. A teacher who is only the learning
  // assistant in some grades (profiles.assistant_grades) does not see grades
  // or reports for those grades. Admins are not affected.
  const isTeacherScoped = profile?.role === "teacher";
  const teachingGrades = (profile?.grades_assigned || []).filter((g) => !(profile?.assistant_grades || []).includes(g));
  const canSeeGrade = (g) => !isTeacherScoped || teachingGrades.includes(g);

  // Pre-N through Kindergarten: portfolio only, no gradebook.
  // Grade 1 and Grade 2: developmental levels only.
  // Grade 3 and up: percentage or letter grades only.
  const scoreTypeForGrade = (grade) => {
    if (grade === "Grade 1" || grade === "Grade 2") return "Levels";
    return "Percentage";
  };

  const entries = [...(data.gradeEntries || [])]
    .filter((e) => !isStudent || e.studentId === myStudentId)
    .filter((e) => canSeeGrade(e.grade))
    .sort((a, b) => b.date.localeCompare(a.date));
  const filtered = gradeFilter ? entries.filter((e) => e.grade === gradeFilter) : entries;

  const selectedStudent = data.students.find((s) => s.id === form.studentId);
  const isLevelsGrade = selectedStudent && (selectedStudent.grade === "Grade 1" || selectedStudent.grade === "Grade 2");

  const chooseStudent = (studentId) => {
    const student = data.students.find((s) => s.id === studentId);
    setForm((f) => ({ ...f, studentId, scoreType: student ? scoreTypeForGrade(student.grade) : f.scoreType, letter: "", score: "" }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyGradeForm, date: todayStr() });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({ ...emptyGradeForm, ...e });
    setFormError("");
    setShowForm(true);
  };

  const saveEntry = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    if (!form.subject.trim()) {
      setFormError("Please enter a subject before saving.");
      return;
    }
    const letter = form.scoreType === "Percentage" ? letterFromScore(form.score) : form.letter;
    const standard = (data.standards || []).find((s) => s.id === form.standardId);
    const standardLabel = standard ? (standard.code ? `${standard.code} - ${standard.description}` : standard.description) : "";
    const record = { ...form, studentId: student.id, studentName: student.name, grade: student.grade, letter, standardLabel };
    if (editingId) {
      persist({ ...data, gradeEntries: (data.gradeEntries || []).map((e) => (e.id === editingId ? { ...e, ...record } : e)) });
    } else {
      persist({ ...data, gradeEntries: [...(data.gradeEntries || []), { id: uid(), date: todayStr(), ...record }] });
      setGradeFilter(null);
    }
    setForm(emptyGradeForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeEntry = (id) => persist({ ...data, gradeEntries: (data.gradeEntries || []).filter((e) => e.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>{isStudent ? "My Grades" : "Gradebook"}</h1>
        {!isStudent && <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>}
      </div>
      {data.students.length === 0 && !isStudent && <p className="bsf-empty">Add students first, then enter grades here.</p>}
      {isStudent && entries.length === 0 && <p className="bsf-empty">No grades entered yet.</p>}

      {!isStudent && (
        <section className="bsf-card">
          <h2>Related tools</h2>
          <div className="bsf-chiprow">
            <button className="bsf-chip" onClick={() => setShowStandards(true)}>Standards library</button>
            <button className="bsf-chip" onClick={() => onNavigate && onNavigate("reports")}>Report Cards</button>
            <button className="bsf-chip" onClick={() => onNavigate && onNavigate("reports")}>Transcripts</button>
          </div>
          <p className="bsf-muted" style={{ marginTop: 8 }}>Report Cards and Transcripts are generated from Reports, using the grades entered here.</p>
        </section>
      )}

      {!isStudent && data.students.length > 0 && (
        <section className="bsf-card">
          <h2>Filter by grade level</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {GRADES.filter(canSeeGrade).map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-list">
        {filtered.length === 0 && !isStudent && <p className="bsf-empty">No grades entered yet.</p>}
        {filtered.map((e) => (
          <div key={e.id} className={`bsf-card bsf-student ${isStudent ? "" : "bsf-clickable"}`} onClick={() => { if (!isStudent) openEdit(e); }}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[e.letter] || "#6B7578"}1A`, color: LETTER_GRADE_COLOR[e.letter] || "#6B7578" }}>
                  {e.scoreType === "Percentage" ? `${e.score}% · ${e.letter}` : e.letter}
                </span>
                <span className="bsf-muted">{e.date}</span>
              </div>
              {!isStudent && <strong>{e.studentName}</strong>}
              <p className="bsf-muted">{e.grade} · {e.subject}{e.term ? ` · ${e.term}` : ""}</p>
              {e.standardLabel && <p className="bsf-muted">Standard: {e.standardLabel}</p>}
              {e.comments && <p>{e.comments}</p>}
            </div>
            {!isStudent && <button className="bsf-iconbtn" onClick={(ev) => { ev.stopPropagation(); removeEntry(e.id); }} aria-label="Remove"><Trash2 size={16} /></button>}
          </div>
        ))}
      </section>

      {showForm && !isStudent && (
        <Modal title={editingId ? "Edit grade" : "New grade entry"} onClose={() => setShowForm(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => chooseStudent(e.target.value)}>
              <option value="">Choose a student</option>
              {data.students.filter((s) => GRADES.indexOf(s.grade) >= GRADES.indexOf("Grade 1") && canSeeGrade(s.grade)).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
            <p className="bsf-muted" style={{ marginTop: 4 }}>
              Pre-N through Kindergarten aren't shown here, since those grades are tracked through Portfolio, not the gradebook.
            </p>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math" />
          </Field>
          <Field label="Term or period">
            <input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="e.g. Term 1" />
          </Field>
          {selectedStudent && (
            <p className="bsf-muted" style={{ marginBottom: 10 }}>
              {isLevelsGrade
                ? "Grade 1 and Grade 2 are graded using developmental levels."
                : "Grade 3 and up are graded using percentage or letter grades."}
            </p>
          )}
          {selectedStudent && isLevelsGrade && (
            <Field label="Level">
              <div className="bsf-chiprow">
                {ASSESS_LEVELS.map((l) => (
                  <button key={l} type="button" className={`bsf-chip ${form.letter === l ? "active" : ""}`} onClick={() => setForm({ ...form, letter: l })}>{l}</button>
                ))}
              </div>
            </Field>
          )}
          {selectedStudent && !isLevelsGrade && (
            <Field label="Grade type">
              <div className="bsf-chiprow">
                <button type="button" className={`bsf-chip ${form.scoreType === "Percentage" ? "active" : ""}`} onClick={() => setForm({ ...form, scoreType: "Percentage" })}>Percentage</button>
                <button type="button" className={`bsf-chip ${form.scoreType === "Letter" ? "active" : ""}`} onClick={() => setForm({ ...form, scoreType: "Letter" })}>Letter grade</button>
              </div>
            </Field>
          )}
          {selectedStudent && !isLevelsGrade && (
            form.scoreType === "Percentage" ? (
              <Field label="Score (0 to 100)">
                <input type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
                {form.score !== "" && <p className="bsf-muted" style={{ marginTop: 4 }}>Letter grade: {letterFromScore(form.score)}</p>}
              </Field>
            ) : (
              <Field label="Letter grade">
                <div className="bsf-chiprow">
                  {LETTER_GRADES.map((l) => (
                    <button key={l} type="button" className={`bsf-chip ${form.letter === l ? "active" : ""}`} onClick={() => setForm({ ...form, letter: l })}>{l}</button>
                  ))}
                </div>
              </Field>
            )
          )}
          <Field label="Standard (optional)">
            <select value={form.standardId} onChange={(e) => setForm({ ...form, standardId: e.target.value })}>
              <option value="">No specific standard</option>
              {(data.standards || []).map((s) => (
                <option key={s.id} value={s.id}>{s.code ? `${s.code} · ` : ""}{s.subject}{s.grade ? ` · ${s.grade}` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Comments">
            <textarea rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveEntry}>{editingId ? "Save changes" : "Save grade"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {showStandards && <StandardsLibraryModal data={data} persist={persist} onClose={() => setShowStandards(false)} />}
    </div>
  );
}

export { GradebookTab };

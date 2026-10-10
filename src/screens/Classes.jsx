import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GRADES } from "../data/constants";
import { uid } from "../lib/format";
import { Field, Modal, AvatarStack } from "../ui/common";

function ClassesTab({ data, persist, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [studentIds, setStudentIds] = useState([]);
  const [formError, setFormError] = useState("");

  const isTeacherRole = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const myAssignedGrades = profile?.grades_assigned || [];

  const allClasses = data.classes || [];
  // Teachers and learning assistants only see classes that include at least one
  // student in a grade they actually support, and can't change enrollment or
  // class membership, that stays an admin decision.
  const classes = isTeacherRole
    ? allClasses.filter((c) =>
        (c.studentIds || []).some((id) => {
          const s = data.students.find((st) => st.id === id);
          return s && myAssignedGrades.includes(s.grade);
        })
      )
    : allClasses;

  const sortedStudents = [...data.students].sort((a, b) => {
    const gi = (s) => GRADES.indexOf(s.grade);
    return gi(a) - gi(b) || a.name.localeCompare(b.name);
  });

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setStudentIds([]);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (cls) => {
    setEditingId(cls.id);
    setName(cls.name);
    setStudentIds(cls.studentIds || []);
    setFormError("");
    setShowForm(true);
  };

  const toggleStudent = (id) => {
    setStudentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const saveClass = () => {
    if (!name.trim()) {
      setFormError("Please enter a class name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, classes: classes.map((c) => (c.id === editingId ? { ...c, name, studentIds } : c)) });
    } else {
      persist({ ...data, classes: [...classes, { id: uid(), name, studentIds }] });
    }
    setShowForm(false);
  };

  const removeClass = (id) => persist({ ...data, classes: classes.filter((c) => c.id !== id) });

  const gradeSpan = (cls) => {
    const grades = [...new Set((cls.studentIds || []).map((id) => data.students.find((s) => s.id === id)?.grade).filter(Boolean))];
    return grades.sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b)).join(", ");
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Classes</p>
        <h1>{classes.length} class{classes.length === 1 ? "" : "es"}</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isTeacherRole && <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>}
      </div>
      {data.students.length === 0 && !isTeacherRole && <p className="bsf-empty">Add students first, then group them into classes here.</p>}

      <section className="bsf-list">
        {classes.length === 0 && data.students.length > 0 && <p className="bsf-empty">No classes yet.{!isTeacherRole && " Group students by homeroom, even across grade levels."}</p>}
        {classes.map((c) => {
          const rosterIds = isTeacherRole
            ? (c.studentIds || []).filter((id) => {
                const s = data.students.find((st) => st.id === id);
                return s && myAssignedGrades.includes(s.grade);
              })
            : (c.studentIds || []);
          return (
            <div key={c.id} className={`bsf-card bsf-student ${isTeacherRole ? "" : "bsf-clickable"}`} onClick={() => { if (!isTeacherRole) openEdit(c); }}>
              <div>
                <strong>{c.name}</strong>
                <p className="bsf-muted">{gradeSpan(c) || "No grades yet"} · {rosterIds.length} student{rosterIds.length === 1 ? "" : "s"}</p>
                {rosterIds.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <AvatarStack students={rosterIds.map((id) => data.students.find((st) => st.id === id)).filter(Boolean)} />
                  </div>
                )}
              </div>
              {!isTeacherRole && (
                <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeClass(c.id); }} aria-label="Remove">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          );
        })}
      </section>

      {showForm && !isTeacherRole && (
        <Modal title={editingId ? "Edit class" : "New class"} onClose={() => setShowForm(false)}>
          <Field label="Class name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pre-Nursery / PreK, Grade 1 / 2" />
          </Field>
          <Field label="Students">
            <div className="bsf-checklist">
              {sortedStudents.map((s) => (
                <label key={s.id} className="bsf-checklist-row">
                  <input type="checkbox" checked={studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                  <span>{s.name} <span className="bsf-muted">· {s.grade}</span></span>
                </label>
              ))}
            </div>
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveClass}>Save class</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

export { ClassesTab };

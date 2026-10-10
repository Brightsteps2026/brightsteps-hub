import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { useLanguage, pluralKey } from "../lib/i18n";
import { GRADES } from "../data/constants";
import { uid, todayStr, formatDateLong, gradeLabel } from "../lib/format";
import { Field, Modal } from "../ui/common";

const emptyAssignmentForm = { title: "", description: "", grades: [], subject: "", dueDate: "", link: "", files: [] };

function AssignmentsTab({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [form, setForm] = useState(emptyAssignmentForm);
  const [formError, setFormError] = useState("");

  const isParent = profile?.role === "parent";
  const isStudent = profile?.role === "student";
  const isSelfOnly = isParent || isStudent;
  const linkedIds = profile?.student_ids || [];
  const myGrades = isSelfOnly ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))] : [];
  const myStudentId = isStudent ? linkedIds[0] : null;

  const today = todayStr();
  const assignments = [...(data.assignments || [])]
    .filter((a) => !isSelfOnly || (a.grades || []).some((g) => myGrades.includes(g)))
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const filtered = gradeFilter ? assignments.filter((a) => (a.grades || []).includes(gradeFilter)) : assignments;
  const upcoming = filtered.filter((a) => !a.dueDate || a.dueDate >= today);
  const past = filtered.filter((a) => a.dueDate && a.dueDate < today);

  const saveMySubmission = (assignmentId, patch) => {
    persist({
      ...data,
      assignments: (data.assignments || []).map((a) =>
        a.id === assignmentId
          ? { ...a, submissions: { ...(a.submissions || {}), [myStudentId]: { ...(a.submissions?.[myStudentId] || {}), ...patch, date: todayStr() } } }
          : a
      )
    });
  };

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g] }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyAssignmentForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({ ...emptyAssignmentForm, ...a });
    setFormError("");
    setShowForm(true);
  };

  const saveAssignment = () => {
    if (!form.title.trim() || form.grades.length === 0) {
      setFormError("Please add a title and choose at least one grade.");
      return;
    }
    if (editingId) {
      persist({ ...data, assignments: (data.assignments || []).map((a) => (a.id === editingId ? { ...a, ...form } : a)) });
    } else {
      persist({ ...data, assignments: [...(data.assignments || []), { id: uid(), ...form }] });
      setGradeFilter(null);
    }
    setForm(emptyAssignmentForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeAssignment = (id) => persist({ ...data, assignments: (data.assignments || []).filter((a) => a.id !== id) });

  const renderAssignment = (a) => (
    <div key={a.id} className={`bsf-card bsf-student ${isSelfOnly ? "" : "bsf-clickable"}`} onClick={() => { if (!isSelfOnly) openEdit(a); }}>
      <div>
        <div className="bsf-row-head">
          <span className="bsf-tag">{(a.grades || []).length === GRADES.length ? t("common.allGrades") : (a.grades || []).map((g) => (isParent ? gradeLabel(g, language) : g)).join(", ")}</span>
          {a.dueDate && <span className="bsf-muted">{t("common.due", { date: isParent ? formatDateLong(a.dueDate, language) : a.dueDate })}</span>}
        </div>
        {a.subject && <p className="bsf-muted">{a.subject}</p>}
        <strong>{a.title}</strong>
        {a.description && <p>{a.description}</p>}
        {a.link && <p className="bsf-muted">{a.link}</p>}
        {(!isSelfOnly || (a.files || []).length > 0) && (
          <div onClick={(e) => e.stopPropagation()}>
            <AttachmentField
              folder="assignments"
              files={a.files || []}
              onChange={(files) =>
                persist({ ...data, assignments: (data.assignments || []).map((x) => (x.id === a.id ? { ...x, files } : x)) })
              }
              readOnly={isSelfOnly}
            />
          </div>
        )}
        {isStudent && (
          <div onClick={(e) => e.stopPropagation()} className="bsf-mysubmission">
            <hr className="bsf-divider" />
            <p className="bsf-group-label" style={{ margin: "0 0 8px" }}>My work</p>
            {a.submissions?.[myStudentId]?.date && (
              <p className="bsf-muted" style={{ marginBottom: 6 }}>Last saved {a.submissions[myStudentId].date}</p>
            )}
            <textarea
              rows={2}
              placeholder="Write your answer or notes here..."
              value={a.submissions?.[myStudentId]?.note || ""}
              onChange={(e) => saveMySubmission(a.id, { note: e.target.value })}
            />
            <AttachmentField
              folder="assignments"
              files={a.submissions?.[myStudentId]?.files || []}
              onChange={(files) => saveMySubmission(a.id, { files })}
            />
          </div>
        )}
      </div>
      {!isSelfOnly && <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeAssignment(a.id); }} aria-label="Remove"><Trash2 size={16} /></button>}
    </div>
  );

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("nav.assignments")}</p>
        <h1>{t(pluralKey("assignments.dueCount", upcoming.length, language), { n: upcoming.length })}</h1>
        {upcoming[0] && <p className="bsf-hero-sub">{t("common.nextPrefix")} {upcoming[0].title}{upcoming[0].dueDate ? ` · ${t("common.due", { date: isParent ? formatDateLong(upcoming[0].dueDate, language) : upcoming[0].dueDate })}` : ""}</p>}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isSelfOnly && <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>}
      </div>

      <section className="bsf-card">
        <h2>{t("common.filterByGrade")}</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>{t("common.all")}</button>
          {(isSelfOnly ? myGrades : GRADES).map((g) => (
            <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{isParent ? gradeLabel(g, language) : g}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        <h2 className="bsf-listheading">{t("assignments.dueHeading")}</h2>
        {upcoming.length === 0 && <p className="bsf-empty">{t("assignments.empty")}</p>}
        {upcoming.map(renderAssignment)}
      </section>

      {past.length > 0 && (
        <section className="bsf-list">
          <h2 className="bsf-listheading">{t("assignments.pastDue")}</h2>
          {past.map(renderAssignment)}
        </section>
      )}

      {showForm && (
        <Modal title={editingId ? "Edit assignment" : "New assignment"} onClose={() => setShowForm(false)}>
          <Field label="Grades">
            <div className="bsf-chiprow">
              <button
                type="button"
                className={`bsf-chip ${form.grades.length === GRADES.length ? "active" : ""}`}
                onClick={() => setForm({ ...form, grades: form.grades.length === GRADES.length ? [] : [...GRADES] })}
              >
                All grades
              </button>
              {GRADES.map((g) => (
                <button key={g} type="button" className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`} onClick={() => toggleGrade(g)}>{g}</button>
              ))}
            </div>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math, Literacy" />
          </Field>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fractions worksheet" />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What students need to do" />
          </Field>
          <Field label="Due date">
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          <Field label="Link (optional)">
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Link to a worksheet or resource" />
          </Field>
          <Field label="Attachments (optional)">
            <AttachmentField folder="assignments" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveAssignment}>{editingId ? "Save changes" : "Post assignment"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

export { AssignmentsTab };

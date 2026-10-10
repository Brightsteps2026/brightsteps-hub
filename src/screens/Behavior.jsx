import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GRADES, BEHAVIOR_TYPES, SCHOOL_VALUES, BEHAVIOR_CATEGORIES_POSITIVE, BEHAVIOR_CATEGORIES_CONCERN, behaviorGradesFor } from "../data/constants";
import { uid, todayStr } from "../lib/format";
import { Field, Modal } from "../ui/common";

const emptyBehaviorForm = { studentId: "", type: BEHAVIOR_TYPES[0], category: BEHAVIOR_CATEGORIES_POSITIVE[0], description: "", actionTaken: "", reportedBy: "" };

function BehaviorTab({ data, persist, profile }) {
  const myBehaviorGrades = behaviorGradesFor(profile);
  const myStudents = data.students.filter((s) => myBehaviorGrades.includes(s.grade));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [form, setForm] = useState(emptyBehaviorForm);
  const [formError, setFormError] = useState("");

  const incidents = [...(data.behaviorIncidents || [])].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = gradeFilter ? incidents.filter((i) => i.grade === gradeFilter) : incidents;
  const categoryOptions = form.type === "Positive" ? BEHAVIOR_CATEGORIES_POSITIVE : BEHAVIOR_CATEGORIES_CONCERN;

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyBehaviorForm });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (i) => {
    setEditingId(i.id);
    setForm({ ...emptyBehaviorForm, ...i });
    setFormError("");
    setShowForm(true);
  };

  const setType = (type) => {
    const cats = type === "Positive" ? BEHAVIOR_CATEGORIES_POSITIVE : BEHAVIOR_CATEGORIES_CONCERN;
    setForm({ ...form, type, category: cats[0] });
  };

  const saveIncident = () => {
    const student = myStudents.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    if (!form.description.trim()) {
      setFormError("Please describe what happened before saving.");
      return;
    }
    const record = { ...form, studentId: student.id, studentName: student.name, grade: student.grade };
    if (editingId) {
      persist({ ...data, behaviorIncidents: (data.behaviorIncidents || []).map((i) => (i.id === editingId ? { ...i, ...record } : i)) });
    } else {
      persist({ ...data, behaviorIncidents: [...(data.behaviorIncidents || []), { id: uid(), date: todayStr(), reportedById: profile?.id || "", ...record, reportedBy: record.reportedBy || profile?.full_name || "" }] });
      setGradeFilter(null);
    }
    setForm(emptyBehaviorForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeIncident = (id) => persist({ ...data, behaviorIncidents: (data.behaviorIncidents || []).filter((i) => i.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Behavior</p>
        <h1>{(data.behaviorIncidents || []).length} note{(data.behaviorIncidents || []).length === 1 ? "" : "s"} logged</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>
      </div>
      {data.students.length === 0 && <p className="bsf-empty">Add students first, then log behavior notes here.</p>}

      {data.students.length > 0 && (
        <section className="bsf-card">
          <h2>Filter by grade</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {GRADES.map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No behavior notes recorded yet.</p>}
        {filtered.map((i) => (
          <div key={i.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(i)}>
            <div>
              <div className="bsf-row-head">
                <span
                  className="bsf-status-pill"
                  style={{
                    background: i.type === "Positive" ? "#E7F0EA" : "#FBEAE8",
                    color: i.type === "Positive" ? "#2F7A5C" : "#B5473B"
                  }}
                >
                  {i.type} · {i.category}
                </span>
                <span className="bsf-muted">{i.date}</span>
              </div>
              <strong>{i.studentName}</strong>
              <p className="bsf-muted">{i.grade}</p>
              <p>{i.description}</p>
              {i.actionTaken && <p className="bsf-muted">Action: {i.actionTaken}</p>}
              {i.reportedBy && <p className="bsf-muted">Reported by: {i.reportedBy}</p>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeIncident(i.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit behavior note" : "New behavior note"} onClose={() => setShowForm(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Choose a student</option>
              {myStudents.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <div className="bsf-chiprow">
              {BEHAVIOR_TYPES.map((t) => (
                <button key={t} type="button" className={`bsf-chip ${form.type === t ? "active" : ""}`} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>
          </Field>
          <Field label="Category">
            <div className="bsf-chiprow">
              {categoryOptions.map((c) => (
                <button key={c} type="button" className={`bsf-chip ${form.category === c ? "active" : ""}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="What happened">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the moment factually" />
          </Field>
          <Field label="Action taken (optional)">
            <textarea rows={2} value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} placeholder="e.g. Spoke with student, notified guardian" />
          </Field>
          <Field label="Reported by">
            <input value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} placeholder="Teacher name" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveIncident}>{editingId ? "Save changes" : "Save note"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

// Behaviour notes for one student, shown from the student's card on the Students screen.
// Staff only: admin and the student's teachers. Parents and learning assistants never see this.
function StudentBehavior({ student, data, persist, profile }) {
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const isAdmin = profile?.role === "admin";
  const myName = profile?.full_name || profile?.email || "";

  const notes = (data.behaviorIncidents || [])
    .filter((i) => i.studentId === student.id)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const today = todayStr();
  const terms = (data.settings && data.settings.terms) || [];
  const currentTerm = terms.find((t) => t.startDate && t.endDate && t.startDate <= today && today <= t.endDate);
  const inTerm = currentTerm ? notes.filter((i) => i.date >= currentTerm.startDate && i.date <= currentTerm.endDate) : notes;
  const positives = inTerm.filter((i) => i.type === "Positive").length;
  const concerns = inTerm.filter((i) => i.type === "Concern").length;

  const canChange = (i) => isAdmin || (i.reportedById && i.reportedById === profile?.id);

  const openAdd = () => {
    setEditingId(null);
    setForm({ type: "Concern", category: SCHOOL_VALUES[0], description: "", actionTaken: "" });
    setFormError("");
  };

  const openEdit = (i) => {
    if (!canChange(i)) return;
    setEditingId(i.id);
    setForm({ type: i.type, category: i.category, description: i.description || "", actionTaken: i.actionTaken || "" });
    setFormError("");
  };

  const save = () => {
    if (!form.description.trim()) {
      setFormError("Describe what happened before saving.");
      return;
    }
    const record = { ...form, description: form.description.trim(), actionTaken: form.actionTaken.trim(), studentId: student.id, studentName: student.name, grade: student.grade };
    const list = data.behaviorIncidents || [];
    if (editingId) {
      persist({ ...data, behaviorIncidents: list.map((i) => (i.id === editingId ? { ...i, ...record } : i)) });
    } else {
      persist({ ...data, behaviorIncidents: [...list, { id: uid(), date: todayStr(), reportedBy: myName, reportedById: profile?.id || "", ...record }] });
    }
    setForm(null);
    setEditingId(null);
  };

  const remove = () => {
    if (!window.confirm("Delete this behaviour note? This cannot be undone.")) return;
    persist({ ...data, behaviorIncidents: (data.behaviorIncidents || []).filter((i) => i.id !== editingId) });
    setForm(null);
    setEditingId(null);
  };

  return (
    <div>
      <p className="bsf-muted" style={{ margin: "0 0 12px" }}>Staff only. Parents and learning assistants can't see these notes.</p>

      {!form && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
            <div className="bsf-card" style={{ margin: 0 }}>
              <p className="bsf-muted" style={{ margin: 0 }}>Positive{currentTerm ? ` · ${currentTerm.name}` : ""}</p>
              <strong style={{ fontSize: 22 }}>{positives}</strong>
            </div>
            <div className="bsf-card" style={{ margin: 0 }}>
              <p className="bsf-muted" style={{ margin: 0 }}>Concerns{currentTerm ? ` · ${currentTerm.name}` : ""}</p>
              <strong style={{ fontSize: 22 }}>{concerns}</strong>
            </div>
          </div>
          <button className="bsf-btn bsf-btn-block" onClick={openAdd}><Plus size={16} /> Add note</button>

          <div style={{ marginTop: 12 }}>
            {notes.length === 0 && <p className="bsf-empty">No behaviour notes for {student.name} yet.</p>}
            {notes.map((i) => (
              <div
                key={i.id}
                className={`bsf-row ${canChange(i) ? "bsf-clickable" : ""}`}
                onClick={() => openEdit(i)}
                style={{ display: "block", borderTop: "1px solid var(--line)", padding: "10px 0" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span
                    className="bsf-status-pill"
                    style={{ background: i.type === "Positive" ? "#E7F0EA" : "#FBEAE8", color: i.type === "Positive" ? "#2F7A5C" : "#B5473B" }}
                  >
                    {i.type} · {i.category}
                  </span>
                  <span className="bsf-muted">{i.date}</span>
                </div>
                <p style={{ margin: "6px 0 2px" }}>{i.description}</p>
                <p className="bsf-muted" style={{ margin: 0 }}>
                  {i.actionTaken ? `Action: ${i.actionTaken}` : ""}
                  {i.actionTaken && i.reportedBy ? " · " : ""}
                  {i.reportedBy || ""}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {form && (
        <div>
          <h3 style={{ margin: "0 0 8px" }}>{editingId ? "Edit behaviour note" : "New behaviour note"}</h3>
          <Field label="Type">
            <div className="bsf-chiprow">
              {["Concern", "Positive"].map((t) => (
                <button key={t} type="button" className={`bsf-chip ${form.type === t ? "active" : ""}`} onClick={() => setForm({ ...form, type: t })}>{t}</button>
              ))}
            </div>
          </Field>
          <Field label="Which school value">
            <div className="bsf-chiprow">
              {SCHOOL_VALUES.map((c) => (
                <button key={c} type="button" className={`bsf-chip ${form.category === c ? "active" : ""}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="What happened">
            <textarea rows={3} value={form.description} onChange={(e) => { setForm({ ...form, description: e.target.value }); setFormError(""); }} placeholder="Describe what you saw. Don't name other children." />
          </Field>
          <Field label="Action taken (optional)">
            <textarea rows={2} value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} placeholder="Talked with the student" />
          </Field>
          <p className="bsf-muted">An injury or a safeguarding worry? Use Incidents, or tell Patrick privately.</p>
          <button className="bsf-btn bsf-btn-block" onClick={save}>{editingId ? "Save changes" : "Save note"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="bsf-btn-ghost" onClick={() => { setForm(null); setEditingId(null); }}>Cancel</button>
            {editingId && <button className="bsf-btn-ghost" style={{ marginLeft: "auto", color: "#A32D2D" }} onClick={remove}>Delete</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export { BehaviorTab, StudentBehavior };

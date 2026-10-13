import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { GRADES } from "../data/constants";
import UnitPlanner, { STATUS, isMiddleUnit, planSubjects } from "./UnitPlanner";
import { uid, todayStr } from "../lib/format";
import { Field, Modal } from "../ui/common";

function PlanningTab({ data, persist }) {
  const [curriculumView, setCurriculumView] = useState("documents");
  // null = list; "new" = a new unit; otherwise the id of the unit being edited.
  const [editing, setEditing] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);

  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docForm, setDocForm] = useState({ title: "", subject: CURRICULUM_SUBJECTS[0], description: "", files: [] });
  const [docFormError, setDocFormError] = useState("");
  const [docSubjectFilter, setDocSubjectFilter] = useState(null);

  const documents = [...(data.curriculumDocuments || [])].sort((a, b) => a.title.localeCompare(b.title));
  const filteredDocs = docSubjectFilter ? documents.filter((d) => d.subject === docSubjectFilter) : documents;

  const openAddDoc = () => {
    setEditingDocId(null);
    setDocForm({ title: "", subject: CURRICULUM_SUBJECTS[0], description: "", files: [] });
    setDocFormError("");
    setShowDocForm(true);
  };

  const openEditDoc = (d) => {
    setEditingDocId(d.id);
    setDocForm({ title: d.title, subject: d.subject, description: d.description || "", files: d.files || [] });
    setDocFormError("");
    setShowDocForm(true);
  };

  const saveDoc = () => {
    if (!docForm.title.trim()) {
      setDocFormError("Please give this document a title.");
      return;
    }
    if (editingDocId) {
      persist({ ...data, curriculumDocuments: (data.curriculumDocuments || []).map((d) => (d.id === editingDocId ? { ...d, ...docForm } : d)) });
    } else {
      persist({ ...data, curriculumDocuments: [...(data.curriculumDocuments || []), { id: uid(), date: todayStr(), ...docForm }] });
    }
    setShowDocForm(false);
    setDocFormError("");
  };

  const removeDoc = (id) => persist({ ...data, curriculumDocuments: (data.curriculumDocuments || []).filter((d) => d.id !== id) });

  const plans = [...data.plans].sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  const filtered = gradeFilter
    ? plans.filter((p) => (p.grades || []).includes(gradeFilter))
    : plans;
  const editingPlan = editing && editing !== "new" ? data.plans.find((p) => p.id === editing) : null;

  const savePlan = (plan) => {
    const exists = data.plans.some((p) => p.id === plan.id);
    persist({ ...data, plans: exists ? data.plans.map((p) => (p.id === plan.id ? plan : p)) : [...data.plans, plan] });
    if (editing === "new") setEditing(plan.id);
  };

  const removePlan = (id) => {
    if (!window.confirm("Delete this unit plan?")) return;
    persist({ ...data, plans: data.plans.filter((p) => p.id !== id) });
  };

  if (editing) {
    return (
      <UnitPlanner
        plan={editingPlan}
        data={data}
        onSave={savePlan}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Curriculum</p>
        <h1>{documents.length} document{documents.length === 1 ? "" : "s"} · {data.plans.length} unit plan{data.plans.length === 1 ? "" : "s"}</h1>
      </div>

      <div className="bsf-tiletoggle">
        <button className={`bsf-tiletoggle-btn ${curriculumView === "documents" ? "active" : ""}`} onClick={() => setCurriculumView("documents")}>Documents</button>
        <button className={`bsf-tiletoggle-btn ${curriculumView === "units" ? "active" : ""}`} onClick={() => setCurriculumView("units")}>Unit Planning</button>
      </div>

      {curriculumView === "documents" && (
        <>
          <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
            <span />
            <button className="bsf-btn" onClick={openAddDoc}><Plus size={16} /> Add document</button>
          </div>

          <section className="bsf-card">
            <h2>Filter by subject</h2>
            <div className="bsf-chiprow">
              <button className={`bsf-chip ${docSubjectFilter === null ? "active" : ""}`} onClick={() => setDocSubjectFilter(null)}>All</button>
              {[
                ...CURRICULUM_SUBJECTS,
                // Only show a retired subject if a document is actually still filed under it.
                ...RETIRED_CURRICULUM_SUBJECTS.filter((r) => documents.some((d) => d.subject === r))
              ].map((s) => (
                <button key={s} className={`bsf-chip ${docSubjectFilter === s ? "active" : ""}`} onClick={() => setDocSubjectFilter(s)}>{s}</button>
              ))}
            </div>
          </section>

          <section className="bsf-list">
            {filteredDocs.length === 0 && <p className="bsf-empty">No curriculum documents added yet, start with your ELA handbook.</p>}
            {filteredDocs.map((d) => (
              <div key={d.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEditDoc(d)}>
                <div>
                  <span className="bsf-tag">{d.subject}</span>
                  <strong style={{ display: "block", marginTop: 4 }}>{d.title}</strong>
                  {d.description && <p className="bsf-muted">{d.description}</p>}
                  {(d.files || []).length > 0 && <p className="bsf-muted">{d.files.length} file{d.files.length === 1 ? "" : "s"} attached</p>}
                </div>
                <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeDoc(d.id); }} aria-label="Remove"><Trash2 size={16} /></button>
              </div>
            ))}
          </section>

          {showDocForm && (
            <Modal title={editingDocId ? "Edit document" : "New curriculum document"} onClose={() => setShowDocForm(false)}>
              <Field label="Title">
                <input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} placeholder="e.g. ELA Handbook" />
              </Field>
              <Field label="Subject">
                <select value={docForm.subject} onChange={(e) => setDocForm({ ...docForm, subject: e.target.value })}>
                  {CURRICULUM_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Description (optional)">
                <textarea rows={2} value={docForm.description} onChange={(e) => setDocForm({ ...docForm, description: e.target.value })} placeholder="What this document covers" />
              </Field>
              <Field label="File">
                <AttachmentField folder="curriculum" files={docForm.files} onChange={(files) => setDocForm({ ...docForm, files })} />
              </Field>
              <button className="bsf-btn bsf-btn-block" onClick={saveDoc}>Save document</button>
              {docFormError && <p className="bsf-formerror">{docFormError}</p>}
            </Modal>
          )}
        </>
      )}

      {curriculumView === "units" && (
        <>
      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        <button className="bsf-btn" onClick={() => setEditing("new")}><Plus size={16} /> New unit</button>
      </div>

      <div className="bsf-chiprow">
        <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
        {GRADES.map((g) => (
          <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
        ))}
      </div>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No units planned yet.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setEditing(p.id)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">
                  {p.grades && p.grades.length === GRADES.length
                    ? "All grades"
                    : (p.grades || []).join(", ") || p.grade}
                </span>
                {planSubjects(p) && <span className="bsf-muted">{planSubjects(p)}</span>}
                {(() => { const st = STATUS[p.status] || STATUS.draft; return <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{st.label}</span>; })()}
              </div>
              {isMiddleUnit(p.grades) && p.globalContext
                ? <p className="bsf-muted">Global context: {p.globalContext}</p>
                : p.theme && <p className="bsf-muted">Theme: {p.theme}</p>}
              <strong>{p.title}</strong>
              {isMiddleUnit(p.grades) && p.statementOfInquiry ? <p>{p.statementOfInquiry}</p> : p.centralIdea && <p>{p.centralIdea}</p>}
              {p.keyConcepts && <p className="bsf-muted">Key concepts: {p.keyConcepts}</p>}
              {p.linesOfInquiry && <p className="bsf-loi">{p.linesOfInquiry}</p>}
              {(p.startDate || p.endDate) && <p className="bsf-muted">{p.startDate || "?"} to {p.endDate || "?"}</p>}
              <div className="bsf-chiprow bsf-status-chips">
                {p.assessmentSummative ? <span className="bsf-minitag">Summative task</span> : null}
                {p.tuningIn || p.findingOut || p.lessonPlanText || (p.lessonPlanFiles || []).length > 0 ? <span className="bsf-minitag">Learning plan</span> : null}
                {p.evidenceLink || p.evidenceNotes || (p.evidenceFiles || []).length > 0 ? <span className="bsf-minitag">Evidence</span> : null}
                {p.reflection ? <span className="bsf-minitag">Reflection</span> : null}
                {(p.standardIds || []).length > 0 ? <span className="bsf-minitag">{p.standardIds.length} standard{p.standardIds.length === 1 ? "" : "s"}</span> : null}
                {(p.comments || []).length > 0 ? <span className="bsf-minitag">{p.comments.length} note{p.comments.length === 1 ? "" : "s"}</span> : null}
              </div>
            </div>
            <button
              className="bsf-iconbtn"
              onClick={(e) => { e.stopPropagation(); removePlan(p.id); }}
              aria-label="Remove"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>
        </>
      )}

    </div>
  );
}

const CURRICULUM_SUBJECTS = ["English Language Arts", "Math", "Unit of Inquiry", "French", "Art", "Music", "Physical Education", "Baseline Assessment"];

// Social Studies and Science were folded into Unit of Inquiry, and the catch-all
// "Other" was replaced by Baseline Assessment. Documents already filed under the
// old names are NOT touched or deleted, they just stop being offered for new
// documents. RETIRED_CURRICULUM_SUBJECTS keeps a filter chip visible for them so
// nothing becomes unreachable in the UI.
const RETIRED_CURRICULUM_SUBJECTS = ["Social Studies", "Science", "Other"];

export { PlanningTab };

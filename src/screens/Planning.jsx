import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { GRADES } from "../data/constants";
import UnitPlanner, { STATUS, isMiddleUnit, planSubjects } from "./UnitPlanner";
import { uid, todayStr } from "../lib/format";
import { Field, Modal } from "../ui/common";

// "Whole school" documents appear in every grade.
const WHOLE = "Whole school";
const docGrades = (d) => (Array.isArray(d.grades) ? d.grades : []);
const isUnsorted = (d) => docGrades(d).length === 0;

function PlanningTab({ data, persist, profile }) {
  const isAdmin = profile?.role === "admin";
  const myGrades = (Array.isArray(profile?.grades_assigned) ? profile.grades_assigned : []).filter((g) => GRADES.includes(g));

  const [curriculumView, setCurriculumView] = useState("documents");
  // null = list; "new" = a new unit; otherwise the id of the unit being edited.
  const [editing, setEditing] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);

  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [docForm, setDocForm] = useState({ title: "", subject: CURRICULUM_SUBJECTS[0], grades: [], description: "", files: [] });
  const [docFormError, setDocFormError] = useState("");
  const [docSubjectFilter, setDocSubjectFilter] = useState(null);
  // Teachers open on their own (first) grade; the admin opens on Whole school.
  const [docGrade, setDocGrade] = useState(!isAdmin && myGrades.length ? myGrades[0] : WHOLE);
  const [showSort, setShowSort] = useState(false);
  const [sortPicks, setSortPicks] = useState({});

  const documents = [...(data.curriculumDocuments || [])].sort((a, b) => a.title.localeCompare(b.title));
  const unsorted = documents.filter(isUnsorted);
  // A grade shows its own documents plus Whole school ones. Whole school also
  // shows documents that haven't been given a grade yet, so nothing is hidden.
  const inGrade = (d) =>
    docGrade === WHOLE
      ? docGrades(d).includes(WHOLE) || isUnsorted(d)
      : docGrades(d).includes(docGrade) || docGrades(d).includes(WHOLE);
  const gradeDocs = documents.filter(inGrade);
  const filteredDocs = docSubjectFilter ? gradeDocs.filter((d) => d.subject === docSubjectFilter) : gradeDocs;
  const subjectCount = (s) => gradeDocs.filter((d) => d.subject === s).length;
  const gradeOrder = [WHOLE, ...myGrades, ...GRADES.filter((g) => !myGrades.includes(g))];

  const gradeLabel = (d) => {
    const g = docGrades(d);
    if (g.includes(WHOLE)) return WHOLE;
    if (g.length === 0) return "No grade yet";
    return GRADES.filter((x) => g.includes(x)).join(", ");
  };

  // Picking grades: Whole school on its own, or one or more grades.
  const toggleGrade = (list, g) => {
    if (g === WHOLE) return list.includes(WHOLE) ? [] : [WHOLE];
    const rest = list.filter((x) => x !== WHOLE);
    return rest.includes(g) ? rest.filter((x) => x !== g) : [...rest, g];
  };

  const openAddDoc = () => {
    setEditingDocId(null);
    setDocForm({
      title: "",
      subject: docSubjectFilter && CURRICULUM_SUBJECTS.includes(docSubjectFilter) ? docSubjectFilter : CURRICULUM_SUBJECTS[0],
      grades: [docGrade],
      description: "",
      files: []
    });
    setDocFormError("");
    setShowDocForm(true);
  };

  const openEditDoc = (d) => {
    setEditingDocId(d.id);
    setDocForm({ title: d.title, subject: d.subject, grades: docGrades(d), description: d.description || "", files: d.files || [] });
    setDocFormError("");
    setShowDocForm(true);
  };

  const saveDoc = () => {
    if (!docForm.title.trim()) {
      setDocFormError("Please give this document a title.");
      return;
    }
    if (docForm.grades.length === 0) {
      setDocFormError("Choose at least one grade, or Whole school.");
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

  const removeDoc = (d) => {
    if (!window.confirm(`Delete "${d.title}"? This cannot be undone.`)) return;
    persist({ ...data, curriculumDocuments: (data.curriculumDocuments || []).filter((x) => x.id !== d.id) });
  };

  // "To sort": give an older document its grade(s).
  const saveSorted = (d) => {
    const grades = sortPicks[d.id] || [];
    if (grades.length === 0) return;
    persist({ ...data, curriculumDocuments: (data.curriculumDocuments || []).map((x) => (x.id === d.id ? { ...x, grades } : x)) });
    setSortPicks((p) => { const n = { ...p }; delete n[d.id]; return n; });
  };

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

          {isAdmin && unsorted.length > 0 && (
            <section className="bsf-card" style={{ background: "#FBF0DC", borderColor: "#EBD3A4" }}>
              <div className="bsf-row-head" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <strong style={{ color: "#8A6420" }}>To sort · {unsorted.length} document{unsorted.length === 1 ? "" : "s"}</strong>
                  <p className="bsf-muted" style={{ margin: "2px 0 0" }}>Older documents with no grade yet. Give each one its grade(s).</p>
                </div>
                <button className="bsf-btn" onClick={() => setShowSort(true)}>Sort now</button>
              </div>
            </section>
          )}

          <section className="bsf-card">
            <h2>Grade</h2>
            <div className="bsf-chiprow">
              {gradeOrder.map((g) => (
                <button key={g} className={`bsf-chip ${docGrade === g ? "active" : ""}`} onClick={() => { setDocGrade(g); setDocSubjectFilter(null); }}>{g}</button>
              ))}
            </div>
            <h2 style={{ marginTop: 14 }}>Subject</h2>
            <div className="bsf-chiprow">
              <button className={`bsf-chip ${docSubjectFilter === null ? "active" : ""}`} onClick={() => setDocSubjectFilter(null)}>All · {gradeDocs.length}</button>
              {[
                ...CURRICULUM_SUBJECTS,
                // Only show a retired subject if a document is actually still filed under it.
                ...RETIRED_CURRICULUM_SUBJECTS.filter((r) => gradeDocs.some((d) => d.subject === r))
              ].map((s) => (
                <button key={s} className={`bsf-chip ${docSubjectFilter === s ? "active" : ""}`} onClick={() => setDocSubjectFilter(s)}>{s} · {subjectCount(s)}</button>
              ))}
            </div>
          </section>

          <section className="bsf-list">
            {filteredDocs.length === 0 && (
              <p className="bsf-empty">No documents yet for {docGrade}{docSubjectFilter ? ` · ${docSubjectFilter}` : ""}.</p>
            )}
            {filteredDocs.map((d) => (
              <div key={d.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEditDoc(d)}>
                <div>
                  <span className="bsf-tag">{d.subject}</span>
                  <span className="bsf-muted" style={{ marginLeft: 8, fontSize: 12 }}>{gradeLabel(d)}</span>
                  <strong style={{ display: "block", marginTop: 4 }}>{d.title}</strong>
                  {d.description && <p className="bsf-muted">{d.description}</p>}
                  {(d.files || []).length > 0 && <p className="bsf-muted">{d.files.length} file{d.files.length === 1 ? "" : "s"} attached</p>}
                </div>
                <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeDoc(d); }} aria-label="Remove"><Trash2 size={16} /></button>
              </div>
            ))}
          </section>

          {showDocForm && (
            <Modal title={editingDocId ? "Edit document" : "New curriculum document"} onClose={() => setShowDocForm(false)}>
              <Field label="Title">
                <input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} placeholder="e.g. ELA Handbook" />
              </Field>
              <Field label="Grade(s)">
                <div className="bsf-chiprow">
                  {[WHOLE, ...GRADES].map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`bsf-chip ${docForm.grades.includes(g) ? "active" : ""}`}
                      onClick={() => setDocForm({ ...docForm, grades: toggleGrade(docForm.grades, g) })}
                    >{g}</button>
                  ))}
                </div>
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

          {showSort && (
            <Modal title={`To sort · ${unsorted.length} left`} onClose={() => setShowSort(false)}>
              {unsorted.length === 0 && <p className="bsf-empty">All documents have a grade now.</p>}
              {unsorted.map((d) => {
                const picks = sortPicks[d.id] || [];
                return (
                  <div key={d.id} style={{ borderTop: "1px solid #EAD7DA", padding: "12px 0" }}>
                    <span className="bsf-tag">{d.subject}</span>
                    <strong style={{ display: "block", margin: "4px 0 8px" }}>{d.title}</strong>
                    <div className="bsf-chiprow">
                      {[WHOLE, ...GRADES].map((g) => (
                        <button
                          key={g}
                          type="button"
                          className={`bsf-chip ${picks.includes(g) ? "active" : ""}`}
                          onClick={() => setSortPicks((p) => ({ ...p, [d.id]: toggleGrade(p[d.id] || [], g) }))}
                        >{g}</button>
                      ))}
                    </div>
                    <button className="bsf-btn" style={{ marginTop: 8 }} disabled={picks.length === 0} onClick={() => saveSorted(d)}>Save</button>
                  </div>
                );
              })}
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

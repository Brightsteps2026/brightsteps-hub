import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { GRADES, THEMES, PLAN_TEMPLATE } from "../data/constants";
import { uid, todayStr } from "../lib/format";
import { Field, Modal } from "../ui/common";

const emptyPlanForm = {
  grades: [],
  theme: "",
  subject: "",
  title: "",
  centralIdea: "",
  keyConcepts: "",
  linesOfInquiry: "",
  keyVocabulary: "",
  learningOutcomes: "",
  atlSkills: "",
  learnerProfileFocus: "",
  differentiation: "",
  resources: "",
  standardIds: [],
  startDate: "",
  endDate: "",
  lessonPlanText: "",
  lessonPlanLink: "",
  lessonPlanFiles: [],
  assessmentFormative: "",
  evidenceLink: "",
  evidenceNotes: "",
  evidenceFiles: [],
  assessmentSummative: "",
  studentAction: "",
  reflection: "",
  comments: []
};

function PlanDetailModal({ plan, data, onClose, onUpdate }) {
  const [lessonPlanText, setLessonPlanText] = useState(plan.lessonPlanText || "");
  const [lessonPlanLink, setLessonPlanLink] = useState(plan.lessonPlanLink || "");
  const [assessmentFormative, setAssessmentFormative] = useState(plan.assessmentFormative || "");
  const [evidenceLink, setEvidenceLink] = useState(plan.evidenceLink || "");
  const [evidenceNotes, setEvidenceNotes] = useState(plan.evidenceNotes || "");
  const [assessmentSummative, setAssessmentSummative] = useState(plan.assessmentSummative || "");
  const [studentAction, setStudentAction] = useState(plan.studentAction || "");
  const [reflection, setReflection] = useState(plan.reflection || "");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");

  const standards = data?.standards || [];
  const standardIds = plan.standardIds || [];

  const saveField = (patch) => onUpdate(plan.id, patch);

  const toggleStandard = (id) => {
    const next = standardIds.includes(id) ? standardIds.filter((x) => x !== id) : [...standardIds, id];
    saveField({ standardIds: next });
  };

  const addComment = () => {
    if (!commentText.trim()) return;
    const comment = {
      id: uid(),
      author: commentAuthor.trim() || "Team member",
      text: commentText.trim(),
      date: new Date().toISOString().slice(0, 10)
    };
    onUpdate(plan.id, { comments: [...(plan.comments || []), comment] });
    setCommentText("");
  };

  const removeComment = (id) => {
    onUpdate(plan.id, { comments: (plan.comments || []).filter((c) => c.id !== id) });
  };

  return (
    <Modal title={plan.title} onClose={onClose}>
      <div className="bsf-row-head">
        <span className="bsf-tag">
          {plan.grades && plan.grades.length === GRADES.length ? "All grades" : (plan.grades || []).join(", ") || plan.grade}
        </span>
        {plan.subject && <span className="bsf-muted">{plan.subject}</span>}
      </div>
      {plan.theme && <p className="bsf-muted">Theme: {plan.theme}</p>}
      {plan.centralIdea && <p>{plan.centralIdea}</p>}
      {plan.keyConcepts && <p className="bsf-muted">Key concepts: {plan.keyConcepts}</p>}
      {plan.linesOfInquiry && <p className="bsf-loi">{plan.linesOfInquiry}</p>}

      <hr className="bsf-divider" />

      <Field label="Standards addressed">
        {standards.length === 0 ? (
          <p className="bsf-empty">No standards in your library yet. Add some from Assessment → Standards.</p>
        ) : (
          <div className="bsf-chiprow">
            {standards.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`bsf-chip ${standardIds.includes(s.id) ? "active" : ""}`}
                onClick={() => toggleStandard(s.id)}
              >
                {s.code || s.description.slice(0, 24)}
              </button>
            ))}
          </div>
        )}
      </Field>

      <hr className="bsf-divider" />

      <Field label="Lesson plan notes">
        <textarea
          rows={5}
          value={lessonPlanText}
          onChange={(e) => setLessonPlanText(e.target.value)}
          onBlur={() => saveField({ lessonPlanText })}
          placeholder="Paste or write the lesson plan content here"
        />
      </Field>
      <Field label="Lesson plan link (optional)">
        <input
          value={lessonPlanLink}
          onChange={(e) => setLessonPlanLink(e.target.value)}
          onBlur={() => saveField({ lessonPlanLink })}
          placeholder="Link to a doc, if it lives elsewhere"
        />
      </Field>
      <Field label="Lesson plan attachments">
        <AttachmentField
          folder="planning"
          files={plan.lessonPlanFiles}
          onChange={(files) => saveField({ lessonPlanFiles: files })}
        />
      </Field>
      <Field label="Assessment (formative)">
        <textarea
          rows={3}
          value={assessmentFormative}
          onChange={(e) => setAssessmentFormative(e.target.value)}
          onBlur={() => saveField({ assessmentFormative })}
          placeholder="Quick checks along the way to see how understanding is developing"
        />
      </Field>

      <hr className="bsf-divider" />

      <Field label="Evidence link">
        <input
          value={evidenceLink}
          onChange={(e) => setEvidenceLink(e.target.value)}
          onBlur={() => saveField({ evidenceLink })}
          placeholder="Link to photos, documents, or student work"
        />
      </Field>
      <Field label="Evidence notes">
        <textarea
          rows={3}
          value={evidenceNotes}
          onChange={(e) => setEvidenceNotes(e.target.value)}
          onBlur={() => saveField({ evidenceNotes })}
          placeholder="Describe what the evidence shows"
        />
      </Field>
      <Field label="Evidence attachments">
        <AttachmentField
          folder="planning"
          files={plan.evidenceFiles}
          onChange={(files) => saveField({ evidenceFiles: files })}
        />
      </Field>
      <Field label="Assessment (summative)">
        <textarea
          rows={3}
          value={assessmentSummative}
          onChange={(e) => setAssessmentSummative(e.target.value)}
          onBlur={() => saveField({ assessmentSummative })}
          placeholder="The final task or product that shows understanding"
        />
      </Field>

      <hr className="bsf-divider" />

      <Field label="Student action">
        <textarea
          rows={3}
          value={studentAction}
          onChange={(e) => setStudentAction(e.target.value)}
          onBlur={() => saveField({ studentAction })}
          placeholder="How learning connects to something students do or change beyond the classroom"
        />
      </Field>

      <Field label="Reflection">
        <textarea
          rows={4}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          onBlur={() => saveField({ reflection })}
          placeholder="What worked, what would you change next time"
        />
      </Field>

      <hr className="bsf-divider" />

      <h3 className="bsf-subheading">Team notes</h3>
      <div className="bsf-comments">
        {(plan.comments || []).length === 0 && <p className="bsf-empty">No notes yet. Teachers can leave one below.</p>}
        {(plan.comments || []).map((c) => (
          <div key={c.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{c.author}</strong>
              <span className="bsf-muted">{c.date}</span>
            </div>
            <p>{c.text}</p>
            <button className="bsf-textbtn" onClick={() => removeComment(c.id)}>Remove</button>
          </div>
        ))}
      </div>
      <Field label="Your name">
        <input value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} placeholder="e.g. Myriam" />
      </Field>
      <Field label="Add a note">
        <textarea rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Share a thought with the team" />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addComment}>Post note</button>
    </Modal>
  );
}

function PlanningTab({ data, persist }) {
  const [curriculumView, setCurriculumView] = useState("documents");
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(emptyPlanForm);
  const [formError, setFormError] = useState("");
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
  const allSelected = form.grades.length === GRADES.length;
  const detailPlan = data.plans.find((p) => p.id === detailId);
  const standards = data.standards || [];

  const toggleGrade = (g) => {
    setForm((f) => ({
      ...f,
      grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g]
    }));
  };

  const toggleStandard = (id) => {
    setForm((f) => ({
      ...f,
      standardIds: f.standardIds.includes(id) ? f.standardIds.filter((x) => x !== id) : [...f.standardIds, id]
    }));
  };

  const toggleAllGrades = () => {
    setForm((f) => ({ ...f, grades: allSelected ? [] : [...GRADES] }));
  };

  const applyTemplate = () => {
    setForm((f) => ({
      ...f,
      centralIdea: f.centralIdea || PLAN_TEMPLATE.centralIdea,
      keyConcepts: f.keyConcepts || PLAN_TEMPLATE.keyConcepts,
      linesOfInquiry: f.linesOfInquiry || PLAN_TEMPLATE.linesOfInquiry
    }));
  };

  const addPlan = () => {
    if (!form.title.trim() || form.grades.length === 0) {
      setFormError("Please add a title and choose at least one grade.");
      return;
    }
    persist({ ...data, plans: [...data.plans, { id: uid(), ...form }] });
    setForm(emptyPlanForm);
    setFormError("");
    setShowAdd(false);
  };

  const removePlan = (id) => persist({ ...data, plans: data.plans.filter((p) => p.id !== id) });

  const updatePlan = (id, patch) => {
    persist({ ...data, plans: data.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

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
        <button className="bsf-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button>
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
          <div key={p.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setDetailId(p.id)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">
                  {p.grades && p.grades.length === GRADES.length
                    ? "All grades"
                    : (p.grades || []).join(", ") || p.grade}
                </span>
                {p.subject && <span className="bsf-muted">{p.subject}</span>}
              </div>
              {p.theme && <p className="bsf-muted">Theme: {p.theme}</p>}
              <strong>{p.title}</strong>
              {p.centralIdea && <p>{p.centralIdea}</p>}
              {p.keyConcepts && <p className="bsf-muted">Key concepts: {p.keyConcepts}</p>}
              {p.linesOfInquiry && <p className="bsf-loi">{p.linesOfInquiry}</p>}
              {(p.startDate || p.endDate) && <p className="bsf-muted">{p.startDate || "?"} to {p.endDate || "?"}</p>}
              <div className="bsf-chiprow bsf-status-chips">
                {p.lessonPlanText || p.lessonPlanLink || (p.lessonPlanFiles || []).length > 0 ? <span className="bsf-minitag">Lesson plan</span> : null}
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

      {showAdd && (
        <Modal title="New unit plan" onClose={() => setShowAdd(false)}>
          <Field label="Grades covered">
            <div className="bsf-chiprow">
              <button className={`bsf-chip ${allSelected ? "active" : ""}`} onClick={toggleAllGrades}>All grades</button>
              {GRADES.map((g) => (
                <button
                  key={g}
                  className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`}
                  onClick={() => toggleGrade(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Theme">
            <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
              <option value="">No theme</option>
              {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
              {form.theme && !THEMES.includes(form.theme) && <option value={form.theme}>{form.theme}</option>}
            </select>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Science, Literacy, or Whole school" />
          </Field>
          <Field label="Unit title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. How the World Works" />
          </Field>
          <Field label="Attachments">
            <AttachmentField
              folder="planning"
              files={form.lessonPlanFiles}
              onChange={(files) => setForm({ ...form, lessonPlanFiles: files })}
            />
          </Field>

          <button type="button" className="bsf-templatebtn" onClick={applyTemplate}>Fill in unit plan template</button>

          <Field label="Central idea">
            <textarea rows={3} value={form.centralIdea} onChange={(e) => setForm({ ...form, centralIdea: e.target.value })} placeholder="What big idea drives this unit" />
          </Field>
          <Field label="Key concepts">
            <input value={form.keyConcepts} onChange={(e) => setForm({ ...form, keyConcepts: e.target.value })} placeholder="e.g. Form, Change, Connection" />
          </Field>
          <Field label="Lines of inquiry">
            <textarea rows={3} value={form.linesOfInquiry} onChange={(e) => setForm({ ...form, linesOfInquiry: e.target.value })} placeholder="One idea per line" />
          </Field>
          <Field label="Key vocabulary">
            <textarea rows={2} value={form.keyVocabulary} onChange={(e) => setForm({ ...form, keyVocabulary: e.target.value })} placeholder="Important words students should know by the end" />
          </Field>
          <Field label="Learning outcomes">
            <textarea rows={3} value={form.learningOutcomes} onChange={(e) => setForm({ ...form, learningOutcomes: e.target.value })} placeholder="What students should know or be able to do" />
          </Field>
          <Field label="Approaches to learning skills">
            <textarea rows={2} value={form.atlSkills} onChange={(e) => setForm({ ...form, atlSkills: e.target.value })} placeholder="e.g. Research, communication, self management" />
          </Field>
          <Field label="Learner attributes focus">
            <input value={form.learnerProfileFocus} onChange={(e) => setForm({ ...form, learnerProfileFocus: e.target.value })} placeholder="e.g. Curious, caring, reflective" />
          </Field>
          <Field label="Differentiation">
            <textarea rows={3} value={form.differentiation} onChange={(e) => setForm({ ...form, differentiation: e.target.value })} placeholder="How the unit adapts for different learners" />
          </Field>
          <Field label="Resources and materials">
            <textarea rows={2} value={form.resources} onChange={(e) => setForm({ ...form, resources: e.target.value })} placeholder="Books, websites, supplies needed" />
          </Field>
          <Field label="Standards addressed (optional)">
            {standards.length === 0 ? (
              <p className="bsf-empty">No standards in your library yet. Add some from Assessment → Standards.</p>
            ) : (
              <div className="bsf-chiprow">
                {standards.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`bsf-chip ${form.standardIds.includes(s.id) ? "active" : ""}`}
                    onClick={() => toggleStandard(s.id)}
                  >
                    {s.code || s.description.slice(0, 24)}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <div className="bsf-two-col">
            <Field label="Start date">
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End date">
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Reflection">
            <textarea
              rows={4}
              value={form.reflection}
              onChange={(e) => setForm({ ...form, reflection: e.target.value })}
              placeholder="What worked, what would you change next time"
            />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addPlan}>Save unit plan</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {detailPlan && (
        <PlanDetailModal plan={detailPlan} data={data} onClose={() => setDetailId(null)} onUpdate={updatePlan} />
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

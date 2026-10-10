import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage, pluralKey } from "../lib/i18n";
import { GRADES, ASSESS_LEVELS, getLevelColor } from "../data/constants";
import { uid, formatDateLong, gradeLabel, tLabel } from "../lib/format";
import { Field, Modal, StudentThumb } from "../ui/common";

function RubricLibraryModal({ data, persist, onClose }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [itemsText, setItemsText] = useState("");

  const rubrics = data.rubrics || [];

  const addRubric = () => {
    const items = itemsText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!name.trim() || items.length === 0) return;
    const rubric = { id: uid(), name: name.trim(), subject: subject.trim(), items };
    persist({ ...data, rubrics: [...rubrics, rubric] });
    setName(""); setSubject(""); setItemsText("");
  };

  const removeRubric = (id) => persist({ ...data, rubrics: rubrics.filter((r) => r.id !== id) });

  return (
    <Modal title="Rubric library" onClose={onClose}>
      <p className="bsf-muted" style={{ marginBottom: 12 }}>Build reusable rubrics once, then apply them when recording an assessment.</p>

      <div className="bsf-comments">
        {rubrics.length === 0 && <p className="bsf-empty">No rubrics saved yet.</p>}
        {rubrics.map((r) => (
          <div key={r.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{r.name}</strong>
              <button className="bsf-textbtn" onClick={() => removeRubric(r.id)}>Remove</button>
            </div>
            {r.subject && <p className="bsf-muted">{r.subject}</p>}
            <ul className="bsf-rubric-items">
              {r.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">New rubric</h3>
      <Field label="Rubric name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Writing a paragraph" />
      </Field>
      <Field label="Subject (optional)">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Literacy" />
      </Field>
      <Field label="Criteria, one per line">
        <textarea rows={4} value={itemsText} onChange={(e) => setItemsText(e.target.value)} placeholder={"Uses a clear topic sentence\nSupports ideas with detail\nUses correct punctuation"} />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addRubric}>Save rubric</button>
    </Modal>
  );
}

function StandardsLibraryModal({ data, persist, onClose }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");

  const standards = data.standards || [];

  const addStandard = () => {
    if (!description.trim()) return;
    const standard = { id: uid(), code: code.trim(), description: description.trim(), subject: subject.trim(), grade };
    persist({ ...data, standards: [...standards, standard] });
    setCode(""); setDescription(""); setSubject(""); setGrade("");
  };

  const removeStandard = (id) => persist({ ...data, standards: standards.filter((s) => s.id !== id) });

  const importBulk = () => {
    setBulkError("");
    setBulkSuccess("");
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setBulkError("Paste one standard per line before importing.");
      return;
    }
    const newStandards = [];
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 2) {
        setBulkError(`This line is missing a pipe (|) separator: "${line.slice(0, 40)}..."`);
        return;
      }
      const [lineCode, lineSubject, lineGrade, ...rest] = parts;
      const lineDescription = rest.join("|").trim() || lineGrade || "";
      // Format is Code | Subject | Grade | Description (Grade is optional)
      if (parts.length >= 4) {
        newStandards.push({ id: uid(), code: lineCode, subject: lineSubject, grade: parts[2], description: parts.slice(3).join("|").trim() });
      } else {
        newStandards.push({ id: uid(), code: lineCode, subject: lineSubject, grade: "", description: lineDescription });
      }
    }
    persist({ ...data, standards: [...standards, ...newStandards] });
    setBulkText("");
    setBulkSuccess(`Added ${newStandards.length} standard${newStandards.length === 1 ? "" : "s"}.`);
  };

  return (
    <Modal title="Standards library" onClose={onClose}>
      <p className="bsf-muted" style={{ marginBottom: 12 }}>Build a list of curriculum standards once, then tag assessments to them to track progress over time.</p>

      <div className="bsf-comments">
        {standards.length === 0 && <p className="bsf-empty">No standards added yet.</p>}
        {standards.map((s) => (
          <div key={s.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{s.code ? `${s.code} · ` : ""}{s.subject}{s.grade ? ` · ${s.grade}` : ""}</strong>
              <button className="bsf-textbtn" onClick={() => removeStandard(s.id)}>Remove</button>
            </div>
            <p>{s.description}</p>
          </div>
        ))}
      </div>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Import many at once</h3>
      <p className="bsf-muted" style={{ marginBottom: 8 }}>
        Paste one standard per line, in this format: <code>Code | Subject | Grade | Description</code>. Grade can be left blank.
        For example: <code>CCSS.MATH.3.OA.1 | Math | Grade 3 | Interpret products of whole numbers</code>
      </p>
      <Field label="Paste standards here">
        <textarea rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="One standard per line" />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={importBulk}>Import list</button>
      {bulkError && <p className="bsf-formerror">{bulkError}</p>}
      {bulkSuccess && <p className="bsf-muted">{bulkSuccess}</p>}

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Add one standard</h3>
      <Field label="Code (optional)">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CCSS.MATH.3.OA.1" />
      </Field>
      <Field label="Description">
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Solves two step word problems" />
      </Field>
      <Field label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Math" />
      </Field>
      <Field label="Grade (optional)">
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Any grade</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addStandard}>Save standard</button>
    </Modal>
  );
}

const ASSESSMENT_TYPES = ["Baseline Assessment", "Pre-Assessment", "Formative", "Summative (End of Unit)", "MAP Test", "End of Grade Test", "Other"];

// Pre-N through Kindergarten: Baseline Assessment only, the rest of their record lives in Portfolio.
// Grade 1: Baseline, Pre-Assessment, Formative, Summative.
// Grade 1: Pre-Assessment, Formative, Summative.
// Grade 2 and up: MAP Test joins in.
// Grade 3 and up: End of Grade Test joins in.
function assessmentTypesForGrade(grade) {
  const idx = GRADES.indexOf(grade);
  const g1 = GRADES.indexOf("Grade 1");
  const g2 = GRADES.indexOf("Grade 2");
  const g3 = GRADES.indexOf("Grade 3");
  if (idx < g1) return ["Baseline Assessment"];
  const types = ["Baseline Assessment", "Pre-Assessment", "Formative", "Summative (End of Unit)"];
  if (idx >= g2) types.push("MAP Test");
  if (idx >= g3) types.push("End of Grade Test");
  types.push("Other");
  return types;
}

function AssessmentTab({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [showRubrics, setShowRubrics] = useState(false);
  const [showStandards, setShowStandards] = useState(false);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    studentId: "", planId: "", subject: "", criteria: "", level: ASSESS_LEVELS[1],
    feedback: "", rubricId: "", rows: [], standardId: "", assessmentType: ""
  });

  const isParent = profile?.role === "parent";
  const isStudent = profile?.role === "student";
  const isSelfOnly = isParent || isStudent;
  const isStaffScoped = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const linkedIds = profile?.student_ids || [];
  const myAssignedGrades = profile?.grades_assigned || [];
  const myGrades = isSelfOnly
    ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))]
    : isStaffScoped
    ? myAssignedGrades
    : [];

  const assessments = [...(data.assessments || [])]
    .filter((a) => !isSelfOnly || linkedIds.includes(a.studentId))
    .filter((a) => !isStaffScoped || myAssignedGrades.includes(a.grade))
    .sort((a, b) => b.date.localeCompare(a.date));
  const filtered = assessments
    .filter((a) => !gradeFilter || a.grade === gradeFilter)
    .filter((a) => !typeFilter || (a.assessmentType || "Summative (End of Unit)") === typeFilter);
  const rubrics = data.rubrics || [];
  const standards = data.standards || [];

  const eligiblePlans = form.studentId
    ? data.plans.filter((p) => {
        const student = data.students.find((s) => s.id === form.studentId);
        if (!student) return false;
        return !p.grades || p.grades.length === 0 || p.grades.includes(student.grade);
      })
    : data.plans;

  const applyRubric = (rubricId) => {
    const rubric = rubrics.find((r) => r.id === rubricId);
    setForm((f) => ({
      ...f,
      rubricId,
      subject: rubric && !f.subject ? (rubric.subject || f.subject) : f.subject,
      rows: rubric ? rubric.items.map((text) => ({ text, level: ASSESS_LEVELS[1] })) : []
    }));
  };

  const setRowLevel = (idx, level) => {
    setForm((f) => ({ ...f, rows: f.rows.map((r, i) => (i === idx ? { ...r, level } : r)) }));
  };

  const addAssessment = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    if (!form.assessmentType) {
      setFormError("Please choose an assessment type before saving.");
      return;
    }
    const usingRubric = form.rubricId && form.rows.length > 0;
    if (!usingRubric && !form.criteria.trim()) {
      setFormError("Please describe what was assessed, or choose a rubric.");
      return;
    }
    const plan = data.plans.find((p) => p.id === form.planId);
    const rubric = rubrics.find((r) => r.id === form.rubricId);
    const standard = standards.find((s) => s.id === form.standardId);
    const entry = {
      id: uid(),
      studentId: student.id,
      studentName: student.name,
      grade: student.grade,
      planId: plan ? plan.id : "",
      planTitle: plan ? plan.title : "",
      subject: form.subject,
      feedback: form.feedback,
      standardId: form.standardId,
      standardLabel: standard ? (standard.code ? `${standard.code} - ${standard.description}` : standard.description) : "",
      assessmentType: form.assessmentType,
      date: new Date().toISOString().slice(0, 10),
      ...(usingRubric
        ? { rubricName: rubric ? rubric.name : "", rows: form.rows }
        : { criteria: form.criteria, level: form.level })
    };
    persist({ ...data, assessments: [...(data.assessments || []), entry] });
    setForm({ studentId: "", planId: "", subject: "", criteria: "", level: ASSESS_LEVELS[1], feedback: "", rubricId: "", rows: [], standardId: "", assessmentType: "" });
    setFormError("");
    setGradeFilter(null);
    setShowAdd(false);
  };

  const removeAssessment = (id) => persist({ ...data, assessments: (data.assessments || []).filter((a) => a.id !== id) });

  const levelCounts = useMemo(() => {
    const counts = {};
    ASSESS_LEVELS.forEach((l) => { counts[l] = 0; });
    filtered.forEach((a) => {
      if (a.level) counts[a.level] = (counts[a.level] || 0) + 1;
      (a.rows || []).forEach((r) => { if (r.level) counts[r.level] = (counts[r.level] || 0) + 1; });
    });
    return counts;
  }, [filtered]);

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("nav.assessment")}</p>
        <h1>{t(pluralKey("assessment.records", filtered.length, language), { n: filtered.length })}</h1>
        {filtered.length > 0 && (
          <div className="bsf-attend-segbar" style={{ marginTop: 14 }}>
            {ASSESS_LEVELS.filter((l) => levelCounts[l] > 0).map((l) => (
              <span key={l} style={{ flex: levelCounts[l], background: getLevelColor(l) }} />
            ))}
          </div>
        )}
      </div>

      <div className="bsf-screen-head bsf-screen-head-wrap" style={{ marginBottom: 0 }}>
        <span />
        {!isSelfOnly && (
          <div className="bsf-screen-head-actions">
            <button className="bsf-btn bsf-btn-ghost" onClick={() => setShowStandards(true)}>Standards</button>
            <button className="bsf-btn bsf-btn-ghost" onClick={() => setShowRubrics(true)}>Rubrics</button>
            <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }} disabled={data.students.length === 0}><Plus size={16} /> Add</button>
          </div>
        )}
      </div>
      {data.students.length === 0 && !isSelfOnly && <p className="bsf-empty">Add students first, then record assessments here.</p>}
      {isSelfOnly && filtered.length === 0 && <p className="bsf-empty">{isStudent ? "No assessment records yet." : t("assessment.emptyChild")}</p>}

      {data.students.length > 0 && (!isSelfOnly && !isStaffScoped || myGrades.length > 1) && (
        <section className="bsf-card">
          <h2>{t("common.filterByGrade")}</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>{t("common.all")}</button>
            {((isSelfOnly || isStaffScoped) ? myGrades : GRADES).map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{isParent ? gradeLabel(g, language) : g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-card">
        <h2>{t("common.filterByType")}</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${typeFilter === null ? "active" : ""}`} onClick={() => setTypeFilter(null)}>{t("common.all")}</button>
          {ASSESSMENT_TYPES.map((tp) => (
            <button key={tp} className={`bsf-chip ${typeFilter === tp ? "active" : ""}`} onClick={() => setTypeFilter(tp)}>{tLabel(t, "assessType.", tp)}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">{t("child.noAssessments")}</p>}
        {filtered.map((a) => {
          const student = data.students.find((s) => s.id === a.studentId);
          return (
            <div key={a.id} className="bsf-card bsf-portfolio-entry">
              <StudentThumb photo={student?.photo} />
              <div style={{ flex: 1 }}>
                <div className="bsf-row-head">
                  {a.rows && a.rows.length > 0 ? (
                    <span className="bsf-tag">{a.rubricName || t("common.rubric")}</span>
                  ) : (
                    <span
                      className="bsf-status-pill"
                      style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}
                    >
                      {tLabel(t, "level.", a.level)}
                    </span>
                  )}
                  <span className="bsf-muted">{isParent ? formatDateLong(a.date, language) : a.date}</span>
                </div>
                <strong>{a.studentName}</strong>
                {a.assessmentType && <span className="bsf-minitag" style={{ marginTop: 2, display: "inline-block" }}>{tLabel(t, "assessType.", a.assessmentType)}</span>}
                <p className="bsf-muted">{isParent ? gradeLabel(a.grade, language) : a.grade}{a.subject ? ` · ${a.subject}` : ""}{a.planTitle ? ` · ${a.planTitle}` : ""}</p>
                {a.rows && a.rows.length > 0 ? (
                  <div className="bsf-rubric-rows">
                    {a.rows.map((r, i) => (
                      <div key={i} className="bsf-rubric-row">
                        <span>{r.text}</span>
                        <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>
                          {tLabel(t, "level.", r.level)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>{a.criteria}</p>
                )}
                {a.feedback && <p className="bsf-muted">{a.feedback}</p>}
                {a.standardLabel && <p className="bsf-muted">{t("assessment.standard")} {a.standardLabel}</p>}
              </div>
              {!isSelfOnly && <button className="bsf-iconbtn" onClick={() => removeAssessment(a.id)} aria-label="Remove"><Trash2 size={16} /></button>}
            </div>
          );
        })}
      </section>

      {showAdd && (
        <Modal title="New assessment" onClose={() => setShowAdd(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value, planId: "", assessmentType: "" })}>
              <option value="">Choose a student</option>
              {(isStaffScoped ? data.students.filter((s) => myAssignedGrades.includes(s.grade)) : data.students)
                .filter((s) => GRADES.indexOf(s.grade) >= GRADES.indexOf("Grade 1"))
                .map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
            <p className="bsf-muted" style={{ marginTop: 4 }}>
              Pre-N through Kindergarten aren't shown here, their assessment record is their Portfolio.
            </p>
          </Field>
          {form.studentId && (
            <Field label="Assessment type">
              <div className="bsf-chiprow">
                {assessmentTypesForGrade(data.students.find((s) => s.id === form.studentId)?.grade).map((t) => (
                  <button key={t} type="button" className={`bsf-chip ${form.assessmentType === t ? "active" : ""}`} onClick={() => setForm({ ...form, assessmentType: t })}>{t}</button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Linked unit plan (optional)">
            <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              <option value="">No unit plan</option>
              {eligiblePlans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math, Literacy" />
          </Field>
          <Field label="Use a rubric (optional)">
            <select value={form.rubricId} onChange={(e) => applyRubric(e.target.value)}>
              <option value="">No rubric, use free text below</option>
              {rubrics.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Linked standard (optional)">
            <select value={form.standardId} onChange={(e) => setForm({ ...form, standardId: e.target.value })}>
              <option value="">No standard</option>
              {standards.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} - ` : ""}{s.description}</option>)}
            </select>
          </Field>

          {form.rows.length > 0 ? (
            <div className="bsf-rubric-form">
              {form.rows.map((row, idx) => (
                <div key={idx} className="bsf-rubric-form-row">
                  <p className="bsf-rubric-form-label">{row.text}</p>
                  <div className="bsf-chiprow">
                    {ASSESS_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        className={`bsf-chip ${row.level === lvl ? "active" : ""}`}
                        onClick={() => setRowLevel(idx, lvl)}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Field label="What was assessed">
                <input value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} placeholder="e.g. Adding two digit numbers" />
              </Field>
              <Field label="Level">
                <div className="bsf-chiprow">
                  {ASSESS_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`bsf-chip ${form.level === lvl ? "active" : ""}`}
                      onClick={() => setForm({ ...form, level: lvl })}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field label="Feedback">
            <textarea rows={3} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} placeholder="Notes for the student or family" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addAssessment}>Save assessment</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {showRubrics && <RubricLibraryModal data={data} persist={persist} onClose={() => setShowRubrics(false)} />}
      {showStandards && <StandardsLibraryModal data={data} persist={persist} onClose={() => setShowStandards(false)} />}
    </div>
  );
}

export { StandardsLibraryModal, AssessmentTab };

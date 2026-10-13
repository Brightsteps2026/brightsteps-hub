import { useMemo, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { useAuth } from "../LoginGate";
import { GRADES, THEMES } from "../data/constants";
import { uid } from "../lib/format";
import { Field } from "../ui/common";

// Unit planner (staff screen, English only).
// Four stages: Understand, Assess, Inquire, Reflect.
// Grades 6 and 7 use global contexts and a statement of inquiry instead of themes.
// Older units keep every field they had; fields from the old planner that no
// longer have a place are shown read-only under "From the earlier planner".

export const KEY_CONCEPTS = ["Form", "Function", "Causation", "Change", "Connection", "Perspective", "Responsibility"];

export const MIDDLE_KEY_CONCEPTS = [
  "Aesthetics", "Change", "Communication", "Communities", "Connections", "Creativity",
  "Culture", "Development", "Form", "Global interactions", "Identity", "Logic",
  "Perspective", "Relationships", "Systems", "Time, place and space"
];

export const GLOBAL_CONTEXTS = [
  "Identities and relationships",
  "Orientation in space and time",
  "Personal and cultural expression",
  "Scientific and technical innovation",
  "Globalization and sustainability",
  "Fairness and development"
];

export const UNIT_SUBJECTS = [
  "Literacy", "Math", "Science", "Social studies", "French", "Art", "Music",
  "PE & health", "Life skills", "Whole school"
];

const MIDDLE_GRADES = ["Grade 6", "Grade 7"];
const OBSERVATION_GRADES = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2"];

export const STATUS = {
  draft: { label: "Draft", bg: "#FBF0DC", fg: "#8A6420" },
  submitted: { label: "Submitted for review", bg: "#E4EDF7", fg: "#2F5E8A" },
  approved: { label: "Approved", bg: "#E6F2EC", fg: "#2F7A5C" },
  changes: { label: "Changes requested", bg: "#F5E4E6", fg: "#801524" }
};

export const isMiddleUnit = (grades) =>
  (grades || []).length > 0 && (grades || []).every((g) => MIDDLE_GRADES.includes(g));

export const planSubjects = (p) =>
  (p.subjects && p.subjects.length > 0) ? p.subjects.join(", ") : (p.subject || "");

export const EMPTY_UNIT = {
  grades: [], theme: "", subjects: [], subject: "", title: "", startDate: "", endDate: "",
  centralIdea: "", keyConceptList: [], keyConcepts: "", relatedConcepts: "", linesOfInquiry: "",
  teacherQuestions: "", keyVocabulary: "",
  globalContext: "", exploration: "", middleKeyConcept: "", statementOfInquiry: "",
  factualQuestions: "", conceptualQuestions: "", debatableQuestions: "",
  assessmentSummative: "", successCriteria: [""], standardIds: [],
  atlSkills: "", selFocus: "", lifeSkillsFocus: "",
  tuningIn: "", findingOut: "", sortingOut: "", goingFurther: "", takingAction: "",
  studentQuestions: [], assessmentFormative: "", differentiation: "", languageSupport: "", resources: "",
  lessonPlanFiles: [],
  evidenceNotes: "", evidenceLink: "", evidenceFiles: [], studentReflection: "", reflection: "", studentAction: "",
  status: "draft", coordinatorFeedback: "", comments: []
};

const STAGES = ["Understand", "Assess", "Inquire", "Reflect"];

const hint = { margin: "-6px 0 12px", fontSize: 12, color: "#5F6B6D", fontWeight: 400 };
const stageHead = { display: "flex", alignItems: "center", gap: 12, margin: "4px 0 16px" };
const stageNum = { width: 34, height: 34, borderRadius: "50%", background: "#801524", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, flex: "none" };
const phaseBox = { border: "1px solid #EAD7DA", borderRadius: 12, padding: 12, background: "#FCFAF4", marginBottom: 12 };
const legacyBox = { border: "1px dashed #EAD7DA", borderRadius: 12, padding: 12, marginTop: 8, fontSize: 13, color: "#3B4A4C" };

// A labelled group for chips (a <label> around buttons would make taps misfire).
function Group({ label, children }) {
  return (
    <div className="bsf-field" role="group" aria-label={label}>
      <span>{label}</span>
      {children}
    </div>
  );
}

function Chips({ options, selected, onToggle, single = false }) {
  return (
    <div className="bsf-chiprow">
      {options.map((o) => {
        const on = single ? selected === o : (selected || []).includes(o);
        return (
          <button key={o} type="button" className={`bsf-chip ${on ? "active" : ""}`} onClick={() => onToggle(o)}>{o}</button>
        );
      })}
    </div>
  );
}

function Stage({ n, title, sub, children }) {
  return (
    <section className="bsf-card">
      <div style={stageHead}>
        <div style={stageNum}>{n}</div>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p className="bsf-muted" style={{ margin: "2px 0 0" }}>{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function UnitPlanner({ plan, data, onSave, onClose, initialStage = 0 }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [u, setU] = useState(() => {
    const base = { ...EMPTY_UNIT, ...(plan || {}) };
    if (!plan?.subjects && plan?.subject) base.subjects = [];
    if (!base.successCriteria || base.successCriteria.length === 0) base.successCriteria = [""];
    return base;
  });
  const [stage, setStage] = useState(initialStage);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [noteText, setNoteText] = useState("");

  const set = (k, v) => { setU((x) => ({ ...x, [k]: v })); setDirty(true); setError(""); };
  const toggleIn = (k, v, max) => {
    const cur = u[k] || [];
    if (cur.includes(v)) return set(k, cur.filter((x) => x !== v));
    if (max && cur.length >= max) return;
    set(k, [...cur, v]);
  };

  const middle = isMiddleUnit(u.grades);
  const observation = (u.grades || []).length > 0 && u.grades.every((g) => OBSERVATION_GRADES.includes(g));
  const standards = data?.standards || [];
  const st = STATUS[u.status] || STATUS.draft;

  const legacy = useMemo(() => [
    ["Subject", !(u.subjects || []).length ? u.subject : ""],
    ["Learning outcomes", u.learningOutcomes],
    ["Learner attributes focus", u.learnerProfileFocus],
    ["Lesson plan notes", u.lessonPlanText],
    ["Lesson plan link", u.lessonPlanLink]
  ].filter(([, v]) => v && String(v).trim()), [u]);

  const save = (patch = {}) => {
    const next = { ...u, ...patch };
    if (!next.title.trim()) { setError("Give the unit a title (Stage 1)."); setStage(0); return false; }
    if (next.grades.length === 0) { setError("Choose at least one grade (Stage 1)."); setStage(0); return false; }
    next.successCriteria = (next.successCriteria || []).map((s) => s.trim()).filter(Boolean);
    next.keyConcepts = (middle ? next.middleKeyConcept : (next.keyConceptList || []).join(", ")) || next.keyConcepts;
    if ((next.subjects || []).length) next.subject = next.subjects.join(", ");
    if (!next.id) next.id = uid();
    onSave(next);
    setU({ ...next, successCriteria: next.successCriteria.length ? next.successCriteria : [""] });
    setDirty(false);
    return true;
  };

  const close = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    onClose();
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    const c = { id: uid(), author: profile?.full_name || "Team member", text: noteText.trim(), date: new Date().toISOString().slice(0, 10) };
    set("comments", [...(u.comments || []), c]);
    setNoteText("");
  };

  const ta = (k, rows, placeholder) => (
    <textarea rows={rows} value={u[k] || ""} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />
  );

  return (
    <div className="bsf-screen">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <button className="bsf-textbtn" onClick={close} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowLeft size={16} /> All units</button>
          <h1 style={{ margin: "6px 0 0" }}>{u.title || "New unit"}</h1>
          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>
            {[(u.grades || []).join(", "), middle ? u.globalContext : u.theme, planSubjects(u)].filter(Boolean).join(" · ") || "Choose grades and a theme to start"}
          </p>
        </div>
        <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 600 }}>{st.label}</span>
      </div>

      <nav aria-label="Planning stages" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, margin: "16px 0" }}>
        {STAGES.map((s, i) => (
          <button key={s} type="button" onClick={() => setStage(i)}
            style={{ minHeight: 44, borderRadius: 12, border: i === stage ? "1px solid #801524" : "1px solid #EAD7DA", background: i === stage ? "#801524" : "#fff", color: i === stage ? "#fff" : "#3B4A4C", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 6px" }}>
            {i + 1} · {s}
          </button>
        ))}
      </nav>

      {stage === 0 && (
        <Stage n={1} title="Understand" sub={middle ? "Global context, statement of inquiry and inquiry questions." : "What is this unit about, and what big idea should students leave with?"}>
          <Group label="Grades">
            <Chips options={GRADES} selected={u.grades} onToggle={(g) => toggleIn("grades", g)} />
          </Group>
          {middle && <p style={hint}>Grades 6–7 only: the form uses global contexts instead of themes.</p>}
          <Field label="Unit title">
            <input value={u.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Our bodies, our choices" />
          </Field>
          <Group label={middle ? "Subject group" : "Subjects"}>
            <Chips options={UNIT_SUBJECTS} selected={u.subjects} onToggle={(s) => toggleIn("subjects", s)} />
          </Group>
          <div className="bsf-two-col">
            <Field label="Start date"><input type="date" value={u.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
            <Field label="End date"><input type="date" value={u.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
          </div>

          {!middle && (
            <>
              <Field label="Theme">
                <select value={u.theme} onChange={(e) => set("theme", e.target.value)}>
                  <option value="">Choose a theme</option>
                  {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  {u.theme && !THEMES.includes(u.theme) && <option value={u.theme}>{u.theme}</option>}
                </select>
              </Field>
              <Field label="Central idea">{ta("centralIdea", 2, "The big idea students should leave with")}</Field>
              <Group label="Key concepts (up to 3)">
                <Chips options={KEY_CONCEPTS} selected={u.keyConceptList} onToggle={(c) => toggleIn("keyConceptList", c, 3)} />
              </Group>
              {!(u.keyConceptList || []).length && u.keyConcepts && <p style={hint}>Saved before: {u.keyConcepts}</p>}
              <div className="bsf-two-col">
                <Field label="Related concepts"><input value={u.relatedConcepts} onChange={(e) => set("relatedConcepts", e.target.value)} placeholder="e.g. Nutrition, systems, habits" /></Field>
                <Field label="Key vocabulary"><input value={u.keyVocabulary} onChange={(e) => set("keyVocabulary", e.target.value)} placeholder="Words students should know by the end" /></Field>
              </div>
              <Field label="Lines of inquiry">{ta("linesOfInquiry", 3, "One per line")}</Field>
              <Field label="Teacher questions">{ta("teacherQuestions", 3, "The guiding questions you will ask, one per line")}</Field>
            </>
          )}

          {middle && (
            <>
              <div className="bsf-two-col">
                <Field label="Global context">
                  <select value={u.globalContext} onChange={(e) => set("globalContext", e.target.value)}>
                    <option value="">Choose a global context</option>
                    {GLOBAL_CONTEXTS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Exploration"><input value={u.exploration} onChange={(e) => set("exploration", e.target.value)} placeholder="e.g. Identity formation; peer influence" /></Field>
              </div>
              <Group label="Key concept (one)">
                <Chips single options={MIDDLE_KEY_CONCEPTS} selected={u.middleKeyConcept} onToggle={(c) => set("middleKeyConcept", u.middleKeyConcept === c ? "" : c)} />
              </Group>
              <Field label="Related concepts"><input value={u.relatedConcepts} onChange={(e) => set("relatedConcepts", e.target.value)} placeholder="e.g. Audience, point of view, voice" /></Field>
              <Field label="Statement of inquiry">{ta("statementOfInquiry", 2, "One sentence joining the key concept, related concepts and global context")}</Field>
              <Field label="Factual questions">{ta("factualQuestions", 2, "One per line")}</Field>
              <Field label="Conceptual questions">{ta("conceptualQuestions", 2, "One per line")}</Field>
              <Field label="Debatable questions">{ta("debatableQuestions", 2, "One per line")}</Field>
              <Field label="Key vocabulary"><input value={u.keyVocabulary} onChange={(e) => set("keyVocabulary", e.target.value)} /></Field>
            </>
          )}
        </Stage>
      )}

      {stage === 1 && (
        <Stage n={2} title="Assess" sub="Decide how students will show their understanding before planning the activities.">
          <Field label="Summative task">{ta("assessmentSummative", 3, "The final task or product that shows understanding")}</Field>
          <Group label="Success criteria">
            {(u.successCriteria || [""]).map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input style={{ flex: 1 }} value={c} placeholder="I can…" aria-label={`Success criterion ${i + 1}`}
                  onChange={(e) => set("successCriteria", u.successCriteria.map((x, j) => (j === i ? e.target.value : x)))} />
                <button type="button" className="bsf-iconbtn" aria-label="Remove criterion"
                  onClick={() => set("successCriteria", u.successCriteria.length > 1 ? u.successCriteria.filter((_, j) => j !== i) : [""])}><X size={16} /></button>
              </div>
            ))}
            <button type="button" className="bsf-textbtn" style={{ alignSelf: "flex-start" }} onClick={() => set("successCriteria", [...(u.successCriteria || []), ""])}><Plus size={14} /> Add a criterion</button>
          </Group>
          <p style={hint}>Written in student language and shared with the class at the start of the unit.</p>
          <div style={{ background: "#E4EDF7", color: "#2F5E8A", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
            {(u.grades || []).length === 0
              ? "Gradebook: choose grades in Stage 1."
              : observation
                ? "Gradebook: assessed by observation (Emerging / Developing / Meeting / Exceeding). Record it in the gradebook when the task is done."
                : "Gradebook: enter this task as a Summative assessment (70%) with a score once students have done it."}
          </div>
          <Group label="Standards addressed">
            {standards.length === 0
              ? <p className="bsf-empty">No standards in your library yet. Add some from Assessment → Standards.</p>
              : <div className="bsf-chiprow">
                  {standards.map((s) => (
                    <button key={s.id} type="button" className={`bsf-chip ${(u.standardIds || []).includes(s.id) ? "active" : ""}`} onClick={() => toggleIn("standardIds", s.id)}>
                      {s.code || s.description.slice(0, 24)}
                    </button>
                  ))}
                </div>}
          </Group>
          <Field label="ATL focus"><input value={u.atlSkills} onChange={(e) => set("atlSkills", e.target.value)} placeholder="e.g. Communication, research" /></Field>
          <Field label="SEL focus"><input value={u.selFocus} onChange={(e) => set("selFocus", e.target.value)} placeholder="e.g. Self-management" /></Field>
          <Field label="Life skills focus"><input value={u.lifeSkillsFocus} onChange={(e) => set("lifeSkillsFocus", e.target.value)} placeholder="e.g. Healthy eating" /></Field>
          <p style={hint}>These match the three non-academic areas on the report card.</p>
        </Stage>
      )}

      {stage === 2 && (
        <Stage n={3} title="Inquire" sub="The learning journey, phase by phase.">
          {[
            ["tuningIn", "Tuning in · provocation", "How will you spark curiosity and find out what students already know?"],
            ["findingOut", "Finding out", "How will students gather new information?"],
            ["sortingOut", "Sorting out", "How will they make sense of it?"],
            ["goingFurther", "Going further", "How will they go deeper or test their ideas?"],
            ["takingAction", "Taking action", "What might students do or change beyond the classroom?"]
          ].map(([k, t, h]) => (
            <div key={k} style={phaseBox}>
              <Field label={t}>{ta(k, 3, h)}</Field>
            </div>
          ))}

          <Group label="Student questions (wonder wall)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(u.studentQuestions || []).map((q, i) => (
                <span key={i} style={{ background: "#FBF0DC", color: "#6B4A12", borderRadius: 10, padding: "6px 6px 6px 12px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {q}
                  <button type="button" className="bsf-iconbtn" style={{ width: 28, height: 28 }} aria-label="Remove question"
                    onClick={() => set("studentQuestions", u.studentQuestions.filter((_, j) => j !== i))}><X size={14} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input style={{ flex: 1 }} value={newQuestion} placeholder="Type a student's question" aria-label="New student question"
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && newQuestion.trim()) { set("studentQuestions", [...(u.studentQuestions || []), newQuestion.trim()]); setNewQuestion(""); } }} />
              <button type="button" className="bsf-btn" onClick={() => { if (newQuestion.trim()) { set("studentQuestions", [...(u.studentQuestions || []), newQuestion.trim()]); setNewQuestion(""); } }}>Add</button>
            </div>
          </Group>
          <p style={hint}>Add the class's questions as they come up during the unit.</p>

          <Field label="Formative checks">{ta("assessmentFormative", 3, "Quick checks along the way")}</Field>
          <Field label="Differentiation">{ta("differentiation", 3, "How the unit adapts for different learners")}</Field>
          <Field label="Language support & French connections">{ta("languageSupport", 3, "Support for English learners; links with French class")}</Field>
          <Field label="Resources and materials">{ta("resources", 2, "Books, websites, supplies")}</Field>
          <Group label="Lesson plans and files">
            <AttachmentField folder="planning" files={u.lessonPlanFiles} onChange={(files) => set("lessonPlanFiles", files)} />
          </Group>
        </Stage>
      )}

      {stage === 3 && (
        <Stage n={4} title="Reflect" sub="Filled in during and after the unit.">
          <Field label="Evidence of learning">{ta("evidenceNotes", 3, "Photos, student work, what it shows")}</Field>
          <Field label="Evidence link (optional)"><input value={u.evidenceLink} onChange={(e) => set("evidenceLink", e.target.value)} placeholder="Link to photos or documents" /></Field>
          <Group label="Evidence files">
            <AttachmentField folder="planning" files={u.evidenceFiles} onChange={(files) => set("evidenceFiles", files)} />
          </Group>
          <Field label="Student reflection">{ta("studentReflection", 3, "What students said they learned and what they still wonder")}</Field>
          <Field label="Teacher reflection">{ta("reflection", 3, "What worked, what you would change next time")}</Field>
          <Field label="Student action that happened">{ta("studentAction", 3, "What students actually did beyond the classroom")}</Field>

          <div style={{ background: "#F5E4E6", borderRadius: 12, padding: "12px 14px", margin: "8px 0 16px" }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#801524" }}>Coordinator feedback</p>
            {isAdmin
              ? <textarea rows={3} style={{ width: "100%", boxSizing: "border-box" }} value={u.coordinatorFeedback || ""} aria-label="Coordinator feedback"
                  onChange={(e) => set("coordinatorFeedback", e.target.value)} placeholder="Feedback for the teacher" />
              : <p style={{ margin: 0, fontSize: 14 }}>{u.coordinatorFeedback || "No feedback yet."}</p>}
          </div>

          <h3 className="bsf-subheading">Team notes</h3>
          {(u.comments || []).length === 0 && <p className="bsf-empty">No notes yet.</p>}
          {(u.comments || []).map((c) => (
            <div key={c.id} className="bsf-comment">
              <div className="bsf-row-head"><strong>{c.author}</strong><span className="bsf-muted">{c.date}</span></div>
              <p>{c.text}</p>
              <button className="bsf-textbtn" onClick={() => set("comments", u.comments.filter((x) => x.id !== c.id))}>Remove</button>
            </div>
          ))}
          <Field label="Add a note">
            <textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Share a thought with the team" />
          </Field>
          <button type="button" className="bsf-btn" onClick={addNote}>Post note</button>

          {legacy.length > 0 && (
            <div style={legacyBox}>
              <p style={{ margin: "0 0 6px", fontWeight: 600 }}>From the earlier planner</p>
              {legacy.map(([k, v]) => (
                <p key={k} style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}><strong>{k}:</strong> {v}</p>
              ))}
            </div>
          )}
        </Stage>
      )}

      {error && <p className="bsf-formerror">{error}</p>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {stage > 0 && <button type="button" className="bsf-btn-ghost" onClick={() => setStage(stage - 1)}>Back</button>}
          {stage < 3 && <button type="button" className="bsf-btn-ghost" onClick={() => setStage(stage + 1)}>Next: {STAGES[stage + 1]}</button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="bsf-btn-ghost" onClick={() => save()}>{dirty ? "Save" : "Saved"}</button>
          {!isAdmin && (u.status === "draft" || u.status === "changes") && (
            <button type="button" className="bsf-btn" onClick={() => save({ status: "submitted" }) && alert("Sent for review.")}>Submit for review</button>
          )}
          {isAdmin && (
            <>
              <button type="button" className="bsf-btn-ghost" onClick={() => save({ status: "changes" })}>Request changes</button>
              <button type="button" className="bsf-btn" onClick={() => save({ status: "approved" })}>Approve</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { useAuth } from "../LoginGate";
import { GRADES, THEMES } from "../data/constants";
import { uid } from "../lib/format";
import { Field } from "../ui/common";
import { supabase } from "../lib/supabaseClient";

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
  "PE & health", "SEL", "Life skills", "Whole school"
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
  status: "draft", coordinatorFeedback: "", comments: [], changeRequests: []
};

const STAGES = ["Understand", "Assess", "Inquire", "Reflect"];

// Every place in the planner a coordinator can point a change request at.
// [key, label, stage index, which units show it: "all" | "middle" | "primary"]
const SECTIONS = [
  ["grades", "Grades", 0, "all"],
  ["title", "Unit title", 0, "all"],
  ["subjects", "Subjects", 0, "all"],
  ["dates", "Start and end dates", 0, "all"],
  ["theme", "Theme", 0, "primary"],
  ["centralIdea", "Central idea", 0, "primary"],
  ["keyConcepts", "Key concepts", 0, "all"],
  ["relatedConcepts", "Related concepts", 0, "all"],
  ["keyVocabulary", "Key vocabulary", 0, "all"],
  ["linesOfInquiry", "Lines of inquiry", 0, "primary"],
  ["teacherQuestions", "Teacher questions", 0, "primary"],
  ["globalContext", "Global context", 0, "middle"],
  ["exploration", "Exploration", 0, "middle"],
  ["statementOfInquiry", "Statement of inquiry", 0, "middle"],
  ["factualQuestions", "Factual questions", 0, "middle"],
  ["conceptualQuestions", "Conceptual questions", 0, "middle"],
  ["debatableQuestions", "Debatable questions", 0, "middle"],
  ["assessmentSummative", "Summative task", 1, "all"],
  ["successCriteria", "Success criteria", 1, "all"],
  ["standardIds", "Standards addressed", 1, "all"],
  ["atlSkills", "ATL focus", 1, "all"],
  ["selFocus", "SEL focus", 1, "all"],
  ["lifeSkillsFocus", "Life skills focus", 1, "all"],
  ["tuningIn", "Tuning in · provocation", 2, "all"],
  ["findingOut", "Finding out", 2, "all"],
  ["sortingOut", "Sorting out", 2, "all"],
  ["goingFurther", "Going further", 2, "all"],
  ["takingAction", "Taking action", 2, "all"],
  ["studentQuestions", "Student questions (wonder wall)", 2, "all"],
  ["assessmentFormative", "Formative checks", 2, "all"],
  ["differentiation", "Differentiation", 2, "all"],
  ["languageSupport", "Language support & French connections", 2, "all"],
  ["resources", "Resources and materials", 2, "all"],
  ["lessonPlanFiles", "Lesson plans and files", 2, "all"],
  ["evidenceNotes", "Evidence of learning", 3, "all"],
  ["evidenceLink", "Evidence link", 3, "all"],
  ["evidenceFiles", "Evidence files", 3, "all"],
  ["studentReflection", "Student reflection", 3, "all"],
  ["reflection", "Teacher reflection", 3, "all"],
  ["studentAction", "Student action that happened", 3, "all"]
];
const GENERAL = "general";
const sectionInfo = (k) => {
  if (k === GENERAL) return { label: "Whole unit", stage: null };
  const s = SECTIONS.find(([key]) => key === k);
  return s ? { label: s[1], stage: s[2] } : { label: k, stage: null };
};
const openCount = (p) => (p?.changeRequests || []).filter((r) => !r.done).length;
export { openCount };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const reqBox = { borderLeft: "4px solid #801524", background: "#F5E4E6", borderRadius: 10, padding: "10px 12px", margin: "6px 0" };
const doneBox = { borderLeft: "4px solid #2F7A5C", background: "#E6F2EC", borderRadius: 10, padding: "10px 12px", margin: "6px 0" };
const badge = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, borderRadius: 999, background: "#801524", color: "#fff", fontSize: 11, fontWeight: 700, padding: "0 6px", marginLeft: 6 };

// One change request, with the teacher's "fixed" action and the coordinator's controls.
function ChangeItem({ r, isAdmin, onUpdate, onRemove, onGoTo }) {
  const [reply, setReply] = useState(r.reply || "");
  const where = sectionInfo(r.section);
  return (
    <div style={r.done ? doneBox : reqBox}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
        <strong style={{ color: r.done ? "#2F7A5C" : "#801524" }}>
          {r.done ? "Fixed" : "Change requested"}{onGoTo ? ` · ${where.stage === null ? "" : `Stage ${where.stage + 1} · `}${where.label}` : ""}
        </strong>
        <span className="bsf-muted">{r.author} · {r.date}</span>
      </div>
      <p style={{ margin: "4px 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{r.text}</p>
      {r.done && r.reply && <p style={{ margin: "4px 0", fontSize: 13 }}><strong>Teacher:</strong> {r.reply}</p>}
      {r.done && r.doneDate && <p className="bsf-muted" style={{ margin: 0, fontSize: 12 }}>Marked fixed {r.doneDate}{r.doneBy ? ` by ${r.doneBy}` : ""}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
        {onGoTo && where.stage !== null && <button type="button" className="bsf-textbtn" onClick={onGoTo}>Go to this section</button>}
        {!r.done && !isAdmin && (
          <>
            <input style={{ flex: 1, minWidth: 160 }} value={reply} onChange={(e) => setReply(e.target.value)}
              placeholder="Reply to the coordinator (optional)" aria-label="Reply to the coordinator" />
            <button type="button" className="bsf-btn" onClick={() => onUpdate({ done: true, reply: reply.trim() })}>Mark as fixed</button>
          </>
        )}
        {r.done && <button type="button" className="bsf-textbtn" onClick={() => onUpdate({ done: false })}>Reopen</button>}
        {isAdmin && <button type="button" className="bsf-textbtn" onClick={onRemove}>Remove</button>}
      </div>
    </div>
  );
}

// Shown under each section: its change requests, and for the coordinator a link to add one there.
function ChangeNotes({ k, requests, isAdmin, onAdd, onUpdate, onRemove }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const mine = requests.filter((r) => r.section === k);
  if (!isAdmin && mine.length === 0) return null;
  const add = () => { if (!text.trim()) return; onAdd(k, text.trim()); setText(""); setOpen(false); };
  return (
    <div id={`chg-${k}`} style={{ margin: "-4px 0 12px" }}>
      {mine.map((r) => (
        <ChangeItem key={r.id} r={r} isAdmin={isAdmin} onUpdate={(p) => onUpdate(r.id, p)} onRemove={() => onRemove(r.id)} />
      ))}
      {isAdmin && !open && (
        <button type="button" className="bsf-textbtn" style={{ fontSize: 12, color: "#801524" }} onClick={() => setOpen(true)}>
          + Request a change here
        </button>
      )}
      {isAdmin && open && (
        <div style={{ ...reqBox, background: "#fff" }}>
          <textarea rows={2} style={{ width: "100%", boxSizing: "border-box" }} value={text} autoFocus
            onChange={(e) => setText(e.target.value)} placeholder="What needs to change in this section?" aria-label="Change needed in this section" />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" className="bsf-btn" onClick={add}>Add</button>
            <button type="button" className="bsf-btn-ghost" onClick={() => { setOpen(false); setText(""); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Top-of-planner list of every change request, with a "where" picker for the coordinator.
function ChangeSummary({ requests, isAdmin, middle, feedback, onAdd, onUpdate, onRemove, onGoTo }) {
  const [section, setSection] = useState(GENERAL);
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = requests.filter((r) => !r.done);
  const done = requests.filter((r) => r.done);
  if (!isAdmin && requests.length === 0 && !feedback) return null;
  const visible = SECTIONS.filter(([, , , who]) => who === "all" || (middle ? who === "middle" : who === "primary"));
  const add = () => { if (!text.trim()) return; onAdd(section, text.trim()); setText(""); };
  return (
    <section className="bsf-card" style={{ borderColor: open.length ? "#801524" : undefined }}>
      <h2 style={{ marginTop: 0 }}>
        Changes requested
        {open.length > 0 && <span style={badge}>{open.length}</span>}
      </h2>
      <p className="bsf-muted" style={{ margin: "0 0 8px" }}>
        {open.length === 0
          ? (requests.length ? "Every change has been marked fixed." : "No changes requested.")
          : isAdmin ? `${open.length} still to fix.` : `${open.length} to fix. Open each section, make the change, then mark it fixed.`}
      </p>
      {!isAdmin && feedback && (
        <div style={{ ...reqBox, background: "#FCFAF4" }}>
          <strong style={{ fontSize: 12, color: "#801524" }}>General feedback</strong>
          <p style={{ margin: "4px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{feedback}</p>
        </div>
      )}
      {open.map((r) => (
        <ChangeItem key={r.id} r={r} isAdmin={isAdmin} onUpdate={(p) => onUpdate(r.id, p)} onRemove={() => onRemove(r.id)} onGoTo={() => onGoTo(r.section)} />
      ))}
      {done.length > 0 && (
        <button type="button" className="bsf-textbtn" onClick={() => setShowDone(!showDone)}>
          {showDone ? "Hide" : "Show"} fixed changes ({done.length})
        </button>
      )}
      {showDone && done.map((r) => (
        <ChangeItem key={r.id} r={r} isAdmin={isAdmin} onUpdate={(p) => onUpdate(r.id, p)} onRemove={() => onRemove(r.id)} onGoTo={() => onGoTo(r.section)} />
      ))}
      {isAdmin && (
        <div style={{ marginTop: 12, borderTop: "1px solid #EAD7DA", paddingTop: 12 }}>
          <Field label="Where does the change need to be made?">
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value={GENERAL}>Whole unit (general)</option>
              {STAGES.map((s, i) => (
                <optgroup key={s} label={`Stage ${i + 1} · ${s}`}>
                  {visible.filter(([, , st]) => st === i).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="What needs to change?">
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Be specific, e.g. Add a success criterion for the oral presentation" />
          </Field>
          <button type="button" className="bsf-btn" onClick={add}>Add change request</button>
          <p style={{ ...hint, margin: "8px 0 0" }}>You can also use “+ Request a change here” under any section. When you are done, press “Request changes” at the bottom to send them to the teacher.</p>
        </div>
      )}
    </section>
  );
}

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

// Standards picker. Reads the same library as the Standards screen (gb_standards),
// limited to the unit's grades. Units saved before keep their picks: an older pick is
// matched through legacy_id, and anything only in the old list still shows.
function StandardsPicker({ grades, selected, oldList, onChange }) {
  const [lib, setLib] = useState(null);
  const [failed, setFailed] = useState(false);
  const [subject, setSubject] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    let live = true;
    supabase.from("gb_standards").select("id, legacy_id, code, subject, grade, description, sort")
      .order("grade").order("subject").order("sort").order("code")
      .then(({ data, error }) => {
        if (!live) return;
        if (error) { console.error(error); setFailed(true); setLib([]); } else setLib(data || []);
      });
    return () => { live = false; };
  }, []);

  const legacyIds = useMemo(() => new Set((lib || []).map((s) => s.legacy_id).filter(Boolean)), [lib]);
  const all = useMemo(() => [
    ...(lib || []),
    ...(oldList || []).filter((s) => !legacyIds.has(s.id)).map((s) => ({ ...s, legacy_id: s.id, older: true }))
  ], [lib, oldList, legacyIds]);
  const isOn = (s) => selected.includes(s.id) || (s.legacy_id && selected.includes(s.legacy_id));
  const toggle = (s) => onChange(isOn(s)
    ? selected.filter((x) => x !== s.id && x !== s.legacy_id)
    : [...selected, s.id]);

  if (lib === null) return <p className="bsf-muted">Loading standards…</p>;
  if (!grades.length) return <p className="bsf-empty">Choose grades in Stage 1 to see their standards.</p>;

  const forGrades = all.filter((s) => !s.grade || grades.includes(s.grade));
  const chosen = all.filter(isOn);
  const subjects = [...new Set(forGrades.map((s) => s.subject || "Other"))].sort();
  const needle = q.trim().toLowerCase();
  const shown = forGrades.filter((s) => (!subject || (s.subject || "Other") === subject)
    && (!needle || `${s.code || ""} ${s.description || ""}`.toLowerCase().includes(needle)));
  const multiGrade = grades.length > 1;

  return (
    <div>
      {failed && <p className="bsf-muted" style={{ fontSize: 12 }}>Could not load the Standards library; showing the older list only.</p>}
      {chosen.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>Chosen · {chosen.length}</p>
          <div className="bsf-chiprow">
            {chosen.map((s) => (
              <button key={s.id} type="button" className="bsf-chip active" title={s.description} onClick={() => toggle(s)}>
                {s.code || (s.description || "").slice(0, 28)} ✕
              </button>
            ))}
          </div>
        </div>
      )}
      {forGrades.length === 0
        ? <p className="bsf-empty">No standards for {grades.join(", ")} yet. Add them on the Standards screen.</p>
        : <>
            <div className="bsf-two-col">
              <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter standards by subject">
                <option value="">All subjects ({forGrades.length})</option>
                {subjects.map((x) => <option key={x} value={x}>{x} ({forGrades.filter((s) => (s.subject || "Other") === x).length})</option>)}
              </select>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or words" aria-label="Search standards" />
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #EAD7DA", borderRadius: 10, marginTop: 8 }}>
              {shown.length === 0 && <p className="bsf-empty" style={{ padding: 10 }}>No standards match.</p>}
              {shown.map((s) => (
                <label key={s.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderBottom: "1px solid #F3E9EB", cursor: "pointer", background: isOn(s) ? "#F5E4E6" : "transparent", fontSize: 13 }}>
                  <input type="checkbox" checked={!!isOn(s)} onChange={() => toggle(s)} style={{ marginTop: 3 }} />
                  <span>
                    <strong>{s.code || "—"}</strong>{" "}{s.description}
                    <span className="bsf-muted" style={{ display: "block", fontSize: 11 }}>
                      {[s.subject, multiGrade ? s.grade : "", s.older ? "older list" : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>}
    </div>
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

  // Change requests pinned to a section of the planner.
  const requests = u.changeRequests || [];
  const addRequest = (section, text) => set("changeRequests", [...requests, {
    id: uid(), section, text, author: profile?.full_name || "Coordinator", date: today(), done: false
  }]);
  const updateRequest = (id, patch) => set("changeRequests", requests.map((r) => (r.id === id
    ? { ...r, ...patch, ...(patch.done === true ? { doneDate: today(), doneBy: profile?.full_name || "" } : {}), ...(patch.done === false ? { doneDate: "", doneBy: "" } : {}) }
    : r)));
  const removeRequest = (id) => set("changeRequests", requests.filter((r) => r.id !== id));
  const openByStage = STAGES.map((_, i) => requests.filter((r) => !r.done && sectionInfo(r.section).stage === i).length);
  const openTotal = requests.filter((r) => !r.done).length;
  const goTo = (section) => {
    const { stage: s } = sectionInfo(section);
    if (s === null) return;
    setStage(s);
    setTimeout(() => document.getElementById(`chg-${section}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };
  const pin = (k) => (
    <ChangeNotes k={k} requests={requests} isAdmin={isAdmin} onAdd={addRequest} onUpdate={updateRequest} onRemove={removeRequest} />
  );

  const submit = () => {
    if (openTotal > 0 && !window.confirm(`${openTotal} requested change${openTotal === 1 ? " is" : "s are"} not marked fixed yet. Submit anyway?`)) return;
    if (save({ status: "submitted" })) alert("Sent for review.");
  };
  const requestChanges = () => {
    if (openTotal === 0 && !(u.coordinatorFeedback || "").trim()
      && !window.confirm("You have not said where changes are needed. Send back to the teacher anyway?")) return;
    save({ status: "changes" });
  };
  const approve = () => {
    if (openTotal > 0 && !window.confirm(`${openTotal} requested change${openTotal === 1 ? " is" : "s are"} still open. Approve anyway?`)) return;
    save({ status: "approved" });
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
            {i + 1} · {s}{openByStage[i] > 0 && <span style={{ ...badge, background: i === stage ? "#fff" : "#801524", color: i === stage ? "#801524" : "#fff" }} aria-label={`${openByStage[i]} changes to fix`}>{openByStage[i]}</span>}
          </button>
        ))}
      </nav>

      <ChangeSummary requests={requests} isAdmin={isAdmin} middle={middle} feedback={(u.coordinatorFeedback || "").trim()} onAdd={addRequest} onUpdate={updateRequest} onRemove={removeRequest} onGoTo={goTo} />

      {stage === 0 && (
        <Stage n={1} title="Understand" sub={middle ? "Global context, statement of inquiry and inquiry questions." : "What is this unit about, and what big idea should students leave with?"}>
          <Group label="Grades">
            <Chips options={GRADES} selected={u.grades} onToggle={(g) => toggleIn("grades", g)} />
          </Group>
          {pin("grades")}
          {middle && <p style={hint}>Grades 6–7 only: the form uses global contexts instead of themes.</p>}
          <Field label="Unit title">
            <input value={u.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Our bodies, our choices" />
          </Field>
          {pin("title")}
          <Group label={middle ? "Subject group" : "Subjects"}>
            <Chips options={UNIT_SUBJECTS} selected={u.subjects} onToggle={(s) => toggleIn("subjects", s)} />
          </Group>
          {pin("subjects")}
          <div className="bsf-two-col">
            <Field label="Start date"><input type="date" value={u.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
            <Field label="End date"><input type="date" value={u.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
          </div>
          {pin("dates")}

          {!middle && (
            <>
              <Field label="Theme">
                <select value={u.theme} onChange={(e) => set("theme", e.target.value)}>
                  <option value="">Choose a theme</option>
                  {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  {u.theme && !THEMES.includes(u.theme) && <option value={u.theme}>{u.theme}</option>}
                </select>
              </Field>
              {pin("theme")}
              <Field label="Central idea">{ta("centralIdea", 2, "The big idea students should leave with")}</Field>
              {pin("centralIdea")}
              <Group label="Key concepts (up to 3)">
                <Chips options={KEY_CONCEPTS} selected={u.keyConceptList} onToggle={(c) => toggleIn("keyConceptList", c, 3)} />
              </Group>
              {!(u.keyConceptList || []).length && u.keyConcepts && <p style={hint}>Saved before: {u.keyConcepts}</p>}
              {pin("keyConcepts")}
              <div className="bsf-two-col">
                <Field label="Related concepts"><input value={u.relatedConcepts} onChange={(e) => set("relatedConcepts", e.target.value)} placeholder="e.g. Nutrition, systems, habits" /></Field>
                <Field label="Key vocabulary"><input value={u.keyVocabulary} onChange={(e) => set("keyVocabulary", e.target.value)} placeholder="Words students should know by the end" /></Field>
              </div>
              {pin("relatedConcepts")}
              {pin("keyVocabulary")}
              <Field label="Lines of inquiry">{ta("linesOfInquiry", 3, "One per line")}</Field>
              {pin("linesOfInquiry")}
              <Field label="Teacher questions">{ta("teacherQuestions", 3, "The guiding questions you will ask, one per line")}</Field>
              {pin("teacherQuestions")}
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
              {pin("globalContext")}
              {pin("exploration")}
              <Group label="Key concept (one)">
                <Chips single options={MIDDLE_KEY_CONCEPTS} selected={u.middleKeyConcept} onToggle={(c) => set("middleKeyConcept", u.middleKeyConcept === c ? "" : c)} />
              </Group>
              {pin("keyConcepts")}
              <Field label="Related concepts"><input value={u.relatedConcepts} onChange={(e) => set("relatedConcepts", e.target.value)} placeholder="e.g. Audience, point of view, voice" /></Field>
              {pin("relatedConcepts")}
              <Field label="Statement of inquiry">{ta("statementOfInquiry", 2, "One sentence joining the key concept, related concepts and global context")}</Field>
              {pin("statementOfInquiry")}
              <Field label="Factual questions">{ta("factualQuestions", 2, "One per line")}</Field>
              {pin("factualQuestions")}
              <Field label="Conceptual questions">{ta("conceptualQuestions", 2, "One per line")}</Field>
              {pin("conceptualQuestions")}
              <Field label="Debatable questions">{ta("debatableQuestions", 2, "One per line")}</Field>
              {pin("debatableQuestions")}
              <Field label="Key vocabulary"><input value={u.keyVocabulary} onChange={(e) => set("keyVocabulary", e.target.value)} /></Field>
              {pin("keyVocabulary")}
            </>
          )}
        </Stage>
      )}

      {stage === 1 && (
        <Stage n={2} title="Assess" sub="Decide how students will show their understanding before planning the activities.">
          <Field label="Summative task">{ta("assessmentSummative", 3, "The final task or product that shows understanding")}</Field>
          {pin("assessmentSummative")}
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
          {pin("successCriteria")}
          <div style={{ background: "#E4EDF7", color: "#2F5E8A", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
            {(u.grades || []).length === 0
              ? "Gradebook: choose grades in Stage 1."
              : observation
                ? "Gradebook: assessed by observation (Emerging / Developing / Meeting / Exceeding). Record it in the gradebook when the task is done."
                : "Gradebook: enter this task as a Summative assessment (70%) with a score once students have done it."}
          </div>
          <Group label="Standards addressed">
            <StandardsPicker grades={u.grades || []} selected={u.standardIds || []} oldList={standards}
              onChange={(ids) => set("standardIds", ids)} />
          </Group>
          {pin("standardIds")}
          <Field label="ATL focus"><input value={u.atlSkills} onChange={(e) => set("atlSkills", e.target.value)} placeholder="e.g. Communication, research" /></Field>
          {pin("atlSkills")}
          <Field label="SEL focus"><input value={u.selFocus} onChange={(e) => set("selFocus", e.target.value)} placeholder="e.g. Self-management" /></Field>
          {pin("selFocus")}
          <Field label="Life skills focus"><input value={u.lifeSkillsFocus} onChange={(e) => set("lifeSkillsFocus", e.target.value)} placeholder="e.g. Healthy eating" /></Field>
          {pin("lifeSkillsFocus")}
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
              {pin(k)}
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
          {pin("studentQuestions")}

          <Field label="Formative checks">{ta("assessmentFormative", 3, "Quick checks along the way")}</Field>
          {pin("assessmentFormative")}
          <Field label="Differentiation">{ta("differentiation", 3, "How the unit adapts for different learners")}</Field>
          {pin("differentiation")}
          <Field label="Language support & French connections">{ta("languageSupport", 3, "Support for English learners; links with French class")}</Field>
          {pin("languageSupport")}
          <Field label="Resources and materials">{ta("resources", 2, "Books, websites, supplies")}</Field>
          {pin("resources")}
          <Group label="Lesson plans and files">
            <AttachmentField folder="planning" files={u.lessonPlanFiles} onChange={(files) => set("lessonPlanFiles", files)} />
          </Group>
          {pin("lessonPlanFiles")}
        </Stage>
      )}

      {stage === 3 && (
        <Stage n={4} title="Reflect" sub="Filled in during and after the unit.">
          <Field label="Evidence of learning">{ta("evidenceNotes", 3, "Photos, student work, what it shows")}</Field>
          {pin("evidenceNotes")}
          <Field label="Evidence link (optional)"><input value={u.evidenceLink} onChange={(e) => set("evidenceLink", e.target.value)} placeholder="Link to photos or documents" /></Field>
          {pin("evidenceLink")}
          <Group label="Evidence files">
            <AttachmentField folder="planning" files={u.evidenceFiles} onChange={(files) => set("evidenceFiles", files)} />
          </Group>
          {pin("evidenceFiles")}
          <Field label="Student reflection">{ta("studentReflection", 3, "What students said they learned and what they still wonder")}</Field>
          {pin("studentReflection")}
          <Field label="Teacher reflection">{ta("reflection", 3, "What worked, what you would change next time")}</Field>
          {pin("reflection")}
          <Field label="Student action that happened">{ta("studentAction", 3, "What students actually did beyond the classroom")}</Field>
          {pin("studentAction")}

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
            <button type="button" className="bsf-btn" onClick={submit}>{u.status === "changes" ? "Resubmit for review" : "Submit for review"}</button>
          )}
          {isAdmin && (
            <>
              <button type="button" className="bsf-btn-ghost" onClick={requestChanges}>Request changes{openTotal > 0 ? ` (${openTotal})` : ""}</button>
              <button type="button" className="bsf-btn" onClick={approve}>Approve</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

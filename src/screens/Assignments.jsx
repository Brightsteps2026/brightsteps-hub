import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, CheckCircle2, Clock, AlertCircle, Undo2, Send } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../lib/i18n";
import { GRADES } from "../data/constants";
import { todayStr, formatDateLong, gradeLabel } from "../lib/format";
import { Field, Modal } from "../ui/common";

// Assignments with hand-in (Oct 2026). Stored in their own tables
// (hw_assignments, hw_submissions); the database decides who sees what.
//   Teachers set work, see who has handed in, mark it and return it with feedback.
//   Grade 3–7 students hand in on the Hub; for younger classes the teacher adds a photo.
//   Families see their children's assignments, work and (once returned) feedback.

const SCHOOL_YEAR = "2026-2027";
const UPPER = ["Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
const EARLY = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2"];
const SUBJECTS = ["English Language Arts", "Math", "French", "Unit of Inquiry", "Art", "Music", "Physical Education", "Swimming", "Technology"];
const LETTERS = ["A+", "A", "A−", "B+", "B", "B−", "C+", "C", "C−", "D+", "D", "D−", "F"];
const LEVELS = ["emerging", "developing", "meeting", "exceeding"];
const LEVEL_LABEL = {
  emerging: { en: "Emerging", fr: "En émergence" },
  developing: { en: "Developing", fr: "En développement" },
  meeting: { en: "Meeting", fr: "Atteint" },
  exceeding: { en: "Exceeding", fr: "Dépassé" }
};

const emptyForm = {
  title: "", description: "", subject: "", grades: [], due_date: "", link: "", files: [],
  hand_in: true, toGradebook: false, grading: "marks", max_points: "20"
};

// Work handed in after the end of the due date counts as late.
function isLate(sub, a) {
  if (!a?.due_date || !sub?.handed_in_at) return false;
  return new Date(sub.handed_in_at) > new Date(`${a.due_date}T23:59:59`);
}

function statusOf(sub, a) {
  if (!sub || sub.status === "draft") {
    return a?.due_date && a.due_date < todayStr() ? "missing" : "todo";
  }
  if (sub.status === "returned") return "returned";
  return isLate(sub, a) ? "late" : "handed_in";
}

function termForDate(dateStr, settings) {
  const terms = settings?.terms || [];
  const d = dateStr || todayStr();
  const i = terms.findIndex((t) => t.startDate <= d && d <= t.endDate);
  if (i >= 0) return i + 1;
  const next = terms.findIndex((t) => d < t.startDate);
  return next >= 0 ? Math.max(1, next) : Math.max(1, Math.min(3, terms.length || 1));
}

function markText(sub, lang) {
  if (!sub) return "";
  if (sub.mark_level) return (LEVEL_LABEL[sub.mark_level] || {})[lang] || sub.mark_level;
  if (sub.mark_letter) return sub.mark_letter;
  if (sub.mark_points != null) return String(sub.mark_points);
  return "";
}

function AssignmentsTab({ data, profile }) {
  const { language } = useLanguage();
  const L = (en, fr) => (language === "fr" ? fr : en);
  const role = profile?.role;
  const isParent = role === "parent";
  const isStudent = role === "student";
  const isFamily = isParent || isStudent;
  const canEdit = role === "admin" || role === "teacher";
  const linkedIds = profile?.student_ids || [];
  const myChildren = (data.students || []).filter((s) => linkedIds.includes(s.id));
  const editableGrades = role === "admin"
    ? GRADES
    : [...new Set([...(profile?.grades_assigned || []), ...(profile?.assigned_grades || [])])]
        .filter((g) => !(profile?.assistant_grades || []).includes(g));
  const viewGrades = isFamily
    ? [...new Set(myChildren.map((s) => s.grade))]
    : role === "admin" || role === "viewer"
    ? GRADES
    : [...new Set([...(profile?.grades_assigned || []), ...(profile?.assigned_grades || []), ...(profile?.assistant_grades || [])])];

  const [assignments, setAssignments] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [gradeFilter, setGradeFilter] = useState(null);
  const [childFilter, setChildFilter] = useState(myChildren[0]?.id || null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError("");
      const a = await supabase.from("hw_assignments").select("*").order("due_date", { ascending: true, nullsFirst: false });
      const s = await supabase.from("hw_submissions")
        .select(isFamily ? "*" : "id, assignment_id, student_id, hub_student_id, status, handed_in_at");
      if (cancelled) return;
      if (a.error || s.error) {
        console.error("Assignments failed to load", a.error || s.error);
        setLoadError(L("Assignments could not be loaded. Please check your connection and try again.",
          "Les devoirs n'ont pas pu être chargés. Veuillez vérifier votre connexion et réessayer."));
      } else {
        setAssignments(a.data || []);
        setSubs(s.data || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const today = todayStr();
  const activeChild = isParent ? myChildren.find((c) => c.id === childFilter) || myChildren[0] : isStudent ? myChildren[0] : null;
  const visible = assignments
    .filter((a) => !activeChild || (a.grades || []).includes(activeChild.grade))
    .filter((a) => !gradeFilter || (a.grades || []).includes(gradeFilter));
  const upcoming = visible.filter((a) => !a.due_date || a.due_date >= today);
  const past = visible.filter((a) => a.due_date && a.due_date < today).reverse();

  const subFor = (a, hubId) => subs.find((s) => s.assignment_id === a.id && s.hub_student_id === hubId);
  const handedCount = (a) => subs.filter((s) => s.assignment_id === a.id && s.status !== "draft").length;

  const openAssignment = assignments.find((a) => a.id === openId);

  const statusPill = (st) => {
    const map = {
      todo: { en: "To do", fr: "À faire", bg: "#F3EEE8", fg: "#6B5A4E", icon: Clock },
      missing: { en: "Not handed in", fr: "Non rendu", bg: "#FBE9E7", fg: "#B23A2B", icon: AlertCircle },
      handed_in: { en: "Handed in", fr: "Rendu", bg: "#E6F2EA", fg: "#2E7D4F", icon: CheckCircle2 },
      late: { en: "Handed in late", fr: "Rendu en retard", bg: "#FFF3DC", fg: "#9A6400", icon: Clock },
      returned: { en: "Marked", fr: "Corrigé", bg: "#EDE7F6", fg: "#5B3C99", icon: CheckCircle2 }
    }[st];
    const Icon = map.icon;
    return (
      <span className="bsf-status-pill" style={{ background: map.bg, color: map.fg, display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Icon size={13} /> {L(map.en, map.fr)}
      </span>
    );
  };

  const renderCard = (a) => {
    const child = activeChild;
    const sub = child ? subFor(a, child.id) : null;
    const gradesText = (a.grades || []).length === GRADES.length
      ? L("All grades", "Toutes les classes")
      : (a.grades || []).map((g) => (isParent ? gradeLabel(g, language) : g)).join(", ");
    const studentsInGrades = (data.students || []).filter((s) => (a.grades || []).includes(s.grade)).length;
    return (
      <div key={a.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setOpenId(a.id)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bsf-row-head" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="bsf-tag">{gradesText}</span>
            {a.due_date && <span className="bsf-muted">{L("Due", "À rendre le")} {formatDateLong(a.due_date, language)}</span>}
          </div>
          {a.subject && <p className="bsf-muted" style={{ margin: "4px 0 0" }}>{a.subject}</p>}
          <strong>{a.title}</strong>
          <div style={{ marginTop: 8 }}>
            {isFamily && child && (a.hand_in || sub) ? statusPill(statusOf(sub, a)) : null}
            {!isFamily && (
              <span className="bsf-muted">
                {a.hand_in ? `${handedCount(a)} of ${studentsInGrades} handed in` : "Teacher adds the work"}
                {a.gb_assessment_id ? " · In Gradebook" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{L("Assignments", "Devoirs")}</p>
        <h1>
          {upcoming.length === 1
            ? L("1 assignment due", "1 devoir à rendre")
            : L(`${upcoming.length} assignments due`, `${upcoming.length} devoirs à rendre`)}
        </h1>
        {upcoming[0] && (
          <p className="bsf-hero-sub">
            {L("Next:", "Prochain :")} {upcoming[0].title}
            {upcoming[0].due_date ? ` · ${formatDateLong(upcoming[0].due_date, language)}` : ""}
          </p>
        )}
      </div>

      {canEdit && (
        <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
          <span />
          <button className="bsf-btn" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> New assignment</button>
        </div>
      )}

      {isParent && myChildren.length > 1 && (
        <section className="bsf-card">
          <div className="bsf-chiprow">
            {myChildren.map((c) => (
              <button key={c.id} className={`bsf-chip ${activeChild?.id === c.id ? "active" : ""}`} onClick={() => setChildFilter(c.id)}>
                {(c.name || c.firstName || "").split(" ")[0] || c.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {!isFamily && viewGrades.length > 1 && (
        <section className="bsf-card">
          <h2>Filter by grade</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {GRADES.filter((g) => viewGrades.includes(g)).map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      {loadError && <p className="bsf-formerror">{loadError}</p>}
      {loading && <p className="bsf-muted">{L("Loading…", "Chargement…")}</p>}

      {!loading && (
        <>
          <section className="bsf-list">
            <h2 className="bsf-listheading">{L("Due", "À rendre")}</h2>
            {upcoming.length === 0 && <p className="bsf-empty">{L("Nothing due right now.", "Aucun devoir à rendre pour l'instant.")}</p>}
            {upcoming.map(renderCard)}
          </section>
          {past.length > 0 && (
            <section className="bsf-list">
              <h2 className="bsf-listheading">{L("Past", "Passés")}</h2>
              {past.map(renderCard)}
            </section>
          )}
        </>
      )}

      {showForm && (
        <AssignmentForm
          initial={editing}
          editableGrades={editableGrades}
          settings={data.settings}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); reload(); }}
        />
      )}

      {openAssignment && (isFamily ? (
        <FamilyAssignment
          a={openAssignment}
          child={activeChild}
          sub={activeChild ? subFor(openAssignment, activeChild.id) : null}
          isStudent={isStudent}
          L={L}
          language={language}
          onClose={() => setOpenId(null)}
          onChanged={reload}
        />
      ) : (
        <StaffAssignment
          a={openAssignment}
          canEdit={canEdit && (openAssignment.grades || []).every((g) => editableGrades.includes(g))}
          onClose={() => setOpenId(null)}
          onEdit={() => { setEditing(openAssignment); setOpenId(null); setShowForm(true); }}
          onChanged={reload}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Staff: set or edit an assignment

function AssignmentForm({ initial, editableGrades, settings, onClose, onSaved }) {
  const [form, setForm] = useState(() => (initial
    ? { ...emptyForm, ...initial, due_date: initial.due_date || "", link: initial.link || "", description: initial.description || "", subject: initial.subject || "", toGradebook: !!initial.gb_assessment_id }
    : emptyForm));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const allEarly = form.grades.length > 0 && form.grades.every((g) => EARLY.includes(g));
  const anyUpper = form.grades.some((g) => UPPER.includes(g));
  const singleGrade = form.grades.length === 1 ? form.grades[0] : null;
  const alreadyLinked = !!initial?.gb_assessment_id;

  const toggleGrade = (g) => set({ grades: form.grades.includes(g) ? form.grades.filter((x) => x !== g) : [...form.grades, g] });

  const save = async () => {
    setError("");
    if (!form.title.trim()) { setError("Please add a title."); return; }
    if (form.grades.length === 0) { setError("Please choose at least one grade."); return; }
    if (form.toGradebook && !alreadyLinked) {
      if (!singleGrade) { setError("To add it to the Gradebook, choose one grade only."); return; }
      if (!form.subject.trim()) { setError("To add it to the Gradebook, choose a subject."); return; }
      if (UPPER.includes(singleGrade) && form.grading === "marks" && !(Number(form.max_points) > 0)) {
        setError("Please enter what the work is marked out of."); return;
      }
    }
    setSaving(true);
    try {
      let gbId = initial?.gb_assessment_id || null;
      if (form.toGradebook && !gbId) {
        const grading = EARLY.includes(singleGrade) ? "level" : form.grading;
        const gb = await supabase.from("gb_assessments").insert({
          school_year: SCHOOL_YEAR,
          term: termForDate(form.due_date, settings),
          grade: singleGrade,
          subject: form.subject.trim(),
          title: form.title.trim(),
          kind: "formative",
          assess_type: "homework",
          grading,
          max_points: grading === "marks" ? Number(form.max_points) : 100,
          assessed_on: form.due_date || null
        }).select("id").single();
        if (gb.error) throw gb.error;
        gbId = gb.data.id;
      } else if (gbId && initial && form.title.trim() !== initial.title) {
        await supabase.from("gb_assessments").update({ title: form.title.trim() }).eq("id", gbId);
      }
      const row = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject: form.subject.trim() || null,
        grades: GRADES.filter((g) => form.grades.includes(g)),
        due_date: form.due_date || null,
        link: form.link.trim() || null,
        files: form.files || [],
        hand_in: allEarly ? false : form.hand_in,
        gb_assessment_id: gbId
      };
      const res = initial
        ? await supabase.from("hw_assignments").update(row).eq("id", initial.id)
        : await supabase.from("hw_assignments").insert(row);
      if (res.error) throw res.error;
      onSaved();
    } catch (err) {
      console.error("Assignment save failed", err);
      setError("The assignment could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    if (!window.confirm("Delete this assignment and all the work handed in for it? Marks already in the Gradebook stay there.")) return;
    setSaving(true);
    const { error: e } = await supabase.from("hw_assignments").delete().eq("id", initial.id);
    setSaving(false);
    if (e) { setError("Could not delete. Please try again."); return; }
    onSaved();
  };

  return (
    <Modal title={initial ? "Edit assignment" : "New assignment"} onClose={onClose}>
      <Field label="Grades">
        <div className="bsf-chiprow">
          {GRADES.filter((g) => editableGrades.includes(g)).map((g) => (
            <button key={g} type="button" className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`} onClick={() => toggleGrade(g)}>{g}</button>
          ))}
        </div>
      </Field>
      <Field label="Subject">
        <select value={form.subject} onChange={(e) => set({ subject: e.target.value })}>
          <option value="">Choose a subject</option>
          {[...SUBJECTS, ...(form.subject && !SUBJECTS.includes(form.subject) ? [form.subject] : [])].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Title">
        <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Fractions worksheet" />
      </Field>
      <Field label="Instructions">
        <textarea rows={4} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="What students need to do" />
      </Field>
      <Field label="Due date">
        <input type="date" value={form.due_date} onChange={(e) => set({ due_date: e.target.value })} />
      </Field>
      <Field label="Link (optional)">
        <input value={form.link} onChange={(e) => set({ link: e.target.value })} placeholder="Link to a worksheet or video" />
      </Field>
      <Field label="Files for students (optional)">
        <AttachmentField folder="assignments" files={form.files} onChange={(files) => set({ files })} />
      </Field>

      {anyUpper && (
        <label className="bsf-checkboxrow" style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "10px 0" }}>
          <input type="checkbox" checked={form.hand_in} onChange={(e) => set({ hand_in: e.target.checked })} />
          <span>Students hand in on the Hub <span className="bsf-muted">(Grade 3–7). Untick for work done on paper; you can still add a photo.</span></span>
        </label>
      )}
      {allEarly && <p className="bsf-muted">Younger classes don't hand in on the Hub. You can add a photo of each child's work.</p>}

      <label className="bsf-checkboxrow" style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "10px 0" }}>
        <input type="checkbox" checked={form.toGradebook} disabled={alreadyLinked} onChange={(e) => set({ toGradebook: e.target.checked })} />
        <span>
          {alreadyLinked ? "In the Gradebook" : "Add to the Gradebook"}
          <span className="bsf-muted"> {alreadyLinked ? "(marks go there when you return work)" : "(one grade only; marks go there when you return work)"}</span>
        </span>
      </label>
      {form.toGradebook && !alreadyLinked && singleGrade && UPPER.includes(singleGrade) && (
        <div className="bsf-chiprow" style={{ alignItems: "center", marginBottom: 10 }}>
          <button type="button" className={`bsf-chip ${form.grading === "marks" ? "active" : ""}`} onClick={() => set({ grading: "marks" })}>Marks</button>
          <button type="button" className={`bsf-chip ${form.grading === "letter" ? "active" : ""}`} onClick={() => set({ grading: "letter" })}>Letter</button>
          {form.grading === "marks" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              out of <input style={{ width: 70 }} inputMode="numeric" value={form.max_points} onChange={(e) => set({ max_points: e.target.value })} />
            </span>
          )}
        </div>
      )}

      <button className="bsf-btn bsf-btn-block" disabled={saving} onClick={save}>{saving ? "Saving…" : initial ? "Save changes" : "Post assignment"}</button>
      {initial && (
        <button className="bsf-btn bsf-btn-ghost bsf-btn-block" style={{ marginTop: 8 }} disabled={saving} onClick={remove}>
          <Trash2 size={15} /> Delete assignment
        </button>
      )}
      {error && <p className="bsf-formerror">{error}</p>}
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Staff: who has handed in, marking and returning

function StaffAssignment({ a, canEdit, onClose, onEdit, onChanged }) {
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState([]);
  const [gb, setGb] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const st = await supabase.from("students").select("id, full_name, legacy_id, grade").in("grade", a.grades || []).order("full_name");
      const sb = await supabase.from("hw_submissions").select("*").eq("assignment_id", a.id);
      const g = a.gb_assessment_id
        ? await supabase.from("gb_assessments").select("id, grading, max_points").eq("id", a.gb_assessment_id).maybeSingle()
        : { data: null };
      if (cancelled) return;
      if (st.error || sb.error) { setError("Could not load the class. Please try again."); return; }
      setStudents(st.data || []);
      setRows(sb.data || []);
      setGb(g.data || null);
    })();
    return () => { cancelled = true; };
  }, [a.id, a.gb_assessment_id, loadKey]);

  const rowFor = (stu) => rows.find((r) => r.student_id === stu.id);
  const counts = useMemo(() => {
    const c = { handed: 0, returned: 0, missing: 0 };
    students.forEach((s) => {
      const st = statusOf(rowFor(s), a);
      if (st === "returned") c.returned++;
      else if (st === "handed_in" || st === "late") c.handed++;
      else c.missing++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, rows]);

  const selStudent = students.find((s) => s.id === selected);

  return (
    <Modal title={a.title} onClose={onClose}>
      <p className="bsf-muted" style={{ marginTop: 0 }}>
        {(a.grades || []).join(", ")}{a.subject ? ` · ${a.subject}` : ""}{a.due_date ? ` · Due ${a.due_date}` : ""}
      </p>
      {a.description && <p style={{ whiteSpace: "pre-wrap" }}>{a.description}</p>}
      {a.link && <p><a href={a.link} target="_blank" rel="noopener noreferrer">{a.link}</a></p>}
      {(a.files || []).length > 0 && <AttachmentField folder="assignments" files={a.files} onChange={() => {}} readOnly />}
      {canEdit && <button className="bsf-textbtn" onClick={onEdit}>Edit assignment</button>}

      <hr className="bsf-divider" />
      {error && <p className="bsf-formerror">{error}</p>}

      {!selStudent && (
        <>
          <p className="bsf-group-label">
            {a.hand_in ? `${counts.handed} to mark · ${counts.returned} returned · ${counts.missing} not handed in` : `${counts.returned} returned`}
          </p>
          {students.map((s) => {
            const r = rowFor(s);
            const st = statusOf(r, a);
            const label = {
              todo: a.hand_in ? "Not yet" : "Add work", missing: a.hand_in ? "Missing" : "Add work",
              handed_in: "To mark", late: "Late · to mark", returned: `Returned${markText(r, "en") ? ` · ${markText(r, "en")}` : ""}`
            }[st];
            const color = { todo: "#6B5A4E", missing: "#B23A2B", handed_in: "#2E7D4F", late: "#9A6400", returned: "#5B3C99" }[st];
            return (
              <div key={s.id} className="bsf-row bsf-clickable" style={{ padding: "10px 0", borderBottom: "1px solid #F0E8E2", display: "flex", justifyContent: "space-between", gap: 10 }} onClick={() => setSelected(s.id)}>
                <span>{s.full_name}{a.grades.length > 1 ? <span className="bsf-muted"> · {s.grade}</span> : null}</span>
                <span style={{ color, fontWeight: 600, fontSize: 13 }}>{label}</span>
              </div>
            );
          })}
          {students.length === 0 && !error && <p className="bsf-empty">No students in these grades.</p>}
        </>
      )}

      {selStudent && (
        <MarkPanel
          a={a}
          gb={gb}
          student={selStudent}
          row={rowFor(selStudent)}
          canEdit={canEdit}
          onBack={() => setSelected(null)}
          onSaved={() => { setLoadKey((k) => k + 1); onChanged(); }}
        />
      )}
    </Modal>
  );
}

function MarkPanel({ a, gb, student, row, canEdit, onBack, onSaved }) {
  const early = EARLY.includes(student.grade);
  const grading = gb?.grading || (early ? "level" : "letter");
  const [files, setFiles] = useState(row?.files || []);
  const [feedback, setFeedback] = useState(row?.feedback || "");
  const [feedbackFiles, setFeedbackFiles] = useState(row?.feedback_files || []);
  const [points, setPoints] = useState(row?.mark_points ?? "");
  const [letter, setLetter] = useState(row?.mark_letter || "");
  const [level, setLevel] = useState(row?.mark_level || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (returnIt) => {
    setError("");
    if (grading === "marks" && points !== "" && gb && Number(points) > Number(gb.max_points)) {
      setError(`The mark cannot be more than ${gb.max_points}.`); return;
    }
    setSaving(true);
    const patch = {
      feedback: feedback.trim() || null,
      feedback_files: feedbackFiles,
      mark_points: grading === "marks" && points !== "" ? Number(points) : null,
      mark_letter: grading === "letter" ? letter || null : null,
      mark_level: grading === "level" ? level || null : null,
      files,
      status: returnIt ? "returned" : row?.status === "returned" ? "returned" : (row?.status || (files.length ? "handed_in" : "draft"))
    };
    const res = row
      ? await supabase.from("hw_submissions").update(patch).eq("id", row.id)
      : await supabase.from("hw_submissions").insert({ ...patch, assignment_id: a.id, student_id: student.id, hub_student_id: student.legacy_id });
    setSaving(false);
    if (res.error) {
      console.error("Marking failed", res.error);
      setError("Could not save. Please try again.");
      return;
    }
    onSaved();
    if (returnIt) onBack();
  };

  const st = statusOf(row, a);

  return (
    <div>
      <button className="bsf-textbtn" onClick={onBack}>← All students</button>
      <h3 style={{ margin: "8px 0 2px" }}>{student.full_name}</h3>
      <p className="bsf-muted" style={{ marginTop: 0 }}>
        {st === "returned" ? "Returned" : st === "late" ? "Handed in late" : st === "handed_in" ? "Handed in" : a.hand_in ? "Not handed in yet" : "Work added by the teacher"}
        {row?.handed_in_at ? ` · ${new Date(row.handed_in_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}
      </p>

      {row?.answer && (
        <div className="bsf-card" style={{ background: "#FBF7F3", whiteSpace: "pre-wrap" }}>{row.answer}</div>
      )}
      <p className="bsf-group-label">{a.hand_in ? "Student's files" : "Photo of the work"}</p>
      <AttachmentField folder="assignments" files={files} onChange={setFiles} readOnly={!canEdit || (a.hand_in && !row?.added_by_staff && !!row)} />

      {canEdit && (
        <>
          <Field label="Feedback">
            <textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, and what to work on next" />
          </Field>
          <Field label="Feedback files (optional)">
            <AttachmentField folder="assignments" files={feedbackFiles} onChange={setFeedbackFiles} />
          </Field>
          <Field label={grading === "level" ? "Level" : grading === "letter" ? "Letter" : `Mark (out of ${gb?.max_points})`}>
            {grading === "level" && (
              <div className="bsf-chiprow">
                {LEVELS.map((lv) => (
                  <button key={lv} type="button" className={`bsf-chip ${level === lv ? "active" : ""}`} onClick={() => setLevel(level === lv ? "" : lv)}>{LEVEL_LABEL[lv].en}</button>
                ))}
              </div>
            )}
            {grading === "letter" && (
              <select value={letter} onChange={(e) => setLetter(e.target.value)}>
                <option value="">No letter</option>
                {LETTERS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {grading === "marks" && (
              <input inputMode="decimal" value={points} onChange={(e) => setPoints(e.target.value.replace(",", "."))} placeholder={`0 – ${gb?.max_points}`} />
            )}
          </Field>
          {!gb && <p className="bsf-muted" style={{ marginTop: -4 }}>This assignment is not in the Gradebook, so the mark stays here only.</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="bsf-btn" disabled={saving} onClick={() => save(true)}>
              <Send size={15} /> {row?.status === "returned" ? "Update and keep returned" : "Return to student"}
            </button>
            <button className="bsf-btn bsf-btn-ghost" disabled={saving} onClick={() => save(false)}>Save without returning</button>
          </div>
          {error && <p className="bsf-formerror">{error}</p>}
        </>
      )}
      {!canEdit && row?.feedback && <p style={{ whiteSpace: "pre-wrap" }}><strong>Feedback:</strong> {row.feedback}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Students (hand in) and parents (see work and feedback)

function FamilyAssignment({ a, child, sub, isStudent, L, language, onClose, onChanged }) {
  const canHandIn = isStudent && a.hand_in && UPPER.includes(child?.grade) && sub?.status !== "returned";
  const [answer, setAnswer] = useState(sub?.answer || "");
  const [files, setFiles] = useState(sub?.files || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const st = statusOf(sub, a);

  const save = async (status) => {
    setError("");
    if (status === "handed_in" && !answer.trim() && files.length === 0) {
      setError("Please write your answer or add a file before handing in.");
      return;
    }
    setSaving(true);
    const patch = { answer: answer.trim() || null, files, status };
    const res = sub
      ? await supabase.from("hw_submissions").update(patch).eq("id", sub.id)
      : await supabase.from("hw_submissions").insert({ ...patch, assignment_id: a.id, hub_student_id: child.id, student_id: null });
    setSaving(false);
    if (res.error) {
      console.error("Hand-in failed", res.error);
      setError(/already returned/i.test(res.error.message || "") ? "Your teacher has already marked this work." : "Your work could not be saved. Please try again.");
      return;
    }
    onChanged();
    if (status === "handed_in") onClose();
  };

  return (
    <Modal title={a.title} onClose={onClose}>
      <p className="bsf-muted" style={{ marginTop: 0 }}>
        {a.subject ? `${a.subject} · ` : ""}{a.due_date ? `${L("Due", "À rendre le")} ${formatDateLong(a.due_date, language)}` : ""}
      </p>
      {a.description && <p style={{ whiteSpace: "pre-wrap" }}>{a.description}</p>}
      {a.link && <p><a href={a.link} target="_blank" rel="noopener noreferrer">{a.link}</a></p>}
      {(a.files || []).length > 0 && <AttachmentField folder="assignments" files={a.files} onChange={() => {}} readOnly />}

      <hr className="bsf-divider" />

      {canHandIn ? (
        <>
          <p className="bsf-group-label">My work</p>
          <textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your answer here..." />
          <AttachmentField folder="assignments" files={files} onChange={setFiles} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {sub?.status === "handed_in" ? (
              <button className="bsf-btn bsf-btn-ghost" disabled={saving} onClick={() => save("draft")}><Undo2 size={15} /> Take back to change it</button>
            ) : (
              <>
                <button className="bsf-btn" disabled={saving} onClick={() => save("handed_in")}><Send size={15} /> Hand in</button>
                <button className="bsf-btn bsf-btn-ghost" disabled={saving} onClick={() => save("draft")}>Save for later</button>
              </>
            )}
          </div>
          {sub?.status === "handed_in" && <p className="bsf-muted">Handed in. You can take it back to change it until your teacher marks it.</p>}
          {error && <p className="bsf-formerror">{error}</p>}
        </>
      ) : (
        <>
          <p className="bsf-group-label">{isStudent ? "My work" : L("Work", "Travail")}</p>
          {(a.hand_in || sub) && <div style={{ marginBottom: 8 }}>{st && <StatusText st={st} L={L} />}</div>}
          {sub?.answer && <div className="bsf-card" style={{ background: "#FBF7F3", whiteSpace: "pre-wrap" }}>{sub.answer}</div>}
          {(sub?.files || []).length > 0 && <AttachmentField folder="assignments" files={sub.files} onChange={() => {}} readOnly />}
          {!sub && !a.hand_in && <p className="bsf-muted">{L("This work is done in class. The teacher will add it here.", "Ce travail se fait en classe. L'enseignant(e) l'ajoutera ici.")}</p>}
        </>
      )}

      {sub?.status === "returned" && (
        <>
          <hr className="bsf-divider" />
          <p className="bsf-group-label">{L("Teacher's feedback", "Retour de l'enseignant(e)")}</p>
          {markText(sub, language) && <p><strong>{markText(sub, language)}</strong></p>}
          {sub.feedback && <p style={{ whiteSpace: "pre-wrap" }}>{sub.feedback}</p>}
          {(sub.feedback_files || []).length > 0 && <AttachmentField folder="assignments" files={sub.feedback_files} onChange={() => {}} readOnly />}
        </>
      )}
    </Modal>
  );
}

function StatusText({ st, L }) {
  const text = {
    todo: L("Not handed in yet", "Pas encore rendu"),
    missing: L("Not handed in", "Non rendu"),
    handed_in: L("Handed in, waiting for the teacher", "Rendu, en attente de correction"),
    late: L("Handed in late, waiting for the teacher", "Rendu en retard, en attente de correction"),
    returned: L("Marked by the teacher", "Corrigé par l'enseignant(e)")
  }[st];
  return <span className="bsf-muted">{text}</span>;
}

export { AssignmentsTab };

// Upcoming assignments for one grade, for the child pages (same shape as before).
export function useAssignmentsDue(grade, limit = 5) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!grade) { setItems([]); return; }
    let cancelled = false;
    supabase.from("hw_assignments")
      .select("id, title, subject, description, due_date, grades")
      .contains("grades", [grade])
      .or(`due_date.is.null,due_date.gte.${todayStr()}`)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setItems((data || []).map((a) => ({ id: a.id, title: a.title, subject: a.subject, description: a.description, dueDate: a.due_date, grades: a.grades })));
      });
    return () => { cancelled = true; };
  }, [grade, limit]);
  return items;
}

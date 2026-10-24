import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../lib/i18n";
import { GRADES } from "../data/constants";
import { gradeLabel } from "../lib/format";
import { Field, Modal } from "../ui/common";
import { FamilyTimetable } from "./FamilyTimetable";

// Class timetable (Oct 2026). Tables tt_periods (the school day) and tt_slots
// (grade x weekday x period -> subject, teacher, room). Only the admin edits.

const SUBJECTS = ["English Language Arts", "Math", "French", "Unit of Inquiry", "Art", "Music", "Physical Education", "Swimming", "Technology", "Library", "Assembly"];
const DAYS = [1, 2, 3, 4, 5];

function dayName(d, language, style = "long") {
  // 2024-01-01 was a Monday.
  return new Date(2024, 0, d).toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { weekday: style });
}
const hhmm = (t) => (t || "").slice(0, 5);

// Each class runs on its own clock (Master Schedule 2026-2027): a period with
// grades set belongs to those classes only; no grades = every class.
const forGrade = (p, g) => !(p.grades || []).length || (p.grades || []).includes(g);

// French for the subjects and routines in the master schedule (display only;
// anything not listed is shown as saved).
const TT_FR = {
  "English Language Arts": "Anglais (Language Arts)", "Math": "Mathématiques", "French": "Français",
  "Unit of Inquiry": "Unité de recherche", "Physical Education": "Éducation physique", "Art": "Arts plastiques",
  "Music": "Musique", "Technology": "Technologie", "Swimming": "Natation", "Swimming and changing": "Natation et vestiaire",
  "Phonics": "Phonétique", "Reading and phonics": "Lecture et phonétique", "Independent reading": "Lecture autonome",
  "Science": "Sciences", "Humanities": "Sciences humaines", "Interdisciplinary Inquiry": "Recherche interdisciplinaire",
  "SEL / Life Skills": "Compétences socio-émotionnelles et vie pratique", "Sensory play": "Jeux sensoriels",
  "Sensory and construction play": "Jeux sensoriels et de construction", "Recess": "Récréation",
  "Arrival, gardening and animal care": "Arrivée, jardinage et soin des animaux", "Greeting songs and circle": "Chansons d'accueil et regroupement",
  "Morning circle": "Regroupement du matin", "Morning meeting": "Réunion du matin", "Snack and hand-washing": "Goûter et lavage des mains",
  "Changing and transition": "Change et transition", "Transition": "Transition", "Morning break": "Pause du matin",
  "Tidy-up and hand-washing": "Rangement et lavage des mains", "Lunch (served 11:20)": "Déjeuner (servi à 11 h 20)",
  "Lunch (served 11:50)": "Déjeuner (servi à 11 h 50)", "Lunch (served 12:15)": "Déjeuner (servi à 12 h 15)",
  "Soft, calm play indoors": "Jeux calmes à l'intérieur", "Toileting and settling for rest": "Toilettes et installation pour la sieste",
  "Settling for rest": "Installation pour la sieste", "Rest / nap": "Repos / sieste", "Wake-up and care routines": "Réveil et soins",
  "Wake-up, story and care routines": "Réveil, histoire et soins", "Care routines and dismissal": "Soins et départ",
  "Reflection and dismissal": "Bilan et départ", "Organization, reflection and dismissal": "Organisation, bilan et départ",
};
const ttLabel = (text, language) => (language === "fr" && TT_FR[text]) || text;
const todayWeekday = () => { const d = new Date().getDay(); return d >= 1 && d <= 5 ? d : 1; };

// Families get the designed parent view; staff keep the editing screen.
function TimetableTab(props) {
  const r = props.profile?.role;
  return r === "parent" || r === "student" ? <FamilyTimetable {...props} /> : <StaffTimetable {...props} />;
}

function StaffTimetable({ data, profile }) {
  const { language } = useLanguage();
  const L = (en, fr) => (language === "fr" ? fr : en);
  const role = profile?.role;
  const isAdmin = role === "admin";
  const isFamily = role === "parent" || role === "student";
  const isTeacher = role === "teacher";
  const myChildren = (data.students || []).filter((s) => (profile?.student_ids || []).includes(s.id));
  const familyGrades = GRADES.filter((g) => myChildren.some((c) => c.grade === g));

  const [periods, setPeriods] = useState([]);
  const [slots, setSlots] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [day, setDay] = useState(todayWeekday());
  const [view, setView] = useState(isTeacher ? ([...(Array.isArray(profile?.grades_assigned) ? profile.grades_assigned : []), ...(Array.isArray(profile?.assigned_grades) ? profile.assigned_grades : [])].find((g) => GRADES.includes(g)) || "mine") : isFamily ? familyGrades[0] || null : GRADES[0]);
  const [editSlot, setEditSlot] = useState(null);
  const [editPeriod, setEditPeriod] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showPeriods, setShowPeriods] = useState(false);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError("");
      const p = await supabase.from("tt_periods").select("*").order("sort").order("start_time");
      const s = await supabase.from("tt_slots").select("*");
      const n = isFamily ? { data: [] } : await supabase.from("staff_display_names").select("user_id, display_name");
      if (cancelled) return;
      if (p.error || s.error) {
        console.error("Timetable failed to load", p.error || s.error);
        setError(L("The timetable could not be loaded. Please try again.", "L'emploi du temps n'a pas pu être chargé. Veuillez réessayer."));
      } else {
        setPeriods(p.data || []);
        setSlots(s.data || []);
        setNames(Object.fromEntries((n.data || []).map((x) => [x.user_id, x.display_name])));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const dayPeriods = periods
    .filter((p) => (p.days || []).includes(day) && (view === "mine" || forGrade(p, view)))
    .sort((a, b) => (a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0));
  const viewChoices = isFamily ? familyGrades : [...(isTeacher ? ["mine"] : []), ...GRADES];

  const rows = useMemo(() => dayPeriods.map((p) => {
    if (view === "mine") {
      const mine = slots.filter((s) => s.weekday === day && s.period_id === p.id && s.teacher_id === profile?.id);
      return { p, items: mine };
    }
    return { p, items: slots.filter((s) => s.weekday === day && s.period_id === p.id && s.grade === view) };
  }).filter((r) => view !== "mine" || r.items.length > 0), [dayPeriods, slots, day, view, profile?.id]);

  const viewLabel = (v) => (v === "mine" ? "My timetable" : isFamily ? gradeLabel(v, language) : v);

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{L("Timetable", "Emploi du temps")}</p>
        <h1>{view ? viewLabel(view) : L("Timetable", "Emploi du temps")}</h1>
        <p className="bsf-hero-sub">{dayName(day, language)}</p>
      </div>

      {viewChoices.length > 1 && (
        <section className="bsf-card">
          <div className="bsf-chiprow">
            {viewChoices.map((v) => (
              <button key={v} className={`bsf-chip ${view === v ? "active" : ""}`} onClick={() => setView(v)}>{viewLabel(v)}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-card">
        <div className="bsf-chiprow">
          {DAYS.map((d) => (
            <button key={d} className={`bsf-chip ${day === d ? "active" : ""}`} onClick={() => setDay(d)}>{dayName(d, language, "short")}</button>
          ))}
        </div>
      </section>

      {error && <p className="bsf-formerror">{error}</p>}
      {loading && <p className="bsf-muted">{L("Loading…", "Chargement…")}</p>}

      {!loading && !error && (
        <section className="bsf-card">
          {dayPeriods.length === 0 && (
            <p className="bsf-empty">
              {isAdmin ? "No periods yet. Add the periods of the school day below." : L("The timetable has not been set up yet.", "L'emploi du temps n'est pas encore disponible.")}
            </p>
          )}
          {rows.map(({ p, items }) => (
            <div key={p.id} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid #F0E8E2", alignItems: "flex-start" }}>
              <div style={{ width: 92, flexShrink: 0 }}>
                <strong style={{ fontSize: 13 }}>{hhmm(p.start_time)}–{hhmm(p.end_time)}</strong>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {p.kind === "break" ? (
                  <span className="bsf-muted">{ttLabel(p.label, language)}</span>
                ) : items.length === 0 ? (
                  isAdmin && view !== "mine"
                    ? <button className="bsf-textbtn" onClick={() => setEditSlot({ grade: view, weekday: day, period_id: p.id })}><Plus size={14} /> Add lesson</button>
                    : <span className="bsf-muted">—</span>
                ) : (
                  items.map((s) => (
                    <div
                      key={s.id}
                      className={isAdmin ? "bsf-clickable" : ""}
                      onClick={() => { if (isAdmin) setEditSlot(s); }}
                    >
                      <strong>{s.subject ? ttLabel(s.subject, language) : "—"}</strong>
                      <div className="bsf-muted" style={{ fontSize: 13 }}>
                        {[view === "mine" ? s.grade : null, !isFamily && s.teacher_id ? names[s.teacher_id] : null, s.room].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {isAdmin && !loading && (
        <section className="bsf-card">
          <div className="bsf-row-head">
            <h2>Periods of the school day</h2>
            <button className="bsf-textbtn" onClick={() => setShowPeriods(!showPeriods)}><Pencil size={14} /> {showPeriods ? "Hide" : "Edit periods"}</button>
          </div>
          {showPeriods && <>
          <button className="bsf-textbtn" onClick={() => setEditPeriod({})}><Plus size={14} /> Add period</button>
          {periods.length === 0 && <p className="bsf-muted">For example: Period 1, 07:45–08:30. Add breaks and lunch too. A period can apply to some days only (e.g. a Tuesday-only late period).</p>}
          {view !== "mine" && <p className="bsf-muted" style={{ fontSize: 12 }}>Showing the periods of {view}.</p>}
          {periods.filter((p) => view === "mine" || forGrade(p, view)).map((p) => (
            <div key={p.id} className="bsf-clickable" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0E8E2" }} onClick={() => setEditPeriod(p)}>
              <span><strong>{p.label}</strong> <span className="bsf-muted">{hhmm(p.start_time)}–{hhmm(p.end_time)}{p.kind === "break" ? " · break" : ""}</span></span>
              <span className="bsf-muted" style={{ fontSize: 12 }}>
                {(p.days || []).length === 5 ? "Every day" : (p.days || []).map((d) => dayName(d, "en", "short")).join(", ")} <Pencil size={12} />
              </span>
            </div>
          ))}
          </>}
        </section>
      )}

      {editSlot && (
        <SlotForm slot={editSlot} names={names} onClose={() => setEditSlot(null)} onSaved={() => { setEditSlot(null); reload(); }} />
      )}
      {editPeriod && (
        <PeriodForm period={editPeriod} grade={view === "mine" ? null : view} count={periods.length} onClose={() => setEditPeriod(null)} onSaved={() => { setEditPeriod(null); reload(); }} />
      )}
    </div>
  );
}

function SlotForm({ slot, names, onClose, onSaved }) {
  const [subject, setSubject] = useState(slot.subject || "");
  const [teacher, setTeacher] = useState(slot.teacher_id || "");
  const [room, setRoom] = useState(slot.room || "");
  const [alsoDays, setAlsoDays] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const teachers = Object.entries(names).sort((a, b) => a[1].localeCompare(b[1]));

  const save = async () => {
    setError("");
    if (!subject.trim()) { setError("Please choose a subject."); return; }
    setSaving(true);
    const base = { subject: subject.trim(), teacher_id: teacher || null, room: room.trim() || null, updated_at: new Date().toISOString() };
    const days = [...new Set([slot.weekday, ...alsoDays])];
    const rowsToSave = days.map((d) => ({ ...base, grade: slot.grade, weekday: d, period_id: slot.period_id }));
    const { error: e } = await supabase.from("tt_slots").upsert(rowsToSave, { onConflict: "grade,weekday,period_id" });
    setSaving(false);
    if (e) { console.error(e); setError("Could not save. Please try again."); return; }
    onSaved();
  };

  const remove = async () => {
    setSaving(true);
    const { error: e } = await supabase.from("tt_slots").delete().eq("id", slot.id);
    setSaving(false);
    if (e) { setError("Could not remove. Please try again."); return; }
    onSaved();
  };

  return (
    <Modal title={`${slot.grade} · ${dayName(slot.weekday, "en")}`} onClose={onClose}>
      <Field label="Subject">
        <select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">Choose a subject</option>
          {[...SUBJECTS, ...(subject && !SUBJECTS.includes(subject) ? [subject] : [])].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Teacher">
        <select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
          <option value="">No teacher</option>
          {teachers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
      </Field>
      <Field label="Room (optional)">
        <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Grade 3 classroom, Pool" />
      </Field>
      <Field label="Same lesson on other days too">
        <div className="bsf-chiprow">
          {DAYS.filter((d) => d !== slot.weekday).map((d) => (
            <button key={d} type="button" className={`bsf-chip ${alsoDays.includes(d) ? "active" : ""}`}
              onClick={() => setAlsoDays(alsoDays.includes(d) ? alsoDays.filter((x) => x !== d) : [...alsoDays, d])}>
              {dayName(d, "en", "short")}
            </button>
          ))}
        </div>
      </Field>
      <button className="bsf-btn bsf-btn-block" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
      {slot.id && <button className="bsf-btn bsf-btn-ghost bsf-btn-block" style={{ marginTop: 8 }} disabled={saving} onClick={remove}><Trash2 size={15} /> Remove this lesson</button>}
      {error && <p className="bsf-formerror">{error}</p>}
    </Modal>
  );
}

function PeriodForm({ period, grade, count, onClose, onSaved }) {
  const [label, setLabel] = useState(period.label || "");
  const [start, setStart] = useState(hhmm(period.start_time) || "");
  const [end, setEnd] = useState(hhmm(period.end_time) || "");
  const [kind, setKind] = useState(period.kind || "lesson");
  const [days, setDays] = useState(period.days || DAYS);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError("");
    if (!label.trim() || !start || !end) { setError("Please enter a name, a start time and an end time."); return; }
    if (end <= start) { setError("The end time must be after the start time."); return; }
    if (days.length === 0) { setError("Choose at least one day."); return; }
    setSaving(true);
    const row = { label: label.trim(), start_time: start, end_time: end, kind, days: DAYS.filter((d) => days.includes(d)), sort: period.sort ?? count };
    const res = period.id
      ? await supabase.from("tt_periods").update(row).eq("id", period.id)
      : await supabase.from("tt_periods").insert({ ...row, grades: grade ? [grade] : null });
    setSaving(false);
    if (res.error) { console.error(res.error); setError("Could not save. Please try again."); return; }
    onSaved();
  };

  const remove = async () => {
    if (!window.confirm("Delete this period? Lessons in it are removed from every class.")) return;
    setSaving(true);
    const { error: e } = await supabase.from("tt_periods").delete().eq("id", period.id);
    setSaving(false);
    if (e) { setError("Could not delete. Please try again."); return; }
    onSaved();
  };

  return (
    <Modal title={period.id ? "Edit period" : "New period"} onClose={onClose}>
      <Field label="Name">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Period 1, Break, Lunch" />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Starts"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Ends"><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="Type">
        <div className="bsf-chiprow">
          <button type="button" className={`bsf-chip ${kind === "lesson" ? "active" : ""}`} onClick={() => setKind("lesson")}>Lesson</button>
          <button type="button" className={`bsf-chip ${kind === "break" ? "active" : ""}`} onClick={() => setKind("break")}>Break or lunch</button>
        </div>
      </Field>
      <Field label="Days">
        <div className="bsf-chiprow">
          {DAYS.map((d) => (
            <button key={d} type="button" className={`bsf-chip ${days.includes(d) ? "active" : ""}`}
              onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>
              {dayName(d, "en", "short")}
            </button>
          ))}
        </div>
      </Field>
      <button className="bsf-btn bsf-btn-block" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
      {period.id && <button className="bsf-btn bsf-btn-ghost bsf-btn-block" style={{ marginTop: 8 }} disabled={saving} onClick={remove}><Trash2 size={15} /> Delete period</button>}
      {error && <p className="bsf-formerror">{error}</p>}
    </Modal>
  );
}

export { TimetableTab };

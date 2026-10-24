import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../lib/i18n";
import { gradeLabel } from "../lib/format";

// Parent / student timetable (design approved by Myri, 24 Oct 2026).
// Reads the same tables as the staff screen (tt_periods, tt_slots); a family
// only ever receives its own children's grades (RLS).

const hhmm = (t) => (t || "").slice(0, 5);
const toMin = (t) => { const [h, m] = hhmm(t).split(":").map(Number); return h * 60 + m; };
const pad = (n) => String(n).padStart(2, "0");

const FAMILY = {
  "English Language Arts": "lit", "Phonics": "lit", "Reading and phonics": "lit", "Independent reading": "lit",
  "Math": "math", "French": "fr",
  "Unit of Inquiry": "inq", "Science": "inq", "Humanities": "inq", "Interdisciplinary Inquiry": "inq", "SEL / Life Skills": "inq",
  "Physical Education": "spec", "Art": "spec", "Music": "spec", "Technology": "spec", "Swimming": "spec", "Swimming and changing": "spec",
};
const SPECIALS = ["Physical Education", "Art", "Music", "Technology", "Swimming"];
const ROUTINE_SUBJECTS = ["Recess"];
const TAG = {
  lit: ["Literacy", "Lecture-écriture"], math: ["Math", "Maths"], fr: ["French", "Français"],
  inq: ["Inquiry", "Recherche"], spec: ["Specialist", "Spécialité"], play: ["Play", "Jeu"],
};

const FR = {
  "English Language Arts": "Anglais (Language Arts)", "Math": "Mathématiques", "French": "Français",
  "Unit of Inquiry": "Unité de recherche", "Physical Education": "Éducation physique", "Art": "Arts plastiques",
  "Music": "Musique", "Technology": "Technologie", "Swimming": "Natation", "Swimming and changing": "Natation et vestiaire",
  "Phonics": "Phonétique", "Reading and phonics": "Lecture et phonétique", "Independent reading": "Lecture autonome",
  "Science": "Sciences", "Humanities": "Sciences humaines", "Interdisciplinary Inquiry": "Recherche interdisciplinaire",
  "SEL / Life Skills": "Compétences socio-émotionnelles et vie pratique", "Sensory play": "Jeux sensoriels",
  "Sensory and construction play": "Jeux sensoriels et de construction", "Recess": "Récréation",
  "Arrival, gardening and animal care": "Arrivée, jardinage et soin des animaux", "Greeting songs and circle": "Chansons d'accueil et regroupement",
  "Morning circle": "Regroupement du matin", "Morning meeting": "Réunion du matin", "Snack and hand-washing": "Goûter et lavage des mains",
  "Changing and transition": "Change et transition", "Morning break": "Pause du matin",
  "Tidy-up and hand-washing": "Rangement et lavage des mains", "Lunch (served 11:20)": "Déjeuner (servi à 11 h 20)",
  "Lunch (served 11:50)": "Déjeuner (servi à 11 h 50)", "Lunch (served 12:15)": "Déjeuner (servi à 12 h 15)",
  "Soft, calm play indoors": "Jeux calmes à l'intérieur", "Toileting and settling for rest": "Toilettes et installation pour la sieste",
  "Settling for rest": "Installation pour la sieste", "Rest / nap": "Repos / sieste", "Wake-up and care routines": "Réveil et soins",
  "Wake-up, story and care routines": "Réveil, histoire et soins", "Care routines and dismissal": "Soins et départ",
  "Reflection and dismissal": "Bilan et départ", "Organization, reflection and dismissal": "Organisation, bilan et départ",
};

// The school week to show: this week on a weekday, next week at the weekend.
function schoolWeek(now) {
  const d = new Date(now); d.setHours(12, 0, 0, 0);
  const wd = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() + (wd === 0 ? 1 : wd === 6 ? 2 : 1 - wd));
  return [1, 2, 3, 4, 5].map((n) => { const x = new Date(monday); x.setDate(monday.getDate() + n - 1); return { n, date: x }; });
}
const sameDay = (a, b) => a.toDateString() === b.toDateString();

function FamilyTimetable({ data, profile }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  const L = (en, f) => (fr ? f : en);
  const tr = (t) => (fr && FR[t]) || t;
  const locale = fr ? "fr-FR" : "en-GB";

  const children = (data.students || []).filter((s) => (profile?.student_ids || []).includes(s.id));
  const [childId, setChildId] = useState(children[0]?.id || null);
  const child = children.find((c) => c.id === childId) || children[0];
  const firstName = (child?.name || "").trim().split(/\s+/)[0] || "";

  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const week = useMemo(() => schoolWeek(now), [now.toDateString()]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayN = week.find((w) => sameDay(w.date, now))?.n || null;
  const [day, setDay] = useState(todayN || 1);
  const dayDate = week.find((w) => w.n === day)?.date || week[0].date;

  const [periods, setPeriods] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await supabase.from("tt_periods").select("*");
      const s = await supabase.from("tt_slots").select("grade, weekday, period_id, subject");
      if (cancelled) return;
      if (p.error || s.error) { console.error("Timetable failed to load", p.error || s.error); setError(true); }
      else { setPeriods(p.data || []); setSlots(s.data || []); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const grade = child?.grade;
  const dayRows = (wd) => periods
    .filter((p) => (p.days || []).includes(wd) && (!(p.grades || []).length || (p.grades || []).includes(grade)))
    .sort((a, b) => toMin(a.start_time) - toMin(b.start_time))
    .map((p) => {
      const slot = slots.find((s) => s.grade === grade && s.weekday === wd && s.period_id === p.id);
      const subject = p.kind === "break" ? p.label : slot?.subject;
      const lesson = p.kind !== "break" && subject && !ROUTINE_SUBJECTS.includes(subject);
      return { id: p.id, start: hhmm(p.start_time), end: hhmm(p.end_time), mins: toMin(p.end_time) - toMin(p.start_time), subject, lesson, fam: FAMILY[subject] || "play" };
    })
    .filter((r) => r.subject && !/^transition$/i.test(r.subject));

  const rows = dayRows(day);
  const lessons = rows.filter((r) => r.lesson);
  const special = lessons.find((r) => SPECIALS.includes(r.subject));
  const homeTime = rows.length ? rows[rows.length - 1].end : null;

  // "Happening now" when the chosen day is today and school is on; otherwise "First up".
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = todayN === day;
  const current = isToday ? rows.find((r) => toMin(r.start) <= nowMin && nowMin < toMin(r.end)) : null;
  const next = current ? rows.find((r) => toMin(r.start) >= toMin(current.end)) : null;
  const firstUp = lessons[0];
  const progress = current ? Math.round(((nowMin - toMin(current.start)) / Math.max(1, current.mins)) * 100) : 0;

  const weekSpecials = [1, 2, 3, 4, 5].map((wd) => ({ wd, r: dayRows(wd).find((r) => SPECIALS.includes(r.subject)) })).filter((x) => x.r);
  const specialsStart = weekSpecials.length && weekSpecials.every((x) => x.r.start === weekSpecials[0].r.start) ? weekSpecials[0].r.start : null;

  const dayLong = dayDate.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  if (!children.length) {
    return <div className="bsf-screen"><p className="bsf-empty">{L("No child is linked to your account yet.", "Aucun enfant n'est encore lié à votre compte.")}</p></div>;
  }

  return (
    <div className="bsf-screen tt">
      <p className="bsf-eyebrow">{L("Timetable", "Emploi du temps")}</p>

      {children.length > 1 && (
        <div className="tt-kids">
          {children.map((c) => {
            const n = (c.name || "").trim().split(/\s+/)[0];
            return (
              <button key={c.id} className={`tt-kid ${c.id === child?.id ? "active" : ""}`} onClick={() => setChildId(c.id)}>
                <span className="tt-kid-dot">{n.charAt(0).toUpperCase()}</span>{n}
              </button>
            );
          })}
        </div>
      )}

      <h1 className="tt-title">{fr ? `La journée de ${firstName}` : `${firstName}'s day`}</h1>
      <p className="tt-sub">{gradeLabel(grade, language)} · {cap(dayLong)}</p>

      <div className="tt-days">
        {week.map((w) => (
          <button key={w.n} className={`tt-day ${w.n === day ? "active" : ""}`} onClick={() => setDay(w.n)} aria-pressed={w.n === day}>
            <span className="tt-day-name">{w.date.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")}</span>
            <span className="tt-day-num">{w.date.getDate()}</span>
            {w.n === todayN && <span className="tt-day-today" aria-label={L("Today", "Aujourd'hui")} />}
          </button>
        ))}
      </div>

      {loading && <p className="bsf-muted">{L("Loading…", "Chargement…")}</p>}
      {error && <p className="bsf-formerror">{L("The timetable could not be loaded. Please try again.", "L'emploi du temps n'a pas pu être chargé. Veuillez réessayer.")}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="bsf-empty">{L("The timetable for this class is not available yet.", "L'emploi du temps de cette classe n'est pas encore disponible.")}</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {current ? (
            <div className="tt-now">
              <div className="tt-now-head">
                <span className="tt-now-live"><span />{L("Happening now", "En ce moment")}</span>
                <span>{pad(now.getHours())}:{pad(now.getMinutes())}</span>
              </div>
              <p className="tt-now-subject">{tr(current.subject)}</p>
              <p className="tt-now-meta">{current.start} – {current.end} · {L(`${toMin(current.end) - nowMin} min left`, `encore ${toMin(current.end) - nowMin} min`)}</p>
              <div className="tt-now-bar"><div style={{ width: `${progress}%` }} /></div>
              {next && (
                <div className="tt-now-next"><span>{L("Next", "Ensuite")}</span><strong>{tr(next.subject)} · {next.start}</strong></div>
              )}
            </div>
          ) : firstUp && (
            <div className="tt-now">
              <div className="tt-now-head">
                <span className="tt-now-live"><span />{L("First lesson", "Premier cours")}</span>
                <span>{L("School opens", "Ouverture")} {rows[0].start}</span>
              </div>
              <p className="tt-now-subject">{tr(firstUp.subject)}</p>
              <p className="tt-now-meta">{firstUp.start} – {firstUp.end}</p>
            </div>
          )}

          <div className="tt-facts">
            <div><p>{L("Lessons", "Cours")}</p><strong>{lessons.length}</strong></div>
            <div><p>{L("Specialist", "Spécialité")}</p><strong className="tt-spec">{special ? tr(special.subject) : "—"}</strong></div>
            <div><p>{L("Home time", "Sortie")}</p><strong>{homeTime}</strong></div>
          </div>

          <h2 className="tt-h2">{L("The day, hour by hour", "La journée, heure par heure")}</h2>
          <ol className="tt-line">
            {rows.map((r) => {
              const live = current && current.id === r.id;
              return r.lesson ? (
                <li key={r.id} className={`tt-lesson fam-${r.fam} ${live ? "live" : ""}`}>
                  <div className="tt-time"><strong>{r.start}</strong><span>{r.end}</span></div>
                  <div className="tt-rail"><i /></div>
                  <div className="tt-card">
                    <div>
                      <p className="tt-card-subject">{tr(r.subject)}</p>
                      <p className="tt-card-meta">{r.mins} min</p>
                    </div>
                    <span className="tt-tag">{TAG[r.fam][fr ? 1 : 0]}</span>
                  </div>
                </li>
              ) : (
                <li key={r.id} className={`tt-routine ${live ? "live" : ""}`}>
                  <div className="tt-time"><span>{r.start}</span></div>
                  <div className="tt-rail"><i /></div>
                  <p>{tr(r.subject)}</p>
                </li>
              );
            })}
          </ol>

          {weekSpecials.length > 0 && (
            <section className="tt-week">
              <h2 className="tt-h2">{L("Specialist subjects this week", "Matières de spécialité cette semaine")}</h2>
              {specialsStart && <p className="tt-week-sub">{L(`Every day at ${specialsStart}`, `Chaque jour à ${specialsStart}`)}</p>}
              {weekSpecials.map(({ wd, r }) => {
                const d = week.find((w) => w.n === wd).date;
                return (
                  <div key={wd} className={`tt-week-row ${wd === day ? "active" : ""}`}>
                    <span>{cap(d.toLocaleDateString(locale, { weekday: "long" }))}</span>
                    <strong>{tr(r.subject)}</strong>
                    {!specialsStart && <em>{r.start}</em>}
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export { FamilyTimetable };

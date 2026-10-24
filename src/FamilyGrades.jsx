import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";
import { formatDateLong, gradeLabel } from "./lib/format";

// What families see of the Gradebook (design approved by Myri, 24 Oct 2026).
// Only assessments the teacher ticked "Share with families", one child at a time,
// with the teacher's comment. No running average: the term grade is on the report card.
// Pre-N to Grade 2 show levels; Grade 3 to 7 show the mark or letter.
// Follows the Hub's language toggle (never English and French side by side).

const EARLY = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2"];
const SPECIALS = ["Art", "Music", "Physical Education", "Swimming", "Technology"];

const WORDS = {
  en: {
    eyebrow: "Grades", title: (n) => `${n}'s learning`, grades: "Grades",
    shared: (n) => (n === 1 ? "1 result shared" : `${n} results shared`),
    allSubjects: "All subjects", bySubject: "By subject", latest: "Latest results",
    subjectsTerm: "Subjects this term", soon: "Results coming soon",
    count: (n) => (n === 1 ? "1 result" : `${n} results`),
    emptyTitle: "First results are on their way",
    emptyText: (n) => `${n}'s teachers share each assessment here once it has been checked. Results will appear subject by subject as the term goes on.`,
    howTitle: (n) => `How ${n} is assessed`,
    howEarly: (n) => `Each result shows where ${n} is on the way to the end-of-term goal. “Developing” early in the term is normal.`,
    howUpper: "Each result shows the mark and the letter grade it corresponds to.",
    key: "What the levels mean", letterKey: "Letter grades",
    reportTitle: (t) => `${t} report card`, reportTitleNoTerm: "Report card",
    reportText: "The term grade for each subject is on the report card at the end of the term.",
    loading: "Loading…", failed: "Results could not be loaded right now. Please try again later.",
    excused: "Excused", term: (n) => `Term ${n}`, specials: "Specialist subjects",
    types: { quiz: "Quiz", test: "Test", informal: "Informal assessment", project: "Project", presentation: "Presentation", homework: "Homework" },
    levels: { emerging: ["Emerging", "just starting"], developing: ["Developing", "on the way"], meeting: ["Meeting", "secure"], exceeding: ["Exceeding", "beyond"] },
    letters: [["A", "excellent"], ["B", "good"], ["C", "satisfactory"], ["D–F", "needs support"]],
    subjects: {},
  },
  fr: {
    eyebrow: "Résultats", title: (n) => `Les apprentissages de ${n}`, grades: "Résultats",
    shared: (n) => (n === 1 ? "1 résultat partagé" : `${n} résultats partagés`),
    allSubjects: "Toutes les matières", bySubject: "Par matière", latest: "Derniers résultats",
    subjectsTerm: "Matières ce trimestre", soon: "Résultats bientôt disponibles",
    count: (n) => (n === 1 ? "1 résultat" : `${n} résultats`),
    emptyTitle: "Les premiers résultats arrivent bientôt",
    emptyText: (n) => `Les enseignants de ${n} partagent ici chaque évaluation une fois vérifiée. Les résultats apparaîtront matière par matière au fil du trimestre.`,
    howTitle: (n) => `Comment ${n} est évalué(e)`,
    howEarly: (n) => `Chaque résultat indique où en est ${n} par rapport à l'objectif de fin de trimestre. « En cours » en début de trimestre est normal.`,
    howUpper: "Chaque résultat indique la note et la lettre correspondante.",
    key: "Ce que signifient les niveaux", letterKey: "Notes en lettres",
    reportTitle: (t) => `Bulletin du ${t.toLowerCase()}`, reportTitleNoTerm: "Bulletin",
    reportText: "La note du trimestre pour chaque matière figure sur le bulletin, à la fin du trimestre.",
    loading: "Chargement…", failed: "Les résultats n'ont pas pu être chargés pour le moment. Veuillez réessayer plus tard.",
    excused: "Dispensé(e)", term: (n) => `Trimestre ${n}`, specials: "Matières de spécialité",
    types: { quiz: "Quiz", test: "Contrôle", informal: "Évaluation informelle", project: "Projet", presentation: "Présentation", homework: "Devoir" },
    levels: { emerging: ["Émergent", "débute"], developing: ["En cours", "en progrès"], meeting: ["Atteint", "acquis"], exceeding: ["Dépassé", "au-delà"] },
    letters: [["A", "excellent"], ["B", "bien"], ["C", "satisfaisant"], ["D–F", "à soutenir"]],
    subjects: {
      "English Language Arts": "Anglais (Language Arts)", "Math": "Mathématiques", "French": "Français",
      "Unit of Inquiry": "Unité de recherche", "Art": "Arts plastiques", "Music": "Musique",
      "Physical Education": "Éducation physique", "Swimming": "Natation", "Technology": "Technologie",
      "Science": "Sciences", "Humanities": "Sciences humaines",
    },
  },
};

const SUBJECT_COLOR = {
  "English Language Arts": "#801524", "Math": "#2F4A7F", "French": "#7A5B16",
  "Unit of Inquiry": "#2F6040", "Science": "#2F6040", "Humanities": "#2F6040",
};
const subjectColor = (s) => SUBJECT_COLOR[s] || (SPECIALS.includes(s) ? "#6B3A6E" : "#8A6A2E");

const LEVEL_TONE = {
  emerging: { bg: "#F1E9EA", fg: "#5A3A40" }, developing: { bg: "#FBF0D6", fg: "#7A5B16" },
  meeting: { bg: "#E3F1E8", fg: "#2F6040" }, exceeding: { bg: "#E7ECF5", fg: "#2F4A7F" },
};
const NEUTRAL = { bg: "#F1E9EA", fg: "#5A3A40" };
const letterTone = (l) => (!l ? NEUTRAL : l[0] === "A" ? LEVEL_TONE.exceeding : l[0] === "B" ? LEVEL_TONE.meeting : l[0] === "C" ? LEVEL_TONE.developing : { bg: "#F8E4E4", fg: "#8A2A2A" });

// Same scale as the database (gb_letter).
function letterFor(pct) {
  const steps = [[97, "A+"], [93, "A"], [90, "A−"], [87, "B+"], [83, "B"], [80, "B−"], [77, "C+"], [73, "C"], [70, "C−"], [67, "D+"], [63, "D"], [60, "D−"]];
  for (const [min, l] of steps) if (pct >= min) return l;
  return "F";
}

// Subjects a class has this year (before any result is shared).
function baseSubjects(grade) {
  if (grade === "Grade 6" || grade === "Grade 7") return ["English Language Arts", "Math", "French", "Science", "Humanities"];
  if (grade === "Pre-N") return ["English Language Arts", "Math", "Unit of Inquiry"];
  return ["English Language Arts", "Math", "French", "Unit of Inquiry"];
}

function currentTermName(terms) {
  const today = new Date().toISOString().slice(0, 10);
  const list = (terms || []).filter((t) => t.startDate && t.endDate);
  const now = list.find((t) => t.startDate <= today && today <= t.endDate);
  return (now || list.find((t) => t.startDate > today))?.name || null;
}

const firstName = (s) => ((s?.name || s?.firstName || "").trim().split(/\s+/)[0]) || "";

const BookIcon = () => (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#801524" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" />
  </svg>
);

export function FamilyGrades({ student, terms, full = false }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  const w = WORDS[fr ? "fr" : "en"];
  const sub = (s) => w.subjects[s] || s;
  const early = EARLY.includes(student?.grade);
  const name = firstName(student);
  const termName = currentTermName(terms);
  const termLabel = termName && fr ? termName.replace(/^Term/, "Trimestre") : termName;

  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [subject, setSubject] = useState(null);

  useEffect(() => {
    if (!student?.id) return;
    let live = true;
    setRows(null); setFailed(false); setSubject(null);
    supabase.rpc("gb_family_results", { p_student: student.id }).then(({ data, error }) => {
      if (!live) return;
      if (error) { console.error(error); setFailed(true); setRows([]); return; }
      setRows(data || []);
    });
    return () => { live = false; };
  }, [student?.id]);

  const list = rows || [];
  const usesLevels = early || list.some((r) => r.grading === "level");
  const resultSubjects = useMemo(() => [...new Set(list.map((r) => r.subject))], [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiles = [...new Set([...baseSubjects(student?.grade), ...resultSubjects])]
    .map((s) => {
      const items = list.filter((r) => r.subject === s);
      return { s, items, latest: items[0] };
    });
  if (!resultSubjects.some((s) => SPECIALS.includes(s))) tiles.push({ s: w.specials, items: [], latest: null, group: true });
  const shown = list.filter((r) => !subject || r.subject === subject);

  function result(r) {
    if (r.excused) return { big: w.excused, small: "", tone: NEUTRAL };
    if (r.grading === "level") {
      const lv = w.levels[r.level];
      return { big: lv ? lv[0] : "—", small: "", tone: LEVEL_TONE[r.level] || NEUTRAL };
    }
    if (r.grading === "letter") return { big: r.letter, small: "", tone: letterTone(r.letter) };
    const max = Number(r.max_points);
    const pts = Number(r.points);
    const l = max > 0 ? letterFor(Math.round((100 * pts) / max)) : "";
    return { big: `${pts}/${max}`, small: l, tone: letterTone(l) };
  }

  const head = full ? (
    <>
      <p className="bsf-eyebrow fg-eyebrow">{w.eyebrow}</p>
      <h1 className="fg-title">{w.title(name)}</h1>
      <p className="fg-sub">{[gradeLabel(student?.grade, language), termLabel, list.length ? w.shared(list.length) : null].filter(Boolean).join(" · ")}</p>
    </>
  ) : (
    <div className="fg-cardhead">
      <h2>{w.grades}</h2>
      {list.length > 0 && <span className="bsf-muted">{w.shared(list.length)}</span>}
    </div>
  );

  const levelKey = (
    <div className="fg-panel">
      {rows && rows.length === 0 ? (
        <>
          <h3 className="fg-h3">{w.howTitle(name)}</h3>
          <p className="fg-panel-text">{usesLevels ? w.howEarly(name) : w.howUpper}</p>
        </>
      ) : (
        <p className="fg-panel-label">{usesLevels ? w.key : w.letterKey}</p>
      )}
      {usesLevels ? (
        <>
          <div className="fg-scale"><i className="e" /><i className="d" /><i className="m" /><i className="x" /></div>
          <div className="fg-scale-labels">
            {["emerging", "developing", "meeting", "exceeding"].map((id) => (
              <span key={id}><strong>{w.levels[id][0]}</strong>{w.levels[id][1]}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="fg-letters">
          {w.letters.map(([l, d], i) => (
            <span key={l}><b style={{ background: [LEVEL_TONE.exceeding, LEVEL_TONE.meeting, LEVEL_TONE.developing, { bg: "#F8E4E4", fg: "#8A2A2A" }][i].bg, color: [LEVEL_TONE.exceeding, LEVEL_TONE.meeting, LEVEL_TONE.developing, { bg: "#F8E4E4", fg: "#8A2A2A" }][i].fg }}>{l}</b>{d}</span>
          ))}
        </div>
      )}
    </div>
  );

  const report = (
    <div className="fg-report">
      <BookIcon />
      <div>
        <p className="fg-report-title">{termLabel ? w.reportTitle(termLabel) : w.reportTitleNoTerm}</p>
        <p className="fg-report-text">{w.reportText}</p>
      </div>
    </div>
  );

  return (
    <section className={`fg ${full ? "fg-full" : "bsf-card"}`}>
      {head}

      {rows === null && <p className="bsf-muted fg-gap">{w.loading}</p>}
      {rows !== null && failed && <p className="bsf-formerror fg-gap">{w.failed}</p>}

      {rows !== null && !failed && rows.length === 0 && (
        <>
          <div className="fg-empty">
            <div className="fg-empty-icon">
              <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#801524" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10" /><path d="M12 10c0-3 2.5-5.5 6-5.5 0 3.5-2.5 5.5-6 5.5z" /><path d="M12 13c0-2.5-2-4.5-5-4.5 0 2.8 2 4.5 5 4.5z" /><path d="M7 20h10" />
              </svg>
            </div>
            <h3>{w.emptyTitle}</h3>
            <p>{w.emptyText(name)}</p>
          </div>
          <h3 className="fg-h2">{w.subjectsTerm}</h3>
          <div className="fg-tiles">
            {tiles.map((t) => (
              <div key={t.s} className="fg-tile">
                <i style={{ background: t.group ? "#6B3A6E" : subjectColor(t.s) }} />
                <p className="fg-tile-name">{t.group ? t.s : sub(t.s)}</p>
                <p className="fg-tile-soon">{w.soon}</p>
              </div>
            ))}
          </div>
          {levelKey}
          {report}
        </>
      )}

      {rows && rows.length > 0 && (
        <>
          {resultSubjects.length > 1 && (
            <div className="fg-chips">
              <button className={`fg-chip ${subject === null ? "active" : ""}`} onClick={() => setSubject(null)}>{w.allSubjects}</button>
              {resultSubjects.map((s) => (
                <button key={s} className={`fg-chip ${subject === s ? "active" : ""}`} onClick={() => setSubject(s)}>{sub(s)}</button>
              ))}
            </div>
          )}

          {!subject && (
            <>
              <h3 className="fg-h2">{w.bySubject}</h3>
              <div className="fg-tiles">
                {tiles.map((t) => {
                  const res = t.latest ? result(t.latest) : null;
                  const clickable = t.items.length > 0;
                  const body = (
                    <>
                      <i style={{ background: t.group ? "#6B3A6E" : subjectColor(t.s) }} />
                      <p className="fg-tile-name">{t.group ? t.s : sub(t.s)}</p>
                      {res ? (
                        <div className="fg-tile-row">
                          <span className="fg-pill" style={{ background: res.tone.bg, color: res.tone.fg }}>{res.small ? `${res.big} · ${res.small}` : res.big}</span>
                          <span className="fg-tile-count">{w.count(t.items.length)}</span>
                        </div>
                      ) : <p className="fg-tile-soon">{w.soon}</p>}
                    </>
                  );
                  return clickable
                    ? <button key={t.s} className="fg-tile fg-tile-btn" onClick={() => setSubject(t.s)}>{body}</button>
                    : <div key={t.s} className="fg-tile">{body}</div>;
                })}
              </div>
            </>
          )}

          <h3 className="fg-h2">{subject ? sub(subject) : w.latest}</h3>
          <div className="fg-results">
            {shown.map((r) => {
              const res = result(r);
              const meta = [w.types[r.assess_type] || "", r.assessed_on ? formatDateLong(r.assessed_on, language) : "", w.term(r.term)].filter(Boolean).join(" · ");
              return (
                <article key={r.assessment_id} className="fg-result">
                  <div className="fg-result-top">
                    <div style={{ minWidth: 0 }}>
                      {!subject && <p className="fg-result-subject" style={{ color: subjectColor(r.subject) }}>{sub(r.subject)}</p>}
                      <p className="fg-result-title">{r.title}</p>
                      <p className="fg-result-meta">{meta}</p>
                    </div>
                    <div className="fg-badge" style={{ background: res.tone.bg, color: res.tone.fg }}>
                      <strong>{res.big}</strong>
                      {res.small && <span>{res.small}</span>}
                    </div>
                  </div>
                  {r.note && <p className="fg-note">{r.note}</p>}
                </article>
              );
            })}
          </div>
          {levelKey}
          {report}
        </>
      )}
    </section>
  );
}

// The family "Assessment" tab: one child at a time, with a switcher for families with several.
export function FamilyGradesTab({ data, profile }) {
  const ids = profile?.student_ids || [];
  const kids = (data?.students || []).filter((s) => ids.includes(s.id));
  const [active, setActive] = useState(kids[0]?.id || null);
  const kid = kids.find((k) => k.id === active) || kids[0];
  if (!kid) return null;
  return (
    <div className="bsf-screen">
      {kids.length > 1 && (
        <div className="tt-kids fg-kids">
          {kids.map((k) => {
            const n = firstName(k);
            return (
              <button key={k.id} className={`tt-kid ${k.id === kid.id ? "active" : ""}`} onClick={() => setActive(k.id)}>
                <span className="tt-kid-dot">{n.charAt(0).toUpperCase()}</span>{n}
              </button>
            );
          })}
        </div>
      )}
      <FamilyGrades key={kid.id} student={kid} terms={data?.settings?.terms} full />
    </div>
  );
}

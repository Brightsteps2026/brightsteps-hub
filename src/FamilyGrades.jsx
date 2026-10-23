import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";
import { formatDateLong } from "./lib/format";
import { COLORS, TONES, chip, chipOn, pill } from "./ui/tokens";

// What families see of the Gradebook: only assessments the teacher ticked
// "Share with families", one child at a time, with the teacher's comment.
// No running average: the term grade is on the published report card.
// Pre-N to Grade 2 (and specials) show levels; Grade 3 to 7 show the mark or letter.
// Follows the Hub's language toggle (never English and French side by side).

const EARLY = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2"];

const WORDS = {
  en: {
    title: "Grades", all: "All", none: "No results shared yet.",
    noneHint: "Teachers share results here once they have been checked.",
    loading: "Loading…", failed: "Results could not be loaded right now.",
    excused: "Excused", term: (n) => `Term ${n}`,
    note: "The term grade for each subject appears on the report card at the end of the term.",
    earlyNote: "Levels describe progress toward end-of-term goals. “Developing” early in the term is normal.",
    key: "What the levels mean",
    types: { quiz: "Quiz", test: "Test", informal: "Informal assessment", project: "Project", presentation: "Presentation", homework: "Homework" },
    levels: { emerging: ["Emerging", "just starting"], developing: ["Developing", "on the way"], meeting: ["Meeting", "secure"], exceeding: ["Exceeding", "beyond"] }
  },
  fr: {
    title: "Résultats", all: "Tout", none: "Aucun résultat partagé pour l'instant.",
    noneHint: "Les enseignants partagent les résultats ici une fois vérifiés.",
    loading: "Chargement…", failed: "Les résultats n'ont pas pu être chargés pour le moment.",
    excused: "Dispensé(e)", term: (n) => `Trimestre ${n}`,
    note: "La note du trimestre pour chaque matière figure sur le bulletin, à la fin du trimestre.",
    earlyNote: "Les niveaux décrivent les progrès vers les objectifs de fin de trimestre. « En cours » en début de trimestre est normal.",
    key: "Ce que signifient les niveaux",
    types: { quiz: "Quiz", test: "Contrôle", informal: "Évaluation informelle", project: "Projet", presentation: "Présentation", homework: "Devoir" },
    levels: { emerging: ["Émergent", "débute"], developing: ["En cours", "en progrès"], meeting: ["Atteint", "acquis"], exceeding: ["Dépassé", "au-delà"] }
  }
};

const LEVEL_TONE = { emerging: TONES.neutral, developing: TONES.warn, meeting: TONES.ok, exceeding: TONES.info };
const LEVEL_SHORT = { emerging: "E", developing: "D", meeting: "M", exceeding: "Ex" };

// Same scale as the database (gb_letter).
function letterFor(pct) {
  const steps = [[97, "A+"], [93, "A"], [90, "A−"], [87, "B+"], [83, "B"], [80, "B−"], [77, "C+"], [73, "C"], [70, "C−"], [67, "D+"], [63, "D"], [60, "D−"]];
  for (const [min, l] of steps) if (pct >= min) return l;
  return "F";
}
const letterTone = (l) => (!l ? TONES.neutral : l[0] === "A" || l[0] === "B" ? TONES.ok : l[0] === "C" ? TONES.warn : TONES.bad);

export function FamilyGrades({ student }) {
  const { language } = useLanguage();
  const w = WORDS[language === "fr" ? "fr" : "en"];
  const early = EARLY.includes(student?.grade);
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [subject, setSubject] = useState(null);

  useEffect(() => {
    if (!student?.id) return;
    let live = true;
    setRows(null); setFailed(false); setSubject(null);
    supabase.rpc("gb_family_results", { p_student: student.id }).then(({ data, error }) => {
      if (!live) return;
      if (error) { setFailed(true); setRows([]); return; }
      setRows(data || []);
    });
    return () => { live = false; };
  }, [student?.id]);

  const subjects = useMemo(() => [...new Set((rows || []).map((r) => r.subject))], [rows]);
  const shown = (rows || []).filter((r) => !subject || r.subject === subject);
  const bySubject = subjects.filter((s) => !subject || s === subject).map((s) => ({ s, items: shown.filter((r) => r.subject === s) }));
  const anyLevels = (rows || []).some((r) => r.grading === "level");

  function result(r) {
    if (r.excused) return { big: w.excused, small: "", tone: TONES.neutral };
    if (r.grading === "level") {
      const lv = w.levels[r.level];
      return { big: lv ? lv[0] : "", small: "", tone: LEVEL_TONE[r.level] || TONES.neutral, level: true };
    }
    if (r.grading === "letter") return { big: r.letter, small: "", tone: letterTone(r.letter) };
    const max = Number(r.max_points);
    const pts = Number(r.points);
    const l = max > 0 ? letterFor(Math.round((100 * pts) / max)) : "";
    return { big: `${pts}/${max}`, small: l, tone: letterTone(l) };
  }

  return (
    <section className="bsf-card">
      <h2>{w.title}</h2>

      {rows === null && <p className="bsf-empty">{w.loading}</p>}
      {rows !== null && failed && <p className="bsf-empty">{w.failed}</p>}
      {rows !== null && !failed && rows.length === 0 && (
        <>
          <p className="bsf-empty">{w.none}</p>
          <p className="bsf-muted" style={{ marginTop: 4 }}>{w.noneHint}</p>
        </>
      )}

      {rows && rows.length > 0 && (
        <>
          {subjects.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 14px" }}>
              <button onClick={() => setSubject(null)} style={subject === null ? chipOn : chip}>{w.all}</button>
              {subjects.map((s) => <button key={s} onClick={() => setSubject(s)} style={subject === s ? chipOn : chip}>{s}</button>)}
            </div>
          )}

          {(early || anyLevels) && (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{w.key}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, fontSize: 12, lineHeight: 1.35 }}>
                {Object.keys(LEVEL_SHORT).map((id) => (
                  <div key={id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ ...pill(LEVEL_TONE[id]), fontWeight: 700 }}>{LEVEL_SHORT[id]}</span>
                    <span>{w.levels[id][0]}: {w.levels[id][1]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bySubject.map(({ s, items }) => (
            <div key={s} style={{ marginBottom: 16 }}>
              <h3 className="bsf-subheading" style={{ margin: "0 0 8px" }}>{s}</h3>
              {items.map((r) => {
                const res = result(r);
                const meta = [w.types[r.assess_type] || "", r.assessed_on ? formatDateLong(r.assessed_on, language) : "", w.term(r.term)].filter(Boolean).join(" · ");
                return (
                  <div key={r.assessment_id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: `1px solid ${COLORS.line}` }}>
                    <div style={{ flex: "0 0 auto", minWidth: 62, textAlign: "center", padding: "8px 6px", borderRadius: 10, background: res.tone.bg, color: res.tone.fg }}>
                      <div style={{ fontWeight: 700, fontSize: res.level ? 13 : 16 }}>{res.big}</div>
                      {res.small && <div style={{ fontSize: 12 }}>{res.small}</div>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      <div className="bsf-muted" style={{ fontSize: 12 }}>{meta}</div>
                      {r.note && <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-line" }}>{r.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 12, background: COLORS.tint, marginTop: 6 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto", marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
        </svg>
        <span style={{ fontSize: 13, lineHeight: 1.45 }}>{early ? w.earlyNote : w.note}</span>
      </div>
    </section>
  );
}

// The family "Assessment" tab: one block per linked child.
export function FamilyGradesTab({ data, profile }) {
  const ids = profile?.student_ids || [];
  const kids = (data?.students || []).filter((s) => ids.includes(s.id));
  return (
    <>
      {kids.map((k) => (
        <div key={k.id}>
          {kids.length > 1 && <p className="bsf-muted" style={{ margin: "8px 0 6px", fontWeight: 600 }}>{k.name || k.firstName || ""}</p>}
          <FamilyGrades student={k} />
        </div>
      ))}
    </>
  );
}

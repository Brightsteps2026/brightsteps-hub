import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./lib/supabaseClient";
import { getAttachmentUrl } from "./lib/attachments";
import { useLanguage } from "./lib/i18n";
import { gradeLabel } from "./lib/format";
import { Modal } from "./ui/common";
import { COLORS, FONT, TONES, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, pill } from "./ui/tokens";
import { SCHOOL_YEAR, EARLY, SUBJECTS, SPECIALS, COMMENT_GRADES, termFor, termLevelFor } from "./SchoolGradebook";
import { isEarlyYears } from "./data/earlyYears";
import { EarlyYearsDocument, EarlyYearsEditor, earlyYearsDefaults, periodText } from "./EarlyYearsReport";

// Term report cards, built from the Gradebook (gb_* tables) and saved in
// term_reports (see supabase/term-reports.sql).
//   Staff (English only): make drafts for a whole class, refresh them, pick
//   photos for the little ones; only the admin publishes.
//   Families: see published report cards of their own children, in English
//   or French, and print them on A4.

const ALL_GRADES = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
const PRINCIPAL = "Myriam Aoussou";
const MAX_HIGHLIGHTS = 3;
// The school logo always appears, even if no logo was set in Settings.
const logoOf = (data) => data?.settings?.branding?.logoUrl || "/logo.png";

const card = { ...cardToken, marginBottom: 14 };
const serif = "'Fraunces', serif";

// ---------------------------------------------------------------------------
// Words on the report card, in English and French
// ---------------------------------------------------------------------------

const W = {
  en: {
    title: (t) => `Term ${t} progress report`,
    progress: "Progress report",
    tagline: "Grand-Bassam, Côte d'Ivoire · Inquiry-based learning",
    homeroom: "Homeroom",
    studentId: "ID",
    attendance: "Attendance",
    attLine: (a) => `${a.present} present · ${a.absent} absent${a.excused ? ` (${a.excused} excused)` : ""} · ${a.late} late`,
    core: "Achievement",
    specials: "Specialist subjects",
    formSumm: (f, s) => [f != null ? `Formative ${f}%` : null, s != null ? `Summative ${s}%` : null].filter(Boolean).join(" · "),
    skills: "Approaches to learning · SEL · Life skills",
    areas: { atl: "Approaches to learning", sel: "Social and emotional learning", life: "Life skills" },
    ratings: { rarely: "Rarely", sometimes: "Sometimes", usually: "Usually", consistently: "Consistently" },
    levels: { emerging: "Emerging", developing: "Developing", meeting: "Meeting", exceeding: "Exceeding" },
    highlights: "Learning highlights",
    teacherComment: "Homeroom teacher's comment",
    principalComment: "Principal's comment",
    homeroomSig: "Homeroom teacher",
    principalSig: "Principal",
    keyLetters: "Grades: A+ to A− 90–100 · B+ to B− 80–89 · C+ to C− 70–79 · D+ to D− 60–69 · F below 60. Term grades count summative work 70% and formative work 30%.",
    keyLevels: "Levels: Emerging (beginning to show the skill with support) · Developing (shows the skill with some support) · Meeting (shows the skill independently) · Exceeding (applies the skill confidently in new situations).",
    keyRatings: "Approaches to learning, SEL and Life skills are rated Rarely, Sometimes, Usually or Consistently.",
    print: "Print",
    none: "No report cards yet.",
    published: (d) => `Published ${d}`
  },
  fr: {
    title: (t) => `Bulletin du trimestre ${t}`,
    progress: "Bulletin de progression",
    tagline: "Grand-Bassam, Côte d'Ivoire · Apprentissage par investigation",
    homeroom: "Enseignant(e) principal(e)",
    studentId: "N°",
    attendance: "Assiduité",
    attLine: (a) => `${a.present} présent(e) · ${a.absent} absent(e)${a.excused ? ` (dont ${a.excused} excusé(es))` : ""} · ${a.late} retard(s)`,
    core: "Résultats",
    specials: "Matières de spécialité",
    formSumm: (f, s) => [f != null ? `Formatif ${f} %` : null, s != null ? `Sommatif ${s} %` : null].filter(Boolean).join(" · "),
    skills: "Méthodes d'apprentissage · Compétences socio-émotionnelles · Savoir-être",
    areas: { atl: "Méthodes d'apprentissage", sel: "Compétences socio-émotionnelles", life: "Savoir-être et autonomie" },
    ratings: { rarely: "Rarement", sometimes: "Parfois", usually: "Souvent", consistently: "Toujours" },
    levels: { emerging: "Émergent", developing: "En développement", meeting: "Atteint", exceeding: "Dépassé" },
    highlights: "Moments d'apprentissage",
    teacherComment: "Appréciation de l'enseignant(e) principal(e)",
    principalComment: "Appréciation de la direction",
    homeroomSig: "Enseignant(e) principal(e)",
    principalSig: "Directrice",
    keyLetters: "Notes : A+ à A− 90–100 · B+ à B− 80–89 · C+ à C− 70–79 · D+ à D− 60–69 · F moins de 60. La note du trimestre compte les évaluations sommatives à 70 % et formatives à 30 %.",
    keyLevels: "Niveaux : Émergent (commence à montrer la compétence avec de l'aide) · En développement (montre la compétence avec un peu d'aide) · Atteint (montre la compétence seul(e)) · Dépassé (applique la compétence avec assurance dans de nouvelles situations).",
    keyRatings: "Les méthodes d'apprentissage, compétences socio-émotionnelles et savoir-être sont évalués : Rarement, Parfois, Souvent ou Toujours.",
    print: "Imprimer",
    none: "Aucun bulletin pour le moment.",
    published: (d) => `Publié le ${d}`
  }
};

const SUBJECT_NAMES = {
  "English Language Arts": { en: "English Language Arts", fr: "Langue anglaise" },
  Math: { en: "Mathematics", fr: "Mathématiques" },
  French: { en: "French", fr: "Français" },
  "Unit of Inquiry": { en: "Unit of Inquiry", fr: "Unité d'investigation" },
  Art: { en: "Art", fr: "Arts plastiques" },
  Music: { en: "Music", fr: "Musique" },
  "Physical Education": { en: "Physical Education", fr: "Éducation physique" },
  Swimming: { en: "Swimming", fr: "Natation" },
  Technology: { en: "Technology", fr: "Technologie" }
};
const subjectName = (s, lang) => SUBJECT_NAMES[s]?.[lang] || s;

const RATING_ORDER = ["rarely", "sometimes", "usually", "consistently"];
const LEVEL_TONE = { emerging: TONES.bad, developing: TONES.warn, meeting: TONES.ok, exceeding: TONES.info };

function longDate(iso, lang) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const subjectOrder = (a, b) => {
  const ia = SUBJECTS.indexOf(a), ib = SUBJECTS.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
};

// ---------------------------------------------------------------------------
// Building a report card from the Gradebook
// ---------------------------------------------------------------------------

// Everything needed to build the report cards of one class for one term.
async function loadClassSources(grade, term) {
  const st = await supabase.from("students").select("id, full_name, grade, legacy_id").eq("grade", grade).order("full_name");
  if (st.error) throw st.error;
  const students = st.data || [];
  const ids = students.map((s) => s.id);
  const empty = { students, assessments: [], marks: {}, comments: [], skills: [], ratings: [], notes: [], homerooms: {} };
  if (!ids.length) return empty;

  const [as, cm, sk, rt, nt, hr] = await Promise.all([
    supabase.from("gb_assessments").select("id, subject, kind, grading, max_points, assessed_on, created_at")
      .eq("grade", grade).eq("term", term).eq("school_year", SCHOOL_YEAR)
      .order("assessed_on", { ascending: true, nullsFirst: true }).order("created_at", { ascending: true }),
    supabase.from("gb_subject_comments").select("student_id, subject, comment").in("student_id", ids).eq("term", term).eq("school_year", SCHOOL_YEAR),
    supabase.from("gb_skills").select("id, area, name_en, name_fr, sort").eq("active", true).order("sort"),
    supabase.from("gb_skill_ratings").select("student_id, skill_id, rating").in("student_id", ids).eq("term", term).eq("school_year", SCHOOL_YEAR),
    supabase.from("gb_term_notes").select("student_id, note").in("student_id", ids).eq("term", term).eq("school_year", SCHOOL_YEAR),
    supabase.rpc("term_report_homerooms", { p_grade: grade })
  ]);
  for (const r of [as, cm, sk, rt, nt]) if (r.error) throw r.error;

  const assessments = as.data || [];
  const marks = {};
  if (assessments.length) {
    const mk = await supabase.from("gb_marks").select("assessment_id, student_id, points, letter, level, excused")
      .in("assessment_id", assessments.map((a) => a.id));
    if (mk.error) throw mk.error;
    (mk.data || []).forEach((m) => { marks[`${m.assessment_id}:${m.student_id}`] = m; });
  }
  const homerooms = {};
  if (!hr.error) (hr.data || []).forEach((h) => { homerooms[h.student_id] = h.teacher_name; });

  return { students, assessments, marks, comments: cm.data || [], skills: sk.data || [], ratings: rt.data || [], notes: nt.data || [], homerooms };
}

function termDates(settings, term) {
  const t = (settings?.terms || [])[term - 1] || {};
  return { start: t.startDate || "", end: t.endDate || "" };
}

function attendanceFor(hubId, attendance, dates) {
  if (!hubId || !dates.start || !dates.end) return null;
  const a = { present: 0, absent: 0, late: 0, excused: 0 };
  Object.entries(attendance || {}).forEach(([day, row]) => {
    if (day < dates.start || day > dates.end) return;
    const [yy, mm, dd] = day.split("-").map(Number);
    const dow = new Date(yy, mm - 1, dd).getDay();
    if (dow === 0 || dow === 6) return; // no school on weekends
    const v = row && row[hubId];
    if (v === "present") a.present += 1;
    else if (v === "late") a.late += 1;
    else if (v === "absent") a.absent += 1;
    else if (v === "excused") { a.absent += 1; a.excused += 1; }
  });
  const days = a.present + a.late + a.absent;
  return { ...a, rate: days ? Math.round((100 * (a.present + a.late)) / days) : null };
}

// Builds the snapshot saved in term_reports.content. `keep` is the previous
// content: the photos chosen and the principal's comment are kept on refresh.
// A leaving progress report (`leaving` = { date }) only covers the term
// up to the child's last day: later assessments and attendance are left out.
// Pass leaving = undefined to keep what was there, null to turn it off.
function buildContent(stu, grade, term, srcAll, data, keep, leavingOpt) {
  const leaving = leavingOpt === undefined ? keep?.leaving || null : leavingOpt;
  const src = leaving?.date
    ? { ...srcAll, assessments: srcAll.assessments.filter((a) => !a.assessed_on || a.assessed_on <= leaving.date) }
    : srcAll;
  const hub = (data?.students || []).find((s) => s.id === stu.legacy_id);
  const early = EARLY.includes(grade);
  const subjects = Array.from(new Set([
    ...src.assessments.map((a) => a.subject),
    ...src.comments.filter((c) => c.student_id === stu.id && c.comment).map((c) => c.subject)
  ])).sort(subjectOrder);

  const core = [], specials = [];
  subjects.forEach((subject) => {
    const list = src.assessments.filter((a) => a.subject === subject);
    const comment = (src.comments.find((c) => c.student_id === stu.id && c.subject === subject)?.comment || "").trim();
    const leveled = early || SPECIALS.includes(subject) || list.some((a) => a.grading === "level");
    const row = { subject, comment: comment || null };
    if (leveled) {
      row.level = list.length ? termLevelFor(stu.id, list, src.marks) : null;
    } else {
      const r = termFor(stu.id, list, src.marks);
      Object.assign(row, { formative: r.f, summative: r.s, percent: r.term, letter: r.letter });
    }
    const hasResult = row.level || row.letter || row.comment;
    if (!hasResult) return;
    (SPECIALS.includes(subject) ? specials : core).push(row);
  });

  const skills = src.skills
    .map((k) => ({ area: k.area, en: k.name_en, fr: k.name_fr, rating: src.ratings.find((r) => r.student_id === stu.id && r.skill_id === k.id)?.rating || null }))
    .filter((k) => k.rating);

  const termRange = termDates(data?.settings, term);
  const dates = leaving?.date && (!termRange.end || leaving.date < termRange.end) ? { ...termRange, end: leaving.date } : termRange;
  const homeroomNote = (src.notes.find((n) => n.student_id === stu.id)?.note || "").trim() || null;
  const early_years = isEarlyYears(grade)
    ? {
        kind: "early-years",
        ey: earlyYearsDefaults(grade, keep?.ey,
          (subject) => src.comments.find((c) => c.student_id === stu.id && c.subject === subject)?.comment || "",
          homeroomNote)
      }
    : {};
  return {
    ...early_years,
    version: 1,
    leaving,
    builtAt: new Date().toISOString(),
    student: {
      name: stu.full_name || hub?.name || "",
      idNumber: hub?.studentIdNumber || null,
      photoPath: hub?.photo?.path || null
    },
    grade,
    early,
    commentsOnlySpecials: COMMENT_GRADES.includes(grade),
    homeroom: src.homerooms[stu.id] || null,
    period: dates,
    attendance: attendanceFor(stu.legacy_id, data?.attendance, dates),
    core,
    specials,
    skills,
    homeroomNote,
    highlights: keep?.highlights || [],
    principalComment: keep?.principalComment || null
  };
}

// ---------------------------------------------------------------------------
// The report card itself (screen and A4 print)
// ---------------------------------------------------------------------------

const PRINT_CSS = `
.bs-trc { font-family: 'Work Sans', sans-serif; color: ${COLORS.ink}; background: #fff; }
.bs-trc h2, .bs-trc h3 { margin: 0; }
.bs-trc-label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: ${COLORS.muted}; font-weight: 600; margin: 0 0 6px; }
.bs-trc-section { margin-top: 18px; break-inside: avoid; page-break-inside: avoid; }
.bs-trc-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 9px 0; border-top: 1px solid ${COLORS.line}; break-inside: avoid; }
.bs-trc-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid ${COLORS.brand}; margin-left: 4px; }
.bs-trc-dot.on { background: ${COLORS.brand}; }
.bs-trc-photos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.bs-trc-photos img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; display: block; }
.bs-trc-print-root { display: none; }
@media print {
  @page { size: A4; margin: 14mm 14mm 16mm; }
  body.bs-trc-printing > *:not(.bs-trc-print-root) { display: none !important; }
  body.bs-trc-printing .bs-trc-print-root { display: block !important; }
  .bs-trc-print-root.bsf-printable { position: static !important; padding: 0 !important; width: auto !important; }
  .bs-trc { font-size: 10.5pt; }
  .bs-trc-paper { border: none !important; box-shadow: none !important; padding: 0 !important; }
  .bs-trc-photos img { max-height: 48mm; }
}`;

function usePhotoUrls(paths) {
  const key = paths.filter(Boolean).join("|");
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let alive = true;
    const list = key ? key.split("|") : [];
    Promise.all(list.map((p) => getAttachmentUrl(p).then((u) => [p, u]).catch(() => [p, null])))
      .then((pairs) => { if (alive) setUrls(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [key]);
  return urls;
}

function SkillDots({ rating }) {
  const n = RATING_ORDER.indexOf(rating) + 1;
  return (
    <span aria-hidden="true" style={{ whiteSpace: "nowrap" }}>
      {RATING_ORDER.map((r, i) => <i key={r} className={`bs-trc-dot ${i < n ? "on" : ""}`} />)}
    </span>
  );
}

function ResultCell({ row, w }) {
  if (row.letter) {
    return (
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: COLORS.brand, lineHeight: 1.1 }}>{row.letter}</div>
        {row.percent != null && <div style={{ fontSize: 12, color: COLORS.muted }}>{row.percent}%</div>}
      </div>
    );
  }
  if (row.level) {
    return <span style={{ ...pill(LEVEL_TONE[row.level]), fontSize: 12 }}>{w.levels[row.level]}</span>;
  }
  return null;
}

function TermReportDocument({ report, lang, logoUrl }) {
  if (report?.content?.kind === "early-years") return <><style>{PRINT_CSS}</style><EarlyYearsDocument report={report} lang={lang} logoUrl={logoUrl || "/logo.png"} /></>;
  return <StandardReportDocument report={report} lang={lang} logoUrl={logoUrl} />;
}

function StandardReportDocument({ report, lang, logoUrl }) {
  const w = W[lang] || W.en;
  const c = report.content || {};
  const photos = usePhotoUrls([c.student?.photoPath, ...(c.highlights || []).map((h) => h.path)]);
  const areas = ["atl", "sel", "life"].filter((a) => (c.skills || []).some((k) => k.area === a));
  const hasLetters = (c.core || []).some((r) => r.letter);
  const hasLevels = (c.core || []).concat(c.specials || []).some((r) => r.level);
  const showPrincipal = report.term === 3 && c.principalComment;

  return (
    <div className="bs-trc">
      <style>{PRINT_CSS}</style>
      <div className="bs-trc-paper" style={{ border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "22px 22px 18px", background: "#fff" }}>
        {/* Letterhead */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: `2px solid ${COLORS.brand}`, paddingBottom: 12 }}>
          {logoUrl && <img src={logoUrl} alt="" style={{ width: 54, height: 54, objectFit: "contain" }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: serif, fontSize: 21, fontWeight: 600, color: COLORS.brand }}>BrightSteps International School</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: COLORS.muted }}>{w.tagline}</p>
          </div>
        </div>

        {/* Student */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 16 }}>
          <div style={{ width: 64, height: 80, borderRadius: 6, background: COLORS.neutralBg, overflow: "hidden", flexShrink: 0 }}>
            {photos[c.student?.photoPath] && <img src={photos[c.student.photoPath]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="bs-trc-label" style={{ margin: 0 }}>
              {c.leaving ? w.progress : w.title(report.term)} · {report.school_year.replace("-", "–")}
              {c.leaving && c.period?.start && c.period?.end ? ` · ${periodText(c.period, lang)}` : ""}
            </p>
            <h3 style={{ fontFamily: serif, fontSize: 24, fontWeight: 500, margin: "2px 0 3px" }}>{c.student?.name}</h3>
            <p style={{ margin: 0, fontSize: 13, color: COLORS.text2 }}>
              {gradeLabel(report.grade, lang)}
              {c.homeroom ? ` · ${w.homeroom}: ${c.homeroom}` : ""}
              {c.student?.idNumber ? ` · ${w.studentId} ${c.student.idNumber}` : ""}
            </p>
          </div>
        </div>

        {c.attendance && (
          <div style={{ marginTop: 14, background: COLORS.bg, borderRadius: 6, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p className="bs-trc-label" style={{ margin: 0 }}>{w.attendance}</p>
              <p style={{ margin: "2px 0 0", fontSize: 13 }}>{w.attLine(c.attendance)}</p>
            </div>
            {c.attendance.rate != null && <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: COLORS.brand }}>{c.attendance.rate}%</div>}
          </div>
        )}

        {/* Core subjects */}
        {(c.core || []).length > 0 && (
          <div className="bs-trc-section">
            <p className="bs-trc-label">{w.core}</p>
            {c.core.map((r) => (
              <div key={r.subject} className="bs-trc-row">
                <div>
                  <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 500 }}>{subjectName(r.subject, lang)}</div>
                  {r.comment && <p style={{ margin: "3px 0 0", fontSize: 13, color: COLORS.text2, lineHeight: 1.5 }}>{r.comment}</p>}
                  {r.letter && (r.formative != null || r.summative != null) && (
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: COLORS.faint }}>{w.formSumm(r.formative, r.summative)}</p>
                  )}
                </div>
                <ResultCell row={r} w={w} />
              </div>
            ))}
          </div>
        )}

        {/* Specialist subjects */}
        {(c.specials || []).length > 0 && (
          <div className="bs-trc-section">
            <p className="bs-trc-label">{w.specials}</p>
            {c.specials.map((r) => (
              <div key={r.subject} className="bs-trc-row">
                <div>
                  <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 500 }}>{subjectName(r.subject, lang)}</div>
                  {r.comment && <p style={{ margin: "3px 0 0", fontSize: 13, color: COLORS.text2, lineHeight: 1.5 }}>{r.comment}</p>}
                </div>
                <ResultCell row={r} w={w} />
              </div>
            ))}
          </div>
        )}

        {/* Learning highlights (photos, early years) */}
        {(c.highlights || []).length > 0 && (
          <div className="bs-trc-section">
            <p className="bs-trc-label">{w.highlights}</p>
            <div className="bs-trc-photos">
              {c.highlights.map((h) => (
                <figure key={h.path} style={{ margin: 0 }}>
                  {photos[h.path] ? <img src={photos[h.path]} alt={h.caption || ""} /> : <div style={{ aspectRatio: "4 / 3", background: COLORS.neutralBg, borderRadius: 6 }} />}
                  {h.caption && <figcaption style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, lineHeight: 1.4 }}>{h.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* ATL · SEL · Life skills */}
        {areas.length > 0 && (
          <div className="bs-trc-section">
            <p className="bs-trc-label">{w.skills}</p>
            {areas.map((a) => (
              <div key={a} style={{ marginBottom: 8, breakInside: "avoid" }}>
                <p style={{ margin: "6px 0 2px", fontSize: 13, fontWeight: 600, color: COLORS.text2 }}>{w.areas[a]}</p>
                {c.skills.filter((k) => k.area === a).map((k) => (
                  <div key={k.en} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13, padding: "3px 0" }}>
                    <span>{lang === "fr" ? k.fr : k.en}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: COLORS.muted }}>{w.ratings[k.rating]}</span>
                      <SkillDots rating={k.rating} />
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Comments */}
        {c.homeroomNote && (
          <div className="bs-trc-section">
            <p className="bs-trc-label">{w.teacherComment}</p>
            <p style={{ margin: 0, fontFamily: serif, fontSize: 15, lineHeight: 1.6 }}>{c.homeroomNote}</p>
          </div>
        )}
        {showPrincipal && (
          <div className="bs-trc-section">
            <p className="bs-trc-label">{w.principalComment}</p>
            <p style={{ margin: 0, fontFamily: serif, fontSize: 15, lineHeight: 1.6 }}>{c.principalComment}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="bs-trc-section" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 24, marginTop: 28 }}>
          <div style={{ borderTop: `1px solid ${COLORS.text2}`, paddingTop: 5, fontSize: 12, color: COLORS.muted }}>
            {c.homeroom ? `${c.homeroom} · ` : ""}{w.homeroomSig}
          </div>
          <div style={{ borderTop: `1px solid ${COLORS.text2}`, paddingTop: 5, fontSize: 12, color: COLORS.muted }}>
            {PRINCIPAL} · {w.principalSig}
          </div>
        </div>

        {/* Key */}
        <div className="bs-trc-section" style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 10, fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>
          {hasLetters && <p style={{ margin: "0 0 4px" }}>{w.keyLetters}</p>}
          {hasLevels && <p style={{ margin: "0 0 4px" }}>{w.keyLevels}</p>}
          {areas.length > 0 && <p style={{ margin: 0 }}>{w.keyRatings}</p>}
        </div>
      </div>
    </div>
  );
}

// Prints one report card, or a whole class (one per page), alone on A4
// (the rest of the Hub is hidden while printing).
function PrintableReport({ report, reports, lang, logoUrl, label, style = ghostBtn, disabled = false }) {
  const list = reports || (report ? [report] : []);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return;
    document.body.classList.add("bs-trc-printing");
    const done = () => { document.body.classList.remove("bs-trc-printing"); setPrinting(false); };
    window.addEventListener("afterprint", done, { once: true });
    const id = setTimeout(() => window.print(), 400 + 150 * list.length); // let the photos load
    return () => { clearTimeout(id); window.removeEventListener("afterprint", done); document.body.classList.remove("bs-trc-printing"); };
  }, [printing]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <button style={style} disabled={disabled || !list.length} onClick={() => setPrinting(true)}>{label}</button>
      {printing && createPortal(
        <div className="bs-trc-print-root bsf-printable">
          {list.map((r, i) => (
            <div key={r.id} style={i > 0 ? { breakBefore: "page", pageBreakBefore: "always" } : undefined}>
              <TermReportDocument report={r} lang={lang} logoUrl={logoUrl} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Staff: Term reports (inside the Reports tab)
// ---------------------------------------------------------------------------

function TermReportsStaff({ profile, data }) {
  const role = profile?.role;
  const isAdmin = role === "admin";
  const assigned = Array.isArray(profile?.grades_assigned) ? profile.grades_assigned : [];
  const assistantOf = Array.isArray(profile?.assistant_grades) ? profile.assistant_grades : [];
  const editGrades = isAdmin ? ALL_GRADES : role === "teacher" ? assigned.filter((g) => !assistantOf.includes(g)) : [];
  const viewGrades = isAdmin || role === "viewer"
    ? ALL_GRADES
    : ALL_GRADES.filter((g) => editGrades.includes(g) || assistantOf.includes(g) || (role === "learning_assistant" && assigned.includes(g)));

  const [grade, setGrade] = useState(viewGrades[0] || "");
  const [term, setTerm] = useState(1);
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [printLang, setPrintLang] = useState("en");
  const [leavingForm, setLeavingForm] = useState(null); // { studentId, date } while the admin fills it in
  const canEdit = editGrades.includes(grade);
  const dates = termDates(data?.settings, term);

  const load = async () => {
    if (!grade) return;
    setLoading(true); setError("");
    const [st, tr] = await Promise.all([
      supabase.from("students").select("id, full_name, legacy_id").eq("grade", grade).order("full_name"),
      supabase.from("term_reports").select("*").eq("grade", grade).eq("term", term).eq("school_year", SCHOOL_YEAR)
    ]);
    if (st.error || tr.error) {
      const msg = (st.error || tr.error).message || "";
      setError(/term_reports/.test(msg) ? "Term reports aren't switched on yet. Please ask the office to run term-reports.sql." : msg);
      setLoading(false);
      return;
    }
    setStudents(st.data || []);
    const map = {};
    (tr.data || []).forEach((r) => { map[r.student_id] = r; });
    setReports(map);
    setLoading(false);
  };
  useEffect(() => { load(); setStatus(""); setOpenId(null); setLeavingForm(null); }, [grade, term]); // eslint-disable-line react-hooks/exhaustive-deps

  // Make or refresh drafts. Published report cards are never touched here.
  // leaving: undefined = keep as is; { date } = make a leaving progress report; null = back to a normal term report.
  const build = async (onlyStudentId = null, leaving = undefined) => {
    setBusy(true); setStatus(""); setError("");
    try {
      const src = await loadClassSources(grade, term);
      const targets = src.students.filter((s) => !onlyStudentId || s.id === onlyStudentId);
      // Read the saved report cards again, so text a teacher just saved is kept.
      const fresh = await supabase.from("term_reports").select("id, student_id, status, content")
        .eq("grade", grade).eq("term", term).eq("school_year", SCHOOL_YEAR);
      if (fresh.error) throw fresh.error;
      const latest = {};
      (fresh.data || []).forEach((r) => { latest[r.student_id] = r; });
      let made = 0, refreshed = 0, skipped = 0;
      const inserts = [];
      for (const s of targets) {
        const existing = latest[s.id] || reports[s.id];
        if (existing?.status === "published") { skipped += 1; continue; }
        const content = buildContent(s, grade, term, src, data, existing?.content, onlyStudentId ? leaving : undefined);
        if (existing) {
          const { error: e } = await supabase.from("term_reports").update({ content }).eq("id", existing.id);
          if (e) throw e;
          refreshed += 1;
        } else {
          inserts.push({ student_id: s.id, grade, term, school_year: SCHOOL_YEAR, content });
        }
      }
      if (inserts.length) {
        const { error: e } = await supabase.from("term_reports").insert(inserts);
        if (e) throw e;
        made = inserts.length;
      }
      await load();
      if (onlyStudentId && leaving) {
        setStatus(skipped ? "This child's Term report card is already published. Unpublish it first." : "Leaving progress report ready. Print it from the report card.");
        const made = (await supabase.from("term_reports").select("id").eq("student_id", onlyStudentId).eq("term", term).eq("school_year", SCHOOL_YEAR).maybeSingle()).data;
        if (made && !skipped) setOpenId(made.id);
        return;
      }
      setStatus([
        made ? `${made} draft${made > 1 ? "s" : ""} made` : null,
        refreshed ? `${refreshed} refreshed from the Gradebook` : null,
        skipped ? `${skipped} already published (unchanged)` : null
      ].filter(Boolean).join(" · ") || "Nothing to update.");
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const setReportStatus = async (ids, next) => {
    setBusy(true); setError(""); setStatus("");
    const { error: e } = await supabase.from("term_reports").update({ status: next }).in("id", ids);
    if (e) {
      setError(e.message);
    } else if (next === "draft") {
      setStatus("Back to draft. Families can no longer see it.");
    } else {
      // Email the families (once per report card): "the report card is ready on the Hub".
      const { data: res, error: mailErr } = await supabase.functions.invoke("notify-term-reports", { body: { ids } });
      if (mailErr || res?.error) {
        setStatus(`${ids.length} published. Families got a bell notice.`);
        setError(`The emails could not be sent (${res?.error || mailErr?.message || "unknown error"}). Families can still see the report card on the Hub.`);
      } else {
        const missing = (res?.noParent || []).length ? ` No parent account for: ${res.noParent.join(", ")}.` : "";
        setStatus(`${ids.length} published. ${res?.sent || 0} famil${res?.sent === 1 ? "y" : "ies"} emailed.${missing}`);
      }
    }
    await load();
    setBusy(false);
  };

  const saveContent = async (report, patch) => {
    const { error: e } = await supabase.from("term_reports").update({ content: { ...report.content, ...patch } }).eq("id", report.id);
    if (e) { setError(e.message); return false; }
    await load();
    return true;
  };

  if (!viewGrades.length) return null;

  // Leaving progress reports are print only: never published to families.
  const drafts = Object.values(reports).filter((r) => r.status === "draft" && !r.content?.leaving);
  const leavingCount = Object.values(reports).filter((r) => r.content?.leaving).length;
  const publishedCount = Object.values(reports).filter((r) => r.status === "published").length;
  const open = openId ? Object.values(reports).find((r) => r.id === openId) : null;

  return (
    <section style={{ color: COLORS.ink }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: serif, fontSize: 20, margin: 0 }}>Term report cards</h2>
          <span style={{ fontSize: 13, color: COLORS.muted }}>Built from the Gradebook · {SCHOOL_YEAR.replace("-", "–")}</span>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "12px 0" }}>
          {viewGrades.map((g) => <button key={g} onClick={() => setGrade(g)} style={grade === g ? chipOn : chip}>{g}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[1, 2, 3].map((t) => <button key={t} onClick={() => setTerm(t)} style={term === t ? chipOn : chip}>Term {t}</button>)}
        </div>
        {(!dates.start || !dates.end) && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: COLORS.warn, background: COLORS.warnBg, borderRadius: 8, padding: "8px 10px" }}>
            Term {term} dates aren't set in Settings, so attendance won't appear on the report cards.
          </p>
        )}
        {canEdit && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button style={primaryBtn} disabled={busy} onClick={() => build()}>
              {busy ? "Working…" : Object.keys(reports).length ? "Refresh drafts from the Gradebook" : `Make drafts for ${grade}`}
            </button>
            {Object.keys(reports).length > 0 && (
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <PrintableReport
                  reports={students.map((st) => reports[st.id]).filter(Boolean)}
                  lang={printLang} logoUrl={logoOf(data)}
                  label={`Print whole class (${printLang === "fr" ? "French" : "English"})`} disabled={busy} />
                <button style={printLang === "en" ? chipOn : chip} onClick={() => setPrintLang("en")}>EN</button>
                <button style={printLang === "fr" ? chipOn : chip} onClick={() => setPrintLang("fr")}>FR</button>
              </span>
            )}
            {isAdmin && drafts.length > 0 && (
              <button style={ghostBtn} disabled={busy} onClick={() => {
                if (window.confirm(`Publish ${drafts.length} report card${drafts.length > 1 ? "s" : ""} for ${grade}, Term ${term}? Each family will get a bell notice and an email saying the report card is ready on the Hub.`)) {
                  setReportStatus(drafts.map((r) => r.id), "published");
                }
              }}>Publish all {drafts.length} drafts</button>
            )}
          </div>
        )}
        {isAdmin && (
          <div style={{ marginTop: 12 }}>
            {!leavingForm ? (
              <button style={ghostBtn} disabled={busy || !students.length}
                onClick={() => setLeavingForm({ studentId: "", date: new Date().toISOString().slice(0, 10) })}>
                Progress report for a leaving child
              </button>
            ) : (
              <div style={{ background: COLORS.surface2, borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
                <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>
                  Built from the Gradebook from the start of Term {term} up to the child's last day. Print only: families won't see it on the Hub.
                </p>
                <label style={{ fontSize: 13, color: COLORS.muted }}>Child
                  <select style={{ ...input, marginTop: 4 }} value={leavingForm.studentId} onChange={(e) => setLeavingForm({ ...leavingForm, studentId: e.target.value })}>
                    <option value="">Choose a child in {grade}…</option>
                    {students.map((st) => <option key={st.id} value={st.id}>{st.full_name}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 13, color: COLORS.muted }}>Last day at BrightSteps
                  <input type="date" style={{ ...input, marginTop: 4 }} value={leavingForm.date}
                    min={dates.start || undefined} max={dates.end || undefined}
                    onChange={(e) => setLeavingForm({ ...leavingForm, date: e.target.value })} />
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={primaryBtn} disabled={busy || !leavingForm.studentId || !leavingForm.date}
                    onClick={async () => { await build(leavingForm.studentId, { date: leavingForm.date }); setLeavingForm(null); }}>
                    {busy ? "Working…" : "Make progress report"}
                  </button>
                  <button style={ghostBtn} disabled={busy} onClick={() => setLeavingForm(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {!canEdit && <p style={{ margin: "12px 0 0", fontSize: 13, color: COLORS.muted }}>You can view these report cards but not change them.</p>}
        {status && <p style={{ margin: "10px 0 0", fontSize: 13, color: COLORS.ok }}>{status}</p>}
        {error && <p style={{ margin: "10px 0 0", fontSize: 13, color: COLORS.bad }}>{error}</p>}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: COLORS.muted, marginBottom: 6 }}>
          <span>{grade} · Term {term}</span>
          <span>{drafts.length} draft · {publishedCount} published{leavingCount ? ` · ${leavingCount} leaving` : ""}</span>
        </div>
        {loading ? <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>Loading…</p>
          : students.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>No students in {grade}.</p>
          : students.map((s) => {
            const r = reports[s.id];
            return (
              <button key={s.id} onClick={() => r && setOpenId(r.id)} disabled={!r}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 2px", background: "none", border: "none", borderTop: `1px solid ${COLORS.line}`, cursor: r ? "pointer" : "default", fontFamily: "inherit", fontSize: 14, color: COLORS.ink, textAlign: "left" }}>
                <span>{s.full_name}</span>
                {r?.content?.leaving ? <span style={pill("info")}>Leaving · print only</span>
                  : r ? <span style={pill(r.status === "published" ? "ok" : "warn")}>{r.status === "published" ? (r.emailed_at ? "Published · emailed" : "Published") : "Draft"}</span>
                  : <span style={{ fontSize: 13, color: COLORS.muted }}>Not made yet</span>}
              </button>
            );
          })}
      </div>

      {open && (
        <StaffReportModal
          report={open}
          student={students.find((s) => s.id === open.student_id)}
          data={data}
          isAdmin={isAdmin}
          canEdit={canEdit}
          busy={busy}
          onClose={() => setOpenId(null)}
          onRefresh={() => build(open.student_id)}
          onNotLeaving={() => build(open.student_id, null)}
          onStatus={(next) => setReportStatus([open.id], next)}
          onSave={(patch) => saveContent(open, patch)}
        />
      )}
    </section>
  );
}

function StaffReportModal({ report, student, data, isAdmin, canEdit, busy, onClose, onRefresh, onNotLeaving, onStatus, onSave }) {
  const [lang, setLang] = useState("en");
  const [principal, setPrincipal] = useState(report.content?.principalComment || "");
  const [picking, setPicking] = useState(false);
  const published = report.status === "published";
  const editable = canEdit && (!published || isAdmin);
  const c = report.content || {};
  const leaving = !!c.leaving;

  useEffect(() => { setPrincipal(report.content?.principalComment || ""); }, [report.id, report.content?.principalComment]);

  return (
    <Modal title={`${c.student?.name || student?.full_name || "Report card"} · ${leaving ? "Progress report" : `Term ${report.term}`}`} onClose={onClose}>
      <div className="bsf-noprint" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        {leaving
          ? <span style={pill("info")}>Leaving progress report · up to {longDate(c.leaving.date, "en")} · print only</span>
          : <span style={pill(published ? "ok" : "warn")}>{published ? `Published ${longDate(report.published_at, "en")}` : "Draft · families can't see it"}</span>}
        <button style={lang === "en" ? chipOn : chip} onClick={() => setLang("en")}>English</button>
        <button style={lang === "fr" ? chipOn : chip} onClick={() => setLang("fr")}>Français</button>
      </div>

      <div className="bsf-noprint" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {editable && !published && <button style={ghostBtn} disabled={busy} onClick={onRefresh}>Refresh from Gradebook</button>}
        {editable && c.early && c.kind !== "early-years" && <button style={ghostBtn} onClick={() => setPicking((p) => !p)}>{picking ? "Done choosing photos" : "Choose photos"}</button>}
        <PrintableReport report={report} lang={lang} logoUrl={logoOf(data)} label="Print" />
        {isAdmin && leaving && !published && <button style={ghostBtn} disabled={busy} onClick={() => {
          if (window.confirm("Turn this back into a normal Term report card (whole term, can be published)?")) onNotLeaving();
        }}>Child is staying</button>}
        {isAdmin && !published && !leaving && <button style={primaryBtn} disabled={busy} onClick={() => onStatus("published")}>{report.emailed_at ? "Publish again (no new email)" : "Publish and email family"}</button>}
        {isAdmin && published && <button style={ghostBtn} disabled={busy} onClick={() => onStatus("draft")}>Unpublish</button>}
      </div>

      {published && !isAdmin && (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: COLORS.muted }}>This report card is published. Ask the office to unpublish it if something needs changing.</p>
      )}

      {picking && editable && c.kind !== "early-years" && <PhotoPicker report={report} data={data} onSave={onSave} />}
      {editable && c.kind === "early-years" && <EarlyYearsEditor key={`${report.id}:${c.builtAt || ""}`} report={report} data={data} onSave={onSave} />}

      {isAdmin && report.term === 3 && (
        <div style={{ ...card, background: COLORS.surface2 }}>
          <label style={{ fontSize: 13, color: COLORS.muted }} htmlFor="trc-principal">Principal's comment (end of year, optional)</label>
          <textarea id="trc-principal" rows={3} value={principal} onChange={(e) => setPrincipal(e.target.value)}
            onBlur={() => { if ((principal || "") !== (c.principalComment || "")) onSave({ principalComment: principal.trim() || null }); }}
            style={{ ...input, marginTop: 6, resize: "vertical", lineHeight: 1.5 }} />
        </div>
      )}

      <TermReportDocument report={report} lang={lang} logoUrl={logoOf(data)} />
      <p className="bsf-noprint" style={{ margin: "10px 0 0", fontSize: 12, color: COLORS.muted }}>
        Built from the Gradebook {c.builtAt ? `on ${longDate(c.builtAt, "en")}` : ""}. Marks, levels and comments are changed in Assessment, then refreshed here.
      </p>
    </Modal>
  );
}

// Up to 3 photos from the child's portfolio this term, with a short caption.
function PhotoPicker({ report, data, onSave }) {
  const hubId = report.hub_student_id;
  const dates = report.content?.period || {};
  const chosen = report.content?.highlights || [];
  const options = useMemo(() => {
    const out = [];
    (data?.portfolio || [])
      .filter((p) => p.studentId === hubId)
      .filter((p) => !dates.start || !dates.end || (p.date >= dates.start && p.date <= dates.end))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .forEach((p) => (p.files || []).forEach((f) => {
        if ((f.type || "").startsWith("image/")) out.push({ path: f.path, caption: (p.note || "").slice(0, 120), date: p.date });
      }));
    return out;
  }, [data?.portfolio, hubId, dates.start, dates.end]);
  const urls = usePhotoUrls(options.map((o) => o.path));

  const toggle = (o) => {
    const isOn = chosen.some((h) => h.path === o.path);
    if (!isOn && chosen.length >= MAX_HIGHLIGHTS) return;
    onSave({ highlights: isOn ? chosen.filter((h) => h.path !== o.path) : [...chosen, { path: o.path, caption: o.caption }] });
  };

  return (
    <div style={{ ...card, background: COLORS.surface2 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: COLORS.muted }}>
        Pick up to {MAX_HIGHLIGHTS} photos from this term's portfolio ({chosen.length} chosen). Avoid photos where other children's faces can be recognised.
      </p>
      {options.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>No portfolio photos for this child this term yet. Add them in Portfolio.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
          {options.map((o) => {
            const on = chosen.some((h) => h.path === o.path);
            return (
              <button key={o.path} onClick={() => toggle(o)} aria-pressed={on}
                style={{ padding: 0, border: `3px solid ${on ? COLORS.brand : "transparent"}`, borderRadius: 8, background: COLORS.neutralBg, cursor: "pointer", overflow: "hidden", aspectRatio: "1 / 1" }}>
                {urls[o.path] && <img src={urls[o.path]} alt={o.caption || "Portfolio photo"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Families: published report cards of one child
// ---------------------------------------------------------------------------

function TermReportsFamily({ hubStudentId, data, otherCount = 0, emptyText = "" }) {
  const { language } = useLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const w = W[lang];
  const [rows, setRows] = useState([]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!hubStudentId) return;
    let alive = true;
    supabase.from("term_reports").select("*").eq("hub_student_id", hubStudentId).eq("status", "published")
      .order("school_year", { ascending: false }).order("term", { ascending: false })
      .then(({ data: d, error }) => { if (alive && !error) setRows(d || []); });
    return () => { alive = false; };
  }, [hubStudentId]);

  const open = rows.find((r) => r.id === openId);
  if (!rows.length) return otherCount === 0 && emptyText ? <p className="bsf-empty">{emptyText}</p> : null;

  return (
    <>
      {rows.map((r) => (
        <button key={r.id} className="bsf-row" onClick={() => setOpenId(r.id)}
          style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
          <span className="bsf-tag">{w.title(r.term)}</span>
          <div>
            <strong>{r.school_year.replace("-", "–")}</strong>
            <p>{w.published(longDate(r.published_at, lang))}</p>
          </div>
        </button>
      ))}
      {open && (
        <Modal title={`${open.content?.student?.name || ""} · ${w.title(open.term)}`} onClose={() => setOpenId(null)}>
          <div className="bsf-noprint" style={{ marginBottom: 12 }}>
            <PrintableReport report={open} lang={lang} logoUrl={logoOf(data)} label={w.print} />
          </div>
          <TermReportDocument report={open} lang={lang} logoUrl={logoOf(data)} />
        </Modal>
      )}
    </>
  );
}

export { TermReportsStaff, TermReportsFamily };

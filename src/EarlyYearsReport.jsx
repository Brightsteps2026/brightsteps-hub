import { useEffect, useMemo, useState } from "react";
import { getAttachmentUrl } from "./lib/attachments";
import { gradeLabel } from "./lib/format";
import { COLORS, chip, chipOn, ghostBtn, input } from "./ui/tokens";
import { eyAreas, eyEnrichment, PLAY_WAYS, CARE, EY_LEVELS, MAX_AREA_PHOTOS } from "./data/earlyYears";

// Early-years term report (Pre-Nursery, PreK, Kindergarten).
//   EarlyYearsDocument: the report itself, on screen and on A4.
//   EarlyYearsEditor:   where the teacher writes it (staff, English only).
//   earlyYearsDefaults: fills empty parts from the Gradebook on refresh.
// Everything is kept in term_reports.content.ey.
// Pre-Nursery: no levels. PreK and Kindergarten: Beginning / Growing / Secure.

const serif = "'Fraunces', serif";
const TRI = ["#2E86C9", "#801524", "#F2A31B"]; // the three blocks of the school logo
const GOLD = "#8A6A2E";

const T = {
  en: {
    reportPreN: "My First Steps", report: "Learning Journey Report",
    term: (t, y) => `Term ${t} · ${y}`, place: "Grand-Bassam, Côte d'Ivoire",
    teacher: "Teacher", homeroom: "Homeroom teacher",
    intro: (n) => `A picture of ${n}'s term: what we noticed, moments from the portfolio, and where the learning goes next.`,
    settling: "Settling in", key: "Where your child is in each area of development",
    discovering: "What I'm discovering", enrichment: "Enrichment", specials: "With my specialist teachers",
    play: "How I play and learn", care: "Care and routines", skills: "How I learn and grow",
    skillAreas: { atl: "Approaches to learning", sel: "Social and emotional", life: "Life skills" },
    ratings: { rarely: "Rarely", sometimes: "Sometimes", usually: "Usually", consistently: "Consistently" },
    next: "What's next for me", home: "How you can help at home", note: "A note from my teacher",
    sigTeacher: "Teacher", sigPrincipal: "Principal", sigParent: "Parent or guardian",
    attendance: (a) => `Attendance: ${a.present + a.late} days present, ${a.absent} absent`,
    footer: "BrightSteps International School · Inquiry-based learning"
  },
  fr: {
    reportPreN: "Mes premiers pas", report: "Bulletin du parcours d'apprentissage",
    term: (t, y) => `Trimestre ${t} · ${y}`, place: "Grand-Bassam, Côte d'Ivoire",
    teacher: "Enseignant(e)", homeroom: "Enseignant(e) principal(e)",
    intro: (n) => `Un aperçu du trimestre de ${n} : ce que nous avons observé, des moments du portfolio et les prochaines étapes.`,
    settling: "L'adaptation", key: "Où en est votre enfant dans chaque domaine de développement",
    discovering: "Ce que je découvre", enrichment: "Activités d'éveil", specials: "Avec mes enseignants spécialisés",
    play: "Comment je joue et j'apprends", care: "Soins et routines", skills: "Comment j'apprends et je grandis",
    skillAreas: { atl: "Méthodes d'apprentissage", sel: "Socio-émotionnel", life: "Savoir-être" },
    ratings: { rarely: "Rarement", sometimes: "Parfois", usually: "Souvent", consistently: "Toujours" },
    next: "Mes prochaines étapes", home: "Comment m'aider à la maison", note: "Un mot de mon enseignant(e)",
    sigTeacher: "Enseignant(e)", sigPrincipal: "Directrice", sigParent: "Parent ou tuteur",
    attendance: (a) => `Assiduité : ${a.present + a.late} jours de présence, ${a.absent} absence(s)`,
    footer: "BrightSteps International School · Apprentissage par investigation"
  }
};

const firstName = (name) => (name || "").trim().split(/\s+/)[0] || "";
const lines = (txt) => (txt || "").split("\n").map((l) => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean);

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

// Fills what the teacher has not written yet from the Gradebook: specialist
// comments (written appreciations) and the homeroom term note.
export function earlyYearsDefaults(grade, prev, subjectComment, homeroomNote) {
  const ey = JSON.parse(JSON.stringify(prev || {}));
  ey.areas = ey.areas || {};
  ey.enrich = ey.enrich || {};
  eyEnrichment(grade).forEach((e) => {
    const cur = ey.enrich[e.id] || {};
    const fromGb = (subjectComment(e.subject) || "").trim();
    if (!cur.text && fromGb) ey.enrich[e.id] = { ...cur, text: fromGb };
  });
  if (!ey.note && homeroomNote) ey.note = homeroomNote;
  return ey;
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

const DOC_CSS = `
.bs-ey { font-family: 'Work Sans', sans-serif; color: ${COLORS.ink}; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.bs-ey h2, .bs-ey h3, .bs-ey p, .bs-ey figure { margin: 0; }
.bs-ey-keep { break-inside: avoid; page-break-inside: avoid; }
.bs-ey-h { font-family: ${serif}; font-weight: 500; font-size: 20px; color: ${COLORS.brand}; }
.bs-ey-text { font-size: 13px; line-height: 1.6; color: #3D2A2D; white-space: pre-line; }
.bs-ey-cap { font-family: ${serif}; font-style: italic; font-size: 11.5px; color: #5A4447; margin-top: 4px !important; }
.bs-ey-ph { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 6px; display: block; background: #F3ECEC; }
.bs-ey-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.bs-ey-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.bs-ey-label { font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: ${GOLD}; }
@media (max-width: 560px) { .bs-ey-grid3 { grid-template-columns: minmax(0, 1fr); } }
@media print {
  .bs-ey { font-size: 10.5pt; }
  .bs-ey-paper { border: none !important; padding: 0 !important; }
  .bs-ey-ph { max-height: 52mm; }
  .bs-ey-grid3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
}`;

function TriLine({ h = 4 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", height: h }}>
      {TRI.map((c) => <div key={c} style={{ background: c }} />)}
    </div>
  );
}

function LevelMark({ level, lang }) {
  const l = EY_LEVELS.find((x) => x.id === level);
  if (!l) return null;
  const i = EY_LEVELS.indexOf(l);
  const fill = i === 0 ? "transparent" : i === 1 ? `linear-gradient(90deg, ${GOLD} 50%, transparent 50%)` : GOLD;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: GOLD, whiteSpace: "nowrap" }}>
      <span aria-hidden="true" style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", border: `1.5px solid ${GOLD}`, background: fill }} />
      {lang === "fr" ? l.fr : l.en}
    </span>
  );
}

function Photos({ list, urls, single = false }) {
  if (!list?.length) return null;
  const shown = single ? list.slice(0, 1) : list;
  return (
    <div className={shown.length > 1 ? "bs-ey-grid2" : undefined}>
      {shown.map((p) => (
        <figure key={p.path}>
          {urls[p.path] ? <img className="bs-ey-ph" src={urls[p.path]} alt={p.caption || ""} /> : <div className="bs-ey-ph" />}
          {p.caption && <figcaption className="bs-ey-cap">{p.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

export function EarlyYearsDocument({ report, lang, logoUrl }) {
  const w = T[lang] || T.en;
  const c = report.content || {};
  const ey = c.ey || {};
  const grade = report.grade;
  const preN = grade === "Pre-N";
  const L = (x) => (lang === "fr" ? x.fr : x.en);
  const areas = eyAreas(grade);
  const enrich = eyEnrichment(grade);
  const name = c.student?.name || "";
  const year = (report.school_year || "").replace("-", "–");

  const allPhotos = [
    c.student?.photoPath,
    ...Object.values(ey.areas || {}).flatMap((a) => (a.photos || []).map((p) => p.path)),
    ...Object.values(ey.enrich || {}).flatMap((a) => (a.photos || []).map((p) => p.path))
  ];
  const urls = usePhotoUrls(allPhotos);

  const has = (x) => x && ((x.text || "").trim() || (x.photos || []).length || x.level);
  const core = preN ? areas.filter((a) => a.core) : areas;
  const discover = preN ? areas.filter((a) => !a.core) : [];
  const enrichShown = enrich.filter((e) => has(ey.enrich?.[e.id]));
  const playShown = PLAY_WAYS.filter((p) => (ey.play?.[p.id] || "").trim());
  const careShown = CARE.filter((p) => (ey.care?.[p.id] || "").trim());
  const skillAreas = ["atl", "sel", "life"].filter((a) => (c.skills || []).some((k) => k.area === a));
  let n = 0;

  return (
    <div className="bs-ey">
      <style>{DOC_CSS}</style>
      <div className="bs-ey-paper" style={{ border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: "26px 28px 22px", background: "#fff", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Letterhead */}
        <div className="bs-ey-keep" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <img src={logoUrl} alt="BrightSteps International School" style={{ width: 92, height: 92, objectFit: "contain" }} />
            <div style={{ textAlign: "right" }}>
              <div className="bs-ey-label">{preN ? w.reportPreN : w.report}</div>
              <div style={{ fontFamily: serif, fontSize: 15, marginTop: 3 }}>{w.term(report.term, year)}</div>
              <div style={{ fontSize: 11, color: "#5A4447", marginTop: 2 }}>{w.place}</div>
            </div>
          </div>
          <TriLine />
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", overflow: "hidden", background: "#F5E4E6", flexShrink: 0, boxShadow: `0 0 0 4px #fff, 0 0 0 5px ${COLORS.line}` }}>
              {urls[c.student?.photoPath] && <img src={urls[c.student.photoPath]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              <h2 style={{ fontFamily: serif, fontSize: 30, fontWeight: 500, lineHeight: 1.05, color: COLORS.brand }}>{name}</h2>
              <p style={{ fontSize: 13, color: "#3D2A2D" }}>{gradeLabel(grade, lang)}{c.homeroom ? ` · ${preN ? w.teacher : w.homeroom}: ${c.homeroom}` : ""}</p>
              <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 14, lineHeight: 1.5, color: "#5A4447" }}>{w.intro(firstName(name))}</p>
              {c.attendance && <p style={{ fontSize: 11, color: COLORS.muted }}>{w.attendance(c.attendance)}</p>}
            </div>
          </div>
        </div>

        {preN && (ey.settling || "").trim() && (
          <section className="bs-ey-keep" style={{ background: COLORS.bg, borderRadius: 12, padding: "14px 16px" }}>
            <h3 className="bs-ey-h" style={{ fontSize: 18, marginBottom: 6 }}>{w.settling}</h3>
            <p className="bs-ey-text">{ey.settling}</p>
          </section>
        )}

        {!preN && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "9px 14px", background: COLORS.bg, borderRadius: 10, fontSize: 11, color: "#3D2A2D" }}>
            <span>{w.key}</span>
            <span style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{EY_LEVELS.map((l) => <LevelMark key={l.id} level={l.id} lang={lang} />)}</span>
          </div>
        )}

        {/* Areas of development */}
        {core.filter((a) => has(ey.areas?.[a.id])).map((a) => {
          const x = ey.areas[a.id];
          n += 1;
          return (
            <section key={a.id} className="bs-ey-keep" style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", gap: "0 12px", paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
              <div style={{ fontFamily: serif, fontSize: 21, color: "#C9A9AE", lineHeight: 1 }}>{String(n).padStart(2, "0")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 18 }}>{L(a)}</h3>
                  {!preN && <LevelMark level={x.level} lang={lang} />}
                </div>
                {(x.text || "").trim() && <p className="bs-ey-text">{x.text}</p>}
                <Photos list={x.photos} urls={urls} />
              </div>
            </section>
          );
        })}

        {preN && discover.some((a) => has(ey.areas?.[a.id])) && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
            <h3 className="bs-ey-h">{w.discovering}</h3>
            <div className="bs-ey-grid2" style={{ gap: "16px 18px" }}>
              {discover.filter((a) => has(ey.areas?.[a.id])).map((a) => (
                <div key={a.id} className="bs-ey-keep" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Photos list={ey.areas[a.id].photos} urls={urls} single />
                  <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 500 }}>{L(a)}</div>
                  {(ey.areas[a.id].text || "").trim() && <p className="bs-ey-text" style={{ fontSize: 12.5 }}>{ey.areas[a.id].text}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {preN && playShown.length > 0 && (
          <section className="bs-ey-keep" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
            <h3 className="bs-ey-h">{w.play}</h3>
            <div className="bs-ey-grid3">
              {playShown.map((p) => (
                <div key={p.id} style={{ background: COLORS.bg, borderRadius: 10, padding: "11px 13px" }}>
                  <div className="bs-ey-label" style={{ marginBottom: 5 }}>{L(p)}</div>
                  <p className="bs-ey-text" style={{ fontSize: 12.5 }}>{ey.play[p.id]}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {preN && careShown.length > 0 && (
          <section className="bs-ey-keep" style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
            <h3 className="bs-ey-h">{w.care}</h3>
            <div className="bs-ey-grid2" style={{ gap: "6px 22px" }}>
              {careShown.map((p) => (
                <p key={p.id} className="bs-ey-text" style={{ fontSize: 12.5 }}><strong style={{ fontWeight: 600, color: COLORS.ink }}>{L(p)}.</strong> {ey.care[p.id]}</p>
              ))}
            </div>
          </section>
        )}

        {/* Enrichment / specialist subjects */}
        {enrichShown.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
            <h3 className="bs-ey-h">{preN ? w.enrichment : w.specials}</h3>
            <div className="bs-ey-grid2" style={{ gap: "16px 18px" }}>
              {enrichShown.map((e) => {
                const x = ey.enrich[e.id];
                return (
                  <div key={e.id} className="bs-ey-keep" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Photos list={x.photos} urls={urls} single />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontFamily: serif, fontSize: 16, fontWeight: 500 }}>{L(e)}</span>
                      {x.teacher && <span style={{ fontSize: 11, color: "#5A4447" }}>{x.teacher}</span>}
                    </div>
                    {(x.text || "").trim() && <p className="bs-ey-text" style={{ fontSize: 12.5 }}>{x.text}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* PreK / Kindergarten: ATL · SEL · Life skills */}
        {!preN && skillAreas.length > 0 && (
          <section className="bs-ey-keep" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
            <h3 className="bs-ey-h">{w.skills}</h3>
            <div className="bs-ey-grid3">
              {skillAreas.map((a) => (
                <div key={a} style={{ background: COLORS.bg, borderRadius: 10, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="bs-ey-label">{w.skillAreas[a]}</div>
                  {c.skills.filter((k) => k.area === a).map((k) => (
                    <div key={`${a}:${k.en}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, lineHeight: 1.35 }}>
                      <span>{lang === "fr" ? k.fr : k.en}</span>
                      <span style={{ fontWeight: 600, color: "#5A4447", whiteSpace: "nowrap" }}>{w.ratings[k.rating]}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {(lines(ey.next).length > 0 || lines(ey.home).length > 0) && (
          <div className="bs-ey-grid2 bs-ey-keep" style={{ gap: 14 }}>
            {lines(ey.next).length > 0 && (
              <section style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "13px 15px" }}>
                <h3 className="bs-ey-h" style={{ fontSize: 17, marginBottom: 6 }}>{w.next}</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>{lines(ey.next).map((l, i) => <li key={i}>{l}</li>)}</ul>
              </section>
            )}
            {lines(ey.home).length > 0 && (
              <section style={{ background: COLORS.bg, borderRadius: 12, padding: "13px 15px" }}>
                <h3 className="bs-ey-h" style={{ fontSize: 17, marginBottom: 6 }}>{w.home}</h3>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>{lines(ey.home).map((l, i) => <li key={i}>{l}</li>)}</ul>
              </section>
            )}
          </div>
        )}

        {(ey.note || "").trim() && (
          <section className="bs-ey-keep" style={{ background: COLORS.tint, borderRadius: 12, padding: "14px 16px" }}>
            <h3 className="bs-ey-h" style={{ fontSize: 17, marginBottom: 6 }}>{w.note}</h3>
            <p className="bs-ey-text">{ey.note}</p>
          </section>
        )}

        <div className="bs-ey-keep" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18, marginTop: 14, fontSize: 11, color: "#5A4447" }}>
          <div><div style={{ borderBottom: `1px solid ${COLORS.ink}`, height: 28 }} />{c.homeroom ? `${c.homeroom} · ` : ""}{w.sigTeacher}</div>
          <div><div style={{ borderBottom: `1px solid ${COLORS.ink}`, height: 28 }} />{w.sigPrincipal}</div>
          <div><div style={{ borderBottom: `1px solid ${COLORS.ink}`, height: 28 }} />{w.sigParent}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <TriLine h={3} />
          <div style={{ fontSize: 10, color: COLORS.muted }}>{w.footer}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Where the teacher writes it (staff screen, English only)
// ---------------------------------------------------------------------------

function portfolioPhotos(data, hubId, period) {
  const out = [];
  (data?.portfolio || [])
    .filter((p) => p.studentId === hubId)
    .filter((p) => !period?.start || !period?.end || (p.date >= period.start && p.date <= period.end))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .forEach((p) => (p.files || []).forEach((f) => {
      if ((f.type || "").startsWith("image/")) out.push({ path: f.path, caption: (p.note || "").slice(0, 90), area: p.eyArea || null });
    }));
  return out;
}

function PhotoChooser({ areaId, options, chosen, urls, onChange }) {
  const [open, setOpen] = useState(false);
  const tagged = options.filter((o) => o.area === areaId);
  const others = options.filter((o) => o.area !== areaId);
  const toggle = (o) => {
    const on = chosen.some((p) => p.path === o.path);
    if (!on && chosen.length >= MAX_AREA_PHOTOS) return;
    onChange(on ? chosen.filter((p) => p.path !== o.path) : [...chosen, { path: o.path, caption: o.caption }]);
  };
  const grid = (list) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 6 }}>
      {list.map((o) => {
        const on = chosen.some((p) => p.path === o.path);
        return (
          <button key={o.path} type="button" onClick={() => toggle(o)} aria-pressed={on} aria-label={o.caption || "Portfolio photo"}
            style={{ padding: 0, border: `3px solid ${on ? COLORS.brand : "transparent"}`, borderRadius: 8, background: COLORS.neutralBg, cursor: "pointer", overflow: "hidden", aspectRatio: "1 / 1" }}>
            {urls[o.path] && <img src={urls[o.path]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
          </button>
        );
      })}
    </div>
  );
  return (
    <div style={{ marginTop: 8 }}>
      {chosen.map((p, i) => (
        <div key={p.path} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <div style={{ width: 52, height: 40, borderRadius: 6, overflow: "hidden", background: COLORS.neutralBg, flexShrink: 0 }}>
            {urls[p.path] && <img src={urls[p.path]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <input aria-label="Photo caption" value={p.caption || ""} placeholder="Caption"
            onChange={(e) => onChange(chosen.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)), true)}
            onBlur={() => onChange(chosen)}
            style={{ ...input, minHeight: 36, padding: "6px 10px", fontSize: 13 }} />
          <button type="button" onClick={() => onChange(chosen.filter((x) => x.path !== p.path))} style={{ ...ghostBtn, minHeight: 36, padding: "6px 10px" }}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...ghostBtn, minHeight: 36, padding: "6px 12px", fontSize: 13 }}>
        {open ? "Done" : `Choose photos (${chosen.length}/${MAX_AREA_PHOTOS})`}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {options.length === 0 && <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>No portfolio photos for this child this term yet. Add them in Portfolio.</p>}
          {tagged.length > 0 && <><p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>Tagged for this area</p>{grid(tagged)}</>}
          {others.length > 0 && <><p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>{tagged.length ? "Other photos this term" : "Photos this term"}</p>{grid(others)}</>}
        </div>
      )}
    </div>
  );
}

const box = { border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, marginBottom: 10, background: "#fff" };
const lab = { display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 };
const hint = { margin: "0 0 6px", fontSize: 12, color: COLORS.muted };
const ta = (rows = 3) => ({ ...input, resize: "vertical", lineHeight: 1.5, minHeight: rows * 22 });

export function EarlyYearsEditor({ report, data, onSave }) {
  const grade = report.grade;
  const preN = grade === "Pre-N";
  const [ey, setEy] = useState(() => report.content?.ey || {});
  useEffect(() => { setEy(report.content?.ey || {}); }, [report.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => portfolioPhotos(data, report.hub_student_id, report.content?.period), [data?.portfolio, report.hub_student_id, report.content?.period]); // eslint-disable-line react-hooks/exhaustive-deps
  const urls = usePhotoUrls([...options.map((o) => o.path)]);

  const save = (next) => { setEy(next); onSave({ ey: next }); };
  const setLocal = (next) => setEy(next);
  const part = (group, id) => (ey[group] || {})[id] || {};
  const withPart = (group, id, patch) => ({ ...ey, [group]: { ...(ey[group] || {}), [id]: { ...part(group, id), ...patch } } });
  const textArea = (value, onChange, onBlur, rows, placeholder) => (
    <textarea rows={rows} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} style={ta(rows)} />
  );

  const areaBlock = (a, group, withLevel, withTeacher) => {
    const x = part(group, a.id);
    return (
      <div key={a.id} style={box}>
        <span style={lab}>{a.en}</span>
        {withLevel && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {EY_LEVELS.map((l) => (
              <button key={l.id} type="button" onClick={() => save(withPart(group, a.id, { level: x.level === l.id ? null : l.id }))} style={x.level === l.id ? chipOn : chip}>{l.en}</button>
            ))}
          </div>
        )}
        {withTeacher && (
          <input aria-label={`${a.en} teacher`} placeholder="Teacher's name (optional), e.g. Mr Jonathan" value={x.teacher || ""}
            onChange={(e) => setLocal(withPart(group, a.id, { teacher: e.target.value }))} onBlur={() => save(ey)}
            style={{ ...input, marginBottom: 8, minHeight: 38, fontSize: 14 }} />
        )}
        {textArea(x.text, (v) => setLocal(withPart(group, a.id, { text: v })), () => save(ey), 3, "What did you notice this term?")}
        <PhotoChooser areaId={a.id} options={options} chosen={x.photos || []} urls={urls}
          onChange={(photos, typing) => (typing ? setLocal(withPart(group, a.id, { photos })) : save(withPart(group, a.id, { photos })))} />
      </div>
    );
  };

  return (
    <div style={{ background: COLORS.surface2, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600 }}>Write the report</p>
      <p style={hint}>
        Everything saves when you leave a box. Empty parts don't appear on the report.
        {preN ? " Pre-Nursery has no levels: describe what you see." : " Choose a level for each area: Beginning, Growing or Secure."}
        {" "}Pick up to {MAX_AREA_PHOTOS} portfolio photos per area; avoid photos where other children's faces can be recognised.
      </p>

      {preN && (
        <div style={box}>
          <span style={lab}>Settling in</span>
          <p style={hint}>How the child separates, feels safe and finds comfort.</p>
          {textArea(ey.settling, (v) => setLocal({ ...ey, settling: v }), () => save(ey), 3)}
        </div>
      )}

      <p style={{ margin: "14px 0 8px", fontSize: 13, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Areas of development</p>
      {eyAreas(grade).map((a) => areaBlock(a, "areas", !preN, false))}

      <p style={{ margin: "14px 0 8px", fontSize: 13, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>{preN ? "Enrichment" : "Specialist subjects"}</p>
      <p style={hint}>Comments written by specialist teachers in the Gradebook appear here automatically when you refresh.</p>
      {eyEnrichment(grade).map((e) => areaBlock(e, "enrich", false, true))}

      {preN && (
        <>
          <p style={{ margin: "14px 0 8px", fontSize: 13, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>How I play and learn</p>
          {PLAY_WAYS.map((p) => (
            <div key={p.id} style={box}>
              <span style={lab}>{p.en}</span>
              {textArea((ey.play || {})[p.id], (v) => setLocal({ ...ey, play: { ...(ey.play || {}), [p.id]: v } }), () => save(ey), 2)}
            </div>
          ))}
          <p style={{ margin: "14px 0 8px", fontSize: 13, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Care and routines</p>
          {CARE.map((p) => (
            <div key={p.id} style={box}>
              <span style={lab}>{p.en}</span>
              {textArea((ey.care || {})[p.id], (v) => setLocal({ ...ey, care: { ...(ey.care || {}), [p.id]: v } }), () => save(ey), 2)}
            </div>
          ))}
        </>
      )}
      {!preN && <p style={hint}>Approaches to learning, SEL and Life skills come from the ratings in Assessment.</p>}

      <div style={box}>
        <span style={lab}>What's next for me</span>
        <p style={hint}>One idea per line.</p>
        {textArea(ey.next, (v) => setLocal({ ...ey, next: v }), () => save(ey), 3)}
      </div>
      <div style={box}>
        <span style={lab}>How you can help at home</span>
        <p style={hint}>One idea per line.</p>
        {textArea(ey.home, (v) => setLocal({ ...ey, home: v }), () => save(ey), 3)}
      </div>
      <div style={box}>
        <span style={lab}>A note from the teacher</span>
        {textArea(ey.note, (v) => setLocal({ ...ey, note: v }), () => save(ey), 4)}
      </div>
    </div>
  );
}

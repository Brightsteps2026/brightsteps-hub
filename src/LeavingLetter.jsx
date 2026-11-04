import { useState } from "react";
import { COLORS, input, card as cardToken } from "./ui/tokens";
import { gradeLabel } from "./lib/format";

// Letter of withdrawal and certificate of attendance, printed in front of a
// leaving progress report (Myri, 4 Nov 2026). English page first, then French.
// The details Myri can adjust are kept in the report's content as `letter`.

const serif = "'Fraunces', Georgia, serif";

function fmt(iso, lang) {
  if (!iso) return "…";
  return new Date(iso + "T12:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function letterDefaults(report, hub, settings) {
  const c = report.content || {};
  const yearStart = settings?.academicYear?.startDate || c.period?.start || "";
  const enr = hub?.enrollmentDate || "";
  return {
    firstDay: enr && enr > yearStart ? enr : yearStart,
    dob: hub?.dob || "",
    gender: hub?.gender || "",
    reason_en: "",
    reason_fr: "",
    feesSettled: true,
    issued: new Date().toISOString().slice(0, 10),
    ...(c.letter || {})
  };
}

export function LeavingLetter({ report, letter, lang, logoUrl }) {
  const c = report.content || {};
  const L = letter;
  const name = c.student?.name || "";
  const first = name.split(" ")[0] || name;
  const fr = lang === "fr";
  const male = /^m/i.test(L.gender || "");
  const female = /^f/i.test(L.gender || "");
  const his = male ? "his" : female ? "her" : "their";
  const grade = gradeLabel(report.grade, lang);
  const year = (report.school_year || "").replace("-", "–");
  const lastDay = c.leaving?.date;
  const a = c.attendance;
  const days = a ? a.present + a.late + a.absent : 0;
  const reason = fr ? L.reason_fr || L.reason_en : L.reason_en;
  const p = { margin: "0 0 12px", lineHeight: 1.6, fontSize: "11pt" };

  return (
    <div className="bs-trc" style={{ padding: "4mm 2mm", minHeight: "250mm", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: `2px solid ${COLORS.brand}`, paddingBottom: 12 }}>
        {logoUrl && <img src={logoUrl} alt="" style={{ width: 58, height: 58, objectFit: "contain" }} />}
        <div>
          <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: COLORS.brand }}>BrightSteps International School</div>
          <div style={{ fontSize: 12, color: COLORS.muted }}>Grand-Bassam, Côte d'Ivoire · www.bischoolci.org</div>
        </div>
      </div>

      <p style={{ ...p, textAlign: "right", marginTop: 18 }}>Grand-Bassam, {fr ? "le " : ""}{fmt(L.issued, lang)}</p>

      <h2 style={{ fontFamily: serif, fontSize: 19, color: COLORS.brand, margin: "6px 0 18px", textAlign: "center" }}>
        {fr ? "Certificat de radiation et attestation de scolarité" : "Letter of withdrawal and certificate of attendance"}
      </h2>

      <p style={p}>{fr ? "À qui de droit," : "To whom it may concern,"}</p>

      {fr ? (
        <>
          <p style={p}>Nous certifions que <strong>{name}</strong>{L.dob ? <>, né{female ? "e" : ""} le {fmt(L.dob, "fr")}</> : null}, a été élève à BrightSteps International School, à Grand-Bassam (Côte d'Ivoire), en <strong>{grade}</strong> pour l'année scolaire {year}, du {fmt(L.firstDay, "fr")} au {fmt(lastDay, "fr")}.</p>
          <p style={p}>{first} a quitté l'école le {fmt(lastDay, "fr")}{reason ? `, ${reason}` : ""}.{L.feesSettled ? " Le compte de la famille auprès de l'école est soldé." : ""}</p>
          {a && days > 0 && <p style={p}>Du {fmt(c.period?.start, "fr")} au {fmt(c.period?.end, "fr")}, {first} a été présent{female ? "e" : ""} {a.present + a.late} jour{a.present + a.late > 1 ? "s" : ""} sur {days} ({a.absent} absence{a.absent > 1 ? "s" : ""}{a.late ? `, ${a.late} retard${a.late > 1 ? "s" : ""}` : ""}).</p>}
          <p style={p}>BrightSteps est une école de langue anglaise ; le français y est enseigné comme seconde langue. Notre enseignement repose sur une pédagogie par l'investigation (inquiry-based learning) et suit les Common Core State Standards en anglais et en mathématiques. Le bulletin de progression joint présente les apprentissages de {first} jusqu'à son dernier jour parmi nous.</p>
          <p style={p}>Nous avons eu grand plaisir à accueillir {first} et lui souhaitons pleine réussite dans sa nouvelle école. Nous restons à votre disposition pour tout renseignement complémentaire.</p>
          <p style={p}>Cette attestation est délivrée pour servir et valoir ce que de droit.</p>
        </>
      ) : (
        <>
          <p style={p}>We certify that <strong>{name}</strong>{L.dob ? <>, born on {fmt(L.dob, "en")}</> : null}, was a student at BrightSteps International School in Grand-Bassam, Côte d'Ivoire, in <strong>{grade}</strong> for the {year} school year, from {fmt(L.firstDay, "en")} to {fmt(lastDay, "en")}.</p>
          <p style={p}>{first} left the school on {fmt(lastDay, "en")}{reason ? `, ${reason}` : ""}.{L.feesSettled ? " The family's account with the school is settled." : ""}</p>
          {a && days > 0 && <p style={p}>From {fmt(c.period?.start, "en")} to {fmt(c.period?.end, "en")}, {first} attended {a.present + a.late} of {days} school days ({a.absent} absence{a.absent === 1 ? "" : "s"}{a.late ? `, ${a.late} late arrival${a.late === 1 ? "" : "s"}` : ""}).</p>}
          <p style={p}>BrightSteps is an English-language school, with French taught as a second language. Our teaching uses inquiry-based learning and follows the Common Core State Standards in English Language Arts and Mathematics. The attached progress report describes {first}'s learning up to {his} last day with us.</p>
          <p style={p}>We have very much enjoyed having {first} with us and wish {his === "their" ? "them" : his === "his" ? "him" : "her"} every success at {his} new school. Please do not hesitate to contact us for any further information.</p>
        </>
      )}

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, paddingTop: 30 }}>
        <div>
          <div style={{ height: 50 }} />
          <div style={{ borderTop: `1px solid ${COLORS.ink}`, paddingTop: 6, minWidth: 220 }}>
            <strong>Myriam Aoussou</strong>
            <div style={{ fontSize: 12, color: COLORS.muted }}>{fr ? "Directrice et Cheffe d'établissement" : "Director and Principal"}</div>
          </div>
        </div>
        <div style={{ width: 150, height: 90, border: `1px dashed ${COLORS.line}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: COLORS.muted, textAlign: "center" }}>
          {fr ? "Cachet de l'école" : "School stamp"}
        </div>
      </div>
    </div>
  );
}

// Small form in the leaving report window: the details printed on the letter.
export function LeavingLetterEditor({ value, onChange }) {
  const [v, setV] = useState(value);
  const set = (k, x) => { const n = { ...v, [k]: x }; setV(n); };
  const save = () => onChange(v);
  const lab = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: COLORS.muted };
  return (
    <div className="bsf-noprint" style={{ ...cardToken, background: COLORS.surface2, marginBottom: 14 }}>
      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Letter of withdrawal (printed in front of the report, English then French)</p>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: COLORS.muted }}>Check these details, then use “Print letter + report”. Sign and stamp the printed letter.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label style={lab}>First day at BrightSteps<input type="date" style={input} value={v.firstDay} onChange={(e) => set("firstDay", e.target.value)} onBlur={save} /></label>
        <label style={lab}>Date of birth<input type="date" style={input} value={v.dob} onChange={(e) => set("dob", e.target.value)} onBlur={save} /></label>
        <label style={lab}>Letter date<input type="date" style={input} value={v.issued} onChange={(e) => set("issued", e.target.value)} onBlur={save} /></label>
        <label style={lab}>Boy / girl
          <select style={input} value={/^m/i.test(v.gender) ? "Male" : /^f/i.test(v.gender) ? "Female" : ""} onChange={(e) => { const n = { ...v, gender: e.target.value }; setV(n); onChange(n); }}>
            <option value="">—</option><option value="Male">Boy</option><option value="Female">Girl</option>
          </select>
        </label>
        <label style={{ ...lab, gridColumn: "1 / -1" }}>Reason, in English (optional, completes “left the school on …, ”)
          <input style={input} value={v.reason_en} placeholder="as the family is moving to Ghana" onChange={(e) => set("reason_en", e.target.value)} onBlur={save} />
        </label>
        <label style={{ ...lab, gridColumn: "1 / -1" }}>Reason, in French (optional)
          <input style={input} value={v.reason_fr} placeholder="la famille s'installant au Ghana" onChange={(e) => set("reason_fr", e.target.value)} onBlur={save} />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, minHeight: 44, gridColumn: "1 / -1" }}>
          <input type="checkbox" checked={!!v.feesSettled} onChange={(e) => { const n = { ...v, feesSettled: e.target.checked }; setV(n); onChange(n); }} style={{ width: 18, height: 18 }} />
          Say that the family's account is settled
        </label>
      </div>
    </div>
  );
}


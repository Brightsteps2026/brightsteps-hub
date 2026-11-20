import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";
import { COLORS, card, chip, chipOn, primaryBtn, input, pill } from "./ui/tokens";

// Parent Dashboard card: re-enrolment for next school year (Myri, 20 Nov 2026).
// Follows the EN/FR toggle (never both side by side).
const TXT = {
  en: {
    title: (y) => `Re-enrolment ${y}`,
    intro: (y, d) => `Will your child return to BrightSteps in ${y}? Please answer for each child${d ? ` by ${d}` : ""}.`,
    next: "Next year",
    returning: "Yes, returning",
    leaving: "No, leaving",
    unsure: "Not sure yet",
    note: "Anything we should know? (optional)",
    save: "Send answer",
    saved: "Answer received",
    change: "Change"
  },
  fr: {
    title: (y) => `Réinscription ${y}`,
    intro: (y, d) => `Votre enfant reviendra-t-il à BrightSteps en ${y} ? Merci de répondre pour chaque enfant${d ? ` avant le ${d}` : ""}.`,
    next: "L'an prochain",
    returning: "Oui, il/elle revient",
    leaving: "Non, il/elle part",
    unsure: "Pas encore sûr",
    note: "Quelque chose à nous dire ? (facultatif)",
    save: "Envoyer la réponse",
    saved: "Réponse reçue",
    change: "Modifier"
  }
};

export function ReenrolmentCard() {
  const { language } = useLanguage();
  const T = TXT[language === "fr" ? "fr" : "en"];
  const [kids, setKids] = useState([]);
  const load = () => supabase.rpc("reenrol_my_children").then(({ data }) => setKids(data || []));
  useEffect(() => { load(); }, []);
  if (!kids.length || !kids[0].open) return null;
  const year = kids[0].school_year;
  const d = kids[0].deadline ? new Date(kids[0].deadline + "T12:00:00").toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long" }) : "";
  return (
    <section className="bsf-card" style={{ ...card, borderColor: COLORS.brand }}>
      <h2 style={{ margin: "0 0 4px" }}>{T.title(year)}</h2>
      <p style={{ margin: "0 0 10px", fontSize: 14, color: COLORS.muted }}>{T.intro(year, d)}</p>
      {kids.map((k) => <Child key={k.student_id} k={k} T={T} reload={load} />)}
    </section>
  );
}

function Child({ k, T, reload }) {
  const [editing, setEditing] = useState(!k.intent);
  const [intent, setIntent] = useState(k.intent || "returning");
  const [note, setNote] = useState(k.note || "");
  const [err, setErr] = useState("");
  async function save() {
    const { error } = await supabase.rpc("reenrol_answer", { p_student: k.student_id, p_intent: intent, p_note: note });
    if (error) return setErr(error.message);
    setEditing(false);
    reload();
  }
  return (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${COLORS.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>{k.name}</span>
        <span style={{ fontSize: 13, color: COLORS.muted }}>{T.next}: {k.next_grade}</span>
      </div>
      {!editing && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          <span style={pill(k.intent === "returning" ? "ok" : k.intent === "leaving" ? "bad" : "warn")}>{T.saved}: {T[k.intent]}</span>
          <button style={chip} onClick={() => setEditing(true)}>{T.change}</button>
        </div>
      )}
      {editing && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {["returning", "unsure", "leaving"].map((i) => <button key={i} style={intent === i ? chipOn : chip} onClick={() => setIntent(i)}>{T[i]}</button>)}
          </div>
          <input style={{ ...input, marginTop: 8 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={T.note} />
          {err && <p style={{ color: COLORS.bad, fontSize: 13 }}>{err}</p>}
          <button style={{ ...primaryBtn, marginTop: 8 }} onClick={save}>{T.save}</button>
        </>
      )}
    </div>
  );
}

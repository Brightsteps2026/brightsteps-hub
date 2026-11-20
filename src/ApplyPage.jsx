import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment } from "./lib/attachments";
import { COLORS, card, chip, chipOn, primaryBtn, ghostBtn, input, label } from "./ui/tokens";

// Public admissions page (no login): hub.bischoolci.org/apply
// Families book a visit or apply, upload documents, and answer an offer (?offer=<token>).
// One language at a time with an EN/FR switch (Myri: never side by side).

const GRADES = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
const SOURCES = ["Friend or family", "Facebook / Instagram", "Website", "Google", "School sign", "Real estate partner", "Event", "Other"];
const DOCS = ["birth", "report", "photo", "vaccination"];

const T = {
  en: {
    school: "BrightSteps International School",
    title: "Admissions",
    intro: (y) => `Apply for the ${y} school year, or book a visit to see the school first.`,
    closed: "Applications are closed for now. Please contact the school.",
    visit: "Book a visit", apply: "Apply now",
    child: "Your child", first: "First name", last: "Last name", dob: "Date of birth", gender: "Gender", girl: "Girl", boy: "Boy",
    nationality: "Nationality", grade: "Class for next school year", current: "Current school", languages: "Languages spoken at home",
    needs: "Anything we should know (health, learning needs)? (optional)",
    parent: "Parent or guardian", name: "Full name", relationship: "Relationship to the child", email: "Email", phone: "Phone (WhatsApp)",
    parent2: "Second parent or guardian (optional)", address: "Home address or neighbourhood",
    how: "How did you hear about BrightSteps?", referred: "If a family referred you, their name (optional)",
    message: "Message to the school (optional)",
    docs: "Documents", docLabels: { birth: "Birth certificate", report: "Latest report card", photo: "Recent photo of your child", vaccination: "Vaccination record" },
    choose: "Choose file", docsHelp: "You can also bring these documents to your visit.",
    slot: "Choose a visit time", noSlots: "No visit times are open right now. Send your details and we will call you to arrange one.",
    consent: "I confirm the information is correct and agree that BrightSteps keeps it to process this application.",
    send: "Send", sending: "Sending…",
    doneTitle: "Thank you", doneApply: (r) => `Your application has been received. Your reference is ${r}. We have sent you a confirmation email.`,
    doneVisit: (r) => `Your visit request has been received. Your reference is ${r}. We have sent you a confirmation email.`,
    doneWait: (r) => `This class is currently full, so your child is on our waiting list (reference ${r}). We will contact you as soon as a place becomes available.`,
    required: "Please fill in the child's first name, your name, a valid email and phone, and tick the box.",
    offerTitle: (c) => `A place for ${c}`, offerBody: (c, g, y) => `We are delighted to offer ${c} a place in ${g} for the ${y} school year.`,
    offerExpires: (d) => `Please answer by ${d}.`, fee: (f) => `Registration fee: ${f}.`, sign: "Type your full name to sign",
    accept: "Accept the place", decline: "Decline", offerAccepted: "Thank you. You have accepted the place. We will contact you about the registration fee and next steps.",
    offerDeclined: "Thank you for letting us know. We wish your family all the best.", offerGone: "This offer is no longer open. Please contact the school."
  },
  fr: {
    school: "BrightSteps International School",
    title: "Admissions",
    intro: (y) => `Inscrivez votre enfant pour l'année scolaire ${y}, ou réservez d'abord une visite de l'école.`,
    closed: "Les inscriptions sont fermées pour le moment. Merci de contacter l'école.",
    visit: "Réserver une visite", apply: "S'inscrire",
    child: "Votre enfant", first: "Prénom", last: "Nom", dob: "Date de naissance", gender: "Sexe", girl: "Fille", boy: "Garçon",
    nationality: "Nationalité", grade: "Classe pour l'année prochaine", current: "École actuelle", languages: "Langues parlées à la maison",
    needs: "Quelque chose à nous signaler (santé, besoins d'apprentissage) ? (facultatif)",
    parent: "Parent ou tuteur", name: "Nom complet", relationship: "Lien avec l'enfant", email: "E-mail", phone: "Téléphone (WhatsApp)",
    parent2: "Second parent ou tuteur (facultatif)", address: "Adresse ou quartier",
    how: "Comment avez-vous connu BrightSteps ?", referred: "Si une famille vous a recommandés, son nom (facultatif)",
    message: "Message à l'école (facultatif)",
    docs: "Documents", docLabels: { birth: "Extrait d'acte de naissance", report: "Dernier bulletin", photo: "Photo récente de l'enfant", vaccination: "Carnet de vaccination" },
    choose: "Choisir un fichier", docsHelp: "Vous pouvez aussi apporter ces documents lors de votre visite.",
    slot: "Choisissez un horaire de visite", noSlots: "Aucun horaire n'est ouvert pour le moment. Envoyez vos coordonnées et nous vous appellerons.",
    consent: "Je confirme que les informations sont exactes et j'accepte que BrightSteps les conserve pour traiter cette demande.",
    send: "Envoyer", sending: "Envoi…",
    doneTitle: "Merci", doneApply: (r) => `Votre demande a bien été reçue. Votre référence est ${r}. Un e-mail de confirmation vous a été envoyé.`,
    doneVisit: (r) => `Votre demande de visite a bien été reçue. Votre référence est ${r}. Un e-mail de confirmation vous a été envoyé.`,
    doneWait: (r) => `Cette classe est actuellement complète : votre enfant est sur notre liste d'attente (référence ${r}). Nous vous contacterons dès qu'une place se libère.`,
    required: "Merci d'indiquer le prénom de l'enfant, votre nom, un e-mail et un téléphone valides, et de cocher la case.",
    offerTitle: (c) => `Une place pour ${c}`, offerBody: (c, g, y) => `Nous avons le plaisir d'offrir à ${c} une place en ${g} pour l'année scolaire ${y}.`,
    offerExpires: (d) => `Merci de répondre avant le ${d}.`, fee: (f) => `Frais d'inscription : ${f}.`, sign: "Tapez votre nom complet pour signer",
    accept: "Accepter la place", decline: "Refuser", offerAccepted: "Merci. Vous avez accepté la place. Nous vous contacterons pour les frais d'inscription et les prochaines étapes.",
    offerDeclined: "Merci de nous avoir informés. Nous souhaitons le meilleur à votre famille.", offerGone: "Cette offre n'est plus ouverte. Merci de contacter l'école."
  }
};

const page = { minHeight: "100vh", background: COLORS.bg, fontFamily: "'Work Sans', system-ui, sans-serif", color: COLORS.ink };
const wrap = { maxWidth: 640, margin: "0 auto", padding: "20px 16px 60px" };
const box = { ...card, marginBottom: 14 };
const h2 = { margin: "0 0 6px", fontSize: 17, fontWeight: 600 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 };

export default function ApplyPage() {
  const params = new URLSearchParams(window.location.search);
  const [lang, setLang] = useState(params.get("lang") === "en" ? "en" : params.get("lang") === "fr" ? "fr" : (navigator.language || "").startsWith("fr") ? "fr" : "en");
  const t = T[lang];
  const offer = params.get("offer");
  return (
    <div style={page}>
      <div style={wrap}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="" style={{ width: 54, height: "auto" }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: COLORS.brand }}>{t.school}</p>
              <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>{t.title}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={lang === "en" ? chipOn : chip} onClick={() => setLang("en")}>EN</button>
            <button style={lang === "fr" ? chipOn : chip} onClick={() => setLang("fr")}>FR</button>
          </div>
        </div>
        {offer ? <Offer token={offer} t={t} lang={lang} /> : <ApplyForm t={t} lang={lang} />}
      </div>
    </div>
  );
}

function ApplyForm({ t, lang }) {
  const [info, setInfo] = useState(null);
  const [kind, setKind] = useState("application");
  const [f, setF] = useState({ child_gender: "", source: "" });
  const [files, setFiles] = useState({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  useEffect(() => { supabase.rpc("adm_public_info").then(({ data }) => setInfo(data || { open: false })); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const field = (k, l, type = "text") => (
    <div><span style={label}>{l}</span><input type={type} style={input} value={f[k] || ""} onChange={set(k)} /></div>
  );

  if (!info) return null;
  if (!info.open) return <p style={box}>{t.closed}</p>;
  if (done) {
    return (
      <div style={box}>
        <h2 style={h2}>{t.doneTitle}</h2>
        <p style={{ fontSize: 15 }}>{done.stage === "waitlist" ? t.doneWait(done.ref) : kind === "visit" ? t.doneVisit(done.ref) : t.doneApply(done.ref)}</p>
      </div>
    );
  }

  async function submit() {
    setErr("");
    if (!consent || !(f.child_first_name || "").trim() || !(f.parent1_name || "").trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((f.parent1_email || "").trim()) || !(f.parent1_phone || "").trim()) {
      return setErr(t.required);
    }
    setBusy(true);
    try {
      const folder = `applications/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const documents = [];
      for (const k of DOCS) {
        if (files[k]) {
          const up = await uploadAttachment(files[k], folder);
          documents.push({ kind: k, path: up.path, name: files[k].name });
        }
      }
      const { data, error } = await supabase.rpc("adm_public_submit", { p: { ...f, kind, language: lang, documents } });
      if (error) throw error;
      supabase.functions.invoke("notify-admissions", { body: { id: data.id } }).catch(() => {});
      setDone(data);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <>
      <p style={{ fontSize: 15, marginTop: 0 }}>{t.intro(info.school_year)}</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button style={kind === "application" ? chipOn : chip} onClick={() => setKind("application")}>{t.apply}</button>
        <button style={kind === "visit" ? chipOn : chip} onClick={() => setKind("visit")}>{t.visit}</button>
      </div>

      {kind === "visit" && (
        <div style={box}>
          <h2 style={h2}>{t.slot}</h2>
          {info.slots.length === 0 && <p style={{ fontSize: 14, color: COLORS.muted }}>{t.noSlots}</p>}
          <div style={{ display: "grid", gap: 6 }}>
            {info.slots.map((s) => (
              <button key={s.id} style={f.visit_slot_id === s.id ? chipOn : chip} onClick={() => setF({ ...f, visit_slot_id: s.id })}>
                {new Date(s.starts_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })}
                {s.kind === "open_day" ? (lang === "fr" ? " · Journée portes ouvertes" : " · Open day") : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={box}>
        <h2 style={h2}>{t.child}</h2>
        <div style={grid}>
          {field("child_first_name", t.first)}
          {field("child_last_name", t.last)}
          <div><span style={label}>{t.grade}</span>
            <select style={input} value={f.grade || ""} onChange={set("grade")}>
              <option value="">—</option>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select></div>
          {kind === "application" && field("child_dob", t.dob, "date")}
          {kind === "application" && (
            <div><span style={label}>{t.gender}</span>
              <select style={input} value={f.child_gender} onChange={set("child_gender")}>
                <option value="">—</option><option value="Female">{t.girl}</option><option value="Male">{t.boy}</option>
              </select></div>
          )}
          {kind === "application" && field("child_nationality", t.nationality)}
          {kind === "application" && field("current_school", t.current)}
          {kind === "application" && field("languages", t.languages)}
        </div>
        {kind === "application" && (<><span style={label}>{t.needs}</span><textarea style={{ ...input, minHeight: 60 }} value={f.learning_needs || ""} onChange={set("learning_needs")} /></>)}
      </div>

      <div style={box}>
        <h2 style={h2}>{t.parent}</h2>
        <div style={grid}>
          {field("parent1_name", t.name)}
          {field("parent1_relationship", t.relationship)}
          {field("parent1_email", t.email, "email")}
          {field("parent1_phone", t.phone, "tel")}
        </div>
        {kind === "application" && (
          <>
            <p style={{ ...h2, fontSize: 15, marginTop: 14 }}>{t.parent2}</p>
            <div style={grid}>
              {field("parent2_name", t.name)}
              {field("parent2_relationship", t.relationship)}
              {field("parent2_email", t.email, "email")}
              {field("parent2_phone", t.phone, "tel")}
            </div>
            <span style={label}>{t.address}</span><input style={input} value={f.home_address || ""} onChange={set("home_address")} />
          </>
        )}
        <div style={grid}>
          <div><span style={label}>{t.how}</span>
            <select style={input} value={f.source} onChange={set("source")}>
              <option value="">—</option>{SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          {field("referred_by", t.referred)}
        </div>
        <span style={label}>{t.message}</span><textarea style={{ ...input, minHeight: 60 }} value={f.parent_message || ""} onChange={set("parent_message")} />
        <input type="text" value={f.website || ""} onChange={set("website")} tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} aria-hidden="true" />
      </div>

      {kind === "application" && (
        <div style={box}>
          <h2 style={h2}>{t.docs}</h2>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 8px" }}>{t.docsHelp}</p>
          {DOCS.map((k) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0" }}>
              <span style={{ fontSize: 14 }}>{t.docLabels[k]}</span>
              <label style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", maxWidth: 220, overflow: "hidden" }}>
                {files[k] ? files[k].name : t.choose}
                <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFiles({ ...files, [k]: e.target.files?.[0] })} />
              </label>
            </div>
          ))}
        </div>
      )}

      <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "flex-start", marginBottom: 12 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span>{t.consent}</span>
      </label>
      {err && <p style={{ color: COLORS.bad, fontSize: 14 }}>{err}</p>}
      <button style={{ ...primaryBtn, width: "100%" }} disabled={busy} onClick={submit}>{busy ? t.sending : t.send}</button>
    </>
  );
}

function Offer({ token, t, lang }) {
  const [o, setO] = useState(undefined);
  const [name, setName] = useState("");
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { supabase.rpc("adm_offer_get", { p_token: token }).then(({ data }) => setO(data || null)); }, [token]);
  if (o === undefined) return null;
  if (!o || (o.stage !== "offered" && !result)) return <p style={box}>{t.offerGone}</p>;
  if (result) return <p style={box}>{result === "accepted" ? t.offerAccepted : t.offerDeclined}</p>;
  async function respond(accept) {
    setErr("");
    const { data, error } = await supabase.rpc("adm_offer_respond", { p_token: token, p_accept: accept, p_signed_by: name });
    if (error) return setErr(error.message);
    const { data: info } = await supabase.rpc("adm_offer_get", { p_token: token });
    setResult(data);
    if (info) supabase.functions.invoke("notify-admissions", { body: { id: info.id } }).catch(() => {});
  }
  const exp = o.expires ? new Date(o.expires + "T12:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <div style={box}>
      <h2 style={h2}>{t.offerTitle(o.child)}</h2>
      <p style={{ fontSize: 15 }}>{t.offerBody(o.child, o.grade, o.school_year)}</p>
      {exp && <p style={{ fontSize: 14 }}>{t.offerExpires(exp)}</p>}
      {o.fee && <p style={{ fontSize: 14 }}>{t.fee(o.fee)}</p>}
      <span style={label}>{t.sign}</span>
      <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
      {err && <p style={{ color: COLORS.bad, fontSize: 14 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={primaryBtn} onClick={() => respond(true)}>{t.accept}</button>
        <button style={ghostBtn} onClick={() => respond(false)}>{t.decline}</button>
      </div>
    </div>
  );
}

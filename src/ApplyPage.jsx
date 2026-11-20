import { useEffect, useState } from "react";
import { Check, CalendarDays, FileText, UploadCloud, ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment } from "./lib/attachments";

// Public admissions page (no login): hub.bischoolci.org/apply
// Redesigned 20 Nov 2026 to match the school website (maroon, Fraunces headings).
// Step by step: Child · Family · Documents · Review. One language at a time (EN/FR switch).
// ?lang=fr|en sets the language, ?visit=1 opens on visit booking, ?offer=<token> shows an offer.

const GRADES = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];
const GRADE_LABEL = {
  en: { "Pre-N": "Pre-Nursery", PreK: "Pre-Kindergarten" },
  fr: { "Pre-N": "Pre-Nursery (petite section)", PreK: "Pre-Kindergarten (moyenne section)", Kindergarten: "Kindergarten (grande section)" }
};
const SOURCES = {
  en: ["Friend or family", "Facebook / Instagram", "Our website", "Google", "School sign", "Real estate partner", "Event", "Other"],
  fr: ["Ami ou famille", "Facebook / Instagram", "Notre site internet", "Google", "Panneau de l'école", "Agence immobilière", "Événement", "Autre"]
};
const SOURCE_VALUES = ["Friend or family", "Facebook / Instagram", "Website", "Google", "School sign", "Real estate partner", "Event", "Other"];
const DOCS = ["birth", "report", "photo", "vaccination"];

const T = {
  en: {
    admissions: (y) => `Admissions ${y}`,
    heroTitle: "Begin your journey with us",
    heroText: "Thank you for considering BrightSteps. The application takes about ten minutes, and you can send your child's documents from your phone.",
    closed: "Online applications are closed for the moment. Please contact the school.",
    applyCard: ["Apply online", "Send your child's application and documents."],
    visitCard: ["Book a school visit", "Tour the campus and meet our team first."],
    stepsApply: ["Your child", "Your family", "Documents", "Review"],
    stepsVisit: ["Visit time", "Your details", "Review"],
    childLead: "Tell us about your child and the class they will join next school year.",
    familyLead: "We will use these details to contact you about the next steps.",
    first: "First name", last: "Last name", dob: "Date of birth", gender: "Gender", girl: "Girl", boy: "Boy", select: "Select",
    nationality: "Nationality", grade: "Class for the next school year", current: "Current school", languages: "Languages spoken at home",
    needs: "Anything we should know to support your child well?", needsHint: "Health, allergies or learning needs. This stays confidential.",
    parent: "Main parent or guardian", name: "Full name", relationship: "Relationship to the child", email: "Email address", phone: "Phone (WhatsApp)",
    parent2: "Second parent or guardian", optional: "optional", address: "Home address or neighbourhood",
    knowYou: "Getting to know you", how: "How did you hear about BrightSteps?", referred: "Referred by a BrightSteps family?", message: "Message to our Admissions team",
    docsTitle: "Supporting documents", docsText: "A clear photo taken with your phone is fine. Missing a document? You can bring it to your visit.",
    docLabels: { birth: "Birth certificate", report: "Latest report card", photo: "Recent photo of your child", vaccination: "Vaccination record" },
    upload: "Tap to upload · PDF or photo",
    slot: "Choose a time for your visit", visitHint: "A visit lasts about 45 minutes. Your child is welcome to come with you.",
    noSlots: "No visit times are open right now. Send your details and our Admissions team will call you to arrange a visit.",
    child: "Your child", review: "Review your application", reviewLead: "Please check everything before sending. You can edit any section.", edit: "Edit",
    callYou: "We will call you to arrange a time",
    consent: "I confirm that this information is correct, and I agree that BrightSteps keeps it to process this application.",
    back: "Back", next: "Continue", send: "Submit application", sendVisit: "Book my visit", sending: "Sending…",
    required: "Please fill in the fields marked with *.", emailBad: "Please enter a valid email address.", consentNeeded: "Please tick the box to confirm.",
    doneTitle: "Thank you", doneApply: "Your application has been received.", doneVisit: "Your visit request has been received.",
    doneWait: "This class is currently full, so your child has been placed on our waiting list. We will contact you as soon as a place becomes available.",
    ref: "Your reference", emailSent: "A confirmation has been sent to your email address.",
    nextTitle: "What happens next", nextSteps: ["Our Admissions team reviews your application", "You visit the school and meet our team", "You receive your offer by email"],
    contact: "Questions? WhatsApp +225 07 10 11 01 33", privacy: "Your information is used only to process your application.", privacyLink: "Privacy Policy",
    offerEyebrow: "Offer of a place",
    offerTitle: (c) => `A place for ${c}`, offerBody: (c, g, y) => `We are delighted to offer ${c} a place in ${g} for the ${y} school year.`,
    offerExpires: (d) => `Please reply by ${d}.`, fee: (f) => `Registration fee: ${f}.`, sign: "Type your full name to sign",
    accept: "Accept the place", decline: "Decline the offer", offerAccepted: "You have accepted the place. We will contact you about the registration fee and next steps.",
    offerDeclined: "Thank you for letting us know. We wish your family all the best.", offerGone: "This offer is no longer open. Please contact the school."
  },
  fr: {
    admissions: (y) => `Inscriptions ${y}`,
    heroTitle: "Commencez l'aventure avec nous",
    heroText: "Merci de l'intérêt que vous portez à BrightSteps. La demande prend une dizaine de minutes, et vous pouvez envoyer les documents depuis votre téléphone.",
    closed: "Les inscriptions en ligne sont fermées pour le moment. Merci de contacter l'école.",
    applyCard: ["Inscription en ligne", "Envoyez la demande et les documents de votre enfant."],
    visitCard: ["Réserver une visite", "Visitez le campus et rencontrez notre équipe d'abord."],
    stepsApply: ["Votre enfant", "Votre famille", "Documents", "Vérification"],
    stepsVisit: ["Horaire", "Vos coordonnées", "Vérification"],
    childLead: "Présentez-nous votre enfant et la classe qu'il rejoindra l'année prochaine.",
    familyLead: "Ces informations nous permettront de vous contacter pour la suite.",
    first: "Prénom", last: "Nom", dob: "Date de naissance", gender: "Sexe", girl: "Fille", boy: "Garçon", select: "Choisir",
    nationality: "Nationalité", grade: "Classe pour l'année prochaine", current: "École actuelle", languages: "Langues parlées à la maison",
    needs: "Quelque chose à savoir pour bien accompagner votre enfant ?", needsHint: "Santé, allergies ou besoins d'apprentissage. Ces informations restent confidentielles.",
    parent: "Parent ou tuteur principal", name: "Nom complet", relationship: "Lien avec l'enfant", email: "Adresse e-mail", phone: "Téléphone (WhatsApp)",
    parent2: "Second parent ou tuteur", optional: "facultatif", address: "Adresse ou quartier",
    knowYou: "Pour mieux vous connaître", how: "Comment avez-vous connu BrightSteps ?", referred: "Recommandés par une famille BrightSteps ?", message: "Message à notre équipe des admissions",
    docsTitle: "Pièces justificatives", docsText: "Une photo nette prise avec votre téléphone suffit. Un document manque ? Vous pourrez l'apporter lors de votre visite.",
    docLabels: { birth: "Extrait d'acte de naissance", report: "Dernier bulletin", photo: "Photo récente de l'enfant", vaccination: "Carnet de vaccination" },
    upload: "Touchez pour ajouter · PDF ou photo",
    slot: "Choisissez l'horaire de votre visite", visitHint: "La visite dure environ 45 minutes. Votre enfant est le bienvenu.",
    noSlots: "Aucun horaire n'est ouvert pour le moment. Envoyez vos coordonnées et notre équipe vous appellera pour organiser une visite.",
    child: "Votre enfant", review: "Vérifiez votre demande", reviewLead: "Merci de tout vérifier avant l'envoi. Vous pouvez modifier chaque partie.", edit: "Modifier",
    callYou: "Nous vous appellerons pour fixer un horaire",
    consent: "Je confirme que ces informations sont exactes et j'accepte que BrightSteps les conserve pour traiter cette demande.",
    back: "Retour", next: "Continuer", send: "Envoyer la demande", sendVisit: "Réserver ma visite", sending: "Envoi…",
    required: "Merci de remplir les champs marqués d'un *.", emailBad: "Merci d'indiquer une adresse e-mail valide.", consentNeeded: "Merci de cocher la case pour confirmer.",
    doneTitle: "Merci", doneApply: "Votre demande a bien été reçue.", doneVisit: "Votre demande de visite a bien été reçue.",
    doneWait: "Cette classe est actuellement complète : votre enfant est inscrit sur notre liste d'attente. Nous vous contacterons dès qu'une place se libère.",
    ref: "Votre référence", emailSent: "Une confirmation a été envoyée à votre adresse e-mail.",
    nextTitle: "Les prochaines étapes", nextSteps: ["Notre équipe étudie votre demande", "Vous visitez l'école et rencontrez notre équipe", "Vous recevez votre offre par e-mail"],
    contact: "Des questions ? WhatsApp +225 07 10 11 01 33", privacy: "Vos informations servent uniquement au traitement de votre demande.", privacyLink: "Politique de confidentialité",
    offerEyebrow: "Offre de place",
    offerTitle: (c) => `Une place pour ${c}`, offerBody: (c, g, y) => `Nous avons le plaisir d'offrir à ${c} une place en ${g} pour l'année scolaire ${y}.`,
    offerExpires: (d) => `Merci de répondre avant le ${d}.`, fee: (f) => `Frais d'inscription : ${f}.`, sign: "Tapez votre nom complet pour signer",
    accept: "Accepter la place", decline: "Refuser l'offre", offerAccepted: "Vous avez accepté la place. Nous vous contacterons pour les frais d'inscription et les prochaines étapes.",
    offerDeclined: "Merci de nous avoir informés. Nous souhaitons le meilleur à votre famille.", offerGone: "Cette offre n'est plus ouverte. Merci de contacter l'école."
  }
};

const M = "#5C1220";
const CSS = `
.ap { min-height: 100vh; background: #F7F4F1; color: #1B1B2F; font-family: 'Work Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.ap * { box-sizing: border-box; }
.ap-band { background: ${M}; color: #fff; padding: 18px 20px 84px; }
.ap-top { max-width: 760px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.ap-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: #fff; }
.ap-brand img { width: 46px; height: 46px; background: #fff; border-radius: 50%; padding: 5px; object-fit: contain; }
.ap-brand b { display: block; font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 20px; line-height: 1.1; }
.ap-brand small { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }
.ap-lang { display: flex; border: 1px solid rgba(255,255,255,.45); border-radius: 2px; overflow: hidden; }
.ap-lang button { background: transparent; color: #fff; border: 0; padding: 8px 12px; font: 600 12px 'Work Sans', sans-serif; cursor: pointer; letter-spacing: .08em; }
.ap-lang button.on { background: #fff; color: ${M}; }
.ap-hero { max-width: 760px; margin: 44px auto 0; }
.ap-eyebrow { font-size: 12px; letter-spacing: .16em; text-transform: uppercase; opacity: .82; margin: 0 0 12px; }
.ap-hero h1 { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: clamp(32px, 6vw, 48px); line-height: 1.06; margin: 0 0 14px; letter-spacing: -.01em; }
.ap-hero p { margin: 0; max-width: 560px; font-size: 16px; line-height: 1.65; opacity: .9; }
.ap-main { max-width: 760px; margin: -52px auto 0; padding: 0 16px 56px; }
.ap-card { background: #fff; border: 1px solid rgba(27,27,47,.08); border-radius: 4px; box-shadow: 0 24px 48px -28px rgba(42,7,14,.4); padding: 36px; }
@media (max-width: 600px) { .ap-card { padding: 24px 18px; } .ap-band { padding-bottom: 72px; } .ap-hero { margin-top: 32px; } }
.ap-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 30px; }
@media (max-width: 560px) { .ap-choices { grid-template-columns: 1fr; } }
.ap-choice { text-align: left; border: 1px solid rgba(27,27,47,.14); background: #fff; border-radius: 4px; padding: 18px; cursor: pointer; display: flex; gap: 14px; align-items: flex-start; font: inherit; color: inherit; transition: border-color .15s, box-shadow .15s, background .15s; }
.ap-choice:hover { border-color: ${M}; }
.ap-choice.on { border-color: ${M}; box-shadow: inset 0 0 0 1px ${M}; background: #FBF6F6; }
.ap-choice svg { color: ${M}; flex-shrink: 0; margin-top: 1px; }
.ap-choice b { display: block; font-weight: 600; font-size: 15px; margin-bottom: 3px; }
.ap-choice span { font-size: 13px; color: #4A4A5C; line-height: 1.45; }
.ap-steps { display: flex; gap: 8px; margin: 0 0 30px; padding: 0; list-style: none; }
.ap-steps li { flex: 1; font-size: 12px; color: #9A9AA8; letter-spacing: .02em; }
.ap-steps li::before { content: ""; display: block; height: 3px; background: #EEE8E5; border-radius: 2px; margin-bottom: 9px; transition: background .2s; }
.ap-steps li.done::before, .ap-steps li.on::before { background: ${M}; }
.ap-steps li.on { color: ${M}; font-weight: 600; }
.ap-steps li.done { color: #4A4A5C; }
@media (max-width: 480px) { .ap-steps li span { display: none; } .ap-steps li.on span { display: inline; white-space: nowrap; } }
.ap h2 { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 27px; margin: 0 0 8px; letter-spacing: -.005em; }
.ap .lead { margin: 0 0 26px; color: #4A4A5C; font-size: 15px; line-height: 1.6; }
.ap h3 { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: ${M}; margin: 32px 0 14px; font-weight: 600; padding-bottom: 10px; border-bottom: 1px solid rgba(27,27,47,.08); }
.ap h3 i { text-transform: none; letter-spacing: 0; color: #9A9AA8; font-weight: 400; font-style: normal; }
.ap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 16px; }
@media (max-width: 560px) { .ap-grid { grid-template-columns: 1fr; } }
.ap-f { display: flex; flex-direction: column; gap: 7px; }
.ap-f.full { grid-column: 1 / -1; }
.ap-f label { font-size: 13px; font-weight: 600; color: #2A2A3C; }
.ap-f label em { color: ${M}; font-style: normal; }
.ap-f label i { font-weight: 400; color: #9A9AA8; font-style: normal; }
.ap-f .hint { font-size: 12px; color: #9A9AA8; }
.ap input[type=text], .ap input[type=email], .ap input[type=tel], .ap input[type=date], .ap select, .ap textarea {
  width: 100%; min-height: 50px; padding: 13px 14px; border: 1px solid rgba(27,27,47,.16); border-radius: 3px; background: #FDFCFB;
  font: 15px 'Work Sans', system-ui, sans-serif; color: #1B1B2F; transition: border-color .15s, box-shadow .15s, background .15s; -webkit-appearance: none; appearance: none; }
.ap input::placeholder, .ap textarea::placeholder { color: #B3B3BF; }
.ap select { background-color: #FDFCFB; background-image: linear-gradient(45deg, transparent 50%, ${M} 50%), linear-gradient(135deg, ${M} 50%, transparent 50%);
  background-position: calc(100% - 20px) 22px, calc(100% - 15px) 22px; background-size: 5px 5px; background-repeat: no-repeat; padding-right: 38px; }
.ap textarea { min-height: 104px; resize: vertical; line-height: 1.55; }
.ap input:focus, .ap select:focus, .ap textarea:focus { outline: none; border-color: ${M}; background: #fff; box-shadow: 0 0 0 3px rgba(92,18,32,.10); }
.ap .bad input, .ap .bad select { border-color: #B23A3A; background: #FFF8F8; }
.ap-docs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 560px) { .ap-docs { grid-template-columns: 1fr; } }
.ap-doc { border: 1px dashed rgba(27,27,47,.24); border-radius: 4px; padding: 18px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: border-color .15s, background .15s; }
.ap-doc:hover { border-color: ${M}; background: #FBF6F6; }
.ap-doc.has { border-style: solid; border-color: #2F7A5C; background: #F3F9F6; }
.ap-doc .ic { width: 40px; height: 40px; border-radius: 50%; background: #F5ECEC; color: ${M}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ap-doc.has .ic { background: #2F7A5C; color: #fff; }
.ap-doc b { display: block; font-size: 14px; font-weight: 600; }
.ap-doc small { display: block; font-size: 12px; color: #9A9AA8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 230px; margin-top: 2px; }
.ap-slots { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 560px) { .ap-slots { grid-template-columns: 1fr; } }
.ap-slot { border: 1px solid rgba(27,27,47,.14); border-radius: 4px; padding: 16px 18px; background: #fff; text-align: left; cursor: pointer; font: inherit; color: inherit; display: flex; gap: 12px; align-items: center; transition: border-color .15s; }
.ap-slot:hover { border-color: ${M}; }
.ap-slot.on { border-color: ${M}; box-shadow: inset 0 0 0 1px ${M}; background: #FBF6F6; }
.ap-slot svg { color: ${M}; flex-shrink: 0; }
.ap-slot b { display: block; font-size: 15px; font-weight: 600; }
.ap-slot b::first-letter { text-transform: uppercase; }
.ap-slot span { font-size: 13px; color: #4A4A5C; }
.ap-review { border: 1px solid rgba(27,27,47,.10); border-radius: 4px; margin-bottom: 14px; overflow: hidden; }
.ap-review-h { display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #FAF7F5; border-bottom: 1px solid rgba(27,27,47,.07); }
.ap-review-h b { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: ${M}; }
.ap-review-h button { background: none; border: 0; color: ${M}; font: 600 13px 'Work Sans', sans-serif; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.ap-review dl { margin: 0; padding: 12px 18px; display: grid; grid-template-columns: 190px 1fr; gap: 8px 14px; font-size: 14px; }
@media (max-width: 560px) { .ap-review dl { grid-template-columns: 1fr; gap: 2px; } .ap-review dd { margin-bottom: 8px; } }
.ap-review dt { color: #8A8A99; }
.ap-review dd { margin: 0; white-space: pre-wrap; }
.ap-consent { display: flex; gap: 12px; align-items: flex-start; font-size: 14px; line-height: 1.55; margin: 20px 0 4px; cursor: pointer; color: #2A2A3C; }
.ap-consent input { width: 20px; height: 20px; margin-top: 1px; accent-color: ${M}; flex-shrink: 0; }
.ap-err { color: #B23A3A; font-size: 14px; margin: 16px 0 0; }
.ap-nav { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 34px; padding-top: 24px; border-top: 1px solid rgba(27,27,47,.08); }
.ap-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 52px; padding: 0 28px; border-radius: 2px; border: 1px solid ${M}; background: ${M}; color: #fff; font: 600 15px 'Work Sans', sans-serif; cursor: pointer; transition: background .15s; letter-spacing: .01em; }
.ap-btn:hover { background: #3A0A14; }
.ap-btn:disabled { opacity: .6; cursor: default; }
.ap-btn.ghost { background: transparent; color: ${M}; border-color: transparent; padding: 0 4px; }
.ap-btn.ghost:hover { background: transparent; text-decoration: underline; text-underline-offset: 3px; }
@media (max-width: 480px) { .ap-nav .ap-btn:not(.ghost) { flex: 1; } }
.ap-done { text-align: center; padding: 10px 0 0; }
.ap-done .tick { width: 68px; height: 68px; border-radius: 50%; background: ${M}; color: #fff; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 18px; }
.ap-done .refbox { display: inline-block; margin: 18px 0 4px; padding: 14px 26px; border: 1px solid rgba(27,27,47,.12); border-radius: 3px; background: #FAF7F5; }
.ap-done .refbox small { display: block; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #8A8A99; margin-bottom: 2px; }
.ap-done .refbox b { font-family: 'Fraunces', Georgia, serif; font-size: 28px; letter-spacing: .14em; color: ${M}; font-weight: 500; }
.ap-done .nt { font-family: 'Fraunces', Georgia, serif; font-size: 20px; margin: 30px 0 4px; }
.ap-next { text-align: left; margin: 0 auto; max-width: 440px; padding: 0; list-style: none; counter-reset: s; }
.ap-next li { counter-increment: s; display: flex; gap: 14px; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(27,27,47,.08); font-size: 15px; }
.ap-next li::before { content: counter(s, decimal-leading-zero); font-family: 'Fraunces', Georgia, serif; color: ${M}; font-size: 16px; width: 26px; }
.ap-foot { text-align: center; font-size: 13px; color: #8A8A99; margin-top: 24px; line-height: 1.8; }
.ap-foot a { color: ${M}; }
.ap-note { background: #FAF7F5; border-left: 3px solid ${M}; padding: 14px 16px; font-size: 14px; color: #4A4A5C; margin: 0 0 18px; line-height: 1.55; }
.ap-offer-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: ${M}; margin: 0 0 10px; font-weight: 600; }
.ap-loading { color: #8A8A99; margin: 0; }
`;

const fmtSlot = (iso, lang) => {
  const d = new Date(iso);
  const loc = lang === "fr" ? "fr-FR" : "en-GB";
  return {
    day: d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" }),
    time: d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" })
  };
};
const gradeLabel = (g, lang) => (g ? GRADE_LABEL[lang][g] || g : "");
const fmtDob = (d, lang) => (d ? new Date(d + "T12:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

export default function ApplyPage() {
  const params = new URLSearchParams(window.location.search);
  const [lang, setLang] = useState(params.get("lang") === "en" ? "en" : params.get("lang") === "fr" ? "fr" : (navigator.language || "").startsWith("fr") ? "fr" : "en");
  const [year, setYear] = useState("2027-2028");
  const t = T[lang];
  const offer = params.get("offer");
  useEffect(() => {
    document.title = `${t.admissions(year)} · BrightSteps International School`;
    document.documentElement.lang = lang;
  }, [lang, year]);
  const site = lang === "fr" ? "https://www.bischoolci.org/index-fr.html" : "https://www.bischoolci.org";
  return (
    <div className="ap">
      <style>{CSS}</style>
      <div className="ap-band">
        <div className="ap-top">
          <a className="ap-brand" href={site}>
            <img src="/logo.png" alt="" />
            <span><b>BrightSteps</b><small>International School</small></span>
          </a>
          <div className="ap-lang" role="group" aria-label="Language">
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
            <button className={lang === "fr" ? "on" : ""} onClick={() => setLang("fr")}>FR</button>
          </div>
        </div>
        <div className="ap-hero">
          <p className="ap-eyebrow">{t.admissions(year)}</p>
          <h1>{t.heroTitle}</h1>
          <p>{t.heroText}</p>
        </div>
      </div>
      <main className="ap-main">
        <div className="ap-card">
          {offer ? <Offer token={offer} t={t} lang={lang} /> : <ApplyFlow t={t} lang={lang} onYear={setYear} />}
        </div>
        <p className="ap-foot">
          {t.contact}<br />
          {t.privacy} <a href={lang === "fr" ? "https://www.bischoolci.org/privacy-policy-fr.html" : "https://www.bischoolci.org/privacy-policy.html"}>{t.privacyLink}</a>
        </p>
      </main>
    </div>
  );
}

function Field({ label, req, opt, hint, full, bad, children, t }) {
  return (
    <div className={`ap-f${full ? " full" : ""}${bad ? " bad" : ""}`}>
      <label>{label}{req && <em> *</em>}{opt && <i> ({t.optional})</i>}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function ApplyFlow({ t, lang, onYear }) {
  const [info, setInfo] = useState(null);
  const [kind, setKind] = useState(new URLSearchParams(window.location.search).get("visit") ? "visit" : "application");
  const [step, setStep] = useState(0);
  const [f, setF] = useState({});
  const [files, setFiles] = useState({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState([]);
  const [done, setDone] = useState(null);
  useEffect(() => {
    supabase.rpc("adm_public_info").then(({ data }) => {
      setInfo(data || { open: false });
      if (data?.school_year) onYear(data.school_year);
    });
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const txt = (k, type = "text", extra = {}) => <input type={type} value={f[k] || ""} onChange={set(k)} {...extra} />;
  const steps = kind === "application" ? t.stepsApply : t.stepsVisit;
  const last = steps.length - 1;
  const top = () => window.scrollTo({ top: 0, behavior: "smooth" });

  if (!info) return <p className="ap-loading">…</p>;
  if (!info.open) return <p className="lead" style={{ margin: 0 }}>{t.closed}</p>;

  if (done) {
    return (
      <div className="ap-done">
        <span className="tick"><Check size={34} /></span>
        <h2>{t.doneTitle}</h2>
        <p className="lead" style={{ margin: "0 auto", maxWidth: 470 }}>{done.stage === "waitlist" ? t.doneWait : kind === "visit" ? t.doneVisit : t.doneApply} {t.emailSent}</p>
        <div className="refbox"><small>{t.ref}</small><b>{done.ref}</b></div>
        <p className="nt">{t.nextTitle}</p>
        <ol className="ap-next">{t.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
      </div>
    );
  }

  const need = ({
    application: [["child_first_name", "child_last_name", "child_dob", "grade"], ["parent1_name", "parent1_email", "parent1_phone"], [], []],
    visit: [[], ["child_first_name", "grade", "parent1_name", "parent1_email", "parent1_phone"], []]
  }[kind][step]) || [];

  function go(n) {
    setErr("");
    if (n > step) {
      const miss = need.filter((k) => !String(f[k] || "").trim());
      setMissing(miss);
      if (miss.length) return setErr(t.required);
      if (need.includes("parent1_email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.parent1_email.trim())) { setMissing(["parent1_email"]); return setErr(t.emailBad); }
    }
    setMissing([]);
    setStep(n);
    top();
  }

  function choose(k) {
    setKind(k); setStep(0); setErr(""); setMissing([]);
  }

  async function submit() {
    setErr("");
    if (!consent) return setErr(t.consentNeeded);
    setBusy(true);
    try {
      const folder = `applications/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const documents = [];
      if (kind === "application") {
        for (const k of DOCS) {
          if (files[k]) {
            const up = await uploadAttachment(files[k], folder);
            documents.push({ kind: k, path: up.path, name: files[k].name });
          }
        }
      }
      const { data, error } = await supabase.rpc("adm_public_submit", { p: { ...f, kind, language: lang, documents } });
      if (error) throw error;
      supabase.functions.invoke("notify-admissions", { body: { id: data.id } }).catch(() => {});
      setDone(data);
      top();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const bad = (k) => missing.includes(k);
  const gradeSelect = (
    <select value={f.grade || ""} onChange={set("grade")}>
      <option value="">{t.select}</option>
      {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g, lang)}</option>)}
    </select>
  );
  const slotObj = info.slots.find((s) => s.id === f.visit_slot_id);

  let body = null;
  if (kind === "visit" && step === 0) {
    body = (
      <>
        <h2>{t.slot}</h2>
        <p className="lead">{t.visitHint}</p>
        {info.slots.length === 0 && <p className="ap-note">{t.noSlots}</p>}
        <div className="ap-slots">
          {info.slots.map((s) => {
            const x = fmtSlot(s.starts_at, lang);
            return (
              <button key={s.id} className={`ap-slot${f.visit_slot_id === s.id ? " on" : ""}`} onClick={() => setF({ ...f, visit_slot_id: s.id })}>
                <CalendarDays size={20} />
                <span><b>{x.day}</b>{x.time}{s.kind === "open_day" ? (lang === "fr" ? " · Portes ouvertes" : " · Open day") : ""}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (kind === "application" && step === 0) {
    body = (
      <>
        <h2>{t.stepsApply[0]}</h2>
        <p className="lead">{t.childLead}</p>
        <div className="ap-grid">
          <Field t={t} label={t.first} req bad={bad("child_first_name")}>{txt("child_first_name", "text", { autoComplete: "off" })}</Field>
          <Field t={t} label={t.last} req bad={bad("child_last_name")}>{txt("child_last_name", "text", { autoComplete: "off" })}</Field>
          <Field t={t} label={t.dob} req bad={bad("child_dob")}>{txt("child_dob", "date")}</Field>
          <Field t={t} label={t.gender}>
            <select value={f.child_gender || ""} onChange={set("child_gender")}>
              <option value="">{t.select}</option><option value="Female">{t.girl}</option><option value="Male">{t.boy}</option>
            </select>
          </Field>
          <Field t={t} label={t.grade} req bad={bad("grade")} full>{gradeSelect}</Field>
          <Field t={t} label={t.nationality}>{txt("child_nationality")}</Field>
          <Field t={t} label={t.languages}>{txt("languages")}</Field>
          <Field t={t} label={t.current} full>{txt("current_school")}</Field>
          <Field t={t} label={t.needs} opt hint={t.needsHint} full><textarea value={f.learning_needs || ""} onChange={set("learning_needs")} /></Field>
        </div>
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        <h2>{steps[1]}</h2>
        <p className="lead">{t.familyLead}</p>
        {kind === "visit" && (
          <>
            <h3>{t.child}</h3>
            <div className="ap-grid">
              <Field t={t} label={t.first} req bad={bad("child_first_name")}>{txt("child_first_name")}</Field>
              <Field t={t} label={t.grade} req bad={bad("grade")}>{gradeSelect}</Field>
            </div>
          </>
        )}
        <h3>{t.parent}</h3>
        <div className="ap-grid">
          <Field t={t} label={t.name} req bad={bad("parent1_name")}>{txt("parent1_name", "text", { autoComplete: "name" })}</Field>
          <Field t={t} label={t.relationship}>{txt("parent1_relationship", "text", { placeholder: lang === "fr" ? "Mère, père, tuteur…" : "Mother, father, guardian…" })}</Field>
          <Field t={t} label={t.email} req bad={bad("parent1_email")}>{txt("parent1_email", "email", { autoComplete: "email" })}</Field>
          <Field t={t} label={t.phone} req bad={bad("parent1_phone")}>{txt("parent1_phone", "tel", { autoComplete: "tel", placeholder: "+225" })}</Field>
        </div>
        {kind === "application" && (
          <>
            <h3>{t.parent2} <i>({t.optional})</i></h3>
            <div className="ap-grid">
              <Field t={t} label={t.name}>{txt("parent2_name")}</Field>
              <Field t={t} label={t.relationship}>{txt("parent2_relationship")}</Field>
              <Field t={t} label={t.email}>{txt("parent2_email", "email")}</Field>
              <Field t={t} label={t.phone}>{txt("parent2_phone", "tel", { placeholder: "+225" })}</Field>
              <Field t={t} label={t.address} full>{txt("home_address")}</Field>
            </div>
          </>
        )}
        <h3>{t.knowYou}</h3>
        <div className="ap-grid">
          <Field t={t} label={t.how}>
            <select value={f.source || ""} onChange={set("source")}>
              <option value="">{t.select}</option>
              {SOURCES[lang].map((s, i) => <option key={s} value={SOURCE_VALUES[i]}>{s}</option>)}
            </select>
          </Field>
          <Field t={t} label={t.referred} opt>{txt("referred_by")}</Field>
          <Field t={t} label={t.message} opt full><textarea value={f.parent_message || ""} onChange={set("parent_message")} /></Field>
        </div>
        <input type="text" value={f.website || ""} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
      </>
    );
  } else if (kind === "application" && step === 2) {
    body = (
      <>
        <h2>{t.docsTitle}</h2>
        <p className="lead">{t.docsText}</p>
        <div className="ap-docs">
          {DOCS.map((k) => (
            <label key={k} className={`ap-doc${files[k] ? " has" : ""}`}>
              <span className="ic">{files[k] ? <Check size={18} /> : <UploadCloud size={18} />}</span>
              <span style={{ minWidth: 0 }}>
                <b>{t.docLabels[k]}</b>
                <small>{files[k] ? files[k].name : t.upload}</small>
              </span>
              <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFiles({ ...files, [k]: e.target.files?.[0] })} />
            </label>
          ))}
        </div>
      </>
    );
  } else if (step === last) {
    const sec = (title, goto, rows) => (
      <div className="ap-review">
        <div className="ap-review-h"><b>{title}</b><button onClick={() => { setStep(goto); top(); }}>{t.edit}</button></div>
        <dl>{rows.filter(([, v]) => v).flatMap(([k, v]) => [<dt key={k + "-t"}>{k}</dt>, <dd key={k + "-d"}>{v}</dd>])}</dl>
      </div>
    );
    const slotText = slotObj ? `${fmtSlot(slotObj.starts_at, lang).day}, ${fmtSlot(slotObj.starts_at, lang).time}` : t.callYou;
    body = (
      <>
        <h2>{t.review}</h2>
        <p className="lead">{t.reviewLead}</p>
        {kind === "visit" && sec(t.stepsVisit[0], 0, [[t.stepsVisit[0], slotText]])}
        {sec(t.child, kind === "visit" ? 1 : 0, [
          [t.name, [f.child_first_name, f.child_last_name].filter(Boolean).join(" ")],
          [t.grade, gradeLabel(f.grade, lang)],
          [t.dob, fmtDob(f.child_dob, lang)],
          [t.current, f.current_school],
          [t.languages, f.languages]
        ])}
        {sec(t.parent, 1, [
          [t.name, f.parent1_name], [t.email, f.parent1_email], [t.phone, f.parent1_phone],
          [t.parent2, [f.parent2_name, f.parent2_phone].filter(Boolean).join(" · ")], [t.address, f.home_address]
        ])}
        {kind === "application" && sec(t.docsTitle, 2, DOCS.map((k) => [t.docLabels[k], files[k] ? files[k].name : "—"]))}
        <label className="ap-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>{t.consent}</span></label>
      </>
    );
  }

  return (
    <>
      {step === 0 && (
        <div className="ap-choices">
          <button className={`ap-choice${kind === "application" ? " on" : ""}`} onClick={() => choose("application")}>
            <GraduationCap size={22} /><div><b>{t.applyCard[0]}</b><span>{t.applyCard[1]}</span></div>
          </button>
          <button className={`ap-choice${kind === "visit" ? " on" : ""}`} onClick={() => choose("visit")}>
            <CalendarDays size={22} /><div><b>{t.visitCard[0]}</b><span>{t.visitCard[1]}</span></div>
          </button>
        </div>
      )}
      <ol className="ap-steps">
        {steps.map((s, i) => <li key={s} className={i === step ? "on" : i < step ? "done" : ""}><span>{i + 1}. {s}</span></li>)}
      </ol>
      {body}
      {err && <p className="ap-err">{err}</p>}
      <div className="ap-nav">
        {step > 0 ? <button className="ap-btn ghost" onClick={() => go(step - 1)}><ArrowLeft size={16} />{t.back}</button> : <span />}
        {step < last
          ? <button className="ap-btn" onClick={() => go(step + 1)}>{t.next}<ArrowRight size={16} /></button>
          : <button className="ap-btn" disabled={busy} onClick={submit}>{busy ? t.sending : kind === "visit" ? t.sendVisit : t.send}</button>}
      </div>
    </>
  );
}

function Offer({ token, t, lang }) {
  const [o, setO] = useState(undefined);
  const [name, setName] = useState("");
  const [result, setResult] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { supabase.rpc("adm_offer_get", { p_token: token }).then(({ data }) => setO(data || null)); }, [token]);
  if (o === undefined) return <p className="ap-loading">…</p>;
  if (result) {
    return (
      <div className="ap-done">
        <span className="tick"><Check size={34} /></span>
        <h2>{t.doneTitle}</h2>
        <p className="lead" style={{ margin: "0 auto", maxWidth: 470 }}>{result === "accepted" ? t.offerAccepted : t.offerDeclined}</p>
      </div>
    );
  }
  if (!o || o.stage !== "offered") return <p className="lead" style={{ margin: 0 }}>{t.offerGone}</p>;
  async function respond(accept) {
    setErr("");
    const { data, error } = await supabase.rpc("adm_offer_respond", { p_token: token, p_accept: accept, p_signed_by: name });
    if (error) return setErr(error.message);
    if (o.id) supabase.functions.invoke("notify-admissions", { body: { id: o.id } }).catch(() => {});
    setResult(data);
  }
  const exp = o.expires ? new Date(o.expires + "T12:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <>
      <p className="ap-offer-eyebrow"><FileText size={14} /> {t.offerEyebrow}</p>
      <h2>{t.offerTitle(o.child)}</h2>
      <p className="lead">{t.offerBody(o.child, gradeLabel(o.grade, lang), o.school_year)} {exp && t.offerExpires(exp)}</p>
      {o.fee && <p className="ap-note">{t.fee(o.fee)}</p>}
      <div className="ap-f"><label>{t.sign}<em> *</em></label><input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
      {err && <p className="ap-err">{err}</p>}
      <div className="ap-nav">
        <button className="ap-btn ghost" onClick={() => respond(false)}>{t.decline}</button>
        <button className="ap-btn" onClick={() => respond(true)}>{t.accept}<Check size={16} /></button>
      </div>
    </>
  );
}

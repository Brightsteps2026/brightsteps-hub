import { useEffect, useMemo, useState } from "react";
import { HeartPulse } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";

export { HeartPulse as IncidentsIcon };

const T = {
  title: { en: "Incidents", fr: "Incidents" },
  newEntry: { en: "New entry", fr: "Nouvelle entrée" },
  back: { en: "Back", fr: "Retour" },
  cancel: { en: "Cancel", fr: "Annuler" },
  loading: { en: "Loading…", fr: "Chargement…" },
  loadError: { en: "Couldn't load incidents:", fr: "Impossible de charger les incidents :" },
  errorPrefix: { en: "Couldn't save:", fr: "Échec de l'enregistrement :" },
  noAccess: { en: "Incident reports are only available to teachers, admins, and parents.", fr: "Les rapports d'incident sont réservés aux enseignants, à la direction et aux parents." },
  whatRecording: { en: "What are you recording?", fr: "Que signalez-vous ?" },
  typeIncident: { en: "Incident at school", fr: "Incident à l'école" },
  typeArrival: { en: "Mark seen at drop-off", fr: "Marque constatée à l'arrivée" },
  typeConcern: { en: "Concern for DSL", fr: "Signalement au DSL" },
  dropoff: { en: "Drop-off", fr: "Arrivée" },
  student: { en: "Student", fr: "Élève" },
  searchStudent: { en: "Search a student", fr: "Rechercher un élève" },
  noStudent: { en: "No student found.", fr: "Aucun élève trouvé." },
  change: { en: "Change", fr: "Changer" },
  when: { en: "Date and time", fr: "Date et heure" },
  where: { en: "Where", fr: "Lieu" },
  choose: { en: "Choose…", fr: "Choisir…" },
  whereOther: { en: "Describe the place", fr: "Précisez le lieu" },
  cause: { en: "Cause", fr: "Cause" },
  flags: { en: "Tick any that apply", fr: "Cochez si applicable" },
  head_face: { en: "Head or face", fr: "Tête ou visage" },
  bite: { en: "Bite", fr: "Morsure" },
  bleeding: { en: "Bleeding", fr: "Saignement" },
  level: { en: "Level", fr: "Niveau" },
  l1: { en: "Minor", fr: "Mineur" },
  l2: { en: "Moderate", fr: "Modéré" },
  l3: { en: "Serious", fr: "Grave" },
  l1do: { en: "Give first aid, then tell the parent in person at pickup. Let the Director know before the end of the day.", fr: "Premiers soins, puis informer le parent en personne à la sortie. Prévenir la Directrice avant la fin de la journée." },
  l2do: { en: "Tell the Director now. Call the parent before pickup. The parent signs at pickup.", fr: "Prévenir la Directrice maintenant. Appeler le parent avant la sortie. Le parent signe à la sortie." },
  l3do: { en: "Call the parent now. Take the child to the clinic if needed. Tell the Director and Patrick (DSL). Full report within 24 hours.", fr: "Appeler le parent maintenant. Emmener l'enfant à la clinique si besoin. Prévenir la Directrice et Patrick (DSL). Rapport complet sous 24 heures." },
  locked: { en: "Level 2 minimum because of what you ticked.", fr: "Niveau 2 minimum en raison de vos choix." },
  unknownHint: { en: "If you can't explain how this happened, it may be a safeguarding concern.", fr: "Si vous ne pouvez pas expliquer ce qui s'est passé, il peut s'agir d'un signalement." },
  switchConcern: { en: "Send to DSL instead", fr: "Transmettre au DSL" },
  description: { en: "What happened", fr: "Ce qui s'est passé" },
  markNoticed: { en: "The mark you noticed", fr: "La marque constatée" },
  firstAid: { en: "First aid and follow-up", fr: "Premiers soins et suivi" },
  witnesses: { en: "Witnesses", fr: "Témoins" },
  parentExplanation: { en: "Parent's explanation", fr: "Explication du parent" },
  arrivalHint: { en: "Ask the parent at drop-off and write down what they say. If the mark is unexplained or doesn't match, send it to the DSL instead.", fr: "Demandez au parent à l'arrivée et notez sa réponse. Si la marque est inexpliquée ou ne correspond pas, transmettez au DSL." },
  concernText: { en: "Your concern", fr: "Votre inquiétude" },
  concernHint: { en: "Only Patrick (DSL) and the Director can read this. It does not go into the incident log, and parents never see it.", fr: "Seuls Patrick (DSL) et la Directrice peuvent lire ceci. Ce n'est pas inscrit au registre et les parents ne le voient jamais." },
  alreadyTold: { en: "The parent has already been told", fr: "Le parent a déjà été informé" },
  informedBy: { en: "Told by", fr: "Informé par" },
  how: { en: "How", fr: "Comment" },
  in_person: { en: "In person", fr: "En personne" },
  phone: { en: "By phone", fr: "Par téléphone" },
  message: { en: "By message", fr: "Par message" },
  save: { en: "Save entry", fr: "Enregistrer" },
  saving: { en: "Saving…", fr: "Enregistrement…" },
  sendConcern: { en: "Send to DSL", fr: "Transmettre au DSL" },
  sent: { en: "Sent to the DSL.", fr: "Transmis au DSL." },
  savedMsg: { en: "Entry saved.", fr: "Entrée enregistrée." },
  required: { en: "Fill in the fields marked *.", fr: "Remplissez les champs marqués *." },
  pickStudent: { en: "Choose a student first.", fr: "Choisissez d'abord un élève." },
  statusArrival: { en: "Noted at drop-off", fr: "Noté à l'arrivée" },
  statusNotInformed: { en: "Parent not yet told", fr: "Parent pas encore informé" },
  statusAwaitingSig: { en: "Awaiting signature", fr: "En attente de signature" },
  statusReportDue: { en: "Full report due", fr: "Rapport complet à rendre" },
  statusOverdue: { en: "Full report overdue", fr: "Rapport complet en retard" },
  statusComplete: { en: "Complete", fr: "Terminé" },
  statusNew: { en: "New", fr: "Nouveau" },
  filterAll: { en: "All", fr: "Tout" },
  filterAction: { en: "Needs action", fr: "À traiter" },
  sumNew: { en: "New", fr: "Nouveaux" },
  sumNotTold: { en: "Parent not told", fr: "Parent non informé" },
  sumSig: { en: "Awaiting signature", fr: "À signer" },
  sumReport: { en: "Report due", fr: "Rapport à rendre" },
  empty: { en: "No entries yet. Use New entry to record one.", fr: "Aucune entrée. Utilisez Nouvelle entrée pour en ajouter une." },
  emptyAction: { en: "Nothing needs action right now.", fr: "Rien à traiter pour le moment." },
  loggedBy: { en: "Logged by", fr: "Saisi par" },
  markAsSeen: { en: "Mark as seen", fr: "Marquer comme vu" },
  seen: { en: "Seen by the Director", fr: "Vu par la Directrice" },
  recordTold: { en: "Record that the parent was told", fr: "Indiquer que le parent a été informé" },
  saveTold: { en: "Save", fr: "Enregistrer" },
  signNow: { en: "Parent signs now", fr: "Le parent signe maintenant" },
  signHint: { en: "Hand the phone to the parent. Typing their full name counts as their signature.", fr: "Donnez le téléphone au parent. Saisir son nom complet vaut signature." },
  typeName: { en: "Parent's full name", fr: "Nom complet du parent" },
  typeNameFirst: { en: "Type the full name first.", fr: "Saisissez d'abord le nom complet." },
  confirmSig: { en: "Confirm signature", fr: "Confirmer la signature" },
  signedBy: { en: "Signed by", fr: "Signé par" },
  fullReport: { en: "Full report", fr: "Rapport complet" },
  saveReport: { en: "Save report", fr: "Enregistrer le rapport" },
  edit: { en: "Edit", fr: "Modifier" },
  concerns: { en: "DSL concerns", fr: "Signalements DSL" },
  concernsEmpty: { en: "No concerns recorded.", fr: "Aucun signalement." },
  open: { en: "Open", fr: "Ouvert" },
  closed: { en: "Closed", fr: "Clos" },
  dslNotes: { en: "DSL notes", fr: "Notes du DSL" },
  saveNotes: { en: "Save notes", fr: "Enregistrer les notes" },
  closeConcern: { en: "Close concern", fr: "Clore" },
  reopen: { en: "Reopen", fr: "Rouvrir" },
  showClosed: { en: "Show closed", fr: "Afficher les clos" },
  parentEmpty: { en: "Nothing to report. If anything happens at school, we will tell you first.", fr: "Rien à signaler. Si quelque chose arrive à l'école, nous vous prévenons d'abord." },
  parentSignHint: { en: "Type your full name to confirm you have been told about this incident. This counts as your signature.", fr: "Saisissez votre nom complet pour confirmer avoir été informé de cet incident. Cela vaut signature." },
  sign: { en: "Sign", fr: "Signer" },
  signed: { en: "Signed", fr: "Signé" },
  toldBy: { en: "Told by", fr: "Informé par" },
  whatWeDid: { en: "What we did", fr: "Ce que nous avons fait" },
  loc_classroom: { en: "Classroom", fr: "Salle de classe" },
  loc_playground: { en: "Playground", fr: "Cour de récréation" },
  loc_cafeteria: { en: "Cafeteria", fr: "Cantine" },
  loc_school_bus: { en: "School bus", fr: "Bus scolaire" },
  loc_pe_area: { en: "PE and sports area", fr: "Terrain de sport (EPS)" },
  loc_toilets: { en: "Toilets", fr: "Toilettes" },
  loc_corridor: { en: "Corridor or stairs", fr: "Couloir ou escaliers" },
  loc_entrance: { en: "Entrance or gate", fr: "Entrée ou portail" },
  loc_school_trip: { en: "School trip", fr: "Sortie scolaire" },
  loc_other: { en: "Other", fr: "Autre" },
  cause_self: { en: "The student themselves", fr: "L'élève lui-même" },
  cause_other_child: { en: "Another child", fr: "Un autre enfant" },
  cause_equipment: { en: "Equipment or object", fr: "Matériel ou objet" },
  cause_unknown: { en: "Not known", fr: "Inconnu" }
};

const LOCATIONS = ["classroom", "playground", "cafeteria", "school_bus", "pe_area", "toilets", "corridor", "entrance", "school_trip", "other"];
const CAUSES = ["self", "other_child", "equipment", "unknown"];
const METHODS = ["in_person", "phone", "message"];

const BURGUNDY = "#801524";
const LINE = "#EAD7DA";
const MUTED = "#6E7B7D";
const TONES = {
  ok: { bg: "#E6F2EC", fg: "#2F7A5C" },
  warn: { bg: "#FBF0DC", fg: "#8A5A0B" },
  danger: { bg: "#FCE8E8", fg: "#B23A3A" },
  info: { bg: "#F5E4E6", fg: BURGUNDY },
  muted: { bg: "#F1EFEF", fg: "#5F5E5A" }
};
const LEVEL_TONE = { 1: TONES.ok, 2: TONES.warn, 3: TONES.danger };

const wrap = { padding: "16px 16px 90px" };
const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: "0 1px 3px rgba(36,16,18,0.06)" };
const chip = { border: `1px solid ${LINE}`, borderRadius: 100, padding: "7px 13px", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#3B4A4C" };
const chipOn = { ...chip, background: BURGUNDY, borderColor: BURGUNDY, color: "#fff" };
const primaryBtn = { background: BURGUNDY, color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%" };
const secondaryBtn = { ...chip, borderRadius: 10, padding: "9px 14px" };
const input = { width: "100%", padding: "9px 10px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, background: "#FCFAF4", boxSizing: "border-box", fontFamily: "inherit" };
const label = { display: "block", fontSize: 13, color: MUTED, margin: "12px 0 5px" };
const meta = { margin: "0 0 8px", fontSize: 13, color: MUTED };
const heading = { margin: "0 0 12px", fontSize: 18, fontWeight: 600 };

function toLocalInput(value) {
  const d = value ? new Date(value) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function fmt(iso, locale) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isEscalated(f) {
  return !!(f.head_face || f.bite || f.bleeding || f.cause === "other_child");
}

function hoursLeft(inc) {
  const due = new Date(inc.created_at).getTime() + 24 * 3600 * 1000;
  return Math.round((due - Date.now()) / 3600000);
}

function statusOf(inc) {
  if (inc.entry_type === "arrival") return { key: "statusArrival", tone: TONES.muted };
  if (!inc.parent_informed_at) return { key: "statusNotInformed", tone: TONES.warn };
  if (inc.level === 3 && !inc.full_report) {
    return hoursLeft(inc) < 0 ? { key: "statusOverdue", tone: TONES.danger } : { key: "statusReportDue", tone: TONES.warn };
  }
  if (!inc.parent_signed_at) return { key: "statusAwaitingSig", tone: TONES.info };
  return { key: "statusComplete", tone: TONES.ok };
}

function needsAction(inc, isAdmin) {
  if (isAdmin && !inc.admin_seen_at) return true;
  const k = statusOf(inc).key;
  return k !== "statusComplete" && k !== "statusArrival";
}

function placeLabel(inc, tr) {
  if (inc.location === "other" && inc.location_other) return inc.location_other;
  return tr(`loc_${inc.location}`);
}

function Pill({ tone, children }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 100, background: tone.bg, color: tone.fg, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function LevelPill({ inc, tr }) {
  if (inc.entry_type === "arrival") return <Pill tone={TONES.muted}>{tr("dropoff")}</Pill>;
  return <Pill tone={LEVEL_TONE[inc.level] || TONES.muted}>{tr("level")} {inc.level} · {tr(`l${inc.level}`)}</Pill>;
}

function Field({ name, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: "0 0 2px", fontSize: 12, color: MUTED }}>{name}</p>
      <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap" }}>{value}</p>
    </div>
  );
}

export default function IncidentsTab({ profile }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  const locale = fr ? "fr-FR" : "en-GB";
  const tr = (k) => (T[k] ? T[k][fr ? "fr" : "en"] : k);
  const role = profile?.role;

  if (role === "parent") return <ParentView tr={tr} locale={locale} />;
  if (role === "admin" || role === "teacher") return <StaffView profile={profile} tr={tr} locale={locale} />;
  return <div style={wrap}><div style={card}>{tr("noAccess")}</div></div>;
}

function ParentView({ tr, locale }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingId, setSigningId] = useState(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.rpc("my_child_incidents");
    if (err) { setError(err.message); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function sign(id) {
    if (!name.trim()) { setStatus(tr("typeNameFirst")); return; }
    setBusy(true);
    setStatus("");
    const { error: err } = await supabase.rpc("sign_incident", { p_incident: id, p_name: name.trim(), p_signature: name.trim() });
    setBusy(false);
    if (err) { setStatus(`${tr("errorPrefix")} ${err.message}`); return; }
    setSigningId(null);
    setName("");
    load();
  }

  if (loading) return <div style={wrap}><div style={card}>{tr("loading")}</div></div>;
  if (error) return <div style={wrap}><div style={card}>{tr("loadError")} {error}</div></div>;

  return (
    <div style={wrap}>
      <h2 style={heading}>{tr("title")}</h2>
      {rows.length === 0 && (
        <div style={card}><p style={{ margin: 0, fontSize: 14, color: MUTED }}>{tr("parentEmpty")}</p></div>
      )}
      {rows.map((r) => (
        <div key={r.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <strong style={{ fontSize: 15 }}>{r.student_name}</strong>
            <LevelPill inc={{ ...r, entry_type: "incident" }} tr={tr} />
          </div>
          <p style={meta}>{fmt(r.occurred_at, locale)} · {placeLabel(r, tr)}</p>
          <Field name={tr("description")} value={r.description} />
          <Field name={tr("whatWeDid")} value={r.first_aid} />
          <p style={meta}>
            {tr("toldBy")} {r.parent_informed_by || "—"}
            {r.parent_informed_method ? ` (${tr(r.parent_informed_method).toLowerCase()})` : ""}
          </p>
          {r.parent_signed_at ? (
            <Pill tone={TONES.ok}>{tr("signed")} · {r.parent_signed_name} · {fmt(r.parent_signed_at, locale)}</Pill>
          ) : signingId === r.id ? (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 8px" }}>{tr("parentSignHint")}</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("typeName")} style={{ ...input, fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 10 }} />
              <button style={primaryBtn} disabled={busy} onClick={() => sign(r.id)}>{busy ? tr("saving") : tr("confirmSig")}</button>
              {status && <p style={{ fontSize: 13, marginTop: 8, color: TONES.danger.fg }}>{status}</p>}
            </div>
          ) : (
            <button style={{ ...primaryBtn, marginTop: 6 }} onClick={() => { setSigningId(r.id); setName(""); setStatus(""); }}>{tr("sign")}</button>
          )}
        </div>
      ))}
    </div>
  );
}

function StaffView({ profile, tr, locale }) {
  const isAdmin = profile?.role === "admin";
  const [students, setStudents] = useState([]);
  const [names, setNames] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [startType, setStartType] = useState("incident");
  const [filter, setFilter] = useState(isAdmin ? "action" : "all");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const [s, n, i] = await Promise.all([
      supabase.rpc("incident_students"),
      supabase.rpc("incident_staff_names"),
      supabase.from("incidents").select("*").order("occurred_at", { ascending: false }).limit(500)
    ]);
    const err = s.error || n.error || i.error;
    if (err) { setError(err.message); setLoading(false); return; }
    let c = { data: [] };
    if (isAdmin) {
      c = await supabase.from("safeguarding_concerns").select("*").order("created_at", { ascending: false });
      if (c.error) { setError(c.error.message); setLoading(false); return; }
    }
    setStudents(s.data || []);
    setNames(Object.fromEntries((n.data || []).map((x) => [x.id, x.full_name])));
    setIncidents(i.data || []);
    setConcerns(c.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const selected = incidents.find((x) => x.id === selectedId) || null;

  function finish(message) {
    setNotice(message || "");
    setView(selectedId ? "detail" : "list");
    load();
  }

  if (loading && incidents.length === 0) return <div style={wrap}><div style={card}>{tr("loading")}</div></div>;
  if (error) return <div style={wrap}><div style={card}>{tr("loadError")} {error}</div></div>;

  if (view === "new" || view === "edit") {
    return (
      <div style={wrap}>
        <EntryForm
          students={students}
          profile={profile}
          initial={view === "edit" ? selected : null}
          startType={startType}
          tr={tr}
          onCancel={() => setView(view === "edit" ? "detail" : "list")}
          onSaved={(msg) => { if (view === "new") setSelectedId(null); finish(msg); }}
        />
      </div>
    );
  }

  if (view === "detail" && selected) {
    return (
      <div style={wrap}>
        <IncidentDetail
          inc={selected}
          student={studentById[selected.student_id]}
          names={names}
          isAdmin={isAdmin}
          profile={profile}
          tr={tr}
          locale={locale}
          onBack={() => { setSelectedId(null); setView("list"); setNotice(""); }}
          onEdit={() => setView("edit")}
          reload={load}
        />
      </div>
    );
  }

  const shown = filter === "action" ? incidents.filter((x) => needsAction(x, isAdmin)) : incidents;
  const counts = {
    sumNew: incidents.filter((x) => !x.admin_seen_at).length,
    sumNotTold: incidents.filter((x) => x.entry_type === "incident" && !x.parent_informed_at).length,
    sumSig: incidents.filter((x) => x.entry_type === "incident" && x.parent_informed_at && !x.parent_signed_at).length,
    sumReport: incidents.filter((x) => x.level === 3 && !x.full_report).length
  };

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ ...heading, margin: 0 }}>{tr("title")}</h2>
        <button style={{ ...primaryBtn, width: "auto" }} onClick={() => { setStartType("incident"); setSelectedId(null); setNotice(""); setView("new"); }}>
          {tr("newEntry")}
        </button>
      </div>

      {notice && <p style={{ ...card, padding: "10px 14px", fontSize: 14, color: TONES.ok.fg, background: TONES.ok.bg, borderColor: TONES.ok.bg }}>{notice}</p>}

      {isAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
          {Object.entries(counts).map(([k, n]) => (
            <div key={k} style={{ background: n > 0 ? TONES.info.bg : "#F7F3F3", borderRadius: 12, padding: "10px 12px" }}>
              <p style={{ margin: 0, fontSize: 12, color: n > 0 ? BURGUNDY : MUTED }}>{tr(k)}</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: n > 0 ? BURGUNDY : "#3B4A4C" }}>{n}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        <button style={filter === "action" ? chipOn : chip} onClick={() => setFilter("action")}>{tr("filterAction")}</button>
        <button style={filter === "all" ? chipOn : chip} onClick={() => setFilter("all")}>{tr("filterAll")}</button>
      </div>

      <div style={card}>
        {shown.length === 0 && (
          <p style={{ margin: 0, fontSize: 14, color: MUTED }}>{filter === "action" ? tr("emptyAction") : tr("empty")}</p>
        )}
        {shown.map((inc, idx) => {
          const st = studentById[inc.student_id];
          const status = statusOf(inc);
          return (
            <button
              key={inc.id}
              onClick={() => { setSelectedId(inc.id); setNotice(""); setView("detail"); }}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderTop: idx === 0 ? "none" : `1px solid ${LINE}`, padding: "10px 0", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {st?.full_name || "—"}
                  <span style={{ fontWeight: 400, color: MUTED, marginLeft: 6, fontSize: 13 }}>{st?.grade}</span>
                </span>
                <LevelPill inc={inc} tr={tr} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <span style={{ fontSize: 13, color: MUTED }}>{fmt(inc.occurred_at, locale)} · {placeLabel(inc, tr)}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  {isAdmin && !inc.admin_seen_at && <Pill tone={TONES.danger}>{tr("statusNew")}</Pill>}
                  <Pill tone={status.tone}>{tr(status.key)}</Pill>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {isAdmin && <ConcernsCard concerns={concerns} studentById={studentById} names={names} tr={tr} locale={locale} reload={load} />}
    </div>
  );
}

function EntryForm({ students, profile, initial, startType, tr, onCancel, onSaved }) {
  const editing = !!initial;
  const myId = profile?.id;
  const [type, setType] = useState(initial ? initial.entry_type : startType);
  const [studentId, setStudentId] = useState(initial ? initial.student_id : null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState(() => ({
    occurred_at: toLocalInput(initial ? initial.occurred_at : null),
    location: initial ? initial.location : "",
    location_other: initial?.location_other || "",
    cause: initial?.cause || "",
    head_face: !!initial?.head_face,
    bite: !!initial?.bite,
    bleeding: !!initial?.bleeding,
    level: initial?.level || 0,
    description: initial?.description || "",
    first_aid: initial?.first_aid || "",
    witnesses: initial?.witnesses || "",
    parent_explanation: initial?.parent_explanation || "",
    told: false,
    informed_by: profile?.full_name || "",
    method: "in_person"
  }));

  function set(key, value) {
    setErr("");
    setF((prev) => {
      const next = { ...prev, [key]: value };
      if (isEscalated(next) && next.level === 1) next.level = 2;
      return next;
    });
  }

  function switchType(next) {
    setErr("");
    setType(next);
    if (next === "arrival" && !f.location) set("location", "entrance");
  }

  const escalated = isEscalated(f);
  const term = search.trim().toLowerCase();
  const homeroom = students.filter((s) => s.home_teacher_id === myId);
  const pool = term ? students.filter((s) => (s.full_name || "").toLowerCase().includes(term)) : (homeroom.length ? homeroom : students);
  const picked = students.find((s) => s.id === studentId);

  async function save() {
    setErr("");
    if (!studentId) { setErr(tr("pickStudent")); return; }
    const when = new Date(f.occurred_at).toISOString();

    if (type === "concern") {
      if (!f.description.trim()) { setErr(tr("required")); return; }
      setBusy(true);
      const { error } = await supabase.from("safeguarding_concerns").insert({
        student_id: studentId,
        observed_at: when,
        concern: f.description.trim(),
        parent_explanation: f.parent_explanation.trim() || null
      });
      setBusy(false);
      if (error) { setErr(`${tr("errorPrefix")} ${error.message}`); return; }
      onSaved(tr("sent"));
      return;
    }

    const missing =
      !f.description.trim() ||
      !f.location ||
      (f.location === "other" && !f.location_other.trim()) ||
      (type === "incident" && (!f.cause || !f.level)) ||
      (type === "arrival" && !f.parent_explanation.trim()) ||
      (!editing && type === "incident" && f.told && !f.informed_by.trim());
    if (missing) { setErr(tr("required")); return; }

    const isInc = type === "incident";
    const row = {
      student_id: studentId,
      entry_type: type,
      occurred_at: when,
      location: f.location,
      location_other: f.location === "other" ? f.location_other.trim() : null,
      cause: isInc ? f.cause : null,
      head_face: isInc && f.head_face,
      bite: isInc && f.bite,
      bleeding: isInc && f.bleeding,
      level: isInc ? f.level : null,
      description: f.description.trim(),
      first_aid: f.first_aid.trim() || null,
      witnesses: isInc ? f.witnesses.trim() || null : null,
      parent_explanation: f.parent_explanation.trim() || null
    };
    if (!editing && isInc && f.told) {
      row.parent_informed_by = f.informed_by.trim();
      row.parent_informed_method = f.method;
      row.parent_informed_at = new Date().toISOString();
    }

    setBusy(true);
    const { error } = editing
      ? await supabase.from("incidents").update(row).eq("id", initial.id)
      : await supabase.from("incidents").insert(row);
    setBusy(false);
    if (error) { setErr(`${tr("errorPrefix")} ${error.message}`); return; }
    onSaved(tr("savedMsg"));
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ ...heading, margin: 0 }}>{editing ? tr("edit") : tr("newEntry")}</h2>
        <button style={secondaryBtn} onClick={onCancel}>{tr("cancel")}</button>
      </div>

      {!editing && (
        <>
          <span style={label}>{tr("whatRecording")}</span>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {[["incident", "typeIncident"], ["arrival", "typeArrival"], ["concern", "typeConcern"]].map(([k, lk]) => (
              <button key={k} style={type === k ? chipOn : chip} onClick={() => switchType(k)}>{tr(lk)}</button>
            ))}
          </div>
        </>
      )}

      {type === "concern" && (
        <p style={{ fontSize: 13, background: TONES.warn.bg, color: TONES.warn.fg, borderRadius: 8, padding: "9px 11px", margin: "12px 0 0" }}>{tr("concernHint")}</p>
      )}
      {type === "arrival" && (
        <p style={{ fontSize: 13, background: TONES.info.bg, color: TONES.info.fg, borderRadius: 8, padding: "9px 11px", margin: "12px 0 0" }}>{tr("arrivalHint")}</p>
      )}

      <span style={label}>{tr("student")} *</span>
      {picked ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 10px", border: `1px solid ${LINE}`, borderRadius: 8 }}>
          <span style={{ fontSize: 14 }}><strong>{picked.full_name}</strong> <span style={{ color: MUTED }}>{picked.grade}</span></span>
          {!editing && <button style={{ ...chip, padding: "4px 10px" }} onClick={() => setStudentId(null)}>{tr("change")}</button>}
        </div>
      ) : (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("searchStudent")} style={{ ...input, marginBottom: 8 }} />
          <div style={{ maxHeight: 180, overflowY: "auto", border: `1px solid ${LINE}`, borderRadius: 8 }}>
            {pool.slice(0, 60).map((s) => (
              <div key={s.id} onClick={() => { setStudentId(s.id); setErr(""); }} style={{ padding: "8px 10px", cursor: "pointer", fontSize: 14, borderBottom: "1px solid #F4EFEF" }}>
                {s.full_name}<span style={{ color: "#8A9698", marginLeft: 8, fontSize: 13 }}>{s.grade}</span>
              </div>
            ))}
            {pool.length === 0 && <div style={{ padding: 10, color: "#8A9698", fontSize: 14 }}>{tr("noStudent")}</div>}
          </div>
        </>
      )}

      <span style={label}>{tr("when")} *</span>
      <input type="datetime-local" value={f.occurred_at} onChange={(e) => set("occurred_at", e.target.value)} style={input} />

      {type !== "concern" && (
        <>
          <span style={label}>{tr("where")} *</span>
          <select value={f.location} onChange={(e) => set("location", e.target.value)} style={input}>
            <option value="">{tr("choose")}</option>
            {LOCATIONS.map((l) => <option key={l} value={l}>{tr(`loc_${l}`)}</option>)}
          </select>
          {f.location === "other" && (
            <input value={f.location_other} onChange={(e) => set("location_other", e.target.value)} placeholder={tr("whereOther")} style={{ ...input, marginTop: 8 }} />
          )}
        </>
      )}

      {type === "incident" && (
        <>
          <span style={label}>{tr("cause")} *</span>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {CAUSES.map((c) => (
              <button key={c} style={f.cause === c ? chipOn : chip} onClick={() => set("cause", c)}>{tr(`cause_${c}`)}</button>
            ))}
          </div>
          {f.cause === "unknown" && (
            <div style={{ fontSize: 13, background: TONES.warn.bg, color: TONES.warn.fg, borderRadius: 8, padding: "9px 11px", marginTop: 10 }}>
              {tr("unknownHint")}{" "}
              <button style={{ ...chip, padding: "3px 10px", marginLeft: 4 }} onClick={() => switchType("concern")}>{tr("switchConcern")}</button>
            </div>
          )}

          <span style={label}>{tr("flags")}</span>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 14 }}>
            {["head_face", "bite", "bleeding"].map((k) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} /> {tr(k)}
              </label>
            ))}
          </div>

          <span style={label}>{tr("level")} *</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {[1, 2, 3].map((n) => {
              const locked = escalated && n === 1;
              const on = f.level === n;
              return (
                <button
                  key={n}
                  disabled={locked}
                  onClick={() => set("level", n)}
                  style={{ textAlign: "left", padding: 10, borderRadius: 10, cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.4 : 1, background: "#fff", border: on ? `2px solid ${BURGUNDY}` : `1px solid ${LINE}`, fontFamily: "inherit" }}
                >
                  <Pill tone={LEVEL_TONE[n]}>{tr("level")} {n}</Pill>
                  <span style={{ display: "block", fontSize: 14, marginTop: 6, color: "#241012" }}>{tr(`l${n}`)}</span>
                </button>
              );
            })}
          </div>
          {escalated && <p style={{ fontSize: 13, color: TONES.warn.fg, margin: "8px 0 0" }}>{tr("locked")}</p>}
          {f.level > 0 && (
            <p style={{ fontSize: 13, background: LEVEL_TONE[f.level].bg, color: LEVEL_TONE[f.level].fg, borderRadius: 8, padding: "9px 11px", margin: "10px 0 0" }}>{tr(`l${f.level}do`)}</p>
          )}
        </>
      )}

      <span style={label}>{type === "concern" ? tr("concernText") : type === "arrival" ? tr("markNoticed") : tr("description")} *</span>
      <textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} style={input} />

      {(type === "arrival" || type === "concern") && (
        <>
          <span style={label}>{tr("parentExplanation")}{type === "arrival" ? " *" : ""}</span>
          <textarea rows={2} value={f.parent_explanation} onChange={(e) => set("parent_explanation", e.target.value)} style={input} />
        </>
      )}

      {type !== "concern" && (
        <>
          <span style={label}>{tr("firstAid")}</span>
          <textarea rows={2} value={f.first_aid} onChange={(e) => set("first_aid", e.target.value)} style={input} />
        </>
      )}

      {type === "incident" && (
        <>
          <span style={label}>{tr("witnesses")}</span>
          <input value={f.witnesses} onChange={(e) => set("witnesses", e.target.value)} style={input} />

          {!editing && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={f.told} onChange={(e) => set("told", e.target.checked)} /> {tr("alreadyTold")}
              </label>
              {f.told && (
                <div style={{ marginTop: 4 }}>
                  <span style={label}>{tr("informedBy")} *</span>
                  <input value={f.informed_by} onChange={(e) => set("informed_by", e.target.value)} style={input} />
                  <span style={label}>{tr("how")}</span>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {METHODS.map((m) => <button key={m} style={f.method === m ? chipOn : chip} onClick={() => set("method", m)}>{tr(m)}</button>)}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {err && <p style={{ fontSize: 13, color: TONES.danger.fg, margin: "12px 0 0" }}>{err}</p>}
      <button style={{ ...primaryBtn, marginTop: 16 }} disabled={busy} onClick={save}>
        {busy ? tr("saving") : type === "concern" ? tr("sendConcern") : tr("save")}
      </button>
    </div>
  );
}

function IncidentDetail({ inc, student, names, isAdmin, profile, tr, locale, onBack, onEdit, reload }) {
  const [toldBy, setToldBy] = useState(profile?.full_name || "");
  const [method, setMethod] = useState("in_person");
  const [signing, setSigning] = useState(false);
  const [sigName, setSigName] = useState("");
  const [report, setReport] = useState(inc.full_report || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setReport(inc.full_report || ""); }, [inc.id, inc.full_report]);

  async function run(fn) {
    setBusy(true);
    setMsg("");
    const { error } = await fn();
    setBusy(false);
    if (error) { setMsg(`${tr("errorPrefix")} ${error.message}`); return false; }
    await reload();
    return true;
  }

  const markSeen = () => run(() => supabase.from("incidents").update({ admin_seen_at: new Date().toISOString(), admin_seen_by: profile.id }).eq("id", inc.id));
  const saveTold = () => {
    if (!toldBy.trim()) { setMsg(tr("required")); return; }
    run(() => supabase.from("incidents").update({ parent_informed_by: toldBy.trim(), parent_informed_method: method, parent_informed_at: new Date().toISOString() }).eq("id", inc.id));
  };
  const saveSig = async () => {
    if (!sigName.trim()) { setMsg(tr("typeNameFirst")); return; }
    const ok = await run(() => supabase.from("incidents").update({ parent_signed_name: sigName.trim(), parent_signature: sigName.trim(), parent_signed_at: new Date().toISOString() }).eq("id", inc.id));
    if (ok) { setSigning(false); setSigName(""); }
  };
  const saveReport = () => {
    if (!report.trim()) { setMsg(tr("required")); return; }
    run(() => supabase.rpc("add_incident_report", { p_incident: inc.id, p_report: report.trim() }));
  };

  const isInc = inc.entry_type === "incident";
  const status = statusOf(inc);
  const flags = ["head_face", "bite", "bleeding"].filter((k) => inc[k]).map((k) => tr(k)).join(", ");

  return (
    <>
      <button style={{ ...secondaryBtn, marginBottom: 12 }} onClick={onBack}>{tr("back")}</button>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{student?.full_name || "—"}</p>
            <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{student?.grade}</p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <LevelPill inc={inc} tr={tr} />
            <Pill tone={status.tone}>{tr(status.key)}</Pill>
          </div>
        </div>
        <p style={meta}>{fmt(inc.occurred_at, locale)} · {placeLabel(inc, tr)}</p>
        {isInc && <Field name={tr("cause")} value={inc.cause ? tr(`cause_${inc.cause}`) : ""} />}
        {isInc && <Field name={tr("flags")} value={flags} />}
        <Field name={isInc ? tr("description") : tr("markNoticed")} value={inc.description} />
        <Field name={tr("parentExplanation")} value={inc.parent_explanation} />
        <Field name={tr("firstAid")} value={inc.first_aid} />
        <Field name={tr("witnesses")} value={inc.witnesses} />
        {inc.parent_informed_at && (
          <Field name={tr("informedBy")} value={`${inc.parent_informed_by} · ${tr(inc.parent_informed_method || "in_person")} · ${fmt(inc.parent_informed_at, locale)}`} />
        )}
        {inc.parent_signed_at && (
          <Field name={tr("signedBy")} value={`${inc.parent_signed_name} · ${fmt(inc.parent_signed_at, locale)}`} />
        )}
        <p style={{ ...meta, marginTop: 6 }}>{tr("loggedBy")} {names[inc.created_by] || "—"} · {fmt(inc.created_at, locale)}</p>
        {inc.admin_seen_at && <p style={meta}>{tr("seen")} · {fmt(inc.admin_seen_at, locale)}</p>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {isAdmin && !inc.admin_seen_at && <button style={secondaryBtn} disabled={busy} onClick={markSeen}>{tr("markAsSeen")}</button>}
          {(isAdmin || !inc.parent_signed_at) && <button style={secondaryBtn} onClick={onEdit}>{tr("edit")}</button>}
        </div>
      </div>

      {isInc && !inc.parent_informed_at && (
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>{tr("recordTold")}</p>
          <span style={label}>{tr("informedBy")} *</span>
          <input value={toldBy} onChange={(e) => setToldBy(e.target.value)} style={input} />
          <span style={label}>{tr("how")}</span>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
            {METHODS.map((m) => <button key={m} style={method === m ? chipOn : chip} onClick={() => setMethod(m)}>{tr(m)}</button>)}
          </div>
          <button style={primaryBtn} disabled={busy} onClick={saveTold}>{busy ? tr("saving") : tr("saveTold")}</button>
        </div>
      )}

      {isInc && inc.parent_informed_at && !inc.parent_signed_at && (
        <div style={card}>
          {!signing ? (
            <button style={primaryBtn} onClick={() => { setSigning(true); setSigName(""); setMsg(""); }}>{tr("signNow")}</button>
          ) : (
            <>
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 8px" }}>{tr("signHint")}</p>
              <input value={sigName} onChange={(e) => setSigName(e.target.value)} placeholder={tr("typeName")} style={{ ...input, fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 10 }} />
              <button style={primaryBtn} disabled={busy} onClick={saveSig}>{busy ? tr("saving") : tr("confirmSig")}</button>
            </>
          )}
        </div>
      )}

      {inc.level === 3 && (
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>{tr("fullReport")}</p>
          {!inc.full_report && (
            <p style={{ ...meta, color: hoursLeft(inc) < 0 ? TONES.danger.fg : TONES.warn.fg }}>
              {hoursLeft(inc) < 0 ? tr("statusOverdue") : `${tr("statusReportDue")} · ${hoursLeft(inc)} h`}
            </p>
          )}
          {inc.full_report_at && <p style={meta}>{fmt(inc.full_report_at, locale)}</p>}
          <textarea rows={6} value={report} onChange={(e) => setReport(e.target.value)} style={{ ...input, marginBottom: 10 }} />
          <button style={primaryBtn} disabled={busy} onClick={saveReport}>{busy ? tr("saving") : tr("saveReport")}</button>
        </div>
      )}

      {msg && <p style={{ fontSize: 13, color: TONES.danger.fg }}>{msg}</p>}
    </>
  );
}

function ConcernsCard({ concerns, studentById, names, tr, locale, reload }) {
  const [openId, setOpenId] = useState(null);
  const [notes, setNotes] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const list = concerns.filter((c) => showClosed || c.status === "open");

  async function update(id, patch) {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.from("safeguarding_concerns").update(patch).eq("id", id);
    setBusy(false);
    if (error) { setMsg(`${tr("errorPrefix")} ${error.message}`); return; }
    reload();
  }

  return (
    <div style={{ ...card, borderColor: TONES.warn.bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{tr("concerns")}</p>
        <button style={showClosed ? chipOn : chip} onClick={() => setShowClosed(!showClosed)}>{tr("showClosed")}</button>
      </div>
      {list.length === 0 && <p style={{ margin: 0, fontSize: 14, color: MUTED }}>{tr("concernsEmpty")}</p>}
      {list.map((c, idx) => {
        const st = studentById[c.student_id];
        const isOpen = openId === c.id;
        return (
          <div key={c.id} style={{ borderTop: idx === 0 ? "none" : `1px solid ${LINE}`, padding: "10px 0" }}>
            <button
              onClick={() => { setOpenId(isOpen ? null : c.id); setNotes(c.dsl_notes || ""); setMsg(""); }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "inherit" }}
            >
              <span style={{ fontSize: 14 }}>
                <strong>{st?.full_name || "—"}</strong>
                <span style={{ color: MUTED, marginLeft: 6, fontSize: 13 }}>{fmt(c.observed_at, locale)}</span>
              </span>
              <Pill tone={c.status === "open" ? TONES.warn : TONES.muted}>{c.status === "open" ? tr("open") : tr("closed")}</Pill>
            </button>
            {isOpen && (
              <div style={{ marginTop: 10 }}>
                <Field name={tr("concernText")} value={c.concern} />
                <Field name={tr("parentExplanation")} value={c.parent_explanation} />
                <p style={meta}>{tr("loggedBy")} {names[c.created_by] || "—"} · {fmt(c.created_at, locale)}</p>
                <span style={label}>{tr("dslNotes")}</span>
                <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...input, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={secondaryBtn} disabled={busy} onClick={() => update(c.id, { dsl_notes: notes.trim() || null })}>{tr("saveNotes")}</button>
                  <button style={secondaryBtn} disabled={busy} onClick={() => update(c.id, { status: c.status === "open" ? "closed" : "open" })}>
                    {c.status === "open" ? tr("closeConcern") : tr("reopen")}
                  </button>
                </div>
                {msg && <p style={{ fontSize: 13, color: TONES.danger.fg }}>{msg}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

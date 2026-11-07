import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";
import { COLORS, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, pill } from "./ui/tokens";
import BusRun from "./BusRun";
import BusMap from "./BusMap";

// School Bus Service (Myriam, 6 Nov 2026).
// The school runs the bus itself: payments go to Myriam, receipts are emailed
// automatically, and only families switched ON for the bus see this section.
// Tables: bus_riders, bus_payments (supabase/school-bus-service.sql).
// 7 Nov 2026: trips tracked from the bus phone (BusRun.jsx): children on/off, live location,
// parents' "not taking the bus" notices (morning by 06:30, afternoon by 12:00).

// Monthly prices: same as public.bus_zone_fee() in the database.
export const BUS_ZONES = [
  { id: "bassam", label: "Grand-Bassam", fee: 55000 },
  { id: "modeste", label: "Modeste", fee: 55000 },
  { id: "rosier", label: "Rosier", fee: 55000 },
  { id: "yaou", label: "Yaou", fee: 65000 }
];
const zoneOf = (id) => BUS_ZONES.find((z) => z.id === id) || BUS_ZONES[0];
// Where parents send the monthly payment (Myriam, 6 Nov 2026).
const PAY_TO = "07 10 11 01 33";
const METHODS = ["Mobile money", "Cash", "Bank transfer"];

const card = { ...cardToken, marginBottom: 12 };

const T = {
  title: { en: "School bus", fr: "Transport scolaire" },
  area: { en: "Area", fr: "Zone" },
  perMonth: { en: "per month", fr: "par mois" },
  thisMonth: { en: "This month", fr: "Ce mois-ci" },
  paid: { en: "Paid", fr: "Payé" },
  awaiting: { en: "Awaiting payment", fr: "En attente de paiement" },
  howToPay: { en: "Please send the payment to", fr: "Merci d'envoyer le paiement au" },
  receiptAuto: { en: "Your receipt arrives by email as soon as the school records it.", fr: "Votre reçu arrive par e-mail dès que l'école l'enregistre." },
  receipts: { en: "Payments", fr: "Paiements" },
  noPayments: { en: "No payments yet.", fr: "Aucun paiement pour le moment." },
  home: { en: "Home location", fr: "Localisation du domicile" },
  homeSaved: { en: "Saved", fr: "Enregistrée" },
  homeMissing: { en: "Not saved yet. The bus needs it to plan the route.", fr: "Pas encore enregistrée. Le car en a besoin pour organiser le trajet." },
  openMap: { en: "Open on the map", fr: "Voir sur la carte" },
  change: { en: "Change", fr: "Modifier" },
  useHere: { en: "I'm at home: use my current location", fr: "Je suis à la maison : utiliser ma position actuelle" },
  locating: { en: "Finding your location…", fr: "Recherche de votre position…" },
  orPaste: { en: "Or paste a Google Maps or WhatsApp location link", fr: "Ou collez un lien de localisation Google Maps ou WhatsApp" },
  note: { en: "Landmark or directions (optional)", fr: "Point de repère ou indications (facultatif)" },
  save: { en: "Save", fr: "Enregistrer" },
  cancel: { en: "Cancel", fr: "Annuler" },
  saved: { en: "Home location saved. Thank you!", fr: "Localisation enregistrée. Merci !" },
  needLocation: { en: "Use your current location or paste a link first.", fr: "Utilisez votre position actuelle ou collez d'abord un lien." },
  geoFailed: { en: "Your phone did not share its location. Please allow location access, or paste a link instead.", fr: "Votre téléphone n'a pas partagé sa position. Autorisez l'accès à la localisation, ou collez plutôt un lien." },
  gotHere: { en: "Location found", fr: "Position trouvée" },
  today: { en: "Today", fr: "Aujourd'hui" },
  morning: { en: "Morning", fr: "Matin" },
  afternoon: { en: "Afternoon", fr: "Après-midi" },
  waiting: { en: "Bus not left yet", fr: "Le car n'est pas encore parti" },
  onTheWay: { en: "Bus on its way", fr: "Le car est en route" },
  onBusAt: { en: "On the bus at", fr: "Dans le car à" },
  atSchoolAt: { en: "At school at", fr: "À l'école à" },
  homeAt: { en: "Dropped home at", fr: "Déposé(e) à" },
  tripDone: { en: "Trip finished", fr: "Trajet terminé" },
  notTaking: { en: "Not taking the bus", fr: "Ne prend pas le car" },
  followBus: { en: "Where the bus is now", fr: "Où est le car" },
  skipTitle: { en: "My child won't take the bus", fr: "Mon enfant ne prendra pas le car" },
  skipHelp: { en: "Tell the bus not to come. Morning trip: before 6:30 the same day. Afternoon trip: before 12:00. After that, please call the school.", fr: "Prévenez le car de ne pas venir. Trajet du matin : avant 6h30 le jour même. Trajet de l'après-midi : avant 12h00. Après, merci d'appeler l'école." },
  date: { en: "Date", fr: "Date" },
  which: { en: "Which trip", fr: "Quel trajet" },
  both: { en: "Both", fr: "Les deux" },
  reason: { en: "Reason (optional)", fr: "Motif (facultatif)" },
  send: { en: "Tell the school", fr: "Prévenir l'école" },
  sent: { en: "Thank you. The bus knows not to pick up your child.", fr: "Merci. Le car sait qu'il ne doit pas venir chercher votre enfant." },
  tooLate: { en: "It's too late to change this trip on the Hub. Please call the school.", fr: "Il est trop tard pour modifier ce trajet sur le Hub. Merci d'appeler l'école." },
  upcoming: { en: "Coming up", fr: "À venir" },
  undoSkip: { en: "Cancel", fr: "Annuler" },
  skipOpen: { en: "Not taking the bus?", fr: "Ne prend pas le car ?" },
  loading: { en: "Loading…", fr: "Chargement…" },
  noBus: { en: "None of your children uses the school bus.", fr: "Aucun de vos enfants n'utilise le transport scolaire." }
};

function money(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function monthStart(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function shiftMonth(iso, by) {
  const [y, m] = iso.split("-").map(Number);
  return monthStart(new Date(y, m - 1 + by, 1));
}
function monthName(iso, locale) {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}
// Coordinates out of a pasted link or text: "...?q=5.21,-3.73", ".../@5.21,-3.73,17z", "5.21, -3.73".
export function coordsFrom(text) {
  const m = String(text || "").match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
// Only ever open real web links (never "javascript:" and the like).
function mapUrl(r) {
  if (r?.home_lat != null && r?.home_lng != null) return `https://www.google.com/maps?q=${r.home_lat},${r.home_lng}`;
  if (r?.home_link && /^https:\/\//i.test(r.home_link)) return r.home_link;
  return null;
}
const hasHome = (r) => !!(r && (r.home_link || (r.home_lat != null && r.home_lng != null)));

// Who sees the School bus menu item: the admin, and parents with a child switched ON.
export function useBusAccess(profile) {
  const [access, setAccess] = useState({ office: false, family: false });
  useEffect(() => {
    let live = true;
    // A staff member the admin allowed to mark children at school (profiles.bus_helper).
    if (profile?.id && profile.bus_helper && ["teacher", "learning_assistant", "accountant"].includes(profile.role)) {
      setAccess({ office: false, family: false, helper: true });
      return;
    }
    if (!profile?.id || !["admin", "parent"].includes(profile.role)) {
      setAccess({ office: false, family: false });
      return;
    }
    if (profile.role === "admin") {
      setAccess({ office: true, family: false });
      return;
    }
    (async () => {
      // The database only returns this parent's own children who are switched on.
      const { count, error } = await supabase.from("bus_riders").select("student_id", { count: "exact", head: true });
      if (live) setAccess({ office: false, family: !error && (count || 0) > 0 });
    })();
    return () => { live = false; };
  }, [profile?.id, profile?.role, profile?.bus_helper]);
  return access;
}

export default function BusTab({ office, helper }) {
  if (helper) return <div style={{ padding: "16px 16px 90px" }}><BusRun /></div>;
  return office ? <BusOfficeTabs /> : <BusFamily />;
}

function BusOfficeTabs() {
  const [view, setView] = useState("today");
  const [skips, setSkips] = useState([]);
  useEffect(() => {
    if (view !== "today") return;
    supabase.rpc("bus_skips_upcoming").then(({ data }) => setSkips(data || []));
  }, [view]);
  return (
    <div>
      <div style={{ display: "flex", gap: 7, padding: "16px 16px 0" }}>
        <button style={view === "today" ? chipOn : chip} onClick={() => setView("today")}>Today's trips</button>
        <button style={view === "list" ? chipOn : chip} onClick={() => setView("list")}>Riders & payments</button>
      </div>
      {view === "today" ? (
        <div style={{ padding: "12px 16px 90px" }}>
          <BusRun />
          {skips.length > 0 && (
            <div style={card}>
              <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Not taking the bus · coming up</p>
              {skips.map((k) => (
                <p key={`${k.student_id}${k.skip_date}${k.trip}`} style={{ margin: "4px 0", fontSize: 14 }}>
                  {new Date(`${k.skip_date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {k.trip} · <strong>{k.name}</strong>
                  {k.note ? <span style={{ color: COLORS.muted }}> · {k.note}</span> : null}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : <BusOffice />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin: the bus list, areas, on/off, home locations, and the month's payments.
// Staff screens are English only.

function BusOffice() {
  const [month, setMonth] = useState(monthStart());
  const [students, setStudents] = useState([]);
  const [riders, setRiders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [editingHome, setEditingHome] = useState(null);
  const [busy, setBusy] = useState("");

  async function load(m = month) {
    setError("");
    const [s, r, p] = await Promise.all([
      supabase.from("students").select("id, full_name, grade").is("withdrawn_on", null).order("full_name"),
      supabase.from("bus_riders").select("*"),
      supabase.from("bus_payments").select("*").eq("month", m)
    ]);
    const err = s.error || r.error || p.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setStudents(s.data || []);
    setRiders(r.data || []);
    setPayments(p.data || []);
    setLoading(false);
  }
  useEffect(() => { load(month); }, [month]);

  const nameOf = (id) => students.find((s) => s.id === id) || { full_name: "?", grade: "" };
  const payOf = (id) => payments.find((p) => p.student_id === id);

  async function updateRider(id, patch, done) {
    setBusy(id);
    const { error: err } = await supabase.from("bus_riders").update(patch).eq("student_id", id);
    setBusy("");
    if (err) { setStatus(err.message); return; }
    if (done) setStatus(done);
    load();
  }

  async function addRider(id) {
    const { error: err } = await supabase.from("bus_riders").insert({ student_id: id, zone: "bassam", active: true });
    if (err) { setStatus(err.message); return; }
    setStatus(`${nameOf(id).full_name} added to the bus. Choose their area below.`);
    setSearch("");
    setAdding(false);
    load();
  }

  async function markPaid(r, method) {
    const z = zoneOf(r.zone);
    const who = nameOf(r.student_id).full_name;
    setBusy(r.student_id);
    const existing = payOf(r.student_id);
    const res = existing
      ? await supabase.from("bus_payments").update({ paid: true, method, zone: r.zone, amount: z.fee }).eq("id", existing.id).select("id").single()
      : await supabase.from("bus_payments").insert({ student_id: r.student_id, month, zone: r.zone, amount: z.fee, paid: true, method }).select("id").single();
    setBusy("");
    if (res.error) { setStatus(res.error.message); return; }
    const prefix = `${who}: ${monthName(month, "en-GB")} paid (${money(z.fee)} FCFA).`;
    setStatus(`${prefix} Sending the receipt…`);
    load();
    const { data, error: err } = await supabase.functions.invoke("notify-bus-receipt", { body: { id: res.data.id } });
    if (err || data?.error) setStatus(`${prefix} The receipt email could not be sent: ${data?.error || err.message}`);
    else if (!data?.sent) setStatus(`${prefix} No parent email on file, so no receipt was sent.`);
    else setStatus(`${prefix} Receipt emailed to ${data.sent} parent${data.sent === 1 ? "" : "s"}.`);
    load();
  }

  async function undoPaid(p) {
    const who = nameOf(p.student_id).full_name;
    if (!window.confirm(`Remove the ${monthName(month, "en-GB")} payment for ${who}?${p.receipt_emailed_at ? " The receipt was already emailed to the parents." : ""}`)) return;
    const { error: err } = await supabase.from("bus_payments").delete().eq("id", p.id);
    if (err) { setStatus(err.message); return; }
    setStatus(`Payment removed for ${who}.`);
    load();
  }

  if (loading) return <div style={{ padding: 16 }}><div style={card}>Loading…</div></div>;
  if (error) return <div style={{ padding: 16 }}><div style={card}>Could not load: {error}</div></div>;

  const active = riders.filter((r) => r.active);
  const paidIds = new Set(payments.filter((p) => p.paid).map((p) => p.student_id));
  const paidCount = active.filter((r) => paidIds.has(r.student_id)).length;
  const expected = active.reduce((n, r) => n + zoneOf(r.zone).fee, 0);
  const collected = payments.filter((p) => p.paid).reduce((n, p) => n + p.amount, 0);
  const noHome = active.filter((r) => !hasHome(r)).length;

  const sorted = [...riders].sort((a, b) => nameOf(a.student_id).full_name.localeCompare(nameOf(b.student_id).full_name));
  const shown = sorted.filter((r) =>
    filter === "unpaid" ? r.active && !paidIds.has(r.student_id)
    : filter === "paid" ? paidIds.has(r.student_id)
    : filter === "nohome" ? r.active && !hasHome(r)
    : filter === "off" ? !r.active
    : true
  );
  const riderIds = new Set(riders.map((r) => r.student_id));
  const term = search.trim().toLowerCase();
  const addable = term ? students.filter((s) => !riderIds.has(s.id) && (s.full_name || "").toLowerCase().includes(term)).slice(0, 8) : [];

  const tile = (labelText, value, tone) => (
    <div style={{ flex: "1 1 120px", background: COLORS.surface2, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "10px 12px" }}>
      <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>{labelText}</p>
      <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 600, color: tone || COLORS.ink }}>{value}</p>
    </div>
  );

  return (
    <div style={{ padding: "16px 16px 90px" }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
          <button style={ghostBtn} onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, textAlign: "center" }}>School bus · {monthName(month, "en-GB")}</p>
          <button style={ghostBtn} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tile("On the bus", active.length)}
          {tile("Paid", `${paidCount} / ${active.length}`, paidCount === active.length && active.length ? COLORS.ok : undefined)}
          {tile("Collected", `${money(collected)} FCFA`)}
          {tile("Still due", `${money(Math.max(expected - collected, 0))} FCFA`, expected > collected ? COLORS.bad : COLORS.ok)}
        </div>
        {noHome > 0 && <p style={{ margin: "10px 0 0", fontSize: 13, color: COLORS.warn }}>{noHome} home location{noHome === 1 ? "" : "s"} still missing.</p>}
      </div>

      {status && <div style={{ ...card, background: COLORS.infoBg, borderColor: COLORS.infoBg, fontSize: 14 }}>{status}</div>}

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
        {[["all", "All"], ["unpaid", "Unpaid"], ["paid", "Paid"], ["nohome", "No location"], ["off", "Switched off"]].map(([id, l]) => (
          <button key={id} style={filter === id ? chipOn : chip} onClick={() => setFilter(id)}>{l}</button>
        ))}
        <button style={{ ...chip, marginLeft: "auto" }} onClick={() => setAdding(!adding)}>{adding ? "Close" : "+ Add a student"}</button>
      </div>

      {adding && (
        <div style={card}>
          <input style={input} placeholder="Type a student's name" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          {addable.map((s) => (
            <button key={s.id} onClick={() => addRider(s.id)} style={{ ...ghostBtn, display: "flex", width: "100%", justifyContent: "space-between", marginTop: 6 }}>
              <span>{s.full_name}</span><span style={{ color: COLORS.muted, fontWeight: 400 }}>{s.grade}</span>
            </button>
          ))}
          {term && addable.length === 0 && <p style={{ fontSize: 13, color: COLORS.muted, margin: "8px 0 0" }}>No student found (or already on the bus list).</p>}
        </div>
      )}

      {shown.length === 0 && <div style={card}><p style={{ margin: 0, color: COLORS.muted, fontSize: 14 }}>Nobody here.</p></div>}

      {shown.map((r) => {
        const s = nameOf(r.student_id);
        const p = payOf(r.student_id);
        const z = zoneOf(r.zone);
        const url = mapUrl(r);
        return (
          <div key={r.student_id} style={{ ...card, opacity: r.active ? 1 : 0.75 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{s.full_name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: COLORS.muted }}>{s.grade}</p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={r.active}
                  disabled={busy === r.student_id}
                  onChange={(e) => updateRider(r.student_id, { active: e.target.checked }, `${s.full_name} switched ${e.target.checked ? "on: the parents now see the School bus section" : "off: the parents no longer see the School bus section"}.`)}
                />
                {r.active ? "On" : "Off"}
              </label>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
              {BUS_ZONES.map((zz) => (
                <button key={zz.id} disabled={busy === r.student_id} style={r.zone === zz.id ? chipOn : chip}
                  onClick={() => r.zone !== zz.id && updateRider(r.student_id, { zone: zz.id }, `${s.full_name}: area set to ${zz.label} (${money(zz.fee)} FCFA a month).`)}>
                  {zz.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 14, padding: "8px 0", borderTop: `1px solid ${COLORS.line}` }}>
              {editingHome === r.student_id ? (
                <HomeForm
                  rider={r}
                  lang="en"
                  onCancel={() => setEditingHome(null)}
                  onSave={async (v) => {
                    await updateRider(r.student_id, { home_link: v.link, home_lat: v.lat, home_lng: v.lng, home_note: v.note, home_set_at: new Date().toISOString() }, `${s.full_name}: home location saved.`);
                    setEditingHome(null);
                  }}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={pill(hasHome(r) ? "ok" : "warn")}>{hasHome(r) ? "Location saved" : "No location"}</span>
                  {r.home_note && <span style={{ fontSize: 13, color: COLORS.muted }}>{r.home_note}</span>}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...chip, textDecoration: "none" }}>Map</a>}
                    <button style={chip} onClick={() => setEditingHome(r.student_id)}>{hasHome(r) ? "Change" : "Add location"}</button>
                  </span>
                </div>
              )}
            </div>

            {(r.active || p) && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: `1px solid ${COLORS.line}` }}>
                {p?.paid ? (
                  <>
                    <span style={pill("ok")}>Paid · {money(p.amount)} FCFA</span>
                    <span style={{ fontSize: 12, color: COLORS.muted }}>{receiptNo(p.receipt_no)}{p.method ? ` · ${p.method}` : ""}{p.receipt_emailed_at ? " · emailed" : ""}</span>
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button style={chip} onClick={() => printReceipt(p, s)}>Receipt</button>
                      <button style={chip} onClick={() => undoPaid(p)}>Undo</button>
                    </span>
                  </>
                ) : (
                  <PayButton disabled={busy === r.student_id} fee={z.fee} onPay={(m) => markPaid(r, m)} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PayButton({ fee, onPay, disabled }) {
  const [method, setMethod] = useState(METHODS[0]);
  return (
    <>
      <span style={pill("bad")}>Unpaid</span>
      <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...input, width: "auto", minHeight: 36, padding: "6px 8px", marginLeft: "auto" }}>
        {METHODS.map((m) => <option key={m}>{m}</option>)}
      </select>
      <button style={{ ...primaryBtn, minHeight: 36, padding: "7px 12px" }} disabled={disabled} onClick={() => onPay(method)}>
        Mark paid · {money(fee)}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Home location form, shared by the admin (English) and parents (English / French).

function HomeForm({ rider, lang, onSave, onCancel }) {
  const tr = (k) => T[k][lang === "fr" ? "fr" : "en"];
  const [link, setLink] = useState(rider?.home_link || "");
  const [note, setNote] = useState(rider?.home_note || "");
  const [here, setHere] = useState(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  function useHere() {
    if (!navigator.geolocation) { setMsg(tr("geoFailed")); return; }
    setMsg(tr("locating"));
    navigator.geolocation.getCurrentPosition(
      (pos) => { setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setMsg(""); },
      () => setMsg(tr("geoFailed")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  async function save() {
    const fromLink = coordsFrom(link);
    const c = here || fromLink;
    if (!c && !link.trim()) { setMsg(tr("needLocation")); return; }
    setSaving(true);
    await onSave({
      link: link.trim() || null,
      lat: c ? Number(c.lat.toFixed(6)) : null,
      lng: c ? Number(c.lng.toFixed(6)) : null,
      note: note.trim() || null
    });
    setSaving(false);
  }

  return (
    <div>
      <button style={{ ...ghostBtn, width: "100%" }} onClick={useHere}>📍 {tr("useHere")}</button>
      {here && <p style={{ fontSize: 13, color: COLORS.ok, margin: "6px 0 0" }}>✓ {tr("gotHere")} ({here.lat.toFixed(5)}, {here.lng.toFixed(5)})</p>}
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "12px 0 5px" }}>{tr("orPaste")}</p>
      <input style={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://maps.google.com/…" inputMode="url" />
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "12px 0 5px" }}>{tr("note")}</p>
      <input style={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      {msg && <p style={{ fontSize: 13, color: COLORS.warn, margin: "8px 0 0" }}>{msg}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={primaryBtn} disabled={saving} onClick={save}>{tr("save")}</button>
        {onCancel && <button style={ghostBtn} onClick={onCancel}>{tr("cancel")}</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parents: their children on the bus, this month's payment, receipts, home location.

function BusFamily() {
  const { language } = useLanguage();
  const lang = language === "fr" ? "fr" : "en";
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const tr = (k) => T[k][lang];
  const [riders, setRiders] = useState([]);
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState("");
  const [today, setToday] = useState([]);
  const [skips, setSkips] = useState([]);
  const [skipFor, setSkipFor] = useState(null);

  async function loadToday() {
    const [t, k] = await Promise.all([supabase.rpc("bus_family_today"), supabase.rpc("bus_skips_upcoming")]);
    setToday(t.data || []);
    setSkips(k.data || []);
  }
  useEffect(() => { loadToday(); const id = setInterval(loadToday, 20000); return () => clearInterval(id); }, []);

  async function load() {
    const r = await supabase.from("bus_riders").select("student_id, zone, active, home_link, home_lat, home_lng, home_note");
    const ids = (r.data || []).map((x) => x.student_id);
    const [s, p] = ids.length
      ? await Promise.all([
          supabase.from("students").select("id, full_name, grade").in("id", ids),
          supabase.from("bus_payments").select("id, student_id, month, zone, amount, paid, method, paid_at, receipt_no").in("student_id", ids).order("month", { ascending: false })
        ])
      : [{ data: [] }, { data: [] }];
    setRiders(r.data || []);
    setStudents(s.data || []);
    setPayments((p.data || []).filter((x) => x.paid));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: 16 }}><div style={card}>{tr("loading")}</div></div>;
  if (riders.length === 0) return <div style={{ padding: 16 }}><div style={card}>{tr("noBus")}</div></div>;

  const cur = monthStart();
  const nameOf = (id) => students.find((s) => s.id === id) || { full_name: "", grade: "" };

  return (
    <div style={{ padding: "16px 16px 90px" }}>
      {status && <div style={{ ...card, background: COLORS.okBg, borderColor: COLORS.okBg, fontSize: 14 }}>{status}</div>}

      {riders.map((r) => {
        const s = nameOf(r.student_id);
        const z = zoneOf(r.zone);
        const paidNow = payments.find((p) => p.student_id === r.student_id && p.month === cur);
        const url = mapUrl(r);
        return (
          <div key={r.student_id} style={card}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{s.full_name}</p>
            <p style={{ margin: "2px 0 10px", fontSize: 13, color: COLORS.muted }}>
              {tr("area")}: {z.label} · {money(z.fee)} FCFA {tr("perMonth")}
            </p>

            <TodayTrips info={today.find((x) => x.student_id === r.student_id)} tr={tr} locale={locale} />

            <div style={{ padding: "10px 0", borderTop: `1px solid ${COLORS.line}` }}>
              {skips.filter((k) => k.student_id === r.student_id).map((k) => (
                <div key={`${k.skip_date}${k.trip}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, padding: "4px 0" }}>
                  <span style={pill("warn")}>{tr("notTaking")}</span>
                  <span>{new Date(`${k.skip_date}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} · {tr(k.trip)}</span>
                  <button style={{ ...chip, marginLeft: "auto", padding: "4px 10px" }} onClick={async () => {
                    const { error } = await supabase.rpc("bus_skip_remove", { p_student: r.student_id, p_date: k.skip_date, p_trip: k.trip });
                    setStatus(error ? (/TOO_LATE/.test(error.message) ? tr("tooLate") : error.message) : "");
                    loadToday();
                  }}>{tr("undoSkip")}</button>
                </div>
              ))}
              {skipFor === r.student_id ? (
                <SkipForm tr={tr} onCancel={() => setSkipFor(null)} onSend={async (v) => {
                  for (const trip of v.trips) {
                    // eslint-disable-next-line no-await-in-loop
                    const { error } = await supabase.rpc("bus_skip_set", { p_student: r.student_id, p_date: v.date, p_trip: trip, p_note: v.note || null });
                    if (error) { setStatus(/TOO_LATE/.test(error.message) ? tr("tooLate") : error.message); loadToday(); return; }
                  }
                  setStatus(tr("sent")); setSkipFor(null); loadToday();
                }} />
              ) : (
                <button style={{ ...ghostBtn, marginTop: 4 }} onClick={() => { setStatus(""); setSkipFor(r.student_id); }}>{tr("skipOpen")}</button>
              )}
            </div>

            <div style={{ padding: "10px 0", borderTop: `1px solid ${COLORS.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14 }}>{tr("thisMonth")} · {monthName(cur, locale)}</span>
                <span style={{ ...pill(paidNow ? "ok" : "warn"), marginLeft: "auto" }}>{paidNow ? tr("paid") : tr("awaiting")}</span>
              </div>
              {!paidNow && (
                <p style={{ fontSize: 13, color: COLORS.text2, margin: "8px 0 0" }}>
                  {tr("howToPay")} <strong>{PAY_TO}</strong> · {money(z.fee)} FCFA. {tr("receiptAuto")}
                </p>
              )}
            </div>

            <div style={{ padding: "10px 0", borderTop: `1px solid ${COLORS.line}` }}>
              <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>{tr("home")}</p>
              {editing === r.student_id || !hasHome(r) ? (
                <>
                  {!hasHome(r) && <p style={{ fontSize: 13, color: COLORS.warn, margin: "0 0 10px" }}>{tr("homeMissing")}</p>}
                  <HomeForm
                    rider={r}
                    lang={lang}
                    onCancel={hasHome(r) ? () => setEditing(null) : null}
                    onSave={async (v) => {
                      const { error } = await supabase.rpc("bus_set_my_home", { p_student: r.student_id, p_link: v.link, p_lat: v.lat, p_lng: v.lng, p_note: v.note });
                      if (error) { setStatus(error.message); return; }
                      setStatus(tr("saved"));
                      setEditing(null);
                      load();
                    }}
                  />
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={pill("ok")}>✓ {tr("homeSaved")}</span>
                  {r.home_note && <span style={{ fontSize: 13, color: COLORS.muted }}>{r.home_note}</span>}
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...chip, textDecoration: "none" }}>{tr("openMap")}</a>}
                    <button style={chip} onClick={() => setEditing(r.student_id)}>{tr("change")}</button>
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={card}>
        <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>{tr("receipts")}</p>
        {payments.length === 0 && <p style={{ fontSize: 14, color: COLORS.muted, margin: 0 }}>{tr("noPayments")}</p>}
        {payments.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 14 }}>
            <span>
              {riders.length > 1 && <strong>{nameOf(p.student_id).full_name} · </strong>}
              {monthName(p.month, locale)} · {money(p.amount)} FCFA
            </span>
            <button onClick={() => printReceipt(p, nameOf(p.student_id))} style={{ ...chip, padding: "4px 10px" }}>Receipt / Reçu</button>
          </div>
        ))}
      </div>

    </div>
  );
}

// Parents: today's morning and afternoon trips for one child, with the live bus.
function TodayTrips({ info, tr, locale }) {
  if (!info) return null;
  const t = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const line = (trip) => {
    const x = info.trips?.[trip] || {};
    const isM = trip === "morning";
    const text = x.skip ? tr("notTaking")
      : x.off_at ? `${isM ? tr("atSchoolAt") : tr("homeAt")} ${t(x.off_at)}`
      : x.on_at ? `${tr("onBusAt")} ${t(x.on_at)}`
      : x.live ? tr("onTheWay")
      : x.started ? tr("tripDone") : tr("waiting");
    const tone = x.skip ? "warn" : x.off_at ? "ok" : x.on_at || x.live ? "info" : "neutral";
    return (
      <div key={trip} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
        <span style={{ fontSize: 14, minWidth: 92 }}>{tr(trip)}</span>
        <span style={pill(tone)}>{text}</span>
      </div>
    );
  };
  const liveTrip = ["morning", "afternoon"].find((k) => info.trips?.[k]?.bus);
  const lt = liveTrip ? info.trips[liveTrip] : null;
  return (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${COLORS.line}` }}>
      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>{tr("today")}</p>
      {line("morning")}{line("afternoon")}
      {lt && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: COLORS.muted }}>{tr("followBus")} · {t(lt.bus.at)}</p>
          <BusMap bus={lt.bus} path={lt.path || []} height={220} />
        </div>
      )}
    </div>
  );
}

function SkipForm({ tr, onSend, onCancel }) {
  const now = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const mins = now.getHours() * 60 + now.getMinutes();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const [date, setDate] = useState(mins < 12 * 60 ? iso(now) : iso(tomorrow));
  const [which, setWhich] = useState(mins < 6 * 60 + 30 ? "both" : mins < 12 * 60 ? "afternoon" : "both");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const trips = which === "both" ? ["morning", "afternoon"] : [which];
  return (
    <div style={{ background: COLORS.surface2, borderRadius: 12, padding: 12, marginTop: 6 }}>
      <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14 }}>{tr("skipTitle")}</p>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: COLORS.muted }}>{tr("skipHelp")}</p>
      <label style={{ fontSize: 13, color: COLORS.muted }}>{tr("date")}
        <input type="date" min={iso(now)} value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, marginTop: 4 }} />
      </label>
      <p style={{ fontSize: 13, color: COLORS.muted, margin: "10px 0 4px" }}>{tr("which")}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["morning", "afternoon", "both"].map((k) => <button key={k} style={which === k ? chipOn : chip} onClick={() => setWhich(k)}>{tr(k)}</button>)}
      </div>
      <label style={{ display: "block", fontSize: 13, color: COLORS.muted, marginTop: 10 }}>{tr("reason")}
        <input value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, marginTop: 4 }} />
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={primaryBtn} disabled={busy || !date} onClick={async () => { setBusy(true); await onSend({ date, trips, note }); setBusy(false); }}>{tr("send")}</button>
        <button style={ghostBtn} onClick={onCancel}>{tr("cancel")}</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receipt shown inside the Hub (same look as the canteen receipt), with Print.

function receiptNo(n) {
  return `BIS-T-${String(n ?? 0).padStart(4, "0")}`;
}

function printReceipt(p, student) {
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const d = (iso) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-GB");
  const [y, m] = p.month.split("-").map(Number);
  const monthLabel = `${new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long" })} / ${new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" })} ${y}`;
  const no = receiptNo(p.receipt_no);
  const who = student ? `${student.full_name}${student.grade ? ` · ${student.grade}` : ""}` : "";
  const row = (k, v) => `<tr><td class="k">${k}</td><td>${esc(v)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${no}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#241012;font-size:14px;max-width:380px;margin:28px auto;padding:0 16px}
      h1{font-family:Georgia,serif;font-size:19px;color:#801524;margin:0}
      .sub{margin:2px 0 12px;font-size:13px}.muted{color:#7A5A5E}
      table{width:100%;border-collapse:collapse;border-top:1px solid #EAD7DA}
      td{padding:5px 0;text-align:right}td.k{text-align:left;color:#7A5A5E}
      tr.t td{border-top:1px solid #EAD7DA;padding-top:9px;font-weight:bold;color:#241012}
    </style></head><body>
    <h1>BrightSteps International School</h1>
    <p class="sub">School bus receipt / Reçu transport scolaire · <span class="muted">${no}</span></p>
    <table>
      ${row("Student / Élève", who)}
      ${row("Month / Mois", monthLabel)}
      ${row("Area / Zone", zoneOf(p.zone).label)}
      ${p.method ? row("Paid by / Payé par", p.method) : ""}
      ${row("Paid / Payé le", d(p.paid_at || new Date().toISOString()))}
      <tr class="t"><td class="k" style="color:#241012">Total</td><td>${money(p.amount)} FCFA</td></tr>
    </table>
    <p class="muted" style="font-size:12px;margin-top:12px">Thank you / Merci</p>
    </body></html>`;

  document.getElementById("bis-receipt")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "bis-receipt";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "9999", background: "rgba(36,16,18,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "16px"
  });
  const box = document.createElement("div");
  Object.assign(box.style, {
    background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "440px",
    maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden",
    boxShadow: "0 10px 40px rgba(0,0,0,0.25)"
  });
  const frame = document.createElement("iframe");
  frame.title = "Receipt";
  Object.assign(frame.style, { border: "0", width: "100%", height: "380px", flex: "1 1 auto" });
  const bar = document.createElement("div");
  Object.assign(bar.style, { display: "flex", gap: "8px", padding: "12px 16px", borderTop: "1px solid #EAD7DA" });
  const mkBtn = (label, primary) => {
    const b = document.createElement("button");
    b.textContent = label;
    Object.assign(b.style, {
      flex: "1", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "14px",
      border: "1px solid #801524", background: primary ? "#801524" : "#fff", color: primary ? "#fff" : "#801524"
    });
    return b;
  };
  const closeBtn = mkBtn("✕ Close / Fermer", false);
  const printBtn = mkBtn("Print / Imprimer", true);
  bar.append(closeBtn, printBtn);
  box.append(frame, bar);
  overlay.append(box);
  document.body.append(overlay);

  const fd = frame.contentDocument;
  fd.open(); fd.write(html); fd.close();

  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onKey);
  printBtn.addEventListener("click", () => { frame.contentWindow.focus(); frame.contentWindow.print(); });
}

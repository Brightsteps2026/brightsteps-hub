import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";
import { COLORS, RADIUS, card as cardToken, chip, chipOn, primaryBtn as primaryToken, input, pill } from "./ui/tokens";

// Prices set by Myri, 23 Oct 2026: term = 3 months less 5 000; year = 430 000 (by the month about 500 000).
const PRICES = { day: 2700, week: 13000, month: 50000, term: 145000, year: 430000 };
// Parents order by the day, the month or the term (week passes removed Oct 2026).
const PARENT_PASS_TYPES = ["day", "month", "term"];
// The office can also record a full school year.
const OFFICE_PASS_TYPES = ["day", "month", "term", "year"];
// 2026–2027 terms (same dates as the school calendar).
const TERMS = [
  { name: { en: "Term 1", fr: "1er trimestre" }, start: "2026-09-07", end: "2026-12-15" },
  { name: { en: "Term 2", fr: "2e trimestre" }, start: "2027-01-11", end: "2027-03-19" },
  { name: { en: "Term 3", fr: "3e trimestre" }, start: "2027-03-30", end: "2027-06-08" }
];
const SCHOOL_YEAR = { label: "2026–2027 school year", start: "2026-09-07", end: "2027-06-08" };
// The term a date falls in, or the next one if the date is in a break.
function termFor(dateStr) {
  return TERMS.find((t) => dateStr <= t.end) || TERMS[TERMS.length - 1];
}
const STAFF_MEAL_PRICE = 2500;
// Monthly canteen must be paid before this day of the month.
const CANTEEN_DUE_DAY = 5;
const STAFF_ROLES = ["admin", "teacher", "learning_assistant", "accountant"];

const T = {
  balance: { en: "Canteen balance", fr: "Solde cantine" },
  payAtOffice: { en: "Pay at the school office to top up.", fr: "Rechargez au secrétariat." },
  day: { en: "Day", fr: "Journée" },
  week: { en: "Week", fr: "Semaine" },
  month: { en: "Month", fr: "Mois" },
  term: { en: "Term", fr: "Trimestre" },
  year: { en: "Year", fr: "Année" },
  termHint: { en: "From the first to the last day of the term. School holidays are not included.", fr: "Du premier au dernier jour du trimestre. Les vacances scolaires ne sont pas incluses." },
  dayHint: { en: "Pick a day", fr: "Choisissez un jour" },
  weekHint: { en: "Monday to Friday", fr: "Du lundi au vendredi" },
  monthHint: { en: "All school days", fr: "Tous les jours de classe" },
  order: { en: "Confirm order", fr: "Confirmer la commande" },
  ordering: { en: "Sending…", fr: "Envoi…" },
  myOrders: { en: "Orders", fr: "Commandes" },
  paid: { en: "Paid", fr: "Payée" },
  awaiting: { en: "Awaiting payment", fr: "En attente de paiement" },
  noneOpen: { en: "Nothing available to order right now.", fr: "Rien à commander pour le moment." },
  noOrders: { en: "No orders yet.", fr: "Aucune commande." },
  covered: { en: "Already covered by another pass.", fr: "Déjà couvert par une autre formule." },
  saved: { en: "Order received. Please pay at the school office to confirm it.", fr: "Commande reçue. Merci de régler au secrétariat pour la confirmer." },
  deadline: { en: "Day passes close at 18:00 the day before.", fr: "Les commandes à la journée ferment à 18h00 la veille." },
  loading: { en: "Loading…", fr: "Chargement…" },
  whichChildren: { en: "Which children?", fr: "Quels enfants ?" },
  alreadyCovered: { en: "Already covered", fr: "Déjà couvert" },
  pickChild: { en: "Tick at least one child.", fr: "Cochez au moins un enfant." },
  forChildren: { en: "for", fr: "pour" },
  children: { en: "children", fr: "enfants" },
  savedFor: { en: "Order received for", fr: "Commande reçue pour" },
  payToConfirm: { en: "Please pay at the school office to confirm it.", fr: "Merci de régler au secrétariat pour la confirmer." },
  lunchThisMonth: { en: "Lunch this month", fr: "Cantine ce mois-ci" },
  lunchPaidFor: { en: "Lunch paid for all of", fr: "Cantine payée pour tout le mois" },
  lunchAwaitingFor: { en: "Ordered for all of", fr: "Commandée pour tout le mois" },
  lunchAwaitingPay: { en: "please pay at the school office", fr: "merci de régler au secrétariat" },
  lunchDaysBooked: { en: "lunch days booked in", fr: "jours de cantine réservés en" },
  lunchNone: { en: "No lunch booked for", fr: "Aucune cantine réservée en" },
  noChildren: { en: "No child is linked to your account yet. Please contact the school office.", fr: "Aucun enfant n'est encore lié à votre compte. Merci de contacter le secrétariat." }
};

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s) {
  return new Date(s + "T12:00:00");
}

function rangeFor(type, dateStr) {
  const d = parseISO(dateStr);
  if (type === "day") return { start: dateStr, end: dateStr };
  if (type === "term") {
    const t = termFor(dateStr);
    return { start: t.start, end: t.end };
  }
  if (type === "year") {
    // From the chosen date (or the first day of school) to the last day of school.
    return { start: dateStr > SCHOOL_YEAR.start ? dateStr : SCHOOL_YEAR.start, end: SCHOOL_YEAR.end };
  }
  if (type === "week") {
    const dow = d.getDay();
    const offset = dow === 0 ? 1 : 1 - dow;
    const mon = new Date(d);
    mon.setDate(d.getDate() + offset);
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    return { start: toISO(mon), end: toISO(fri) };
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toISO(first), end: toISO(last) };
}

function deadlineFor(type, startISO) {
  const start = parseISO(startISO);
  if (type === "month") {
    return new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0);
  }
  if (type === "term") {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
  }
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

function isOpen(type, startISO) {
  return new Date() < deadlineFor(type, startISO);
}

// "7 September 2026" / "7 septembre 2026"
function longDate(iso, locale) {
  return parseISO(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function money(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function upcomingOptions(type, locale) {
  const out = [];
  const today = new Date();

  if (type === "day") {
    for (let i = 0; i < 21 && out.length < 8; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const iso = toISO(d);
      if (!isOpen("day", iso)) continue;
      out.push({ value: iso, label: d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) });
    }
    return out;
  }

  if (type === "week") {
    for (let i = 0; i < 35 && out.length < 4; i += 7) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const { start, end } = rangeFor("week", toISO(d));
      if (!isOpen("week", start)) continue;
      if (out.some((o) => o.value === start)) continue;
      const s = parseISO(start);
      const e = parseISO(end);
      out.push({
        value: start,
        label: `${s.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${e.toLocaleDateString(locale, { day: "numeric", month: "short" })}`
      });
    }
    return out;
  }

  if (type === "term") {
    const fr = locale.startsWith("fr");
    const short = (iso) => longDate(iso, locale);
    TERMS.filter((t) => isOpen("term", t.start)).slice(0, 2).forEach((t) => {
      out.push({ value: t.start, label: `${fr ? t.name.fr : t.name.en} · ${short(t.start)} – ${short(t.end)}` });
    });
    return out;
  }

  for (let i = 0; i < 4 && out.length < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const iso = toISO(d);
    if (!isOpen("month", iso)) continue;
    out.push({ value: iso, label: d.toLocaleDateString(locale, { month: "long", year: "numeric" }) });
  }
  return out;
}

const card = { ...cardToken, marginBottom: 14 };
const primaryBtn = { ...primaryToken, padding: "11px 16px", width: "100%" };

export default function CanteenTab({ profile }) {
  const { language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const tr = (k) => (T[k] ? T[k][language === "fr" ? "fr" : "en"] : k);

  const role = profile?.role;
  const isParent = role === "parent";
  const canEdit = role === "admin" || role === "accountant";
  // Passes and payments: admin and accountant. Kitchen counts: admin only.
  // Teachers and learning assistants only see their own staff meals.
  const isStaff = canEdit;
  const isStaffMember = STAFF_ROLES.includes(role);

  const [students, setStudents] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const [picked, setPicked] = useState(null);
  const [passType, setPassType] = useState("day");
  const [choice, setChoice] = useState("");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [staffDate, setStaffDate] = useState(toISO(new Date()));
  // Students who don't eat at school (office list only).
  const [noLunch, setNoLunch] = useState(new Set());
  const [showNoLunch, setShowNoLunch] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const s = await supabase.from("students").select("id, full_name, grade").order("full_name");
    if (s.error) { setError(s.error.message); setLoading(false); return; }
    const cols = "id, student_id, pass_type, start_date, end_date, amount, paid";
    let p = await supabase
      .from("canteen_passes")
      .select(cols + ", receipt_no, paid_at")
      .order("start_date", { ascending: false });
    // Before canteen-receipts.sql is run the receipt columns do not exist yet:
    // load without them so the page still works (no Receipt buttons until then).
    if (p.error && /receipt_no|paid_at/.test(p.error.message)) {
      p = await supabase.from("canteen_passes").select(cols).order("start_date", { ascending: false });
    }
    if (p.error) { setError(p.error.message); setLoading(false); return; }
    setStudents(s.data || []);
    setPasses(p.data || []);
    if (role === "admin" || role === "accountant") {
      const n = await supabase.from("canteen_no_lunch").select("student_id");
      if (!n.error) setNoLunch(new Set((n.data || []).map((r) => r.student_id)));
    }
    setLoading(false);
  }

  async function setEatsAtSchool(studentId, eats) {
    const { error: err } = eats
      ? await supabase.from("canteen_no_lunch").delete().eq("student_id", studentId)
      : await supabase.from("canteen_no_lunch").insert({ student_id: studentId });
    if (err) { setStatus(err.message); return; }
    const who = students.find((x) => x.id === studentId)?.full_name || "";
    setStatus(eats ? `${who} is back on the list.` : `${who} removed from the list (doesn't eat at school).`);
    setSelected(null);
    setSearch("");
    load();
  }

  // Teachers and learning assistants never load the children's passes.
  const onlyOwnMeals = !isParent && !isStaff && isStaffMember;

  useEffect(() => { if (!onlyOwnMeals) load(); }, []);

  useEffect(() => {
    if (isParent && !PARENT_PASS_TYPES.includes(passType)) { setPassType("day"); return; }
    const opts = upcomingOptions(passType, locale);
    setChoice(opts.length ? opts[0].value : "");
  }, [passType, locale]);

  function overlapFor(studentId, start, end) {
    return passes.find(
      (x) => x.student_id === studentId && x.start_date <= end && x.end_date >= start
    );
  }

  async function createPass(studentId, type, startISO, markPaid) {
    const { start, end } = rangeFor(type, startISO);
    if (overlapFor(studentId, start, end)) { setStatus(tr("covered")); return; }
    setSaving(true);
    setStatus("");
    const { data: row, error: err } = await supabase.from("canteen_passes").insert({
      student_id: studentId,
      pass_type: type,
      start_date: start,
      end_date: end,
      amount: PRICES[type],
      paid: markPaid
    }).select("id").single();
    setSaving(false);
    if (err) { setStatus(err.message); return; }
    if (markPaid) {
      const who = students.find((x) => x.id === studentId)?.full_name || "";
      setStatus(`Saved for ${who}. ${start} to ${end}. Sending the receipt…`);
      emailReceipt(row.id, `Saved for ${who}. ${start} to ${end}.`);
      // Paid: close this student so the name leaves the list.
      setSelected(null);
      setSearch("");
    } else {
      setStatus(tr("saved"));
    }
    load();
  }

  // Parents: one order for several children at once.
  async function createPasses(studentIds, type, startISO) {
    const { start, end } = rangeFor(type, startISO);
    const todo = studentIds.filter((id) => !overlapFor(id, start, end));
    if (studentIds.length === 0) { setStatus(tr("pickChild")); return; }
    if (todo.length === 0) { setStatus(tr("covered")); return; }
    setSaving(true);
    setStatus("");
    const { error: err } = await supabase.from("canteen_passes").insert(
      todo.map((id) => ({ student_id: id, pass_type: type, start_date: start, end_date: end, amount: PRICES[type], paid: false }))
    );
    setSaving(false);
    if (err) { setStatus(err.message); return; }
    const names = students.filter((x) => todo.includes(x.id)).map((x) => x.full_name).join(", ");
    setStatus(`${tr("savedFor")} ${names}. ${tr("payToConfirm")}`);
    load();
  }

  async function setPaid(id, value) {
    const { error: err } = await supabase.from("canteen_passes").update({ paid: value }).eq("id", id);
    if (err) { setStatus(err.message); return; }
    if (value) {
      const who = students.find((x) => x.id === passes.find((p) => p.id === id)?.student_id)?.full_name || "";
      setStatus(`Payment confirmed${who ? ` for ${who}` : ""}. Sending the receipt…`);
      emailReceipt(id, `Payment confirmed${who ? ` for ${who}` : ""}.`);
    }
    load();
  }

  // Office: email the receipt to the child's parents as soon as a payment is recorded.
  async function emailReceipt(id, prefix) {
    const { data, error: err } = await supabase.functions.invoke("notify-canteen-receipt", { body: { id } });
    if (err || data?.error) { setStatus(`${prefix} The receipt email could not be sent: ${data?.error || err.message}`); return; }
    if (!data?.sent) { setStatus(`${prefix} No parent email on file, so no receipt was sent.`); return; }
    setStatus(`${prefix} Receipt emailed to ${data.sent} parent${data.sent === 1 ? "" : "s"}.`);
  }

  async function removePass(id) {
    const { error: err } = await supabase.from("canteen_passes").delete().eq("id", id);
    if (err) { setStatus(err.message); return; }
    load();
  }

  if (onlyOwnMeals) return <div style={{ padding: "16px 16px 90px" }}><MyStaffMeals /></div>;
  if (loading) return <div style={card}>{tr("loading")}</div>;
  if (error) return <div style={card}>{language === "fr" ? "Chargement impossible : " : "Could not load: "}{error}</div>;

  if (isParent) {
    if (students.length === 0) return <div style={card}>{tr("noChildren")}</div>;

    const options = upcomingOptions(passType, locale);
    const chosen = picked || students.map((s) => s.id);
    const range = choice ? rangeFor(passType, choice) : null;
    const coveredIds = range ? students.filter((s) => overlapFor(s.id, range.start, range.end)).map((s) => s.id) : [];
    const toOrder = chosen.filter((id) => !coveredIds.includes(id));
    const total = PRICES[passType] * toOrder.length;
    const togglePick = (id) => setPicked(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
    const nameOf = (id) => (students.find((s) => s.id === id) || {}).full_name || "";
    const myPasses = passes;

    return (
      <div style={{ padding: "16px 16px 90px" }}>
        <ParentLunchStatus students={students} passes={passes} tr={tr} locale={locale} />

        <div style={card}>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>{tr("balance")}</p>
          <p style={{ margin: "2px 0 6px", fontSize: 24, fontWeight: 600 }}>
            {money(profile?.canteen_balance || 0)} FCFA
          </p>
          <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>{tr("payAtOffice")}</p>
        </div>

        <div style={card}>
          {students.length > 1 && (
            <>
              <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 8px" }}>{tr("whichChildren")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {students.map((s) => {
                  const covered = coveredIds.includes(s.id);
                  const on = !covered && chosen.includes(s.id);
                  return (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, fontSize: 14, cursor: covered ? "default" : "pointer", border: `1px solid ${on ? COLORS.brand : COLORS.line}`, background: on ? COLORS.tint : "#fff", color: covered ? COLORS.faint : "inherit" }}>
                      <input type="checkbox" checked={on} disabled={covered} onChange={() => togglePick(s.id)} />
                      <span>{s.full_name}</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: COLORS.muted }}>{covered ? tr("alreadyCovered") : s.grade}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
            {PARENT_PASS_TYPES.map((t) => (
              <button key={t} onClick={() => setPassType(t)} style={passType === t ? chipOn : chip}>
                {tr(t)} · {money(PRICES[t])} FCFA
              </button>
            ))}
          </div>

          <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 8px" }}>
            {passType === "day" ? tr("dayHint") : passType === "week" ? tr("weekHint") : passType === "term" ? tr("termHint") : tr("monthHint")}
          </p>

          {options.length === 0 ? (
            <p style={{ fontSize: 14, color: COLORS.muted }}>{tr("noneOpen")}</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
                {options.map((o) => (
                  <button key={o.value} onClick={() => setChoice(o.value)} style={choice === o.value ? chipOn : chip}>
                    {o.label}
                  </button>
                ))}
              </div>

              <button style={primaryBtn} disabled={saving || !choice} onClick={() => createPasses(chosen, passType, choice)}>
                {saving
                  ? tr("ordering")
                  : `${tr("order")}${toOrder.length > 1 ? ` ${tr("forChildren")} ${toOrder.length} ${tr("children")}` : ""} · ${money(total)} FCFA`}
              </button>
            </>
          )}

          {status && <p style={{ fontSize: 13, marginTop: 10 }}>{status}</p>}
          <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 12, marginBottom: 0 }}>{tr("deadline")}</p>
        </div>

        <div style={card}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>
            {tr("myOrders")}
          </p>
          {myPasses.length === 0 && <p style={{ fontSize: 14, color: COLORS.muted, margin: 0 }}>{tr("noOrders")}</p>}
          {myPasses.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 14 }}>
              <span>
                {students.length > 1 && <strong>{nameOf(p.student_id)} · </strong>}
                {p.pass_type === "month"
                  ? `${tr("month")} · ${parseISO(p.start_date).toLocaleDateString(locale, { month: "long", year: "numeric" })}`
                  : p.pass_type === "term"
                  ? `${termFor(p.start_date).name[language === "fr" ? "fr" : "en"]} · ${longDate(p.start_date, locale)} → ${longDate(p.end_date, locale)}`
                  : `${tr(p.pass_type)} · ${p.start_date}${p.end_date !== p.start_date ? ` → ${p.end_date}` : ""}`}
              </span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {p.paid && p.receipt_no && (
                  <button onClick={() => printReceipt(p, students.find((s) => s.id === p.student_id))} style={{ ...chip, padding: "4px 10px" }}>
                    Receipt / Reçu
                  </button>
                )}
                <span style={{ ...pill(p.paid ? "ok" : "bad"), padding: "4px 10px" }}>
                  {p.paid ? tr("paid") : tr("awaiting")}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isStaff) return <div style={card}>{tr("noChildren")}</div>;

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toISO(tomorrowDate);

  const eatingTomorrow = passes.filter((p) => p.start_date <= tomorrow && p.end_date >= tomorrow);
  const unpaidTomorrow = eatingTomorrow.filter((p) => !p.paid).length;

  const byGrade = {};
  eatingTomorrow.forEach((p) => {
    const st = students.find((s) => s.id === p.student_id);
    const g = st?.grade || "—";
    byGrade[g] = (byGrade[g] || 0) + 1;
  });

  const term = search.trim().toLowerCase();
  // Once a student is recorded as paid, the name leaves "Record a pass" for
  // that period, so nobody is recorded twice. The period follows the chosen
  // pass type and date: Day = that day, Month = that month, Term = that term.
  const periodRange = rangeFor(passType, staffDate);
  const monthName =
    passType === "day"
      ? parseISO(staffDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })
      : passType === "term"
      ? termFor(staffDate).name.en
      : passType === "year"
      ? SCHOOL_YEAR.label
      : parseISO(periodRange.start).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const coversPeriod = (p) =>
    passType === "day"
      ? true // any paid pass that includes that day
      : passType === "year"
      ? p.pass_type === "year"
      : passType === "term"
      ? p.pass_type === "term" || p.pass_type === "year"
      : p.pass_type === "month" || p.pass_type === "term" || p.pass_type === "year";
  const paidMonthIds = new Set(
    passes
      .filter((p) => p.paid && coversPeriod(p) && p.start_date <= periodRange.end && p.end_date >= periodRange.start)
      .map((p) => p.student_id)
  );
  const matching = term ? students.filter((s) => (s.full_name || "").toLowerCase().includes(term)) : students;
  // A "doesn't eat at school" student comes back by themselves as soon as
  // they have a pass for today or later (e.g. a parent orders lunch).
  const todayISO = toISO(new Date());
  const isNoLunch = (id) => noLunch.has(id) && !passes.some((p) => p.student_id === id && p.end_date >= todayISO);
  const noLunchCount = students.filter((s) => isNoLunch(s.id)).length;
  const afterNoLunch = showNoLunch || term ? matching : matching.filter((s) => !isNoLunch(s.id));
  const hiddenPaid = afterNoLunch.filter((s) => paidMonthIds.has(s.id));
  const shown = afterNoLunch.filter((s) => !paidMonthIds.has(s.id));
  const selectedPasses = selected ? passes.filter((p) => p.student_id === selected.id) : [];
  const awaiting = passes.filter((p) => !p.paid);

  // Canteen is due before the 5th of each month (Myri, Oct 2026). From the 6th,
  // every student who eats at school and has no PAID month, term or year pass
  // covering the month shows as "Unpaid" in red, so the office knows who owes.
  const coversWholeMonth = (p, first, last) =>
    p.paid && ["month", "term", "year"].includes(p.pass_type) && p.start_date <= last && p.end_date >= first;
  const monthIsOverdue = (firstISO) => {
    const f = parseISO(firstISO);
    return new Date() >= new Date(f.getFullYear(), f.getMonth(), CANTEEN_DUE_DAY + 1);
  };
  const nowDate = new Date();
  const curFirst = toISO(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1));
  const curLast = toISO(new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0));
  const curMonthName = nowDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const owing = monthIsOverdue(curFirst)
    ? students.filter(
        (s) => !isNoLunch(s.id) && !passes.some((p) => p.student_id === s.id && coversWholeMonth(p, curFirst, curLast))
      )
    : [];
  // In "Record a pass", month view: red tag once the chosen month is past the 5th.
  const listMonthOverdue = passType === "month" && monthIsOverdue(periodRange.start);

  return (
    <div style={{ padding: "16px 16px 90px" }}>
      {role === "admin" && (
      <div style={card}>
        <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600 }}>Kitchen count for tomorrow</p>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: COLORS.muted }}>{tomorrow}</p>
        <p style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 600 }}>{eatingTomorrow.length}</p>
        {unpaidTomorrow > 0 && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: COLORS.bad }}>{unpaidTomorrow} not yet paid</p>
        )}
        {Object.keys(byGrade).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>No meals booked yet.</p>
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(byGrade).sort().map(([g, n]) => (
              <span key={g} style={{ fontSize: 14 }}>{g}: <strong>{n}</strong></span>
            ))}
          </div>
        )}
      </div>
      )}

      {canEdit && owing.length > 0 && (
        <div style={{ ...card, borderColor: COLORS.bad }}>
          <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600, color: COLORS.bad }}>
            Canteen unpaid · {curMonthName} ({owing.length})
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: COLORS.muted }}>
            Due before the {CANTEEN_DUE_DAY}th. Tap a name to record the payment.
          </p>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {owing.map((s) => {
              const dayOnly = passes.some((p) => p.student_id === s.id && p.pass_type === "day" && p.start_date <= curLast && p.end_date >= curFirst);
              return (
                <div
                  key={s.id}
                  onClick={() => { setSelected(s); setPassType("month"); setStaffDate(curFirst); setStatus(""); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 14, cursor: "pointer" }}
                >
                  <span>
                    <strong>{s.full_name}</strong>
                    <span style={{ color: COLORS.faint, marginLeft: 8, fontSize: 13 }}>{s.grade}</span>
                    {dayOnly && <span style={{ color: COLORS.muted, marginLeft: 8, fontSize: 12 }}>· day passes only</span>}
                  </span>
                  <span style={{ ...pill("bad"), padding: "3px 10px", fontSize: 12 }}>Unpaid</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {canEdit && awaiting.length > 0 && (
        <div style={card}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>Awaiting payment ({awaiting.length})</p>
          {awaiting.map((p) => {
            const st = students.find((s) => s.id === p.student_id);
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 14 }}>
                <span>
                  <strong>{st?.full_name || "—"}</strong>
                  <span style={{ color: COLORS.muted }}> · {tr(p.pass_type)} · {p.start_date} · {money(p.amount)}</span>
                </span>
                <button onClick={() => setPaid(p.id, true)} style={{ ...chip, borderColor: COLORS.ok, color: COLORS.ok }}>
                  Confirm payment
                </button>
              </div>
            );
          })}
        </div>
      )}

      <StaffMealsPanel />

      {canEdit && <PassesList passes={passes} students={students} />}

      {canEdit && (
        <div style={card}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>Record a pass</p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a student"
            style={{ ...input, marginBottom: 10 }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 13, color: COLORS.muted }}>
            {OFFICE_PASS_TYPES.map((t) => (
              <button key={t} onClick={() => setPassType(t)} style={{ ...(passType === t ? chipOn : chip), padding: "4px 10px" }}>
                {tr(t)}
              </button>
            ))}
            <input
              type="date"
              value={staffDate}
              onChange={(e) => e.target.value && setStaffDate(e.target.value)}
              style={{ ...input, width: "auto", padding: "4px 8px" }}
            />
            {noLunchCount > 0 && (
              <button onClick={() => setShowNoLunch(!showNoLunch)} style={{ ...chip, padding: "4px 10px" }}>
                {showNoLunch ? "Hide" : "Show"} {noLunchCount} not eating at school
              </button>
            )}
          </div>

          <div style={{ maxHeight: 160, overflowY: "auto", border: `1px solid ${COLORS.line}`, borderRadius: 8, marginBottom: 14 }}>
            {shown.map((s) => (
              <div
                key={s.id}
                onClick={() => { setSelected(s); setStatus(""); }}
                style={{ padding: "8px 10px", cursor: "pointer", fontSize: 14, background: selected?.id === s.id ? COLORS.tint : "transparent", borderBottom: "1px solid #F4EFEF" }}
              >
                {s.full_name}
                <span style={{ color: COLORS.faint, marginLeft: 8, fontSize: 13 }}>{s.grade}</span>
                {paidMonthIds.has(s.id) && <span style={{ color: COLORS.ok, marginLeft: 8, fontSize: 13 }}>· paid for {monthName}</span>}
                {isNoLunch(s.id) && <span style={{ color: COLORS.muted, marginLeft: 8, fontSize: 13 }}>· doesn't eat at school</span>}
                {listMonthOverdue && !isNoLunch(s.id) && <span style={{ color: COLORS.bad, marginLeft: 8, fontSize: 13, fontWeight: 600 }}>· Unpaid</span>}
              </div>
            ))}
            {shown.length === 0 && (
              <div style={{ padding: 10, color: COLORS.faint, fontSize: 14 }}>
                {hiddenPaid.length > 0 ? `Everyone here has paid for ${monthName}.` : "No student found."}
              </div>
            )}
          </div>

          {/* Recorded students move here: who has paid for the chosen day, month or term. */}
          {(() => {
            const paidList = students
              .filter((s) => paidMonthIds.has(s.id))
              .map((s) => {
                const p = passes.find((x) => x.student_id === s.id && x.paid && coversPeriod(x) && x.start_date <= periodRange.end && x.end_date >= periodRange.start);
                return { s, p };
              });
            return (
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: COLORS.ok }}>
                  Paid for {monthName} ({paidList.length})
                </p>
                {paidList.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: COLORS.muted }}>Nobody recorded yet.</p>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${COLORS.line}`, borderRadius: 8 }}>
                    {paidList.map(({ s, p }) => (
                      // Tap a paid name to open its receipt; "Edit" opens the student below.
                      <div
                        key={s.id}
                        onClick={() => { if (p && p.receipt_no) printReceipt(p, s); else { setSelected(s); setStatus(""); } }}
                        title={p && p.receipt_no ? "Open receipt" : ""}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 10px", cursor: "pointer", fontSize: 14, background: selected?.id === s.id ? COLORS.tint : "transparent", borderBottom: "1px solid #F4EFEF" }}
                      >
                        <span>
                          <span style={{ color: COLORS.ok }}>✓ </span>{s.full_name}
                          <span style={{ color: COLORS.faint, marginLeft: 8, fontSize: 13 }}>{s.grade}</span>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {p && <span style={{ color: COLORS.muted, fontSize: 13 }}>{tr(p.pass_type)} · {money(p.amount)}</span>}
                          {p && p.receipt_no && <span style={{ ...chip, padding: "3px 9px", fontSize: 12 }}>Receipt</span>}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(s); setStatus(""); }}
                            style={{ ...chip, padding: "3px 9px", fontSize: 12, color: COLORS.muted }}
                          >
                            Edit
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {!selected && status && <p style={{ fontSize: 13, margin: "0 0 10px", color: COLORS.ok }}>{status}</p>}

          {selected && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 10px" }}>
                <p style={{ margin: 0, fontSize: 14 }}>Selected: <strong>{selected.full_name}</strong></p>
                {noLunch.has(selected.id) ? (
                  <button onClick={() => setEatsAtSchool(selected.id, true)} style={{ ...chip, padding: "4px 10px" }}>Eats at school again</button>
                ) : (
                  <button onClick={() => setEatsAtSchool(selected.id, false)} style={{ ...chip, padding: "4px 10px", color: COLORS.muted }}>Doesn't eat at school</button>
                )}
              </div>

              <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
                {OFFICE_PASS_TYPES.map((t) => (
                  <button key={t} onClick={() => setPassType(t)} style={passType === t ? chipOn : chip}>
                    {tr(t)} · {money(PRICES[t])} FCFA
                  </button>
                ))}
              </div>

              <input
                type="date"
                value={staffDate}
                onChange={(e) => setStaffDate(e.target.value)}
                style={{ ...input, width: "auto", marginBottom: 10 }}
              />

              <p style={{ margin: "0 0 12px", fontSize: 13, color: COLORS.muted }}>
                {passType === "term" && `${termFor(staffDate).name.en} · `}Covers {longDate(rangeFor(passType, staffDate).start, "en-GB")} to {longDate(rangeFor(passType, staffDate).end, "en-GB")}
              </p>

              <button style={primaryBtn} disabled={saving} onClick={() => createPass(selected.id, passType, staffDate, true)}>
                {saving ? "Saving…" : "Record as paid"}
              </button>

              {status && <p style={{ fontSize: 13, marginTop: 10 }}>{status}</p>}

              {selectedPasses.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, color: COLORS.muted }}>Passes for {selected.full_name}</p>
                  {selectedPasses.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 14 }}>
                      <span>
                        {tr(p.pass_type)} · {p.start_date} → {p.end_date} · {money(p.amount)}
                        {!p.paid && <span style={{ color: COLORS.bad }}> · unpaid</span>}
                      </span>
                      <span style={{ display: "flex", gap: 6 }}>
                        {p.paid && p.receipt_no && (
                          <button onClick={() => printReceipt(p, selected)} style={{ ...chip, padding: "4px 10px" }}>
                            Receipt
                          </button>
                        )}
                        <button onClick={() => removePass(p.id)} style={{ ...chip, borderColor: "#F09595", color: COLORS.bad, padding: "4px 10px" }}>
                          Remove
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
             

// Staff: every pass that falls in the chosen month, paid or not.
function PassesList({ passes, students }) {
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [kind, setKind] = useState("all");

  const first = toISO(monthStart);
  const last = toISO(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
  const nameOf = (id) => students.find((s) => s.id === id)?.full_name || "—";
  const gradeOf = (id) => students.find((s) => s.id === id)?.grade || "";

  const list = passes
    .filter((p) => p.start_date <= last && p.end_date >= first)
    .filter((p) => kind === "all" || p.pass_type === kind)
    .sort((a, b) => nameOf(a.student_id).localeCompare(nameOf(b.student_id)) || a.start_date.localeCompare(b.start_date));

  const label = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const move = (n) => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + n, 1));
  const kindLabel = { day: "Day", week: "Week", month: "Month", term: "Term", year: "Year" };

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Passes · {label} ({list.length})</p>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => move(-1)} style={chip} aria-label="Previous month">‹</button>
          <button onClick={() => move(1)} style={chip} aria-label="Next month">›</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
        {["all", "day", "month", "term", "year"].map((k) => (
          <button key={k} onClick={() => setKind(k)} style={kind === k ? chipOn : chip}>
            {k === "all" ? "All" : kindLabel[k]}
          </button>
        ))}
      </div>

      {list.length === 0 && <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>No passes for this month.</p>}
      {list.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 14 }}>
          <span>
            <strong>{nameOf(p.student_id)}</strong>
            <span style={{ color: COLORS.muted }}> · {gradeOf(p.student_id)} · {kindLabel[p.pass_type] || p.pass_type} · {p.start_date} → {p.end_date} · {money(p.amount)}</span>
          </span>
          <span style={{ ...pill(p.paid ? "ok" : "bad"), fontWeight: 400, padding: "3px 10px", borderRadius: RADIUS.sm }}>
            {p.paid ? "Paid" : "Unpaid"}
          </span>
        </div>
      ))}
    </div>
  );
}

// Parents: a clear line per child saying whether lunch is covered this month.
function ParentLunchStatus({ students, passes, tr, locale }) {
  const now = new Date();
  const first = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const last = toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const monthName = now.toLocaleDateString(locale, { month: "long" });
  // "tout le mois d'octobre" / "tout le mois de mars" in French.
  const ofMonth = locale.startsWith("fr") ? (/^[aeiouâéèêîôû]/i.test(monthName) ? `d'${monthName}` : `de ${monthName}`) : monthName;

  function schoolDays(p) {
    let n = 0;
    const d = parseISO(p.start_date < first ? first : p.start_date);
    const end = p.end_date > last ? last : p.end_date;
    while (toISO(d) <= end) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) n++;
      d.setDate(d.getDate() + 1);
    }
    return n;
  }

  return (
    <div style={card}>
      <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>{tr("lunchThisMonth")}</p>
      {students.map((s) => {
        const mine = passes.filter((p) => p.student_id === s.id && p.start_date <= last && p.end_date >= first);
        // A term pass covers the whole month too.
        const monthPass = mine.find((p) => ["month", "term", "year"].includes(p.pass_type));
        let text, ok;
        if (monthPass && monthPass.paid) {
          ok = true; text = `${tr("lunchPaidFor")} ${ofMonth}`;
        } else if (monthPass) {
          ok = false; text = `${tr("lunchAwaitingFor")} ${ofMonth} · ${tr("lunchAwaitingPay")}`;
        } else if (mine.length > 0) {
          const days = mine.reduce((sum, p) => sum + schoolDays(p), 0);
          ok = mine.every((p) => p.paid);
          text = `${days} ${tr("lunchDaysBooked")} ${monthName}` + (ok ? "" : ` · ${tr("lunchAwaitingPay")}`);
        } else {
          ok = null; text = `${tr("lunchNone")} ${monthName}`;
        }
        const colour = ok === true ? COLORS.ok : ok === false ? COLORS.bad : COLORS.muted;
        const bg = ok === true ? COLORS.okBg : ok === false ? COLORS.badBg : "#F4EFEF";
        return (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 14 }}>
            <strong>{s.full_name}</strong>
            <span style={{ fontSize: 13, padding: "4px 10px", borderRadius: 100, background: bg, color: colour, textAlign: "right" }}>
              {ok === true ? "✓ " : ""}{text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canteen receipt: one short receipt, labels in English / French, same as the email.
const RECEIPT_PASS = { day: "Day / Journée", week: "Week / Semaine", month: "Month / Mois", term: "Term / Trimestre", year: "Year / Année" };

function printReceipt(p, student) {
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const d = (iso) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-GB");
  const no = `BIS-C-${String(p.receipt_no).padStart(4, "0")}`;
  const period = p.start_date === p.end_date ? d(p.start_date) : `${d(p.start_date)} – ${d(p.end_date)}`;
  const who = student ? `${student.full_name}${student.grade ? ` · ${student.grade}` : ""}` : "";
  const row = (k, v) => `<tr><td class="k">${k}</td><td>${esc(v)}</td></tr>`;
  // Shown inside the Hub (not a new tab), with a Close button to come back.
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
    <p class="sub">Canteen receipt / Reçu de cantine · <span class="muted">${no}</span></p>
    <table>
      ${row("Student / Élève", who)}
      ${row("Pass / Formule", RECEIPT_PASS[p.pass_type] || p.pass_type)}
      ${row("Period / Période", period)}
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

// ---------------------------------------------------------------------------
// Staff meals (2 500 FCFA a day). Kept in their own table, staff_meal_orders,
// so parents never see them. Staff screens are English only.

function staffMealDays() {
  const out = [];
  const today = new Date();
  for (let i = 1; i < 21 && out.length < 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const iso = toISO(d);
    if (!isOpen("day", iso)) continue;
    out.push({ value: iso, label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) });
  }
  return out;
}

// Any staff member: order and follow their own meals.
// Compact on purpose (Oct 2026): staff order one day at a time, so a single
// day picker replaces the long row of day buttons. `embedded` drops the card
// frame when it sits inside the admin's Staff meals panel.
function MyStaffMeals({ embedded = false }) {
  const [orders, setOrders] = useState([]);
  const [picked, setPicked] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [me, setMe] = useState(null);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id || null;
    setMe(uid);
    if (!uid) { setLoading(false); return; }
    const today = toISO(new Date());
    const { data, error } = await supabase
      .from("staff_meal_orders")
      .select("id, meal_date, amount, paid")
      .eq("staff_id", uid)
      .gte("meal_date", today)
      .order("meal_date");
    if (error) setStatus(error.message);
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const booked = orders.map((o) => o.meal_date);
  const days = staffMealDays().filter((d) => !booked.includes(d.value));
  const day = days.some((d) => d.value === picked) ? picked : (days[0]?.value || "");

  async function order() {
    if (!day) return;
    setSaving(true);
    setStatus("");
    const { error } = await supabase
      .from("staff_meal_orders")
      .insert({ staff_id: me, meal_date: day, amount: STAFF_MEAL_PRICE, paid: false });
    setSaving(false);
    if (error) { setStatus(error.message); return; }
    setStatus("Ordered. Please pay at the school office to confirm.");
    setPicked("");
    load();
  }

  async function cancel(id) {
    const { error } = await supabase.from("staff_meal_orders").delete().eq("id", id);
    if (error) { setStatus(error.message); return; }
    load();
  }

  const shortDate = (iso) => parseISO(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const frame = embedded ? {} : card;

  if (loading) return <div style={frame}>Loading…</div>;

  return (
    <div style={frame}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: embedded ? 14 : 15, fontWeight: 600 }}>My staff meals</p>
        <span style={{ fontSize: 12, color: COLORS.muted }}>{money(STAFF_MEAL_PRICE)} FCFA · order by 18:00 the day before</span>
      </div>

      {days.length === 0 ? (
        <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>No days open to order right now.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={day} onChange={(e) => setPicked(e.target.value)} style={{ ...input, width: "auto", flex: "1 1 150px" }}>
            {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <button style={{ ...primaryBtn, width: "auto", flex: "0 0 auto" }} disabled={saving || !day} onClick={order}>
            {saving ? "Sending…" : "Order"}
          </button>
        </div>
      )}

      {orders.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {orders.map((o) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 13 }}>
              <span>{shortDate(o.meal_date)}</span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ ...pill(o.paid ? "ok" : "bad"), padding: "2px 8px", fontSize: 12 }}>
                  {o.paid ? "Paid" : "Unpaid"}
                </span>
                {!o.paid && isOpen("day", o.meal_date) && (
                  <button onClick={() => cancel(o.id)} style={{ ...chip, borderColor: "#F09595", color: COLORS.bad, padding: "2px 8px", fontSize: 12 }}>Cancel</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {status && <p style={{ fontSize: 13, marginTop: 8, marginBottom: 0 }}>{status}</p>}
    </div>
  );
}

// Admin / accountant: everything about staff meals in ONE card that stays
// folded to a single line until opened (Oct 2026 — it was taking the page).
function StaffMealsPanel() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState({ tomorrow: 0, awaiting: 0 });
  const bits = [`${summary.tomorrow} tomorrow`];
  if (summary.awaiting > 0) bits.push(`${summary.awaiting} unpaid`);
  return (
    <div style={card}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ all: "unset", cursor: "pointer", display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 10 }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Staff meals</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: summary.awaiting > 0 ? COLORS.bad : COLORS.muted }}>
          {bits.join(" · ")}
          <span style={{ color: COLORS.muted, fontSize: 14 }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      <div style={{ display: open ? "block" : "none", marginTop: 12 }}>
        <StaffMealsOffice onSummary={setSummary} />
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
          <MyStaffMeals embedded />
        </div>
      </div>
    </div>
  );
}

// Admin / accountant: tomorrow's staff count, payments to confirm,
// and a staff meal paid at the office on the day (daily payment).
function StaffMealsOffice({ onSummary }) {
  const [orders, setOrders] = useState([]);
  const [names, setNames] = useState({});
  const [error, setError] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [who, setWho] = useState("");
  const [mealDate, setMealDate] = useState(toISO(new Date()));
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  async function load() {
    const today = toISO(new Date());
    const { data, error: err } = await supabase
      .from("staff_meal_orders")
      .select("id, staff_id, meal_date, amount, paid")
      .or(`meal_date.gte.${today},paid.eq.false`)
      .order("meal_date");
    if (err) { setError(err.message); return; }
    setOrders(data || []);
    const ids = Array.from(new Set((data || []).map((o) => o.staff_id)));
    if (ids.length) {
      const { data: people } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map = {};
      (people || []).forEach((p) => { map[p.id] = p.full_name || p.email; });
      setNames(map);
    }
  }

  async function loadStaff() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .in("role", STAFF_ROLES)
      .order("full_name");
    setStaffList(data || []);
  }

  useEffect(() => { load(); loadStaff(); }, []);

  // Record a meal paid today (or any day). If the person already ordered
  // that day, the order is simply marked as paid.
  async function recordPaid() {
    if (!who) { setNote("Choose a staff member."); return; }
    setSaving(true);
    setNote("");
    const { data: existing } = await supabase
      .from("staff_meal_orders")
      .select("id, paid")
      .eq("staff_id", who)
      .eq("meal_date", mealDate)
      .maybeSingle();
    let err = null;
    if (existing) {
      if (existing.paid) { setSaving(false); setNote("Already paid for that day."); return; }
      ({ error: err } = await supabase.from("staff_meal_orders").update({ paid: true }).eq("id", existing.id));
    } else {
      ({ error: err } = await supabase
        .from("staff_meal_orders")
        .insert({ staff_id: who, meal_date: mealDate, amount: STAFF_MEAL_PRICE, paid: true }));
    }
    setSaving(false);
    if (err) { setNote(err.message); return; }
    const person = staffList.find((p) => p.id === who);
    setNote(`Saved: ${person?.full_name || person?.email || "staff member"} · ${mealDate} · ${money(STAFF_MEAL_PRICE)} FCFA paid.`);
    setWho("");
    load();
  }

  async function confirm(id) {
    const { error: err } = await supabase.from("staff_meal_orders").update({ paid: true }).eq("id", id);
    if (err) { setError(err.message); return; }
    load();
  }

  const t = new Date();
  t.setDate(t.getDate() + 1);
  const tomorrow = toISO(t);
  const eating = orders.filter((o) => o.meal_date === tomorrow);
  const awaiting = orders.filter((o) => !o.paid);
  const nameOf = (id) => names[id] || "Staff member";

  useEffect(() => {
    if (onSummary) onSummary({ tomorrow: eating.length, awaiting: awaiting.length });
  }, [eating.length, awaiting.length]);

  return (
    <div>
      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: COLORS.bad }}>Could not load staff meals: {error}</p>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 14 }}>
            <strong>Tomorrow ({eating.length}):</strong>{" "}
            <span style={{ color: eating.length ? "inherit" : COLORS.muted }}>
              {eating.length ? eating.map((o) => nameOf(o.staff_id)).join(", ") : "nobody yet"}
            </span>
          </p>
          {awaiting.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: COLORS.muted }}>Awaiting payment ({awaiting.length})</p>
              {awaiting.map((o) => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${COLORS.line}`, fontSize: 13 }}>
                  <span>
                    <strong>{nameOf(o.staff_id)}</strong>
                    <span style={{ color: COLORS.muted }}> · {o.meal_date} · {money(o.amount)}</span>
                  </span>
                  <button onClick={() => confirm(o.id)} style={{ ...chip, borderColor: COLORS.ok, color: COLORS.ok, padding: "2px 10px", fontSize: 12 }}>Confirm</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
        <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>Record a meal paid at the office <span style={{ fontWeight: 400, fontSize: 12, color: COLORS.muted }}>· {money(STAFF_MEAL_PRICE)} FCFA</span></p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={who} onChange={(e) => setWho(e.target.value)} style={{ ...input, width: "auto", flex: "1 1 180px" }}>
            <option value="">Staff member…</option>
            {staffList.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </select>
          <input type="date" value={mealDate} onChange={(e) => setMealDate(e.target.value)} style={{ ...input, width: "auto" }} />
          <button style={{ ...primaryBtn, width: "auto", flex: "0 0 auto" }} disabled={saving || !who} onClick={recordPaid}>
            {saving ? "Saving…" : "Paid"}
          </button>
        </div>
        {note && <p style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>{note}</p>}
      </div>
    </div>
  );
}

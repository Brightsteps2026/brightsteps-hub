import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";

const PRICES = { day: 2700, week: 13000, month: 50000 };
// Parents can order by the day or the month only (week passes removed Oct 2026).
const PARENT_PASS_TYPES = ["day", "month"];
const STAFF_MEAL_PRICE = 2500;
const STAFF_ROLES = ["admin", "teacher", "learning_assistant", "accountant"];

const T = {
  balance: { en: "Canteen balance", fr: "Solde cantine" },
  payAtOffice: { en: "Pay at the school office to top up.", fr: "Rechargez au secrétariat." },
  day: { en: "Day", fr: "Journée" },
  week: { en: "Week", fr: "Semaine" },
  month: { en: "Month", fr: "Mois" },
  dayHint: { en: "Pick a day", fr: "Choisissez un jour" },
  weekHint: { en: "Monday to Friday", fr: "Du lundi au vendredi" },
  monthHint: { en: "All school days", fr: "Tous les jours de classe" },
  weekNudge: { en: "Need the whole week? The week pass is 13 000 and saves 500.", fr: "Toute la semaine ? La formule semaine est à 13 000 et économise 500." },
  order: { en: "Confirm order", fr: "Confirmer la commande" },
  ordering: { en: "Sending…", fr: "Envoi…" },
  myOrders: { en: "Orders", fr: "Commandes" },
  paid: { en: "Paid", fr: "Payé" },
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
  lunchPaidFor: { en: "Lunch paid for all of", fr: "Cantine payée pour tout le mois de" },
  lunchAwaitingFor: { en: "Ordered for all of", fr: "Commandée pour tout le mois de" },
  lunchAwaitingPay: { en: "please pay at the school office", fr: "merci de régler au secrétariat" },
  lunchDaysBooked: { en: "lunch days booked in", fr: "jours de cantine réservés en" },
  lunchNone: { en: "No lunch booked for", fr: "Aucune cantine réservée pour" },
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
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return d;
}

function isOpen(type, startISO) {
  return new Date() < deadlineFor(type, startISO);
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

  for (let i = 0; i < 4 && out.length < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const iso = toISO(d);
    if (!isOpen("month", iso)) continue;
    out.push({ value: iso, label: d.toLocaleDateString(locale, { month: "long", year: "numeric" }) });
  }
  return out;
}

const card = {
  background: "#fff",
  border: "1px solid #EAD7DA",
  borderRadius: 16,
  padding: 16,
  marginBottom: 14,
  boxShadow: "0 1px 3px rgba(36,16,18,0.06)"
};

const chip = {
  border: "1px solid #EAD7DA",
  borderRadius: 100,
  padding: "7px 13px",
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  color: "#3B4A4C"
};

const chipOn = { ...chip, background: "#801524", borderColor: "#801524", color: "#fff" };

const primaryBtn = {
  background: "#801524",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%"
};

export default function CanteenTab({ profile }) {
  const { language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const tr = (k) => T[k][language === "fr" ? "fr" : "en"];

  const role = profile?.role;
  const isParent = role === "parent";
  const canEdit = role === "admin" || role === "accountant";
  // Kitchen counts and passes: admin (and accountant) only. Teachers and learning
  // assistants only see their own staff meals.
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

  async function load() {
    setLoading(true);
    setError("");
    const s = await supabase.from("students").select("id, full_name, grade").order("full_name");
    if (s.error) { setError(s.error.message); setLoading(false); return; }
    const p = await supabase
      .from("canteen_passes")
      .select("id, student_id, pass_type, start_date, end_date, amount, paid")
      .order("start_date", { ascending: false });
    if (p.error) { setError(p.error.message); setLoading(false); return; }
    setStudents(s.data || []);
    setPasses(p.data || []);
    setLoading(false);
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
    const { error: err } = await supabase.from("canteen_passes").insert({
      student_id: studentId,
      pass_type: type,
      start_date: start,
      end_date: end,
      amount: PRICES[type],
      paid: markPaid
    });
    setSaving(false);
    if (err) { setStatus(err.message); return; }
    setStatus(markPaid ? `Saved. ${start} to ${end}.` : tr("saved"));
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
    load();
  }

  async function removePass(id) {
    const { error: err } = await supabase.from("canteen_passes").delete().eq("id", id);
    if (err) { setStatus(err.message); return; }
    load();
  }

  if (onlyOwnMeals) return <div style={{ padding: "16px 16px 90px" }}><MyStaffMeals /></div>;
  if (loading) return <div style={card}>{tr("loading")}</div>;
  if (error) return <div style={card}>Could not load: {error}</div>;

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
          <p style={{ margin: 0, fontSize: 13, color: "#6E7B7D" }}>{tr("balance")}</p>
          <p style={{ margin: "2px 0 6px", fontSize: 24, fontWeight: 600 }}>
            {money(profile?.canteen_balance || 0)} FCFA
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#6E7B7D" }}>{tr("payAtOffice")}</p>
        </div>

        <div style={card}>
          {students.length > 1 && (
            <>
              <p style={{ fontSize: 13, color: "#6E7B7D", margin: "0 0 8px" }}>{tr("whichChildren")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {students.map((s) => {
                  const covered = coveredIds.includes(s.id);
                  const on = !covered && chosen.includes(s.id);
                  return (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, fontSize: 14, cursor: covered ? "default" : "pointer", border: `1px solid ${on ? "#801524" : "#EAD7DA"}`, background: on ? "#F5E4E6" : "#fff", color: covered ? "#8A9698" : "inherit" }}>
                      <input type="checkbox" checked={on} disabled={covered} onChange={() => togglePick(s.id)} />
                      <span>{s.full_name}</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#6E7B7D" }}>{covered ? tr("alreadyCovered") : s.grade}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
            {PARENT_PASS_TYPES.map((t) => (
              <button key={t} onClick={() => setPassType(t)} style={passType === t ? chipOn : chip}>
                {tr(t)} · {money(PRICES[t])}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 13, color: "#6E7B7D", margin: "0 0 8px" }}>
            {passType === "day" ? tr("dayHint") : passType === "week" ? tr("weekHint") : tr("monthHint")}
          </p>

          {options.length === 0 ? (
            <p style={{ fontSize: 14, color: "#6E7B7D" }}>{tr("noneOpen")}</p>
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
          <p style={{ fontSize: 12, color: "#6E7B7D", marginTop: 12, marginBottom: 0 }}>{tr("deadline")}</p>
        </div>

        <div style={card}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>
            {tr("myOrders")}
          </p>
          {myPasses.length === 0 && <p style={{ fontSize: 14, color: "#6E7B7D", margin: 0 }}>{tr("noOrders")}</p>}
          {myPasses.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #EAD7DA", fontSize: 14 }}>
              <span>
                {students.length > 1 && <strong>{nameOf(p.student_id)} · </strong>}
                {p.pass_type === "month"
                  ? `${tr("month")} · ${parseISO(p.start_date).toLocaleDateString(locale, { month: "long", year: "numeric" })}`
                  : `${tr(p.pass_type)} · ${p.start_date}${p.end_date !== p.start_date ? ` → ${p.end_date}` : ""}`}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", padding: "4px 10px", borderRadius: 100, background: p.paid ? "#E6F2EC" : "#FCE8E8", color: p.paid ? "#2F7A5C" : "#B23A3A" }}>
                {p.paid ? tr("paid") : tr("awaiting")}
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
  const shown = term ? students.filter((s) => (s.full_name || "").toLowerCase().includes(term)) : students;
  const selectedPasses = selected ? passes.filter((p) => p.student_id === selected.id) : [];
  const awaiting = passes.filter((p) => !p.paid);

  return (
    <div style={{ padding: "16px 16px 90px" }}>
      <div style={card}>
        <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600 }}>Kitchen count for tomorrow</p>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6E7B7D" }}>{tomorrow}</p>
        <p style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 600 }}>{eatingTomorrow.length}</p>
        {unpaidTomorrow > 0 && (
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#B23A3A" }}>{unpaidTomorrow} not yet paid</p>
        )}
        {Object.keys(byGrade).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#6E7B7D" }}>No meals booked yet.</p>
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(byGrade).sort().map(([g, n]) => (
              <span key={g} style={{ fontSize: 14 }}>{g}: <strong>{n}</strong></span>
            ))}
          </div>
        )}
      </div>

      {canEdit && awaiting.length > 0 && (
        <div style={card}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>Awaiting payment ({awaiting.length})</p>
          {awaiting.map((p) => {
            const st = students.find((s) => s.id === p.student_id);
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #EAD7DA", fontSize: 14 }}>
                <span>
                  <strong>{st?.full_name || "—"}</strong>
                  <span style={{ color: "#6E7B7D" }}> · {tr(p.pass_type)} · {p.start_date} · {money(p.amount)}</span>
                </span>
                <button onClick={() => setPaid(p.id, true)} style={{ ...chip, borderColor: "#2F7A5C", color: "#2F7A5C" }}>
                  Confirm payment
                </button>
              </div>
            );
          })}
        </div>
      )}

      <StaffMealsOffice />

      <MyStaffMeals />

      {canEdit && <PassesList passes={passes} students={students} />}

      {canEdit && (
        <div style={card}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>Record a pass</p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a student"
            style={{ width: "100%", padding: "9px 10px", border: "1px solid #EAD7DA", borderRadius: 8, fontSize: 14, marginBottom: 10, background: "#FCFAF4" }}
          />

          <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #EAD7DA", borderRadius: 8, marginBottom: 14 }}>
            {shown.map((s) => (
              <div
                key={s.id}
                onClick={() => { setSelected(s); setStatus(""); }}
                style={{ padding: "8px 10px", cursor: "pointer", fontSize: 14, background: selected?.id === s.id ? "#F5E4E6" : "transparent", borderBottom: "1px solid #F4EFEF" }}
              >
                {s.full_name}
                <span style={{ color: "#8A9698", marginLeft: 8, fontSize: 13 }}>{s.grade}</span>
              </div>
            ))}
            {shown.length === 0 && <div style={{ padding: 10, color: "#8A9698", fontSize: 14 }}>No student found.</div>}
          </div>

          {selected && (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 14 }}>Selected: <strong>{selected.full_name}</strong></p>

              <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
                {["day", "week", "month"].map((t) => (
                  <button key={t} onClick={() => setPassType(t)} style={passType === t ? chipOn : chip}>
                    {tr(t)} · {money(PRICES[t])}
                  </button>
                ))}
              </div>

              <input
                type="date"
                value={staffDate}
                onChange={(e) => setStaffDate(e.target.value)}
                style={{ padding: "9px 10px", border: "1px solid #EAD7DA", borderRadius: 8, fontSize: 14, marginBottom: 10, background: "#FCFAF4" }}
              />

              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6E7B7D" }}>
                Covers {rangeFor(passType, staffDate).start} to {rangeFor(passType, staffDate).end}
              </p>

              <button style={primaryBtn} disabled={saving} onClick={() => createPass(selected.id, passType, staffDate, true)}>
                {saving ? "Saving…" : "Record as paid"}
              </button>

              {status && <p style={{ fontSize: 13, marginTop: 10 }}>{status}</p>}

              {selectedPasses.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, color: "#6E7B7D" }}>Passes for {selected.full_name}</p>
                  {selectedPasses.map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid #EAD7DA", fontSize: 14 }}>
                      <span>
                        {tr(p.pass_type)} · {p.start_date} → {p.end_date} · {money(p.amount)}
                        {!p.paid && <span style={{ color: "#B23A3A" }}> · unpaid</span>}
                      </span>
                      <button onClick={() => removePass(p.id)} style={{ ...chip, borderColor: "#F09595", color: "#A32D2D", padding: "4px 10px" }}>
                        Remove
                      </button>
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
  const kindLabel = { day: "Day", week: "Week", month: "Month" };

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
        {["all", "day", "week", "month"].map((k) => (
          <button key={k} onClick={() => setKind(k)} style={kind === k ? chipOn : chip}>
            {k === "all" ? "All" : kindLabel[k]}
          </button>
        ))}
      </div>

      {list.length === 0 && <p style={{ margin: 0, fontSize: 14, color: "#6E7B7D" }}>No passes for this month.</p>}
      {list.map((p) => (
        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #EAD7DA", fontSize: 14 }}>
          <span>
            <strong>{nameOf(p.student_id)}</strong>
            <span style={{ color: "#6E7B7D" }}> · {gradeOf(p.student_id)} · {kindLabel[p.pass_type] || p.pass_type} · {p.start_date} → {p.end_date} · {money(p.amount)}</span>
          </span>
          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 8, whiteSpace: "nowrap", background: p.paid ? "#E3F1EA" : "#FBE9E9", color: p.paid ? "#2F7A5C" : "#B23A3A" }}>
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
        const monthPass = mine.find((p) => p.pass_type === "month");
        let text, ok;
        if (monthPass && monthPass.paid) {
          ok = true; text = `${tr("lunchPaidFor")} ${monthName}`;
        } else if (monthPass) {
          ok = false; text = `${tr("lunchAwaitingFor")} ${monthName} · ${tr("lunchAwaitingPay")}`;
        } else if (mine.length > 0) {
          const days = mine.reduce((sum, p) => sum + schoolDays(p), 0);
          ok = mine.every((p) => p.paid);
          text = `${days} ${tr("lunchDaysBooked")} ${monthName}` + (ok ? "" : ` · ${tr("lunchAwaitingPay")}`);
        } else {
          ok = null; text = `${tr("lunchNone")} ${monthName}`;
        }
        const colour = ok === true ? "#2F7A5C" : ok === false ? "#B23A3A" : "#6E7B7D";
        const bg = ok === true ? "#E6F2EC" : ok === false ? "#FCE8E8" : "#F4EFEF";
        return (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid #EAD7DA", fontSize: 14 }}>
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
function MyStaffMeals() {
  const [orders, setOrders] = useState([]);
  const [picked, setPicked] = useState([]);
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
  const toggle = (iso) => setPicked(picked.includes(iso) ? picked.filter((x) => x !== iso) : [...picked, iso]);

  async function order() {
    if (picked.length === 0) { setStatus("Tick at least one day."); return; }
    setSaving(true);
    setStatus("");
    const { error } = await supabase
      .from("staff_meal_orders")
      .insert(picked.map((d) => ({ staff_id: me, meal_date: d, amount: STAFF_MEAL_PRICE, paid: false })));
    setSaving(false);
    if (error) { setStatus(error.message); return; }
    setStatus(`Ordered ${picked.length} meal${picked.length === 1 ? "" : "s"}. Please pay at the school office to confirm.`);
    setPicked([]);
    load();
  }

  async function cancel(id) {
    const { error } = await supabase.from("staff_meal_orders").delete().eq("id", id);
    if (error) { setStatus(error.message); return; }
    load();
  }

  if (loading) return <div style={card}>Loading…</div>;

  return (
    <>
      <div style={card}>
        <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600 }}>My staff meals</p>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6E7B7D" }}>{money(STAFF_MEAL_PRICE)} FCFA per meal · order by 18:00 the day before</p>

        {days.length === 0 ? (
          <p style={{ fontSize: 14, color: "#6E7B7D", margin: 0 }}>No days open to order right now.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
              {days.map((d) => (
                <button key={d.value} onClick={() => toggle(d.value)} style={picked.includes(d.value) ? chipOn : chip}>
                  {d.label}
                </button>
              ))}
            </div>
            <button style={primaryBtn} disabled={saving || picked.length === 0} onClick={order}>
              {saving ? "Sending…" : `Order ${picked.length || ""} meal${picked.length === 1 ? "" : "s"} · ${money(STAFF_MEAL_PRICE * picked.length)} FCFA`}
            </button>
          </>
        )}
        {status && <p style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>{status}</p>}
      </div>

      {orders.length > 0 && (
        <div style={card}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>My upcoming meals</p>
          {orders.map((o) => (
            <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #EAD7DA", fontSize: 14 }}>
              <span>{parseISO(o.meal_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {money(o.amount)}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", padding: "4px 10px", borderRadius: 100, background: o.paid ? "#E6F2EC" : "#FCE8E8", color: o.paid ? "#2F7A5C" : "#B23A3A" }}>
                  {o.paid ? "Paid" : "Awaiting payment"}
                </span>
                {!o.paid && isOpen("day", o.meal_date) && (
                  <button onClick={() => cancel(o.id)} style={{ ...chip, borderColor: "#F09595", color: "#A32D2D", padding: "4px 10px" }}>Cancel</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Admin / accountant: tomorrow's staff count and payments to confirm.
function StaffMealsOffice() {
  const [orders, setOrders] = useState([]);
  const [names, setNames] = useState({});
  const [error, setError] = useState("");

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

  useEffect(() => { load(); }, []);

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

  return (
    <div style={card}>
      <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600 }}>Staff meals tomorrow</p>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6E7B7D" }}>{tomorrow}</p>
      {error ? (
        <p style={{ margin: 0, fontSize: 13, color: "#B23A3A" }}>Could not load staff meals: {error}</p>
      ) : (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 600 }}>{eating.length}</p>
          {eating.length > 0 && (
            <p style={{ margin: "0 0 8px", fontSize: 14 }}>{eating.map((o) => nameOf(o.staff_id)).join(", ")}</p>
          )}
          {awaiting.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#6E7B7D" }}>Awaiting payment ({awaiting.length})</p>
              {awaiting.map((o) => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #EAD7DA", fontSize: 14 }}>
                  <span>
                    <strong>{nameOf(o.staff_id)}</strong>
                    <span style={{ color: "#6E7B7D" }}> · {o.meal_date} · {money(o.amount)}</span>
                  </span>
                  <button onClick={() => confirm(o.id)} style={{ ...chip, borderColor: "#2F7A5C", color: "#2F7A5C" }}>Confirm payment</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

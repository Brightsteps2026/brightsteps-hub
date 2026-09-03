import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";

const PRICES = { day: 2700, week: 13000, month: 50000 };

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
  const isStaff = canEdit || role === "teacher";

  const [students, setStudents] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const [childId, setChildId] = useState(null);
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

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const opts = upcomingOptions(passType, locale);
    setChoice(opts.length ? opts[0].value : "");
  }, [passType, locale]);

  useEffect(() => {
    if (!childId && students.length) setChildId(students[0].id);
  }, [students, childId]);

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

  if (loading) return <div style={card}>{tr("loading")}</div>;
  if (error) return <div style={card}>Could not load: {error}</div>;

  if (isParent) {
    if (students.length === 0) return <div style={card}>{tr("noChildren")}</div>;

    const options = upcomingOptions(passType, locale);
    const child = students.find((s) => s.id === childId);
    const myPasses = passes.filter((p) => p.student_id === childId);

    return (
      <div style={{ padding: "16px 16px 90px" }}>
        <div style={card}>
          <p style={{ margin: 0, fontSize: 13, color: "#6E7B7D" }}>{tr("balance")}</p>
          <p style={{ margin: "2px 0 6px", fontSize: 24, fontWeight: 600 }}>
            {money(profile?.canteen_balance || 0)} FCFA
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#6E7B7D" }}>{tr("payAtOffice")}</p>
        </div>

        {students.length > 1 && (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
            {students.map((s) => (
              <button key={s.id} onClick={() => setChildId(s.id)} style={childId === s.id ? chipOn : chip}>
                {s.full_name}
              </button>
            ))}
          </div>
        )}

        <div style={card}>
          <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
            {["day", "week", "month"].map((t) => (
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

              {passType === "day" && (
                <p style={{ fontSize: 12, color: "#8A6A2E", background: "#F5E4E6", borderRadius: 8, padding: "8px 10px", margin: "0 0 14px" }}>
                  {tr("weekNudge")}
                </p>
              )}

              <button style={primaryBtn} disabled={saving || !choice} onClick={() => createPass(childId, passType, choice, false)}>
                {saving ? tr("ordering") : `${tr("order")} · ${money(PRICES[passType])} FCFA`}
              </button>
            </>
          )}

          {status && <p style={{ fontSize: 13, marginTop: 10 }}>{status}</p>}
          <p style={{ fontSize: 12, color: "#6E7B7D", marginTop: 12, marginBottom: 0 }}>{tr("deadline")}</p>
        </div>

        <div style={card}>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>
            {tr("myOrders")}{child ? ` · ${child.full_name}` : ""}
          </p>
          {myPasses.length === 0 && <p style={{ fontSize: 14, color: "#6E7B7D", margin: 0 }}>{tr("noOrders")}</p>}
          {myPasses.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #EAD7DA", fontSize: 14 }}>
              <span>
                {tr(p.pass_type)} · {p.start_date}
                {p.end_date !== p.start_date ? ` → ${p.end_date}` : ""}
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
                  Mark paid
                </button>
              </div>
            );
          })}
        </div>
      )}

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
             

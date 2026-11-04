import { useEffect, useMemo, useState } from "react";
import { Eye, Lock, X, AlertCircle, CheckCircle2, Star, Receipt } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";

// School fees (tuition + registration), Nov 2026.
// Who sees what is decided by the database, not by this screen:
//   * Miss Myriam (the "office", table tuition_office) sees every family.
//   * A parent sees only their own family, and only once Myriam ticks "Share".
//   * Nobody else (accountant, viewer, other admin, teachers) gets any row back.

const RED = "#8E2626", RED_BG = "#FCE8E8";
const GREEN = "#22604A", GREEN_BG = "#E6F2EC";
const GOLD = "#6B4A00", GOLD_BG = "#F6E7C9";
const GREY = "#5E5456", GREY_BG = "#F4EFEF";
const MUTED = "#6B5457", LINE = "#EAD7DA", BURGUNDY = "#801524";

const T = {
  title: { en: "School fees", fr: "Frais de scolarité" },
  family: { en: "family", fr: "famille" },
  payer: { en: "Payer", fr: "Payeur" },
  overdue: { en: "Payment overdue", fr: "Paiement en retard" },
  wasDueOn: { en: "was due on", fr: "était dû le" },
  daysAgo: { en: "days ago", fr: "jours" },
  dayAgo: { en: "day ago", fr: "jour" },
  ago: { en: "", fr: "il y a" },
  payHow: {
    en: "Please pay at the school office or by Wave / Orange Money.",
    fr: "Merci de régler au secrétariat ou par Wave / Orange Money."
  },
  upToDate: { en: "Up to date — thank you", fr: "À jour — merci" },
  nextPayment: { en: "Next payment", fr: "Prochain paiement" },
  on: { en: "due by", fr: "à régler au plus tard le" },
  paidInFull: { en: "Paid in full — thank you", fr: "Payé en totalité — merci" },
  nothingMore: { en: "Nothing more to pay for 2026–2027.", fr: "Plus rien à payer pour 2026–2027." },
  balance: { en: "Balance remaining", fr: "Reste à payer" },
  total: { en: "Total for the year", fr: "Total de l'année" },
  paidSoFar: { en: "Paid so far", fr: "Déjà payé" },
  forChildren: { en: "Registration + tuition for", fr: "Inscription + scolarité pour" },
  and: { en: "and", fr: "et" },
  plan: { en: "Plan", fr: "Formule" },
  paymentPlan: { en: "Payment plan", fr: "Échéancier" },
  dueOn: { en: "Due by", fr: "À régler au plus tard le" },
  wasDue: { en: "Was due", fr: "Était dû le" },
  paid: { en: "Paid", fr: "Payé" },
  partPaid: { en: "Part paid", fr: "Payé en partie" },
  overdueTag: { en: "Overdue", fr: "En retard" },
  upcoming: { en: "Upcoming", fr: "À venir" },
  toConfirm: { en: "Amount to be confirmed", fr: "Montant à confirmer" },
  received: { en: "Payments received", fr: "Paiements reçus" },
  noPayments: { en: "No payment recorded yet.", fr: "Aucun paiement enregistré." },
  preparing: { en: "receipt being prepared", fr: "reçu en préparation" },
  view: { en: "View", fr: "Voir" },
  notIncluded: {
    en: "Uniforms, canteen and transport are not included. Questions about your account? Message Miss Myriam from the Messages tab.",
    fr: "Les uniformes, la cantine et le transport ne sont pas inclus. Une question ? Écrivez à Miss Myriam depuis l'onglet Messages."
  },
  scholarship: { en: "Scholarship", fr: "Bourse" },
  scholarshipName: { en: "BrightSteps Family Scholarship", fr: "Bourse familiale BrightSteps" },
  scholarshipBody: {
    en: "Registration and tuition for 2026–2027 are fully covered. There is nothing to pay.",
    fr: "L'inscription et la scolarité 2026–2027 sont entièrement prises en charge. Il n'y a rien à payer."
  },
  covered: { en: "Covered by the scholarship", fr: "Pris en charge par la bourse" },
  fullyCovered: { en: "Fully covered", fr: "Entièrement couvert" },
  scholarshipExtras: {
    en: "Uniforms, canteen and transport are not part of the scholarship.",
    fr: "Les uniformes, la cantine et le transport ne font pas partie de la bourse."
  },
  closed: { en: "This account is closed. Nothing is owed.", fr: "Ce compte est clôturé. Rien n'est dû." },
  loading: { en: "Loading…", fr: "Chargement…" },
  none: { en: "Your school fees are not available on the Hub yet.", fr: "Vos frais de scolarité ne sont pas encore disponibles sur le Hub." },
  receipt: { en: "Receipt", fr: "Reçu" },
  date: { en: "Date", fr: "Date" },
  method: { en: "Method", fr: "Mode de paiement" },
  registration: { en: "Registration", fr: "Inscription" },
  tuition: { en: "Tuition", fr: "Scolarité" },
  uniform: { en: "Uniform", fr: "Uniforme" },
  canteen: { en: "Canteen", fr: "Cantine" },
  other: { en: "Other", fr: "Autre" },
  close: { en: "Close", fr: "Fermer" },
  regLeft: { en: "still to pay", fr: "reste à payer" },
  amount: { en: "Amount", fr: "Montant" },
  leftHead: { en: "Left to pay", fr: "Reste" },
  left: { en: "left", fr: "reste" }
};

const money = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const todayISO = () => new Date().toISOString().slice(0, 10); // Abidjan = UTC
const parseISO = (iso) => new Date(iso + "T12:00:00Z");
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const card = { background: "#FFFFFF", border: `1px solid ${LINE}`, borderRadius: 16, padding: 18, marginBottom: 14 };
const pill = (bg, fg) => ({ fontSize: 12, padding: "3px 10px", borderRadius: 100, background: bg, color: fg, whiteSpace: "nowrap" });
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 0", borderTop: `1px solid ${LINE}` };

// ---------------------------------------------------------------------------
// Who may open the Fees tab. Office = Myriam; family = a parent with a shared account.
export function useFeesAccess(profile) {
  const [access, setAccess] = useState({ office: false, family: false });
  useEffect(() => {
    let live = true;
    if (!profile?.id || !["admin", "parent"].includes(profile.role)) {
      setAccess({ office: false, family: false });
      return;
    }
    (async () => {
      if (profile.role === "admin") {
        const { data } = await supabase.from("tuition_office").select("user_id").eq("user_id", profile.id).maybeSingle();
        if (live) setAccess({ office: !!data, family: false });
      } else {
        const { count } = await supabase.from("tuition_families").select("id", { count: "exact", head: true });
        if (live) setAccess({ office: false, family: (count || 0) > 0 });
      }
    })();
    return () => { live = false; };
  }, [profile?.id, profile?.role]);
  return access;
}

export default function FeesTab({ office }) {
  return office ? <OfficeFees /> : <ParentFees />;
}

// ---------------------------------------------------------------------------
// One-line fees status, used on the parent dashboard and on a child's profile.
// It shows nothing unless the database returns the family: so only Myriam, and the
// child's own parents once the family is shared. Teachers etc. never see it.
export const openFeesTab = () => window.dispatchEvent(new CustomEvent("bs-goto-tab", { detail: "fees" }));

function useStatusLine() {
  const { language } = useLanguage();
  const fr = language === "fr";
  const locale = fr ? "fr-FR" : "en-GB";
  const day = (iso) => parseISO(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return (s) => {
    if (s.standing === "scholarship") return { bg: GOLD_BG, fg: GOLD, icon: Star, text: fr ? "Bourse familiale BrightSteps — entièrement couvert" : "BrightSteps Family Scholarship — fully covered" };
    if (s.standing === "withdrawn") return { bg: GREY_BG, fg: GREY, icon: CheckCircle2, text: fr ? "Compte clôturé" : "Account closed" };
    if (s.standing === "paid_in_full") return { bg: GREEN_BG, fg: GREEN, icon: CheckCircle2, text: fr ? "Payé en totalité — merci" : "Paid in full — thank you" };
    if (s.standing === "past_due") {
      const amt = Number(s.past_due) > 0 ? `${money(s.past_due)} FCFA` : (fr ? "Montant à confirmer" : "Amount to be confirmed");
      return { bg: RED_BG, fg: RED, icon: AlertCircle, text: fr ? `Paiement en retard — ${amt} depuis le ${day(s.oldest_past)}` : `Payment overdue — ${amt} since ${day(s.oldest_past)}` };
    }
    const next = s.next_due_date && Number(s.next_due_amount) > 0
      ? (fr ? ` · prochain paiement ${money(s.next_due_amount)} FCFA à régler au plus tard le ${day(s.next_due_date)}` : ` · next payment ${money(s.next_due_amount)} FCFA due by ${day(s.next_due_date)}`)
      : "";
    return { bg: GREEN_BG, fg: GREEN, icon: CheckCircle2, text: (fr ? "À jour" : "Up to date") + next };
  };
}

function StatusLines({ rows, title }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  const line = useStatusLine();
  if (!rows || rows.length === 0) return null;
  return (
    <section className="bsf-card">
      <h2>{title || (fr ? "Frais de scolarité" : "School fees")}</h2>
      {rows.map((s) => {
        const l = line(s);
        const Icon = l.icon;
        return (
          <div key={s.family_id} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: l.bg, color: l.fg, borderRadius: 12, padding: "12px 14px", marginTop: 10 }}>
            <Icon size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 14, lineHeight: 1.4, flex: 1 }}>{rows.length > 1 ? <strong>{s.family_name} · </strong> : null}{l.text}</span>
          </div>
        );
      })}
      <button onClick={openFeesTab} style={{ marginTop: 10, background: "none", border: "none", color: BURGUNDY, textDecoration: "underline", cursor: "pointer", fontSize: 14, minHeight: 44, padding: 0, fontFamily: "inherit" }}>
        {fr ? "Voir le détail" : "See details"}
      </button>
    </section>
  );
}

// Parent dashboard: their own shared family account(s).
export function FeesDashboardCard() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from("tuition_family_status").select("*").then(({ data }) => setRows(data || []));
  }, []);
  return <StatusLines rows={rows} />;
}

// A child's profile. `legacyId` is the child's id in the Hub's school data.
export function FeesSummary({ legacyId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    setRows(null);
    if (!legacyId) return;
    (async () => {
      const { data: link } = await supabase.from("tuition_family_students")
        .select("family_id, students!inner(legacy_id)").eq("students.legacy_id", legacyId).limit(1);
      const fid = link?.[0]?.family_id;
      if (!fid) { if (live) setRows([]); return; }
      const { data } = await supabase.from("tuition_family_status").select("*").eq("family_id", fid);
      if (live) setRows(data || []);
    })();
    return () => { live = false; };
  }, [legacyId]);
  return <StatusLines rows={rows} />;
}

// ---------------------------------------------------------------------------
// Parent: every family account shared with them (normally one).
function ParentFees() {
  const { language } = useLanguage();
  const tr = (k) => (T[k] ? T[k][language === "fr" ? "fr" : "en"] : k);
  const [ids, setIds] = useState(null);
  useEffect(() => {
    supabase.from("tuition_families").select("id").order("family_name").then(({ data }) => setIds((data || []).map((d) => d.id)));
  }, []);
  return (
    <div className="bsf-screen">
      {ids === null ? <p style={{ color: MUTED }}>{tr("loading")}</p>
        : ids.length === 0 ? <div style={card}><p style={{ margin: 0 }}>{tr("none")}</p></div>
        : ids.map((id) => <FamilyFeesView key={id} familyId={id} />)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One family's fees, exactly as its parents see them. Used by parents and by Preview.
export function FamilyFeesView({ familyId }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  const tr = (k) => (T[k] ? T[k][fr ? "fr" : "en"] : k);
  const locale = fr ? "fr-FR" : "en-GB";
  const day = (iso) => (iso ? parseISO(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "");
  const [d, setD] = useState(null);
  const [openReceipt, setOpenReceipt] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [st, kids, sch, rec] = await Promise.all([
        supabase.from("tuition_family_status").select("*").eq("family_id", familyId).maybeSingle(),
        supabase.from("tuition_family_students").select("student_id, students(full_name, grade)").eq("family_id", familyId),
        supabase.from("tuition_schedule").select("*").eq("family_id", familyId).neq("status", "cancelled").order("due_date"),
        supabase.from("tuition_receipts").select("*").eq("family_id", familyId).neq("receipt_status", "cancelled").order("payment_date", { ascending: true, nullsFirst: false })
      ]);
      if (live) setD({ st: st.data, kids: kids.data || [], sch: sch.data || [], rec: rec.data || [] });
    })();
    return () => { live = false; };
  }, [familyId]);

  if (!d) return <p style={{ color: MUTED }}>{tr("loading")}</p>;
  if (!d.st) return <div style={card}><p style={{ margin: 0 }}>{tr("none")}</p></div>;
  const s = d.st;
  const today = todayISO();
  const children = d.kids.map((k) => k.students).filter(Boolean);
  const names = children.map((c) => `${c.full_name} (${c.grade})`);
  const nameList = names.length > 1 ? `${names.slice(0, -1).join(", ")} ${tr("and")} ${names[names.length - 1]}` : names[0] || "";

  const header = (
    <div className="bsf-hero">
      <p className="bsf-eyebrow">2026–2027</p>
      <h1>{tr("title")}</h1>
      <p className="bsf-hero-sub">
        {fr ? `${tr("family")} ${s.family_name}` : `${s.family_name} ${tr("family")}`}
        {s.payer_name ? ` · ${tr("payer")} : ${s.payer_name}`.replace(" :", fr ? " :" : ":") : ""}
      </p>
    </div>
  );

  if (s.standing === "scholarship") {
    return (
      <div>
        {header}
        <div style={{ ...card, background: BURGUNDY, color: "#FFFFFF", border: "none", padding: "24px 22px" }}>
          <Star size={30} color="#F3D9A4" aria-hidden="true" />
          <p style={{ margin: "12px 0 4px", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#F3D9A4" }}>{tr("scholarship")}</p>
          <p style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 24, lineHeight: 1.2 }}>{tr("scholarshipName")}</p>
          <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.5, color: "#F7E9EB" }}>{tr("scholarshipBody")}</p>
        </div>
        <div style={card}>
          <h2 style={{ margin: "0 0 10px", fontSize: 15, fontFamily: "inherit" }}>{tr("covered")}</h2>
          {children.map((c) => (
            <div key={c.full_name} style={row}>
              <div><strong style={{ fontSize: 14 }}>{c.full_name}</strong><div style={{ fontSize: 12, color: MUTED }}>{c.grade}</div></div>
              <span style={pill(GREEN_BG, GREEN)}>{tr("fullyCovered")}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: MUTED, margin: "0 4px 16px" }}>{tr("scholarshipExtras")}</p>
      </div>
    );
  }

  const pct = s.total_due > 0 ? Math.min(100, Math.round((s.paid / s.total_due) * 100)) : 0;
  const overdueRows = d.sch.filter((r) => r.status === "due" && r.due_date < today);
  const nextRow = d.sch.find((r) => r.status === "due" && r.due_date >= today);
  const lateDays = s.oldest_past ? daysBetween(s.oldest_past, today) : 0;
  const late = lateDays === 1 ? `1 ${tr("dayAgo")}` : `${lateDays} ${tr("daysAgo")}`;

  let banner = null;
  if (s.standing === "withdrawn") {
    banner = { bg: GREY_BG, fg: GREY, icon: CheckCircle2, title: tr("closed"), body: "" };
  } else if (s.standing === "past_due") {
    const amt = overdueRows.some((r) => r.amount == null) ? tr("toConfirm") : `${money(s.past_due)} FCFA`;
    banner = { bg: RED_BG, fg: RED, icon: AlertCircle, title: tr("overdue"),
      body: `${amt} ${tr("wasDueOn")} ${day(s.oldest_past)} (${fr ? `${tr("ago")} ${late}` : `${late}`}). ${tr("payHow")}` };
  } else if (s.standing === "paid_in_full") {
    banner = { bg: GREEN_BG, fg: GREEN, icon: CheckCircle2, title: tr("paidInFull"), body: tr("nothingMore") };
  } else {
    banner = { bg: GREEN_BG, fg: GREEN, icon: CheckCircle2, title: tr("upToDate"),
      body: nextRow ? `${tr("nextPayment")} : ${nextRow.amount == null ? tr("toConfirm") : `${money(nextRow.amount - nextRow.received)} FCFA`} ${tr("on")} ${day(nextRow.due_date)}.`.replace(" :", fr ? " :" : ":") : "" };
  }
  const BIcon = banner.icon;

  const statusOf = (r) => {
    if (r.status === "paid") return [tr("paid"), GREEN_BG, GREEN];
    if (r.due_date < today) return [tr("overdueTag"), RED_BG, RED];
    if (r.received > 0) return [tr("partPaid"), GOLD_BG, GOLD];
    return [tr("upcoming"), GREY_BG, GREY];
  };

  return (
    <div>
      {header}
      <div style={{ ...card, background: banner.bg, color: banner.fg, border: "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <BIcon size={22} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong style={{ fontSize: 15 }}>{banner.title}</strong>
          {banner.body && <div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 4 }}>{banner.body}</div>}
        </div>
      </div>

      {s.standing !== "withdrawn" && (
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED }}>{tr("balance")}</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 30, margin: "2px 0 12px" }}>{money(s.balance)} FCFA</div>
          <div style={{ height: 8, borderRadius: 8, background: "#F1E4E6", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: 8, background: "#2F7A5C" }} />
          </div>
          {(() => {
            // Registration and tuition shown separately (Myri, 4 Nov 2026).
            const regDue = Number(s.registration_due) || 0, regPaid = Math.min(Number(s.registration_paid) || 0, regDue || Infinity);
            const tuiDue = Number(s.total_due) - regDue, tuiPaid = Number(s.paid) - regPaid;
            const cell = { padding: "8px 0", borderTop: `1px solid ${LINE}`, textAlign: "right" };
            const line = (name, due, paidAmt) => (
              <tr>
                <td style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{name}</td>
                <td style={cell}>{money(due)}</td>
                <td style={{ ...cell, color: "#2F7A5C" }}>{money(paidAmt)}</td>
                <td style={{ ...cell, fontWeight: 600, color: due - paidAmt > 0 ? "#241012" : GREEN }}>{due - paidAmt > 0 ? money(due - paidAmt) : "✓"}</td>
              </tr>
            );
            return (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 12 }}>
                <thead>
                  <tr style={{ color: MUTED, fontSize: 12 }}>
                    <th style={{ textAlign: "left", fontWeight: 400, paddingBottom: 4 }}></th>
                    <th style={{ textAlign: "right", fontWeight: 400 }}>{tr("amount")}</th>
                    <th style={{ textAlign: "right", fontWeight: 400 }}>{tr("paid")}</th>
                    <th style={{ textAlign: "right", fontWeight: 400 }}>{tr("leftHead")}</th>
                  </tr>
                </thead>
                <tbody>
                  {regDue > 0 && line(tr("registration"), regDue, regPaid)}
                  {line(tr("tuition"), tuiDue, tuiPaid)}
                  <tr>
                    <td style={{ ...cell, textAlign: "left", fontWeight: 700 }}>Total</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{money(s.total_due)}</td>
                    <td style={{ ...cell, fontWeight: 700, color: "#2F7A5C" }}>{money(s.paid)}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>{Number(s.balance) > 0 ? money(s.balance) : "✓"}</td>
                  </tr>
                </tbody>
              </table>
            );
          })()}
          {nameList && (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: MUTED, lineHeight: 1.4 }}>
              {tr("forChildren")} {nameList}.{s.payment_plan ? ` ${tr("plan")} : ${s.payment_plan}.`.replace(" :", fr ? " :" : ":") : ""}
            </p>
          )}
        </div>
      )}

      {d.sch.length > 0 && s.standing !== "withdrawn" && (
        <div style={card}>
          <h2 style={{ margin: "0 0 10px", fontSize: 15, fontFamily: "inherit" }}>{tr("paymentPlan")}</h2>
          {d.sch.map((r) => {
            const [label, bg, fg] = statusOf(r);
            const isLate = r.status === "due" && r.due_date < today;
            return (
              <div key={r.id} style={row}>
                <div>
                  <strong style={{ fontSize: 14 }}>{r.label}</strong>
                  <div style={{ fontSize: 12, color: isLate ? RED : MUTED }}>{isLate ? tr("wasDue") : tr("dueOn")} {day(r.due_date)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 14 }}>{r.amount == null ? tr("toConfirm") : money(r.amount)}</span>
                  {r.status === "due" && r.received > 0 && r.amount != null && (
                    <span style={{ fontSize: 12, color: MUTED }}>{tr("paid")} {money(r.received)} · {tr("left")} {money(r.amount - r.received)}</span>
                  )}
                  <span style={pill(bg, fg)}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={card}>
        <h2 style={{ margin: "0 0 10px", fontSize: 15, fontFamily: "inherit" }}>{tr("received")}</h2>
        {d.rec.length === 0 && <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{tr("noPayments")}</p>}
        {d.rec.map((r) => (
          <div key={r.id} style={row}>
            <div>
              <strong style={{ fontSize: 14 }}>{r.receipt_no || money(r.total)}</strong>
              <div style={{ fontSize: 12, color: MUTED }}>
                {[r.payment_date ? day(r.payment_date) : null, r.method, r.registration > 0 ? `${tr("registration")} ${money(r.registration)}` : null, r.tuition > 0 ? `${tr("tuition")} ${money(r.tuition)}` : null, r.receipt_status === "receipt_pending" ? tr("preparing") : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            {r.receipt_no && (
              <button onClick={() => setOpenReceipt(r)} style={{ background: "none", border: "none", color: BURGUNDY, textDecoration: "underline", fontSize: 13, minHeight: 44, cursor: "pointer", fontFamily: "inherit" }}>
                {tr("view")}
              </button>
            )}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: MUTED, margin: "0 4px 16px", lineHeight: 1.5 }}>{tr("notIncluded")}</p>

      {openReceipt && <ReceiptModal r={openReceipt} family={s} tr={tr} day={day} onClose={() => setOpenReceipt(null)} />}
    </div>
  );
}

function ReceiptModal({ r, family, tr, day, onClose }) {
  const lines = [["registration", r.registration], ["tuition", r.tuition], ["uniform", r.uniform], ["canteen", r.canteen], ["other", r.other]].filter(([, v]) => v > 0);
  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(36,16,18,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }} onClick={onClose}>
      <div style={{ ...card, maxWidth: 420, width: "100%", margin: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: BURGUNDY }}>BrightSteps International School</span>
          <button onClick={onClose} aria-label={tr("close")} style={{ background: "none", border: "none", cursor: "pointer", minWidth: 44, minHeight: 44 }}><X size={18} /></button>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13 }}>{tr("receipt")} · <span style={{ color: MUTED }}>{r.receipt_no}</span></p>
        <div style={row}><span style={{ color: MUTED }}>{tr("payer")}</span><span>{family.payer_name || family.family_name}</span></div>
        <div style={row}><span style={{ color: MUTED }}>{tr("date")}</span><span>{day(r.payment_date)}</span></div>
        {r.method && <div style={row}><span style={{ color: MUTED }}>{tr("method")}</span><span>{r.method}</span></div>}
        {lines.map(([k, v]) => <div key={k} style={row}><span style={{ color: MUTED }}>{tr(k)}</span><span>{money(v)}</span></div>)}
        <div style={{ ...row, fontWeight: 700 }}><span>Total</span><span>{money(r.total)} FCFA</span></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Myriam only. Staff screens are English only.
const STANDING = {
  past_due: ["Past due", RED_BG, RED],
  up_to_date: ["Up to date", GREEN_BG, GREEN],
  paid_in_full: ["Paid in full", GREEN_BG, GREEN],
  scholarship: ["Scholarship", GOLD_BG, GOLD],
  withdrawn: ["Withdrawn", GREY_BG, GREY]
};
const ORDER = ["past_due", "up_to_date", "paid_in_full", "scholarship", "withdrawn"];

function OfficeFees() {
  const [rows, setRows] = useState(null);
  const [kids, setKids] = useState({});
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState(null);
  const [recording, setRecording] = useState(false); // false, or { family: id } to pre-fill
  const [openFamily, setOpenFamily] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const [st, fs] = await Promise.all([
      supabase.from("tuition_family_status").select("*"),
      supabase.from("tuition_family_students").select("family_id, students(full_name)")
    ]);
    if (st.error) { setError(st.error.message); return; }
    const k = {};
    (fs.data || []).forEach((x) => { (k[x.family_id] ||= []).push((x.students?.full_name || "").split(" ")[0]); });
    setKids(k);
    setRows((st.data || []).sort((a, b) =>
      ORDER.indexOf(a.standing) - ORDER.indexOf(b.standing) || Number(b.past_due) - Number(a.past_due) || Number(b.balance) - Number(a.balance)));
  }
  useEffect(() => { load(); }, []);

  async function toggleShare(r) {
    const next = !r.shared_with_family;
    setRows((rs) => rs.map((x) => (x.family_id === r.family_id ? { ...x, shared_with_family: next } : x)));
    const { error: e } = await supabase.from("tuition_families").update({ shared_with_family: next }).eq("id", r.family_id);
    if (e) { setError(e.message); load(); }
  }

  const totals = useMemo(() => {
    const paying = (rows || []).filter((r) => !["scholarship", "withdrawn"].includes(r.standing));
    const sum = (f) => paying.reduce((n, r) => n + Number(r[f] || 0), 0);
    return {
      families: paying.length, due: sum("total_due"), paid: sum("paid"), balance: sum("balance"), past: sum("past_due"),
      pastFamilies: paying.filter((r) => r.standing === "past_due").length
    };
  }, [rows]);

  if (error) return <div className="bsf-screen"><div style={{ ...card, color: RED }}>Could not load fees: {error}</div></div>;
  if (!rows) return <div className="bsf-screen"><p style={{ color: MUTED }}>Loading…</p></div>;

  const count = (k) => rows.filter((r) => r.standing === k).length;
  const shown = rows.filter((r) => filter === "all" || r.standing === filter);
  const chips = [["all", `All ${rows.length}`], ...ORDER.map((k) => [k, `${STANDING[k][0]} ${count(k)}`])];
  const pct = totals.due ? Math.round((totals.paid / totals.due) * 100) : 0;
  const tile = { ...card, marginBottom: 0, display: "flex", flexDirection: "column", gap: 4 };
  const short = (iso) => (iso ? parseISO(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

  return (
    <div className="bsf-screen">
      <div className="bsf-hero" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="bsf-eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}><Lock size={12} /> Visible to you only</p>
          <h1>Tuition 2026–2027</h1>
          <p className="bsf-hero-sub">Registration + tuition only · as of {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <button className="bsf-btn" onClick={() => setRecording(true)} style={{ minHeight: 44 }}>Record a payment</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
        <div style={tile}><span style={{ fontSize: 13, color: MUTED }}>Expected this year</span><span style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>{money(totals.due)}</span><span style={{ fontSize: 12, color: MUTED }}>{totals.families} paying families</span></div>
        <div style={tile}><span style={{ fontSize: 13, color: MUTED }}>Collected</span><span style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: "#2F7A5C" }}>{money(totals.paid)}</span><span style={{ fontSize: 12, color: MUTED }}>{pct}% of the year</span></div>
        <div style={tile}><span style={{ fontSize: 13, color: MUTED }}>Still to collect (whole year)</span><span style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>{money(totals.balance)}</span><span style={{ fontSize: 12, color: MUTED }}>incl. instalments not yet due</span></div>
        <div style={{ ...tile, background: RED_BG, border: "none", color: RED }}><span style={{ fontSize: 13 }}>Past due today</span><span style={{ fontFamily: "'Fraunces', serif", fontSize: 24 }}>{money(totals.past)}</span><span style={{ fontSize: 12 }}>{totals.pastFamilies} families</span></div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {chips.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ minHeight: 40, padding: "0 14px", borderRadius: 100, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            background: filter === k ? BURGUNDY : "#FFFFFF", color: filter === k ? "#FFFFFF" : "#241012", border: `1px solid ${filter === k ? BURGUNDY : LINE}` }}>{label}</button>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <th style={{ padding: "14px 16px" }}>Family</th><th style={{ padding: 14 }}>Status</th>
              <th style={{ padding: 14, textAlign: "right" }}>Past due</th><th style={{ padding: 14, textAlign: "right" }}>Balance (year)</th>
              <th style={{ padding: 14 }}>Next payment</th><th style={{ padding: 14 }}>Check</th><th style={{ padding: "14px 16px" }}>Family can see</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const [label, bg, fg] = STANDING[r.standing] || [r.standing, GREY_BG, GREY];
              const checks = [];
              if (Number(r.unscheduled) > 0) checks.push(`${money(r.unscheduled)} not in any instalment`);
              if (r.needs_review && Number(r.unscheduled) === 0) checks.push("Amount to confirm");
              if (Number(r.receipts_pending) > 0) checks.push(`${r.receipts_pending} receipt${r.receipts_pending > 1 ? "s" : ""} to issue`);
              return (
                <tr key={r.family_id} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={() => setOpenFamily(r)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit", minHeight: 44 }}>
                      <strong style={{ color: BURGUNDY, textDecoration: "underline", fontSize: 14 }}>{r.family_name}</strong>
                      <div style={{ fontSize: 12, color: MUTED }}>{(kids[r.family_id] || []).join(", ")}</div>
                    </button>
                  </td>
                  <td style={{ padding: 12 }}><span style={pill(bg, fg)}>{label}</span></td>
                  <td style={{ padding: 12, textAlign: "right" }}>
                    {r.standing === "past_due"
                      ? <><strong style={{ color: RED }}>{Number(r.past_due) > 0 ? money(r.past_due) : "?"}</strong><div style={{ fontSize: 12, color: MUTED }}>{r.days_late} day{r.days_late === 1 ? "" : "s"}</div></>
                      : <span style={{ color: MUTED }}>—</span>}
                  </td>
                  <td style={{ padding: 12, textAlign: "right" }}>{money(r.balance)}</td>
                  <td style={{ padding: 12, fontSize: 13 }}>{r.next_due_date ? `${money(r.next_due_amount)} · ${short(r.next_due_date)}` : "—"}</td>
                  <td style={{ padding: 12, fontSize: 12, color: "#8A4B00" }}>{checks.join(" · ")}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <button onClick={() => setPreview(r)} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, background: "none", border: "none", color: BURGUNDY, cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0 }}>
                        <Eye size={16} /> Preview
                      </button>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: MUTED, minHeight: 44, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!r.shared_with_family} onChange={() => toggleShare(r)} style={{ width: 18, height: 18, accentColor: BURGUNDY }} /> Share
                      </label>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, maxWidth: 900 }}>
        “Preview” shows exactly what that family's parents see, even before you share it. A family sees its fees only after you tick “Share”.
        Nobody else on the Hub — the accountant, the viewer, the other admin account or teachers — can see this page or any family's fees.
      </p>

      {preview && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "#FBF7F3", zIndex: 50, overflowY: "auto" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 1, background: BURGUNDY, color: "#FFFFFF", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14 }}>
              <Eye size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              Preview — this is what the {preview.family_name} family sees{preview.shared_with_family ? "" : " (not shared yet)"}
            </span>
            <button onClick={() => setPreview(null)} style={{ background: "#FFFFFF", color: BURGUNDY, border: "none", borderRadius: 100, padding: "0 16px", minHeight: 40, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Close preview</button>
          </div>
          <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
            <FamilyFeesView familyId={preview.family_id} />
          </div>
        </div>
      )}

      {openFamily && !recording && (
        <FamilyOffice fam={openFamily} onClose={() => setOpenFamily(null)} onChanged={load}
          onRecord={() => setRecording({ family: openFamily.family_id })} onPreview={() => { setPreview(openFamily); setOpenFamily(null); }} />
      )}
      {recording && <RecordPayment families={rows.filter((r) => r.standing !== "scholarship")} preset={recording.family || ""} onClose={() => setRecording(false)} onSaved={() => { setRecording(false); load(); }} />}
    </div>
  );
}

async function nextReceiptNo() {
  const { data } = await supabase.from("tuition_receipts").select("receipt_no").like("receipt_no", "BIS-2026-%");
  const max = Math.max(0, ...(data || []).map((x) => parseInt(String(x.receipt_no).split("-")[2], 10) || 0));
  return `BIS-2026-${String(max + 1).padStart(3, "0")}`;
}

// Myriam's panel for one family: status, registration, every payment, and
// "Issue receipt" for payments recorded without a receipt yet.
function FamilyOffice({ fam, onClose, onChanged, onRecord, onPreview }) {
  const [st, setSt] = useState(fam);
  const [rec, setRec] = useState(null);
  const [sch, setSch] = useState([]);
  const [issuing, setIssuing] = useState(null); // receipt row being issued
  const [form, setForm] = useState({ no: "", date: todayISO(), method: "Cash" });
  const [msg, setMsg] = useState("");
  const short = (iso) => (iso ? parseISO(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "no date");

  async function load() {
    const [a, b, c] = await Promise.all([
      supabase.from("tuition_family_status").select("*").eq("family_id", fam.family_id).maybeSingle(),
      supabase.from("tuition_receipts").select("*").eq("family_id", fam.family_id).neq("receipt_status", "cancelled").order("payment_date", { ascending: true, nullsFirst: false }),
      supabase.from("tuition_schedule").select("*").eq("family_id", fam.family_id).neq("status", "cancelled").order("due_date")
    ]);
    if (a.data) setSt(a.data);
    setRec(b.data || []);
    setSch(c.data || []);
  }
  useEffect(() => { load(); }, [fam.family_id]);

  async function startIssue(r) {
    setMsg("");
    setIssuing(r);
    setForm({ no: await nextReceiptNo(), date: r.payment_date || todayISO(), method: r.method || "Cash" });
  }
  async function issue() {
    if (!form.no.trim()) { setMsg("Enter the receipt number."); return; }
    const { error } = await supabase.from("tuition_receipts")
      .update({ receipt_no: form.no.trim(), payment_date: form.date || null, method: form.method, receipt_status: "issued" })
      .eq("id", issuing.id);
    if (error) { setMsg(error.message.includes("duplicate") ? "That receipt number is already used." : error.message); return; }
    setIssuing(null); load(); onChanged();
  }

  const input = { padding: 10, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, background: "#FCFAF4", fontFamily: "inherit", minHeight: 44, boxSizing: "border-box" };
  const [label, bg, fg] = STANDING[st.standing] || [st.standing, GREY_BG, GREY];
  const regLeft = Number(st.registration_due) - Number(st.registration_paid);

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(36,16,18,0.45)", display: "flex", justifyContent: "flex-end", zIndex: 55 }} onClick={onClose}>
      <div style={{ background: "#FBF7F3", width: "100%", maxWidth: 560, height: "100%", overflowY: "auto", padding: 18, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>{st.family_name}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", minWidth: 44, minHeight: 44 }}><X size={20} /></button>
        </div>
        <p style={{ margin: "2px 0 12px", color: MUTED, fontSize: 13 }}>{st.payer_name || "—"}{st.payment_plan ? ` · ${st.payment_plan}` : ""}</p>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={pill(bg, fg)}>{label}</span>
            {Number(st.past_due) > 0 && <strong style={{ color: RED }}>{money(st.past_due)} past due</strong>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12, fontSize: 13 }}>
            <div><div style={{ color: MUTED }}>Total</div><strong>{money(st.total_due)}</strong></div>
            <div><div style={{ color: MUTED }}>Paid</div><strong style={{ color: "#2F7A5C" }}>{money(st.paid)}</strong></div>
            <div><div style={{ color: MUTED }}>Balance</div><strong>{money(st.balance)}</strong></div>
          </div>
          {Number(st.registration_due) > 0 && (
            <div style={{ ...row, marginTop: 12, fontSize: 13 }}>
              <span>Registration · {money(st.registration_due)}</span>
              {regLeft <= 0 ? <span style={pill(GREEN_BG, GREEN)}>Paid</span> : <span style={pill(RED_BG, RED)}>{money(regLeft)} not recorded</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <button className="bsf-btn" onClick={onRecord} style={{ minHeight: 44 }}>Record a payment</button>
            <button onClick={onPreview} style={{ minHeight: 44, background: "none", border: `1px solid ${LINE}`, borderRadius: 10, padding: "0 14px", cursor: "pointer", color: BURGUNDY, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}><Eye size={16} /> Preview</button>
          </div>
        </div>

        <div style={card}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Payments and receipts</h3>
          {rec === null && <p style={{ color: MUTED }}>Loading…</p>}
          {rec && rec.length === 0 && <p style={{ color: MUTED, margin: 0 }}>No payment recorded yet.</p>}
          {(rec || []).map((r) => (
            <div key={r.id} style={{ borderTop: `1px solid ${LINE}`, padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{money(r.total)} FCFA</strong>
                  <div style={{ fontSize: 12, color: MUTED }}>
                    {[short(r.payment_date), r.method, r.description, r.registration > 0 ? `incl. registration ${money(r.registration)}` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {r.receipt_status === "issued"
                  ? <span style={pill(GREEN_BG, GREEN)}>{r.receipt_no}</span>
                  : <button className="bsf-btn" onClick={() => startIssue(r)} style={{ minHeight: 40, whiteSpace: "nowrap" }}>Issue receipt</button>}
              </div>
              {issuing?.id === r.id && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: MUTED, gridColumn: "1 / -1" }}>Receipt number<input value={form.no} onChange={(e) => setForm({ ...form, no: e.target.value })} style={input} /></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: MUTED }}>Date paid<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={input} /></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: MUTED }}>Method
                    <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={input}>
                      {["Cash", "Wave", "Orange Money", "Cheque", "Bank transfer", "Direct deposit"].map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </label>
                  {msg && <p style={{ color: RED, fontSize: 13, margin: 0, gridColumn: "1 / -1" }}>{msg}</p>}
                  <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
                    <button className="bsf-btn" onClick={issue} style={{ minHeight: 44 }}>Save receipt</button>
                    <button onClick={() => setIssuing(null)} style={{ minHeight: 44, background: "none", border: "none", cursor: "pointer", color: MUTED, fontFamily: "inherit" }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {sch.length > 0 && (
          <div style={card}>
            <h3 style={{ margin: "0 0 6px", fontSize: 15 }}>Payment plan</h3>
            {sch.map((r) => (
              <div key={r.id} style={{ ...row, fontSize: 13 }}>
                <div><strong>{r.label}</strong><div style={{ color: MUTED, fontSize: 12 }}>{short(r.due_date)}{r.amount_status !== "confirmed" ? " · amount to confirm" : ""}</div></div>
                <div style={{ textAlign: "right" }}>
                  <div>{r.amount == null ? "?" : money(r.amount)}</div>
                  <div style={{ fontSize: 12, color: r.status === "paid" ? GREEN : MUTED }}>{r.status === "paid" ? "Paid" : r.received > 0 ? `${money(r.received)} received` : "Due"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecordPayment({ families, preset = "", onClose, onSaved }) {
  const [f, setF] = useState({ family: preset, date: todayISO(), receipt: "", registration: "", tuition: "", uniform: "", canteen: "", other: "", method: "Cash", description: "", status: "issued" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    nextReceiptNo().then((no) => setF((p) => (p.receipt ? p : { ...p, receipt: no })));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (v) => Math.max(0, parseInt(String(v).replace(/\s/g, ""), 10) || 0);
  const total = num(f.registration) + num(f.tuition) + num(f.uniform) + num(f.canteen) + num(f.other);
  const input = { width: "100%", boxSizing: "border-box", padding: "10px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, background: "#FCFAF4", fontFamily: "inherit", minHeight: 44 };
  const lab = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: MUTED };

  async function save() {
    if (!f.family) { setMsg("Choose a family."); return; }
    if (total <= 0) { setMsg("Enter at least one amount."); return; }
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("tuition_record_payment", {
      p_family: f.family, p_date: f.date || null, p_receipt_no: f.status === "issued" ? f.receipt : "",
      p_registration: num(f.registration), p_tuition: num(f.tuition), p_uniform: num(f.uniform), p_canteen: num(f.canteen), p_other: num(f.other),
      p_method: f.method, p_description: f.description, p_status: f.status
    });
    setBusy(false);
    if (error) { setMsg(error.message.includes("duplicate") ? "That receipt number is already used." : error.message); return; }
    onSaved();
  }

  return (
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(36,16,18,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, zIndex: 60, overflowY: "auto" }}>
      <div style={{ ...card, maxWidth: 520, width: "100%", margin: "24px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20, display: "flex", alignItems: "center", gap: 8 }}><Receipt size={20} /> Record a payment</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", minWidth: 44, minHeight: 44 }}><X size={18} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ ...lab, gridColumn: "1 / -1" }}>Family
            <select value={f.family} onChange={set("family")} style={input}>
              <option value="">Choose…</option>
              {[...families].sort((a, b) => a.family_name.localeCompare(b.family_name)).map((r) => <option key={r.family_id} value={r.family_id}>{r.family_name} — balance {money(r.balance)}</option>)}
            </select>
          </label>
          <label style={lab}>Date paid<input type="date" value={f.date} onChange={set("date")} style={input} /></label>
          <label style={lab}>Receipt
            <select value={f.status} onChange={set("status")} style={input}>
              <option value="issued">Receipt issued</option>
              <option value="receipt_pending">Receipt not yet issued</option>
            </select>
          </label>
          {f.status === "issued" && <label style={{ ...lab, gridColumn: "1 / -1" }}>Receipt number<input value={f.receipt} onChange={set("receipt")} style={input} /></label>}
          <label style={lab}>Registration<input inputMode="numeric" value={f.registration} onChange={set("registration")} style={input} /></label>
          <label style={lab}>Tuition<input inputMode="numeric" value={f.tuition} onChange={set("tuition")} style={input} /></label>
          <label style={lab}>Uniform<input inputMode="numeric" value={f.uniform} onChange={set("uniform")} style={input} /></label>
          <label style={lab}>Canteen<input inputMode="numeric" value={f.canteen} onChange={set("canteen")} style={input} /></label>
          <label style={lab}>Other (e.g. transport)<input inputMode="numeric" value={f.other} onChange={set("other")} style={input} /></label>
          <label style={lab}>Method
            <select value={f.method} onChange={set("method")} style={input}>
              {["Cash", "Wave", "Orange Money", "Cheque", "Bank transfer", "Direct deposit"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label style={{ ...lab, gridColumn: "1 / -1" }}>Note on the receipt<input value={f.description} onChange={set("description")} placeholder="e.g. instalment 2 of 3" style={input} /></label>
        </div>
        <p style={{ margin: "14px 0 4px", fontSize: 15 }}>Total: <strong>{money(total)} FCFA</strong></p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: MUTED }}>Registration + tuition are counted against the oldest instalment still due. Uniform, canteen and other are kept separate.</p>
        {msg && <p style={{ color: RED, fontSize: 13, margin: "0 0 10px" }}>{msg}</p>}
        <button className="bsf-btn" onClick={save} disabled={busy} style={{ width: "100%", minHeight: 44 }}>{busy ? "Saving…" : "Save payment"}</button>
      </div>
    </div>
  );
}

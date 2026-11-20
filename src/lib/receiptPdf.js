// Official tuition receipt as a printable PDF (20 Nov 2026).
// Built in the browser from the receipt data, so every issued receipt can be downloaded and printed.
// English first, then French on each line. Used by FeesTab (parents and office).
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MAROON = [122, 21, 48];
const GOLD = [201, 162, 39];
const TINT = [243, 236, 238];
const CREAM = [253, 248, 236];
const GREY = [102, 102, 102];

export const fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function dateBoth(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS_EN[m - 1]} ${y} / ${d} ${MONTHS_FR[m - 1]} ${y}`;
}

// ---------- amount in words ----------
const EN_ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function en999(n) {
  const h = Math.floor(n / 100), r = n % 100;
  const parts = [];
  if (h) parts.push(`${EN_ONES[h]} hundred`);
  if (r) parts.push(r < 20 ? EN_ONES[r] : EN_TENS[Math.floor(r / 10)] + (r % 10 ? "-" + EN_ONES[r % 10] : ""));
  return parts.join(" ");
}
export function wordsEn(n) {
  n = Math.round(n);
  if (n === 0) return "zero";
  const m = Math.floor(n / 1e6), t = Math.floor((n % 1e6) / 1000), u = n % 1000;
  const out = [];
  if (m) out.push(`${en999(m)} million`);
  if (t) out.push(`${en999(t)} thousand`);
  if (u) out.push(en999(u));
  const s = out.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const FR_ONES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
function fr99(n) {
  if (n <= 16) return FR_ONES[n];
  if (n < 20) return "dix-" + FR_ONES[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? "soixante" : "quatre-vingt";
    const rest = 10 + u;
    return base + (t === 7 && u === 1 ? "-et-" : "-") + fr99(rest);
  }
  const TENS = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante", 8: "quatre-vingt" };
  if (u === 0) return t === 8 ? "quatre-vingts" : TENS[t];
  if (u === 1 && t !== 8) return TENS[t] + "-et-un";
  return TENS[t] + "-" + FR_ONES[u];
}
function fr999(n, last) {
  const h = Math.floor(n / 100), r = n % 100;
  const parts = [];
  if (h) parts.push(h === 1 ? "cent" : FR_ONES[h] + (r === 0 && last ? " cents" : " cent"));
  if (r) parts.push(fr99(r));
  return parts.join(" ");
}
export function wordsFr(n) {
  n = Math.round(n);
  if (n === 0) return "zéro";
  const m = Math.floor(n / 1e6), t = Math.floor((n % 1e6) / 1000), u = n % 1000;
  const out = [];
  if (m) out.push(m === 1 ? "un million" : `${fr999(m, true)} millions`);
  if (t) out.push(t === 1 ? "mille" : `${fr999(t, false)} mille`);
  if (u) out.push(fr999(u, true));
  const s = out.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PLAN_FR = (p) => String(p || "").replace(/instalments?/i, "versements").replace(/^1 versements/, "1 versement");

// data = { receipt, family (tuition_family_status row), kids: [{full_name, grade}], schedule: [rows], breakdown: [{en, fr, amount}] | null }
export function buildReceiptPdf({ receipt: r, family: f, kids = [], schedule = [], breakdown = null }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14, CW = W - 2 * M;
  let y = 12;

  // Header band
  doc.setFillColor(...MAROON); doc.rect(M, y, CW, 15, "F");
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(M, y + 15, M + CW, y + 15);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("BRIGHTSTEPS INTERNATIONAL SCHOOL", W / 2, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("Mockeyville, Grand-Bassam, Côte d'Ivoire  |  Tel: 07 10 11 01 33  |  finance@bischoolci.org", W / 2, y + 12, { align: "center" });
  y += 23;
  doc.setTextColor(...MAROON); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("OFFICIAL RECEIPT  /  REÇU OFFICIEL", W / 2, y, { align: "center" });
  y += 4;

  const kidNames = kids.map((k) => k.full_name).join(", ") || "—";
  const grades = [...new Set(kids.map((k) => k.grade).filter(Boolean))].join(", ") || "—";
  const label = (en, fr) => ({ content: `${en}\n${fr}`, styles: { fontStyle: "bold", fillColor: TINT } });
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: MAROON, lineWidth: 0.25, textColor: 20, valign: "middle" },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 61 }, 2: { cellWidth: 30 }, 3: { cellWidth: 61 } },
    body: [
      [label("Receipt No.", "Reçu n°"), { content: r.receipt_no || "—", styles: { fontStyle: "bold" } }, label("Date", "Date"), dateBoth(r.payment_date)],
      [label("Received from", "Reçu de"), { content: f.payer_name || f.family_name, styles: { fontStyle: "bold" } }, label("School year", "Année scolaire"), "2026–2027"],
      [label("Student", "Élève"), { content: kidNames, styles: { fontStyle: "bold" } }, label("Grade / Class", "Classe"), grades],
      [label("Plan", "Plan"), `${f.payment_plan || "—"} / ${PLAN_FR(f.payment_plan) || "—"}`, label("Payment method", "Mode de paiement"), r.method || "—"]
    ]
  });
  y = doc.lastAutoTable.finalY + 6;

  const sectionTitle = (t) => {
    doc.setTextColor(...MAROON); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    doc.text(t, M, y); y += 2;
  };
  const twoLine = (en, fr) => ({ content: `${en}\n${fr}` });
  const amount = (n, opts = {}) => ({ content: n === "" ? "" : fcfa(n), styles: { halign: "right", ...opts } });
  const head = (a, b) => [[{ content: a, styles: { fillColor: MAROON, textColor: 255, fontStyle: "bold" } }, { content: b, styles: { fillColor: MAROON, textColor: 255, fontStyle: "bold", halign: "right" } }]];

  // 1. Payment received
  sectionTitle("1. Payment received / Paiement reçu");
  const lines = [];
  if (Number(r.registration) > 0) lines.push([twoLine("Registration fee — non-refundable", "Frais d'inscription — non remboursables"), amount(r.registration)]);
  const dFr = r.description ? r.description.replace(/instalment/gi, "versement").replace(/payment/gi, "versement") : "";
  if (Number(r.tuition) > 0) lines.push([twoLine(`Tuition${r.description ? ` — ${r.description}` : ""}`, `Scolarité${dFr ? ` — ${dFr}` : ""}`), amount(r.tuition)]);
  if (Number(r.uniform) > 0) lines.push([twoLine("Uniform", "Uniforme"), amount(r.uniform)]);
  if (Number(r.canteen) > 0) lines.push([twoLine("Canteen", "Cantine"), amount(r.canteen)]);
  if (Number(r.other) > 0) lines.push([twoLine("Other", "Autre"), amount(r.other)]);
  lines.push([{ content: "TOTAL RECEIVED / TOTAL REÇU", styles: { fillColor: MAROON, textColor: 255, fontStyle: "bold" } }, amount(r.total, { fillColor: MAROON, textColor: 255, fontStyle: "bold" })]);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "grid", head: head("DESCRIPTION", "FCFA"), body: lines,
    styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [221, 221, 221], lineWidth: 0.2, textColor: 20 },
    columnStyles: { 1: { cellWidth: 40 } }
  });
  y = doc.lastAutoTable.finalY + 3;

  doc.setFillColor(...CREAM); doc.setDrawColor(226, 201, 138); doc.setLineWidth(0.3);
  doc.rect(M, y, CW, 15, "FD");
  doc.setTextColor(20); doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold"); doc.text("Amount in words:", M + 3, y + 5);
  doc.setFont("helvetica", "normal"); doc.text(`${wordsEn(r.total)} CFA francs.`, M + 31, y + 5);
  doc.setFont("helvetica", "bold"); doc.text("Montant en lettres :", M + 3, y + 10.5);
  doc.setFont("helvetica", "normal"); doc.text(`${wordsFr(r.total)} francs CFA.`, M + 34, y + 10.5);
  y += 22;

  // 2. Tuition account
  const today = new Date().toISOString().slice(0, 10);
  sectionTitle(`2. Tuition account on ${dateBoth(today).split(" / ")[0]} / Compte scolarité au ${dateBoth(today).split(" / ")[1]}`);
  const acct = [];
  if (Array.isArray(breakdown) && breakdown.length) {
    breakdown.forEach((b) => acct.push([twoLine(b.en, b.fr), amount(b.amount, b.bold ? { fontStyle: "bold" } : {})]));
  } else {
    acct.push([twoLine("Total for the year (registration + tuition)", "Total de l'année (inscription + scolarité)"), amount(f.total_due, { fontStyle: "bold" })]);
  }
  acct.push([twoLine("Paid to date", "Total réglé à ce jour"), amount(-Number(f.paid || 0))]);
  acct.push([{ content: "Balance remaining\nSolde restant dû", styles: { fontStyle: "bold", fillColor: [251, 243, 228] } }, amount(f.balance, { fontStyle: "bold", fillColor: [251, 243, 228] })]);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "grid", head: head("ITEM / ÉLÉMENT", "FCFA"), body: acct,
    styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [221, 221, 221], lineWidth: 0.2, textColor: 20 },
    columnStyles: { 1: { cellWidth: 40 } },
    didParseCell: (h) => { if (h.section === "body" && h.column.index === 1 && typeof h.cell.raw?.content === "string" && h.cell.raw.content.startsWith("-")) h.cell.text = ["- " + h.cell.raw.content.slice(1)]; }
  });
  y = doc.lastAutoTable.finalY + 4;

  const frLabel = (l) => {
    const m = String(l || "").match(/^Payment (\d+)(?: of (\d+))?/i);
    if (m) return `${l} / Versement ${m[1]}${m[2] ? ` sur ${m[2]}` : ""}`;
    if (/remaining tuition/i.test(l || "")) return "Remaining tuition / Solde de scolarité";
    return l || "Instalment / Versement";
  };
  const remaining = schedule
    .filter((s) => s.status !== "cancelled" && Number(s.amount) - Number(s.received || 0) > 0)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  if (remaining.length) {
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: "grid",
      head: [[
        { content: "REMAINING INSTALMENTS / VERSEMENTS RESTANTS", styles: { fillColor: MAROON, textColor: 255, fontStyle: "bold" } },
        { content: "DUE DATE / ÉCHÉANCE", styles: { fillColor: MAROON, textColor: 255, fontStyle: "bold", halign: "center" } },
        { content: "FCFA", styles: { fillColor: MAROON, textColor: 255, fontStyle: "bold", halign: "right" } }
      ]],
      body: remaining.map((s) => [frLabel(s.label), { content: dateBoth(s.due_date), styles: { halign: "center" } }, amount(Number(s.amount) - Number(s.received || 0))]),
      styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [221, 221, 221], lineWidth: 0.2, textColor: 20 },
      columnStyles: { 2: { cellWidth: 40 } }
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  doc.setTextColor(...GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(doc.splitTextToSize("Registration is non-refundable. Uniform and canteen are billed separately and are not part of the tuition balance. / Les frais d'inscription ne sont pas remboursables. L'uniforme et la cantine sont facturés séparément.", CW), M, y + 2);
  y = Math.min(y + 10, 268);

  // Signatures
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(M, y, M + CW, y);
  doc.setTextColor(20); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Parent / Guardian — Parent / Tuteur", M, y + 5);
  doc.text("For the School — Pour l'école", M + CW / 2 + 4, y + 5);
  doc.setDrawColor(40); doc.setLineWidth(0.2);
  doc.line(M, y + 14, M + CW / 2 - 10, y + 14);
  doc.line(M + CW / 2 + 4, y + 14, M + CW - 6, y + 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GREY);
  doc.text("Name, signature & date / Nom, signature et date", M, y + 18);
  doc.text("Director / Directrice — Date & stamp / Date et cachet", M + CW / 2 + 4, y + 18);

  doc.setDrawColor(...GOLD); doc.line(M, 289, M + CW, 289);
  doc.setFontSize(7); doc.setTextColor(60);
  doc.text("BrightSteps International School — Mockeyville, Grand-Bassam — This receipt is proof of payment. Please keep it. / Ce reçu fait foi de paiement. Veuillez le conserver.", W / 2, 293, { align: "center" });

  doc.setProperties({ title: `Receipt ${r.receipt_no} - ${f.family_name}`, author: "BrightSteps International School" });
  return doc;
}

export function receiptFileName(r, f) {
  return `Receipt_${r.receipt_no || "BrightSteps"}_${String(f.family_name || "").replace(/[^A-Za-z0-9-]+/g, "")}.pdf`;
}

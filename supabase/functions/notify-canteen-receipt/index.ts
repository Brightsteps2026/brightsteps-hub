// BrightSteps Hub: notify-canteen-receipt
// Emails a short canteen payment receipt (labels in English / French) to every parent
// linked to the child, as soon as the office records or confirms the payment.
// Each receipt is emailed once (canteen_passes.receipt_emailed_at); send { id, resend: true }
// to send it again on purpose.
//
// Deploy in Supabase > Edge Functions with the name notify-canteen-receipt.
// Keep "Verify JWT" ON. Uses the RESEND_API_KEY secret, like the other emails.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUB = "https://hub.bischoolci.org";
const PASS: Record<string, string> = {
  day: "Day / Journée",
  week: "Week / Semaine",
  month: "Month / Mois",
  term: "Term / Trimestre",
  year: "Year / Année",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n: number) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const receiptNo = (n: number | null) => `BIS-C-${String(n ?? 0).padStart(4, "0")}`;
// 02/11/2026: reads the same in English and French.
const day = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("en-GB", { timeZone: "Africa/Abidjan" });
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type Pass = {
  id: string; student_id: string; pass_type: string; start_date: string; end_date: string;
  amount: number; paid: boolean; receipt_no: number | null; paid_at: string | null; receipt_emailed_at: string | null;
};

// One short receipt, each label written once in both languages ("Student / Élève").
function emailFor(p: Pass, student: string, grade: string) {
  const no = receiptNo(p.receipt_no);
  const period = p.start_date === p.end_date ? day(p.start_date) : `${day(p.start_date)} – ${day(p.end_date)}`;
  const row = (k: string, v: string) =>
    `<tr><td style="color:#7A5A5E;padding:4px 0">${k}</td><td style="text-align:right;padding:4px 0">${esc(v)}</td></tr>`;
  const subject = `Receipt / Reçu ${no}`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#241012;line-height:1.5;max-width:420px">
      <p style="font-family:Georgia,serif;font-size:18px;color:#801524;margin:0">BrightSteps International School</p>
      <p style="font-size:13px;margin:2px 0 12px">Canteen receipt / Reçu de cantine · <span style="color:#7A5A5E">${no}</span></p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #EAD7DA">
        ${row("Student / Élève", grade ? `${student} · ${grade}` : student)}
        ${row("Pass / Formule", PASS[p.pass_type] || p.pass_type)}
        ${row("Period / Période", period)}
        ${row("Paid / Payé le", day(p.paid_at || new Date().toISOString()))}
        <tr><td style="padding:8px 0 0;border-top:1px solid #EAD7DA;font-weight:bold">Total</td>
            <td style="padding:8px 0 0;border-top:1px solid #EAD7DA;text-align:right;font-weight:bold">${money(p.amount)} FCFA</td></tr>
      </table>
      <p style="font-size:12px;color:#7A5A5E;margin:12px 0 0">Thank you / Merci · <a href="${HUB}" style="color:#801524">hub.bischoolci.org</a></p>
    </div>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: who } = await supabase.auth.getUser(token);
    if (!who?.user) return json({ error: "Not signed in" }, 401);

    const { data: me } = await supabase.from("profiles").select("role").eq("id", who.user.id).single();
    if (!["admin", "accountant"].includes(me?.role)) return json({ error: "Only the office can send receipts" }, 403);

    const { id, resend } = await req.json();
    if (!id) return json({ error: "No payment" }, 400);

    const { data: p, error } = await supabase.from("canteen_passes")
      .select("id, student_id, pass_type, start_date, end_date, amount, paid, receipt_no, paid_at, receipt_emailed_at")
      .eq("id", id).single();
    if (error || !p) return json({ error: error?.message || "Payment not found" }, 404);
    if (!p.paid) return json({ error: "This pass is not paid yet" }, 400);
    if (p.receipt_emailed_at && !resend) return json({ sent: 0, already: true });

    const { data: stu } = await supabase.from("students")
      .select("id, legacy_id, full_name, grade").eq("id", p.student_id).maybeSingle();
    if (!stu) return json({ error: "Student not found" }, 404);

    // Parents of this child: the guardian links, plus the older student_ids list on profiles.
    const parentIds = new Set<string>();
    const { data: links } = await supabase.from("student_guardians").select("parent_id").eq("student_id", stu.id);
    (links || []).forEach((l) => l.parent_id && parentIds.add(l.parent_id));
    if (stu.legacy_id) {
      const { data: old } = await supabase.from("profiles").select("id, student_ids").eq("role", "parent");
      (old || []).forEach((o) => { if (list(o.student_ids).includes(String(stu.legacy_id))) parentIds.add(o.id); });
    }
    if (parentIds.size === 0) return json({ sent: 0, parents: 0 });

    const { data: parents } = await supabase.from("profiles").select("id, email").in("id", [...parentIds]);
    const seen = new Set<string>();
    const to: string[] = [];
    for (const par of parents || []) {
      let addr = (par.email || "").trim();
      if (!addr) {
        const { data: u } = await supabase.auth.admin.getUserById(par.id);
        addr = (u?.user?.email || "").trim();
      }
      if (addr && !seen.has(addr.toLowerCase())) { seen.add(addr.toLowerCase()); to.push(addr); }
    }
    if (to.length === 0) return json({ sent: 0, parents: 0 });

    const { subject, html } = emailFor(p as Pass, stu.full_name || "", stu.grade || "");
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(to.map((addr) => ({
        from: "BrightSteps International School <notifications@bischoolci.org>", to: addr, subject, html,
      }))),
    });
    if (!res.ok) return json({ error: await res.text() }, 502);

    await supabase.from("canteen_passes").update({ receipt_emailed_at: new Date().toISOString() }).eq("id", id);
    return json({ sent: to.length, parents: to.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

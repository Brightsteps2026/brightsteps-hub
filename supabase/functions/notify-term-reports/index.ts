// BrightSteps Hub: notify-term-reports
// Emails parents when their child's term report card is published on the Hub.
// The email only says the report card is ready and links to the Hub: the report
// card itself (grades, comments, photos) is never attached or copied into it.
// Each report card is emailed once (term_reports.emailed_at); publishing it again
// after a correction does not email the family a second time.
//
// The Reports tab calls this right after the admin publishes. The bell notice is
// made by the database (term_reports_notify), so it still arrives if email fails.
//
// Deploy in Supabase > Edge Functions with the name notify-term-reports.
// Keep "Verify JWT" ON. Uses the RESEND_API_KEY secret, like the other emails.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUB = "https://hub.bischoolci.org";

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type Report = { id: string; hub_student_id: string; term: number; school_year: string; content: { student?: { name?: string } } };

function emailFor(children: Report[]) {
  const names = children.map((r) => r.content?.student?.name || "your child");
  const term = children[0].term;
  const year = children[0].school_year.replace("-", "–");
  const listEn = names.length === 1 ? esc(names[0]) : names.slice(0, -1).map(esc).join(", ") + " and " + esc(names[names.length - 1]);
  const listFr = names.length === 1 ? esc(names[0]) : names.slice(0, -1).map(esc).join(", ") + " et " + esc(names[names.length - 1]);
  const many = names.length > 1;

  const subject = `Term ${term} report card${many ? "s" : ""} · Bulletin${many ? "s" : ""} du trimestre ${term}`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#241012;line-height:1.6;max-width:560px">
      <p style="font-family:Georgia,serif;font-size:20px;color:#801524;margin:0 0 16px">BrightSteps International School</p>

      <p>Dear Parent,</p>
      <p>The Term ${term} (${year}) report card${many ? "s" : ""} for <strong>${listEn}</strong> ${many ? "are" : "is"} now available on the BrightSteps Hub.
      Sign in, open <em>My child</em>, then <em>Reports</em>. You can read ${many ? "them" : "it"} in English or French and print a copy.
      A signed paper copy will also come home in your child's bag.</p>
      <p><a href="${HUB}" style="display:inline-block;background:#801524;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Open the Hub</a></p>
      <p>If you have any questions, please reply through the Hub messages or contact the school office.</p>
      <p>Warm regards,<br>BrightSteps International School</p>

      <hr style="border:none;border-top:1px solid #EAD7DA;margin:24px 0">

      <p>Chers parents,</p>
      <p>${many ? "Les bulletins" : "Le bulletin"} du trimestre ${term} (${year}) de <strong>${listFr}</strong> ${many ? "sont disponibles" : "est disponible"} sur le BrightSteps Hub.
      Connectez-vous, ouvrez <em>Mon enfant</em>, puis <em>Bulletins</em>. Vous pouvez ${many ? "les" : "le"} lire en anglais ou en français et en imprimer une copie.
      Une copie papier signée sera également remise dans le cartable de votre enfant.</p>
      <p><a href="${HUB}" style="display:inline-block;background:#801524;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Ouvrir le Hub</a></p>
      <p>Pour toute question, écrivez-nous via la messagerie du Hub ou contactez le secrétariat.</p>
      <p>Bien cordialement,<br>BrightSteps International School</p>
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
    if (me?.role !== "admin") return json({ error: "Only the admin can send report card emails" }, 403);

    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) return json({ sent: 0 });

    // Published, not emailed yet.
    const { data: reports, error } = await supabase.from("term_reports")
      .select("id, hub_student_id, term, school_year, content")
      .in("id", ids).eq("status", "published").is("emailed_at", null);
    if (error) return json({ error: error.message }, 500);
    if (!reports || reports.length === 0) return json({ sent: 0, families: 0 });

    // Parents of these children (a parent with two children gets one email).
    const hubIds = Array.from(new Set(reports.map((r) => r.hub_student_id).filter(Boolean)));
    const { data: parents } = await supabase.from("profiles").select("id, student_ids").eq("role", "parent");
    const byParent = new Map<string, Report[]>();
    (parents || []).forEach((p) => {
      const mine = (reports as Report[]).filter((r) => (p.student_ids || []).includes(r.hub_student_id));
      if (mine.length && hubIds.length) byParent.set(p.id, mine);
    });

    // The parent's sign-in email is the address they use for the Hub.
    const emails: { to: string; subject: string; html: string }[] = [];
    const noEmail: string[] = [];
    for (const [pid, mine] of byParent) {
      const { data: u } = await supabase.auth.admin.getUserById(pid);
      const to = u?.user?.email;
      if (!to) { noEmail.push(pid); continue; }
      const { subject, html } = emailFor(mine);
      emails.push({ to, subject, html });
    }

    // Resend batch: up to 100 emails per call.
    let sent = 0;
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100).map((e) => ({ from: "BrightSteps International School <notifications@bischoolci.org>", ...e }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) return json({ error: await res.text(), sent }, 502);
      sent += chunk.length;
    }

    // Children with at least one parent emailed are marked, so nobody is emailed twice.
    const emailedHubIds = new Set<string>();
    for (const [pid, mine] of byParent) if (!noEmail.includes(pid)) mine.forEach((r) => emailedHubIds.add(r.hub_student_id));
    const done = (reports as Report[]).filter((r) => emailedHubIds.has(r.hub_student_id)).map((r) => r.id);
    if (done.length) await supabase.from("term_reports").update({ emailed_at: new Date().toISOString() }).in("id", done);

    const noParent = (reports as Report[]).filter((r) => ![...byParent.values()].some((m) => m.includes(r)))
      .map((r) => r.content?.student?.name || r.hub_student_id);
    return json({ sent, families: sent, noParent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

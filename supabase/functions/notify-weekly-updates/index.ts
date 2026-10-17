// BrightSteps Hub: notify-weekly-updates
// Emails each family when their child's weekly update has been sent on the Hub
// (English first, then French). The email only says the update is ready and links
// to the Hub, where the family reads it and confirms: the note itself stays on the Hub.
// Each update is emailed once (weekly_updates.emailed_at). The bell notice is made by
// the database (weekly_send), so it still arrives if email fails.
//
// Deploy in Supabase > Edge Functions with the name notify-weekly-updates.
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

const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

function joinNames(names: string[], and: string) {
  return names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + ` ${and} ` + names[names.length - 1];
}

function emailFor(names: string[]) {
  const en = esc(joinNames(names, "and"));
  const fr = esc(joinNames(names, "et"));
  const many = names.length > 1;
  const subject = many
    ? "This week's updates · Les points de la semaine"
    : `${names[0]}'s weekly update · Le point de la semaine de ${names[0]}`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#241012;line-height:1.6;max-width:560px">
      <p style="font-family:Georgia,serif;font-size:20px;color:#801524;margin:0 0 16px">BrightSteps International School</p>
      <p>Dear Parent,</p>
      <p>This week's update for <strong>${en}</strong> is on the BrightSteps Hub. Sign in, open <em>My child</em>, read it, and press <em>Confirm I've read it</em> at the bottom.</p>
      <p><a href="${HUB}" style="display:inline-block;background:#801524;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Open the Hub</a></p>
      <p>Warm regards,<br>BrightSteps International School</p>
      <hr style="border:none;border-top:1px solid #EAD7DA;margin:24px 0">
      <p>Chers parents,</p>
      <p>Le point de la semaine de <strong>${fr}</strong> est sur le BrightSteps Hub. Connectez-vous, ouvrez <em>Mon enfant</em>, lisez-le, puis appuyez sur <em>Je confirme ma lecture</em> en bas de la page.</p>
      <p><a href="${HUB}" style="display:inline-block;background:#801524;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Ouvrir le Hub</a></p>
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

    const { grade, week } = await req.json();
    if (!grade || !week) return json({ error: "Missing class or week" }, 400);

    const { data: me } = await supabase.from("profiles").select("*").eq("id", who.user.id).single();
    const teaches = [...list(me?.grades_assigned), ...list(me?.assigned_grades)].includes(grade) && !list(me?.assistant_grades).includes(grade);
    if (!(me?.role === "admin" || (me?.role === "teacher" && teaches))) return json({ error: "Only the admin or the class teacher can send" }, 403);

    const { data: rows, error } = await supabase.from("weekly_updates")
      .select("id, student_id").eq("grade", grade).eq("week_start", week).eq("status", "sent").is("emailed_at", null);
    if (error) return json({ error: error.message }, 500);
    if (!rows || rows.length === 0) return json({ sent: 0 });

    const { data: kids } = await supabase.from("students").select("id, legacy_id, full_name").in("id", rows.map((r) => r.student_id));
    const byLegacy = new Map<string, { id: string; first: string }>();
    (kids || []).forEach((k) => byLegacy.set(k.legacy_id, { id: k.id, first: (k.full_name || "").trim().split(/\s+/)[0] || "your child" }));

    const { data: parents } = await supabase.from("profiles").select("id, email, student_ids").eq("role", "parent");
    const emails: { to: string; subject: string; html: string }[] = [];
    const reached = new Set<string>();
    const seen = new Set<string>();
    for (const p of parents || []) {
      const mine = list(p.student_ids).map((s) => byLegacy.get(s)).filter(Boolean) as { id: string; first: string }[];
      if (!mine.length) continue;
      let to = (p.email || "").trim();
      if (!to) {
        const { data: u } = await supabase.auth.admin.getUserById(p.id);
        to = (u?.user?.email || "").trim();
      }
      if (!to || seen.has(to.toLowerCase())) continue;
      seen.add(to.toLowerCase());
      mine.forEach((m) => reached.add(m.id));
      emails.push({ to, ...emailFor(mine.map((m) => m.first)) });
    }

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

    const done = rows.filter((r) => reached.has(r.student_id)).map((r) => r.id);
    if (done.length) await supabase.from("weekly_updates").update({ emailed_at: new Date().toISOString() }).in("id", done);
    return json({ sent, families: sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

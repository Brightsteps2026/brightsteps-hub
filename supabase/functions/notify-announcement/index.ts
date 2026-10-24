// BrightSteps Hub: notify-announcement
// Emails parents a school announcement posted on the Dashboard (English first, then French).
// Only the parents who can see it get it: whole school = every parent; Lower / Upper school
// or one grade = parents of a child in those grades.
// Each announcement is emailed once (announcements.emailed_at); editing it later does not
// email families again. The bell notice is made by the database, so it still arrives if email fails.
//
// Deploy in Supabase > Edge Functions with the name notify-announcement.
// Keep "Verify JWT" ON. Uses the RESEND_API_KEY secret, like the other emails.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HUB = "https://hub.bischoolci.org";
const LOWER = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5"];
const UPPER = ["Grade 6", "Grade 7"];

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Web links and email addresses in the message become real links in the email
// (same rules as the Hub's LinkedText). Everything else stays escaped text.
const TOKEN = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const TRAILING = /[.,;:!?)\]'"»]+$/;
const LINK_STYLE = "color:#801524;font-weight:bold;text-decoration:underline";
function linkify(s: string) {
  const source = String(s ?? "");
  let out = "";
  let last = 0;
  for (const m of source.matchAll(TOKEN)) {
    let raw = m[0];
    let tail = (raw.match(TRAILING) || [""])[0];
    if (tail.startsWith(")") && raw.includes("(")) tail = tail.slice(1);
    if (tail) raw = raw.slice(0, raw.length - tail.length);
    if (!raw) continue;
    const start = m.index ?? 0;
    out += esc(source.slice(last, start));
    const isEmail = !/^(https?:\/\/|www\.)/i.test(raw);
    const href = isEmail ? `mailto:${raw}` : /^www\./i.test(raw) ? `https://${raw}` : raw;
    out += `<a href="${esc(href)}" style="${LINK_STYLE}">${esc(raw)}</a>`;
    last = start + raw.length;
  }
  return out + esc(source.slice(last));
}
const para = (s: string) => linkify(s).replace(/\n/g, "<br>");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type Ann = { id: string; title: string; title_fr: string | null; body: string; body_fr: string | null; audience: string | null; emailed_at: string | null };

function emailFor(a: Ann) {
  const titleFr = (a.title_fr || "").trim() || a.title;
  const bodyFr = (a.body_fr || "").trim() || a.body;
  const subject = titleFr && titleFr !== a.title ? `${a.title} · ${titleFr}` : a.title;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#241012;line-height:1.6;max-width:560px">
      <p style="font-family:Georgia,serif;font-size:20px;color:#801524;margin:0 0 16px">BrightSteps International School</p>

      <p style="font-size:17px;font-weight:bold;margin:0 0 8px">${esc(a.title)}</p>
      <p>${para(a.body)}</p>
      <p><a href="${HUB}" style="display:inline-block;background:#801524;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Open the Hub</a></p>
      <p>Warm regards,<br>BrightSteps International School</p>

      <hr style="border:none;border-top:1px solid #EAD7DA;margin:24px 0">

      <p style="font-size:17px;font-weight:bold;margin:0 0 8px">${esc(titleFr)}</p>
      <p>${para(bodyFr)}</p>
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

    const { data: me } = await supabase.from("profiles").select("role").eq("id", who.user.id).single();
    if (me?.role !== "admin") return json({ error: "Only the admin can email announcements" }, 403);

    const { id } = await req.json();
    if (!id) return json({ error: "No announcement" }, 400);

    const { data: a, error } = await supabase.from("announcements")
      .select("id, title, title_fr, body, body_fr, audience, emailed_at").eq("id", id).single();
    if (error || !a) return json({ error: error?.message || "Announcement not found" }, 404);
    if (a.emailed_at) return json({ sent: 0, already: true });

    // Which grades this announcement is for (empty = whole school).
    const aud = a.audience || "school";
    const grades = aud === "school" ? [] : aud === "lower" ? LOWER : aud === "upper" ? UPPER : [aud];

    // Same parent list as the bell notice (database function hub_parents_of_grades).
    const { data: ids, error: pe } = await supabase.rpc("hub_parents_of_grades", { p_grades: grades });
    if (pe) return json({ error: "Could not find the parents: " + pe.message }, 500);
    const parentIds = (ids || []).map((r: unknown) =>
      typeof r === "string" ? r : (r as Record<string, string>).hub_parents_of_grades ?? Object.values(r as object)[0]);
    if (parentIds.length === 0) return json({ sent: 0, parents: 0 });
    const { data: parents } = await supabase.from("profiles").select("id, email").in("id", parentIds);
    const wanted = parents || [];

    // The parent's sign-in email is the address they use for the Hub.
    const seen = new Set<string>();
    const to: string[] = [];
    for (const p of wanted) {
      let addr = (p.email || "").trim();
      if (!addr) {
        const { data: u } = await supabase.auth.admin.getUserById(p.id);
        addr = (u?.user?.email || "").trim();
      }
      const key = addr.toLowerCase();
      if (addr && !seen.has(key)) { seen.add(key); to.push(addr); }
    }
    if (to.length === 0) return json({ sent: 0, parents: 0 });

    const { subject, html } = emailFor(a as Ann);

    // Resend batch: up to 100 emails per call, one email per parent (no one sees other addresses).
    let sent = 0;
    for (let i = 0; i < to.length; i += 100) {
      const chunk = to.slice(i, i + 100).map((addr) => ({
        from: "BrightSteps International School <notifications@bischoolci.org>", to: addr, subject, html,
      }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        if (sent) await supabase.from("announcements").update({ emailed_at: new Date().toISOString() }).eq("id", id);
        return json({ error: await res.text(), sent }, 502);
      }
      sent += chunk.length;
    }

    await supabase.from("announcements").update({ emailed_at: new Date().toISOString() }).eq("id", id);
    return json({ sent, parents: to.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

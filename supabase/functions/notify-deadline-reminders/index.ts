// BrightSteps Hub: notify-deadline-reminders (Oct 2026)
// Emails staff a reminder about a deadline they have not marked done yet.
// The database calls this (staff-deadlines.sql) after it adds the bell notices:
// every morning at 7:00 (3 days before, and on the day), and when the admin presses "Remind".
// The bell notice is made by the database, so it still arrives if email fails.
//
// Deploy in Supabase > Edge Functions with the name notify-deadline-reminders.
// Turn "Verify JWT" OFF for this one: the database calls it without a user, using its own
// secret (the same one as the push function). Uses the RESEND_API_KEY secret.

import { createClient } from "npm:@supabase/supabase-js@2";

const HUB = "https://hub.bischoolci.org";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fmt(d: string) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

type Row = { id: number; email: string | null; name: string | null; title: string; note: string | null; due_date: string; kind: string };

function emailFor(r: Row) {
  const today = new Date().toISOString().slice(0, 10);
  const due = fmt(r.due_date);
  const first = (r.name || "").trim();
  const subject =
    r.kind === "today" ? `Due today: ${r.title}`
    : r.kind === "soon" ? `Deadline in 3 days: ${r.title}`
    : `Reminder: ${r.title}`;
  const line =
    r.kind === "today" ? `This deadline is <strong>today, ${esc(due)}</strong>.`
    : r.due_date < today ? `This was due on <strong>${esc(due)}</strong>. Please finish it as soon as you can.`
    : `This is due on <strong>${esc(due)}</strong>.`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#241012;line-height:1.6;max-width:560px">
      <p style="font-family:Georgia,serif;font-size:20px;color:#801524;margin:0 0 16px">BrightSteps Hub</p>
      ${first ? `<p>Hello ${esc(first)},</p>` : ""}
      <p style="font-size:17px;font-weight:bold;margin:0 0 6px">${esc(r.title)}</p>
      <p style="margin:0 0 12px">${line}</p>
      ${r.note ? `<p style="margin:0 0 12px">${esc(r.note)}</p>` : ""}
      <p>When it is finished, press <strong>Mark as done</strong> on your Dashboard, so the reminders stop.</p>
      <p><a href="${HUB}" style="display:inline-block;background:#801524;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Open the Hub</a></p>
      <p>Thank you,<br>BrightSteps International School</p>
    </div>`;
  return { subject, html };
}

Deno.serve(async (req) => {
  try {
    const { data: c } = await db.from("push_config").select("secret").eq("id", 1).single();
    if (!c?.secret || (req.headers.get("x-push-secret") || "") !== c.secret) return json({ error: "Forbidden" }, 403);

    const { data: rows, error } = await db.rpc("staff_deadline_claim", { p_limit: 100 });
    if (error) return json({ error: error.message }, 500);
    const list = (rows || []) as Row[];
    const withEmail = list.filter((r) => (r.email || "").trim());
    const noEmail = list.filter((r) => !(r.email || "").trim()).map((r) => r.id);
    if (noEmail.length) await db.rpc("staff_deadline_emailed", { p_ids: noEmail }); // nothing to send to: bell notice only

    // Resend batch: up to 100 emails per call, one email per person.
    let sent = 0;
    for (let i = 0; i < withEmail.length; i += 100) {
      const chunk = withEmail.slice(i, i + 100);
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((r) => ({
          from: "BrightSteps Hub <notifications@bischoolci.org>",
          to: r.email!.trim(),
          ...emailFor(r),
        }))),
      });
      if (!res.ok) return json({ error: await res.text(), sent }, 502);
      await db.rpc("staff_deadline_emailed", { p_ids: chunk.map((r) => r.id) });
      sent += chunk.length;
    }
    return json({ sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

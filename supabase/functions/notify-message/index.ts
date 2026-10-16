// BrightSteps Hub: notify-message (Stage 1, Oct 2026)
// After someone sends a message in a parents' thread, emails the people on the
// other side: parents of that child when staff write; the child's teachers,
// assistants and admins when a parent writes. Only "you have a new message" is
// sent: no message text and no child's name are ever in the email.
//
// Changes from the earlier version:
//   * The caller must be signed in, and must be the person who wrote the message.
//     The sender's name is taken from the message itself, so nobody can make the
//     Hub send an email "from" someone else.
//   * The child's grade comes from the students table (not the shared data).
//   * Parents get the email in English, then French.
//
// Deploy in Supabase > Edge Functions, name notify-message (replace the code).
// Keep "Verify JWT" ON. Uses the RESEND_API_KEY secret, like the other emails.

import { createClient } from "npm:@supabase/supabase-js@2";

const FROM = "BrightSteps Hub <notifications@bischoolci.org>";
const HUB = "https://hub.bischoolci.org";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const button = (label: string) =>
  `<a href="${HUB}" style="display:inline-block;background:#801524;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none">${label}</a>`;

function staffEmail(first: string, sender: string) {
  return {
    subject: "New message in BrightSteps Hub",
    html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#241012;line-height:1.5">
      <h2 style="color:#801524">BrightSteps Hub</h2>
      <p>Hi ${esc(first)},</p>
      <p><strong>${esc(sender)}</strong> sent you a new message in BrightSteps Hub.</p>
      <p style="margin:24px 0">${button("Log in to read it")}</p>
      <p style="color:#6B7578;font-size:13px">For privacy, message content is not included in this email.</p>
    </div>`,
  };
}

function parentEmail(first: string, sender: string) {
  return {
    subject: "New message in BrightSteps Hub · Nouveau message sur le BrightSteps Hub",
    html: `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#241012;line-height:1.5">
      <h2 style="color:#801524">BrightSteps Hub</h2>
      <p>Hi ${esc(first)},</p>
      <p><strong>${esc(sender)}</strong> sent you a new message in BrightSteps Hub.</p>
      <p style="margin:20px 0">${button("Log in to read it")}</p>
      <p style="color:#6B7578;font-size:13px">For privacy, message content is not included in this email.</p>
      <hr style="border:none;border-top:1px solid #EAD7DA;margin:24px 0">
      <p>Bonjour ${esc(first)},</p>
      <p><strong>${esc(sender)}</strong> vous a envoyé un nouveau message sur le BrightSteps Hub.</p>
      <p style="margin:20px 0">${button("Se connecter pour le lire")}</p>
      <p style="color:#6B7578;font-size:13px">Pour protéger votre vie privée, le contenu du message n'est pas inclus dans cet e-mail.</p>
    </div>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: who } = await admin.auth.getUser(token);
    if (!who?.user) return json({ error: "Not signed in" }, 401);

    const { messageId } = await req.json();
    if (!messageId) return json({ error: "messageId is required" }, 400);

    const { data: msg } = await admin.from("hub_messages")
      .select("id, student_id, thread, author_id, author_name, author_role, created_at, deleted_at")
      .eq("id", messageId).maybeSingle();
    if (!msg || msg.deleted_at) return json({ error: "Message not found" }, 404);
    if (msg.author_id !== who.user.id) return json({ error: "Not your message" }, 403);
    if (msg.thread !== "family") return json({ sent: [] });
    // Only for a message just sent (stops an old message being used to re-send emails).
    if (Date.now() - new Date(msg.created_at).getTime() > 10 * 60 * 1000) return json({ sent: [] });

    const fromFamily = msg.author_role === "parent" || msg.author_role === "student";
    const { data: stu } = await admin.from("students").select("grade").eq("legacy_id", msg.student_id).maybeSingle();
    const grade = stu?.grade || null;

    let recipients: { id: string; email: string | null; full_name: string | null; role: string }[] = [];
    if (fromFamily) {
      // To staff: teachers and assistants of the child's grade, plus admins.
      const { data: staff } = await admin.from("profiles")
        .select("id, email, full_name, role, grades_assigned")
        .in("role", ["teacher", "admin", "learning_assistant"]);
      recipients = (staff || []).filter((p) => p.role === "admin" || (grade && (p.grades_assigned || []).includes(grade)));
    } else {
      // To the child's parents.
      const { data: parents } = await admin.from("profiles").select("id, email, full_name, role, student_ids").eq("role", "parent");
      recipients = (parents || []).filter((p) => (p.student_ids || []).includes(msg.student_id));
    }
    recipients = recipients.filter((p) => p.id !== who.user.id);

    const emails: { from: string; to: string; subject: string; html: string }[] = [];
    for (const r of recipients) {
      // Same address as before (profiles.email), or the sign-in address if it is empty.
      let to = r.email;
      if (!to) {
        const { data: u } = await admin.auth.admin.getUserById(r.id);
        to = u?.user?.email || null;
      }
      if (!to || to.endsWith("brightstepshub.local")) continue;
      const first = r.full_name ? r.full_name.split(" ")[0] : "there";
      const e = r.role === "parent" ? parentEmail(first, msg.author_name) : staffEmail(first, msg.author_name);
      emails.push({ from: FROM, to, ...e });
    }
    if (emails.length === 0) return json({ sent: [] });

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(emails.slice(0, 100)),
    });
    if (!res.ok) return json({ error: await res.text() }, 502);
    return json({ sent: emails.map((e) => e.to) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

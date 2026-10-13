// BrightSteps Hub: notify-leave-request
// Emails every admin when a staff member sends a leave request.
// The Leave tab calls this right after the request is saved. The bell notice is
// made by the database (leave_notify_admins), so it still arrives if email fails.
//
// Deploy in Supabase > Edge Functions with the name notify-leave-request.
// Keep "Verify JWT" ON (only signed-in staff can call it).
// Uses the RESEND_API_KEY secret, the same one the message emails use.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TYPE_LABEL: Record<string, string> = {
  half_am: "Half day (morning)",
  half_pm: "Half day (afternoon)",
  full_day: "Full day",
  multi_day: "Several days",
};

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fmt(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: who } = await supabase.auth.getUser(token);
    if (!who?.user) return json({ error: "Not signed in" }, 401);

    const { id } = await req.json();
    const { data: r, error } = await supabase.from("leave_requests").select("*").eq("id", id).single();
    if (error || !r) return json({ error: "Request not found" }, 404);
    if (r.teacher_id !== who.user.id) return json({ error: "Not your request" }, 403);

    const { data: people } = await supabase.from("profiles").select("id, full_name, email, role")
      .or(`role.eq.admin,id.eq.${r.teacher_id}`);
    const teacher = (people || []).find((p) => p.id === r.teacher_id);
    const name = teacher?.full_name || "A staff member";
    const to = (people || []).filter((p) => p.role === "admin" && p.email).map((p) => p.email);
    if (to.length === 0) return json({ sent: 0 });

    const today = new Date().toISOString().slice(0, 10);
    const dates = r.start_date === r.end_date ? fmt(r.start_date) : `${fmt(r.start_date)} to ${fmt(r.end_date)}`;
    const past = r.start_date < today ? " (already happened)" : "";

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:15px;color:#241012;line-height:1.5">
        <p><strong>${esc(name)}</strong> sent a leave request.</p>
        <p>
          ${esc(TYPE_LABEL[r.leave_type] || r.leave_type)} · ${esc(dates)}${esc(past)}<br>
          Reason: ${esc(r.reason)}
          ${r.note ? `<br>Note: ${esc(r.note)}` : ""}
          ${r.proof_path ? "<br>A proof file is attached." : ""}
        </p>
        <p><a href="https://hub.bischoolci.org" style="color:#801524">Open the Hub</a> and go to the Leave tab to approve, deny or ask for more info.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "BrightSteps Hub <notifications@bischoolci.org>",
        to,
        subject: `Leave request: ${name} · ${dates}`,
        html,
      }),
    });
    if (!res.ok) return json({ error: await res.text() }, 502);
    return json({ sent: to.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

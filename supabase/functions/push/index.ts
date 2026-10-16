// BrightSteps Hub: push (phone notifications), Oct 2026
//
// One function, four jobs:
//   public-key   the Hub asks for the public key it needs to turn notifications on.
//                The first time, the key pair is created and kept in the database
//                (push_config): nobody has to copy any key.
//   subscribe    a signed-in person turns notifications on for this phone/computer.
//   unsubscribe  they turn them off.
//   deliver      the database (with its own secret) asks for waiting notifications
//                to be sent (push_outbox).
//
// Deploy in Supabase > Edge Functions with the name push.
// Turn "Verify JWT" OFF for this one: it checks who is calling itself (the
// database calls it without a user, using its own secret).

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function config() {
  const { data, error } = await db.from("push_config").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("push_config missing: run push-notifications.sql");
  if (!data.vapid_public || !data.vapid_private) {
    const keys = webpush.generateVAPIDKeys();
    // Only fill the keys if nobody else did in the meantime.
    await db.from("push_config").update({ vapid_public: keys.publicKey, vapid_private: keys.privateKey })
      .eq("id", 1).is("vapid_public", null);
    const again = await db.from("push_config").select("*").eq("id", 1).single();
    return again.data;
  }
  return data;
}

async function signedInUser(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  return data?.user || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "public-key") {
      const c = await config();
      return json({ publicKey: c.vapid_public });
    }

    if (action === "subscribe" || action === "unsubscribe") {
      const user = await signedInUser(req);
      if (!user) return json({ error: "Not signed in" }, 401);
      const sub = body.subscription;
      const endpoint = action === "subscribe" ? sub?.endpoint : body.endpoint;
      if (!endpoint || !/^https:\/\//.test(endpoint)) return json({ error: "Bad subscription" }, 400);
      if (action === "unsubscribe") {
        await db.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
        return json({ ok: true });
      }
      if (!sub?.keys?.p256dh || !sub?.keys?.auth) return json({ error: "Bad subscription" }, 400);
      const { error } = await db.from("push_subscriptions").upsert({
        endpoint, user_id: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
        user_agent: (req.headers.get("user-agent") || "").slice(0, 200),
      }, { onConflict: "endpoint" });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "deliver") {
      const c = await config();
      if ((req.headers.get("x-push-secret") || "") !== c.secret) return json({ error: "Forbidden" }, 403);
      webpush.setVapidDetails("mailto:notifications@bischoolci.org", c.vapid_public, c.vapid_private);

      const { data: jobs, error } = await db.rpc("push_claim", { p_limit: 100 });
      if (error) return json({ error: error.message }, 500);
      let sent = 0, gone = 0;
      for (const job of jobs || []) {
        const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", job.user_id);
        const payload = JSON.stringify({ title: job.title, body: job.body || "", url: job.url || "/", tag: `bs-${job.id}` });
        let ok = false;
        for (const s of subs || []) {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
            ok = true; sent++;
            await db.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("endpoint", s.endpoint);
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            // The phone turned notifications off, or the browser was reset: forget it.
            if (code === 404 || code === 410) { gone++; ok = true; await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
          }
        }
        if (ok || !(subs || []).length) await db.from("push_outbox").update({ sent_at: new Date().toISOString() }).eq("id", job.id);
      }
      return json({ jobs: (jobs || []).length, sent, removed: gone });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

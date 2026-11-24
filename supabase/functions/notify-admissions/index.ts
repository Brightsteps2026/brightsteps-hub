// BrightSteps Hub: notify-admissions
// Emails a family about their admissions file (application received, visit booked,
// waiting list, offer, offer accepted, declined, enrolled). English first, then French.
// Called by the public Apply page and by the Admissions tab with { id } (application id).
// It only sends emails for events already saved in admission_events and not yet emailed,
// so calling it cannot send anything new by itself. Verify JWT: OFF.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HUB = "https://hub.bischoolci.org";

function when(iso: string, lang: "en" | "fr") {
  return new Date(iso).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
}

function content(kind: string, a: any, slot: any) {
  const child = esc(a.child_first_name);
  const year = esc(a.school_year);
  const grade = esc(a.grade || "");
  const offerUrl = `${HUB}/apply?offer=${a.offer_token}`;
  const ref = esc(a.ref);
  const t: Record<string, { s: [string, string]; en: string; fr: string }> = {
    application_received: {
      s: ["We received your application", "Nous avons bien reçu votre demande"],
      en: `<p>Thank you for applying to BrightSteps International School for ${child} (${grade}, ${year}). Your reference is <strong>${ref}</strong>.</p><p>We will contact you within a few working days about the next step: a visit and a short meeting with your child.</p>`,
      fr: `<p>Merci pour votre demande d'inscription de ${child} (${grade}, ${year}) à BrightSteps International School. Votre référence est <strong>${ref}</strong>.</p><p>Nous vous contacterons dans les prochains jours ouvrables pour l'étape suivante : une visite et un court entretien avec votre enfant.</p>`
    },
    visit_booked: {
      s: ["Your visit to BrightSteps is booked", "Votre visite à BrightSteps est confirmée"],
      en: `<p>Your visit is confirmed${slot ? ` for <strong>${esc(when(slot.starts_at, "en"))}</strong>` : ""}. Our address: BrightSteps International School, Grand-Bassam. Your reference is <strong>${ref}</strong>.</p><p>If you need to change the time, simply reply to this email.</p>`,
      fr: `<p>Votre visite est confirmée${slot ? ` pour le <strong>${esc(when(slot.starts_at, "fr"))}</strong>` : ""}. Adresse : BrightSteps International School, Grand-Bassam. Votre référence est <strong>${ref}</strong>.</p><p>Pour changer d'horaire, il suffit de répondre à cet e-mail.</p>`
    },
    waitlist: {
      s: ["Your application: waiting list", "Votre demande : liste d'attente"],
      en: `<p>Thank you for your application for ${child} (${grade}, ${year}). This class is currently full, so ${child} has been placed on our waiting list (reference <strong>${ref}</strong>). We will contact you as soon as a place becomes available.</p>`,
      fr: `<p>Merci pour votre demande pour ${child} (${grade}, ${year}). Cette classe est actuellement complète : ${child} est inscrit(e) sur notre liste d'attente (référence <strong>${ref}</strong>). Nous vous contacterons dès qu'une place se libère.</p>`
    },
    offer_sent: {
      s: ["A place for " + a.child_first_name + " at BrightSteps", "Une place pour " + a.child_first_name + " à BrightSteps"],
      en: `<p>We are delighted to offer ${child} a place in <strong>${grade}</strong> for the ${year} school year.</p><p><a href="${offerUrl}" style="color:#801524;font-weight:bold">Accept or decline the offer online</a>${a.offer_expires ? ` by ${esc(new Date(a.offer_expires + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }))}` : ""}.</p>`,
      fr: `<p>Nous avons le plaisir d'offrir à ${child} une place en <strong>${grade}</strong> pour l'année scolaire ${year}.</p><p><a href="${offerUrl}" style="color:#801524;font-weight:bold">Accepter ou refuser l'offre en ligne</a>${a.offer_expires ? ` avant le ${esc(new Date(a.offer_expires + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }))}` : ""}.</p>`
    },
    offer_accepted: {
      s: ["Welcome to BrightSteps", "Bienvenue à BrightSteps"],
      en: `<p>Thank you for accepting the place for ${child}. The registration is final once the registration fee is paid. We will send you the next steps for the ${year} school year.</p>`,
      fr: `<p>Merci d'avoir accepté la place pour ${child}. L'inscription est définitive après le paiement des frais d'inscription. Nous vous enverrons les prochaines étapes pour l'année scolaire ${year}.</p>`
    },
    declined: {
      s: ["Your application to BrightSteps", "Votre demande d'inscription à BrightSteps"],
      en: `<p>Thank you for your interest in BrightSteps International School. After careful review, we are not able to offer ${child} a place for ${year}. We wish your family all the best.</p>`,
      fr: `<p>Merci de l'intérêt que vous portez à BrightSteps International School. Après examen attentif, nous ne sommes pas en mesure d'offrir une place à ${child} pour ${year}. Nous souhaitons le meilleur à votre famille.</p>`
    },
    enrolled: {
      s: [a.child_first_name + " is enrolled at BrightSteps", a.child_first_name + " est inscrit(e) à BrightSteps"],
      en: `<p>${child}'s enrollment for ${year} is complete. You will receive your BrightSteps Hub account before the start of the school year.</p>`,
      fr: `<p>L'inscription de ${child} pour ${year} est terminée. Vous recevrez votre compte BrightSteps Hub avant la rentrée.</p>`
    }
  };
  return t[kind];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { id } = await req.json();
    const { data: a } = await sb.from("admission_applications").select("*").eq("id", id).single();
    if (!a) return json({ error: "Not found" }, 404);
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { data: events } = await sb.from("admission_events").select("*").eq("application_id", id).is("emailed_at", null).gte("created_at", since).order("id");
    let slot = null;
    if (a.visit_slot_id) slot = (await sb.from("visit_slots").select("starts_at").eq("id", a.visit_slot_id).single()).data;
    const to = [a.parent1_email, a.parent2_email].filter(Boolean);
    const { data: admins } = await sb.from("profiles").select("email").eq("role", "admin").not("email", "is", null).limit(1);
    const replyTo = admins?.[0]?.email;
    let sent = 0;
    for (const ev of events || []) {
      const c = content(ev.kind, a, slot);
      if (!c || !to.length) continue;
      const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#241012;line-height:1.5">${c.en}<p>BrightSteps International School</p><hr style="border:none;border-top:1px solid #EAD7DA;margin:20px 0">${c.fr}<p>BrightSteps International School</p></div>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "BrightSteps International School <notifications@bischoolci.org>", to, ...(replyTo ? { reply_to: replyTo } : {}), subject: `${c.s[0]} / ${c.s[1]}`, html })
      });
      if (res.ok) { await sb.from("admission_events").update({ emailed_at: new Date().toISOString() }).eq("id", ev.id); sent++; }
    }
    return json({ sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

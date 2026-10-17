// BrightSteps Hub: suggest-comment
// Writes a starter draft for a report card comment in the Gradebook
// ("Suggest a starter draft"). The teacher always reads and edits the draft:
// nothing is saved until they leave the box.
//
// Privacy: the Hub sends only the term results (levels, letters, skill ratings).
// No name, surname or ID is sent: the child is called STUDENT here and the Hub
// puts the first name back in afterwards.
//
// Deploy in Supabase > Edge Functions with the name suggest-comment.
// Keep "Verify JWT" ON. Uses the ANTHROPIC_API_KEY secret (the same one as the
// older report comment function).

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const EARLY = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2"];

const KINDS: Record<string, string> = {
  line: "ONE sentence (max 25 words) for this subject on the report card: what STUDENT does well, or the next step.",
  appreciation: "2 to 3 short sentences for this subject: what STUDENT enjoys, a skill STUDENT has shown, and one thing to work on next.",
  general: "3 to 4 sentences for the homeroom teacher's general comment: how STUDENT is doing overall this term (learning and attitudes), one strength, and one clear next step.",
};

async function askClaude(prompt: string, maxTokens = 700) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error("The AI service did not answer: " + (await res.text()).slice(0, 300));
  const out = await res.json();
  return (out?.content || []).map((c: { text?: string }) => c.text || "").join("").trim();
}

function parseJson(text: string) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("The AI answer could not be read. Please try again.");
  return JSON.parse(text.slice(a, b + 1));
}

// Weekly child update: a short note in English and French ("weekly"), or a French
// translation of a few short texts ("translate"). The child is STUDENT, never named.
async function weekly(kind: string, body: Record<string, unknown>) {
  try {
    if (kind === "translate") {
      const fields = (body.fields || {}) as Record<string, string>;
      const clean: Record<string, string> = {};
      Object.entries(fields).forEach(([k, v]) => { if (typeof v === "string" && v.trim()) clean[k] = v.slice(0, 1500); });
      if (!Object.keys(clean).length) return { fr: {} };
      const text = await askClaude([
        "Translate these short texts from a school's weekly update for parents into natural French as used in Côte d'Ivoire.",
        "Keep names, the word STUDENT, dates and numbers unchanged. Keep subject names such as Math as Mathématiques and English Language Arts as Anglais. Avoid gendered adjectives for STUDENT (rephrase instead).",
        "Reply with JSON only, with the same keys: " + JSON.stringify(clean),
      ].join("\n"), 1200);
      return { fr: parseJson(text) };
    }
    const grade = String(body.grade || "");
    const prompt = [
      `You are helping a teacher at BrightSteps International School (Côte d'Ivoire) write this week's short update for the family of a child in ${grade}. The school uses inquiry-based learning.`,
      EARLY.includes(grade)
        ? "This is an early years class: simple, warm, everyday words for parents of a young child."
        : "Older pupil: you may mention study habits and responsibility.",
      "Write 3 to 4 sentences: how the week went in Math and English Language Arts (using the topics), how STUDENT took part and behaved, the highlight if there is one, and one gentle next step. 'Needs support' or 'Sometimes' must be written as an encouraging next step, never as a problem.",
      "Rules: American English spelling; call the child STUDENT and do not use he/she/him/her; use ONLY the facts below and never invent events, numbers or grades; no greeting or sign-off.",
      "Also give the same note in natural French as used in Côte d'Ivoire (keep STUDENT; avoid gendered adjectives for STUDENT).",
      "",
      "This week:",
      String(body.facts || "").slice(0, 2500),
      body.current ? `\nThe teacher's own wording so far (keep their ideas): ${String(body.current).slice(0, 800)}` : "",
      "",
      'Reply with JSON only: {"en": "...", "fr": "..."}',
    ].join("\n");
    const out = parseJson(await askClaude(prompt));
    return { en: String(out.en || "").trim(), fr: String(out.fr || "").trim() };
  } catch (e) {
    return { error: String((e as Error)?.message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: who } = await supabase.auth.getUser(token);
    if (!who?.user) return json({ error: "Not signed in" }, 401);
    const { data: me } = await supabase.from("profiles").select("role").eq("id", who.user.id).single();
    if (!["admin", "teacher", "learning_assistant"].includes(me?.role)) return json({ error: "Only staff can use this" }, 403);

    const body = await req.json();
    const { kind, grade, term, subject, facts, current } = body;
    if (kind === "weekly" || kind === "translate") return json(await weekly(kind, body));
    if (!KINDS[kind]) return json({ error: "Unknown comment type" }, 400);

    const prompt = [
      `You are helping a teacher at BrightSteps International School (Côte d'Ivoire) write a Term ${term} report card comment for a child in ${grade}.`,
      `The school uses inquiry-based learning. Early years levels: Emerging, Developing, Meeting, Exceeding. Skills are rated Rarely, Sometimes, Usually, Consistently.`,
      subject ? `Subject: ${subject}.` : "",
      EARLY.includes(grade)
        ? `This is an early years class (${grade}): write for parents of a young child. Use simple, warm, everyday words; focus on growth, curiosity, independence, play, getting along with others and early language/number skills as shown in the results; describe next steps as gentle encouragement, never as a problem.`
        : `Write for an upper primary / middle school pupil: you may mention study habits, thinking and responsibility as shown in the results.`,
      `Write ${KINDS[kind]}`,
      `Rules: warm, specific and professional; written to parents; British English; call the child STUDENT and do not use he/she/him/her (write STUDENT again or rephrase); base it ONLY on the results below and never invent activities, events or numbers; do not quote grades, percentages or letters; no greeting, no sign-off.`,
      ``,
      `Results this term:`,
      String(facts || "No results recorded yet.").slice(0, 3000),
      current ? `\nThe teacher's own notes or draft so far (keep their ideas): ${String(current).slice(0, 800)}` : "",
      ``,
      `Reply with the comment text only.`,
    ].filter((x) => x !== "").join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) return json({ error: "The AI service did not answer: " + (await res.text()).slice(0, 300) }, 502);
    const out = await res.json();
    const text = (out?.content || []).map((c: { text?: string }) => c.text || "").join("").trim();
    return json({ draft: text });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: who } = await supabase.auth.getUser(token);
    if (!who?.user) return json({ error: "Not signed in" }, 401);
    const { data: me } = await supabase.from("profiles").select("role").eq("id", who.user.id).single();
    if (!["admin", "teacher"].includes(me?.role)) return json({ error: "Only teachers can use this" }, 403);

    const { kind, grade, term, subject, facts, current } = await req.json();
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

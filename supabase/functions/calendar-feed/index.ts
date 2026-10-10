// BrightSteps Hub: calendar-feed
// Serves the school calendar as an .ics feed that Google Calendar and phone
// calendars can subscribe to. Each feed is reached with a private token from the
// calendar_feeds table: the "staff" token gives every event, the "everyone"
// token gives only events families may see.
//
// Deploy in Supabase > Edge Functions with the name calendar-feed, and turn OFF
// "Verify JWT" (calendar apps cannot sign in; the private token protects the feed).

import { createClient } from "npm:@supabase/supabase-js@2";

type HubEvent = {
  id?: string;
  title?: string;
  type?: string;
  date?: string;
  endDate?: string;
  grades?: string[];
  description?: string;
  audience?: string;
};

const isStaffOnly = (e: HubEvent) => e.audience === "staff" || (!e.audience && e.type === "Staff");

const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// iCalendar lines must be folded at 75 bytes.
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const compact = (s: string) => s.replace(/-/g, "");

function dayAfter(s: string): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Not found", { status: 404 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: feed } = await supabase.from("calendar_feeds").select("audience").eq("token", token).maybeSingle();
  if (!feed) return new Response("Not found", { status: 404 });

  const { data: row, error } = await supabase
    .from("app_storage")
    .select("value")
    .eq("key", "brightsteps-hub-data")
    .eq("shared", true)
    .maybeSingle();
  if (error || !row) return new Response("Calendar unavailable", { status: 503 });

  const blob = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
  const events: HubEvent[] = Array.isArray(blob?.events) ? blob.events : [];
  const visible = events.filter((e) => isDate(e.date) && (feed.audience === "staff" || !isStaffOnly(e)));

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const name = feed.audience === "staff" ? "BrightSteps Staff Calendar" : "BrightSteps School Calendar";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BrightSteps International School//Hub Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:Africa/Abidjan",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const e of visible) {
    const start = e.date!;
    const last = isDate(e.endDate) && e.endDate! >= start ? e.endDate! : start;
    const grades = Array.isArray(e.grades) && e.grades.length > 0 ? `Grades: ${e.grades.join(", ")}` : "";
    const description = [e.description || "", grades].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(String(e.id || `${start}-${e.title}`))}@hub.bischoolci.org`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(start)}`,
      `DTEND;VALUE=DATE:${compact(dayAfter(last))}`,
      `SUMMARY:${escapeText(e.title || "School event")}`,
    );
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    if (e.type) lines.push(`CATEGORIES:${escapeText(e.type)}`);
    lines.push("TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="brightsteps.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
});

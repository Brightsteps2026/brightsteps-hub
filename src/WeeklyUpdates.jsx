// Weekly child updates.
// Staff (teachers, assistants, admin): one screen per class and week. The class part
// (Math / ELA / Unit topics, an idea for home, reminders) is written once; each child gets
// quick taps (Math, ELA, three learning habits), an optional highlight, and a short note
// drafted by AI in English and French that the teacher checks. Only the admin or the class
// teacher sends. Families read it on My child and confirm they have read it.
// Staff screens are English only; the family view follows the EN/FR toggle.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { COLORS, TONES, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, pill } from "./ui/tokens";
import { GRADES, isStaffOnlyEvent } from "./data/constants";

const card = { ...cardToken, marginBottom: 14 };
const h2 = { margin: 0, fontSize: 17, fontWeight: 600 };
const small = { fontSize: 13, color: COLORS.muted };
const tapBtn = { ...chip, minHeight: 34, padding: "6px 11px", fontSize: 12 };
const tapOnSubject = { ...chipOn, minHeight: 34, padding: "6px 11px", fontSize: 12 };
const tapOnHabit = { ...tapBtn, background: COLORS.info, borderColor: COLORS.info, color: "#fff" };

const LEVELS = [
  { id: "needs_support", label: "Needs support" },
  { id: "practicing", label: "Practicing" },
  { id: "confident", label: "Confident" },
  { id: "further", label: "Going further" }
];
const FREQ = [
  { id: "sometimes", label: "Sometimes" },
  { id: "usually", label: "Usually" },
  { id: "always", label: "Always" }
];
const HABITS = [
  { id: "participation", label: "Participation" },
  { id: "behavior", label: "Behavior & school values" },
  { id: "effort", label: "Effort & independence" }
];
const TAPS = ["math", "ela", "participation", "behavior", "effort"];

// What families see.
const FAMILY = {
  level: {
    needs_support: { en: "Getting extra support", fr: "Bénéficie d'un soutien" },
    practicing: { en: "Practicing", fr: "S'entraîne" },
    confident: { en: "Confident", fr: "À l'aise" },
    further: { en: "Going further", fr: "Va plus loin" }
  },
  levelTone: { needs_support: TONES.info, practicing: TONES.warn, confident: TONES.ok, further: TONES.brand },
  freq: {
    sometimes: { en: "Growing", fr: "En progrès" },
    usually: { en: "Usually", fr: "Le plus souvent" },
    always: { en: "Always", fr: "Toujours" }
  },
  habit: {
    participation: { en: "Takes part in class", fr: "Participe en classe" },
    behavior: { en: "Behavior and school values", fr: "Comportement et valeurs de l'école" },
    effort: { en: "Effort and independence", fr: "Effort et autonomie" }
  }
};

const T = {
  en: {
    title: "Weekly updates", week: (r) => `Weekly update · ${r}`, whose: (n) => `${n}'s week`, from: (t) => `from ${t}`,
    highlight: "Highlight of the week", glance: "This week at a glance", atSchool: "At school",
    days: (a) => `${a.at} of ${a.days} days${a.excused ? ` · ${a.excused} excused` : ""}`,
    math: "Math", ela: "English Language Arts", habits: "Learning habits", inClass: "In class this week",
    uoi: "Unit of inquiry", home: "Try at home", coming: "Coming up",
    ackTitle: "Confirm you've read it", ackWhy: (n) => `It's kept in ${n}'s file, so the teacher knows the update reached you.`,
    ackBox: (n) => `I have read ${n}'s weekly update`, ackNote: "A note for the teacher (optional)",
    ackBtn: "Confirm I've read it", acked: (d) => `✓ You confirmed reading this on ${d}`, yourNote: "Your note:",
    reply: "Reply to the teacher", earlier: "Earlier weekly updates", none: "No weekly update yet.", tickFirst: "Please tick the box first.",
    soon: (n) => `${n}'s weekly update arrives here every Friday. You'll get a notification and an email when it's ready, so you can read it and confirm.`
  },
  fr: {
    title: "Points hebdomadaires", week: (r) => `Point de la semaine · ${r}`, whose: (n) => `La semaine de ${n}`, from: (t) => `de la part de ${t}`,
    highlight: "Le moment fort de la semaine", glance: "La semaine en bref", atSchool: "Présence",
    days: (a) => `${a.at} jour${a.at > 1 ? "s" : ""} sur ${a.days}${a.excused ? ` · ${a.excused} absence${a.excused > 1 ? "s" : ""} justifiée${a.excused > 1 ? "s" : ""}` : ""}`,
    math: "Mathématiques", ela: "Anglais (langue et littérature)", habits: "Attitudes d'apprentissage", inClass: "En classe cette semaine",
    uoi: "Unité de recherche", home: "À essayer à la maison", coming: "À venir",
    ackTitle: "Confirmez votre lecture", ackWhy: (n) => `Elle est gardée dans le dossier de ${n}, pour que l'enseignant(e) sache que le point vous est bien parvenu.`,
    ackBox: (n) => `J'ai lu le point de la semaine de ${n}`, ackNote: "Un mot pour l'enseignant(e) (facultatif)",
    ackBtn: "Je confirme ma lecture", acked: (d) => `✓ Vous avez confirmé votre lecture le ${d}`, yourNote: "Votre mot :",
    reply: "Répondre à l'enseignant(e)", earlier: "Points précédents", none: "Pas encore de point hebdomadaire.", tickFirst: "Merci de cocher la case d'abord.",
    soon: (n) => `Le point de la semaine de ${n} arrive ici chaque vendredi. Vous recevrez une notification et un e-mail lorsqu'il sera prêt, pour le lire et confirmer votre lecture.`
  }
};

// ---------- dates ----------
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parse(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s, n) {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
// Monday of the school week: on a weekend, the week that just ended.
function currentMonday() {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return iso(d);
}
function weekDays(monday) {
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}
function weekRange(monday, lang = "en") {
  const a = parse(monday), b = parse(addDays(monday, 4));
  const loc = lang === "fr" ? "fr-FR" : "en-GB";
  const month = b.toLocaleDateString(loc, { month: "long" });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${month}`
    : `${a.toLocaleDateString(loc, { day: "numeric", month: "short" })} – ${b.toLocaleDateString(loc, { day: "numeric", month: "short" })}`;
}
function shortDay(s, lang = "en") {
  return parse(s).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function longDate(ts, lang = "en") {
  return new Date(ts).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
}

const firstName = (full) => (full || "").trim().split(/\s+/)[0] || "";
const listOf = (v) => (Array.isArray(v) ? v : []);

// Days at school this week, from the Attendance screen (weekdays up to today).
function weekAttendance(attendance, hubId, monday) {
  const today = iso(new Date());
  const a = { at: 0, absent: 0, excused: 0, days: 0 };
  weekDays(monday).forEach((d) => {
    if (d > today) return;
    const v = attendance?.[d]?.[hubId];
    if (!v) return;
    a.days += 1;
    if (v === "present" || v === "late") a.at += 1;
    else if (v === "excused") a.excused += 1;
    else a.absent += 1;
  });
  return a;
}

// School calendar events for the week after this one (families' events only).
function comingUp(events, grade, monday) {
  const from = addDays(monday, 7), to = addDays(monday, 11);
  return (events || [])
    .filter((e) => !isStaffOnlyEvent(e))
    .filter((e) => !e.grades || e.grades.length === 0 || e.grades.includes(grade))
    .filter((e) => e.date <= to && (e.endDate || e.date) >= from)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, title: e.title }));
}

async function ai(body) {
  const { data, error } = await supabase.functions.invoke("suggest-comment", { body });
  if (error || data?.error) throw new Error(data?.error || error?.message || "No answer");
  return data;
}

const withName = (text, name) => String(text || "").replace(/STUDENT/g, name);
const withoutName = (text, name) => (name ? String(text || "").split(name).join("STUDENT") : String(text || ""));

// ===========================================================================
// Staff screen
// ===========================================================================

export default function WeeklyUpdatesTab({ profile, data }) {
  const role = profile?.role;
  const isAdmin = role === "admin";
  const isViewer = role === "viewer";
  const assigned = [...listOf(profile?.grades_assigned), ...listOf(profile?.assigned_grades)];
  const assistantOf = listOf(profile?.assistant_grades);
  const myGrades = isAdmin || isViewer ? GRADES : GRADES.filter((g) => assigned.includes(g) || assistantOf.includes(g));
  const canSendGrade = (g) => isAdmin || (role === "teacher" && assigned.includes(g) && !assistantOf.includes(g));

  const [week, setWeek] = useState(currentMonday());
  const [view, setView] = useState(isAdmin || isViewer ? "overview" : "class");
  const [grade, setGrade] = useState(myGrades[0] || null);

  if (!myGrades.length) return <p style={{ ...card, color: COLORS.muted }}>No class is assigned to you yet.</p>;
  const thisWeek = currentMonday();

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.brand }}>Weekly updates</p>
          <h1 style={{ margin: "4px 0 0", fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600 }}>
            {view === "overview" ? "All classes" : grade} · Week of {weekRange(week)}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={ghostBtn} onClick={() => setWeek(addDays(week, -7))}>‹ Previous week</button>
          <button style={{ ...ghostBtn, opacity: week >= thisWeek ? 0.5 : 1 }} disabled={week >= thisWeek} onClick={() => setWeek(addDays(week, 7))}>Next week ›</button>
        </div>
      </div>

      <div style={{ ...card, display: "flex", gap: 7, flexWrap: "wrap" }}>
        {(isAdmin || isViewer) && <button style={view === "overview" ? chipOn : chip} onClick={() => setView("overview")}>All classes</button>}
        {myGrades.map((g) => (
          <button key={g} style={view === "class" && grade === g ? chipOn : chip} onClick={() => { setGrade(g); setView("class"); }}>{g}</button>
        ))}
      </div>

      {view === "overview"
        ? <Overview week={week} onOpen={(g) => { setGrade(g); setView("class"); }} />
        : <ClassWeek key={`${grade}-${week}`} grade={grade} week={week} data={data} profile={profile}
            canEdit={!isViewer} canSend={canSendGrade(grade)} />}
    </div>
  );
}

// ---------- one class, one week ----------

function ClassWeek({ grade, week, data, profile, canEdit, canSend }) {
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState({});
  const [notes, setNotes] = useState(null);
  const [form, setForm] = useState({ math_topic: "", ela_topic: "", uoi_topic: "", home_idea: "", reminders: "" });
  const [lastWeek, setLastWeek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const upcoming = useMemo(() => comingUp(data?.events, grade, week), [data?.events, grade, week]);

  async function load() {
    setLoading(true); setError("");
    const st = await supabase.from("students").select("id, full_name, legacy_id").eq("grade", grade).order("full_name");
    if (st.error) { setError(st.error.message); setLoading(false); return; }
    const [wu, cn, lw] = await Promise.all([
      supabase.from("weekly_updates").select("*").eq("grade", grade).eq("week_start", week),
      supabase.from("weekly_class_notes").select("*").eq("grade", grade).eq("week_start", week).maybeSingle(),
      supabase.from("weekly_updates").select("id, student_id, status, ack_at, ack_note").eq("grade", grade).eq("week_start", addDays(week, -7)).eq("status", "sent")
    ]);
    const err = wu.error || cn.error || lw.error;
    if (err) {
      setError(/weekly_/.test(err.message) ? "Weekly updates aren't switched on yet. Please run weekly-updates.sql in Supabase." : err.message);
      setLoading(false);
      return;
    }
    const map = {};
    (wu.data || []).forEach((r) => { map[r.student_id] = r; });
    setStudents(st.data || []);
    setRows(map);
    setNotes(cn.data || null);
    setForm({
      math_topic: cn.data?.math_topic || "", ela_topic: cn.data?.ela_topic || "", uoi_topic: cn.data?.uoi_topic || "",
      home_idea: cn.data?.home_idea || "", reminders: cn.data?.reminders || ""
    });
    setLastWeek(lw.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [grade, week]);

  async function saveNotes(extra = {}) {
    const row = { grade, week_start: week, ...form, ...extra, updated_by: profile.id, updated_at: new Date().toISOString() };
    const { data: saved, error: e } = await supabase.from("weekly_class_notes").upsert(row, { onConflict: "grade,week_start" }).select().single();
    if (e) { setStatus("Not saved: " + e.message); return null; }
    setNotes(saved);
    setStatus("");
    return saved;
  }

  async function saveChild(stu, patch) {
    const prev = rows[stu.id] || {};
    const row = {
      student_id: stu.id, hub_student_id: stu.legacy_id, grade, week_start: week,
      attendance: weekAttendance(data?.attendance, stu.legacy_id, week),
      ...patch, updated_by: profile.id, updated_at: new Date().toISOString()
    };
    // Changing a tap after the note was written means the note needs another look.
    if (prev.note_en && !("status" in patch) && TAPS.some((k) => k in patch)) row.status = "draft";
    const { data: saved, error: e } = await supabase.from("weekly_updates").upsert(row, { onConflict: "student_id,week_start" }).select().single();
    if (e) { setStatus("Not saved: " + e.message); return null; }
    setRows((r) => ({ ...r, [stu.id]: saved }));
    setStatus("");
    return saved;
  }

  function factsFor(stu, r) {
    const name = firstName(stu.full_name);
    const a = weekAttendance(data?.attendance, stu.legacy_id, week);
    const lbl = (list, id) => list.find((x) => x.id === id)?.label || "not given";
    return [
      `Math this week: ${form.math_topic || "(topic not given)"}. Level this week: ${lbl(LEVELS, r.math)}.`,
      `English Language Arts this week: ${form.ela_topic || "(topic not given)"}. Level this week: ${lbl(LEVELS, r.ela)}.`,
      form.uoi_topic ? `Unit of inquiry: ${form.uoi_topic}.` : "",
      `Participation: ${lbl(FREQ, r.participation)}. Behavior and school values: ${lbl(FREQ, r.behavior)}. Effort and independence: ${lbl(FREQ, r.effort)}.`,
      r.highlight ? `Highlight: ${withoutName(r.highlight, name)}` : "",
      a.days ? `At school ${a.at} of ${a.days} days this week.` : ""
    ].filter(Boolean).join("\n");
  }

  async function writeNote(stu) {
    const r = rows[stu.id] || {};
    const name = firstName(stu.full_name) || "Your child";
    const out = await ai({ kind: "weekly", grade, facts: factsFor(stu, r), current: withoutName(r.note_en, name) });
    if (!out.en) throw new Error("No draft came back.");
    return saveChild(stu, { note_en: withName(out.en, name), note_fr: withName(out.fr, name), status: "draft" });
  }

  async function approve(stu, text) {
    const r = rows[stu.id] || {};
    const name = firstName(stu.full_name);
    let fr = r.note_fr;
    if (text.trim() !== (r.note_en || "").trim() || !fr) {
      const out = await ai({ kind: "translate", fields: { note: withoutName(text.trim(), name) } });
      fr = withName(out?.fr?.note || "", name);
    }
    return saveChild(stu, { note_en: text.trim(), note_fr: fr, status: "ready" });
  }

  async function saveDraft(stu, text) {
    return saveChild(stu, { note_en: text.trim(), note_fr: null, status: "draft" });
  }

  const [writingAll, setWritingAll] = useState("");
  const toWrite = students.filter((s) => TAPS.every((k) => rows[s.id]?.[k]) && !rows[s.id]?.note_en && rows[s.id]?.status !== "sent");
  async function writeAll() {
    if (writingAll || !toWrite.length) return;
    let done = 0, failed = 0;
    for (const s of toWrite) {
      setWritingAll(`Writing ${done + 1} of ${toWrite.length}…`);
      try { await writeNote(s); } catch (e) { failed += 1; }
      done += 1;
    }
    setWritingAll("");
    if (failed) setStatus(`Not saved: ${failed} note${failed === 1 ? "" : "s"} could not be written. Try "Write the note with AI" on ${failed === 1 ? "that child" : "those children"}.`);
  }

  const ready = students.filter((s) => rows[s.id]?.status === "ready").length;
  const sentCount = students.filter((s) => rows[s.id]?.status === "sent").length;

  async function send() {
    if (!ready || sending) return;
    if (!window.confirm(`Send ${ready} update${ready === 1 ? "" : "s"} to families? Updates still marked "Check the draft" or "Not started" are not sent.`)) return;
    setSending(true); setStatus("Translating the class part…");
    try {
      const fields = {
        math_topic: form.math_topic, ela_topic: form.ela_topic, uoi_topic: form.uoi_topic,
        home_idea: form.home_idea, reminders: form.reminders,
        ...Object.fromEntries(upcoming.map((e, i) => [`event_${i}`, e.title]))
      };
      const out = await ai({ kind: "translate", fields });
      const fr = out?.fr || {};
      await saveNotes({ fr, coming_up: upcoming.map((e, i) => ({ ...e, title_fr: fr[`event_${i}`] || e.title })) });
      setStatus("Sending…");
      const { data: n, error: e } = await supabase.rpc("weekly_send", { p_grade: grade, p_week: week });
      if (e) throw e;
      const mail = await supabase.functions.invoke("notify-weekly-updates", { body: { grade, week } });
      const mailNote = mail.error || mail.data?.error ? " The bell notices went out, but the emails could not be sent." : "";
      setStatus("");
      alert(`Sent ${n} update${n === 1 ? "" : "s"} to families.${mailNote}`);
      await load();
    } catch (e) {
      setStatus("Not sent: " + (e?.message || e));
    }
    setSending(false);
  }

  async function remind() {
    const { data: n, error: e } = await supabase.rpc("weekly_remind", { p_grade: grade, p_week: addDays(week, -7) });
    if (e) { setStatus("Reminder not sent: " + e.message); return; }
    alert(`Reminder sent to ${n} famil${n === 1 ? "y" : "ies"}.`);
  }

  if (loading) return <p style={{ ...card, color: COLORS.muted }}>Loading…</p>;
  if (error) return <p style={{ ...card, color: COLORS.bad }}>{error}</p>;

  const classLocked = !!notes?.sent_at && !canSend;
  const total = students.length;
  const pct = total ? Math.round((100 * (ready + sentCount)) / total) : 0;
  const nameOf = (id) => students.find((s) => s.id === id)?.full_name || "";
  const notAcked = lastWeek.filter((r) => !r.ack_at);
  const withNotes = lastWeek.filter((r) => r.ack_note);

  return (
    <>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong style={{ fontSize: 15 }}>{ready} ready{sentCount ? ` · ${sentCount} sent` : ""} · {total} children</strong>
          <div style={{ width: 220, height: 8, borderRadius: 999, background: COLORS.line, display: "flex" }}>
            <span style={{ width: `${pct}%`, borderRadius: 999, background: COLORS.ok }} />
          </div>
        </div>
        {canSend ? (
          <button style={{ ...primaryBtn, opacity: ready && !sending ? 1 : 0.5 }} disabled={!ready || sending} onClick={send}>
            {sending ? "Sending…" : `Send ${ready || ""} to families`}
          </button>
        ) : (
          <span style={small}>The class teacher sends the updates.</span>
        )}
      </div>
      {status && <p style={{ ...card, color: status.startsWith("Not") ? COLORS.bad : COLORS.muted, padding: "10px 14px" }}>{status}</p>}

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <h2 style={h2}>1 · This week for the whole class</h2>
          <span style={small}>Written once, added to every child's update</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {[["math_topic", "Math this week", "e.g. Adding two-digit numbers"], ["ela_topic", "English Language Arts this week", "e.g. Retelling a story in order"], ["uoi_topic", "Unit of inquiry (optional)", "e.g. Why things float or sink"]].map(([k, l, ph]) => (
            <label key={k} style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
              {l}
              <input value={form[k]} placeholder={ph} disabled={!canEdit || classLocked}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} onBlur={() => saveNotes()} style={{ ...input, fontWeight: 400 }} />
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginTop: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Coming up next week <span style={{ fontWeight: 400, color: COLORS.muted }}>· from the school calendar</span></span>
            <div style={{ ...input, display: "flex", flexDirection: "column", gap: 4 }}>
              {upcoming.length === 0 && <span style={{ color: COLORS.muted }}>Nothing on the calendar for next week.</span>}
              {upcoming.map((e) => <span key={e.date + e.title}><strong>{shortDay(e.date)}</strong> · {e.title}</span>)}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600, marginTop: 6 }}>
              Reminders (optional)
              <textarea rows={2} value={form.reminders} placeholder="e.g. Bring a towel on Wednesday" disabled={!canEdit || classLocked}
                onChange={(e) => setForm({ ...form, reminders: e.target.value })} onBlur={() => saveNotes()} style={{ ...input, fontWeight: 400, resize: "vertical" }} />
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
            One idea to try at home (optional)
            <textarea rows={5} value={form.home_idea} disabled={!canEdit || classLocked}
              placeholder="e.g. Test five kitchen objects in a bowl of water: which float, which sink?"
              onChange={(e) => setForm({ ...form, home_idea: e.target.value })} onBlur={() => saveNotes()} style={{ ...input, fontWeight: 400, resize: "vertical" }} />
          </label>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          <h2 style={h2}>2 · Each child · about 30 seconds</h2>
          {canEdit && (
            <button style={{ ...primaryBtn, opacity: toWrite.length && !writingAll ? 1 : 0.5 }} disabled={!toWrite.length || !!writingAll} onClick={writeAll}>
              {writingAll || `Write all notes${toWrite.length ? ` (${toWrite.length})` : ""}`}
            </button>
          )}
        </div>
        <p style={{ ...small, margin: "0 0 4px" }}>
          Tap Math, ELA and the three habits, and add a highlight if you like. This can be done any day of the week: everything saves as you go.
          {canSend ? " Then write the notes, check each one and press Looks good." : " The class teacher checks each note and sends them on Friday."}
        </p>
        {students.length === 0 && <p style={small}>No students in {grade}.</p>}
        {students.map((s) => (
          <ChildRow key={s.id} stu={s} row={rows[s.id] || {}} canEdit={canEdit} canApprove={canSend} data={data} week={week}
            onTap={(patch) => saveChild(s, patch)} onWrite={() => writeNote(s)} onApprove={(text) => approve(s, text)}
            onSaveDraft={(text) => saveDraft(s, text)} />
        ))}
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h2 style={h2}>Last week · {lastWeek.length - notAcked.length} of {lastWeek.length} families confirmed reading</h2>
          {canSend && notAcked.length > 0 && <button style={ghostBtn} onClick={remind}>Send a reminder</button>}
        </div>
        {lastWeek.length === 0 && <p style={{ ...small, margin: "8px 0 0" }}>No updates were sent last week.</p>}
        {notAcked.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
            <span style={{ fontSize: 14 }}>Not confirmed yet:</span>
            {notAcked.map((r) => <span key={r.id} style={pill(TONES.warn)}>{nameOf(r.student_id)}</span>)}
          </div>
        )}
        {withNotes.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Notes from families</span>
            {withNotes.map((r) => <p key={r.id} style={{ margin: 0, fontSize: 14 }}><strong>{firstName(nameOf(r.student_id))}:</strong> {r.ack_note}</p>)}
          </div>
        )}
      </section>

      <p style={{ ...small, fontSize: 12, lineHeight: 1.6, margin: "0 4px 20px" }}>
        The AI draft uses only the taps, the topics and the highlight: the child is called "STUDENT", and no name, surname or ID is sent.
        "Needs support" and "Sometimes" are always written as a next step. Real concerns go by message or phone call, and behavior notes stay private.
        Nothing reaches families until the class teacher presses Send.
      </p>
    </>
  );
}

function ChildRow({ stu, row, canEdit, canApprove, data, week, onTap, onWrite, onApprove, onSaveDraft }) {
  const [highlight, setHighlight] = useState(row.highlight || "");
  const [text, setText] = useState(row.note_en || "");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [showFr, setShowFr] = useState(false);
  useEffect(() => { setText(row.note_en || ""); }, [row.note_en]);
  useEffect(() => { setHighlight(row.highlight || ""); }, [row.highlight]);

  const sent = row.status === "sent";
  // Assistants can't change a note the teacher has approved (they can still change the taps).
  const locked = !canEdit || sent;
  const noteLocked = locked || (!canApprove && row.status === "ready");
  const tapsDone = TAPS.every((k) => row[k]);
  const att = weekAttendance(data?.attendance, stu.legacy_id, week);
  const state = sent ? ["Sent", TONES.ok] : row.status === "ready" ? ["Ready", TONES.ok] : row.note_en ? ["Check the draft", TONES.warn] : tapsDone ? ["Write the note", TONES.info] : ["Not started", TONES.neutral];

  async function run(label, fn) {
    setBusy(label); setErr("");
    try { await fn(); } catch (e) { setErr(e?.message || String(e)); }
    setBusy("");
  }

  const tapRow = (field, options, on) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button key={o.id} type="button" disabled={locked} aria-pressed={row[field] === o.id}
          onClick={() => onTap({ [field]: row[field] === o.id ? null : o.id })}
          style={row[field] === o.id ? on : tapBtn}>{o.label}</button>
      ))}
    </div>
  );

  return (
    <div style={{ borderTop: `1px solid ${COLORS.line}`, padding: "14px 0", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 15 }}>{stu.full_name}</strong>
          <span style={pill(state[1])}>{state[0]}</span>
        </div>
        <span style={small}>{att.days ? `At school ${att.at} of ${att.days} days${att.excused ? ` · ${att.excused} excused` : ""}` : "Attendance not taken yet"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div><span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>MATH</span>{tapRow("math", LEVELS, tapOnSubject)}</div>
          <div><span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>ELA</span>{tapRow("ela", LEVELS, tapOnSubject)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {HABITS.map((h) => (
            <div key={h.id}><span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>{h.label.toUpperCase()}</span>{tapRow(h.id, FREQ, tapOnHabit)}</div>
          ))}
        </div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
        Highlight (optional)
        <input value={highlight} disabled={locked} placeholder={`One thing ${firstName(stu.full_name)} did this week`}
          onChange={(e) => setHighlight(e.target.value)}
          onBlur={() => { if (highlight.trim() !== (row.highlight || "")) onTap({ highlight: highlight.trim() || null }); }}
          style={{ ...input, fontWeight: 400 }} />
      </label>

      {!locked && !row.note_en && (
        <div>
          <button style={{ ...primaryBtn, opacity: tapsDone && !busy ? 1 : 0.5 }} disabled={!tapsDone || !!busy} onClick={() => run("Writing…", onWrite)}>
            {busy || "Write the note with AI"}
          </button>
          {!tapsDone && <span style={{ ...small, marginLeft: 10 }}>Tap all five first.</span>}
        </div>
      )}

      {row.note_en && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, background: COLORS.surface2, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: sent || row.status === "ready" ? COLORS.ok : COLORS.warn }}>
              {sent ? "Sent to the family" : row.status === "ready" ? "Ready to send" : canApprove ? "AI draft · read it and change anything before it is sent" : "AI draft · waiting for the class teacher to check it"}
            </span>
            <span style={{ display: "flex", gap: 14 }}>
              {!noteLocked && <button type="button" style={{ background: "none", border: "none", padding: 0, color: COLORS.brand, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }} onClick={() => run("Writing…", onWrite)} disabled={!!busy}>Write again</button>}
              <button type="button" style={{ background: "none", border: "none", padding: 0, color: COLORS.brand, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setShowFr(!showFr)}>{showFr ? "Show English" : "Show French"}</button>
            </span>
          </div>
          {showFr ? (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{row.note_fr || "The French version is made when you press Looks good."}</p>
          ) : noteLocked ? (
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{row.note_en}</p>
          ) : (
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} style={{ ...input, resize: "vertical", lineHeight: 1.6 }} aria-label={`Note for ${stu.full_name}`} />
          )}
          {!noteLocked && canApprove && row.status !== "ready" && (
            <div>
              <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} disabled={!!busy || !text.trim()} onClick={() => run("Saving…", () => onApprove(text))}>{busy || "Looks good"}</button>
            </div>
          )}
          {!noteLocked && !canApprove && text.trim() && text.trim() !== (row.note_en || "").trim() && (
            <div><button style={primaryBtn} disabled={!!busy} onClick={() => run("Saving…", () => onSaveDraft(text))}>{busy || "Save my changes"}</button></div>
          )}
          {!noteLocked && canApprove && row.status === "ready" && text.trim() !== (row.note_en || "").trim() && (
            <div><button style={primaryBtn} disabled={!!busy} onClick={() => run("Saving…", () => onApprove(text))}>{busy || "Save my changes"}</button></div>
          )}
        </div>
      )}
      {err && <p style={{ margin: 0, fontSize: 13, color: COLORS.bad }}>{err}</p>}
    </div>
  );
}

// ---------- admin: every class ----------

function Overview({ week, onOpen }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setState(null); setError("");
      const [st, wu, lw, cn, bh, gs] = await Promise.all([
        supabase.from("students").select("id, full_name, grade"),
        supabase.from("weekly_updates").select("student_id, grade, status").eq("week_start", week),
        supabase.from("weekly_updates").select("grade, ack_at").eq("week_start", addDays(week, -7)).eq("status", "sent"),
        supabase.from("weekly_class_notes").select("grade, sent_at").eq("week_start", week),
        supabase.from("weekly_updates").select("student_id, grade, week_start, behavior").gte("week_start", addDays(week, -21)).lte("week_start", week).eq("behavior", "sometimes"),
        supabase.from("grade_staff").select("grade, homeroom_teacher")
      ]);
      const err = st.error || wu.error || lw.error || cn.error || bh.error;
      if (err) { if (alive) setError(/weekly_/.test(err.message) ? "Weekly updates aren't switched on yet. Please run weekly-updates.sql in Supabase." : err.message); return; }
      if (alive) setState({ students: st.data || [], wu: wu.data || [], lw: lw.data || [], cn: cn.data || [], bh: bh.data || [], gs: gs.data || [] });
    })();
    return () => { alive = false; };
  }, [week]);

  if (error) return <p style={{ ...card, color: COLORS.bad }}>{error}</p>;
  if (!state) return <p style={{ ...card, color: COLORS.muted }}>Loading…</p>;

  const byGrade = (list, g) => list.filter((r) => r.grade === g);
  const grades = GRADES.filter((g) => state.students.some((s) => s.grade === g));
  const sentClasses = grades.filter((g) => byGrade(state.wu, g).some((r) => r.status === "sent")).length;
  const withUpdate = state.wu.filter((r) => r.status === "sent").length;
  const lwAck = state.lw.filter((r) => r.ack_at).length;
  const teacher = (g) => state.gs.find((r) => r.grade === g)?.homeroom_teacher || "—";
  const name = (id) => state.students.find((s) => s.id === id)?.full_name || "";

  // Behavior "Sometimes" this week, with how many weeks in a row.
  const follow = Object.values(state.bh.reduce((acc, r) => {
    (acc[r.student_id] = acc[r.student_id] || { id: r.student_id, grade: r.grade, weeks: new Set() }).weeks.add(r.week_start);
    return acc;
  }, {}))
    .filter((f) => f.weeks.has(week))
    .map((f) => { let n = 0; while (f.weeks.has(addDays(week, -7 * n))) n += 1; return { ...f, streak: n }; })
    .sort((a, b) => b.streak - a.streak);

  const tile = (label, value, tone) => (
    <div style={{ ...cardToken, background: tone ? tone.bg : COLORS.surface, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 13, color: tone ? tone.fg : COLORS.muted, fontWeight: tone ? 600 : 400 }}>{label}</span>
      <strong style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: tone ? tone.fg : COLORS.ink }}>{value}</strong>
    </div>
  );

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 14 }}>
        {tile("Classes sent", `${sentClasses} of ${grades.length}`)}
        {tile("Children with an update", `${withUpdate} of ${state.students.filter((s) => grades.includes(s.grade)).length}`)}
        {tile("Families confirmed · last week", state.lw.length ? `${Math.round((100 * lwAck) / state.lw.length)}%` : "—")}
        {tile("Behavior to follow up", `${follow.length} ${follow.length === 1 ? "child" : "children"}`, follow.length ? TONES.warn : null)}
      </div>

      <section style={card}>
        <h2 style={{ ...h2, marginBottom: 10 }}>Classes</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: "left", color: COLORS.muted, fontSize: 12 }}>
                <th style={{ padding: "6px 8px" }}>CLASS</th><th style={{ padding: "6px 8px" }}>TEACHER</th><th style={{ padding: "6px 8px" }}>THIS WEEK</th>
                <th style={{ padding: "6px 8px" }}>CONFIRMED LAST WEEK</th><th style={{ padding: "6px 8px" }}>BEHAVIOR</th><th />
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => {
                const kids = state.students.filter((s) => s.grade === g).length;
                const rows = byGrade(state.wu, g);
                const sent = rows.filter((r) => r.status === "sent").length;
                const ready = rows.filter((r) => r.status === "ready").length;
                const lw = byGrade(state.lw, g);
                const flag = follow.filter((f) => f.grade === g).length;
                const st = sent ? [`Sent · ${sent} of ${kids}`, TONES.ok] : rows.length ? [`In progress · ${ready} of ${kids} ready`, TONES.warn] : ["Not started", TONES.neutral];
                return (
                  <tr key={g} style={{ borderTop: `1px solid ${COLORS.line}` }}>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{g}</td>
                    <td style={{ padding: "10px 8px" }}>{teacher(g)}</td>
                    <td style={{ padding: "10px 8px" }}><span style={pill(st[1])}>{st[0]}</span></td>
                    <td style={{ padding: "10px 8px" }}>{lw.length ? `${lw.filter((r) => r.ack_at).length} of ${lw.length}` : "—"}</td>
                    <td style={{ padding: "10px 8px", color: flag ? COLORS.warn : COLORS.muted, fontWeight: flag ? 600 : 400 }}>{flag ? `${flag} · Sometimes` : "—"}</td>
                    <td style={{ padding: "10px 8px" }}><button style={ghostBtn} onClick={() => onOpen(g)}>Open</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h2 style={h2}>Behavior to follow up</h2>
          <span style={small}>Only the admin and class teachers see this list</span>
        </div>
        {follow.length === 0 && <p style={{ ...small, margin: "8px 0 0" }}>No child was marked "Sometimes" for behavior this week.</p>}
        {follow.map((f) => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${COLORS.line}`, padding: "10px 0", fontSize: 14 }}>
            <span><strong>{name(f.id)}</strong> · {f.grade}</span>
            <span style={{ color: f.streak > 1 ? COLORS.warn : COLORS.text2 }}>Behavior and school values: <strong>Sometimes</strong>{f.streak > 1 ? ` for ${f.streak} weeks in a row` : " this week"}</span>
          </div>
        ))}
      </section>
    </>
  );
}

// ===========================================================================
// Family view (My child)
// ===========================================================================

export function WeeklyUpdatesFamily({ student, language }) {
  const lang = language === "fr" ? "fr" : "en";
  const t = T[lang];
  const [rows, setRows] = useState(null);
  const [notes, setNotes] = useState({});
  const [teacher, setTeacher] = useState("");
  const [open, setOpen] = useState(null);

  async function load() {
    if (!student?.id) return;
    const { data, error } = await supabase.from("weekly_updates").select("*")
      .eq("hub_student_id", student.id).eq("status", "sent").order("week_start", { ascending: false }).limit(12);
    if (error) { setRows(/weekly_/.test(error.message) ? null : []); return; }
    setRows(data || []);
    setOpen((o) => o || data?.[0]?.id || null);
    const weeks = Array.from(new Set((data || []).map((r) => r.week_start)));
    if (weeks.length) {
      const { data: cn } = await supabase.from("weekly_class_notes").select("*").eq("grade", data[0].grade).in("week_start", weeks);
      const map = {};
      (cn || []).forEach((n) => { map[`${n.grade}:${n.week_start}`] = n; });
      setNotes(map);
    }
    const { data: gs } = await supabase.from("grade_staff").select("homeroom_teacher").eq("grade", student.grade).maybeSingle();
    setTeacher(gs?.homeroom_teacher || "");
  }
  useEffect(() => { load(); }, [student?.id]);

  if (!rows) return null;
  const name = firstName(student.name) || student.name;
  if (rows.length === 0) {
    return (
      <section className="bsf-card" id="bs-weekly-updates">
        <h2>{t.title}</h2>
        <p className="bsf-muted" style={{ margin: 0 }}>{t.soon(name)}</p>
      </section>
    );
  }

  return (
    <section className="bsf-card" id="bs-weekly-updates">
      <h2>{t.title}</h2>
      {rows.map((r, i) => (
        open === r.id
          ? <FamilyWeek key={r.id} row={r} notes={notes[`${r.grade}:${r.week_start}`]} name={name} teacher={teacher} lang={lang} onAcked={load} />
          : (
            <button key={r.id} onClick={() => setOpen(r.id)} className="bsf-textbtn"
              style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "12px 0", borderTop: `1px solid ${COLORS.line}`, textAlign: "left" }}>
              <span>{i === 1 ? `${t.earlier} · ` : ""}{t.week(weekRange(r.week_start, lang))}</span>
              <span style={{ color: r.ack_at ? COLORS.ok : COLORS.warn }}>{r.ack_at ? "✓" : "•"}</span>
            </button>
          )
      ))}
    </section>
  );
}

function FamilyWeek({ row, notes, name, teacher, lang, onAcked }) {
  const t = T[lang];
  const [ticked, setTicked] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fr = notes?.fr || {};
  const pick = (k) => (lang === "fr" && fr[k] ? fr[k] : notes?.[k]);
  const a = row.attendance || {};
  const sub = { margin: "14px 0 6px", fontSize: 15, fontWeight: 600 };

  async function confirm() {
    if (!ticked) { setErr(t.tickFirst); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("weekly_ack", { p_id: row.id, p_note: note });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onAcked();
  }

  return (
    <div style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 12 }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.brand }}>{t.week(weekRange(row.week_start, lang))}</p>
      <h3 style={{ margin: "4px 0 2px", fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600 }}>{t.whose(name)}</h3>
      {teacher && <p className="bsf-muted" style={{ margin: 0 }}>{t.from(teacher)}</p>}

      <p style={{ fontSize: 15, lineHeight: 1.65, margin: "12px 0" }}>{lang === "fr" && row.note_fr ? row.note_fr : row.note_en}</p>
      {row.highlight && (
        <div style={{ borderRadius: 12, background: COLORS.tint, padding: "10px 12px", marginBottom: 6 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.brand }}>{t.highlight}</span>
          <span style={{ fontSize: 14 }}>{row.highlight}</span>
        </div>
      )}

      <p style={sub}>{t.glance}</p>
      {a.days > 0 && <Line left={t.atSchool} right={t.days(a)} />}
      {[["math", t.math, "math_topic"], ["ela", t.ela, "ela_topic"]].map(([k, label, topic]) => row[k] && (
        <div key={k} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 14 }}>{label}</strong>
            <span style={pill(FAMILY.levelTone[row[k]])}>{FAMILY.level[row[k]][lang]}</span>
          </div>
          {pick(topic) && <span className="bsf-muted" style={{ fontSize: 13 }}>{pick(topic)}</span>}
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${COLORS.line}`, padding: "8px 0" }}>
        <strong style={{ fontSize: 14 }}>{t.habits}</strong>
        {HABITS.map((h) => row[h.id] && <Line key={h.id} left={FAMILY.habit[h.id][lang]} right={FAMILY.freq[row[h.id]][lang]} />)}
      </div>

      {pick("uoi_topic") && (<><p style={sub}>{t.inClass}</p><p style={{ margin: 0, fontSize: 14 }}><strong>{t.uoi}:</strong> {pick("uoi_topic")}</p></>)}
      {pick("home_idea") && (<><p style={sub}>{t.home}</p><p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{pick("home_idea")}</p></>)}
      {(listOf(notes?.coming_up).length > 0 || pick("reminders")) && (
        <>
          <p style={sub}>{t.coming}</p>
          {listOf(notes?.coming_up).map((e) => <Line key={e.date + e.title} left={shortDay(e.date, lang)} right={lang === "fr" ? e.title_fr || e.title : e.title} />)}
          {pick("reminders") && <p style={{ margin: "6px 0 0", fontSize: 14, whiteSpace: "pre-line" }}>{pick("reminders")}</p>}
        </>
      )}

      <div style={{ marginTop: 16, border: `2px solid ${COLORS.brand}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {row.ack_at ? (
          <>
            <strong style={{ color: COLORS.ok }}>{t.acked(longDate(row.ack_at, lang))}</strong>
            {row.ack_note && <span style={{ fontSize: 14 }}>{t.yourNote} {row.ack_note}</span>}
          </>
        ) : (
          <>
            <strong style={{ fontSize: 16 }}>{t.ackTitle}</strong>
            <span className="bsf-muted" style={{ fontSize: 13 }}>{t.ackWhy(name)}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, fontSize: 14 }}>
              <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} style={{ width: 22, height: 22, accentColor: COLORS.brand, margin: 0 }} />
              {t.ackBox(name)}
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600 }}>
              {t.ackNote}
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, fontWeight: 400, resize: "vertical" }} />
            </label>
            <button style={{ ...primaryBtn, minHeight: 46, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={confirm}>{t.ackBtn}</button>
            {err && <span style={{ fontSize: 13, color: COLORS.bad }}>{err}</span>}
          </>
        )}
      </div>
      <button className="bsf-textbtn" style={{ marginTop: 10 }}
        onClick={() => document.getElementById("bs-child-messages")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{t.reply}</button>
    </div>
  );
}

function Line({ left, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "4px 0" }}>
      <span style={{ color: COLORS.text2 }}>{left}</span><strong>{right}</strong>
    </div>
  );
}

// ===========================================================================
// Staff: the child's file (Students › family view): every sent week and its confirmation
// ===========================================================================

export function WeeklyHistoryStaff({ student }) {
  const [rows, setRows] = useState(null);
  const [who, setWho] = useState({});
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!student?.id) return;
      const { data, error } = await supabase.from("weekly_updates")
        .select("id, week_start, status, note_en, highlight, math, ela, participation, behavior, effort, ack_at, ack_by, ack_note, sent_at")
        .eq("hub_student_id", student.id).eq("status", "sent").order("week_start", { ascending: false }).limit(40);
      if (!alive) return;
      if (error) { setRows([]); return; }
      setRows(data || []);
      const ids = Array.from(new Set((data || []).map((r) => r.ack_by).filter(Boolean)));
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        if (alive) setWho(Object.fromEntries((ps || []).map((p) => [p.id, p.full_name])));
      }
    })();
    return () => { alive = false; };
  }, [student?.id]);

  if (!rows) return null;
  const acked = rows.filter((r) => r.ack_at).length;
  const lbl = (list, id) => list.find((x) => x.id === id)?.label || "—";

  return (
    <section className="bsf-card">
      <h2>Weekly updates</h2>
      <p className="bsf-muted">{rows.length ? `${rows.length} sent · ${acked} confirmed by the family` : "No weekly update sent yet."}</p>
      {rows.map((r) => (
        <div key={r.id} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "10px 0" }}>
          <button className="bsf-textbtn" onClick={() => setOpen(open === r.id ? null : r.id)}
            style={{ display: "flex", justifyContent: "space-between", width: "100%", textAlign: "left", gap: 10 }}>
            <span>Week of {weekRange(r.week_start)}</span>
            <span style={{ color: r.ack_at ? COLORS.ok : COLORS.warn, fontWeight: 600 }}>
              {r.ack_at ? `✓ Read · ${shortDay(r.ack_at.slice(0, 10))}` : "Not confirmed"}
            </span>
          </button>
          {open === r.id && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, fontSize: 14 }}>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{r.note_en}</p>
              {r.highlight && <p style={{ margin: 0 }}><strong>Highlight:</strong> {r.highlight}</p>}
              <p className="bsf-muted" style={{ margin: 0, fontSize: 13 }}>
                Math {lbl(LEVELS, r.math)} · ELA {lbl(LEVELS, r.ela)} · Participation {lbl(FREQ, r.participation)} · Behavior {lbl(FREQ, r.behavior)} · Effort {lbl(FREQ, r.effort)}
              </p>
              {r.ack_at && (
                <p style={{ margin: 0, fontSize: 13 }}>
                  Confirmed by {who[r.ack_by] || "a parent"} on {longDate(r.ack_at)}{r.ack_note ? ` · “${r.ack_note}”` : ""}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}


// ===========================================================================
// Parent Dashboard: a card while a sent weekly update is not confirmed yet
// ===========================================================================

export function WeeklyUpdateCard({ students, language, onOpen }) {
  const lang = language === "fr" ? "fr" : "en";
  const [rows, setRows] = useState([]);
  const ids = (students || []).map((s) => s.id);
  useEffect(() => {
    if (!ids.length) return;
    supabase.from("weekly_updates").select("id, hub_student_id, week_start")
      .in("hub_student_id", ids).eq("status", "sent").is("ack_at", null)
      .gte("week_start", addDays(currentMonday(), -14)).order("week_start", { ascending: false })
      .then(({ data, error }) => { if (!error) setRows(data || []); });
  }, [ids.join(",")]);
  if (!rows.length) return null;
  const kids = Array.from(new Set(rows.map((r) => r.hub_student_id)))
    .map((id) => students.find((s) => s.id === id)).filter(Boolean);
  const names = kids.map((k) => firstName(k.name) || k.name);
  const list = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + (lang === "fr" ? " et " : " and ") + names[names.length - 1];
  return (
    <section className="bsf-card" style={{ border: `2px solid ${COLORS.brand}` }}>
      <h2 style={{ marginTop: 0 }}>{lang === "fr" ? "Nouveau point de la semaine" : "New weekly update"}</h2>
      <p style={{ margin: "0 0 12px" }}>
        {lang === "fr"
          ? `Le point de la semaine de ${list} est prêt. Merci de le lire et de confirmer votre lecture.`
          : `${list}'s weekly update is ready. Please read it and confirm.`}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {kids.map((k) => (
          <button key={k.id} className="bsf-btn" onClick={() => onOpen(k.id)}>
            {lang === "fr" ? `Lire · ${firstName(k.name) || k.name}` : `Read · ${firstName(k.name) || k.name}`}
          </button>
        ))}
      </div>
    </section>
  );
}

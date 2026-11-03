// Pre-N daily diary (simplified 3 Nov 2026: "we are a school with a pre-nursery, not a daycare").
// No times. Staff fill in once a day: what the class did (a few taps + one optional line),
// then one row per child (mood, lunch, rest, optional note), and the class teacher sends it.
// Photos reach tagged families straight away; children marked "No photos" can never be tagged.
// Assistants and diary-only helpers (profiles.diary_grades) fill everything in; only the class teacher or admin sends.
// Staff screens are English only; the family view follows the EN/FR toggle.

import { useEffect, useMemo, useState, useCallback } from "react";
import { Camera, Image as ImageIcon, Utensils, Moon, Droplet, Smile, PencilLine, LogIn, LogOut, Trash2, Loader2, Send } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment, getAttachmentUrl, deleteAttachment, shrinkImage } from "./lib/attachments";
import { COLORS, TONES, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, pill } from "./ui/tokens";
import { Modal } from "./ui/common";
import { StaffFamilyNotes, FamilyMorningNote, StaffStories, FamilyStories, StaffPosts, FamilyPosts, StaffFeedback, FamilyFeedback } from "./DiaryExtras";

// Classes that use the daily report. Add "PreK" here later if wanted.
export const DAILY_GRADES = ["Pre-N"];

const card = { ...cardToken, marginBottom: 14 };
const h2 = { margin: 0, fontSize: 17, fontWeight: 600 };
const small = { fontSize: 13, color: COLORS.muted };
const bigBtn = {
  minHeight: 78, borderRadius: 16, border: `1px solid ${COLORS.line}`, background: COLORS.surface,
  color: COLORS.ink, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6
};

const MEALS = [
  { id: "morning_snack", en: "Morning snack", fr: "Collation du matin" },
  { id: "lunch", en: "Lunch", fr: "Déjeuner" },
  { id: "afternoon_snack", en: "Afternoon snack", fr: "Goûter" },
  { id: "water", en: "Water", fr: "Eau" }
];
const AMOUNTS = [
  { id: "none", en: "None", fr: "Rien", pct: 0 },
  { id: "some", en: "A little", fr: "Un peu", pct: 25 },
  { id: "half", en: "Half", fr: "La moitié", pct: 50 },
  { id: "most", en: "Most", fr: "Presque tout", pct: 75 },
  { id: "all", en: "All", fr: "Tout", pct: 100 }
];
const TOILET_TYPES = [
  { id: "potty", en: "Potty", fr: "Pot" },
  { id: "toilet", en: "Toilet", fr: "Toilettes" },
  { id: "diaper", en: "Diaper change", fr: "Change de couche" }
];
const TOILET_RESULTS = [
  { id: "wet", en: "Wet", fr: "Mouillée" },
  { id: "bm", en: "Bowel movement", fr: "Selles" },
  { id: "dry", en: "Dry", fr: "Sèche" },
  { id: "tried", en: "Tried", fr: "A essayé" }
];
const MOODS = [
  { id: "happy", en: "Happy", fr: "Joyeux" },
  { id: "calm", en: "Calm", fr: "Calme" },
  { id: "busy", en: "Busy and curious", fr: "Actif et curieux" },
  { id: "tired", en: "Tired", fr: "Fatigué" },
  { id: "upset", en: "Upset", fr: "Contrarié" },
  { id: "unwell", en: "Not feeling well", fr: "Pas en forme" }
];
const PARTS = [
  { id: "morning", en: "Morning", fr: "Matin" },
  { id: "afternoon", en: "Afternoon", fr: "Après-midi" }
];
const ACTIVITIES = [
  { id: "story", en: "Story time", fr: "Histoire", tone: { bg: "#F7E6E8", fg: "#801524" } },
  { id: "outdoor", en: "Outdoor play", fr: "Jeux dehors", tone: { bg: "#E4EFE7", fg: "#2F6040" } },
  { id: "music", en: "Songs and music", fr: "Chansons et musique", tone: { bg: "#F1E6F2", fg: "#6B3A6E" } },
  { id: "art", en: "Art", fr: "Arts plastiques", tone: { bg: "#F6EED9", fg: "#7A5B16" } },
  { id: "numbers", en: "Numbers", fr: "Nombres", tone: { bg: "#E7ECF5", fg: "#2F4A7F" } },
  { id: "sensory", en: "Sensory play", fr: "Jeux sensoriels", tone: { bg: "#E4EDF7", fg: "#2F5E8A" } },
  { id: "french", en: "French", fr: "Français", tone: { bg: "#F6EED9", fg: "#7A5B16" } },
  { id: "pe", en: "Movement", fr: "Motricité", tone: { bg: "#E4EFE7", fg: "#2F6040" } }
];
const NOTE_KINDS = [
  { id: "activity", label: "What they explored" },
  { id: "first", label: "A first today" },
  { id: "health", label: "Health and care" },
  { id: "note", label: "Other note" }
];
const SEND_ITEMS = [
  { id: "diapers", en: "Diapers", fr: "Couches" },
  { id: "wipes", en: "Wipes", fr: "Lingettes" },
  { id: "clothes", en: "Spare clothes", fr: "Vêtements de rechange" },
  { id: "water", en: "Water bottle", fr: "Gourde" },
  { id: "blanket", en: "Rest blanket", fr: "Couverture de sieste" },
  { id: "cream", en: "Cream", fr: "Crème" }
];

const MOOD3 = [
  { id: "happy", en: "Happy", fr: "Joyeux" },
  { id: "ok", en: "OK", fr: "Bien" },
  { id: "tired", en: "Tired", fr: "Fatigué" }
];
const LUNCH3 = [
  { id: "all", en: "All", fr: "Tout" },
  { id: "some", en: "Some", fr: "Une partie" },
  { id: "little", en: "Little", fr: "Très peu" }
];
const REST3 = [
  { id: "slept", en: "Slept", fr: "A dormi" },
  { id: "rested", en: "Rested", fr: "S'est reposé(e)" },
  { id: "no", en: "No rest", fr: "Pas de sieste" }
];
const GOOD_DAY = { mood: "happy", lunch: "all", rest: "slept" };
const filled = (r) => !!r && !r.absent && !!(r.mood || r.lunch || r.rest || (r.team_note || "").trim() || (r.send_tomorrow || "").trim());

const lab = (list, id, lang = "en") => {
  const x = list.find((i) => i.id === id);
  return x ? x[lang] || x.en || x.label : id || "";
};
const pad = (n) => String(n).padStart(2, "0");
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const addDays = (s, n) => {
  const d = new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// Skip weekends when moving between days.
const stepSchoolDay = (s, dir) => {
  let d = addDays(s, dir);
  while ([0, 6].includes(new Date(`${d}T12:00:00`).getDay())) d = addDays(d, dir);
  return d;
};
const hm = (t) => (t ? String(t).slice(0, 5) : "");
const dayTitle = (s, lang = "en") =>
  new Date(`${s}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
const firstName = (st) => st.first_name || (st.full_name || "").split(" ")[0] || "Child";
const minutesBetween = (a, b) => {
  if (!a || !b) return null;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  const m = bh * 60 + bm - (ah * 60 + am);
  return m > 0 ? m : null;
};
const listOf = (v) => (Array.isArray(v) ? v : []);

// One line describing an entry, for the timeline.
function describe(e, lang = "en") {
  const d = e.details || {};
  const fr = lang === "fr";
  switch (e.kind) {
    case "arrival": return fr ? "Arrivé(e) à l'école" : "Arrived at school";
    case "departure": return fr ? "Parti(e) de l'école" : "Left school";
    case "meal": return `${lab(MEALS, d.meal, lang)}: ${lab(AMOUNTS, d.amount, lang).toLowerCase()}${d.food ? ` · ${d.food}` : ""}`;
    case "rest":
      if (d.end) return `${fr ? "Sieste" : "Rest"} ${hm(d.start)} – ${hm(d.end)}`;
      return fr ? "S'est endormi(e)" : "Fell asleep";
    case "toilet": return `${lab(TOILET_TYPES, d.type, lang)}${d.result ? `: ${lab(TOILET_RESULTS, d.result, lang).toLowerCase()}` : ""}`;
    case "mood": return `${fr ? "Humeur" : "Mood"} (${lab(PARTS, d.part, lang).toLowerCase()}): ${lab(MOODS, d.mood, lang).toLowerCase()}`;
    case "activity": return `${d.activity ? lab(ACTIVITIES, d.activity, lang) + (d.text ? ": " : "") : ""}${d.text || ""}`;
    case "first": return `${fr ? "Une première" : "A first"}: ${d.text || ""}`;
    case "health": return `${fr ? "Santé" : "Health"}: ${d.text || ""}`;
    default: return d.text || "";
  }
}

function PhotoImg({ path, style, alt = "" }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    getAttachmentUrl(path).then((u) => live && setUrl(u)).catch(() => live && setUrl(""));
    return () => { live = false; };
  }, [path]);
  return url
    ? <img src={url} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, display: "block", ...style }} />
    : <div style={{ width: "100%", height: "100%", borderRadius: 14, background: COLORS.neutralBg, ...style }} />;
}

// ======================================================================================
// STAFF: Daily log
// ======================================================================================

export function staffDailyGrades(profile) {
  if (!profile) return [];
  if (profile.role === "admin") return DAILY_GRADES;
  if (!["teacher", "learning_assistant"].includes(profile.role)) return [];
  const mine = [...listOf(profile.grades_assigned), ...listOf(profile.assigned_grades), ...listOf(profile.assistant_grades), ...listOf(profile.diary_grades)];
  return DAILY_GRADES.filter((g) => mine.includes(g));
}

// Sending to families: the class teacher and the admin only. Assistants (e.g. Aichata)
// and diary-only helpers fill it in but do not send (Myri, 3 Nov 2026).
function canSendDiary(profile, grade) {
  if (profile?.role === "admin") return true;
  const mine = [...listOf(profile?.grades_assigned), ...listOf(profile?.assigned_grades)];
  return profile?.role === "teacher" && mine.includes(grade);
}

export default function DailyLogTab({ profile }) {
  const grades = staffDailyGrades(profile);
  const [grade, setGrade] = useState(grades[0] || null);
  const [day, setDay] = useState(today());
  const [section, setSection] = useState("today");
  const [roster, setRoster] = useState([]);
  useEffect(() => {
    if (!grade) return;
    supabase.from("students").select("id, full_name, first_name, legacy_id, no_photos").eq("grade", grade).order("first_name").then(({ data }) => setRoster(data || []));
  }, [grade]);

  if (!grades.length) return <p style={{ ...card, color: COLORS.muted }}>The Pre-N Diary is for Pre-N staff. No Pre-N class is assigned to you.</p>;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.brand }}>Pre-N Diary</p>
          <h1 style={{ margin: "4px 0 0", fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600 }}>
            {section === "today" ? (day === today() ? "Today" : dayTitle(day)) : section === "stories" ? "Learning stories" : "Class posts"}
          </h1>
        </div>
        {section === "today" && <div style={{ display: "flex", gap: 8 }}>
          <button style={ghostBtn} onClick={() => setDay(stepSchoolDay(day, -1))}>‹ Previous day</button>
          <button style={{ ...ghostBtn, opacity: day >= today() ? 0.5 : 1 }} disabled={day >= today()} onClick={() => setDay(stepSchoolDay(day, 1) > today() ? today() : stepSchoolDay(day, 1))}>Next ›</button>
        </div>}
      </div>
      <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, padding: 8 }}>
        {[["today", "Today"], ["stories", "Learning stories"], ["posts", "Class posts"]].map(([id, label]) => (
          <button key={id} style={{ ...(section === id ? chipOn : chip), minHeight: 44, borderRadius: 12 }} onClick={() => setSection(id)}>{label}</button>
        ))}
      </div>
      {grades.length > 1 && (
        <div style={{ ...card, display: "flex", gap: 7, flexWrap: "wrap" }}>
          {grades.map((g) => <button key={g} style={g === grade ? chipOn : chip} onClick={() => setGrade(g)}>{g}</button>)}
        </div>
      )}
      {section === "today" && <>
        <StaffFamilyNotes grade={grade} day={day} students={roster} />
        <ClassDay key={`${grade}-${day}`} grade={grade} day={day} profile={profile} />
      </>}
      {section === "stories" && <StaffStories key={grade} grade={grade} students={roster} profile={profile} />}
      {section === "posts" && <StaffPosts key={grade} grade={grade} students={roster} profile={profile} />}
    </div>
  );
}

function ClassDay({ grade, day, profile }) {
  const isAdmin = profile?.role === "admin";
  const canSend = canSendDiary(profile, grade);
  const [students, setStudents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [rows, setRows] = useState({});
  const [classDay, setClassDay] = useState({ activities: [], note: "" });
  const [openNote, setOpenNote] = useState(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [st, ph, su, cd] = await Promise.all([
      supabase.from("students").select("id, full_name, first_name, legacy_id, no_photos").eq("grade", grade).order("first_name"),
      supabase.from("daily_photos").select("*").eq("grade", grade).eq("day", day).order("created_at", { ascending: false }),
      supabase.from("daily_summaries").select("*").eq("grade", grade).eq("day", day),
      supabase.from("daily_class_days").select("*").eq("grade", grade).eq("day", day).maybeSingle()
    ]);
    const err = st.error || ph.error || su.error || cd.error;
    if (err) setError("Could not load the diary. Check your connection and try again.");
    setStudents(st.data || []);
    setPhotos(ph.data || []);
    setRows(Object.fromEntries((su.data || []).map((r) => [r.student_id, r])));
    setClassDay({ activities: cd.data?.activities || [], note: cd.data?.note || "" });
    setLoading(false);
  }, [grade, day]);

  useEffect(() => { load(); }, [load]);
  // Two staff may fill it in at the same time: refresh every minute while the screen is open.
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const flash = (msg) => { setStatus(msg); setTimeout(() => setStatus(""), 3000); };

  // Save one child's row (a tap saves straight away).
  const saveRow = async (s, patch) => {
    const cur = rows[s.id] || {};
    if (cur.sent_at && !canSend) { setError("This day has been sent. Only the class teacher can change it now."); return; }
    const next = { ...cur, ...patch };
    setRows((r) => ({ ...r, [s.id]: next }));
    setError("");
    const { error: e } = await supabase.from("daily_summaries").upsert(
      { student_id: s.id, day, mood: next.mood || null, lunch: next.lunch || null, rest: next.rest || null,
        absent: !!next.absent, team_note: (next.team_note || "").trim() || null, send_tomorrow: next.send_tomorrow || null },
      { onConflict: "student_id,day" });
    if (e) { setError("Could not save. Please try again."); load(); }
  };

  const saveClass = async (patch) => {
    const next = { ...classDay, ...patch };
    setClassDay(next);
    const { error: e } = await supabase.from("daily_class_days").upsert(
      { grade, day, activities: next.activities, note: (next.note || "").trim() || null, updated_at: new Date().toISOString() },
      { onConflict: "grade,day" });
    if (e) setError("Could not save. Please try again.");
  };

  // Fill the blanks with a good day; anything already chosen is kept, absent children are skipped.
  const goodDay = async () => {
    for (const s of students) {
      const r = rows[s.id] || {};
      if (r.absent) continue;
      const patch = {};
      Object.entries(GOOD_DAY).forEach(([k, v]) => { if (!r[k]) patch[k] = v; });
      if (Object.keys(patch).length) await saveRow(s, patch);
    }
    flash("Done. Now change only what was different.");
  };

  const send = async () => {
    const ready = students.filter((s) => filled(rows[s.id]) && !rows[s.id].sent_at).length;
    if (!ready) { setError("Fill in at least one child first."); return; }
    if (!window.confirm(`Send today's diary to ${ready} ${ready === 1 ? "family" : "families"}?`)) return;
    setSending(true);
    const { data: n, error: e } = await supabase.rpc("daily_send", { p_grade: grade, p_day: day });
    setSending(false);
    if (e) setError("Could not send. Please try again.");
    else flash(n ? `Sent to ${n} ${n === 1 ? "family" : "families"}.` : "Nothing new to send.");
    load();
  };

  const removePhoto = async (p) => {
    if (!window.confirm("Delete this photo for every family it was sent to?")) return;
    const { error: err } = await supabase.from("daily_photos").delete().eq("id", p.id);
    if (err) { setError("Could not delete. Only the person who shared it, or the admin, can delete it."); return; }
    await deleteAttachment(p.path).catch(() => {});
    load();
  };

  if (loading) return <p style={{ ...card, color: COLORS.muted }}>Loading…</p>;

  const present = students.filter((s) => !rows[s.id]?.absent);
  const readyCount = students.filter((s) => filled(rows[s.id])).length;
  const sentCount = students.filter((s) => rows[s.id]?.sent_at).length;
  const toSend = students.filter((s) => filled(rows[s.id]) && !rows[s.id].sent_at).length;
  const lbl = { ...small, fontWeight: 600, margin: "0 0 8px" };
  const seg = (list, value, onPick, disabled) => (
    <div style={{ display: "inline-flex", border: `1px solid ${COLORS.line}`, borderRadius: 10, overflow: "hidden", width: "100%" }}>
      {list.map((o, k) => (
        <button key={o.id} disabled={disabled} onClick={() => onPick(value === o.id ? null : o.id)}
          style={{ flex: 1, minHeight: 40, border: "none", borderLeft: k ? `1px solid ${COLORS.line}` : "none", fontFamily: "inherit", fontSize: 13, cursor: disabled ? "default" : "pointer",
            background: value === o.id ? COLORS.brand : COLORS.surface, color: value === o.id ? "#fff" : COLORS.ink, fontWeight: value === o.id ? 600 : 400, padding: "0 4px" }}>
          {o.en}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <section style={card}>
        <p style={lbl}>1 · Our day (for the whole class)</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ACTIVITIES.map((a) => {
            const on = classDay.activities.includes(a.id);
            return <button key={a.id} style={{ ...(on ? chipOn : chip), minHeight: 40 }}
              onClick={() => saveClass({ activities: on ? classDay.activities.filter((x) => x !== a.id) : [...classDay.activities, a.id] })}>{a.en}</button>;
          })}
        </div>
        <input value={classDay.note} onChange={(e) => setClassDay({ ...classDay, note: e.target.value })} onBlur={() => saveClass({})}
          placeholder="One line about the day (optional), e.g. We painted with leaves" style={{ ...input, marginTop: 12 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44 }} onClick={() => setShowPhoto(true)}><Camera size={18} />Add photos</button>
          <span style={small}>{photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} shared today` : "Photos reach families straight away."}</span>
        </div>
        {photos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 10 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative", aspectRatio: "1 / 1" }}>
                <PhotoImg path={p.path} alt={p.caption || "Class photo"} />
                <button onClick={() => setFeedbackFor(p)} style={{ position: "absolute", left: 4, bottom: 4, border: "none", borderRadius: 999, background: "rgba(255,255,255,.92)", fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "3px 8px", cursor: "pointer", color: COLORS.brand }}>Reactions</button>
                <button aria-label="Delete photo" onClick={() => removePhoto(p)}
                  style={{ position: "absolute", top: 4, right: 4, width: 30, height: 30, borderRadius: 15, border: "none", background: "rgba(36,16,18,.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <p style={{ ...lbl, margin: 0 }}>2 · Each child (change only what was different)</p>
          <button style={{ ...ghostBtn, minHeight: 40 }} onClick={goodDay} disabled={!present.length}>Everyone: good day</button>
        </div>
        {students.map((s) => {
          const r = rows[s.id] || {};
          const locked = !!r.sent_at && !canSend;
          const hasNote = !!((r.team_note || "").trim() || (r.send_tomorrow || "").trim());
          return (
            <div key={s.id} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: r.absent ? 0 : 8 }}>
                <strong style={{ fontSize: 15 }}>{firstName(s)}</strong>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {r.sent_at && <span style={pill(r.seen_at ? "ok" : "info")}>{r.seen_at ? "Seen" : "Sent"}</span>}
                  {!r.absent && <button style={{ ...(hasNote ? chipOn : chip), minHeight: 34, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => setOpenNote(openNote === s.id ? null : s.id)} disabled={locked}><PencilLine size={14} />Note</button>}
                  <button style={{ ...(r.absent ? chipOn : chip), minHeight: 34, padding: "4px 10px" }} disabled={locked}
                    onClick={() => saveRow(s, r.absent ? { absent: false } : { absent: true, mood: null, lunch: null, rest: null })}>Absent</button>
                </span>
              </div>
              {!r.absent && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
                  <div><div style={{ ...small, fontSize: 12, marginBottom: 3 }}>Mood</div>{seg(MOOD3, r.mood, (v) => saveRow(s, { mood: v }), locked)}</div>
                  <div><div style={{ ...small, fontSize: 12, marginBottom: 3 }}>Lunch</div>{seg(LUNCH3, r.lunch, (v) => saveRow(s, { lunch: v }), locked)}</div>
                  <div><div style={{ ...small, fontSize: 12, marginBottom: 3 }}>Rest</div>{seg(REST3, r.rest, (v) => saveRow(s, { rest: v }), locked)}</div>
                </div>
              )}
              {openNote === s.id && !r.absent && (
                <div style={{ marginTop: 10 }}>
                  <textarea rows={2} defaultValue={r.team_note || ""} onBlur={(e) => saveRow(s, { team_note: e.target.value })}
                    placeholder="Only if needed, e.g. a small bump on the knee, a first word" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
                  <div style={{ ...small, fontSize: 12, margin: "8px 0 4px" }}>Please bring tomorrow</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {SEND_ITEMS.map((it) => {
                      const list = (r.send_tomorrow || "").split(", ").filter(Boolean);
                      const on = list.includes(it.en);
                      return <button key={it.id} style={{ ...(on ? chipOn : chip), minHeight: 34 }}
                        onClick={() => saveRow(s, { send_tomorrow: (on ? list.filter((x) => x !== it.en) : [...list, it.en]).join(", ") })}>{it.en}</button>;
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {error && <p style={{ ...pill("bad"), display: "block", whiteSpace: "normal", marginTop: 12, fontSize: 13, padding: "8px 12px" }}>{error}</p>}
        {status && <p style={{ ...pill("ok"), display: "block", whiteSpace: "normal", marginTop: 12, fontSize: 13, padding: "8px 12px" }}>{status}</p>}
        <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 6, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={small}>{readyCount} of {present.length} filled in{sentCount ? ` · ${sentCount} sent` : ""}</span>
          {canSend
            ? <button style={{ ...primaryBtn, minHeight: 46, display: "inline-flex", alignItems: "center", gap: 8 }} disabled={sending || !toSend} onClick={send}>
                {sending ? <Loader2 size={18} className="bsf-spin" /> : <Send size={18} />}{toSend ? `Send to ${toSend} ${toSend === 1 ? "family" : "families"}` : "All sent"}
              </button>
            : <span style={small}>The class teacher sends it to families.</span>}
        </div>
      </section>

      {isAdmin && <PhotoConsent students={students} onSaved={load} />}

      {showPhoto && <PhotoPanel grade={grade} day={day} students={students} preselected={students.filter((s) => !rows[s.id]?.absent).map((s) => s.id)}
        onClose={() => setShowPhoto(false)} onDone={() => { setShowPhoto(false); flash("Photo shared with the families."); load(); }} />}
      {feedbackFor && (
        <Modal title="Reactions and comments" onClose={() => setFeedbackFor(null)}>
          <div style={{ maxWidth: 320 }}><PhotoImg path={feedbackFor.path} style={{ height: 200 }} /></div>
          <StaffFeedback type="photo" id={feedbackFor.id} students={students} />
        </Modal>
      )}
    </>
  );
}

function Choice({ list, value, onChange, lang = "en" }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {list.map((o) => (
        <button key={o.id} type="button" style={{ ...(value === o.id ? chipOn : chip), minHeight: 44 }} onClick={() => onChange(o.id)}>{o[lang] || o.label || o.en}</button>
      ))}
    </div>
  );
}

function PhotoPanel({ grade, day, students, preselected, onClose, onDone }) {
  const allowed = students.filter((s) => !s.no_photos);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [tags, setTags] = useState(preselected.filter((id) => allowed.some((s) => s.id === id)));
  const [activity, setActivity] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (list) => {
    const imgs = [...(list || [])].filter((f) => f.type.startsWith("image/"));
    setFiles((cur) => [...cur, ...imgs].slice(0, 6));
  };
  const toggle = (id) => setTags((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const families = tags.map((id) => firstName(students.find((s) => s.id === id) || {}));

  const share = async () => {
    if (!files.length) { setError("Take or choose a photo first."); return; }
    if (!tags.length) { setError("Tag at least one child."); return; }
    setBusy(true); setError("");
    try {
      const folder = `daily/${grade.replace(/[^a-zA-Z0-9-]/g, "_")}/${day}`;
      for (const f of files) {
        const meta = await uploadAttachment(await shrinkImage(f, 1600), folder);
        const { error: e } = await supabase.from("daily_photos").insert({
          grade, day, path: meta.path, student_ids: tags,
          caption: caption.trim() || null, activity: activity || null
        });
        if (e) { await deleteAttachment(meta.path).catch(() => {}); throw e; }
      }
      onDone();
    } catch (e) {
      setError(/consent/i.test(e?.message || "") ? "A tagged child does not have photo consent." : "Could not share the photo. Check your connection and try again.");
      setBusy(false);
    }
  };

  const lbl = { ...small, fontWeight: 600, margin: "14px 0 6px" };
  return (
    <Modal title="Share a photo" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...primaryBtn, display: "inline-flex", alignItems: "center", gap: 8, minHeight: 48 }}>
          <Camera size={18} />Take photo
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <label style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 8, minHeight: 48 }}>
          <ImageIcon size={18} />Choose from phone
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {previews.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
          {previews.map((u, i) => (
            <div key={u} style={{ position: "relative", aspectRatio: "1 / 1" }}>
              <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
              <button aria-label="Remove photo" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: 4, right: 4, width: 32, height: 32, borderRadius: 16, border: "none", background: "rgba(36,16,18,.65)", color: "#fff", cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
      )}
      <p style={lbl}>Who is in the photo?</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {students.map((s) => s.no_photos
          ? <span key={s.id} style={{ ...chip, minHeight: 44, display: "inline-flex", alignItems: "center", borderStyle: "dashed", background: COLORS.neutralBg, color: COLORS.faint, cursor: "default" }}>{firstName(s)} · no photos</span>
          : <button key={s.id} style={{ ...(tags.includes(s.id) ? chipOn : chip), minHeight: 44 }} onClick={() => toggle(s.id)}>{firstName(s)}</button>)}
      </div>
      <p style={lbl}>What were they doing?</p>
      <Choice list={ACTIVITIES} value={activity} onChange={(v) => setActivity(v === activity ? "" : v)} />
      <p style={lbl}>Caption (optional)</p>
      <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Building a sandcastle together" style={input} />
      {error && <p style={{ ...pill("bad"), display: "block", whiteSpace: "normal", marginTop: 12, fontSize: 13, padding: "8px 12px" }}>{error}</p>}
      <button style={{ ...primaryBtn, width: "100%", minHeight: 50, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={busy} onClick={share}>
        {busy ? <Loader2 size={18} className="bsf-spin" /> : <Send size={18} />}
        {busy ? "Sharing…" : families.length ? `Send to ${families.join(", ")}'s ${families.length > 1 ? "families" : "family"}` : "Send"}
      </button>
      <p style={{ ...small, marginTop: 10 }}>Each family sees only photos their own child is tagged in. Photos are kept on the Hub, not on your phone.</p>
    </Modal>
  );
}

function PhotoConsent({ students, onSaved }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const flip = async (s) => {
    setBusy(s.id);
    const { error } = await supabase.from("students").update({ no_photos: !s.no_photos }).eq("id", s.id);
    setBusy(null);
    if (error) window.alert("Could not save. Please try again.");
    onSaved();
  };
  return (
    <section style={card}>
      <button onClick={() => setOpen(!open)} style={{ ...ghostBtn, width: "100%", display: "flex", justifyContent: "space-between" }}>
        <span>Photo consent (admin)</span><span>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <p style={small}>Children marked "No photos" cannot be tagged, so their families never receive class photos of them.</p>
          {students.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${COLORS.line}`, padding: "10px 0" }}>
              <span>{s.full_name || firstName(s)}</span>
              <button style={{ ...(s.no_photos ? { ...chip, borderColor: COLORS.bad, color: COLORS.bad } : chip), minHeight: 40 }} disabled={busy === s.id} onClick={() => flip(s)}>
                {s.no_photos ? "No photos" : "Photos allowed"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ======================================================================================
// FAMILY: the child's day (on My child)
// ======================================================================================

const F = {
  en: { title: "Pre-N diary", tabToday: "Today", tabStories: "Learning stories", tabNews: "Class news", prev: "‹ Previous day", next: "Next ›", today: "Today",
        mood: "Mood", lunch: "Lunch", rest: "Rest", todayWe: "Today we", note: (who) => `Note from ${who}`, noteTeam: "Note from the team",
        send: "Please bring tomorrow", seen: "Seen", seenDone: "Thank you, the team can see you have read it.", photos: "Photos",
        absent: "Absent today.", pending: "The team will share today's diary at the end of the day.", nothing: "Nothing was shared on this day." },
  fr: { title: "Journal Pre-N", tabToday: "Aujourd'hui", tabStories: "Histoires d'apprentissage", tabNews: "Vie de la classe", prev: "‹ Jour précédent", next: "Suivant ›", today: "Aujourd'hui",
        mood: "Humeur", lunch: "Déjeuner", rest: "Sieste", todayWe: "Aujourd'hui, nous avons", note: (who) => `Mot de ${who}`, noteTeam: "Mot de l'équipe",
        send: "Merci d'apporter demain", seen: "Vu", seenDone: "Merci, l'équipe voit que vous l'avez lu.", photos: "Photos",
        absent: "Absent(e) aujourd'hui.", pending: "L'équipe partagera le journal du jour en fin de journée.", nothing: "Rien n'a été partagé ce jour-là." }
};

export function DailyReportFamily({ student, language = "en" }) {
  const lang = language === "fr" ? "fr" : "en";
  const L = F[lang];
  const [day, setDay] = useState(today());
  const [photos, setPhotos] = useState([]);
  const [summary, setSummary] = useState(null);
  const [classDay, setClassDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const [tab, setTab] = useState("today");
  const enabled = !!student && DAILY_GRADES.includes(student.grade);

  const load = useCallback(async () => {
    if (!enabled) return;
    const [ph, su, cd] = await Promise.all([
      supabase.from("daily_photos").select("id, path, caption, activity, created_at").contains("hub_student_ids", [student.id]).eq("day", day).order("created_at", { ascending: false }),
      supabase.from("daily_summaries").select("*").eq("hub_student_id", student.id).eq("day", day).maybeSingle(),
      supabase.from("daily_class_days").select("activities, note").eq("grade", student.grade).eq("day", day).maybeSingle()
    ]);
    setPhotos(ph.data || []);
    setSummary(su.data || null);
    setClassDay(cd.data || null);
    setLoading(false);
  }, [enabled, student?.id, student?.grade, day]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (!enabled) return null;

  const isToday = day === today();
  const sent = !!summary?.sent_at;
  const markSeen = async () => {
    const { error } = await supabase.rpc("daily_seen", { p_hub_student: student.id, p_day: day });
    if (!error) load();
  };

  const box = { background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 14 };
  const boxTitle = { margin: "0 0 6px", fontSize: 13, color: COLORS.muted };
  const acts = (classDay?.activities || []).map((id) => ACTIVITIES.find((a) => a.id === id)).filter(Boolean);
  const tiles = [[L.mood, MOOD3, summary?.mood], [L.lunch, LUNCH3, summary?.lunch], [L.rest, REST3, summary?.rest]].filter(([, , v]) => v);

  return (
    <section className="bsf-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>{L.title}</h2>
          <p className="bsf-muted" style={{ margin: "2px 0 0" }}>{isToday ? L.today : dayTitle(day, lang)}</p>
        </div>
        {tab === "today" && <div style={{ display: "flex", gap: 6 }}>
          <button style={{ ...ghostBtn, minHeight: 40 }} onClick={() => setDay(stepSchoolDay(day, -1))}>{L.prev}</button>
          {!isToday && <button style={{ ...ghostBtn, minHeight: 40 }} onClick={() => { const n = stepSchoolDay(day, 1); setDay(n > today() ? today() : n); }}>{L.next}</button>}
        </div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, marginTop: 12 }}>
        {[["today", L.tabToday], ["stories", L.tabStories], ["news", L.tabNews]].map(([id, label]) => (
          <button key={id} style={{ ...(tab === id ? chipOn : chip), minHeight: 44, borderRadius: 12, whiteSpace: "normal", lineHeight: 1.2 }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "stories" && <div style={{ marginTop: 12 }}><FamilyStories student={student} lang={lang} /></div>}
      {tab === "news" && <div style={{ marginTop: 12 }}><FamilyPosts student={student} lang={lang} /></div>}

      {tab === "today" && (loading ? <p className="bsf-muted">…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {isToday && <FamilyMorningNote student={student} lang={lang} />}

          {sent && summary.absent && <p className="bsf-muted" style={{ margin: 0 }}>{L.absent}</p>}

          {sent && tiles.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, gap: 8 }}>
              {tiles.map(([label, list, v]) => (
                <div key={label} style={{ ...box, padding: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{label}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{lab(list, v, lang)}</div>
                </div>
              ))}
            </div>
          )}

          {sent && (acts.length > 0 || classDay?.note) && (
            <div style={box}>
              <p style={boxTitle}>{L.todayWe}</p>
              {acts.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: classDay?.note ? 8 : 0 }}>
                  {acts.map((a) => <span key={a.id} style={{ fontSize: 13, fontWeight: 600, padding: "5px 11px", borderRadius: 999, background: a.tone.bg, color: a.tone.fg }}>{a[lang]}</span>)}
                </div>
              )}
              {classDay?.note && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{classDay.note}</p>}
            </div>
          )}

          {photos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(photos.length, 3)}, minmax(0, 1fr))`, gap: 8 }}>
              {photos.map((p) => (
                <button key={p.id} onClick={() => setViewer(p)} aria-label={p.caption || L.photos}
                  style={{ border: "none", padding: 0, background: "none", cursor: "pointer", aspectRatio: "1 / 1" }}>
                  <PhotoImg path={p.path} alt={p.caption || ""} />
                </button>
              ))}
            </div>
          )}

          {sent && summary.team_note && (
            <div style={box}>
              <p style={boxTitle}>{L.noteTeam}</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{summary.team_note}</p>
            </div>
          )}

          {sent && summary.send_tomorrow && (
            <div style={{ ...box, background: COLORS.warnBg, border: "none" }}>
              <p style={{ ...boxTitle, color: COLORS.warn }}>{L.send}</p>
              <div style={{ fontWeight: 600 }}>
                {summary.send_tomorrow.split(", ").map((x) => { const it = SEND_ITEMS.find((i) => i.en === x); return it ? it[lang] : x; }).join(" · ")}
              </div>
            </div>
          )}

          {sent
            ? (summary.seen_at
                ? <p style={{ ...pill("ok"), display: "block", whiteSpace: "normal", padding: "8px 12px", fontSize: 13 }}>{L.seenDone}</p>
                : <button style={{ ...primaryBtn, minHeight: 48 }} onClick={markSeen}>{L.seen}</button>)
            : <p className="bsf-muted" style={{ margin: 0, fontSize: 13 }}>{isToday ? L.pending : (photos.length ? "" : L.nothing)}</p>}
        </div>
      ))}

      {viewer && (
        <Modal title={viewer.caption || L.photos} onClose={() => setViewer(null)}>
          <PhotoImg path={viewer.path} alt={viewer.caption || ""} style={{ height: "auto", maxHeight: "70vh", objectFit: "contain" }} />
          {viewer.activity && <p className="bsf-muted" style={{ marginTop: 8 }}>{lab(ACTIVITIES, viewer.activity, lang)}</p>}
          <FamilyFeedback type="photo" id={viewer.id} hub={student.id} lang={lang} />
        </Modal>
      )}
    </section>
  );
}

// Pre-N daily report.
// Staff (the class teacher, the learning assistant, or the admin) log the day as it happens
// on their phone: arrival and pickup, meals, rest, toilet, mood, activities, a "first", health
// notes and photos taken with the phone camera. Each entry reaches the child's family straight
// away; photos only reach families whose child is tagged, and children marked "No photos" can
// never be tagged. At the end of the day staff add a team note and a "send tomorrow" list and
// send the summary; families tap "Seen".
// Staff screens are English only; the family view follows the EN/FR toggle.

import { useEffect, useMemo, useState, useCallback } from "react";
import { Camera, Image as ImageIcon, Utensils, Moon, Droplet, Smile, PencilLine, LogIn, LogOut, Trash2, Loader2, Send } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment, getAttachmentUrl, deleteAttachment, shrinkImage } from "./lib/attachments";
import { COLORS, TONES, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, pill } from "./ui/tokens";
import { Modal } from "./ui/common";

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
  const mine = [...listOf(profile.grades_assigned), ...listOf(profile.assigned_grades), ...listOf(profile.assistant_grades)];
  return DAILY_GRADES.filter((g) => mine.includes(g));
}

export default function DailyLogTab({ profile }) {
  const grades = staffDailyGrades(profile);
  const [grade, setGrade] = useState(grades[0] || null);
  const [day, setDay] = useState(today());

  if (!grades.length) return <p style={{ ...card, color: COLORS.muted }}>The daily log is for Pre-N staff. No Pre-N class is assigned to you.</p>;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ ...card, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.brand }}>Daily log</p>
          <h1 style={{ margin: "4px 0 0", fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600 }}>
            {grade} · {day === today() ? "Today" : dayTitle(day)}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={ghostBtn} onClick={() => setDay(stepSchoolDay(day, -1))}>‹ Previous day</button>
          <button style={{ ...ghostBtn, opacity: day >= today() ? 0.5 : 1 }} disabled={day >= today()} onClick={() => setDay(stepSchoolDay(day, 1) > today() ? today() : stepSchoolDay(day, 1))}>Next ›</button>
        </div>
      </div>
      {grades.length > 1 && (
        <div style={{ ...card, display: "flex", gap: 7, flexWrap: "wrap" }}>
          {grades.map((g) => <button key={g} style={g === grade ? chipOn : chip} onClick={() => setGrade(g)}>{g}</button>)}
        </div>
      )}
      <ClassDay key={`${grade}-${day}`} grade={grade} day={day} profile={profile} />
    </div>
  );
}

function ClassDay({ grade, day, profile }) {
  const isAdmin = profile?.role === "admin";
  const [students, setStudents] = useState([]);
  const [entries, setEntries] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [selected, setSelected] = useState([]);
  const [action, setAction] = useState(null);
  const [openChild, setOpenChild] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const [st, en, ph, su] = await Promise.all([
      supabase.from("students").select("id, full_name, first_name, legacy_id, no_photos").eq("grade", grade).order("first_name"),
      supabase.from("daily_entries").select("*").eq("grade", grade).eq("day", day).order("at_time", { ascending: true }),
      supabase.from("daily_photos").select("*").eq("grade", grade).eq("day", day).order("created_at", { ascending: false }),
      supabase.from("daily_summaries").select("*").eq("grade", grade).eq("day", day)
    ]);
    const err = st.error || en.error || ph.error || su.error;
    if (err) setError("Could not load the daily log. Check your connection and try again.");
    setStudents(st.data || []);
    setEntries(en.data || []);
    setPhotos(ph.data || []);
    setSummaries(Object.fromEntries((su.data || []).map((r) => [r.student_id, r])));
    setLoading(false);
  }, [grade, day]);

  useEffect(() => { load(); }, [load]);
  // Two staff may log at the same time: refresh every minute while the screen is open.
  useEffect(() => { const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);

  const byChild = useMemo(() => {
    const m = {};
    students.forEach((s) => { m[s.id] = { entries: [], photos: 0 }; });
    entries.forEach((e) => { if (m[e.student_id]) m[e.student_id].entries.push(e); });
    photos.forEach((p) => (p.student_ids || []).forEach((id) => { if (m[id]) m[id].photos += 1; }));
    return m;
  }, [students, entries, photos]);

  const toggle = (id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allOn = students.length > 0 && selected.length === students.length;
  const flash = (msg) => { setStatus(msg); setTimeout(() => setStatus(""), 3500); };

  const addEntries = async (kind, details, at_time) => {
    if (!selected.length) { setError("Choose at least one child first."); return false; }
    setError("");
    const rows = selected.map((id) => ({ student_id: id, day, kind, details, at_time: at_time || nowTime() }));
    const { error: e } = await supabase.from("daily_entries").insert(rows);
    if (e) { setError("Could not save. Please try again."); return false; }
    flash(`Saved for ${selected.length === 1 ? firstName(students.find((s) => s.id === selected[0])) : `${selected.length} children`}.`);
    await load();
    return true;
  };

  // Woke up: close the open rest of each chosen child.
  const wakeUp = async (endTime) => {
    const open = entries.filter((e) => e.kind === "rest" && !e.details?.end && selected.includes(e.student_id));
    if (!open.length) { setError("None of the chosen children is resting."); return false; }
    setError("");
    for (const e of open) {
      const { error: err } = await supabase.from("daily_entries").update({ details: { ...e.details, end: endTime } }).eq("id", e.id);
      if (err) { setError("Could not save. Please try again."); return false; }
    }
    flash("Rest times saved.");
    await load();
    return true;
  };

  const removeEntry = async (e) => {
    if (!window.confirm("Delete this entry? The family will no longer see it.")) return;
    const { error: err } = await supabase.from("daily_entries").delete().eq("id", e.id);
    if (err) setError("Could not delete. Only the person who added it, or the admin, can delete it.");
    await load();
  };

  const removePhoto = async (p) => {
    if (!window.confirm("Delete this photo for every family it was sent to?")) return;
    const { error: err } = await supabase.from("daily_photos").delete().eq("id", p.id);
    if (err) { setError("Could not delete. Only the person who shared it, or the admin, can delete it."); return; }
    await deleteAttachment(p.path).catch(() => {});
    await load();
  };

  const statusOf = (s) => {
    const list = byChild[s.id]?.entries || [];
    if (list.some((e) => e.kind === "departure")) return { text: "Gone home", tone: TONES.neutral };
    const openRest = list.find((e) => e.kind === "rest" && !e.details?.end);
    if (openRest) return { text: `Resting since ${hm(openRest.details.start || openRest.at_time)}`, tone: TONES.info };
    const isToday = day === today();
    if (isToday && nowTime() >= "12:45" && !list.some((e) => e.kind === "meal" && e.details?.meal === "lunch") && list.some((e) => e.kind === "arrival"))
      return { text: "Lunch not logged", tone: TONES.warn };
    if (!list.some((e) => e.kind === "arrival") && !list.length) return { text: "No entries yet", tone: TONES.neutral };
    return { text: "Here", tone: TONES.ok };
  };

  const lineOf = (s) => {
    const list = byChild[s.id]?.entries || [];
    const lunch = list.filter((e) => e.kind === "meal" && e.details?.meal === "lunch").pop();
    const bits = [];
    if (lunch) bits.push(`Lunch: ${lab(AMOUNTS, lunch.details.amount).toLowerCase()}`);
    const toilets = list.filter((e) => e.kind === "toilet").length;
    if (toilets) bits.push(`Toilet ${toilets}×`);
    const pc = byChild[s.id]?.photos || 0;
    if (pc) bits.push(`${pc} photo${pc > 1 ? "s" : ""}`);
    if (s.no_photos) bits.push("no photos");
    return bits.join(" · ") || "Nothing logged yet";
  };

  if (loading) return <p style={{ ...card, color: COLORS.muted }}>Loading…</p>;
  if (!students.length) return <p style={{ ...card, color: COLORS.muted }}>No children are listed in {grade} yet.</p>;

  const sentCount = students.filter((s) => summaries[s.id]?.sent_at).length;

  return (
    <>
      <section style={card}>
        <p style={{ ...small, fontWeight: 600, margin: "0 0 8px" }}>1 · Choose children</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button style={{ ...(allOn ? chipOn : chip), minHeight: 44 }} onClick={() => setSelected(allOn ? [] : students.map((s) => s.id))}>All</button>
          {students.map((s) => (
            <button key={s.id} style={{ ...(selected.includes(s.id) ? chipOn : chip), minHeight: 44 }} onClick={() => toggle(s.id)}>{firstName(s)}</button>
          ))}
        </div>
        <p style={{ ...small, fontWeight: 600, margin: "16px 0 8px" }}>2 · Tap what happened</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <button style={{ ...bigBtn, background: COLORS.brand, color: "#fff", border: "none" }} onClick={() => setAction("photo")}><Camera size={24} />Photo</button>
          <button style={bigBtn} onClick={() => setAction("meal")}><Utensils size={22} color={COLORS.brand} />Meal</button>
          <button style={bigBtn} onClick={() => setAction("rest")}><Moon size={22} color={COLORS.brand} />Rest</button>
          <button style={bigBtn} onClick={() => setAction("toilet")}><Droplet size={22} color={COLORS.brand} />Toilet</button>
          <button style={bigBtn} onClick={() => setAction("mood")}><Smile size={22} color={COLORS.brand} />Mood</button>
          <button style={bigBtn} onClick={() => setAction("note")}><PencilLine size={22} color={COLORS.brand} />Note</button>
          <button style={bigBtn} onClick={() => setAction("arrival")}><LogIn size={22} color={COLORS.brand} />Arrived</button>
          <button style={bigBtn} onClick={() => setAction("departure")}><LogOut size={22} color={COLORS.brand} />Picked up</button>
        </div>
        {error && <p style={{ ...pill("bad"), display: "block", whiteSpace: "normal", marginTop: 12, fontSize: 13, padding: "8px 12px" }}>{error}</p>}
        {status && <p style={{ ...pill("ok"), display: "block", whiteSpace: "normal", marginTop: 12, fontSize: 13, padding: "8px 12px" }}>{status}</p>}
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h2 style={h2}>Class right now</h2>
          <span style={small}>Tap a child to see or delete entries</span>
        </div>
        {students.map((s) => {
          const st = statusOf(s);
          return (
            <button key={s.id} onClick={() => setOpenChild(s)}
              style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `1px solid ${COLORS.line}`, padding: "12px 2px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "inherit", color: COLORS.ink }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 15 }}>{firstName(s)}</strong>
                <span style={small}>{lineOf(s)}</span>
              </span>
              <span style={pill(st.tone)}>{st.text}</span>
            </button>
          );
        })}
      </section>

      {photos.length > 0 && (
        <section style={card}>
          <h2 style={{ ...h2, marginBottom: 10 }}>Photos shared</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative", aspectRatio: "1 / 1" }}>
                <PhotoImg path={p.path} alt={p.caption || "Class photo"} />
                <button aria-label="Delete photo" onClick={() => removePhoto(p)}
                  style={{ position: "absolute", top: 6, right: 6, width: 36, height: 36, borderRadius: 18, border: "none", background: "rgba(36,16,18,.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <EndOfDay grade={grade} day={day} students={students} summaries={summaries} byChild={byChild} onSaved={load} sentCount={sentCount} />

      {isAdmin && <PhotoConsent students={students} onSaved={load} />}

      {action === "photo" && <PhotoPanel grade={grade} day={day} students={students} preselected={selected} onClose={() => setAction(null)} onDone={() => { setAction(null); flash("Photo shared with the families."); load(); }} />}
      {action && action !== "photo" && (
        <ActionPanel action={action} names={selected.map((id) => firstName(students.find((s) => s.id === id) || {}))}
          onClose={() => setAction(null)}
          onSave={async (kind, details, time) => { const ok = await addEntries(kind, details, time); if (ok) setAction(null); }}
          onWake={async (time) => { const ok = await wakeUp(time); if (ok) setAction(null); }} />
      )}
      {openChild && (
        <Modal title={`${firstName(openChild)} · ${day === today() ? "today" : dayTitle(day)}`} onClose={() => setOpenChild(null)}>
          {(byChild[openChild.id]?.entries || []).length === 0 && <p style={small}>Nothing logged yet.</p>}
          {(byChild[openChild.id]?.entries || []).map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${COLORS.line}` }}>
              <span style={{ ...small, width: 44 }}>{hm(e.at_time)}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{describe(e)}</span>
              {(isAdmin || e.created_by === profile?.id) && (
                <button aria-label="Delete entry" onClick={() => removeEntry(e)} style={{ ...ghostBtn, minHeight: 36, padding: "6px 10px" }}><Trash2 size={15} /></button>
              )}
            </div>
          ))}
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

function ActionPanel({ action, names, onClose, onSave, onWake }) {
  const [time, setTime] = useState(nowTime());
  const [f, setF] = useState(() => ({
    meal: nowTime() < "11:00" ? "morning_snack" : nowTime() < "14:00" ? "lunch" : "afternoon_snack",
    amount: "all", food: "", type: "potty", result: "wet",
    part: nowTime() < "12:30" ? "morning" : "afternoon", mood: "happy",
    noteKind: "activity", activity: "", text: ""
  }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((cur) => ({ ...cur, [k]: v }));
  const who = names.length ? names.join(", ") : "No child chosen yet";
  const titles = { meal: "Meal", rest: "Rest", toilet: "Toilet", mood: "Mood", note: "Note", arrival: "Arrived", departure: "Picked up" };
  const run = async (fn) => { setBusy(true); await fn(); setBusy(false); };

  const lbl = { ...small, fontWeight: 600, margin: "14px 0 6px" };
  return (
    <Modal title={titles[action]} onClose={onClose}>
      <p style={{ ...small, margin: 0 }}>For: <strong style={{ color: COLORS.ink }}>{who}</strong></p>
      <p style={lbl}>Time</p>
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...input, maxWidth: 160 }} />

      {action === "meal" && (<>
        <p style={lbl}>Which meal</p><Choice list={MEALS} value={f.meal} onChange={set("meal")} />
        <p style={lbl}>How much</p><Choice list={AMOUNTS} value={f.amount} onChange={set("amount")} />
        {f.meal !== "water" && (<>
          <p style={lbl}>What was served (optional)</p>
          <input value={f.food} onChange={(e) => set("food")(e.target.value)} placeholder="e.g. rice and fish" style={input} />
        </>)}
      </>)}
      {action === "toilet" && (<>
        <p style={lbl}>Type</p><Choice list={TOILET_TYPES} value={f.type} onChange={set("type")} />
        <p style={lbl}>Result</p><Choice list={TOILET_RESULTS} value={f.result} onChange={set("result")} />
      </>)}
      {action === "mood" && (<>
        <p style={lbl}>When</p><Choice list={PARTS} value={f.part} onChange={set("part")} />
        <p style={lbl}>Mood</p><Choice list={MOODS} value={f.mood} onChange={set("mood")} />
      </>)}
      {action === "note" && (<>
        <p style={lbl}>Kind of note</p><Choice list={NOTE_KINDS} value={f.noteKind} onChange={set("noteKind")} />
        {f.noteKind === "activity" && (<><p style={lbl}>Area</p><Choice list={ACTIVITIES} value={f.activity} onChange={set("activity")} /></>)}
        <p style={lbl}>{f.noteKind === "health" ? "What happened and what was done" : "Short note for the family"}</p>
        <textarea rows={3} value={f.text} onChange={(e) => set("text")(e.target.value)} style={{ ...input, resize: "vertical" }}
          placeholder={f.noteKind === "first" ? "e.g. Put on his shoes by himself" : f.noteKind === "health" ? "e.g. Small scratch on knee, cleaned at 10:15" : "e.g. Sorted leaves by size"} />
        {f.noteKind === "health" && <p style={{ ...small, marginTop: 6 }}>Injuries that need an incident report still go in the Incidents tab.</p>}
      </>)}

      <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        {action === "rest" ? (<>
          <button style={primaryBtn} disabled={busy} onClick={() => run(() => onSave("rest", { start: time }, time))}>Fell asleep</button>
          <button style={{ ...primaryBtn, background: COLORS.ok }} disabled={busy} onClick={() => run(() => onWake(time))}>Woke up</button>
        </>) : (
          <button style={primaryBtn} disabled={busy || (action === "note" && !f.text.trim() && !f.activity)}
            onClick={() => run(() => {
              if (action === "meal") return onSave("meal", { meal: f.meal, amount: f.amount, ...(f.food.trim() ? { food: f.food.trim() } : {}) }, time);
              if (action === "toilet") return onSave("toilet", { type: f.type, result: f.result }, time);
              if (action === "mood") return onSave("mood", { part: f.part, mood: f.mood }, time);
              if (action === "note") return onSave(f.noteKind, { text: f.text.trim(), ...(f.noteKind === "activity" && f.activity ? { activity: f.activity } : {}) }, time);
              return onSave(action, {}, time);
            })}>
            {busy ? "Saving…" : "Save"}
          </button>
        )}
        <button style={ghostBtn} onClick={onClose}>Cancel</button>
      </div>
    </Modal>
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

function EndOfDay({ grade, day, students, summaries, byChild, onSaved, sentCount }) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(students.map((s) => [s.id, {
      team_note: summaries[s.id]?.team_note || "",
      send: (summaries[s.id]?.send_tomorrow || "").split(", ").filter(Boolean)
    }])));
  const [savingId, setSavingId] = useState(null);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async (s) => {
    setSavingId(s.id);
    const d = drafts[s.id];
    const { error } = await supabase.from("daily_summaries").upsert(
      { student_id: s.id, day, team_note: d.team_note.trim() || null, send_tomorrow: d.send.join(", ") || null },
      { onConflict: "student_id,day" });
    setSavingId(null);
    setMsg(error ? "Could not save the note." : `Saved for ${firstName(s)}.`);
    if (!error) onSaved();
  };
  const setD = (id, patch) => setDrafts((cur) => ({ ...cur, [id]: { ...cur[id], ...patch } }));
  const toggleItem = (id, label) => {
    const cur = drafts[id].send;
    setD(id, { send: cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label] });
  };

  const send = async () => {
    if (!window.confirm("Send today's summary to the families of this class?")) return;
    setSending(true);
    // Save any typed notes first.
    for (const s of students) {
      const d = drafts[s.id];
      if (d.team_note.trim() || d.send.length) {
        await supabase.from("daily_summaries").upsert(
          { student_id: s.id, day, team_note: d.team_note.trim() || null, send_tomorrow: d.send.join(", ") || null },
          { onConflict: "student_id,day" });
      }
    }
    const { data: n, error } = await supabase.rpc("daily_send", { p_grade: grade, p_day: day });
    setSending(false);
    setMsg(error ? "Could not send. Please try again." : n ? `Summary sent to ${n} ${n === 1 ? "family" : "families"}.` : "Nothing new to send.");
    onSaved();
  };

  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={h2}>End of the day</h2>
        <span style={small}>{sentCount} of {students.length} sent</span>
      </div>
      <p style={{ ...small, margin: "6px 0 4px" }}>Add a short team note and anything to bring tomorrow, then send. Entries and photos are already on each family's timeline.</p>
      {students.map((s) => {
        const sum = summaries[s.id];
        const d = drafts[s.id] || { team_note: "", send: [] };
        return (
          <div key={s.id} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "12px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{firstName(s)}</strong>
              {sum?.seen_at ? <span style={pill("ok")}>Seen by family</span> : sum?.sent_at ? <span style={pill("info")}>Sent</span> : (byChild[s.id]?.entries.length ? null : <span style={pill("neutral")}>No entries</span>)}
            </div>
            <textarea rows={2} value={d.team_note} onChange={(e) => setD(s.id, { team_note: e.target.value })}
              placeholder="Note from the team (optional)" style={{ ...input, marginTop: 8, resize: "vertical" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <span style={{ ...small, alignSelf: "center" }}>Send tomorrow:</span>
              {SEND_ITEMS.map((it) => (
                <button key={it.id} style={{ ...(d.send.includes(it.en) ? chipOn : chip), minHeight: 36, padding: "6px 11px", fontSize: 12 }} onClick={() => toggleItem(s.id, it.en)}>{it.en}</button>
              ))}
            </div>
            <button style={{ ...ghostBtn, marginTop: 8, minHeight: 36 }} disabled={savingId === s.id} onClick={() => save(s)}>{savingId === s.id ? "Saving…" : "Save note"}</button>
          </div>
        );
      })}
      {msg && <p style={{ ...pill(/Could not/.test(msg) ? "bad" : "ok"), display: "block", whiteSpace: "normal", fontSize: 13, padding: "8px 12px", marginTop: 8 }}>{msg}</p>}
      <button style={{ ...primaryBtn, width: "100%", minHeight: 50, marginTop: 12, background: COLORS.ok }} disabled={sending} onClick={send}>
        {sending ? "Sending…" : "Send day summary to families"}
      </button>
    </section>
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
  en: { title: "Daily report", live: "Live today", noEntries: "No entries yet today. Updates appear here during the day.", noEntriesPast: "Nothing was logged on this day.",
        meals: "Meals", rest: "Rest", toilet: "Toilet", mood: "Mood", explored: "What they explored", first: "A first today", health: "Health and care",
        send: "Please send tomorrow", note: "Note from the team", seen: "Seen", seenDone: "Thank you, the team can see you have read it.", photos: "Photos",
        slept: (m) => `Slept ${m} min`, resting: "Resting now", times: (n) => `${n}×`, prev: "‹ Previous day", next: "Next ›", today: "Today",
        arrived: "Arrived", left: "Picked up", summaryPending: "The team's end-of-day summary will appear here." },
  fr: { title: "Journal du jour", live: "En direct aujourd'hui", noEntries: "Rien pour l'instant. Les nouvelles s'affichent ici pendant la journée.", noEntriesPast: "Rien n'a été noté ce jour-là.",
        meals: "Repas", rest: "Sieste", toilet: "Toilettes", mood: "Humeur", explored: "Ce qu'il/elle a exploré", first: "Une première aujourd'hui", health: "Santé et soins",
        send: "Merci d'apporter demain", note: "Mot de l'équipe", seen: "Vu", seenDone: "Merci, l'équipe voit que vous l'avez lu.", photos: "Photos",
        slept: (m) => `A dormi ${m} min`, resting: "Fait la sieste", times: (n) => `${n} fois`, prev: "‹ Jour précédent", next: "Suivant ›", today: "Aujourd'hui",
        arrived: "Arrivée", left: "Départ", summaryPending: "Le résumé de fin de journée de l'équipe s'affichera ici." }
};

export function DailyReportFamily({ student, language = "en" }) {
  const lang = language === "fr" ? "fr" : "en";
  const L = F[lang];
  const [day, setDay] = useState(today());
  const [entries, setEntries] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const enabled = !!student && DAILY_GRADES.includes(student.grade);

  const load = useCallback(async () => {
    if (!enabled) return;
    const [en, ph, su] = await Promise.all([
      supabase.from("daily_entries").select("*").eq("hub_student_id", student.id).eq("day", day).order("at_time", { ascending: true }),
      supabase.from("daily_photos").select("id, path, caption, activity, created_at").contains("hub_student_ids", [student.id]).eq("day", day).order("created_at", { ascending: false }),
      supabase.from("daily_summaries").select("*").eq("hub_student_id", student.id).eq("day", day).maybeSingle()
    ]);
    setEntries(en.data || []);
    setPhotos(ph.data || []);
    setSummary(su.data || null);
    setLoading(false);
  }, [enabled, student?.id, day]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  useEffect(() => {
    if (!enabled || day !== today()) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load, enabled, day]);

  if (!enabled) return null;

  const of = (k) => entries.filter((e) => e.kind === k);
  const arrival = of("arrival")[0];
  const departure = of("departure").slice(-1)[0];
  const meals = MEALS.map((m) => ({ ...m, e: of("meal").filter((e) => e.details?.meal === m.id).slice(-1)[0] })).filter((m) => m.e);
  const rests = of("rest");
  const toilets = of("toilet");
  const moods = PARTS.map((p) => ({ ...p, e: of("mood").filter((e) => e.details?.part === p.id).slice(-1)[0] })).filter((p) => p.e);
  const activities = of("activity");
  const firsts = of("first");
  const health = of("health");
  const notes = of("note");
  const isToday = day === today();
  const timeline = [...entries].sort((a, b) => (hm(b.at_time) > hm(a.at_time) ? 1 : -1));

  const markSeen = async () => {
    const { error } = await supabase.rpc("daily_seen", { p_hub_student: student.id, p_day: day });
    if (!error) load();
  };

  const box = { background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 14 };
  const boxTitle = { margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: COLORS.brand };

  return (
    <section className="bsf-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>{L.title}</h2>
          <p className="bsf-muted" style={{ margin: "2px 0 0" }}>
            {isToday ? L.today : dayTitle(day, lang)}
            {arrival && ` · ${L.arrived} ${hm(arrival.at_time)}`}
            {departure && ` · ${L.left} ${hm(departure.at_time)}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ ...ghostBtn, minHeight: 40 }} onClick={() => setDay(stepSchoolDay(day, -1))}>{L.prev}</button>
          {!isToday && <button style={{ ...ghostBtn, minHeight: 40 }} onClick={() => { const n = stepSchoolDay(day, 1); setDay(n > today() ? today() : n); }}>{L.next}</button>}
        </div>
      </div>

      {loading ? <p className="bsf-muted">…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
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

          {entries.length === 0 && photos.length === 0 && <p className="bsf-muted" style={{ margin: 0 }}>{isToday ? L.noEntries : L.noEntriesPast}</p>}

          {timeline.length > 0 && (
            <div style={box}>
              <p style={boxTitle}>{isToday ? L.live : (lang === "fr" ? "Fil de la journée" : "The day")}</p>
              {timeline.map((e) => (
                <div key={e.id} style={{ display: "flex", gap: 12, fontSize: 14, padding: "4px 0" }}>
                  <span style={{ width: 44, color: COLORS.muted, flexShrink: 0 }}>{hm(e.at_time)}</span>
                  <span>{describe(e, lang)}</span>
                </div>
              ))}
            </div>
          )}

          {(moods.length > 0) && (
            <div style={box}>
              <p style={boxTitle}>{L.mood}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {moods.map((m) => (
                  <div key={m.id}><div style={{ fontSize: 12, color: COLORS.muted }}>{m[lang]}</div><div style={{ fontWeight: 600 }}>{lab(MOODS, m.e.details.mood, lang)}</div></div>
                ))}
              </div>
            </div>
          )}

          {meals.length > 0 && (
            <div style={box}>
              <p style={boxTitle}>{L.meals}</p>
              {meals.map((m) => {
                const a = AMOUNTS.find((x) => x.id === m.e.details.amount) || AMOUNTS[0];
                return (
                  <div key={m.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>{m[lang]}{m.e.details.food ? ` · ${m.e.details.food}` : ""}</span><span>{a[lang]}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: COLORS.neutralBg, marginTop: 4 }}>
                      <div style={{ width: `${a.pct}%`, height: 8, borderRadius: 4, background: a.pct >= 75 ? COLORS.ok : COLORS.warn }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(rests.length > 0 || toilets.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {rests.length > 0 && (
                <div style={box}>
                  <p style={boxTitle}>{L.rest}</p>
                  {rests.map((r) => {
                    const m = minutesBetween(hm(r.details.start || r.at_time), hm(r.details.end));
                    return (
                      <div key={r.id} style={{ marginBottom: 4 }}>
                        <div style={{ fontWeight: 700 }}>{hm(r.details.start || r.at_time)}{r.details.end ? ` – ${hm(r.details.end)}` : ""}</div>
                        <div style={{ fontSize: 13, color: COLORS.muted }}>{m ? L.slept(m) : L.resting}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {toilets.length > 0 && (
                <div style={box}>
                  <p style={boxTitle}>{L.toilet}</p>
                  {TOILET_TYPES.map((t) => {
                    const n = toilets.filter((e) => e.details?.type === t.id).length;
                    return n ? <div key={t.id} style={{ fontSize: 14 }}>{t[lang]} {L.times(n)}</div> : null;
                  })}
                </div>
              )}
            </div>
          )}

          {activities.length > 0 && (
            <div style={box}>
              <p style={boxTitle}>{L.explored}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {[...new Set(activities.map((a) => a.details?.activity).filter(Boolean))].map((id) => {
                  const a = ACTIVITIES.find((x) => x.id === id);
                  return a ? <span key={id} style={{ fontSize: 13, fontWeight: 600, padding: "5px 11px", borderRadius: 999, background: a.tone.bg, color: a.tone.fg }}>{a[lang]}</span> : null;
                })}
              </div>
              {activities.filter((a) => a.details?.text).map((a) => <p key={a.id} style={{ margin: "4px 0", fontSize: 14, lineHeight: 1.5, color: COLORS.text2 }}>{a.details.text}</p>)}
            </div>
          )}

          {firsts.map((f) => (
            <div key={f.id} style={{ ...box, background: COLORS.okBg, border: "none" }}>
              <p style={{ ...boxTitle, color: COLORS.ok, fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>{L.first}</p>
              <div style={{ fontWeight: 600 }}>{f.details?.text}</div>
            </div>
          ))}

          {health.length > 0 && (
            <div style={box}>
              <p style={boxTitle}>{L.health}</p>
              {health.map((h) => <p key={h.id} style={{ margin: "4px 0", fontSize: 14, lineHeight: 1.5 }}>{hm(h.at_time)} · {h.details?.text}</p>)}
            </div>
          )}

          {notes.map((n) => <div key={n.id} style={box}><p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{n.details?.text}</p></div>)}

          {summary?.send_tomorrow && (
            <div style={{ ...box, background: COLORS.warnBg, border: "none" }}>
              <p style={{ ...boxTitle, color: COLORS.warn, fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em" }}>{L.send}</p>
              <div style={{ fontWeight: 600 }}>
                {summary.send_tomorrow.split(", ").map((x) => { const it = SEND_ITEMS.find((i) => i.en === x); return it ? it[lang] : x; }).join(" · ")}
              </div>
            </div>
          )}
          {summary?.team_note && (
            <div style={box}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: COLORS.muted }}>{L.note}</p>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>{summary.team_note}</p>
            </div>
          )}
          {summary?.sent_at ? (
            summary.seen_at
              ? <p style={{ ...pill("ok"), display: "block", whiteSpace: "normal", padding: "8px 12px", fontSize: 13 }}>{L.seenDone}</p>
              : <button style={{ ...primaryBtn, minHeight: 48 }} onClick={markSeen}>{L.seen}</button>
          ) : (isToday && entries.length > 0 && <p className="bsf-muted" style={{ margin: 0, fontSize: 13 }}>{L.summaryPending}</p>)}
        </div>
      )}

      {viewer && (
        <Modal title={viewer.caption || L.photos} onClose={() => setViewer(null)}>
          <PhotoImg path={viewer.path} alt={viewer.caption || ""} style={{ height: "auto", maxHeight: "70vh", objectFit: "contain" }} />
          {viewer.activity && <p className="bsf-muted" style={{ marginTop: 8 }}>{lab(ACTIVITIES, viewer.activity, lang)}</p>}
        </Modal>
      )}
    </section>
  );
}

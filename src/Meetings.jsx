// Parent–teacher conferences — parents book their own time (Myri, 7 Nov 2026).
// The school creates the time slots (20 min + 5 min break) per teacher. The admin opens booking;
// every family of those classes gets a notice. Parents pick a free time on My child — first come,
// first served: once a time is booked it disappears for everyone else. Parents can change or cancel
// while booking is open. Staff see the schedule; the admin can open/close booking, remind families
// who haven't booked, book for a family (e.g. by phone) and remove a booking.
// Term 1: PreK, KG, Grade 1 & 2 also have Tue 24 Nov 15:30–17:00; everyone has Wed 25 Nov
// 8:00–15:30 with lunch 12:00–13:00. Slots live in pt_slots; a booking also writes pt_meetings.
// Staff screens are English only; the family view follows the EN/FR toggle.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { COLORS, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, pill } from "./ui/tokens";
import { GRADES } from "./data/constants";

const card = { ...cardToken, marginBottom: 14 };
const small = { fontSize: 13, color: COLORS.muted };
const listOf = (v) => (Array.isArray(v) ? v : []);
const pad = (n) => String(n).padStart(2, "0");
const hm = (t) => (t ? String(t).slice(0, 5) : "");
const addMin = (t, m) => {
  const [h, mi] = t.split(":").map(Number);
  const x = h * 60 + mi + m;
  return `${pad(Math.floor(x / 60) % 24)}:${pad(x % 60)}`;
};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dateLong = (s, lang = "en") =>
  new Date(`${s}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
const firstName = (st) => st.first_name || (st.full_name || "").split(" ")[0] || "Child";
const ROUND = "Term 1 conferences";
const byDay = (slots) => {
  const out = {};
  slots.forEach((s) => { (out[s.slot_date] = out[s.slot_date] || []).push(s); });
  return Object.entries(out).sort(([a], [b]) => a.localeCompare(b));
};

export function meetingGrades(profile) {
  if (!profile) return [];
  if (profile.role === "admin") return GRADES;
  if (!["teacher", "learning_assistant"].includes(profile.role)) return [];
  const mine = [...listOf(profile.grades_assigned), ...listOf(profile.assigned_grades), ...listOf(profile.assistant_grades)];
  return GRADES.filter((g) => mine.includes(g));
}

// ======================================================================================
// STAFF
// ======================================================================================

export default function MeetingsTab({ profile }) {
  const isAdmin = profile?.role === "admin";
  const [round, setRound] = useState(null);
  const [slots, setSlots] = useState([]);
  const [students, setStudents] = useState([]);
  const [group, setGroup] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [r, sl] = await Promise.all([
      supabase.from("pt_rounds").select("*").eq("round", ROUND).maybeSingle(),
      supabase.from("pt_slots").select("*").eq("round", ROUND).order("slot_date").order("start_time")
    ]);
    const list = sl.data || [];
    const grades = [...new Set(list.flatMap((s) => s.grades))];
    const st = grades.length
      ? await supabase.from("students").select("id, legacy_id, full_name, first_name, grade").in("grade", grades).order("first_name")
      : { data: [] };
    setRound(r.data || null);
    setSlots(list);
    setStudents(st.data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const m = new Map();
    slots.forEach((s) => { if (!m.has(s.teacher_name)) m.set(s.teacher_name, s.grades); });
    return [...m.entries()].map(([teacher, grades]) => ({ teacher, grades }));
  }, [slots]);
  const current = groups.find((g) => g.teacher === group) || groups[0];

  const setOpen = async (open) => {
    const q = open
      ? "Open booking? Every family of these classes gets a notice to choose their time (first come, first served)."
      : "Close booking? Families will no longer be able to book, change or cancel.";
    if (!window.confirm(q)) return;
    setBusy(true); setMsg("");
    const { data: n, error } = await supabase.rpc("pt_set_open", { p_round: ROUND, p_open: open });
    setBusy(false);
    setMsg(error ? "Could not change booking. Please try again." : open ? `Booking is open. ${n} notice${n === 1 ? "" : "s"} sent to families.` : "Booking is closed.");
    load();
  };

  const remind = async () => {
    if (!window.confirm("Send a reminder to every family who hasn't booked yet?")) return;
    setBusy(true); setMsg("");
    const { data: n, error } = await supabase.rpc("pt_remind_unbooked", { p_round: ROUND });
    setBusy(false);
    setMsg(error ? "Could not send the reminder." : n ? `Reminder sent to ${n} parent${n === 1 ? "" : "s"}.` : "Every family has booked.");
  };

  const bookFor = async (slot, legacyId) => {
    if (!legacyId) return;
    const { error } = await supabase.rpc("pt_book", { p_slot: slot.id, p_hub_student_id: legacyId });
    setMsg(error ? (/SLOT_TAKEN/.test(error.message) ? "Could not book: this time was just taken." : "Could not book this time.") : "Booked.");
    load();
  };

  const cancel = async (st) => {
    if (!window.confirm(`Remove ${firstName(st)}'s booking? The time becomes free for other families.`)) return;
    const { error } = await supabase.rpc("pt_cancel", { p_hub_student_id: st.legacy_id, p_round: ROUND });
    setMsg(error ? "Could not remove the booking." : "Booking removed.");
    load();
  };

  if (loading) return <p style={{ ...card, color: COLORS.muted }}>Loading…</p>;

  const isOpen = !!round?.is_open;
  const bookedIds = new Set(slots.filter((s) => s.booked_student_id).map((s) => s.booked_student_id));
  const allBooked = students.filter((s) => bookedIds.has(s.id)).length;
  const stById = Object.fromEntries(students.map((s) => [s.id, s]));
  const gSlots = current ? slots.filter((s) => s.teacher_name === current.teacher) : [];
  const gKids = current ? students.filter((s) => current.grades.includes(s.grade)) : [];
  const gUnbooked = gKids.filter((s) => !bookedIds.has(s.id));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={card}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.brand }}>Parent–teacher conferences</p>
        <h1 style={{ margin: "4px 0 6px", fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600 }}>{ROUND}</h1>
        <p style={{ ...small, margin: "0 0 10px" }}>
          Parents choose their own time on the Hub — first come, first served. Each conference is 20 minutes with a 5-minute break after it.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={pill(isOpen ? "ok" : "neutral")}>{isOpen ? "Booking open" : "Booking closed"}</span>
          <span style={small}>{allBooked} of {students.length} children booked</span>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {isOpen
              ? <button style={ghostBtn} disabled={busy} onClick={() => setOpen(false)}>Close booking</button>
              : <button style={primaryBtn} disabled={busy} onClick={() => setOpen(true)}>Open booking for families</button>}
            {isOpen && <button style={ghostBtn} disabled={busy} onClick={remind}>Remind families who haven't booked</button>}
          </div>
        )}
        {msg && <p style={{ ...pill(/Could not/.test(msg) ? "bad" : "ok"), display: "block", whiteSpace: "normal", fontSize: 13, padding: "8px 12px", marginTop: 10 }}>{msg}</p>}
      </div>

      {groups.length > 1 && (
        <div style={{ ...card, display: "flex", gap: 7, flexWrap: "wrap" }}>
          {groups.map((g) => (
            <button key={g.teacher} style={g.teacher === current?.teacher ? chipOn : chip} onClick={() => setGroup(g.teacher)}>
              {g.teacher} · {g.grades.join(", ")}
            </button>
          ))}
        </div>
      )}

      {current && (
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>{current.teacher} · {current.grades.join(", ")}</h2>
            <span style={small}>{gKids.length - gUnbooked.length} of {gKids.length} booked</span>
          </div>
          {byDay(gSlots).map(([day, list]) => (
            <div key={day} style={{ marginTop: 14 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 14, textTransform: "capitalize" }}>{dateLong(day)}</h3>
              {list.map((s) => {
                const st = s.booked_student_id ? stById[s.booked_student_id] : null;
                return (
                  <div key={s.id} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "8px 0", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <strong style={{ width: 110 }}>{hm(s.start_time)} – {addMin(hm(s.start_time), s.length_min)}</strong>
                    {st ? (
                      <>
                        <span style={{ flex: "1 1 160px" }}>{st.full_name || firstName(st)} <span style={small}>· {st.grade}</span></span>
                        {isAdmin && <button style={{ ...ghostBtn, minHeight: 32, padding: "4px 10px" }} onClick={() => cancel(st)}>Remove</button>}
                      </>
                    ) : (
                      <>
                        <span style={{ ...pill("neutral"), flex: "0 0 auto" }}>Free</span>
                        {isAdmin && gUnbooked.length > 0 && (
                          <select defaultValue="" onChange={(e) => bookFor(s, e.target.value)} style={{ ...input, width: "auto", minHeight: 32, marginLeft: "auto" }} aria-label={`Book ${hm(s.start_time)} for a family`}>
                            <option value="">Book for a family…</option>
                            {gUnbooked.map((k) => <option key={k.id} value={k.legacy_id}>{k.full_name || firstName(k)}</option>)}
                          </select>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 14 }}>Not booked yet ({gUnbooked.length})</h3>
            {gUnbooked.length
              ? <p style={{ ...small, margin: 0 }}>{gUnbooked.map((k) => `${k.full_name || firstName(k)} (${k.grade})`).join(" · ")}</p>
              : <p style={{ ...small, margin: 0 }}>Every family in this class has booked.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

// ======================================================================================
// FAMILY
// ======================================================================================

const F = {
  en: { title: "Parent–teacher conference", book: "Choose your conference time",
        intro: "Pick the time that works best for you. First come, first served: once a time is booked by another family, it is no longer available. Each conference lasts 20 minutes.",
        with: "With", atSchool: "At school", cal: "Add to calendar", change: "Change time", cancel: "Cancel booking",
        booked: "Your conference is booked. See you then!", none: "All times are booked. Please contact the school.",
        confirm: (d, t, who) => `Book ${d} at ${t} with ${who}?`, cancelQ: "Cancel this booking? The time will become free for other families.",
        taken: "Sorry, another family has just booked this time. Please choose another one.", error: "Something went wrong. Please try again.",
        back: "Keep my current time" },
  fr: { title: "Conférence parents–enseignant", book: "Choisissez l'horaire de votre conférence",
        intro: "Choisissez l'horaire qui vous convient le mieux. Premier arrivé, premier servi : dès qu'un horaire est réservé par une autre famille, il n'est plus disponible. Chaque conférence dure 20 minutes.",
        with: "Avec", atSchool: "À l'école", cal: "Ajouter au calendrier", change: "Changer d'horaire", cancel: "Annuler la réservation",
        booked: "Votre conférence est réservée. À bientôt !", none: "Tous les horaires sont réservés. Merci de contacter l'école.",
        confirm: (d, t, who) => `Réserver le ${d} à ${t} avec ${who} ?`, cancelQ: "Annuler cette réservation ? L'horaire sera libéré pour d'autres familles.",
        taken: "Désolé, une autre famille vient de réserver cet horaire. Merci d'en choisir un autre.", error: "Une erreur s'est produite. Merci de réessayer.",
        back: "Garder mon horaire actuel" }
};

function downloadIcs(m, childName) {
  const d = m.meet_date.replace(/-/g, "");
  const s = hm(m.start_time).replace(":", "");
  const e = addMin(hm(m.start_time), m.length_min).replace(":", "");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BrightSteps International School//Hub//EN", "BEGIN:VEVENT",
    `UID:pt-${m.id}@hub.bischoolci.org`,
    `DTSTART;TZID=Africa/Abidjan:${d}T${s}00`, `DTEND;TZID=Africa/Abidjan:${d}T${e}00`,
    `SUMMARY:Parent–teacher conference · ${childName}`,
    `LOCATION:${(m.place || "BrightSteps International School").replace(/[,;]/g, " ")}`,
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url; a.download = "brightsteps-conference.ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function MeetingFamily({ student, language = "en" }) {
  const lang = language === "fr" ? "fr" : "en";
  const L = F[lang];
  const [open, setOpen] = useState(false);
  const [meeting, setMeeting] = useState(null);
  const [free, setFree] = useState([]);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!student?.id) return;
    const [r, m, f] = await Promise.all([
      supabase.from("pt_rounds").select("is_open").eq("round", ROUND).maybeSingle(),
      supabase.from("pt_meetings").select("*").eq("hub_student_id", student.id).eq("round", ROUND)
        .eq("status", "published").gte("meet_date", today()).maybeSingle(),
      supabase.rpc("pt_free_slots", { p_hub_student_id: student.id })
    ]);
    setOpen(!!r.data?.is_open);
    setMeeting(m.data || null);
    setFree(f.data || []);
  }, [student?.id]);
  useEffect(() => { load(); }, [load]);

  const book = async (s) => {
    if (!window.confirm(L.confirm(dateLong(s.slot_date, lang), hm(s.start_time), s.teacher_name))) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("pt_book", { p_slot: s.id, p_hub_student_id: student.id });
    setBusy(false);
    if (error) setMsg(/SLOT_TAKEN/.test(error.message) ? L.taken : L.error);
    else setPicking(false);
    load();
  };

  const cancel = async () => {
    if (!window.confirm(L.cancelQ)) return;
    setBusy(true);
    const { error } = await supabase.rpc("pt_cancel", { p_hub_student_id: student.id, p_round: ROUND });
    setBusy(false);
    if (error) setMsg(L.error);
    load();
  };

  if (!meeting && !open) return null;
  const childName = student.firstName || (student.name || "").split(" ")[0];
  const showPicker = open && (!meeting || picking);

  return (
    <section className="bsf-card">
      <h2 style={{ marginTop: 0 }}>{showPicker && !meeting ? L.book : L.title}</h2>

      {meeting && (
        <div style={{ display: "flex", gap: 14, alignItems: "center", background: COLORS.tint, borderRadius: 14, padding: 14 }}>
          <div style={{ width: 62, minWidth: 62, height: 66, borderRadius: 12, background: "#fff", border: `1px solid ${COLORS.line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.brand, textTransform: "uppercase" }}>
              {new Date(`${meeting.meet_date}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { month: "short" })}
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{Number(meeting.meet_date.slice(8))}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: COLORS.muted, textTransform: "capitalize" }}>{dateLong(meeting.meet_date, lang)}</div>
            <div style={{ fontSize: 21, fontWeight: 700 }}>{hm(meeting.start_time)} – {addMin(hm(meeting.start_time), meeting.length_min)}</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              {meeting.teacher_name ? `${L.with} ${meeting.teacher_name} · ` : ""}{meeting.place || L.atSchool}
            </div>
          </div>
        </div>
      )}

      {meeting && !picking && (
        <>
          <p style={{ ...pill("ok"), display: "block", whiteSpace: "normal", padding: "8px 12px", fontSize: 13, marginTop: 12 }}>{L.booked}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button style={ghostBtn} onClick={() => downloadIcs(meeting, childName)}><CalendarPlus size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />{L.cal}</button>
            {open && <button style={ghostBtn} disabled={busy} onClick={() => { setMsg(""); setPicking(true); }}>{L.change}</button>}
            {open && <button style={ghostBtn} disabled={busy} onClick={cancel}>{L.cancel}</button>}
          </div>
        </>
      )}

      {showPicker && (
        <div style={{ marginTop: meeting ? 14 : 0 }}>
          <p style={{ ...small, margin: "0 0 12px" }}>{L.intro}</p>
          {msg && <p style={{ ...pill("bad"), display: "block", whiteSpace: "normal", padding: "8px 12px", fontSize: 13, margin: "0 0 12px" }}>{msg}</p>}
          {!free.length && <p style={{ ...small }}>{L.none}</p>}
          {byDay(free).map(([day, list]) => (
            <div key={day} style={{ marginBottom: 14 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, textTransform: "capitalize" }}>
                {dateLong(day, lang)} <span style={{ ...small, fontWeight: 400, textTransform: "none" }}>· {L.with} {list[0].teacher_name}</span>
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>
                {list.map((s) => (
                  <button key={s.id} disabled={busy} onClick={() => book(s)} style={{ ...ghostBtn, minHeight: 44, fontWeight: 600 }}>{hm(s.start_time)}</button>
                ))}
              </div>
            </div>
          ))}
          {meeting && <button style={{ ...ghostBtn, marginTop: 4 }} onClick={() => { setMsg(""); setPicking(false); }}>{L.back}</button>}
        </div>
      )}
    </section>
  );
}

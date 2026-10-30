// Parent–teacher conferences.
// The school sets each child's conference time (parent booking is off for now). The admin or the
// class teacher fills in times for a class, then publishes; families get a bell + phone notice,
// see the time on My child, confirm "I'll be there" or say they can't make it, and can add it
// to their phone calendar. Changing a time and publishing again notifies that family again.
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
  const grades = meetingGrades(profile);
  const [grade, setGrade] = useState(grades[0] || null);
  const [round, setRound] = useState(ROUND);
  if (!grades.length) return <p style={{ ...card, color: COLORS.muted }}>No class is assigned to you yet.</p>;
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ ...card }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: COLORS.brand }}>Parent–teacher conferences</p>
        <h1 style={{ margin: "4px 0 10px", fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600 }}>{grade} · {round}</h1>
        <label style={{ ...small, display: "block", marginBottom: 6 }}>Conference round</label>
        <input value={round} onChange={(e) => setRound(e.target.value)} style={{ ...input, maxWidth: 320 }} />
        <p style={{ ...small, marginTop: 6 }}>Times are set by the school. Online booking by parents is turned off for now.</p>
      </div>
      <div style={{ ...card, display: "flex", gap: 7, flexWrap: "wrap" }}>
        {grades.map((g) => <button key={g} style={g === grade ? chipOn : chip} onClick={() => setGrade(g)}>{g}</button>)}
      </div>
      <ClassMeetings key={`${grade}-${round}`} grade={grade} round={round.trim() || ROUND} profile={profile} />
    </div>
  );
}

function ClassMeetings({ grade, round, profile }) {
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState({});
  const [drafts, setDrafts] = useState({});
  const [teacher, setTeacher] = useState("");
  const [fill, setFill] = useState({ date: today(), start: "15:40", length: 20, gap: 0, place: "", mode: "in_person" });
  const [canEdit, setCanEdit] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [st, mt, gs, ce] = await Promise.all([
      supabase.from("students").select("id, full_name, first_name").eq("grade", grade).order("first_name"),
      supabase.from("pt_meetings").select("*").eq("grade", grade).eq("round", round),
      supabase.from("grade_staff").select("homeroom_teacher").eq("grade", grade).maybeSingle(),
      supabase.rpc("weekly_can_send", { p_grade: grade })
    ]);
    const byStudent = Object.fromEntries((mt.data || []).map((m) => [m.student_id, m]));
    setStudents(st.data || []);
    setRows(byStudent);
    setDrafts(Object.fromEntries((st.data || []).map((s) => {
      const m = byStudent[s.id];
      return [s.id, { date: m?.meet_date || "", time: hm(m?.start_time) || "" }];
    })));
    const t = (mt.data || []).find((m) => m.teacher_name)?.teacher_name || gs.data?.homeroom_teacher || "";
    setTeacher(t);
    const first = (mt.data || [])[0];
    if (first) setFill((f) => ({ ...f, length: first.length_min, place: first.place || "", mode: first.mode }));
    setCanEdit(!!ce.data);
    setLoading(false);
  }, [grade, round]);

  useEffect(() => { load(); }, [load]);

  const autoFill = () => {
    let t = fill.start;
    const next = { ...drafts };
    students.forEach((s) => {
      next[s.id] = { date: fill.date, time: t };
      t = addMin(t, Number(fill.length) + Number(fill.gap || 0));
    });
    setDrafts(next);
    setMsg("Times filled in. Check them, then save.");
  };

  const save = async () => {
    setBusy(true); setMsg("");
    const toSave = students.filter((s) => drafts[s.id]?.date && drafts[s.id]?.time);
    const upserts = toSave.map((s) => ({
      round, student_id: s.id, teacher_name: teacher.trim() || null, meet_date: drafts[s.id].date,
      start_time: drafts[s.id].time, length_min: Number(fill.length) || 20, place: fill.place.trim() || null, mode: fill.mode
    }));
    const { error } = upserts.length ? await supabase.from("pt_meetings").upsert(upserts, { onConflict: "student_id,round" }) : { error: null };
    setBusy(false);
    setMsg(error ? "Could not save. Only the admin or the class teacher can set conference times." : `Saved ${upserts.length} conference time${upserts.length === 1 ? "" : "s"}.`);
    load();
  };

  const publish = async () => {
    if (!window.confirm("Save and send these conference times to the families?")) return;
    await save();
    setBusy(true);
    const { data: n, error } = await supabase.rpc("pt_publish", { p_grade: grade, p_round: round });
    setBusy(false);
    setMsg(error ? "Could not send. Please try again." : n ? `Sent to ${n} ${n === 1 ? "family" : "families"}.` : "Nothing new to send.");
    load();
  };

  const remove = async (s) => {
    const m = rows[s.id];
    if (!m || !window.confirm(`Remove ${firstName(s)}'s conference? The family will no longer see it.`)) return;
    await supabase.from("pt_meetings").delete().eq("id", m.id);
    load();
  };

  const counts = useMemo(() => {
    const list = Object.values(rows);
    return {
      published: list.filter((m) => m.status === "published").length,
      attending: list.filter((m) => m.reply === "attending").length,
      cannot: list.filter((m) => m.reply === "cannot").length
    };
  }, [rows]);

  if (loading) return <p style={{ ...card, color: COLORS.muted }}>Loading…</p>;
  if (!students.length) return <p style={{ ...card, color: COLORS.muted }}>No children are listed in {grade} yet.</p>;

  const lbl = { ...small, display: "block", margin: "0 0 4px" };
  return (
    <>
      {canEdit && (
        <section style={card}>
          <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Fill in times quickly</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <div><label style={lbl}>Day</label><input type="date" value={fill.date} onChange={(e) => setFill({ ...fill, date: e.target.value })} style={input} /></div>
            <div><label style={lbl}>First conference</label><input type="time" value={fill.start} onChange={(e) => setFill({ ...fill, start: e.target.value })} style={input} /></div>
            <div><label style={lbl}>Minutes each</label><input type="number" min="5" max="120" value={fill.length} onChange={(e) => setFill({ ...fill, length: e.target.value })} style={input} /></div>
            <div><label style={lbl}>Break between (min)</label><input type="number" min="0" max="60" value={fill.gap} onChange={(e) => setFill({ ...fill, gap: e.target.value })} style={input} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 10 }}>
            <div><label style={lbl}>Teacher shown to families</label><input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="e.g. Miss Agnes" style={input} /></div>
            <div><label style={lbl}>Where</label><input value={fill.place} onChange={(e) => setFill({ ...fill, place: e.target.value })} placeholder="e.g. Grade 2 classroom" style={input} /></div>
            <div><label style={lbl}>How</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={fill.mode === "in_person" ? chipOn : chip} onClick={() => setFill({ ...fill, mode: "in_person" })}>At school</button>
                <button style={fill.mode === "video" ? chipOn : chip} onClick={() => setFill({ ...fill, mode: "video" })}>Video call</button>
              </div>
            </div>
          </div>
          <button style={{ ...ghostBtn, marginTop: 12 }} onClick={autoFill}>Fill times for the whole class</button>
        </section>
      )}

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Conferences</h2>
          <span style={small}>{counts.published} sent · {counts.attending} coming · {counts.cannot} can't make it</span>
        </div>
        {students.map((s) => {
          const m = rows[s.id];
          const d = drafts[s.id] || { date: "", time: "" };
          return (
            <div key={s.id} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "10px 0", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <strong style={{ minWidth: 120, flex: "1 1 120px" }}>{s.full_name || firstName(s)}</strong>
              <input type="date" disabled={!canEdit} value={d.date} onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...d, date: e.target.value } })} style={{ ...input, width: 160 }} aria-label={`Date for ${firstName(s)}`} />
              <input type="time" disabled={!canEdit} value={d.time} onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...d, time: e.target.value } })} style={{ ...input, width: 120 }} aria-label={`Time for ${firstName(s)}`} />
              <span style={{ flex: "1 1 160px", display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {!m ? <span style={pill("neutral")}>Not set</span>
                  : m.status === "draft" ? <span style={pill("warn")}>Not sent yet</span>
                  : m.reply === "attending" ? <span style={pill("ok")}>Coming</span>
                  : m.reply === "cannot" ? <span style={pill("bad")}>Can't make it</span>
                  : <span style={pill("info")}>Sent · no answer</span>}
                {m && canEdit && <button style={{ ...ghostBtn, minHeight: 32, padding: "4px 10px" }} onClick={() => remove(s)}>Remove</button>}
              </span>
              {m?.reply_note && <p style={{ ...small, flexBasis: "100%", margin: 0 }}>Family note: {m.reply_note}</p>}
            </div>
          );
        })}
        {msg && <p style={{ ...pill(/Could not/.test(msg) ? "bad" : "ok"), display: "block", whiteSpace: "normal", fontSize: 13, padding: "8px 12px", marginTop: 10 }}>{msg}</p>}
        {canEdit ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button style={ghostBtn} disabled={busy} onClick={save}>Save without sending</button>
            <button style={primaryBtn} disabled={busy} onClick={publish}>{busy ? "Working…" : "Send times to families"}</button>
          </div>
        ) : <p style={{ ...small, marginTop: 10 }}>Only the admin or the class teacher can set and send conference times.</p>}
      </section>
    </>
  );
}

// ======================================================================================
// FAMILY
// ======================================================================================

const F = {
  en: { title: "Parent–teacher conference", with: "With", where: "Where", video: "Video call", atSchool: "At school",
        coming: "I'll be there", cannot: "Can't make this time", cal: "Add to calendar", thanks: "Thank you, the school knows you are coming.",
        sorry: "The school knows this time doesn't work. They will suggest another time.", note: "Add a note for the school (optional)",
        send: "Send", change: "Change my answer", min: "min" },
  fr: { title: "Conférence parents–enseignant", with: "Avec", where: "Lieu", video: "Appel vidéo", atSchool: "À l'école",
        coming: "Je serai là", cannot: "Cet horaire ne me convient pas", cal: "Ajouter au calendrier", thanks: "Merci, l'école sait que vous venez.",
        sorry: "L'école sait que cet horaire ne vous convient pas. Elle vous proposera un autre horaire.", note: "Ajouter un mot pour l'école (facultatif)",
        send: "Envoyer", change: "Modifier ma réponse", min: "min" }
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
  const [list, setList] = useState([]);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!student?.id) return;
    const { data } = await supabase.from("pt_meetings").select("*").eq("hub_student_id", student.id)
      .eq("status", "published").gte("meet_date", today()).order("meet_date");
    setList(data || []);
  }, [student?.id]);
  useEffect(() => { load(); }, [load]);

  const reply = async (m, r, n) => {
    const { error } = await supabase.rpc("pt_reply", { p_id: m.id, p_reply: r, p_note: n || null });
    if (!error) { setNoteFor(null); setNote(""); setEditing(null); load(); }
  };

  if (!list.length) return null;
  const childName = student.firstName || (student.name || "").split(" ")[0];

  return list.map((m) => {
    const answered = m.reply && editing !== m.id;
    return (
      <section key={m.id} className="bsf-card">
        <h2 style={{ marginTop: 0 }}>{L.title}</h2>
        <div style={{ display: "flex", gap: 14, alignItems: "center", background: COLORS.tint, borderRadius: 14, padding: 14 }}>
          <div style={{ width: 62, minWidth: 62, height: 66, borderRadius: 12, background: "#fff", border: `1px solid ${COLORS.line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.brand, textTransform: "uppercase" }}>
              {new Date(`${m.meet_date}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { month: "short" })}
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{Number(m.meet_date.slice(8))}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: COLORS.muted, textTransform: "capitalize" }}>{dateLong(m.meet_date, lang)}</div>
            <div style={{ fontSize: 21, fontWeight: 700 }}>{hm(m.start_time)} – {addMin(hm(m.start_time), m.length_min)}</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              {m.teacher_name ? `${L.with} ${m.teacher_name} · ` : ""}{m.mode === "video" ? L.video : (m.place || L.atSchool)}
            </div>
          </div>
        </div>

        {answered ? (
          <>
            <p style={{ ...pill(m.reply === "attending" ? "ok" : "warn"), display: "block", whiteSpace: "normal", padding: "8px 12px", fontSize: 13, marginTop: 12 }}>
              {m.reply === "attending" ? L.thanks : L.sorry}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button style={ghostBtn} onClick={() => downloadIcs(m, childName)}><CalendarPlus size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />{L.cal}</button>
              <button style={ghostBtn} onClick={() => setEditing(m.id)}>{L.change}</button>
            </div>
          </>
        ) : noteFor === m.id ? (
          <div style={{ marginTop: 12 }}>
            <label style={{ ...small, display: "block", marginBottom: 6 }}>{L.note}</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, resize: "vertical" }} />
            <button style={{ ...primaryBtn, marginTop: 8 }} onClick={() => reply(m, "cannot", note)}>{L.send}</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginTop: 12 }}>
            <button style={{ ...primaryBtn, background: COLORS.ok, minHeight: 48 }} onClick={() => reply(m, "attending")}>{L.coming}</button>
            <button style={{ ...ghostBtn, minHeight: 48 }} onClick={() => setNoteFor(m.id)}>{L.cannot}</button>
            <button style={{ ...ghostBtn, minHeight: 48 }} onClick={() => downloadIcs(m, childName)}>{L.cal}</button>
          </div>
        )}
      </section>
    );
  });
}

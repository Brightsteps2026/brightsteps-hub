import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { useLanguage } from "./lib/i18n";

// Parents report that one or more of their children will be absent.
// The database (report_absence) marks the days as "excused" on attendance
// and sends a bell notice to the homeroom teacher and the admins.

const REASONS = [
  { id: "sick", en: "Sick", fr: "Malade" },
  { id: "family", en: "Family", fr: "Famille" },
  { id: "appointment", en: "Appointment", fr: "Rendez-vous" },
  { id: "other", en: "Other", fr: "Autre" }
];
const REASON_EN = Object.fromEntries(REASONS.map((r) => [r.id, r.en]));

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function fmt(s, fr) {
  return new Date(s + "T12:00:00").toLocaleDateString(fr ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const box = { border: "1px solid #E6DDC8", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, background: "#fff" };
const boxOn = { ...box, borderColor: "#801524", background: "#F5E4E6" };
const fieldLabel = { display: "block", fontSize: 13, color: "#6E7B7D", margin: "14px 0 6px" };
const input = { width: "100%", padding: "9px 10px", border: "1px solid #E6DDC8", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", background: "#FCFAF4" };

export function ReportAbsenceCard({ students }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  const today = todayLocal();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState("");
  const [upcoming, setUpcoming] = useState([]);

  const loadUpcoming = async () => {
    const { data, error: err } = await supabase
      .from("absence_reports")
      .select("id, student_name, start_date, end_date, reason")
      .gte("end_date", todayLocal())
      .order("start_date");
    if (!err) setUpcoming(data || []);
  };
  useEffect(() => { loadUpcoming(); }, []);

  if (!students || students.length === 0) return null;

  const startForm = () => {
    setPicked(students.length === 1 ? [students[0].id] : []);
    setStart(today); setEnd(today); setReason(""); setNote(""); setError(""); setDone("");
    setOpen(true);
  };

  const toggle = (id) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const send = async () => {
    if (picked.length === 0) return setError(fr ? "Choisissez au moins un enfant." : "Choose at least one child.");
    if (!start || !end || end < start) return setError(fr ? "Vérifiez les dates." : "Check the dates.");
    if (start < today) return setError(fr ? "Le premier jour ne peut pas être passé." : "The first day can't be in the past.");
    if (!reason) return setError(fr ? "Choisissez un motif." : "Choose a reason.");
    setError("");
    setSending(true);
    const { error: err } = await supabase.rpc("report_absence", {
      p_student_ids: picked, p_start: start, p_end: end, p_reason: reason, p_note: note.trim() || null
    });
    setSending(false);
    if (err) return setError((fr ? "Envoi impossible : " : "Couldn't send: ") + err.message);
    const names = students.filter((s) => picked.includes(s.id)).map((s) => s.firstName || s.name).join(", ");
    setDone(fr ? `Merci. L'école est informée de l'absence de ${names}.` : `Thank you. The school knows ${names} will be absent.`);
    setOpen(false);
    loadUpcoming();
  };

  return (
    <div className="bsf-card" style={{ marginBottom: 14 }}>
      {!open && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ fontSize: 15 }}>{fr ? "Votre enfant sera absent ?" : "Will your child be absent?"}</strong>
            <button className="bsf-btn" onClick={startForm}>{fr ? "Signaler une absence" : "Report an absence"}</button>
          </div>
          {done && <p style={{ margin: "10px 0 0", fontSize: 13, color: "#2F7A5C" }}>{done}</p>}
          {upcoming.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid #EEE6D2", paddingTop: 10 }}>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#6E7B7D" }}>{fr ? "Absences signalées" : "Reported absences"}</p>
              {upcoming.map((r) => (
                <p key={r.id} style={{ margin: "4px 0", fontSize: 13 }}>
                  <strong>{r.student_name}</strong> · {r.start_date === r.end_date ? fmt(r.start_date, fr) : `${fmt(r.start_date, fr)} – ${fmt(r.end_date, fr)}`}
                  {" · "}{(REASONS.find((x) => x.id === r.reason) || {})[fr ? "fr" : "en"]}
                </p>
              ))}
            </div>
          )}
        </>
      )}

      {open && (
        <>
          <strong style={{ fontSize: 16 }}>{fr ? "Signaler une absence" : "Report an absence"}</strong>

          <span style={fieldLabel}>{fr ? "Quels enfants ?" : "Which children?"}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {students.map((s) => (
              <label key={s.id} style={picked.includes(s.id) ? boxOn : box}>
                <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                <span>{s.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#6E7B7D" }}>{s.grade}</span>
              </label>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={fieldLabel}>{fr ? "Du" : "From"}</span>
              <input type="date" style={input} min={today} value={start}
                onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} />
            </div>
            <div>
              <span style={fieldLabel}>{fr ? "Au" : "To"}</span>
              <input type="date" style={input} min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <span style={fieldLabel}>{fr ? "Motif" : "Reason"}</span>
          <div className="bsf-chiprow">
            {REASONS.map((r) => (
              <button key={r.id} type="button" className={`bsf-chip ${reason === r.id ? "active" : ""}`} onClick={() => setReason(r.id)}>
                {fr ? r.fr : r.en}
              </button>
            ))}
          </div>

          <span style={fieldLabel}>{fr ? "Note pour l'école (facultatif)" : "Note for the school (optional)"}</span>
          <textarea rows={2} maxLength={500} style={input} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={fr ? "Fièvre depuis hier soir, de retour lundi" : "Fever since last night, back on Monday"} />

          {error && <p style={{ margin: "10px 0 0", fontSize: 13, color: "#B23A3A" }}>{error}</p>}

          <button className="bsf-btn bsf-btn-block" onClick={send} disabled={sending} style={{ marginTop: 14 }}>
            {sending ? (fr ? "Envoi…" : "Sending…") : (fr ? "Envoyer à l'école" : "Send to school")}
          </button>
          <button className="bsf-textbtn" onClick={() => setOpen(false)} style={{ marginTop: 8 }}>{fr ? "Annuler" : "Cancel"}</button>
        </>
      )}
    </div>
  );
}

// Staff attendance screen: reasons parents gave for the chosen day, by student id.
export function useReportedAbsences(date) {
  const [byStudent, setByStudent] = useState({});
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("absence_reports")
      .select("student_id, reason")
      .lte("start_date", date)
      .gte("end_date", date)
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const map = {};
        (data || []).forEach((r) => { map[r.student_id] = REASON_EN[r.reason] || ""; });
        setByStudent(map);
      });
    return () => { cancelled = true; };
  }, [date]);
  return byStudent;
}

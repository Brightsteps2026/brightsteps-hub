import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getAttachmentUrl } from "../lib/attachments";
import { uid, todayStr } from "../lib/format";
import { COLORS, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, label, pill } from "../ui/tokens";

// Admissions (rebuilt 20 Nov 2026): applications from the public page hub.bischoolci.org/apply,
// seats per class, re-enrolment, visits, numbers. Staff screen, English only.
// Data now lives in Supabase tables (admission_*), no longer in the app_storage blob.

const wrap = { padding: "16px 16px 90px", maxWidth: 960, margin: "0 auto" };
const card = { ...cardToken, marginBottom: 12 };
const small = { fontSize: 13, color: COLORS.muted, margin: 0 };
const row = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const th = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: COLORS.muted, borderBottom: `1px solid ${COLORS.line}`, whiteSpace: "nowrap" };
const td = { padding: "6px 8px", fontSize: 13, borderBottom: `1px solid ${COLORS.line}` };
const PUBLIC_URL = "https://hub.bischoolci.org/apply";
const GRADES = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7"];

export const STAGES = [
  { id: "enquiry", label: "Enquiry", tone: "neutral" },
  { id: "visit_booked", label: "Visit booked", tone: "info" },
  { id: "applied", label: "Applied", tone: "info" },
  { id: "assessment", label: "Assessment", tone: "info" },
  { id: "offered", label: "Offer sent", tone: "warn" },
  { id: "accepted", label: "Accepted", tone: "ok" },
  { id: "enrolled", label: "Enrolled", tone: "ok" },
  { id: "waitlist", label: "Waiting list", tone: "warn" },
  { id: "declined", label: "Declined", tone: "bad" },
  { id: "withdrawn", label: "Withdrawn", tone: "neutral" }
];
const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const DOC_LABEL = { birth: "Birth certificate", report: "Report card", photo: "Photo", vaccination: "Vaccination record" };
const fmtDate = (s) => (s ? new Date(String(s).length <= 10 ? s + "T12:00:00" : s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const fmtWhen = (s) => new Date(s).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const childName = (a) => [a.child_first_name, a.child_last_name].filter(Boolean).join(" ");
const email = (id) => supabase.functions.invoke("notify-admissions", { body: { id } }).catch(() => {});

function AdmissionsTab({ data, persist }) {
  const [section, setSection] = useState("applications");
  const [settings, setSettings] = useState(null);
  const loadSettings = () => supabase.from("admission_settings").select("*").single().then(({ data: s }) => setSettings(s));
  useEffect(() => { loadSettings(); }, []);
  if (!settings) return <div style={wrap}><p style={small}>Loading…</p></div>;
  const year = settings.school_year;
  return (
    <div style={wrap}>
      <div style={{ ...row, justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Admissions {year}</h2>
        <button style={ghostBtn} onClick={() => { navigator.clipboard?.writeText(PUBLIC_URL); alert("Link copied: " + PUBLIC_URL); }}>Copy the public application link</button>
      </div>
      <div style={{ ...row, marginBottom: 14 }}>
        {[["applications", "Applications"], ["seats", "Seats per class"], ["reenrol", "Re-enrolment"], ["visits", "Visits"], ["numbers", "Numbers"], ["settings", "Settings"]].map(([id, l]) => (
          <button key={id} style={section === id ? chipOn : chip} onClick={() => setSection(id)}>{l}</button>
        ))}
      </div>
      {section === "applications" && <Applications year={year} data={data} persist={persist} />}
      {section === "seats" && <Seats year={year} />}
      {section === "reenrol" && <Reenrol settings={settings} reload={loadSettings} />}
      {section === "visits" && <Visits />}
      {section === "numbers" && <Numbers year={year} />}
      {section === "settings" && <Settings settings={settings} reload={loadSettings} />}
    </div>
  );
}

// ---------- Applications ----------

function Applications({ year, data, persist }) {
  const [apps, setApps] = useState([]);
  const [filter, setFilter] = useState("active");
  const [grade, setGrade] = useState("");
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  async function load() {
    const { data: rows } = await supabase.from("admission_applications").select("*").eq("school_year", year).order("created_at", { ascending: false });
    setApps(rows || []);
  }
  useEffect(() => { load(); }, [year]);
  const counts = useMemo(() => apps.reduce((c, a) => ({ ...c, [a.stage]: (c[a.stage] || 0) + 1 }), {}), [apps]);
  const shown = apps
    .filter((a) => filter === "all" ? true : filter === "active" ? !["declined", "withdrawn", "enrolled"].includes(a.stage) : a.stage === filter)
    .filter((a) => !grade || a.grade === grade);
  const open = apps.find((a) => a.id === openId);
  if (open) return <ApplicationDetail a={open} onBack={() => { setOpenId(null); load(); }} reload={load} data={data} persist={persist} />;

  return (
    <>
      <div style={{ ...row, marginBottom: 10 }}>
        <button style={filter === "active" ? chipOn : chip} onClick={() => setFilter("active")}>In progress</button>
        {STAGES.filter((s) => counts[s.id]).map((s) => (
          <button key={s.id} style={filter === s.id ? chipOn : chip} onClick={() => setFilter(s.id)}>{s.label} ({counts[s.id]})</button>
        ))}
        <button style={filter === "all" ? chipOn : chip} onClick={() => setFilter("all")}>All ({apps.length})</button>
        <select style={{ ...input, width: 160, minHeight: 36 }} value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">All classes</option>{GRADES.map((g) => <option key={g}>{g}</option>)}
        </select>
        <button style={primaryBtn} onClick={() => setAdding(true)}>Add enquiry</button>
      </div>
      {adding && <OfficeEnquiry year={year} onDone={() => { setAdding(false); load(); }} />}
      {shown.length === 0 && <p style={{ ...card, ...small }}>No applications here yet. Share the public link so families can apply online.</p>}
      {shown.map((a) => (
        <button key={a.id} onClick={() => setOpenId(a.id)} style={{ ...card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "block" }}>
          <div style={{ ...row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{childName(a)}</span>
            <span style={pill(STAGE[a.stage].tone)}>{STAGE[a.stage].label}</span>
          </div>
          <p style={small}>{a.grade || "Class not given"} · {a.parent1_name} · {a.parent1_phone || a.parent1_email} · {a.source || "source not given"} · {fmtDate(a.created_at)}</p>
          {a.follow_up_date && <p style={{ ...small, color: a.follow_up_date <= todayStr() ? COLORS.bad : COLORS.muted }}>Follow up {fmtDate(a.follow_up_date)}</p>}
        </button>
      ))}
    </>
  );
}

function OfficeEnquiry({ year, onDone }) {
  const [f, setF] = useState({ grade: "", source: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() {
    if (!f.child_first_name || !f.parent1_name) return setErr("Enter the child's first name and the parent's name.");
    const { error } = await supabase.from("admission_applications").insert({ ...f, school_year: year, stage: "enquiry", created_via: "office", parent1_email: f.parent1_email || null });
    if (error) return setErr(error.message);
    onDone();
  }
  return (
    <div style={{ ...card, borderColor: COLORS.brand }}>
      <p style={{ margin: 0, fontWeight: 600 }}>New enquiry (phone, walk-in…)</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
        {[["child_first_name", "Child first name"], ["child_last_name", "Child last name"], ["parent1_name", "Parent name"], ["parent1_phone", "Phone"], ["parent1_email", "Email"]].map(([k, l]) => (
          <div key={k}><span style={label}>{l}</span><input style={input} value={f[k] || ""} onChange={set(k)} /></div>
        ))}
        <div><span style={label}>Class</span><select style={input} value={f.grade} onChange={set("grade")}><option value="">—</option>{GRADES.map((g) => <option key={g}>{g}</option>)}</select></div>
        <div><span style={label}>How they heard of us</span><input style={input} value={f.source} onChange={set("source")} placeholder="Walk-in" /></div>
      </div>
      {err && <p style={{ color: COLORS.bad, fontSize: 13 }}>{err}</p>}
      <div style={{ ...row, marginTop: 10 }}><button style={primaryBtn} onClick={save}>Save</button><button style={ghostBtn} onClick={onDone}>Cancel</button></div>
    </div>
  );
}

function ApplicationDetail({ a, onBack, reload, data, persist }) {
  const [events, setEvents] = useState([]);
  const [notes, setNotes] = useState(a.internal_notes || "");
  const [follow, setFollow] = useState(a.follow_up_date || "");
  const [expires, setExpires] = useState(a.offer_expires || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const loadEvents = () => supabase.from("admission_events").select("*").eq("application_id", a.id).order("id", { ascending: false }).then(({ data: e }) => setEvents(e || []));
  useEffect(() => { loadEvents(); }, [a.id]);

  async function move(stage, eventKind, extra = {}, sendEmail = false) {
    setBusy(true); setErr("");
    const { error } = await supabase.from("admission_applications").update({ stage, ...extra }).eq("id", a.id);
    if (!error) {
      const { data: me } = await supabase.auth.getUser();
      await supabase.from("admission_events").insert({ application_id: a.id, kind: eventKind, by_user: me?.user?.id });
      if (sendEmail) await email(a.id);
    }
    setBusy(false);
    if (error) return setErr(error.message);
    reload(); loadEvents();
  }
  async function saveNotes() {
    const { error } = await supabase.from("admission_applications").update({ internal_notes: notes || null, follow_up_date: follow || null }).eq("id", a.id);
    if (error) return setErr(error.message);
    reload();
  }
  function sendOffer() {
    if (!a.parent1_email) return setErr("Add the family's email before sending an offer.");
    if (!window.confirm(`Send an offer for ${childName(a)} (${a.grade}) to ${a.parent1_email}?`)) return;
    move("offered", "offer_sent", { offer_sent_at: new Date().toISOString(), offer_expires: expires || null }, true);
  }
  function addToRoster() {
    if (!window.confirm("Add this child to the current student list now? For next school year, do this in August, before the first day.")) return;
    const student = {
      id: uid(), firstName: a.child_first_name || "", lastName: a.child_last_name || "", name: childName(a), grade: a.grade || "",
      middleName: "", dob: a.child_dob || "", gender: a.child_gender || "", nationalities: a.child_nationality ? [a.child_nationality] : [], photo: null,
      allergies: "", medicalConditions: "", emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "", previousSchool: a.current_school || "",
      guardian1Name: a.parent1_name || "", guardian1Relationship: a.parent1_relationship || "", guardian1Email: a.parent1_email || "", guardian1Phone: a.parent1_phone || "",
      guardian2Name: a.parent2_name || "", guardian2Relationship: a.parent2_relationship || "", guardian2Email: a.parent2_email || "", guardian2Phone: a.parent2_phone || "",
      homeAddress: a.home_address || "", enrollmentDate: todayStr()
    };
    persist({ ...data, students: [...data.students, student] });
    supabase.from("admission_applications").update({ added_to_roster_at: new Date().toISOString() }).eq("id", a.id).then(reload);
  }
  async function openDoc(path) {
    try { window.open(await getAttachmentUrl(path), "_blank", "noopener"); } catch (e) { alert(e.message); }
  }

  const st = STAGE[a.stage];
  const info = [
    ["Class", a.grade], ["Date of birth", fmtDate(a.child_dob)], ["Gender", a.child_gender], ["Nationality", a.child_nationality],
    ["Current school", a.current_school], ["Languages at home", a.languages], ["Needs", a.learning_needs],
    ["Parent", [a.parent1_name, a.parent1_relationship].filter(Boolean).join(", ")], ["Email", a.parent1_email], ["Phone", a.parent1_phone],
    ["Second parent", [a.parent2_name, a.parent2_relationship, a.parent2_email, a.parent2_phone].filter(Boolean).join(" · ")],
    ["Address", a.home_address], ["Heard of us via", a.source], ["Referred by", a.referred_by], ["Message", a.parent_message],
    ["Reference", a.ref], ["Language", a.language === "fr" ? "French" : "English"]
  ].filter(([, v]) => v);

  return (
    <>
      <button style={{ ...ghostBtn, marginBottom: 12 }} onClick={onBack}>← All applications</button>
      <div style={card}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{childName(a)}</span>
          <span style={pill(st.tone)}>{st.label}</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <tbody>{info.map(([k, v]) => <tr key={k}><td style={{ ...td, color: COLORS.muted, width: 150 }}>{k}</td><td style={{ ...td, whiteSpace: "pre-wrap" }}>{v}</td></tr>)}</tbody>
        </table>
        {a.documents?.length > 0 && (
          <div style={{ ...row, marginTop: 10 }}>
            {a.documents.map((d) => <button key={d.path} style={ghostBtn} onClick={() => openDoc(d.path)}>{DOC_LABEL[d.kind] || d.name}</button>)}
          </div>
        )}
      </div>

      <div style={card}>
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Next step</p>
        <div style={row}>
          {["enquiry", "visit_booked"].includes(a.stage) && <button style={ghostBtn} disabled={busy} onClick={() => move("applied", "applied")}>Mark as applied</button>}
          {["applied", "visit_booked", "waitlist", "enquiry"].includes(a.stage) && <button style={ghostBtn} disabled={busy} onClick={() => move("assessment", "assessment")}>Assessment / interview</button>}
          {["applied", "assessment", "waitlist"].includes(a.stage) && (
            <span style={row}>
              <input type="date" style={{ ...input, width: 160, minHeight: 36 }} value={expires} onChange={(e) => setExpires(e.target.value)} title="Answer by" />
              <button style={primaryBtn} disabled={busy} onClick={sendOffer}>Send offer (email)</button>
            </span>
          )}
          {a.stage === "offered" && <button style={ghostBtn} onClick={() => { navigator.clipboard?.writeText(`${PUBLIC_URL}?offer=${a.offer_token}`); alert("Offer link copied"); }}>Copy offer link</button>}
          {a.stage === "accepted" && !a.fee_paid_at && <button style={primaryBtn} disabled={busy} onClick={() => move("enrolled", "enrolled", { fee_paid_at: new Date().toISOString() }, true)}>Registration fee paid: enrol</button>}
          {a.stage === "enrolled" && !a.added_to_roster_at && <button style={ghostBtn} onClick={addToRoster}>Add to student list</button>}
          {a.added_to_roster_at && <span style={pill("ok")}>On the student list since {fmtDate(a.added_to_roster_at)}</span>}
          {!["waitlist", "enrolled", "declined", "withdrawn"].includes(a.stage) && <button style={ghostBtn} disabled={busy} onClick={() => move("waitlist", "waitlist", {}, true)}>Waiting list (email)</button>}
          {!["enrolled", "declined", "withdrawn"].includes(a.stage) && (
            <button style={{ ...ghostBtn, color: COLORS.bad }} disabled={busy} onClick={() => window.confirm("Decline this application and email the family?") && move("declined", "declined", {}, true)}>Decline (email)</button>
          )}
          {!["enrolled", "declined", "withdrawn"].includes(a.stage) && <button style={ghostBtn} disabled={busy} onClick={() => move("withdrawn", "withdrawn")}>Family withdrew</button>}
        </div>
        {a.offer_signed_by && <p style={{ ...small, marginTop: 8 }}>Offer answered by {a.offer_signed_by} on {fmtDate(a.offer_response_at)}</p>}
        {err && <p style={{ color: COLORS.bad, fontSize: 13 }}>{err}</p>}
      </div>

      <div style={card}>
        <p style={{ margin: 0, fontWeight: 600 }}>Office notes</p>
        <textarea style={{ ...input, minHeight: 80, marginTop: 8 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Called on Tuesday, visit planned with both parents." />
        <div style={{ ...row, marginTop: 8 }}>
          <span style={small}>Follow up on</span>
          <input type="date" style={{ ...input, width: 170, minHeight: 36 }} value={follow} onChange={(e) => setFollow(e.target.value)} />
          <button style={ghostBtn} onClick={saveNotes}>Save notes</button>
        </div>
      </div>

      <div style={card}>
        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>History</p>
        {events.map((e) => <p key={e.id} style={small}>{fmtWhen(e.created_at)} · {e.kind.replace(/_/g, " ")}{e.emailed_at ? " · email sent" : ""}{e.note ? ` · ${e.note}` : ""}</p>)}
      </div>
    </>
  );
}

// ---------- Seats ----------

function Seats({ year }) {
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState({});
  const load = () => supabase.rpc("adm_seats", { p_year: year }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, [year]);
  async function save(grade) {
    const n = parseInt(edit[grade], 10);
    if (!(n >= 0)) return;
    const { error } = await supabase.from("admission_capacity").upsert({ school_year: year, grade, seats: n });
    if (error) return alert(error.message);
    setEdit({ ...edit, [grade]: undefined }); load();
  }
  return (
    <>
      <p style={{ ...small, marginBottom: 10 }}>Set the number of places in each class for {year}. Returning students are counted in the class they move up to. When free seats reach 0, new online applications go straight to the waiting list.</p>
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Class {year}</th><th style={th}>Seats</th><th style={th}>Returning (confirmed)</th><th style={th}>Not answered / unsure</th>
            <th style={th}>Leaving</th><th style={th}>New (accepted)</th><th style={th}>Offers out</th><th style={th}>Waiting list</th><th style={th}>Free seats</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.grade}>
                <td style={{ ...td, fontWeight: 600 }}>{r.grade}</td>
                <td style={td}>
                  {edit[r.grade] !== undefined ? (
                    <span style={row}><input type="number" min="0" style={{ ...input, width: 70, minHeight: 32 }} value={edit[r.grade]} onChange={(e) => setEdit({ ...edit, [r.grade]: e.target.value })} />
                      <button style={ghostBtn} onClick={() => save(r.grade)}>Save</button></span>
                  ) : (
                    <button style={{ ...ghostBtn, minHeight: 32 }} onClick={() => setEdit({ ...edit, [r.grade]: r.seats ?? "" })}>{r.seats ?? "Set"}</button>
                  )}
                </td>
                <td style={td}>{r.returning_confirmed}</td>
                <td style={td}>{r.returning_unanswered}</td>
                <td style={td}>{r.leaving}</td>
                <td style={td}>{r.new_accepted}</td>
                <td style={td}>{r.new_offered}</td>
                <td style={td}>{r.waitlist}</td>
                <td style={td}>{r.free_seats === null ? "—" : <span style={pill(r.free_seats <= 0 ? "bad" : r.free_seats <= 2 ? "warn" : "ok")}>{r.free_seats}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={small}>Free seats = seats − returning students (except those leaving) − accepted new students − offers waiting for an answer.</p>
    </>
  );
}

// ---------- Re-enrolment ----------

function Reenrol({ settings, reload }) {
  const [rows, setRows] = useState([]);
  const [deadline, setDeadline] = useState(settings.reenrol_deadline || "");
  useEffect(() => {
    (async () => {
      const [s, r] = await Promise.all([
        supabase.from("students").select("id, full_name, first_name, last_name, grade").is("withdrawn_on", null),
        supabase.from("reenrolment").select("*").eq("school_year", settings.school_year)
      ]);
      const by = Object.fromEntries((r.data || []).map((x) => [x.student_id, x]));
      setRows((s.data || []).map((st) => ({ ...st, r: by[st.id] })).sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade)));
    })();
  }, [settings.school_year]);
  async function openIt() {
    if (!window.confirm("Open re-enrolment? Every parent gets a notification asking them to answer on their Dashboard.")) return;
    const { data, error } = await supabase.rpc("reenrol_open", { p_deadline: deadline || null });
    if (error) return alert(error.message);
    alert(`Re-enrolment is open. ${data} parent accounts were notified.`);
    reload();
  }
  async function closeIt() {
    await supabase.from("admission_settings").update({ reenrol_open: false }).eq("id", 1);
    reload();
  }
  const answered = rows.filter((x) => x.r).length;
  const n = (i) => rows.filter((x) => x.r?.intent === i).length;
  return (
    <>
      <div style={{ ...card, ...row, justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>{settings.reenrol_open ? "Re-enrolment is open" : "Re-enrolment is closed"}</p>
          <p style={small}>{answered} of {rows.length} students answered · {n("returning")} returning · {n("unsure")} unsure · {n("leaving")} leaving</p>
        </div>
        <span style={row}>
          {!settings.reenrol_open && <><span style={small}>Answer by</span><input type="date" style={{ ...input, width: 160, minHeight: 36 }} value={deadline} onChange={(e) => setDeadline(e.target.value)} /><button style={primaryBtn} onClick={openIt}>Open and notify parents</button></>}
          {settings.reenrol_open && <button style={ghostBtn} onClick={closeIt}>Close re-enrolment</button>}
        </span>
      </div>
      <div style={{ ...card, padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Student</th><th style={th}>Now</th><th style={th}>Next year</th><th style={th}>Answer</th><th style={th}>Note</th></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.id}>
                <td style={{ ...td, fontWeight: 600 }}>{[x.first_name, x.last_name].filter(Boolean).join(" ") || x.full_name}</td>
                <td style={td}>{x.grade}</td>
                <td style={td}>{x.r?.next_grade || ""}</td>
                <td style={td}>{x.r ? <span style={pill(x.r.intent === "returning" ? "ok" : x.r.intent === "leaving" ? "bad" : "warn")}>{{ returning: "Returning", leaving: "Leaving", unsure: "Unsure" }[x.r.intent]}</span> : <span style={pill("neutral")}>No answer</span>}</td>
                <td style={td}>{x.r?.note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Visits ----------

function Visits() {
  const [slots, setSlots] = useState([]);
  const [booked, setBooked] = useState({});
  const [f, setF] = useState({ date: "", time: "09:00", capacity: 3, kind: "visit" });
  async function load() {
    const { data } = await supabase.from("visit_slots").select("*").gte("starts_at", new Date(Date.now() - 864e5).toISOString()).order("starts_at");
    setSlots(data || []);
    const { data: apps } = await supabase.from("admission_applications").select("id, child_first_name, child_last_name, parent1_name, parent1_phone, visit_slot_id, stage").not("visit_slot_id", "is", null);
    const by = {};
    (apps || []).filter((a) => !["withdrawn", "declined"].includes(a.stage)).forEach((a) => { (by[a.visit_slot_id] = by[a.visit_slot_id] || []).push(a); });
    setBooked(by);
  }
  useEffect(() => { load(); }, []);
  async function add() {
    if (!f.date) return;
    const starts = new Date(`${f.date}T${f.time}:00Z`).toISOString(); // Côte d'Ivoire is UTC+0
    const { error } = await supabase.from("visit_slots").insert({ starts_at: starts, capacity: Number(f.capacity) || 1, kind: f.kind });
    if (error) return alert(error.message);
    load();
  }
  async function remove(s) {
    if ((booked[s.id] || []).length && !window.confirm("Families have booked this time. Delete it anyway? Tell them yourself.")) return;
    await supabase.from("visit_slots").delete().eq("id", s.id);
    load();
  }
  return (
    <>
      <div style={{ ...card, ...row }}>
        <input type="date" style={{ ...input, width: 160 }} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <input type="time" style={{ ...input, width: 110 }} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        <span style={small}>Families</span>
        <input type="number" min="1" style={{ ...input, width: 70 }} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
        <select style={{ ...input, width: 130 }} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="visit">Visit</option><option value="open_day">Open day</option></select>
        <button style={primaryBtn} onClick={add}>Add visit time</button>
      </div>
      {slots.length === 0 && <p style={{ ...card, ...small }}>No visit times yet. Families can still apply and you can call them.</p>}
      {slots.map((s) => (
        <div key={s.id} style={card}>
          <div style={{ ...row, justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600 }}>{fmtWhen(s.starts_at)}{s.kind === "open_day" ? " · Open day" : ""}</span>
            <span style={row}><span style={pill("neutral")}>{(booked[s.id] || []).length} / {s.capacity} booked</span><button style={{ ...ghostBtn, color: COLORS.bad }} onClick={() => remove(s)}>Delete</button></span>
          </div>
          {(booked[s.id] || []).map((a) => <p key={a.id} style={small}>{[a.child_first_name, a.child_last_name].filter(Boolean).join(" ")} · {a.parent1_name} · {a.parent1_phone}</p>)}
        </div>
      ))}
    </>
  );
}

// ---------- Numbers ----------

function Numbers({ year }) {
  const [s, setS] = useState(null);
  useEffect(() => { supabase.rpc("adm_stats", { p_year: year }).then(({ data }) => setS(data)); }, [year]);
  if (!s) return null;
  const st = s.by_stage || {};
  const total = Object.values(st).reduce((a, b) => a + b, 0);
  const won = (st.accepted || 0) + (st.enrolled || 0);
  const tiles = [["Enquiries and applications", total], ["Visits booked", st.visit_booked || 0], ["Offers waiting", st.offered || 0], ["Accepted or enrolled", won], ["Conversion", total ? Math.round((won / total) * 100) + "%" : "—"]];
  const max = Math.max(1, ...(s.by_source || []).map((x) => x.total));
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
        {tiles.map(([l, v]) => (
          <div key={l} style={{ background: COLORS.neutralBg, borderRadius: 10, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.muted }}>{l}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{v}</p>
          </div>
        ))}
      </div>
      <div style={card}>
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Where families heard of us</p>
        {(s.by_source || []).map((x) => (
          <div key={x.source} style={{ marginBottom: 8 }}>
            <div style={{ ...row, justifyContent: "space-between" }}><span style={{ fontSize: 14 }}>{x.source}</span><span style={small}>{x.total} · {x.won} accepted</span></div>
            <div style={{ height: 8, background: COLORS.neutralBg, borderRadius: 4 }}><div style={{ height: 8, width: `${(x.total / max) * 100}%`, background: COLORS.brand, borderRadius: 4 }} /></div>
          </div>
        ))}
        {!(s.by_source || []).length && <p style={small}>No data yet.</p>}
      </div>
      <div style={card}>
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>New enquiries and applications per month</p>
        {(s.by_month || []).map((m) => <p key={m.month} style={{ margin: "2px 0", fontSize: 14 }}>{new Date(m.month + "-15").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}: <strong>{m.total}</strong></p>)}
        {!(s.by_month || []).length && <p style={small}>No data yet.</p>}
      </div>
    </>
  );
}

// ---------- Settings ----------

function Settings({ settings, reload }) {
  const [f, setF] = useState(settings);
  async function save() {
    const { error } = await supabase.from("admission_settings").update({ school_year: f.school_year, applications_open: f.applications_open, registration_fee: f.registration_fee || null, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return alert(error.message);
    reload(); alert("Saved");
  }
  return (
    <div style={card}>
      <span style={label}>School year for admissions</span>
      <input style={{ ...input, width: 200 }} value={f.school_year} onChange={(e) => setF({ ...f, school_year: e.target.value })} />
      <span style={label}>Online applications</span>
      <div style={row}>
        <button style={f.applications_open ? chipOn : chip} onClick={() => setF({ ...f, applications_open: true })}>Open</button>
        <button style={!f.applications_open ? chipOn : chip} onClick={() => setF({ ...f, applications_open: false })}>Closed</button>
      </div>
      <span style={label}>Registration fee shown on the offer page (optional)</span>
      <input style={input} value={f.registration_fee || ""} onChange={(e) => setF({ ...f, registration_fee: e.target.value })} placeholder="Amount, and when it must be paid" />
      <p style={{ ...small, marginTop: 10 }}>Public link for the website and social media: {PUBLIC_URL} (add ?lang=fr to open it in French).</p>
      <button style={{ ...primaryBtn, marginTop: 12 }} onClick={save}>Save</button>
    </div>
  );
}

export { AdmissionsTab };

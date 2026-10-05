import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "./lib/supabaseClient";

export { MapPin as CheckinIcon };

// Staff check-in (staff screen, English only).
// The time always comes from the database (Côte d'Ivoire time), never from the phone.
// Location is read only when someone taps Check in / Check out.

const BURGUNDY = "#801524";
const LINE = "#EAD7DA";
const MUTED = "#6E7B7D";
const TONES = {
  ok: { bg: "#E6F2EC", fg: "#2F7A5C" },
  warn: { bg: "#FBF0DC", fg: "#8A5A0B" },
  danger: { bg: "#FCE8E8", fg: "#B23A3A" },
  info: { bg: "#F5E4E6", fg: BURGUNDY },
  blue: { bg: "#E6F1FB", fg: "#185FA5" },
  muted: { bg: "#F1EFEF", fg: "#5F5E5A" }
};

const wrap = { padding: "16px 16px 90px" };
const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: "0 1px 3px rgba(36,16,18,0.06)" };
const chip = { border: `1px solid ${LINE}`, borderRadius: 100, padding: "7px 13px", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#3B4A4C", fontFamily: "inherit" };
const chipOn = { ...chip, background: BURGUNDY, borderColor: BURGUNDY, color: "#fff" };
const primaryBtn = { background: BURGUNDY, color: "#fff", border: "none", borderRadius: 12, padding: "14px 16px", fontSize: 16, fontWeight: 600, cursor: "pointer", width: "100%", fontFamily: "inherit" };
const secondaryBtn = { ...chip, borderRadius: 10, padding: "9px 14px" };
const input = { width: "100%", padding: "9px 10px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 14, background: "#FCFAF4", boxSizing: "border-box", fontFamily: "inherit" };
const label = { display: "block", fontSize: 13, color: MUTED, margin: "12px 0 5px" };
const heading = { margin: "0 0 12px", fontSize: 18, fontWeight: 600 };
const tile = { background: "#FCFAF4", borderRadius: 10, padding: "8px 10px" };

const STATUS = {
  present: { label: "On time", tone: TONES.ok },
  late: { label: "Late", tone: TONES.warn },
  absent: { label: "Absent", tone: TONES.danger },
  leave: { label: "Leave", tone: TONES.blue },
  sick: { label: "Sick leave", tone: TONES.blue },
  authorized: { label: "Authorized absence", tone: TONES.blue },
  training: { label: "Training", tone: TONES.blue },
  official: { label: "Official assignment", tone: TONES.blue },
  holiday: { label: "Holiday / no school", tone: TONES.muted },
  closure: { label: "School closure", tone: TONES.muted },
  not_in: { label: "Not in yet", tone: TONES.muted },
  not_required: { label: "Doesn't check in", tone: TONES.muted }
};
const EDIT_STATUSES = ["present", "absent", "leave", "sick", "authorized", "training", "official", "holiday", "closure"];
const ROLE_LABEL = { admin: "Admin", teacher: "Teacher", learning_assistant: "Learning assistant", accountant: "Accountant" };
const DAYS = [
  { n: "1", label: "Monday" }, { n: "2", label: "Tuesday" }, { n: "3", label: "Wednesday" },
  { n: "4", label: "Thursday" }, { n: "5", label: "Friday" }, { n: "6", label: "Saturday" }, { n: "7", label: "Sunday" }
];
const TZ_DEFAULT = "Africa/Abidjan";
const STAFF_ROLES = ["admin", "teacher", "learning_assistant", "accountant"];

function Pill({ status, text }) {
  const s = STATUS[status] || { label: status, tone: TONES.muted };
  return (
    <span style={{ background: s.tone.bg, color: s.tone.fg, padding: "3px 9px", borderRadius: 100, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {text || s.label}
    </span>
  );
}

const fmtTime = (iso, tz = TZ_DEFAULT) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : "";
const fmtDay = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtLongDay = (ymd) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const todayIn = (tz = TZ_DEFAULT) => new Date().toLocaleDateString("en-CA", { timeZone: tz });

// Ask the phone for its position, once. Never watches the position.
function readLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ error: "unsupported" });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => resolve({ error: err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}
const LOCATION_HELP = {
  denied: "Location is blocked for the Hub. Open your browser's site settings for hub.bischoolci.org, allow Location, then try again.",
  timeout: "Your phone took too long to find its location. Turn on GPS / Location, step outside or near a window, and try again.",
  unavailable: "Your phone couldn't find its location. Turn on GPS / Location and try again.",
  unsupported: "This device can't share its location. Please check in from your phone."
};

export default function StaffCheckinTab({ profile }) {
  const role = profile?.role;
  const isStaff = STAFF_ROLES.includes(role);
  const canSeeAll = ["admin", "accountant", "viewer"].includes(role);
  const isAdmin = role === "admin";
  const [view, setView] = useState(isStaff ? "mine" : "all");

  if (!isStaff && !canSeeAll) {
    return <div style={wrap}><p style={{ ...card, fontSize: 14, color: MUTED }}>Staff check-in is only available to staff.</p></div>;
  }

  return (
    <div style={wrap}>
      {(canSeeAll && (isStaff || isAdmin)) && (
        <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
          {isStaff && <button style={view === "mine" ? chipOn : chip} onClick={() => setView("mine")}>My check-in</button>}
          <button style={view === "all" ? chipOn : chip} onClick={() => setView("all")}>All staff</button>
          {isAdmin && <button style={view === "settings" ? chipOn : chip} onClick={() => setView("settings")}>Settings</button>}
        </div>
      )}
      {view === "mine" && isStaff && <MyCheckin profile={profile} />}
      {view === "all" && canSeeAll && <AllStaff isAdmin={isAdmin} />}
      {view === "settings" && isAdmin && <CheckinSettings />}
    </div>
  );
}

// ---------- Small reminder on the Dashboard ----------

export function CheckinBanner({ profile, onOpen }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    if (!STAFF_ROLES.includes(profile?.role)) return;
    supabase.rpc("staff_checkin_status").then(({ data, error }) => { if (!error) setS(data); });
  }, [profile?.id, profile?.role]);
  if (!s || !s.required || !s.expected_start || s.holiday || s.leave === "full") return null;
  const rec = s.record;
  const tz = s.timezone || TZ_DEFAULT;
  const nowHM = new Date(s.server_now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  let text = null;
  if (!rec || (!rec.check_in_at && rec.status === "absent")) text = "You haven't checked in yet today.";
  else if (rec.check_in_at && !rec.check_out_at && s.expected_end && nowHM >= s.expected_end) text = "Don't forget to check out before you leave.";
  if (!text) return null;
  return (
    <div style={{ margin: "12px 16px 0", background: "#F5E4E6", border: `1px solid ${LINE}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <MapPin size={18} color={BURGUNDY} />
      <span style={{ flex: 1, fontSize: 14, color: BURGUNDY, fontWeight: 600 }}>{text}</span>
      <button style={{ ...secondaryBtn, background: BURGUNDY, color: "#fff", borderColor: BURGUNDY }} onClick={onOpen}>Open</button>
    </div>
  );
}

// ---------- My check-in ----------

function MyCheckin({ profile }) {
  const [s, setS] = useState(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState([]);
  const [showPrivacy, setShowPrivacy] = useState(false);

  async function load() {
    setError("");
    const { data, error: e } = await supabase.rpc("staff_checkin_status");
    if (e) { setError(e.message); return; }
    setS(data);
    setOffset(Number(data.server_now) - Date.now());
    const first = `${data.today.slice(0, 7)}-01`;
    const { data: rows } = await supabase.from("staff_attendance")
      .select("work_date,status,check_in_at,check_out_at,minutes_late,early_departure_minutes,missing_check_out,notes")
      .eq("staff_id", profile.id).gte("work_date", first).order("work_date", { ascending: false });
    setMonth(rows || []);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id); }, []);

  if (error) return <p style={{ ...card, color: TONES.danger.fg }}>Couldn't load check-in: {error}</p>;
  if (!s) return <p style={{ color: MUTED }}>Loading…</p>;

  const tz = s.timezone || TZ_DEFAULT;
  const serverNow = new Date(now + offset);
  const clock = serverNow.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const rec = s.record;
  const firstName = (profile?.full_name || "").split(" ")[0];
  const hour = Number(serverNow.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const checkedIn = !!rec?.check_in_at;
  const checkedOut = !!rec?.check_out_at;

  async function act(kind) {
    setMsg(null);
    if (kind === "out" && s.expected_end && clock < s.expected_end) {
      if (!window.confirm(`It's before ${s.expected_end}. Check out early?`)) return;
    }
    setBusy(kind === "in" ? "Finding your location…" : "Finding your location…");
    const loc = await readLocation();
    setBusy(kind === "in" ? "Checking in…" : "Checking out…");
    const fn = kind === "in" ? "staff_check_in" : "staff_check_out";
    const { data, error: e } = await supabase.rpc(fn, {
      p_lat: loc.lat ?? null, p_lng: loc.lng ?? null, p_accuracy: loc.accuracy ?? null,
      p_device: (navigator.userAgent || "").slice(0, 200)
    });
    setBusy("");
    if (e) { setMsg({ tone: TONES.danger, text: e.message }); return; }
    if (!data.ok) {
      const help = loc.error ? LOCATION_HELP[loc.error] : null;
      setMsg({ tone: TONES.danger, text: help || data.message });
      return;
    }
    setMsg({ tone: TONES.ok, text: kind === "in" ? "Checked in successfully." : "Checked out successfully." });
    await load();
  }

  const offDay = !s.expected_start || s.holiday;

  return (
    <>
      <section style={card}>
        <p style={{ margin: 0, fontSize: 13, color: MUTED }}>My check-in</p>
        <h2 style={{ margin: "2px 0 12px", fontSize: 20, fontWeight: 600 }}>{greeting}{firstName ? `, ${firstName}` : ""}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
          <div style={tile}><p style={{ margin: 0, fontSize: 12, color: MUTED }}>Today</p><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{fmtDay(s.today)}</p></div>
          <div style={tile}><p style={{ margin: 0, fontSize: 12, color: MUTED }}>Time now</p><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{clock}</p></div>
          <div style={tile}><p style={{ margin: 0, fontSize: 12, color: MUTED }}>Expected</p><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{s.expected_start ? `${s.expected_start}–${s.expected_end}` : "—"}</p></div>
        </div>

        {!s.required && <p style={{ fontSize: 14, color: MUTED }}>You don't need to check in. You can still record your arrival if you want.</p>}
        {s.holiday && <p style={{ fontSize: 14, color: MUTED }}>Today is a school holiday.</p>}
        {!s.holiday && !s.expected_start && <p style={{ fontSize: 14, color: MUTED }}>Today isn't a working day.</p>}
        {s.leave && <p style={{ fontSize: 14, color: TONES.blue.fg }}>You have approved {s.leave === "half" ? "half-day " : ""}leave today.</p>}
        {!s.site_ready && <p style={{ fontSize: 14, color: TONES.warn.fg }}>The school's location hasn't been set up yet, so check-in isn't possible. Please tell the office.</p>}

        {!checkedIn && (
          <button style={{ ...primaryBtn, opacity: busy ? 0.7 : 1 }} disabled={!!busy || !s.site_ready} onClick={() => act("in")}>
            {busy || "Check in"}
          </button>
        )}

        {checkedIn && (
          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
            <p style={{ margin: "0 0 6px", fontSize: 15 }}>
              ✓ Checked in at <strong>{fmtTime(rec.check_in_at, tz)}</strong>{" "}
              <Pill status={rec.status} text={rec.status === "late" ? `Late ${rec.minutes_late} min` : undefined} />
            </p>
            {rec.check_in_distance != null && <p style={{ margin: "0 0 6px", fontSize: 13, color: MUTED }}>Location verified · {rec.check_in_distance} m from school</p>}
            {checkedOut ? (
              <p style={{ margin: "6px 0 0", fontSize: 15 }}>
                ✓ Checked out at <strong>{fmtTime(rec.check_out_at, tz)}</strong>
                {rec.early_departure_minutes > 0 && <span style={{ color: TONES.warn.fg }}> · left {rec.early_departure_minutes} min early</span>}
              </p>
            ) : (
              <button style={{ ...primaryBtn, marginTop: 8, opacity: busy ? 0.7 : 1 }} disabled={!!busy} onClick={() => act("out")}>
                {busy || "Check out"}
              </button>
            )}
          </div>
        )}

        {msg && <p style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, background: msg.tone.bg, color: msg.tone.fg, fontSize: 14 }}>{msg.text}</p>}
        {offDay && !checkedIn && <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>You're not expected today, so you won't be marked absent.</p>}

        <p style={{ margin: "12px 0 0", fontSize: 12, color: MUTED }}>
          Your location is read only when you tap Check in or Check out, never during the day.{" "}
          <button onClick={() => setShowPrivacy((v) => !v)} style={{ background: "none", border: "none", color: BURGUNDY, padding: 0, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {showPrivacy ? "Less" : "More"}
          </button>
        </p>
        {showPrivacy && (
          <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            Location is used only to confirm you are at school when you check in or out. The exact GPS point is stored with that record
            and kept until the end of the school year; after that only "verified" and the distance are kept. Only the school director
            can see it. The time is taken from the school's server, not from your phone. You can't edit your own records; if something
            is wrong, tell the office.
          </p>
        )}
      </section>

      <section style={card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 600 }}>This month</h3>
        <MonthSummary rows={month} />
        {month.length === 0 && <p style={{ margin: 0, fontSize: 14, color: MUTED }}>Nothing recorded yet this month.</p>}
        {month.map((r) => (
          <div key={r.work_date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${LINE}`, fontSize: 14 }}>
            <span style={{ minWidth: 92 }}>{fmtDay(r.work_date)}</span>
            <span style={{ color: MUTED, flex: 1 }}>
              {r.check_in_at ? fmtTime(r.check_in_at, tz) : "—"} – {r.check_out_at ? fmtTime(r.check_out_at, tz) : r.missing_check_out ? "no check-out" : "—"}
            </span>
            <Pill status={r.status} text={r.status === "late" ? `Late ${r.minutes_late} min` : undefined} />
          </div>
        ))}
      </section>
    </>
  );
}

function MonthSummary({ rows }) {
  if (rows.length === 0) return null;
  const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const late = rows.filter((r) => r.status === "late").length;
  const lateMin = rows.reduce((n, r) => n + (r.status === "late" ? r.minutes_late || 0 : 0), 0);
  const absent = rows.filter((r) => r.status === "absent").length;
  const leave = rows.filter((r) => ["leave", "sick", "authorized", "training", "official"].includes(r.status)).length;
  const expected = present + absent;
  const pct = expected ? Math.round((present / expected) * 100) : null;
  const items = [
    ["Days worked", present], ["Late", late ? `${late} (${lateMin} min)` : 0], ["Absent", absent], ["Leave", leave],
    ["Attendance", pct == null ? "—" : `${pct}%`]
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8, marginBottom: 10 }}>
      {items.map(([k, v]) => (
        <div key={k} style={tile}><p style={{ margin: 0, fontSize: 12, color: MUTED }}>{k}</p><p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{v}</p></div>
      ))}
    </div>
  );
}

// ---------- All staff (admin / accountant / viewer) ----------

function AllStaff({ isAdmin }) {
  const [date, setDate] = useState(todayIn());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase.rpc("staff_attendance_day", { p_date: date });
    if (e) { setError(e.message); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [date]);

  const expected = rows.filter((r) => r.live_status !== "not_required");
  const count = (fn) => expected.filter(fn).length;
  const isLeave = (r) => ["leave", "sick", "authorized", "training", "official"].includes(r.live_status);
  const counts = [
    ["present", "Present", count((r) => r.live_status === "present" || r.live_status === "late")],
    ["late", "Late", count((r) => r.live_status === "late")],
    ["not_in", "Not in yet", count((r) => r.live_status === "not_in")],
    ["absent", "Absent", count((r) => r.live_status === "absent")],
    ["leave", "On leave", count(isLeave)],
    ["review", "To review", count((r) => r.needs_review || r.refused_attempts > 0)]
  ];
  const shown = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "present") return r.live_status === "present" || r.live_status === "late";
    if (filter === "leave") return isLeave(r);
    if (filter === "review") return r.needs_review || r.refused_attempts > 0;
    return r.live_status === filter;
  });
  const open = rows.find((r) => r.staff_id === openId);

  return (
    <>
      <section style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button style={secondaryBtn} onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...input, flex: 1 }} />
          <button style={secondaryBtn} onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
        </div>
        <h2 style={heading}>{fmtLongDay(date)}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {counts.map(([key, lbl, n]) => (
            <button key={key} onClick={() => setFilter(filter === key ? "all" : key)}
              style={{ ...tile, border: `1px solid ${filter === key ? BURGUNDY : "transparent"}`, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ display: "block", fontSize: 12, color: MUTED }}>{lbl}</span>
              <span style={{ display: "block", fontSize: 20, fontWeight: 600, color: "#241012" }}>{n}</span>
            </button>
          ))}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>{expected.length} staff expected. Tap a number to filter.</p>
      </section>

      <section style={card}>
        {loading && <p style={{ margin: 0, color: MUTED }}>Loading…</p>}
        {error && <p style={{ margin: 0, color: TONES.danger.fg }}>Couldn't load: {error}</p>}
        {!loading && !error && shown.length === 0 && <p style={{ margin: 0, fontSize: 14, color: MUTED }}>No one here.</p>}
        {!loading && shown.map((r) => (
          <button key={r.staff_id} onClick={() => setOpenId(r.staff_id)}
            style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "10px 0", border: "none", borderTop: `1px solid ${LINE}`, background: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#241012" }}>{r.full_name || "Unnamed"}</span>
              <span style={{ display: "block", fontSize: 12, color: MUTED }}>
                {ROLE_LABEL[r.role] || r.role}
                {r.check_in_at ? ` · in ${fmtTime(r.check_in_at)}` : ""}
                {r.check_out_at ? ` · out ${fmtTime(r.check_out_at)}` : r.missing_check_out ? " · no check-out" : ""}
                {r.check_in_distance != null ? ` · ${r.check_in_distance} m` : ""}
                {r.check_in_source === "manual" ? " · entered by office" : ""}
              </span>
              {(r.needs_review || r.refused_attempts > 0) && (
                <span style={{ display: "block", fontSize: 12, color: TONES.danger.fg }}>
                  {[r.review_reason, r.refused_attempts > 0 ? `${r.refused_attempts} refused attempt${r.refused_attempts > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <Pill status={r.live_status} text={r.live_status === "late" ? `Late ${r.minutes_late} min` : undefined} />
          </button>
        ))}
      </section>

      {open && <StaffDayModal row={open} date={date} isAdmin={isAdmin} onClose={() => setOpenId(null)} onSaved={() => { setOpenId(null); load(); }} />}
    </>
  );
}

function StaffDayModal({ row, date, isAdmin, onClose, onSaved }) {
  const startStatus = row.status || (row.live_status === "absent" || row.live_status === "not_in" ? "absent" : row.live_status === "late" ? "present" : row.live_status);
  const [status, setStatus] = useState(startStatus === "late" ? "present" : EDIT_STATUSES.includes(startStatus) ? startStatus : "absent");
  const [inT, setInT] = useState(row.check_in_at ? fmtTime(row.check_in_at) : "");
  const [outT, setOutT] = useState(row.check_out_at ? fmtTime(row.check_out_at) : "");
  const [note, setNote] = useState(row.notes || "");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    supabase.from("staff_attendance_attempts").select("attempted_at,kind,outcome,distance_m,accuracy")
      .eq("staff_id", row.staff_id).eq("work_date", date).order("attempted_at")
      .then(({ data }) => setAttempts(data || []));
    supabase.rpc("staff_attendance_history", { p_staff_id: row.staff_id, p_date: date })
      .then(({ data }) => setHistory(data || []));
  }, [row.staff_id, date]);

  async function save() {
    setErr("");
    if (!reason.trim()) return setErr("Write the reason for this change. It is kept in the log.");
    if (status === "present" && !inT) return setErr("Enter the arrival time.");
    if (inT && outT && outT <= inT) return setErr("Check-out must be after check-in.");
    setBusy(true);
    const { error } = await supabase.rpc("staff_attendance_admin_set", {
      p_staff_id: row.staff_id, p_date: date, p_status: status,
      p_check_in: status === "present" ? inT || null : null,
      p_check_out: status === "present" ? outT || null : null,
      p_note: note.trim() || null, p_reason: reason.trim()
    });
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved();
  }

  const OUTCOME = {
    outside_radius: "outside the area", poor_accuracy: "weak GPS", no_location: "no location",
    site_not_set: "school location not set", already_checked_in: "tried to check in twice", already_checked_out: "tried to check out twice"
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(43,18,22,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{row.full_name}</h3>
          <button onClick={onClose} style={{ ...secondaryBtn, padding: "5px 11px" }}>Close</button>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: MUTED }}>{fmtLongDay(date)}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 14, marginBottom: 6 }}>
          <Pill status={row.live_status} text={row.live_status === "late" ? `Late ${row.minutes_late} min` : undefined} />
          {row.check_in_at && <span>In {fmtTime(row.check_in_at)}{row.check_in_distance != null ? ` (${row.check_in_distance} m, ± ${Math.round(row.check_in_accuracy || 0)} m)` : ""}</span>}
          {row.check_out_at && <span>· Out {fmtTime(row.check_out_at)}</span>}
          {row.early_departure_minutes > 0 && <span style={{ color: TONES.warn.fg }}>· left {row.early_departure_minutes} min early</span>}
        </div>
        {row.review_reason && <p style={{ margin: "0 0 6px", fontSize: 13, color: TONES.danger.fg }}>To review: {row.review_reason}</p>}
        {row.notes && <p style={{ margin: "0 0 6px", fontSize: 13, color: MUTED }}>Note: {row.notes}</p>}

        {attempts.length > 0 && (
          <div style={{ margin: "10px 0" }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>Refused attempts</p>
            {attempts.map((a, i) => (
              <p key={i} style={{ margin: 0, fontSize: 13, color: MUTED }}>
                {fmtTime(a.attempted_at)} · {a.kind === "check_in" ? "check-in" : "check-out"} · {OUTCOME[a.outcome] || a.outcome}
                {a.distance_m != null ? ` · ${a.distance_m} m` : ""}{a.accuracy != null ? ` · ± ${Math.round(a.accuracy)} m` : ""}
              </p>
            ))}
          </div>
        )}

        {isAdmin && (
          <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 10, paddingTop: 6 }}>
            <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 600 }}>Correct this day</p>
            <label style={label}>Status</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EDIT_STATUSES.map((st) => (
                <button key={st} style={status === st ? chipOn : chip} onClick={() => setStatus(st)}>
                  {st === "present" ? "Present" : STATUS[st].label}
                </button>
              ))}
            </div>
            {status === "present" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={label}>Arrived</label><input type="time" value={inT} onChange={(e) => setInT(e.target.value)} style={input} /></div>
                <div><label style={label}>Left (optional)</label><input type="time" value={outT} onChange={(e) => setOutT(e.target.value)} style={input} /></div>
              </div>
            )}
            {status === "present" && <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>On time or late is worked out from the arrival time.</p>}
            <label style={label}>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} style={input} placeholder="Doctor's certificate received" />
            <label style={label}>Reason for the change (kept in the log)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} style={input} placeholder="Phone GPS failed, I saw her arrive" />
            {err && <p style={{ margin: "8px 0 0", fontSize: 13, color: TONES.danger.fg }}>{err}</p>}
            <button style={{ ...primaryBtn, marginTop: 12, fontSize: 15, padding: "12px 16px" }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save correction"}</button>
          </div>
        )}

        {history.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>Change log</p>
            {history.map((h, i) => (
              <p key={i} style={{ margin: "0 0 4px", fontSize: 13, color: MUTED }}>
                {new Date(h.changed_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ_DEFAULT })}
                {" · "}{h.changed_by_name || "Admin"}: {STATUS[h.old_value?.status]?.label || "nothing"} → {STATUS[h.new_value?.status]?.label || h.new_value?.status}
                {" · "}“{h.reason}”
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Settings (admin) ----------

function CheckinSettings() {
  const [site, setSite] = useState(null);
  const [people, setPeople] = useState([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const [{ data: sites, error: e1 }, { data: staff, error: e2 }] = await Promise.all([
      supabase.from("school_sites").select("*").eq("active", true).order("created_at").limit(1),
      supabase.rpc("staff_attendance_day", { p_date: todayIn() })
    ]);
    if (e1 || e2) { setErr((e1 || e2).message); return; }
    setSite(sites?.[0] || null);
    setPeople(staff || []);
  }
  useEffect(() => { load(); }, []);

  if (err && !site) return <p style={{ ...card, color: TONES.danger.fg }}>Couldn't load settings: {err}</p>;
  if (!site) return <p style={{ color: MUTED }}>Loading…</p>;

  const setHours = (n, patch) => {
    const hours = { ...(site.hours || {}) };
    if (patch === null) delete hours[n];
    else hours[n] = { ...(hours[n] || { start: "07:30", end: "15:30" }), ...patch };
    setSite({ ...site, hours });
  };

  async function useHere() {
    setErr(""); setOk("");
    setBusy("Finding your location…");
    const loc = await readLocation();
    setBusy("");
    if (loc.error) return setErr(LOCATION_HELP[loc.error]);
    setSite({ ...site, latitude: Number(loc.lat.toFixed(6)), longitude: Number(loc.lng.toFixed(6)) });
    setOk(`Location captured (± ${Math.round(loc.accuracy)} m). Press Save to keep it.`);
  }

  async function save() {
    setErr(""); setOk("");
    if (!site.name.trim()) return setErr("Enter the school name.");
    const lat = site.latitude === "" || site.latitude == null ? null : Number(site.latitude);
    const lng = site.longitude === "" || site.longitude == null ? null : Number(site.longitude);
    if ((lat == null) !== (lng == null) || (lat != null && (Math.abs(lat) > 90 || Math.abs(lng) > 180 || Number.isNaN(lat) || Number.isNaN(lng)))) {
      return setErr("Check the latitude and longitude.");
    }
    for (const [n, h] of Object.entries(site.hours || {})) {
      if (!h.start || !h.end || h.end <= h.start) return setErr(`Check the hours for ${DAYS.find((d) => d.n === n)?.label}.`);
    }
    setBusy("Saving…");
    const { error } = await supabase.from("school_sites").update({
      name: site.name.trim(), address: (site.address || "").trim() || null, latitude: lat, longitude: lng,
      radius_m: Number(site.radius_m), max_accuracy_m: Number(site.max_accuracy_m), grace_minutes: Number(site.grace_minutes),
      hours: site.hours, updated_at: new Date().toISOString()
    }).eq("id", site.id);
    setBusy("");
    if (error) return setErr(error.message);
    setOk("Saved.");
  }

  async function toggleRequired(p) {
    const next = !p.required;
    setPeople((list) => list.map((x) => (x.staff_id === p.staff_id ? { ...x, required: next } : x)));
    const { error } = await supabase.from("staff_checkin_people").upsert({ staff_id: p.staff_id, required: next, updated_at: new Date().toISOString() });
    if (error) { setErr(error.message); load(); }
  }

  return (
    <>
      <section style={card}>
        <h2 style={heading}>School location</h2>
        <label style={label}>School name</label>
        <input value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} style={input} />
        <label style={label}>Address</label>
        <input value={site.address || ""} onChange={(e) => setSite({ ...site, address: e.target.value })} style={input} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={label}>Latitude</label><input value={site.latitude ?? ""} onChange={(e) => setSite({ ...site, latitude: e.target.value })} style={input} inputMode="decimal" /></div>
          <div><label style={label}>Longitude</label><input value={site.longitude ?? ""} onChange={(e) => setSite({ ...site, longitude: e.target.value })} style={input} inputMode="decimal" /></div>
        </div>
        <button style={{ ...secondaryBtn, marginTop: 10 }} onClick={useHere} disabled={!!busy}>Use my current location</button>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>Do this on your phone, standing in the middle of the school grounds.</p>
        {site.latitude != null && site.latitude !== "" && (
          <p style={{ margin: "6px 0 0", fontSize: 12 }}>
            <a href={`https://www.google.com/maps?q=${site.latitude},${site.longitude}`} target="_blank" rel="noreferrer" style={{ color: BURGUNDY }}>Check this point on a map</a>
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          <div><label style={label}>Area (m)</label><input type="number" min="20" max="2000" value={site.radius_m} onChange={(e) => setSite({ ...site, radius_m: e.target.value })} style={input} /></div>
          <div><label style={label}>GPS error (m)</label><input type="number" min="10" max="2000" value={site.max_accuracy_m} onChange={(e) => setSite({ ...site, max_accuracy_m: e.target.value })} style={input} /></div>
          <div><label style={label}>Grace (min)</label><input type="number" min="0" max="120" value={site.grace_minutes} onChange={(e) => setSite({ ...site, grace_minutes: e.target.value })} style={input} /></div>
        </div>
      </section>

      <section style={card}>
        <h2 style={heading}>Working hours</h2>
        {DAYS.map((d) => {
          const h = (site.hours || {})[d.n];
          return (
            <div key={d.n} style={{ padding: "8px 0", borderTop: `1px solid ${LINE}` }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, marginBottom: h ? 6 : 0 }}>
                <input type="checkbox" checked={!!h} onChange={(e) => setHours(d.n, e.target.checked ? {} : null)} /> {d.label}
                {!h && <span style={{ fontSize: 13, color: MUTED, marginLeft: "auto" }}>Not a working day</span>}
              </label>
              {h && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
                  <input type="time" value={h.start} onChange={(e) => setHours(d.n, { start: e.target.value })} style={{ ...input, minWidth: 0 }} />
                  <span style={{ color: MUTED }}>to</span>
                  <input type="time" value={h.end} onChange={(e) => setHours(d.n, { end: e.target.value })} style={{ ...input, minWidth: 0 }} />
                </div>
              )}
            </div>
          );
        })}
        <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>Holidays on the Hub calendar (type Holiday, all grades) are skipped automatically.</p>
      </section>

      {err && <p style={{ ...card, color: TONES.danger.fg, fontSize: 14 }}>{err}</p>}
      {ok && <p style={{ ...card, color: TONES.ok.fg, fontSize: 14 }}>{ok}</p>}
      <button style={{ ...primaryBtn, marginBottom: 14 }} onClick={save} disabled={!!busy}>{busy || "Save settings"}</button>

      <section style={card}>
        <h2 style={heading}>Who checks in</h2>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: MUTED }}>Everyone with a staff account checks in, unless you switch them off here.</p>
        {people.map((p) => (
          <label key={p.staff_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${LINE}`, fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={p.required} onChange={() => toggleRequired(p)} />
            <span style={{ flex: 1 }}>{p.full_name || "Unnamed"}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{ROLE_LABEL[p.role] || p.role}</span>
          </label>
        ))}
      </section>
    </>
  );
}

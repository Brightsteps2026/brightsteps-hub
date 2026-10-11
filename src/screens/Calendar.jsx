import { useState, useEffect } from "react";
import { Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { useLanguage, pluralKey } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import { GRADES, DEFAULT_SETTINGS, EVENT_TYPES, EVENT_TYPE_COLOR, isStaffOnlyEvent } from "../data/constants";
import { uid, formatEventWhen, todayStr, gradeLabel, tLabel } from "../lib/format";
import { Field, Modal } from "../ui/common";

const OFFICIAL_CALENDAR_2026_27 = [
  { title: "Faculty Orientation", type: "Staff", date: "2026-08-17", endDate: "2026-08-25" },
  { title: "Prophet's Birthday", type: "Holiday", date: "2026-08-26" },
  { title: "First Day of School", type: "Academic", date: "2026-08-27" },
  { title: "Welcome Coffee", type: "Event", date: "2026-09-04" },
  { title: "October Break", type: "Holiday", date: "2026-10-19", endDate: "2026-10-23" },
  { title: "All Saint Day", type: "Holiday", date: "2026-11-01" },
  { title: "Student Led Conferences", type: "Academic", date: "2026-11-09", endDate: "2026-11-13" },
  { title: "Peace Day", type: "Holiday", date: "2026-11-15" },
  { title: "School Holiday", type: "Holiday", date: "2026-11-16" },
  { title: "Thanksgiving Break", type: "Holiday", date: "2026-11-26", endDate: "2026-11-27" },
  { title: "Holiday Concert", type: "Event", date: "2026-12-11" },
  { title: "December Break", type: "Holiday", date: "2026-12-16", endDate: "2027-01-08" },
  { title: "Christmas Day", type: "Holiday", date: "2026-12-25" },
  { title: "New Year", type: "Holiday", date: "2027-01-01" },
  { title: "Resume School", type: "Academic", date: "2027-01-11" },
  { title: "February Break", type: "Holiday", date: "2027-02-18", endDate: "2027-02-19" },
  { title: "Lay Qadr (TBD)", type: "Holiday", date: "2027-03-06" },
  { title: "Sit A Fitr (TBD)", type: "Holiday", date: "2027-03-09" },
  { title: "Spring Break", type: "Holiday", date: "2027-03-22", endDate: "2027-03-26" },
  { title: "Easter", type: "Holiday", date: "2027-03-28" },
  { title: "Easter Monday", type: "Holiday", date: "2027-03-29" },
  { title: "School Resumes", type: "Academic", date: "2027-04-05" },
  { title: "Labor Day", type: "Holiday", date: "2027-05-01" },
  { title: "Ascension", type: "Holiday", date: "2027-05-06" },
  { title: "Pentecote Monday", type: "Holiday", date: "2027-05-17" },
  { title: "Last Day of School", type: "Academic", date: "2027-06-08" }
];

// The nth weekday of a month (e.g. the 2nd Friday), as "YYYY-MM-DD", or null if that month has none.
function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const first = new Date(year, monthIndex, 1); // monthIndex may run past 11; Date rolls it into the next year
  const offset = (weekday - first.getDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  const d = new Date(first.getFullYear(), first.getMonth(), day);
  if (d.getMonth() !== first.getMonth()) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Is a date inside a school holiday on the calendar?
function isHolidayDate(events, dateStr) {
  return (events || []).some((e) => e.type === "Holiday" && dateStr >= e.date && dateStr <= (e.endDate || e.date));
}

const emptyEventForm = { title: "", type: EVENT_TYPES[0], date: "", endDate: "", grades: [], description: "", audience: "everyone", repeatMonthly: false };

function CalendarTab({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);
  const [audienceFilter, setAudienceFilter] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(emptyEventForm);

  const isParent = profile?.role === "parent";
  const isFamily = isParent || profile?.role === "student";
  const linkedIds = profile?.student_ids || [];
  const myGrades = isParent ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))] : [];

  const events = [...(data.events || [])]
    .filter((e) => !isFamily || !isStaffOnlyEvent(e))
    .filter((e) => !isParent || !e.grades || e.grades.length === 0 || e.grades.some((g) => myGrades.includes(g)))
    .sort((a, b) => a.date.localeCompare(b.date));
  const today = todayStr();
  const filtered = events
    .filter((e) => !typeFilter || e.type === typeFilter)
    .filter((e) => !audienceFilter || (audienceFilter === "staff" ? isStaffOnlyEvent(e) : !isStaffOnlyEvent(e)));
  const upcoming = filtered.filter((e) => (e.endDate || e.date) >= today);
  const past = filtered.filter((e) => (e.endDate || e.date) < today);

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g] }));
  };

  // Choosing the "Staff" type also makes the event staff only (it can be switched back).
  const pickType = (type) => setForm((f) => ({ ...f, type, audience: type === "Staff" ? "staff" : f.audience }));

  const addEvent = () => {
    if (!form.title.trim() || !form.date) {
      setFormError("Please add a title and a date.");
      return;
    }
    const { repeatMonthly, ...base } = form;
    const first = { id: uid(), ...base, title: base.title.trim() };
    const toAdd = [first];

    // Repeat on the same weekday of each following month (e.g. every 2nd Friday),
    // until the end of the school year, skipping dates that fall in a holiday.
    if (repeatMonthly) {
      const start = new Date(`${form.date}T12:00:00`);
      const weekday = start.getDay();
      const nth = Math.ceil(start.getDate() / 7);
      const yearEnd = (data.settings || DEFAULT_SETTINGS).academicYear?.endDate || `${start.getFullYear() + 1}-06-30`;
      const seriesId = uid();
      first.seriesId = seriesId;
      for (let i = 1; i <= 12; i++) {
        const d = nthWeekdayOfMonth(start.getFullYear(), start.getMonth() + i, weekday, nth);
        if (!d) continue;
        if (d > yearEnd) break;
        if (isHolidayDate(data.events, d)) continue;
        toAdd.push({ ...first, id: uid(), date: d, endDate: "" });
      }
    }

    persist({ ...data, events: [...(data.events || []), ...toAdd] });
    setForm(emptyEventForm);
    setFormError("");
    setTypeFilter(null);
    setAudienceFilter(null);
    setShowAdd(false);
  };

  const removeEvent = (id) => persist({ ...data, events: (data.events || []).filter((e) => e.id !== id) });

  // Offer the official list only while none of it is on the calendar, so removing
  // one event doesn't bring the button (and that event) back.
  const alreadyLoaded = OFFICIAL_CALENDAR_2026_27.some((oe) =>
    (data.events || []).some((e) => e.title === oe.title && e.date === oe.date)
  );

  const importOfficialCalendar = () => {
    const existing = data.events || [];
    const toAdd = OFFICIAL_CALENDAR_2026_27.filter(
      (oe) => !existing.some((e) => e.title === oe.title && e.date === oe.date)
    ).map((oe) => ({ id: uid(), grades: [], description: "", audience: oe.type === "Staff" ? "staff" : "everyone", ...oe }));
    if (toAdd.length === 0) return;

    const settings = data.settings || DEFAULT_SETTINGS;
    const needsYearFill = !settings.academicYear.startDate && !settings.academicYear.endDate;
    const nextSettings = needsYearFill
      ? { ...settings, academicYear: { startDate: "2026-08-27", endDate: "2027-06-08" } }
      : settings;

    persist({ ...data, events: [...existing, ...toAdd], settings: nextSettings });
  };

  const renderEvent = (e) => (
    <div key={e.id} className="bsf-card bsf-student">
      <div>
        <div className="bsf-row-head">
          <span className="bsf-status-pill" style={{ background: `${EVENT_TYPE_COLOR[e.type]}1A`, color: EVENT_TYPE_COLOR[e.type] }}>
            {tLabel(t, "eventType.", e.type)}
          </span>
          {!isFamily && isStaffOnlyEvent(e) && <span className="bsf-status-pill bsf-staffonly-pill">Staff only</span>}
          <span className="bsf-muted">{formatEventWhen(e, language)}</span>
        </div>
        <strong>{e.title}</strong>
        <p className="bsf-muted">{e.grades && e.grades.length > 0 ? e.grades.map((g) => (isFamily ? gradeLabel(g, language) : g)).join(", ") : t("common.wholeSchool")}</p>
        {e.description && <p>{e.description}</p>}
      </div>
      {!isFamily && <button className="bsf-iconbtn" onClick={() => removeEvent(e.id)} aria-label="Remove"><Trash2 size={16} /></button>}
    </div>
  );

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("nav.calendar")}</p>
        <h1>{t(pluralKey("calendar.upcomingCount", upcoming.length, language), { n: upcoming.length })}</h1>
        {upcoming[0] && <p className="bsf-hero-sub">{t("common.nextPrefix")} {upcoming[0].title} · {formatEventWhen(upcoming[0], language)}</p>}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0, gap: 8, flexWrap: "wrap" }}>
        <button className="bsf-btn bsf-btn-ghost" onClick={() => setShowSubscribe(true)}>
          <CalendarIcon size={16} /> {t("calendar.subscribe")}
        </button>
        {!isFamily && <button className="bsf-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button>}
      </div>

      {!isFamily && !alreadyLoaded && (
        <button type="button" className="bsf-templatebtn" onClick={importOfficialCalendar}>
          Load the 2026–27 academic calendar
        </button>
      )}

      <section className="bsf-card">
        <h2>{t("common.filterByType")}</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${typeFilter === null ? "active" : ""}`} onClick={() => setTypeFilter(null)}>{t("common.all")}</button>
          {EVENT_TYPES.filter((tp) => !isFamily || tp !== "Staff").map((tp) => (
            <button key={tp} className={`bsf-chip ${typeFilter === tp ? "active" : ""}`} onClick={() => setTypeFilter(tp)}>{tLabel(t, "eventType.", tp)}</button>
          ))}
        </div>
        {!isFamily && (
          <div className="bsf-chiprow" style={{ marginTop: 10 }}>
            <button className={`bsf-chip ${audienceFilter === null ? "active" : ""}`} onClick={() => setAudienceFilter(null)}>Everyone + staff</button>
            <button className={`bsf-chip ${audienceFilter === "everyone" ? "active" : ""}`} onClick={() => setAudienceFilter("everyone")}>Seen by families</button>
            <button className={`bsf-chip ${audienceFilter === "staff" ? "active" : ""}`} onClick={() => setAudienceFilter("staff")}>Staff only</button>
          </div>
        )}
      </section>

      <section className="bsf-list">
        <h2 className="bsf-listheading">{t("calendar.upcoming")}</h2>
        {upcoming.length === 0 && <p className="bsf-empty">{t("dash.nothingScheduled")}</p>}
        {upcoming.map(renderEvent)}
      </section>

      {past.length > 0 && (
        <section className="bsf-list">
          <h2 className="bsf-listheading">{t("calendar.past")}</h2>
          {past.map(renderEvent)}
        </section>
      )}

      {showSubscribe && <CalendarSubscribeModal isFamily={isFamily} isAdmin={profile?.role === "admin"} onClose={() => setShowSubscribe(false)} />}

      {showAdd && (
        <Modal title="New calendar event" onClose={() => setShowAdd(false)}>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Welcome Coffee" />
          </Field>
          <Field label="Who can see it?">
            <div className="bsf-two-col">
              <button type="button" className={`bsf-audience-btn ${form.audience !== "staff" ? "active" : ""}`} onClick={() => setForm({ ...form, audience: "everyone" })}>
                <strong>Everyone</strong>
                <span>Staff and families</span>
              </button>
              <button type="button" className={`bsf-audience-btn ${form.audience === "staff" ? "active" : ""}`} onClick={() => setForm({ ...form, audience: "staff" })}>
                <strong>Staff only</strong>
                <span>Hidden from families</span>
              </button>
            </div>
          </Field>
          <Field label="Type">
            <div className="bsf-chiprow">
              {EVENT_TYPES.map((tp) => (
                <button key={tp} type="button" className={`bsf-chip ${form.type === tp ? "active" : ""}`} onClick={() => pickType(tp)}>{tp}</button>
              ))}
            </div>
          </Field>
          <div className="bsf-two-col">
            <Field label="Date">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="End date (optional)">
              <input type="date" value={form.endDate} disabled={form.repeatMonthly} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <label className="bsf-checkline">
            <input type="checkbox" checked={form.repeatMonthly} onChange={(e) => setForm({ ...form, repeatMonthly: e.target.checked, endDate: e.target.checked ? "" : form.endDate })} />
            <span>
              Repeat every month on the same day
              {form.date && form.repeatMonthly && (() => {
                const d = new Date(`${form.date}T12:00:00`);
                const nth = ["1st", "2nd", "3rd", "4th", "5th"][Math.ceil(d.getDate() / 7) - 1];
                const day = d.toLocaleDateString("en-GB", { weekday: "long" });
                return ` (${nth} ${day} of each month, until the end of the school year, skipping holidays)`;
              })()}
            </span>
          </label>
          <Field label="Grades (optional, leave blank for whole school)">
            <div className="bsf-chiprow">
              {GRADES.map((g) => (
                <button key={g} type="button" className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`} onClick={() => toggleGrade(g)}>{g}</button>
              ))}
            </div>
          </Field>
          <Field label="Description">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addEvent}>Save event</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

// "Add to my phone calendar": gives the person a private link that Google Calendar
// or a phone calendar can follow. Staff get every event; families get only the
// events marked "Everyone". The link comes from the calendar_feeds table, which only
// hands each person the link they are allowed to have.
function CalendarSubscribeModal({ isFamily, onClose, isAdmin }) {
  const { t } = useLanguage();
  const [feedUrl, setFeedUrl] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [renewing, setRenewing] = useState(false);

  // Admin only: replace both calendar links (staff and families). Old links stop
  // working; everyone who subscribed must add the calendar again.
  const renewLinks = async () => {
    if (!window.confirm("Make new calendar links? Everyone who added the school calendar to their phone will have to add it again.")) return;
    setRenewing(true);
    const { error: e } = await supabase.rpc("rotate_calendar_feeds");
    setRenewing(false);
    if (e) { alert("Could not make new links: " + e.message); return; }
    setFeedUrl("");
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let cancelled = false;
    supabase.from("calendar_feeds").select("audience, token").then(({ data: rows, error: e }) => {
      if (cancelled) return;
      const row = (rows || []).find((r) => r.audience === (isFamily ? "everyone" : "staff")) || (rows || []).find((r) => r.audience === "everyone");
      if (e || !row) { setError(t("calendar.subscribeError")); return; }
      const base = import.meta.env.VITE_SUPABASE_URL;
      setFeedUrl(`${base}/functions/v1/calendar-feed?t=${row.token}`);
    });
    return () => { cancelled = true; };
  }, [isFamily, reloadKey]);

  const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  const copy = () => {
    navigator.clipboard?.writeText(feedUrl).then(() => setCopied(true)).catch(() => {});
  };

  return (
    <Modal title={t("calendar.subscribe")} onClose={onClose}>
      <p>{isFamily ? t("calendar.subscribeIntroFamily") : t("calendar.subscribeIntroStaff")}</p>
      {error && <p className="bsf-formerror">{error}</p>}
      {!error && !feedUrl && <p className="bsf-muted">{t("top.loading")}</p>}
      {feedUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a className="bsf-btn bsf-btn-block" href={googleUrl} target="_blank" rel="noopener noreferrer">{t("calendar.subscribeGoogle")}</a>
          <a className="bsf-btn bsf-btn-ghost bsf-btn-block" href={webcalUrl}>{t("calendar.subscribePhone")}</a>
          <button type="button" className="bsf-btn bsf-btn-ghost bsf-btn-block" onClick={copy}>{copied ? t("calendar.subscribeCopied") : t("calendar.subscribeCopy")}</button>
          <p className="bsf-muted" style={{ fontSize: 13 }}>{t("calendar.subscribeNote")}</p>
          {isAdmin && (
            <button type="button" className="bsf-textbtn" onClick={renewLinks} disabled={renewing}>
              {renewing ? "Making new links…" : "Make new links (if a link was shared by mistake)"}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export { CalendarTab };

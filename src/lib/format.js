import { useState, useEffect } from "react";
import { UserPlus, FileText, Wallet } from "lucide-react";
import { hasTranslation } from "./i18n";

const uid = () => Math.random().toString(36).slice(2, 10);

// Generates the next student ID number for the current year, e.g. 2026001, 2026002...
// Numbering restarts at 001 each new calendar year.
function nextStudentIdNumber(existingIdNumbers) {
  const year = new Date().getFullYear();
  const used = existingIdNumbers
    .filter((n) => n && n.startsWith(String(year)))
    .map((n) => parseInt(n.slice(String(year).length), 10))
    .filter((n) => !isNaN(n));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${year}${String(next).padStart(3, "0")}`;
}

// Friendly event dates: "Mon 19 Oct", "Mon 19 – Fri 23 Oct", "Fri 30 Oct – Mon 2 Nov".
function formatEventWhen(e, language = "en") {
  if (!e?.date) return "";
  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const start = new Date(`${e.date}T12:00:00`);
  const end = e.endDate && e.endDate > e.date ? new Date(`${e.endDate}T12:00:00`) : null;
  const dayMonth = (d) => d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const dayOnly = (d) => d.toLocaleDateString(locale, { weekday: "short", day: "numeric" });
  if (!end) return dayMonth(start);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return `${sameMonth ? dayOnly(start) : dayMonth(start)} – ${dayMonth(end)}`;
}

// Only open ordinary web links typed into the Hub (never "javascript:" and the like).
function safeLink(url) {
  const u = String(url || "").trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^www\./i.test(u)) return "https://" + u;
  return undefined;
}

function todayStr() {
  // Use the LOCAL calendar date, not the UTC one. toISOString() converts to UTC
  // first, so anyone west of Greenwich saw yesterday's date late in the evening,
  // and anyone east of it saw tomorrow's date early in the morning.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-10-12" -> "12 October 2026" / "12 octobre 2026". Older menus saved a
// typed week (e.g. "Aug 31, 2026"); those are shown as they were typed.
function lunchWeekLabel(weekOf, lang) {
  if (!weekOf) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) return weekOf;
  const [y, m, d] = weekOf.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// True when today falls in the Monday-to-Sunday week starting on (or containing) this date.
function isThisSchoolWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const now = new Date();
  return now >= start && now < end;
}

// Returns the weekday name for right now, and re-renders the component when the
// day actually rolls over. Without this, a tab left open on a front-desk screen
// keeps showing whatever day it was when the page was first loaded.
function useTodayWeekday() {
  const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const [name, setName] = useState(() => NAMES[new Date().getDay()]);

  useEffect(() => {
    const tick = () => setName(NAMES[new Date().getDay()]);
    // Check on a short interval so it also catches the machine waking from sleep
    // or the clock being corrected, not just the stroke of midnight.
    const id = setInterval(tick, 60 * 1000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, []);

  return name;
}

// Always "50 000 FCFA": a space between thousands, no decimals, in both languages.
function formatCurrency(amount) {
  const n = Math.round(Number(amount) || 0);
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${digits} FCFA`;
}

// "2026-10-10" -> "10 October 2026" / "10 octobre 2026". Read as a local date
// (never new Date("YYYY-MM-DD"), which is UTC and can show the day before).
// Anything that is not a plain date is shown as it was saved.
function formatDateLong(dateStr, language) {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!m) return dateStr;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    .toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Same format for a full timestamp (e.g. created_at from the database).
function formatTimestampDate(ts, language) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// French display names for the grades, for parent screens only. Stored values never change.
const GRADE_LABEL_FR = { "Pre-N": "Pré-maternelle", "PreK": "Petite section", "Kindergarten": "Grande section" };

function gradeLabel(g, language) {
  if (language !== "fr" || !g) return g;
  if (GRADE_LABEL_FR[g]) return GRADE_LABEL_FR[g];
  const m = /^Grade (\d+)$/.exec(g);
  return m ? `Niveau ${m[1]}` : g;
}

// Translates a stored English value (a fee status, event type, category...) for
// display only. Unknown values (custom ones typed by staff) are shown as saved.
function tLabel(t, prefix, value) {
  if (value === undefined || value === null || value === "") return value;
  return hasTranslation(`${prefix}${value}`) ? t(`${prefix}${value}`) : value;
}

// Compares what's actually owed (the fee schedule, set once per category)
// against what's been paid, category by category. This is the single source
// of truth both the admin Billing screen and the parent Dashboard read from,
// so a status like "Partially paid" always means the same thing everywhere.
function computeFeeBreakdown(data, studentId) {
  const schedule = (data.feeSchedule || []).filter((f) => f.studentId === studentId);
  const entries = (data.billing || []).filter((b) => b.studentId === studentId);

  const categories = {};
  schedule.forEach((f) => {
    if (!categories[f.category]) categories[f.category] = { listPrice: 0, discountAmount: 0, discountReason: "", waived: false, paid: 0 };
    // Older schedule entries only had amountDue, treat that as the list price for them.
    const listPrice = f.listPrice != null ? Number(f.listPrice || 0) : Number(f.amountDue || 0);
    categories[f.category].listPrice += listPrice;
    categories[f.category].discountAmount += Number(f.discountAmount || 0);
    if (f.discountReason) categories[f.category].discountReason = f.discountReason;
    if (f.waived) categories[f.category].waived = true;
  });
  entries.forEach((b) => {
    const cat = b.category || "Tuition";
    if (!categories[cat]) categories[cat] = { listPrice: 0, discountAmount: 0, discountReason: "", waived: false, paid: 0 };
    if (b.type === "charge") categories[cat].listPrice += Number(b.amount || 0);
    else categories[cat].paid += Number(b.amount || 0);
  });

  return Object.entries(categories)
    .map(([category, v]) => {
      const charged = v.waived ? 0 : Math.max(0, v.listPrice - v.discountAmount);
      const due = charged - v.paid;
      const status = v.waived
        ? "Waived"
        : v.listPrice === 0
        ? (v.paid > 0 ? "Payment received" : "No fee set")
        : due <= 0 ? "Paid in full"
        : v.paid > 0 ? "Partially paid"
        : "Not yet paid";
      return {
        category,
        listPrice: v.listPrice,
        discountAmount: v.discountAmount,
        discountReason: v.discountReason,
        waived: v.waived,
        charged, paid: v.paid, due,
        pct: charged > 0 ? Math.min(100, Math.round((v.paid / charged) * 100)) : (v.paid > 0 || v.waived ? 100 : 0),
        status
      };
    })
    .sort((a, b) => (a.category === "Registration" ? -1 : b.category === "Registration" ? 1 : 0));
}

function feeCategoryIcon(category) {
  if (category === "Registration") return UserPlus;
  if (category === "Tuition") return Wallet;
  return FileText;
}

// Counts messages the current person hasn't seen yet, across every student
// thread they're allowed to view. Parents only see messages from staff;
// staff only see messages from parents (staff-to-staff notes don't count).
// Counts a student's attendance days, optionally limited to a date range (a term).
// Pass no range to get the year-to-date total.
function attendanceCountsForRange(attendanceMap, studentId, startDate, endDate) {
  const counts = { present: 0, absent: 0, late: 0 };
  Object.entries(attendanceMap || {}).forEach(([date, day]) => {
    if (startDate && date < startDate) return;
    if (endDate && date > endDate) return;
    const status = day[studentId];
    if (status) counts[status === "excused" ? "absent" : status] += 1;
  });
  return counts;
}

// Unread message threads, one entry per student: [{ id, name, count }].
// Staff see family messages; families see staff messages. Teachers only count
// the students in their own grades (the ones they can open on Students).
function getUnreadThreads(data, profile) {
  if (!profile?.id) return [];
  const isParent = profile.role === "parent";
  const isStudent = profile.role === "student";
  const isSelfScoped = isParent || isStudent;
  const linkedIds = profile.student_ids || [];
  const teacherGrades = profile.role === "teacher" ? (profile.grades_assigned || []) : null;
  const threads = [];
  (data.students || []).forEach((s) => {
    if (isSelfScoped && !linkedIds.includes(s.id)) return;
    if (teacherGrades && !teacherGrades.includes(s.grade)) return;
    // Parents: the family thread. Students: their own thread. Staff: both.
    const threadKeys = isParent ? [["messages", "lastRead"]]
      : isStudent ? [["studentMessages", "studentLastRead"]]
      : [["messages", "lastRead"], ["studentMessages", "studentLastRead"]];
    let count = 0;
    threadKeys.forEach(([msgKey, readKey]) => {
      const lastRead = (s[readKey] && s[readKey][profile.id]) || "1970-01-01T00:00:00.000Z";
      (s[msgKey] || []).forEach((m) => {
        const messageIsFromFamily = m.role === "parent" || m.role === "student";
        const relevant = isSelfScoped ? !messageIsFromFamily : messageIsFromFamily;
        if (!relevant) return;
        const ts = m.createdAt || (m.date ? `${m.date}T00:00:00.000Z` : null);
        if (ts && ts > lastRead) count += 1;
      });
    });
    if (count > 0) threads.push({ id: s.id, name: s.name, count });
  });
  return threads.sort((a, b) => b.count - a.count || (a.name || "").localeCompare(b.name || ""));
}

function getUnreadMessageCount(data, profile) {
  return getUnreadThreads(data, profile).reduce((n, t) => n + t.count, 0);
}

export { uid, nextStudentIdNumber, formatEventWhen, safeLink, todayStr, lunchWeekLabel, isThisSchoolWeek, useTodayWeekday, formatCurrency, formatDateLong, formatTimestampDate, gradeLabel, tLabel, computeFeeBreakdown, feeCategoryIcon, attendanceCountsForRange, getUnreadThreads, getUnreadMessageCount };

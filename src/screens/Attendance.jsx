import { useState, useMemo } from "react";
import { useLanguage } from "../lib/i18n";
import { useReportedAbsences } from "../AbsenceReport";
import { GRADES } from "../data/constants";
import { todayStr, gradeLabel, isWeekendStr, lastSchoolDayStr } from "../lib/format";
import { StudentThumb } from "../ui/common";
import { AbsenceNotices } from "./Messages";

const STATUS_CYCLE = ["present", "absent", "late"];

const STATUS_LABEL = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };

const STATUS_COLOR = { present: "#2F7A5C", absent: "#B5473B", late: "#8A6420", excused: "#6B5BA6" };

// School rule (Nov 2026): class starts at 8:00, register taken by 8:10.
// A child who arrives after 8:00 is Late (never left Absent once they are here).
const CLASS_START = "08:00";
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const fmtTime = (hhmm) => { if (!hhmm) return ""; const [h, m] = hhmm.split(":").map(Number); return `${h}:${String(m).padStart(2, "0")}`; };

function AttendanceTab({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const [date, setDate] = useState(lastSchoolDayStr());
  const isParent = profile?.role === "parent";
  const isStudent = profile?.role === "student";
  const isSelfOnly = isParent || isStudent;
  const isStaffScoped = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const linkedIds = profile?.student_ids || [];
  const myAssignedGrades = profile?.grades_assigned || [];
  const myGrades = isSelfOnly
    ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))]
    : isStaffScoped
    ? myAssignedGrades
    : [];
  const [activeGrade, setActiveGrade] = useState((isSelfOnly || isStaffScoped) ? (myGrades[0] || null) : GRADES[0]);

  const dayRecord = data.attendance[date] || {};
  // Arrival time for late children, kept beside the register: lateArrivals[date][studentId] = { time, bus }.
  const dayLate = (data.lateArrivals || {})[date] || {};
  const reportedReasons = useReportedAbsences(date);
  const gradeStudents = isSelfOnly
    ? data.students.filter((s) => linkedIds.includes(s.id) && s.grade === activeGrade)
    : data.students.filter((s) => s.grade === activeGrade);

  const weekend = isWeekendStr(date);

  const setStatus = (studentId, status) => {
    if (weekend) return;
    const nextDay = { ...dayRecord, [studentId]: status };
    const allLate = data.lateArrivals || {};
    let nextLate = { ...dayLate };
    if (status === "late") {
      // Marked late today: note the arrival time now; the teacher can correct it.
      if (!nextLate[studentId]) nextLate[studentId] = { time: date === todayStr() ? nowHHMM() : "", bus: false };
    } else {
      delete nextLate[studentId];
    }
    persist({ ...data, attendance: { ...data.attendance, [date]: nextDay }, lateArrivals: { ...allLate, [date]: nextLate } });
  };

  const setLateInfo = (studentId, patch) => {
    const allLate = data.lateArrivals || {};
    const cur = dayLate[studentId] || { time: "", bus: false };
    persist({ ...data, lateArrivals: { ...allLate, [date]: { ...dayLate, [studentId]: { ...cur, ...patch } } } });
  };

  const lateText = (studentId, lang) => {
    const info = dayLate[studentId];
    if (!info) return "";
    const parts = [];
    if (info.time) parts.push(fmtTime(info.time));
    if (info.bus) parts.push(lang === "fr" ? "car scolaire" : "school bus");
    return parts.length ? " · " + parts.join(" · ") : "";
  };

  const cycleStatus = (studentId) => {
    if (isSelfOnly) return;
    const current = dayRecord[studentId];
    const idx = current ? STATUS_CYCLE.indexOf(current) : -1;
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setStatus(studentId, next);
  };

  const markAllPresent = () => {
    if (weekend) return;
    const nextDay = { ...dayRecord };
    gradeStudents.forEach((s) => { nextDay[s.id] = "present"; });
    persist({ ...data, attendance: { ...data.attendance, [date]: nextDay } });
  };

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, unmarked: 0 };
    gradeStudents.forEach((s) => {
      const st = dayRecord[s.id];
      if (st) counts[st === "excused" ? "absent" : st] += 1; else counts.unmarked += 1;
    });
    return counts;
  }, [dayRecord, gradeStudents]);

  const dateLabel = (() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long" });
  })();
  const isToday = date === lastSchoolDayStr();
  const markedTotal = summary.present + summary.absent + summary.late;

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("nav.attendance")}</p>
        <h1>{dateLabel}</h1>
        {!isToday && (
          <button className="bsf-textbtn" onClick={() => setDate(lastSchoolDayStr())} style={{ marginTop: 2 }}>
            {lastSchoolDayStr() === todayStr() ? t("attendance.jumpToday") : t("attendance.jumpSchoolDay")}
          </button>
        )}
        <div className="bsf-attend-summary">
          <div className="bsf-attend-bignum">
            <strong>{summary.present}</strong>
            <span>{t("attendance.presentToday")}</span>
          </div>
          {markedTotal > 0 && (
            <div className="bsf-attend-segbar">
              {summary.present > 0 && <span style={{ flex: summary.present, background: STATUS_COLOR.present }} />}
              {summary.late > 0 && <span style={{ flex: summary.late, background: STATUS_COLOR.late }} />}
              {summary.absent > 0 && <span style={{ flex: summary.absent, background: STATUS_COLOR.absent }} />}
            </div>
          )}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bsf-dateinput" style={{ marginTop: 12 }} />
      </div>

      {(isSelfOnly || isStaffScoped) && myGrades.length > 1 && (
        <section className="bsf-card">
          <h2>{t("reports.grade")}</h2>
          <div className="bsf-chiprow">
            {myGrades.map((g) => (
              <button key={g} className={`bsf-chip ${activeGrade === g ? "active" : ""}`} onClick={() => setActiveGrade(g)}>
                {isParent ? gradeLabel(g, language) : g}
              </button>
            ))}
          </div>
        </section>
      )}

      {!isSelfOnly && !isStaffScoped && (
        <section className="bsf-card">
          <h2>Grade</h2>
          <div className="bsf-chiprow">
            {GRADES.map((g) => (
              <button key={g} className={`bsf-chip ${activeGrade === g ? "active" : ""}`} onClick={() => setActiveGrade(g)}>
                {g}
              </button>
            ))}
          </div>
        </section>
      )}

      {!isSelfOnly && !weekend && (
        <section className="bsf-card" style={{ padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            <strong>Class starts at 8:00.</strong> Take the register by 8:10. A child who arrives after 8:00 is <strong>Late</strong>: if you marked them Absent, tap again to change it to Late and check the arrival time.
          </p>
        </section>
      )}
      {!isSelfOnly && <AbsenceNotices profile={profile} />}
      {weekend ? (
        <section className="bsf-card">
          <p className="bsf-empty" style={{ margin: 0 }}>{t("attendance.weekend")}</p>
        </section>
      ) : (<>
      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 16 }}>{isParent ? gradeLabel(activeGrade, language) : activeGrade}</h2>
        {!isSelfOnly && <button className="bsf-btn" onClick={markAllPresent} disabled={gradeStudents.length === 0}>Mark all present</button>}
      </div>
      <p className="bsf-muted" style={{ margin: "6px 4px 14px" }}>
        {t("dash.attendanceCounts", summary)}{!isSelfOnly ? ` · ${summary.unmarked} unmarked` : ""}
      </p>

      <section className="bsf-list">
        {gradeStudents.length === 0 && <p className="bsf-empty">{isSelfOnly ? t("attendance.noRecord") : "No students in this grade yet."}</p>}
        {gradeStudents.map((s) => {
          const status = dayRecord[s.id];
          return isSelfOnly ? (
            <div key={s.id} className="bsf-card bsf-attend-row">
              <StudentThumb photo={s.photo} />
              <span><strong>{s.name}</strong></span>
              <span
                className="bsf-status-pill"
                style={{
                  background: status ? `${STATUS_COLOR[status]}1A` : "#EEE6D2",
                  color: status ? STATUS_COLOR[status] : "#6B7578"
                }}
              >
                {status ? t(`attendance.status.${status}`) + (status === "late" ? lateText(s.id, language) : "") : t("attendance.notMarked")}
              </span>
            </div>
          ) : (
            <div key={s.id}>
            <button className="bsf-card bsf-attend-row bsf-clickable" style={{ width: "100%" }} onClick={() => cycleStatus(s.id)}>
              <StudentThumb photo={s.photo} />
              <span>
                <strong>{s.name}</strong>
              </span>
              <span
                className="bsf-status-pill"
                style={{
                  background: status ? `${STATUS_COLOR[status]}1A` : "#EEE6D2",
                  color: status ? STATUS_COLOR[status] : "#6B7578"
                }}
              >
                {status ? STATUS_LABEL[status] + (status === "excused" && reportedReasons[s.id] ? " · " + reportedReasons[s.id] : "") + (status === "late" ? lateText(s.id, "en") : "") : "Tap to mark"}
              </span>
            </button>
            {status === "late" && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", margin: "-4px 4px 10px", padding: "8px 12px", borderRadius: 10, background: "#8A64201A", fontSize: 14 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Arrived at
                  <input type="time" min={CLASS_START} value={(dayLate[s.id] || {}).time || ""}
                    onChange={(e) => setLateInfo(s.id, { time: e.target.value })} style={{ minHeight: 36 }} />
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={!!(dayLate[s.id] || {}).bus} onChange={(e) => setLateInfo(s.id, { bus: e.target.checked })} />
                  Came on the school bus (not the family's lateness)
                </label>
              </div>
            )}
            </div>
          );
        })}
      </section>
      </>)}
    </div>
  );
}

export { AttendanceTab };

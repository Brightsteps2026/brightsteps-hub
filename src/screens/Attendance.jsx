import { useState, useMemo } from "react";
import { useLanguage } from "../lib/i18n";
import { useReportedAbsences } from "../AbsenceReport";
import { GRADES } from "../data/constants";
import { todayStr, gradeLabel } from "../lib/format";
import { StudentThumb } from "../ui/common";
import { AbsenceNotices } from "./Messages";

const STATUS_CYCLE = ["present", "absent", "late"];

const STATUS_LABEL = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };

const STATUS_COLOR = { present: "#2F7A5C", absent: "#B5473B", late: "#8A6420", excused: "#6B5BA6" };

function AttendanceTab({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const [date, setDate] = useState(todayStr());
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
  const reportedReasons = useReportedAbsences(date);
  const gradeStudents = isSelfOnly
    ? data.students.filter((s) => linkedIds.includes(s.id) && s.grade === activeGrade)
    : data.students.filter((s) => s.grade === activeGrade);

  const setStatus = (studentId, status) => {
    const nextDay = { ...dayRecord, [studentId]: status };
    persist({ ...data, attendance: { ...data.attendance, [date]: nextDay } });
  };

  const cycleStatus = (studentId) => {
    if (isSelfOnly) return;
    const current = dayRecord[studentId];
    const idx = current ? STATUS_CYCLE.indexOf(current) : -1;
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setStatus(studentId, next);
  };

  const markAllPresent = () => {
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
  const isToday = date === todayStr();
  const markedTotal = summary.present + summary.absent + summary.late;

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("nav.attendance")}</p>
        <h1>{dateLabel}</h1>
        {!isToday && (
          <button className="bsf-textbtn" onClick={() => setDate(todayStr())} style={{ marginTop: 2 }}>
            {t("attendance.jumpToday")}
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

      {!isSelfOnly && <AbsenceNotices profile={profile} />}
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
                {status ? t(`attendance.status.${status}`) : t("attendance.notMarked")}
              </span>
            </div>
          ) : (
            <button key={s.id} className="bsf-card bsf-attend-row bsf-clickable" onClick={() => cycleStatus(s.id)}>
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
                {status ? STATUS_LABEL[status] + (status === "excused" && reportedReasons[s.id] ? " · " + reportedReasons[s.id] : "") : "Tap to mark"}
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}

export { AttendanceTab };

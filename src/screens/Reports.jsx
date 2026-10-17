import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage, pluralKey } from "../lib/i18n";
import { GRADES, ASSESS_LEVELS, getLevelColor, DEFAULT_SETTINGS, LETTER_GRADE_MEANING, LEARNING_PROGRESS_BAND, LETTER_GRADE_COLOR } from "../data/constants";
import { uid, todayStr, formatDateLong, gradeLabel, tLabel, attendanceCountsForRange, isWeekendStr } from "../lib/format";
import { Field, Modal } from "../ui/common";
import { TermReportsStaff, TermReportsFamily } from "../TermReports";

function ReportViewModal({ report, data, onClose, onRemove }) {
  const { t, language } = useLanguage();
  // Parents see report cards in their language; staff (always English) keep raw values.
  const isFamilyView = !onRemove;
  const D = (d) => (isFamilyView ? formatDateLong(d, language) : d);
  const G = (g) => (isFamilyView ? gradeLabel(g, language) : g);
  const range = (start, end) => t("common.dateRange", { start: start ? D(start) : "?", end: end ? D(end) : "?" });
  const kind = report.kind || "student";
  const settings = data?.settings || DEFAULT_SETTINGS;
  const student = data?.students.find((s) => s.id === report.studentId);
  const isLevelsReport = (report.grades || []).some((g) => g.scoreType === "Levels");

  return (
    <Modal
      title={
        kind === "student" ? t("reports.studentTitle", { name: report.studentName })
        : kind === "attendance" ? "Attendance report"
        : kind === "assessment" ? "Assessment report"
        : kind === "behavior" ? "Behavior report"
        : kind === "transcript" ? t("reports.transcriptTitle", { name: report.studentName })
        : "Standards report"
      }
      onClose={onClose}
    >
      {(kind === "student" || kind === "transcript") && (
        <button className="bsf-btn bsf-btn-block bsf-noprint" style={{ marginBottom: 16 }} onClick={() => window.print()}>
          {t("reports.print")}
        </button>
      )}

      <div className={(kind === "student" || kind === "transcript") ? "bsf-printable" : ""}>
        {(kind === "student" || kind === "transcript") && (
          <div className="bsf-letterhead">
            {settings.branding.logoUrl && <img src={settings.branding.logoUrl} alt="" className="bsf-letterhead-logo" />}
            <h2>BrightSteps International School</h2>
            <p className="bsf-muted">{kind === "student" ? t("reports.progressReport") : t("reports.academicTranscript")}</p>
            <table className="bsf-letterhead-table">
              <tbody>
                <tr><td>{t("reports.studentName")}</td><td>{report.studentName}</td></tr>
                <tr><td>{t("reports.grade")}</td><td>{G(report.grade)}</td></tr>
                <tr><td>{t("reports.academicYear")}</td><td>{settings.academicYear.startDate ? settings.academicYear.startDate.slice(0, 4) : "?"}/{settings.academicYear.endDate ? settings.academicYear.endDate.slice(0, 4) : "?"}</td></tr>
                <tr><td>{t("reports.period")}</td><td>{range(report.periodStart, report.periodEnd)}</td></tr>
                {student?.nationalities?.length > 0 && <tr><td>{t("reports.nationality")}</td><td>{student.nationalities.join(" - ")}</td></tr>}
              </tbody>
            </table>
            {kind === "student" && (
              <div className="bsf-letterhead-legend">
                {isLevelsReport ? (
                  <>
                    <strong>{t("reports.levelsLegend")}</strong>
                    <p>{t("reports.legend.Emerging")}</p>
                    <p>{t("reports.legend.Developing")}</p>
                    <p>{t("reports.legend.Proficient")}</p>
                    <p>{t("reports.legend.Confident")}</p>
                  </>
                ) : (
                  <>
                    <strong>{t("reports.gradesLegend")}</strong>
                    {Object.entries(LETTER_GRADE_MEANING).map(([letter, meaning]) => (
                      <p key={letter}><strong>{letter}</strong> — {tLabel(t, "grade.meaning.", letter) || meaning} ({tLabel(t, "grade.band.", LEARNING_PROGRESS_BAND[letter])})</p>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

      {kind === "student" && (
        <>
          <p className="bsf-muted bsf-noprint">{report.template} · {t("reports.generated", { date: D(report.createdDate) })}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">{t("nav.attendance")}</h3>
          <p className="bsf-muted">
            {t("reports.attendanceLine", report.attendanceSummary)}
          </p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">{t("reports.grades")}</h3>
          {(!report.grades || report.grades.length === 0) && <p className="bsf-empty">{t("reports.noGrades")}</p>}
          {(report.grades || []).map((g, i) => (
            <div key={i} className="bsf-row">
              <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[g.letter] || "#6B7578"}1A`, color: LETTER_GRADE_COLOR[g.letter] || "#6B7578" }}>
                {g.scoreType === "Percentage" ? `${g.score}% · ${g.letter}` : g.letter}
              </span>
              <div>
                <strong>{g.subject}{g.term ? ` · ${g.term}` : ""}</strong>
                {g.comments && <p>{g.comments}</p>}
              </div>
            </div>
          ))}

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">{t("child.assessments")}</h3>
          {report.assessments.length === 0 && <p className="bsf-empty">{t("reports.noAssessments")}</p>}
          {report.assessments.map((a, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{a.subject || t("reports.general")}</strong>
                {a.rows && a.rows.length > 0 ? (
                  <span className="bsf-tag">{a.rubricName || t("common.rubric")}</span>
                ) : (
                  <span className="bsf-status-pill" style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}>{tLabel(t, "level.", a.level)}</span>
                )}
              </div>
              {a.rows && a.rows.length > 0 ? (
                <div className="bsf-rubric-rows">
                  {a.rows.map((r, j) => (
                    <div key={j} className="bsf-rubric-row">
                      <span>{r.text}</span>
                      <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>{tLabel(t, "level.", r.level)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{a.criteria}</p>
              )}
              {a.feedback && <p className="bsf-muted">{a.feedback}</p>}
            </div>
          ))}

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">{t("reports.portfolioHighlights")}</h3>
          {report.portfolio.length === 0 && <p className="bsf-empty">{t("reports.noPortfolio")}</p>}
          {report.portfolio.map((p, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <span className="bsf-tag">{tLabel(t, "tag.", p.tag)}</span>
                <span className="bsf-muted">{D(p.date)}</span>
              </div>
              <p>{p.note}</p>
            </div>
          ))}

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">{t("reports.teacherComments")}</h3>
          <p>{report.teacherComments || t("reports.noComments")}</p>

          <div className="bsf-signatureblock">
            <div>
              <p>{t("reports.teacherSign")} ________________________________</p>
            </div>
            <div>
              <p>{t("reports.dateSign")} ________________________________</p>
            </div>
          </div>
        </>
      )}

      {kind === "attendance" && (
        <>
          <p className="bsf-muted">{report.grade} · Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Overall</h3>
          <p className="bsf-muted">
            {report.totals.present} present · {report.totals.absent} absent · {report.totals.late} late · {report.rate}% attendance rate
          </p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">By student</h3>
          {report.rows.length === 0 && <p className="bsf-empty">No attendance recorded in this period.</p>}
          {report.rows.map((r, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{r.studentName}</strong>
                <span className="bsf-muted">{r.present}P · {r.absent}A · {r.late}L</span>
              </div>
            </div>
          ))}
        </>
      )}

      {kind === "assessment" && (
        <>
          <p className="bsf-muted">{report.grade}{report.subject ? ` · ${report.subject}` : ""} · Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Level distribution</h3>
          <div className="bsf-rubric-rows">
            {Object.entries(report.levelCounts).map(([level, count]) => (
              <div key={level} className="bsf-rubric-row">
                <span>{level}</span>
                <span className="bsf-status-pill" style={{ background: `${getLevelColor(level)}1A`, color: getLevelColor(level) }}>{count}</span>
              </div>
            ))}
          </div>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Entries</h3>
          {report.entries.length === 0 && <p className="bsf-empty">No assessments recorded in this period.</p>}
          {report.entries.map((e, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{e.studentName}</strong>
                <span className="bsf-muted">{e.subject || "General"}</span>
              </div>
              {e.rows && e.rows.length > 0 ? (
                <div className="bsf-rubric-rows">
                  {e.rows.map((r, j) => (
                    <div key={j} className="bsf-rubric-row">
                      <span>{r.text}</span>
                      <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>{r.level}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="bsf-row-head">
                  <span>{e.criteria}</span>
                  <span className="bsf-status-pill" style={{ background: `${getLevelColor(e.level)}1A`, color: getLevelColor(e.level) }}>{e.level}</span>
                </p>
              )}
            </div>
          ))}
        </>
      )}

      {kind === "behavior" && (
        <>
          <p className="bsf-muted">{report.grade} · Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Overview</h3>
          <p className="bsf-muted">{report.typeCounts.Positive || 0} positive notes · {report.typeCounts.Concern || 0} concerns</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">By category</h3>
          <div className="bsf-rubric-rows">
            {Object.entries(report.categoryCounts).map(([cat, count]) => (
              <div key={cat} className="bsf-rubric-row">
                <span>{cat}</span>
                <span className="bsf-status-pill" style={{ background: "#F5E4E6", color: "#801524" }}>{count}</span>
              </div>
            ))}
          </div>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Entries</h3>
          {report.entries.length === 0 && <p className="bsf-empty">No behavior notes in this period.</p>}
          {report.entries.map((i, idx) => (
            <div key={idx} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{i.studentName}</strong>
                <span
                  className="bsf-status-pill"
                  style={{ background: i.type === "Positive" ? "#E7F0EA" : "#FBEAE8", color: i.type === "Positive" ? "#2F7A5C" : "#B5473B" }}
                >
                  {i.type} · {i.category}
                </span>
              </div>
              <p>{i.description}</p>
            </div>
          ))}
        </>
      )}

      {kind === "transcript" && (
        <>
          <p className="bsf-muted">{G(report.grade)} · {t("reports.periodPrefix")} {!report.periodStart && !report.periodEnd ? t("reports.fullHistory") : !report.periodEnd ? t("reports.fromToPresent", { start: D(report.periodStart) }) : !report.periodStart ? t("reports.upTo", { end: D(report.periodEnd) }) : range(report.periodStart, report.periodEnd)}</p>
          <p className="bsf-muted">{t("reports.generated", { date: D(report.createdDate) })}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">{t("reports.gpa")}</h3>
          <p className="bsf-muted">{report.gpa !== null ? t(pluralKey("reports.gpaLine", report.entries.length, language), { gpa: report.gpa, n: report.entries.length }) : t("reports.gpaNone")}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">{t("reports.gradeHistory")}</h3>
          {report.entries.length === 0 && <p className="bsf-empty">{t("reports.noGradeHistory")}</p>}
          {report.entries.map((e, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{e.subject}{e.term ? ` · ${e.term}` : ""}</strong>
                <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[e.letter] || "#6B7578"}1A`, color: LETTER_GRADE_COLOR[e.letter] || "#6B7578" }}>
                  {e.scoreType === "Percentage" ? `${e.score}% · ${e.letter}` : e.letter}
                </span>
              </div>
              <p className="bsf-muted">{D(e.date)}</p>
              {e.comments && <p>{e.comments}</p>}
            </div>
          ))}
        </>
      )}
      </div>

      {kind === "standards" && (
        <>
          <p className="bsf-muted">{report.grade} · Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          {Object.keys(report.byStandard).length === 0 && <p className="bsf-empty">No assessments linked to a standard in this period.</p>}
          {Object.entries(report.byStandard).map(([label, data]) => (
            <div key={label} className="bsf-comment">
              <strong>{label}</strong>
              <div className="bsf-rubric-rows" style={{ marginTop: 6 }}>
                {ASSESS_LEVELS.map((lvl) => (
                  <div key={lvl} className="bsf-rubric-row">
                    <span>{lvl}</span>
                    <span className="bsf-status-pill" style={{ background: `${getLevelColor(lvl)}1A`, color: getLevelColor(lvl) }}>{data[lvl] || 0}</span>
                  </div>
                ))}
              </div>
              <p className="bsf-muted" style={{ marginTop: 6 }}>{data.entries.length} assessment{data.entries.length === 1 ? "" : "s"} linked</p>
            </div>
          ))}
        </>
      )}

      <button className="bsf-btn bsf-btn-block" onClick={() => window.print()}>{t("reports.print")}</button>
      {onRemove && <button className="bsf-textbtn" style={{ marginTop: 10 }} onClick={() => onRemove(report.id)}>Delete this report</button>}
    </Modal>
  );
}

const REPORT_KINDS = [
  { id: "student", label: "Student report" },
  { id: "attendance", label: "Attendance report" },
  { id: "assessment", label: "Assessment report" },
  { id: "behavior", label: "Behavior report" },
  { id: "transcript", label: "Transcript" },
  { id: "standards", label: "Standards report" }
];

const GPA_POINTS = { A: 4, B: 3, C: 2, D: 1, F: 0 };

// Composes a starter report comment from a student's actual grades and attendance
// in the given period. This is a smart template, not generative AI, it never invents
// details, it only describes what's genuinely in the data, so the teacher can edit
// and personalize it rather than write the whole thing from a blank page.
function suggestReportComment(data, studentId, studentName, start, end) {
  const firstName = studentName.split(" ")[0];
  const grades = (data.gradeEntries || []).filter((e) => e.studentId === studentId && e.date >= (start || "0000-00-00") && e.date <= (end || "9999-99-99"));
  const attendance = attendanceCountsForRange(data.attendance, studentId, start, end);
  const totalDays = attendance.present + attendance.absent + attendance.late;
  const attendanceRate = totalDays > 0 ? Math.round((attendance.present / totalDays) * 100) : null;

  const parts = [];

  if (grades.length > 0) {
    const bySubject = {};
    grades.forEach((g) => { if (!bySubject[g.subject]) bySubject[g.subject] = []; bySubject[g.subject].push(g); });
    const subjects = Object.keys(bySubject);
    if (subjects.length > 0) {
      parts.push(`${firstName} was assessed this period in ${subjects.join(", ")}.`);
    }
    const levelGrades = grades.filter((g) => g.scoreType === "Levels" && g.letter);
    if (levelGrades.length > 0) {
      const topLevel = levelGrades.some((g) => g.letter === "Confident" || g.letter === "Proficient");
      parts.push(topLevel
        ? `${firstName} is showing strong, consistent progress toward grade-level expectations.`
        : `${firstName} is developing steadily and continuing to build confidence in these skills.`);
    }
    const letterGrades = grades.filter((g) => g.letter && g.scoreType !== "Levels");
    if (letterGrades.length > 0) {
      const strongCount = letterGrades.filter((g) => ["A+", "A", "B+"].includes(g.letter)).length;
      parts.push(strongCount >= letterGrades.length / 2
        ? `Overall academic performance this period has been strong.`
        : `There are some areas that would benefit from extra focus and support going forward.`);
    }
  } else {
    parts.push(`${firstName} has been an active participant in class this period.`);
  }

  if (attendanceRate !== null) {
    parts.push(attendanceRate >= 95
      ? `Attendance has been excellent, at ${attendanceRate}% for this period.`
      : `Attendance was ${attendanceRate}% for this period.`);
  }

  parts.push(`[Add a specific highlight or next step for ${firstName} here.]`);

  return parts.join(" ");
}

function ReportsTab({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [kind, setKind] = useState("student");
  const settings = data.settings || DEFAULT_SETTINGS;
  const templates = settings.reportCardTemplates && settings.reportCardTemplates.length ? settings.reportCardTemplates : ["Standard Progress Report"];
  // Grades this person actually teaches. A teacher who is only the learning
  // assistant in some grades (profiles.assistant_grades) does not see grades
  // or reports for those grades. Admins are not affected.
  const isTeacherScoped = profile?.role === "teacher";
  const teachingGrades = (profile?.grades_assigned || []).filter((g) => !(profile?.assistant_grades || []).includes(g));
  const canSeeGrade = (g) => !isTeacherScoped || teachingGrades.includes(g);

  const isParent = profile?.role === "parent";
  const linkedIds = profile?.student_ids || [];

  const [form, setForm] = useState({
    studentId: "", template: templates[0], grade: "", subject: "",
    periodStart: "", periodEnd: "", teacherComments: ""
  });
  const [formError, setFormError] = useState("");

  const reports = [...(data.reports || [])]
    .filter((r) => !isParent || ((r.kind === "student" || r.kind === "transcript") && linkedIds.includes(r.studentId)))
    .filter((r) => canSeeGrade(r.grade))
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate));
  const viewingReport = reports.find((r) => r.id === viewingId);

  const openForm = (k) => {
    setKind(k);
    setForm({ studentId: "", template: templates[0], grade: "", subject: "", periodStart: "", periodEnd: "", teacherComments: "" });
    setFormError("");
    setShowForm(true);
  };

  const generateStudentReport = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before generating.");
      return;
    }
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";

    const attendanceSummary = { present: 0, absent: 0, late: 0 };
    Object.entries(data.attendance || {}).forEach(([date, day]) => {
      if (date >= start && date <= end) {
        const status = day[student.id];
        if (status) attendanceSummary[status === "excused" ? "absent" : status] += 1;
      }
    });

    const assessments = (data.assessments || []).filter((a) => a.studentId === student.id && a.date >= start && a.date <= end);
    const portfolio = data.portfolio.filter((p) => p.studentId === student.id && p.date >= start && p.date <= end);
    const grades = (data.gradeEntries || []).filter((g) => g.studentId === student.id && g.date >= start && g.date <= end);

    const report = {
      id: uid(), kind: "student", studentId: student.id, studentName: student.name, grade: student.grade,
      template: form.template, periodStart: form.periodStart, periodEnd: form.periodEnd,
      teacherComments: form.teacherComments, createdDate: todayStr(), attendanceSummary, assessments, portfolio, grades
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateAttendanceReport = () => {
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";
    const targetStudents = form.grade ? data.students.filter((s) => s.grade === form.grade) : data.students;

    const rows = targetStudents.map((s) => {
      const counts = { present: 0, absent: 0, late: 0 };
      Object.entries(data.attendance || {}).forEach(([date, day]) => {
        if (date >= start && date <= end && !isWeekendStr(date)) {
          const status = day[s.id];
          if (status) counts[status === "excused" ? "absent" : status] += 1;
        }
      });
      return { studentId: s.id, studentName: s.name, ...counts };
    });

    const totals = rows.reduce((acc, r) => ({
      present: acc.present + r.present, absent: acc.absent + r.absent, late: acc.late + r.late
    }), { present: 0, absent: 0, late: 0 });
    const denom = totals.present + totals.absent + totals.late;
    const rate = denom > 0 ? Math.round((totals.present / denom) * 100) : 0;

    const report = {
      id: uid(), kind: "attendance", grade: form.grade || "All grades",
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(),
      rows, totals, rate
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateAssessmentReport = () => {
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";
    const subjectFilter = form.subject.trim().toLowerCase();

    const matches = (data.assessments || []).filter((a) => {
      if (a.date < start || a.date > end) return false;
      if (form.grade && a.grade !== form.grade) return false;
      if (subjectFilter && !(a.subject || "").toLowerCase().includes(subjectFilter)) return false;
      return true;
    });

    const levelCounts = {};
    ASSESS_LEVELS.forEach((l) => { levelCounts[l] = 0; });
    matches.forEach((a) => {
      if (a.rows && a.rows.length > 0) {
        a.rows.forEach((r) => { levelCounts[r.level] = (levelCounts[r.level] || 0) + 1; });
      } else if (a.level) {
        levelCounts[a.level] = (levelCounts[a.level] || 0) + 1;
      }
    });

    const report = {
      id: uid(), kind: "assessment", grade: form.grade || "All grades", subject: form.subject,
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(),
      levelCounts, entries: matches
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateBehaviorReport = () => {
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";

    const matches = (data.behaviorIncidents || []).filter((i) => {
      if (i.date < start || i.date > end) return false;
      if (form.grade && i.grade !== form.grade) return false;
      return true;
    });

    const typeCounts = { Positive: 0, Concern: 0 };
    const categoryCounts = {};
    matches.forEach((i) => {
      typeCounts[i.type] = (typeCounts[i.type] || 0) + 1;
      categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
    });

    const report = {
      id: uid(), kind: "behavior", grade: form.grade || "All grades",
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(),
      typeCounts, categoryCounts, entries: matches
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateTranscriptReport = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before generating.");
      return;
    }
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";

    const entries = (data.gradeEntries || [])
      .filter((e) => e.studentId === student.id && e.date >= start && e.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));

    const graded = entries.filter((e) => GPA_POINTS[e.letter] !== undefined);
    const gpa = graded.length > 0
      ? (graded.reduce((sum, e) => sum + GPA_POINTS[e.letter], 0) / graded.length).toFixed(2)
      : null;

    const report = {
      id: uid(), kind: "transcript", studentId: student.id, studentName: student.name, grade: student.grade,
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(), entries, gpa
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const generateStandardsReport = () => {
    const start = form.periodStart || "0000-00-00";
    const end = form.periodEnd || "9999-99-99";

    const matches = (data.assessments || []).filter((a) => {
      if (!a.standardId) return false;
      if (a.date < start || a.date > end) return false;
      if (form.grade && a.grade !== form.grade) return false;
      return true;
    });

    const byStandard = {};
    matches.forEach((a) => {
      const label = a.standardLabel || "Unnamed standard";
      if (!byStandard[label]) byStandard[label] = { Emerging: 0, Developing: 0, Proficient: 0, Extending: 0, entries: [] };
      if (a.rows && a.rows.length > 0) {
        a.rows.forEach((r) => { byStandard[label][r.level] = (byStandard[label][r.level] || 0) + 1; });
      } else if (a.level) {
        byStandard[label][a.level] = (byStandard[label][a.level] || 0) + 1;
      }
      byStandard[label].entries.push(a);
    });

    const report = {
      id: uid(), kind: "standards", grade: form.grade || "All grades",
      periodStart: form.periodStart, periodEnd: form.periodEnd, createdDate: todayStr(),
      byStandard
    };
    persist({ ...data, reports: [...(data.reports || []), report] });
    setShowForm(false);
    setViewingId(report.id);
  };

  const handleGenerate = () => {
    if (isTeacherScoped && kind !== "student" && kind !== "transcript" && !form.grade) {
      setFormError("Please choose one of your grades.");
      return;
    }
    if (kind === "student") generateStudentReport();
    else if (kind === "attendance") generateAttendanceReport();
    else if (kind === "assessment") generateAssessmentReport();
    else if (kind === "behavior") generateBehaviorReport();
    else if (kind === "transcript") generateTranscriptReport();
    else generateStandardsReport();
  };

  const removeReport = (id) => {
    persist({ ...data, reports: (data.reports || []).filter((r) => r.id !== id) });
    setViewingId(null);
  };

  const kindLabel = (r) => {
    const k = r.kind || "student";
    return isParent ? tLabel(t, "reports.kind.", k) : REPORT_KINDS.find((x) => x.id === k).label;
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>{isParent ? t("reports.parentTitle") : "Reports"}</h1>
        {!isParent && <button className="bsf-btn" onClick={() => openForm("student")} disabled={data.students.length === 0}><Plus size={16} /> Generate</button>}
      </div>
      {!isParent && <TermReportsStaff profile={profile} data={data} />}
      {!isParent && <h2 style={{ margin: "8px 0 10px" }}>Other reports</h2>}
      {!isParent && data.students.length === 0 && <p className="bsf-empty">Add students first, then generate reports here.</p>}
      {isParent && (
        <section className="bsf-list">
          {(data.students || []).filter((s) => linkedIds.includes(s.id)).map((s) => (
            <TermReportsFamily key={s.id} hubStudentId={s.id} data={data} />
          ))}
        </section>
      )}
      {isParent && reports.length === 0 && <p className="bsf-empty">{t("reports.emptyChild")}</p>}

      <section className="bsf-list">
        {!isParent && reports.length === 0 && <p className="bsf-empty">No reports generated yet.</p>}
        {reports.map((r) => (
          <div key={r.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setViewingId(r.id)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{kindLabel(r)}</span>
                <span className="bsf-muted">{isParent ? formatDateLong(r.createdDate, language) : r.createdDate}</span>
              </div>
              <strong>{r.kind === "student" || !r.kind || (isParent && r.kind === "transcript") ? r.studentName : r.grade}</strong>
              <p className="bsf-muted">
                {isParent
                  ? `${gradeLabel(r.grade, language)} · ${t("common.dateRange", { start: r.periodStart ? formatDateLong(r.periodStart, language) : "?", end: r.periodEnd ? formatDateLong(r.periodEnd, language) : "?" })}`
                  : <>{r.kind === "student" || !r.kind ? r.grade : (r.kind === "assessment" && r.subject ? r.subject : "")}{" "}· {r.periodStart || "?"} to {r.periodEnd || "?"}</>}
              </p>
            </div>
            {!isParent && <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeReport(r.id); }} aria-label="Remove"><Trash2 size={16} /></button>}
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title="Generate a report" onClose={() => setShowForm(false)}>
          <Field label="Report type">
            <div className="bsf-chiprow">
              {REPORT_KINDS.map((k) => (
                <button key={k.id} type="button" className={`bsf-chip ${kind === k.id ? "active" : ""}`} onClick={() => setKind(k.id)}>{k.label}</button>
              ))}
            </div>
          </Field>

          {(kind === "student" || kind === "transcript") && (
            <Field label="Student">
              <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
                <option value="">Choose a student</option>
                {data.students.filter((s) => canSeeGrade(s.grade)).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
              </select>
            </Field>
          )}
          {kind === "student" && (
            <Field label="Template">
              <select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>
                {templates.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          )}

          {(kind === "attendance" || kind === "assessment" || kind === "behavior" || kind === "standards") && (
            <Field label="Grade">
              <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                <option value="">{isTeacherScoped ? "Choose a grade" : "All grades"}</option>
                {GRADES.filter(canSeeGrade).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          )}

          {kind === "assessment" && (
            <Field label="Subject (optional)">
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math" />
            </Field>
          )}

          <div className="bsf-two-col">
            <Field label="Period start">
              <input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} />
            </Field>
            <Field label="Period end">
              <input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} />
            </Field>
          </div>

          {kind === "student" && (
            <Field label="Teacher comments">
              <textarea rows={4} value={form.teacherComments} onChange={(e) => setForm({ ...form, teacherComments: e.target.value })} placeholder="Overall summary for this period" />
              <button
                type="button"
                className="bsf-textbtn"
                style={{ marginTop: 6 }}
                disabled={!form.studentId}
                onClick={() => {
                  const student = data.students.find((s) => s.id === form.studentId);
                  if (!student) return;
                  setForm({ ...form, teacherComments: suggestReportComment(data, student.id, student.name, form.periodStart, form.periodEnd) });
                }}
              >
                Suggest a starter draft, from this student's actual grades and attendance
              </button>
            </Field>
          )}

          <p className="bsf-muted" style={{ marginBottom: 10 }}>
            {kind === "student" && "Attendance, assessments, and portfolio entries within this date range will be pulled in automatically."}
            {kind === "attendance" && "Present, absent, and late counts for the selected grade and period will be compiled automatically."}
            {kind === "assessment" && "Assessment levels for the selected grade, subject, and period will be compiled automatically."}
            {kind === "behavior" && "Positive notes and concerns for the selected grade and period will be compiled automatically."}
            {kind === "transcript" && "Every grade entry for this student in the selected period, plus a GPA average, will be compiled automatically. Leave dates blank for their full history."}
            {kind === "standards" && "Assessments linked to a standard for the selected grade and period will be grouped by standard automatically."}
          </p>
          <button className="bsf-btn bsf-btn-block" onClick={handleGenerate}>Generate report</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {viewingReport && (
        <ReportViewModal report={viewingReport} data={data} onClose={() => setViewingId(null)} onRemove={isParent ? null : removeReport} />
      )}
    </div>
  );
}

export { ReportsTab };

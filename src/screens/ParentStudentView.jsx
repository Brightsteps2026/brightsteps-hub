import { useState, useEffect, useMemo } from "react";
import { WeeklyUpdatesFamily, WeeklyHistoryStaff } from "../WeeklyUpdates";
import { DailyReportFamily } from "../DailyReport";
import { useLanguage } from "../lib/i18n";
import AttachmentField from "../AttachmentField";
import { DEFAULT_SETTINGS, isStaffOnlyEvent } from "../data/constants";
import { todayStr, formatDateLong, gradeLabel, tLabel, attendanceCountsForRange } from "../lib/format";
import { EventRow, Modal, StudentThumb } from "../ui/common";
import { LinkedText } from "../ui/LinkedText";
import { StudentMessages, AbsenceNotices } from "./Messages";
import { pending } from "../data/pending";
import { TermReportsFamily } from "../TermReports";
import { useAssignmentsDue } from "./Assignments";
import { FamilyGrades } from "../FamilyGrades";

function FamilyViewModal({ student, data, onClose, hideContacts = false, showMessages = false }) {
  const today = todayStr();
  const settings = data.settings || DEFAULT_SETTINGS;
  const terms = settings.terms || DEFAULT_SETTINGS.terms;

  const attendanceSummary = useMemo(
    () => attendanceCountsForRange(data.attendance, student.id),
    [data.attendance, student.id]
  );

  const termSummaries = useMemo(
    () => terms
      .filter((term) => term.startDate && term.endDate)
      .map((term) => ({ ...term, counts: attendanceCountsForRange(data.attendance, student.id, term.startDate, term.endDate) })),
    [data.attendance, student.id, terms]
  );

  const portfolioEntries = [...data.portfolio]
    .filter((p) => p.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const events = [...(data.events || [])]
    .filter((e) => (e.endDate || e.date) >= today)
    .filter((e) => !isStaffOnlyEvent(e))
    .filter((e) => !e.grades || e.grades.length === 0 || e.grades.includes(student.grade))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const assignmentsDue = useAssignmentsDue(student.grade);

  const announcements = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <Modal title={`${student.name}'s family view`} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <StudentThumb photo={student.photo} />
        <p className="bsf-muted" style={{ margin: 0 }}>
          This is a preview of what a parent would see for {student.name}. It isn't a separate login yet.
        </p>
      </div>

      {hideContacts ? (
        student.allergies ? (
          <section className="bsf-card">
            <p className="bsf-alert-note">Allergies: {student.allergies}</p>
          </section>
        ) : null
      ) : (
      <section className="bsf-card">
        <h2>Guardians</h2>
        {(student.guardian1Name || student.guardianName) ? (
          <p>
            {student.guardian1Name || student.guardianName}
            {student.guardian1Relationship ? ` (${student.guardian1Relationship})` : ""}
            {(student.guardian1Phone || student.guardianContact) ? ` · ${student.guardian1Phone || student.guardianContact}` : ""}
          </p>
        ) : (
          <p className="bsf-empty">No guardian on file yet.</p>
        )}
        {student.guardian2Name && (
          <p>
            {student.guardian2Name}
            {student.guardian2Relationship ? ` (${student.guardian2Relationship})` : ""}
            {student.guardian2Phone ? ` · ${student.guardian2Phone}` : ""}
          </p>
        )}
        {(student.allergies || student.medicalConditions) && (
          <p className="bsf-alert-note">
            {student.allergies ? `Allergies: ${student.allergies}. ` : ""}
            {student.medicalConditions ? `Medical: ${student.medicalConditions}` : ""}
          </p>
        )}
      </section>
      )}

      <section className="bsf-card">
        <h2>Reports</h2>
        {(data.reports || []).filter((r) => r.studentId === student.id).length === 0 && (
          <p className="bsf-empty">No reports generated yet.</p>
        )}
        {(data.reports || [])
          .filter((r) => r.studentId === student.id)
          .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
          .map((r) => (
            <div key={r.id} className="bsf-row">
              <span className="bsf-tag">{r.template}</span>
              <div>
                <strong>{r.periodStart || "?"} to {r.periodEnd || "?"}</strong>
                <p>{r.createdDate}</p>
              </div>
            </div>
          ))}
      </section>

      <WeeklyHistoryStaff student={student} />

      <section className="bsf-card">
        <h2>Attendance</h2>
        <p className="bsf-muted">
          {attendanceSummary.present} present · {attendanceSummary.absent} absent · {attendanceSummary.late} late this year
        </p>
        {termSummaries.length > 0 && (
          <div className="bsf-termsummary">
            {termSummaries.map((term) => (
              <div key={term.name} className="bsf-termsummary-row">
                <span className="bsf-tag">{term.name}</span>
                <span className="bsf-muted">
                  {term.counts.present} present · {term.counts.absent} absent · {term.counts.late} late
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bsf-card">
        <h2>Upcoming for {student.grade}</h2>
        {events.length === 0 && <p className="bsf-empty">Nothing scheduled yet.</p>}
        {events.map((e) => (<EventRow key={e.id} event={e} />))}
      </section>

      <section className="bsf-card">
        <h2>Assignments due</h2>
        {assignmentsDue.length === 0 && <p className="bsf-empty">Nothing assigned right now.</p>}
        {assignmentsDue.map((a) => (
          <div key={a.id} className="bsf-row">
            {a.subject && <span className="bsf-tag">{a.subject}</span>}
            <div>
              <strong>{a.title}</strong>
              {a.dueDate && <p className="bsf-muted">Due {a.dueDate}</p>}
              {a.description && <p>{a.description}</p>}
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Portfolio</h2>
        {portfolioEntries.length === 0 && <p className="bsf-empty">No portfolio entries yet.</p>}
        {portfolioEntries.map((p) => (
          <div key={p.id} className="bsf-row bsf-portfolio-row">
            <div className="bsf-row-head">
              <span className="bsf-portfolio-tags">
                <span className="bsf-tag">{p.tag}</span>
                <span className={`bsf-author-badge ${p.author === "student" ? "student" : "teacher"}`}>
                  {p.author === "student" ? "Student reflection" : "Teacher note"}
                </span>
              </span>
              <span className="bsf-muted">{formatDateLong(p.date, "en")}</span>
            </div>
            {p.note && <p>{p.note}</p>}
            {(p.files || []).length > 0 && (
              <AttachmentField folder="portfolio" files={p.files} onChange={() => {}} readOnly />
            )}
          </div>
        ))}
      </section>

      <FamilyGrades student={student} terms={data?.settings?.terms} />

      <section className="bsf-card">
        <h2>Family updates</h2>
        {announcements.length === 0 && <p className="bsf-empty">Nothing posted yet.</p>}
        {announcements.map((a) => (
          <div key={a.id} className="bsf-row">
            <div>
              <strong>{a.titleEn}</strong>
              <LinkedText text={a.bodyEn} />
            </div>
          </div>
        ))}
      </section>
      {showMessages && (
        <section className="bsf-section">
          {/* Read-only for learning assistants: they can't post, so persist is never needed. */}
          <StudentMessages student={student} data={data} persist={() => Promise.resolve(false)} />
        </section>
      )}
    </Modal>
  );
}

function ParentStudentView({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const linkedIds = profile?.student_ids || [];
  const myStudents = data.students.filter((s) => linkedIds.includes(s.id));
  const [activeChildId, setActiveChildId] = useState(() => {
    const id = pending.childProfileId;
    pending.childProfileId = null;
    return id;
  });
  // Opened from a message in the bell: show that child and scroll to the messages.
  const [scrollToMessages, setScrollToMessages] = useState(() => {
    const wanted = pending.messageStudentId;
    pending.messageStudentId = null;
    return !!wanted;
  });
  useEffect(() => {
    const open = (e) => { pending.messageStudentId = null; pending.childProfileId = null; setActiveChildId(e.detail); setScrollToMessages(true); };
    window.addEventListener("bs-open-thread", open);
    return () => window.removeEventListener("bs-open-thread", open);
  }, []);
  useEffect(() => {
    if (!scrollToMessages) return;
    const t = setTimeout(() => {
      const el = document.getElementById("bs-child-messages");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToMessages(false);
    }, 150);
    return () => clearTimeout(t);
  }, [scrollToMessages, activeChildId]);
  // Opened from the weekly update card on the Dashboard: scroll to Weekly updates.
  useEffect(() => {
    if (!pending.scrollToWeekly) return;
    pending.scrollToWeekly = false;
    let tries = 0;
    const t = setInterval(() => {
      const el = document.getElementById("bs-weekly-updates");
      tries += 1;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (el || tries > 20) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [activeChildId]);
  const today = todayStr();

  const activeStudent = myStudents.find((s) => s.id === activeChildId) || myStudents[0];
  const settings = data.settings || DEFAULT_SETTINGS;
  const terms = settings.terms || DEFAULT_SETTINGS.terms;

  const attendanceSummary = useMemo(
    () => (activeStudent ? attendanceCountsForRange(data.attendance, activeStudent.id) : { present: 0, absent: 0, late: 0 }),
    [data.attendance, activeStudent]
  );

  const termSummaries = useMemo(() => {
    if (!activeStudent) return [];
    return terms
      .filter((term) => term.startDate && term.endDate)
      .map((term) => ({ ...term, counts: attendanceCountsForRange(data.attendance, activeStudent.id, term.startDate, term.endDate) }));
  }, [data.attendance, activeStudent, terms]);

  const billingHistory = activeStudent
    ? [...(data.billing || [])].filter((b) => b.studentId === activeStudent.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const billingBalance = billingHistory.reduce((sum, b) => sum + (b.type === "charge" ? Number(b.amount || 0) : -Number(b.amount || 0)), 0);

  const portfolioEntries = activeStudent
    ? [...data.portfolio].filter((p) => p.studentId === activeStudent.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const events = activeStudent
    ? [...(data.events || [])]
        .filter((e) => (e.endDate || e.date) >= today)
        .filter((e) => !isStaffOnlyEvent(e))
        .filter((e) => !e.grades || e.grades.length === 0 || e.grades.includes(activeStudent.grade))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4)
    : [];

  const assignmentsDue = useAssignmentsDue(activeStudent?.grade);

  const reports = activeStudent
    ? (data.reports || []).filter((r) => r.studentId === activeStudent.id).sort((a, b) => b.createdDate.localeCompare(a.createdDate))
    : [];

  if (myStudents.length === 0) {
    return (
      <div className="bsf-screen">
        <div className="bsf-screen-head"><h1>{t("child.title")}</h1></div>
        <p className="bsf-empty">{t("dash.noChildLinked")}</p>
      </div>
    );
  }

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <div>
          <h1>{t("child.title")}</h1>
          {profile?.full_name && <p className="bsf-muted" style={{ marginTop: 2 }}>{t("settings.signedInAs")} {profile.full_name}</p>}
        </div>
      </div>

      <AbsenceNotices profile={profile} studentId={activeStudent?.id} />
      {myStudents.length > 1 && (
        <div className="bsf-card" style={{ display: "flex", gap: 10, overflowX: "auto", padding: 12 }}>
          {myStudents.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveChildId(s.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer", flexShrink: 0,
                opacity: (activeStudent && activeStudent.id === s.id) ? 1 : 0.5
              }}
            >
              <div style={{
                border: (activeStudent && activeStudent.id === s.id) ? "2px solid #801524" : "2px solid transparent",
                borderRadius: "50%", padding: 2
              }}>
                <StudentThumb photo={s.photo} />
              </div>
              <span style={{ fontSize: 12 }}>{s.firstName || s.name}</span>
            </button>
          ))}
        </div>
      )}

      {activeStudent && (
        <>
          <section className="bsf-card">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <StudentThumb photo={activeStudent.photo} />
              <div>
                <strong>{activeStudent.name}</strong>
                <p className="bsf-muted">{gradeLabel(activeStudent.grade, language)}</p>
              </div>
            </div>
            {activeStudent.allergies && <p className="bsf-alert-note">{t("dash.allergies")} {activeStudent.allergies}</p>}
            {activeStudent.medicalConditions && <p className="bsf-alert-note">{t("dash.medical")} {activeStudent.medicalConditions}</p>}
          </section>

          <DailyReportFamily student={activeStudent} language={language} />

          <WeeklyUpdatesFamily student={activeStudent} language={language} />

          <section className="bsf-card">
            <h2>{t("nav.attendance")}</h2>
            <p className="bsf-muted">
              {t("dash.attendanceYear", attendanceSummary)}
            </p>
            {termSummaries.length > 0 && (
              <div className="bsf-termsummary">
                {termSummaries.map((term) => (
                  <div key={term.name} className="bsf-termsummary-row">
                    <span className="bsf-tag">{language === "fr" && /^Term \d+$/.test(term.name || "") ? term.name.replace("Term", "Trimestre") : term.name}</span>
                    <span className="bsf-muted">
                      {t("dash.attendanceCounts", term.counts)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bsf-card">
            <h2>{t("child.upcomingFor", { grade: gradeLabel(activeStudent.grade, language) })}</h2>
            {events.length === 0 && <p className="bsf-empty">{t("dash.nothingScheduled")}</p>}
            {events.map((e) => (<EventRow key={e.id} event={e} />))}
          </section>

          <section className="bsf-card">
            <h2>{t("child.assignmentsDue")}</h2>
            {assignmentsDue.length === 0 && <p className="bsf-empty">{t("child.nothingAssigned")}</p>}
            {assignmentsDue.map((a) => (
              <div key={a.id} className="bsf-row">
                {a.subject && <span className="bsf-tag">{a.subject}</span>}
                <div>
                  <strong>{a.title}</strong>
                  {a.dueDate && <p className="bsf-muted">{t("common.due", { date: formatDateLong(a.dueDate, language) })}</p>}
                  {a.description && <p>{a.description}</p>}
                </div>
              </div>
            ))}
          </section>

          <section className="bsf-card">
            <h2>{t("portfolio.title")}</h2>
            {portfolioEntries.length === 0 && <p className="bsf-empty">{t("child.noPortfolio")}</p>}
            {portfolioEntries.map((p) => (
              <div key={p.id} className="bsf-row bsf-portfolio-row">
                <div className="bsf-row-head">
                  <span className="bsf-portfolio-tags">
                    <span className="bsf-tag">{tLabel(t, "tag.", p.tag)}</span>
                    <span className={`bsf-author-badge ${p.author === "student" ? "student" : "teacher"}`}>
                      {p.author === "student" ? t("portfolio.studentReflection") : t("portfolio.teacherNote")}
                    </span>
                  </span>
                  <span className="bsf-muted">{formatDateLong(p.date, language)}</span>
                </div>
                {p.note && <p>{p.note}</p>}
                {(p.files || []).length > 0 && (
                  <AttachmentField folder="portfolio" files={p.files} onChange={() => {}} readOnly />
                )}
              </div>
            ))}
          </section>

          <FamilyGrades student={activeStudent} terms={data?.settings?.terms} />

          <section className="bsf-card">
            <h2>{t("nav.reports")}</h2>
            <TermReportsFamily hubStudentId={activeStudent.id} data={data} otherCount={reports.length} emptyText={t("child.noReports")} />
            {reports.map((r) => (
              <div key={r.id} className="bsf-row">
                <span className="bsf-tag">{r.template}</span>
                <div>
                  <strong>{t("common.dateRange", { start: r.periodStart ? formatDateLong(r.periodStart, language) : "?", end: r.periodEnd ? formatDateLong(r.periodEnd, language) : "?" })}</strong>
                  <p>{formatDateLong(r.createdDate, language)}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="bsf-card" id="bs-child-messages">
            <StudentMessages student={activeStudent} data={data} persist={persist} />
          </section>
        </>
      )}
    </div>
  );
}

export { FamilyViewModal, ParentStudentView };

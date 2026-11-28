import { useState, useEffect } from "react";
import { LayoutDashboard, Users, BookOpen, ClipboardList, Megaphone, CheckSquare, ClipboardCheck, Settings as SettingsIcon, Calendar as CalendarIcon, UserCheck, Menu as MenuIcon, UserPlus, FileText, FileCheck, Percent, Briefcase, FolderOpen, Award, LogOut, Utensils, Bus, Banknote, NotebookPen, Clock3, Target, Baby, Handshake, MessageSquare } from "lucide-react";
import { useAuth } from "./LoginGate";
import { LanguageProvider, useLanguage } from "./lib/i18n";
import CanteenTab from "./CanteenTab";
import FeesTab, { useFeesAccess } from "./FeesTab";
import BusTab, { useBusAccess, BusLiveBanner } from "./BusTab";
import IncidentsTab, { IncidentsIcon } from "./IncidentsTab";
import LeaveTab, { LeaveIcon } from "./LeaveTab";
import StaffFilesTab, { StaffFilesIcon } from "./StaffFilesTab";
import WeeklyUpdatesTab from "./WeeklyUpdates";
import DailyLogTab, { staffDailyGrades } from "./DailyReport";
import MeetingsTab, { meetingGrades } from "./Meetings";
import StaffCheckinTab, { CheckinIcon, CheckinBanner } from "./StaffCheckinTab";
import SchoolGradebook from "./SchoolGradebook";
import { FamilyGradesTab } from "./FamilyGrades";
import { GRADES, DEFAULT_SETTINGS, ACTIVITY_AREA_LABELS } from "./data/constants";
import { useSchoolData } from "./data/useSchoolData";
import { uid } from "./lib/format";
import { Modal, TabErrorBoundary } from "./ui/common";
import { Dashboard } from "./screens/Dashboard";
import { ParentStudentView } from "./screens/ParentStudentView";
import { StudentMessages, useUnreadNoticeCount, useUnreadThreads, NotificationBell } from "./screens/Messages";
import { resyncPush } from "./lib/push";
import { StudentsTab } from "./screens/Students";
import { InboxTab, ParentMessagesTab } from "./screens/Inbox";
import { ClassesTab } from "./screens/Classes";
import { PortfolioTab } from "./screens/Portfolio";
import { PlanningTab } from "./screens/Planning";
import { UpdatesTab } from "./screens/Updates";
import { AttendanceTab } from "./screens/Attendance";
import { CalendarTab } from "./screens/Calendar";
import { AdmissionsTab } from "./screens/Admissions";
import { AssignmentsTab } from "./screens/Assignments";
import { TimetableTab } from "./screens/Timetable";
import { StandardsTab } from "./screens/Standards";
import { ReportsTab } from "./screens/Reports";
import { BehaviorTab } from "./screens/Behavior";
import { GradebookTab } from "./screens/Gradebook";
import { StaffTab } from "./screens/Staff";
import { ResourcesTab } from "./screens/Resources";
import { AccreditationTab } from "./screens/Accreditation";
import { SettingsModal } from "./screens/Settings";
import { pending } from "./data/pending";
// The Hub's styles live in styles.css; they are added on the page below, in the same place as before.
import appStyles from "./styles.css?raw";

export default function BrightStepsHub() {
  const { profile } = useAuth();
  return (
    <LanguageProvider role={profile?.role}>
      <BrightStepsHubInner />
    </LanguageProvider>
  );
}

function BrightStepsHubInner() {
  const { profile, signOut } = useAuth();
  const { data, persist: rawPersist, loaded, saving, loadError, saveError, retrySave } = useSchoolData();
  const { t, language, canSwitch, setLanguage } = useLanguage();
  const [tab, setTab] = useState("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isParent = profile?.role === "parent";
  const isAdmin = profile?.role === "admin";
  const isLearningAssistant = profile?.role === "learning_assistant";
  const isAccountant = profile?.role === "accountant";
  const isViewer = profile?.role === "viewer";
  const isStudent = profile?.role === "student";
  // A Viewer can open and browse every screen in the app, but this makes it
  // impossible for anything they do to actually save, no matter which button,
  // form, or screen they're on. This is enforced once, centrally, rather than
  // trying to individually lock every Add/Edit/Delete control across the app.
  const persist = isViewer
    ? () => { window.alert("Viewer accounts can see everything, but can't make any changes."); return Promise.resolve(false); }
    : (newData) => {
        const changedAreas = Object.keys(newData)
          .filter((key) => key !== "activityLog" && newData[key] !== data[key])
          .map((key) => ACTIVITY_AREA_LABELS[key] || key);
        if (changedAreas.length === 0) {
          return rawPersist(newData);
        }
        const entry = {
          id: uid(),
          timestamp: new Date().toISOString(),
          actorName: profile?.full_name || profile?.email || "Someone",
          actorRole: profile?.role || "unknown",
          areas: changedAreas
        };
        const existingLog = newData.activityLog || data.activityLog || [];
        return rawPersist({ ...newData, activityLog: [...existingLog, entry].slice(-500) });
      };
  const myLinkedStudent = isStudent ? data.students.find((s) => (profile.student_ids || [])[0] === s.id) : null;
  const isUpperStudent = !!myLinkedStudent && GRADES.indexOf(myLinkedStudent.grade) >= GRADES.indexOf("Grade 3");
  const PARENT_HIDDEN_TABS = ["daily", "conferences", "standards", "weekly", "checkin", "leave", "classes", "staff", "admissions", "behavior", "accreditation", "planning", "gradebook"]; // timetable shown to families from 24 Oct 2026 (Myri approved)
  const ADMIN_ONLY_TABS = ["accreditation","staff","admissions"];
  // A learning assistant supports specific grades day to day; they don't need
  // enrollment, staffing, or school-wide admin tools, just the classroom-facing ones.
  const LEARNING_ASSISTANT_ALLOWED_TABS = ["messages", "bus", "daily", "conferences", "weekly", "checkin", "leave", "gradebook", "dashboard", "students", "canteen", "attendance", "portfolio", "assessment", "classes", "calendar", "timetable", "standards", "assignments", "updates", "resources"];
  // An accountant only ever needs billing, nothing about students' academic
  // records, behavior, or staff information.
  const ACCOUNTANT_ALLOWED_TABS = ["dashboard", "checkin", "leave", "stafffiles", "bus", "fees"]; // Billing tab removed 4 Nov 2026 (Myri)
  const RESTRICTED_TEACHER_TABS = ["messages", "bus", "daily", "conferences", "weekly", "checkin", "leave", "stafffiles", "dashboard", "students", "canteen", "attendance", "portfolio", "assessment", "planning", "assignments", "timetable", "standards", "reports", "calendar", "incidents", "updates", "resources"];
  // Set per teacher by the admin in the database (profiles.limited_access).
  const isRestrictedTeacher = profile?.role === "teacher" && profile?.limited_access === true;
  // Specialist teachers (swimming, PE, music...) don't write weekly updates (Myri, 4 Nov 2026).
  // Also anyone the admin marked as not writing weekly updates (profiles.weekly_exempt, e.g. Mr Jonathan).
  const isSpecialist = (profile?.role === "teacher" && Array.isArray(profile?.subjects) && profile.subjects.length > 0) || profile?.weekly_exempt === true;
  // Pre-N through Grade 2: reflections only. Grade 3 and up: can also see (not edit)
  // their own attendance and grades.
  const STUDENT_ALLOWED_TABS = isUpperStudent ? ["portfolio", "attendance", "gradebook", "assignments", "assessment", "messages"] : ["portfolio"];
  // Suspended for unpaid fees (27 Nov 2026): the database stops sending that child's
  // grades, reports, portfolio, attendance, etc. If every child is suspended, the
  // family keeps only Dashboard, My child (messages), School fees, Calendar,
  // Communication and Resources.
  const suspendedKids = isParent ? (data.students || []).filter((s) => s.feeSuspended) : [];
  const allSuspended = isParent && suspendedKids.length > 0 && suspendedKids.length === (data.students || []).length;
  const SUSPENDED_HIDDEN_TABS = ["attendance", "portfolio", "assessment", "assignments", "timetable", "canteen", "bus", "reports"];
  const unreadThreads = useUnreadThreads(profile, data);
  // School fees: only Myriam (office) and parents whose family account she has shared.
  const feesAccess = useFeesAccess(profile);
  const canSeeFees = feesAccess.office || feesAccess.family;
  // School bus: the admin, and parents with a child switched on for the bus (6 Nov 2026).
  const busAccess = useBusAccess(profile);
  const canSeeBus = busAccess.office || busAccess.family || busAccess.helper;
  useEffect(() => {
    const go = (e) => { setTab(e.detail); setShowMenu(false); };
    window.addEventListener("bs-goto-tab", go);
    return () => window.removeEventListener("bs-goto-tab", go);
  }, []);
  // Phone notifications: re-confirm this phone with the server each time the Hub opens.
  useEffect(() => { if (profile?.id) resyncPush(); }, [profile?.id]);
  const unreadMessageCount = unreadThreads.reduce((n, t) => n + t.count, 0);
  const unreadNoticeCount = useUnreadNoticeCount(profile);
  const unreadCount = unreadMessageCount + unreadNoticeCount;

  useEffect(() => {
    if (isParent && PARENT_HIDDEN_TABS.includes(tab)) setTab("dashboard");
    if (allSuspended && SUSPENDED_HIDDEN_TABS.includes(tab)) setTab("dashboard");
    if (!isAdmin && !isViewer && ADMIN_ONLY_TABS.includes(tab)) setTab("dashboard");
    if (tab === "billing") setTab("dashboard"); // Billing tab removed 4 Nov 2026
    if (tab === "weekly" && isSpecialist) setTab("dashboard");
    if (isLearningAssistant && !LEARNING_ASSISTANT_ALLOWED_TABS.includes(tab)) setTab("dashboard");
    if (isAccountant && !ACCOUNTANT_ALLOWED_TABS.includes(tab)) setTab("dashboard");
    if (isRestrictedTeacher && !RESTRICTED_TEACHER_TABS.includes(tab)) setTab("dashboard");
    if (isStudent && !STUDENT_ALLOWED_TABS.includes(tab)) setTab("portfolio");
    if (!isStudent && !isParent && tab === "gradebook") setTab("assessment");
    if (tab === "daily" && staffDailyGrades(profile).length === 0) setTab("dashboard");
    if (tab === "conferences" && meetingGrades(profile).length === 0) setTab("dashboard");
    if (tab === "standards") setTab("assessment");
    if (tab === "stafffiles" && !isAdmin && !isAccountant) setTab("dashboard");
    if (tab === "fees" && !canSeeFees) setTab("dashboard");
    if (tab === "bus" && !canSeeBus) setTab("dashboard");
  }, [isParent, isAdmin, isLearningAssistant, isAccountant, isStudent, tab, profile, canSeeFees, canSeeBus, allSuspended]);

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 380 }}>
          <h2 style={{ color: "#801524" }}>{t("loadError.title")}</h2>
          <p style={{ color: "#3B4A4C" }}>
            {t("loadError.body")}
          </p>
          <button className="bsf-btn" onClick={() => window.location.reload()}>{t("loadError.reload")}</button>
        </div>
      </div>
    );
  }

  // While the school data is loading, show a simple loading screen instead of
  // an empty dashboard that looks like everything is missing.
  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "#FBF7F3", fontFamily: "'Work Sans', system-ui, sans-serif" }}>
        <img src="/logo.png" alt="" style={{ width: 160, maxWidth: "45vw", height: "auto" }} />
        <p style={{ color: "#5F6B6D", fontSize: 15, margin: 0 }}>{t("top.loading")}</p>
      </div>
    );
  }

  const branding = (data.settings || DEFAULT_SETTINGS).branding;

  const allSectionsRaw = [
    { id: "dashboard", label: "Dashboard", navKey: "nav.dashboard", icon: LayoutDashboard, category: "core" },
    { id: "students", label: "Students", navKey: "nav.students", icon: Users, category: "classroom" },
    // Staff Messages inbox (Myri, 28 Nov 2026). Parents keep messages on their child's page.
    { id: "messages", label: "Messages", navKey: "nav.messages", icon: MessageSquare, category: "core", hidden: isStudent || isAccountant || isViewer }, // parents too from 28 Nov 2026
    { id: "classes", label: "Classes", navKey: "nav.classes", icon: UserCheck, category: "classroom" },
    { id: "staff", label: "Staff", navKey: "nav.staff", icon: Briefcase, category: "hr" },
    { id: "checkin", label: "Staff check-in", navKey: "nav.checkin", icon: CheckinIcon, category: "hr" },
    { id: "leave", label: "Leave requests", navKey: "nav.leave", icon: LeaveIcon, category: "hr" },
    // Staff files (Myri, 20 Nov 2026): Director and HR only. Staff must not see or know about them.
    { id: "stafffiles", label: "Staff files", navKey: "nav.staffFiles", icon: StaffFilesIcon, category: "hr", hidden: !(isAdmin || isAccountant) },
    { id: "attendance", label: "Attendance", navKey: "nav.attendance", icon: CheckSquare, category: "core" },
    { id: "portfolio", label: "Portfolio", navKey: "nav.portfolio", icon: BookOpen, category: "core" },
    { id: "gradebook", label: "Gradebook", navKey: "nav.gradebook", icon: Percent, category: "classroom" },
    { id: "planning", label: "Curriculum", navKey: "nav.planning", icon: ClipboardList, category: "classroom" },
    { id: "calendar", label: "Calendar", navKey: "nav.calendar", icon: CalendarIcon, category: "office" },
    { id: "timetable", label: "Timetable", navKey: "nav.timetable", icon: Clock3, category: "classroom" },
    { id: "standards", label: "Standards", navKey: "nav.standards", icon: Target, category: "classroom", hidden: true }, // hidden 30 Oct 2026: standards move into Assessment and Curriculum
    { id: "canteen", label: "Canteen", navKey: "nav.canteen", icon: Utensils, category: "office" },
    { id: "incidents", label: "Incidents", navKey: "nav.incidents", icon: IncidentsIcon, category: "classroom" },
    { id: "admissions", label: "Admissions", navKey: "nav.admissions", icon: UserPlus, category: "office" },
    { id: "assessment", label: "Assessment", navKey: "nav.assessment", icon: ClipboardCheck, category: "classroom" },
    { id: "weekly", label: "Weekly updates", navKey: "nav.weekly", icon: NotebookPen, category: "classroom" },
    // Pre-N daily log: only for the admin and staff of a class that uses it.
    { id: "conferences", label: "Conferences", navKey: "nav.conferences", icon: Handshake, category: "classroom", hidden: meetingGrades(profile).length === 0 },
    { id: "daily", label: "Pre-N Diary", navKey: "nav.daily", icon: Baby, category: "classroom", hidden: staffDailyGrades(profile).length === 0 },
    { id: "assignments", label: "Assignments", navKey: "nav.assignments", icon: FileText, category: "classroom" },
    { id: "reports", label: "Reports", navKey: "nav.reports", icon: FileCheck, category: "compliance" },
    { id: "resources", label: "Resources", navKey: "nav.resources", icon: FolderOpen, category: "compliance" },
    { id: "accreditation", label: "Accreditation", navKey: "nav.accreditation", icon: Award, category: "compliance" },
    { id: "fees", label: "School fees", navKey: "nav.fees", icon: Banknote, category: "office" },
    { id: "bus", label: "School bus", navKey: "nav.bus", icon: Bus, category: "office" },
    { id: "updates", label: "Communication", navKey: "nav.updates", icon: Megaphone, category: "office" }
  ];
  const allSections = allSectionsRaw
    .filter((s) => !s.hidden)
    // Staff use one Assessment tab (gradebook inside); upper students keep their own Gradebook view.
    .filter((s) => s.id !== "gradebook" || isStudent)
    .filter((s) => !isParent || !PARENT_HIDDEN_TABS.includes(s.id))
    .filter((s) => !allSuspended || !SUSPENDED_HIDDEN_TABS.includes(s.id))
    .filter((s) => isAdmin || isViewer || !ADMIN_ONLY_TABS.includes(s.id))
    .filter((s) => s.id !== "fees" || canSeeFees)
    .filter((s) => s.id !== "bus" || canSeeBus)
    .filter((s) => s.id !== "weekly" || !isSpecialist)
    .filter((s) => !isLearningAssistant || LEARNING_ASSISTANT_ALLOWED_TABS.includes(s.id))
    .filter((s) => !isAccountant || ACCOUNTANT_ALLOWED_TABS.includes(s.id))
    .filter((s) => !isRestrictedTeacher || RESTRICTED_TEACHER_TABS.includes(s.id))
    .filter((s) => !isStudent || STUDENT_ALLOWED_TABS.includes(s.id));

  const canInbox = !isStudent && !isAccountant && !isViewer;
  const primaryIds = isStudent
    ? STUDENT_ALLOWED_TABS.filter((id) => id !== "messages")
    : isAccountant
    ? ACCOUNTANT_ALLOWED_TABS
    : allSuspended
    ? ["dashboard", "students", "fees"]
    : isParent
    ? ["dashboard", "attendance", "messages"] // Parents (Myri, 28 Nov 2026): Dashboard, Attendance, Messages, More
    : !canInbox
    ? ["dashboard", "attendance", "portfolio", "assessment"]
    : ["dashboard", "students", "attendance", "messages"]; // Staff bottom bar (Myri, 28 Nov 2026): Portfolio and Assessment move to the menu
  const bottomTabs = primaryIds.map((id) => allSections.find((s) => s.id === id)).filter(Boolean);
  if (isStudent && isUpperStudent) {
    bottomTabs.push({ id: "messages", label: "Messages", icon: Megaphone });
  }

  const goTo = (id) => {
    setTab(id);
    setShowMenu(false);
  };

  // Where "go to" on a bell notice leads: staff to Attendance, parents to their child's page.
  const noticeTarget = isStudent
    ? null
    : Object.assign(() => goTo(isParent ? "students" : "attendance"), {
        label: isParent ? (language === "fr" ? "Voir mon enfant" : "See my child") : "Go to attendance"
      });

  return (
    <div className="bsf-app" style={{ "--teal": branding.primaryColor, "--gold": branding.primaryColor }}>
      <style>{appStyles}</style>

      <div className="bsf-topbar">
        <div className="bsf-brand">
          {branding.logoUrl && <img src={branding.logoUrl} alt="School logo" className="bsf-topbar-logo" />}
          <div>
            <span className="bsf-wordmark">BrightSteps Hub</span>
            {branding.slogan && <div className="bsf-slogan">{branding.slogan}</div>}
          </div>
        </div>
        <div className="bsf-topbar-actions">
          {saveError && !saving ? (
            <button className="bsf-savefail" onClick={retrySave} title={t("top.notSavedHint")}>
              {t("top.notSaved")}
            </button>
          ) : (
            <span className="bsf-savestate">{saving ? t("top.saving") : loaded ? t("top.saved") : t("top.loading")}</span>
          )}
          {canSwitch && (
            <button
              className="bsf-iconbtn bsf-settingsbtn"
              onClick={() => setLanguage(language === "en" ? "fr" : "en")}
              aria-label={t("top.language")}
              title={t("top.language")}
            >
              {language === "en" ? "FR" : "EN"}
            </button>
          )}
          {(!isStudent || isUpperStudent) && (
            <NotificationBell
              profile={profile}
              unreadThreads={isLearningAssistant || isAccountant ? [] : unreadThreads}
              unreadNoticeCount={unreadNoticeCount}
              onOpenThread={isLearningAssistant || isAccountant ? null : (studentId) => {
                if (isStudent) { goTo("messages"); return; }
                pending.messageStudentId = studentId;
                goTo("messages");
                window.dispatchEvent(new CustomEvent("bs-open-thread", { detail: studentId }));
              }}
              onOpenNotice={noticeTarget}
            />
          )}
          {!isStudent && (
            <button className="bsf-iconbtn bsf-settingsbtn bsf-topmenu" onClick={() => setShowMenu(true)} aria-label={t("top.menu")}>
              <MenuIcon size={19} />
            </button>
          )}
          <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => setShowSettings(true)} aria-label={t("top.settings")}>
            <SettingsIcon size={18} />
          </button>
          <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => signOut()} aria-label={t("settings.signOut")} title={t("settings.signOut")}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <TabErrorBoundary key={tab} language={language}>
      {suspendedKids.length > 0 && <FeeSuspendedBanner kids={suspendedKids} language={language} canSeeFees={canSeeFees} onFees={() => goTo("fees")} />}
      {isParent && busAccess.family && tab !== "bus" && !allSuspended && <BusLiveBanner onOpen={() => goTo("bus")} style={{ padding: "12px 16px 0", maxWidth: 960, marginLeft: "auto", marginRight: "auto" }} />}
      {tab === "dashboard" && !isParent && !isStudent && <CheckinBanner profile={profile} onOpen={() => goTo("checkin")} />}
      {tab === "dashboard" && <Dashboard data={data} profile={profile} persist={persist} onNavigate={goTo} />}
      {tab === "students" && (isParent ? <ParentStudentView data={data} persist={persist} profile={profile} /> : <StudentsTab data={data} persist={persist} profile={profile} />)}
      {tab === "classes" && !isParent && <ClassesTab data={data} persist={persist} profile={profile} />}
      {tab === "staff" && !isParent && !isLearningAssistant && <StaffTab data={data} persist={persist} />}
      {tab === "attendance" && <AttendanceTab data={data} persist={persist} profile={profile} />}
      {tab === "portfolio" && <PortfolioTab data={data} persist={persist} profile={profile} />}
      {tab === "messages" && !isStudent && !isParent && !isAccountant && <InboxTab data={data} profile={profile} />}
      {tab === "messages" && isParent && <ParentMessagesTab data={data} profile={profile} />}
      {tab === "messages" && isStudent && myLinkedStudent && (
        <div className="bsf-screen">
          <div className="bsf-hero">
            <p className="bsf-eyebrow">Messages</p>
            <h1>Talk with your teachers</h1>
          </div>
          <section className="bsf-card">
            <StudentMessages student={myLinkedStudent} data={data} persist={persist} />
          </section>
        </div>
      )}
      {tab === "assessment" && (isParent || isStudent
        ? <FamilyGradesTab data={data} profile={profile} />
        : <SchoolGradebook profile={profile} data={data} persist={persist} />)}
      {tab === "gradebook" && isStudent && isUpperStudent && <GradebookTab data={data} persist={persist} profile={profile} onNavigate={goTo} />}
      {tab === "planning" && !isParent && !isLearningAssistant && <PlanningTab data={data} persist={persist} profile={profile} />}
      {tab === "calendar" && <CalendarTab data={data} persist={persist} profile={profile} />}
      {tab === "canteen" && <CanteenTab profile={profile} />}
      {tab === "fees" && canSeeFees && <FeesTab office={feesAccess.office} readOnly={!!feesAccess.readOnly} />}
      {tab === "bus" && canSeeBus && <BusTab office={busAccess.office} helper={busAccess.helper} />}
      {tab === "incidents" && <IncidentsTab profile={profile} />}
      {tab === "leave" && <LeaveTab profile={profile} />}
      {tab === "stafffiles" && (isAdmin || isAccountant) && <StaffFilesTab profile={profile} />}
      {tab === "weekly" && !isParent && !isStudent && !isSpecialist && <WeeklyUpdatesTab profile={profile} data={data} />}
      {tab === "daily" && staffDailyGrades(profile).length > 0 && <DailyLogTab profile={profile} />}
      {tab === "conferences" && meetingGrades(profile).length > 0 && <MeetingsTab profile={profile} />}
      {tab === "checkin" && !isParent && !isStudent && <StaffCheckinTab profile={profile} />}
      {tab === "admissions" && !isParent && !isLearningAssistant && <AdmissionsTab data={data} persist={persist} />}
      {tab === "assignments" && <AssignmentsTab data={data} persist={persist} profile={profile} />}
      {tab === "timetable" && <TimetableTab data={data} profile={profile} />}
      {tab === "standards" && !isParent && !isStudent && !isAccountant && <StandardsTab profile={profile} />}
      {tab === "reports" && !isLearningAssistant && <ReportsTab data={data} persist={persist} profile={profile} />}
      {tab === "behavior" && !isParent && !isLearningAssistant && <BehaviorTab data={data} persist={persist} profile={profile} />}
      {tab === "resources" && <ResourcesTab data={data} persist={persist} profile={profile} />}
      {tab === "accreditation" && (isAdmin || isViewer) && <AccreditationTab data={data} persist={persist} />}
      {tab === "updates" && <UpdatesTab data={data} persist={persist} />}
      </TabErrorBoundary>

      {showSettings && <SettingsModal data={data} persist={persist} onClose={() => setShowSettings(false)} />}

      {showMenu && (
        <Modal title={t("nav.allSections")} onClose={() => setShowMenu(false)}>
          {["classroom", "office", "hr", "compliance"]
            .map((cat) => ({
              cat,
              items: allSections.filter((s) => s.category === cat && (!primaryIds.includes(s.id) || (s.id === "assessment" && !isParent && !isStudent)))
            }))
            .filter(({ items }) => items.length > 0)
            .map(({ cat, items }) => (
              <div key={cat} style={{ marginBottom: 18 }}>
                <p className="bsf-group-label">
                  {t(`menu.${cat}`)}
                </p>
                <div className="bsf-tilegrid">
                  {items.map(({ id, navKey, icon: Icon }) => (
                    <button key={id} className={`bsf-navtile ${tab === id ? "active" : ""}`} onClick={() => goTo(id)}>
                      <span className="bsf-tile-icon"><Icon size={19} /></span>
                      <span>{t(navKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </Modal>
      )}

      <nav className="bsf-tabbar">
        {bottomTabs.map(({ id, navKey, label, icon: Icon }) => (
          <button key={id} className={`bsf-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)} style={{ position: "relative" }}>
            <Icon size={19} />
            {id === "messages" && !isStudent && unreadMessageCount > 0 && (
              <span style={{ position: "absolute", top: 2, left: "calc(50% + 6px)", background: "#801524", color: "#fff", borderRadius: 100, fontSize: 10, lineHeight: "16px", minWidth: 16, height: 16, padding: "0 4px", fontWeight: 600, textAlign: "center" }}>
                {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
              </span>
            )}
            {navKey ? t(navKey) : label}
          </button>
        ))}
        {!isStudent && (
          <button className="bsf-tab" onClick={() => setShowMenu(true)}>
            <MenuIcon size={19} />
            {t("nav.more")}
          </button>
        )}
      </nav>
    </div>
  );
}

// Shown to a parent whose child is suspended for unpaid fees (27 Nov 2026).
function FeeSuspendedBanner({ kids, language, canSeeFees, onFees }) {
  const fr = language === "fr";
  const names = kids.map((k) => k.firstName || (k.name || "").split(" ")[0]).filter(Boolean);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} ${fr ? "et" : "and"} ${names[names.length - 1]}` : names[0] || "";
  return (
    <div style={{ padding: "12px 16px 0", maxWidth: 960, margin: "0 auto" }}>
      <div role="status" style={{ background: "#FCE8E8", color: "#8E2626", borderRadius: 14, padding: "14px 16px", fontSize: 14, lineHeight: 1.5 }}>
        <strong style={{ display: "block", marginBottom: 4 }}>{fr ? "Accès au Hub limité" : "Hub access limited"}</strong>
        {fr
          ? `L'accès au Hub est limité pour ${list} tant que les frais de scolarité sont en retard. Vous pouvez toujours consulter vos frais, imprimer vos reçus et écrire à l'école. L'accès complet est rétabli dès que le paiement est enregistré.`
          : `Hub access is limited for ${list} while school fees are overdue. You can still view your fees, print your receipts and message the school. Full access returns as soon as the payment is recorded.`}
        {canSeeFees && (
          <div style={{ marginTop: 10 }}>
            <button className="bsf-btn" onClick={onFees} style={{ minHeight: 40 }}>{fr ? "Voir mes frais de scolarité" : "View my school fees"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

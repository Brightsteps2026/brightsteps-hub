import { useState, useEffect } from "react";
import { LayoutDashboard, Users, BookOpen, ClipboardList, Megaphone, CheckSquare, ClipboardCheck, Settings as SettingsIcon, Calendar as CalendarIcon, UserCheck, Menu as MenuIcon, UserPlus, FileText, FileCheck, Percent, Briefcase, FolderOpen, Award, LogOut, Utensils, Wallet, NotebookPen, Clock3, Target } from "lucide-react";
import { useAuth } from "./LoginGate";
import { LanguageProvider, useLanguage } from "./lib/i18n";
import CanteenTab from "./CanteenTab";
import IncidentsTab, { IncidentsIcon } from "./IncidentsTab";
import LeaveTab, { LeaveIcon } from "./LeaveTab";
import WeeklyUpdatesTab from "./WeeklyUpdates";
import StaffCheckinTab, { CheckinIcon, CheckinBanner } from "./StaffCheckinTab";
import SchoolGradebook from "./SchoolGradebook";
import { GRADES, DEFAULT_SETTINGS, ACTIVITY_AREA_LABELS } from "./data/constants";
import { useSchoolData } from "./data/useSchoolData";
import { uid } from "./lib/format";
import { Modal, TabErrorBoundary } from "./ui/common";
import { Dashboard } from "./screens/Dashboard";
import { ParentStudentView } from "./screens/ParentStudentView";
import { StudentMessages, useUnreadNoticeCount, useUnreadThreads, NotificationBell } from "./screens/Messages";
import { resyncPush } from "./lib/push";
import { StudentsTab } from "./screens/Students";
import { ClassesTab } from "./screens/Classes";
import { PortfolioTab } from "./screens/Portfolio";
import { PlanningTab } from "./screens/Planning";
import { UpdatesTab } from "./screens/Updates";
import { AttendanceTab } from "./screens/Attendance";
import { AssessmentTab } from "./screens/Assessment";
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
import { BillingTab } from "./screens/Billing";
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
  const PARENT_HIDDEN_TABS = ["standards", "weekly", "checkin", "leave", "classes", "staff", "admissions", "behavior", "accreditation", "planning", "gradebook"];
  const ADMIN_ONLY_TABS = ["accreditation","staff","admissions"];
  // Only admin and the accountant role can see billing, everyone else is blocked outright.
  const BILLING_ALLOWED_ROLES = ["admin", "accountant", "viewer"];
  // A learning assistant supports specific grades day to day; they don't need
  // enrollment, staffing, or school-wide admin tools, just the classroom-facing ones.
  const LEARNING_ASSISTANT_ALLOWED_TABS = ["weekly", "checkin", "leave", "gradebook", "dashboard", "students", "canteen", "attendance", "portfolio", "assessment", "classes", "calendar", "timetable", "standards", "assignments", "updates", "resources"];
  // An accountant only ever needs billing, nothing about students' academic
  // records, behavior, or staff information.
  const ACCOUNTANT_ALLOWED_TABS = ["dashboard", "billing", "checkin", "leave"];
  const RESTRICTED_TEACHER_TABS = ["weekly", "checkin", "leave", "dashboard", "students", "canteen", "attendance", "portfolio", "assessment", "planning", "assignments", "timetable", "standards", "reports", "calendar", "incidents", "updates", "resources"];
  // Set per teacher by the admin in the database (profiles.limited_access).
  const isRestrictedTeacher = profile?.role === "teacher" && profile?.limited_access === true;
  // Pre-N through Grade 2: reflections only. Grade 3 and up: can also see (not edit)
  // their own attendance and grades.
  const STUDENT_ALLOWED_TABS = isUpperStudent ? ["portfolio", "attendance", "gradebook", "assignments", "timetable", "assessment", "messages"] : ["portfolio"];
  const unreadThreads = useUnreadThreads(profile, data);
  // Phone notifications: re-confirm this phone with the server each time the Hub opens.
  useEffect(() => { if (profile?.id) resyncPush(); }, [profile?.id]);
  const unreadMessageCount = unreadThreads.reduce((n, t) => n + t.count, 0);
  const unreadNoticeCount = useUnreadNoticeCount(profile);
  const unreadCount = unreadMessageCount + unreadNoticeCount;

  useEffect(() => {
    if (isParent && PARENT_HIDDEN_TABS.includes(tab)) setTab("dashboard");
    if (!isAdmin && !isViewer && ADMIN_ONLY_TABS.includes(tab)) setTab("dashboard");
    if (tab === "billing" && !BILLING_ALLOWED_ROLES.includes(profile?.role)) setTab("dashboard");
    if (isLearningAssistant && !LEARNING_ASSISTANT_ALLOWED_TABS.includes(tab)) setTab("dashboard");
    if (isAccountant && !ACCOUNTANT_ALLOWED_TABS.includes(tab)) setTab("dashboard");
    if (isRestrictedTeacher && !RESTRICTED_TEACHER_TABS.includes(tab)) setTab("dashboard");
    if (isStudent && !STUDENT_ALLOWED_TABS.includes(tab)) setTab("portfolio");
    if (!isStudent && !isParent && tab === "gradebook") setTab("assessment");
  }, [isParent, isAdmin, isLearningAssistant, isAccountant, isStudent, tab, profile]);

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
    { id: "classes", label: "Classes", navKey: "nav.classes", icon: UserCheck, category: "classroom" },
    { id: "staff", label: "Staff", navKey: "nav.staff", icon: Briefcase, category: "office" },
    { id: "checkin", label: "Staff check-in", navKey: "nav.checkin", icon: CheckinIcon, category: "office" },
    { id: "leave", label: "Leave requests", navKey: "nav.leave", icon: LeaveIcon, category: "office" },
    { id: "attendance", label: "Attendance", navKey: "nav.attendance", icon: CheckSquare, category: "core" },
    { id: "portfolio", label: "Portfolio", navKey: "nav.portfolio", icon: BookOpen, category: "core" },
    { id: "gradebook", label: "Gradebook", navKey: "nav.gradebook", icon: Percent, category: "classroom" },
    { id: "planning", label: "Curriculum", navKey: "nav.planning", icon: ClipboardList, category: "classroom" },
    { id: "calendar", label: "Calendar", navKey: "nav.calendar", icon: CalendarIcon, category: "office" },
    { id: "timetable", label: "Timetable", navKey: "nav.timetable", icon: Clock3, category: "classroom" },
    { id: "standards", label: "Standards", navKey: "nav.standards", icon: Target, category: "classroom" },
    { id: "canteen", label: "Canteen", navKey: "nav.canteen", icon: Utensils, category: "office" },
    { id: "incidents", label: "Incidents", navKey: "nav.incidents", icon: IncidentsIcon, category: "classroom" },
    { id: "admissions", label: "Admissions", navKey: "nav.admissions", icon: UserPlus, category: "office" },
    { id: "assessment", label: "Assessment", navKey: "nav.assessment", icon: ClipboardCheck, category: "classroom" },
    { id: "weekly", label: "Weekly updates", navKey: "nav.weekly", icon: NotebookPen, category: "classroom" },
    { id: "assignments", label: "Assignments", navKey: "nav.assignments", icon: FileText, category: "classroom" },
    { id: "reports", label: "Reports", navKey: "nav.reports", icon: FileCheck, category: "compliance" },
    { id: "resources", label: "Resources", navKey: "nav.resources", icon: FolderOpen, category: "compliance" },
    { id: "accreditation", label: "Accreditation", navKey: "nav.accreditation", icon: Award, category: "compliance" },
    { id: "billing", label: "Billing", navKey: "nav.billing", icon: Wallet, category: "office" },
    { id: "updates", label: "Communication", navKey: "nav.updates", icon: Megaphone, category: "office" }
  ];
  const allSections = allSectionsRaw
    .filter((s) => !s.hidden)
    // Staff use one Assessment tab (gradebook inside); upper students keep their own Gradebook view.
    .filter((s) => s.id !== "gradebook" || isStudent)
    .filter((s) => !isParent || !PARENT_HIDDEN_TABS.includes(s.id))
    .filter((s) => isAdmin || isViewer || !ADMIN_ONLY_TABS.includes(s.id))
    .filter((s) => s.id !== "billing" || BILLING_ALLOWED_ROLES.includes(profile?.role))
    .filter((s) => !isLearningAssistant || LEARNING_ASSISTANT_ALLOWED_TABS.includes(s.id))
    .filter((s) => !isAccountant || ACCOUNTANT_ALLOWED_TABS.includes(s.id))
    .filter((s) => !isRestrictedTeacher || RESTRICTED_TEACHER_TABS.includes(s.id))
    .filter((s) => !isStudent || STUDENT_ALLOWED_TABS.includes(s.id));

  const primaryIds = isStudent
    ? STUDENT_ALLOWED_TABS.filter((id) => id !== "messages")
    : isAccountant
    ? ACCOUNTANT_ALLOWED_TABS
    : ["dashboard", "attendance", "portfolio", "assessment"];
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
                if (isParent) pending.childProfileId = studentId;
                goTo("students");
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
      {tab === "dashboard" && !isParent && !isStudent && <CheckinBanner profile={profile} onOpen={() => goTo("checkin")} />}
      {tab === "dashboard" && <Dashboard data={data} profile={profile} persist={persist} onNavigate={goTo} />}
      {tab === "students" && (isParent ? <ParentStudentView data={data} persist={persist} profile={profile} /> : <StudentsTab data={data} persist={persist} profile={profile} />)}
      {tab === "classes" && !isParent && <ClassesTab data={data} persist={persist} profile={profile} />}
      {tab === "staff" && !isParent && !isLearningAssistant && <StaffTab data={data} persist={persist} />}
      {tab === "attendance" && <AttendanceTab data={data} persist={persist} profile={profile} />}
      {tab === "portfolio" && <PortfolioTab data={data} persist={persist} profile={profile} />}
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
        ? <AssessmentTab data={data} persist={persist} profile={profile} />
        : <SchoolGradebook profile={profile} data={data} persist={persist} />)}
      {tab === "gradebook" && isStudent && isUpperStudent && <GradebookTab data={data} persist={persist} profile={profile} onNavigate={goTo} />}
      {tab === "planning" && !isParent && !isLearningAssistant && <PlanningTab data={data} persist={persist} profile={profile} />}
      {tab === "calendar" && <CalendarTab data={data} persist={persist} profile={profile} />}
      {tab === "canteen" && <CanteenTab profile={profile} />}
      {tab === "incidents" && <IncidentsTab profile={profile} />}
      {tab === "leave" && <LeaveTab profile={profile} />}
      {tab === "weekly" && !isParent && !isStudent && <WeeklyUpdatesTab profile={profile} data={data} />}
      {tab === "checkin" && !isParent && !isStudent && <StaffCheckinTab profile={profile} />}
      {tab === "admissions" && !isParent && !isLearningAssistant && <AdmissionsTab data={data} persist={persist} />}
      {tab === "assignments" && <AssignmentsTab data={data} persist={persist} profile={profile} />}
      {tab === "timetable" && <TimetableTab data={data} profile={profile} />}
      {tab === "standards" && !isParent && !isStudent && !isAccountant && <StandardsTab profile={profile} />}
      {tab === "reports" && !isLearningAssistant && <ReportsTab data={data} persist={persist} profile={profile} />}
      {tab === "behavior" && !isParent && !isLearningAssistant && <BehaviorTab data={data} persist={persist} profile={profile} />}
      {tab === "resources" && <ResourcesTab data={data} persist={persist} profile={profile} />}
      {tab === "accreditation" && (isAdmin || isViewer) && <AccreditationTab data={data} persist={persist} />}
      {tab === "billing" && BILLING_ALLOWED_ROLES.includes(profile?.role) && <BillingTab data={data} persist={persist} />}
      {tab === "updates" && <UpdatesTab data={data} persist={persist} />}
      </TabErrorBoundary>

      {showSettings && <SettingsModal data={data} persist={persist} onClose={() => setShowSettings(false)} />}

      {showMenu && (
        <Modal title={t("nav.allSections")} onClose={() => setShowMenu(false)}>
          {["classroom", "office", "compliance"]
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
          <button key={id} className={`bsf-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            <Icon size={19} />
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

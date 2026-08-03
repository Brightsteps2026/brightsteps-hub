import { useState, useEffect, useMemo } from "react";
import { LayoutDashboard, Users, BookOpen, ClipboardList, Megaphone, Plus, X, Trash2, CheckSquare, ClipboardCheck, Settings as SettingsIcon, Calendar as CalendarIcon, UserCheck, Menu as MenuIcon, UserPlus, FileText, FileCheck, Flag, Percent, Briefcase, FolderOpen, Award, Sparkles, Send, LogOut } from "lucide-react";
import AttachmentField from "./AttachmentField";
import StudentPhotoField from "./StudentPhotoField";
import { getAttachmentUrl } from "./lib/attachments";
import { useAuth } from "./LoginGate";
import { LanguageProvider, useLanguage } from "./lib/i18n";

let GRADES = [
  "Pre-N", "PreK", "Kindergarten",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4",
  "Grade 5", "Grade 6", "Grade 7"
];

const TAGS = ["Inquiry", "Literacy", "Numeracy", "Social Emotional", "Creative Arts", "Physical"];

const THEMES = [
  "Who We Are",
  "How We Express Ourselves",
  "How the World Works",
  "How We Organize Ourselves",
  "Sharing the Planet",
  "Where We Are in Place and Time"
];

const PLAN_TEMPLATE = {
  centralIdea: "Students will understand that ",
  keyConcepts: "Form, Change, Connection",
  linesOfInquiry: "An exploration of \nA connection between \nThe way that "
};

let ASSESS_LEVELS = ["Emerging", "Developing", "Proficient", "Extending"];
const LEVEL_PALETTE = ["#B5473B", "#B8842F", "#2F6B7A", "#2F7A5C", "#6E4E9E", "#3A6EA5"];
const getLevelColor = (level) => {
  const idx = ASSESS_LEVELS.indexOf(level);
  return LEVEL_PALETTE[idx >= 0 ? idx % LEVEL_PALETTE.length : 0];
};

const BRIGHTSTEPS_LOGO_DATA_URI = "data:image/png;base64,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";

const DEFAULT_SETTINGS = {
  curriculumFramework: "Inquiry Based Learning",
  grades: [...GRADES],
  assessmentLevels: [...ASSESS_LEVELS],
  branding: { primaryColor: "#801524", logoUrl: BRIGHTSTEPS_LOGO_DATA_URI, mission: "", slogan: "" },
  languages: ["English", "French"],
  academicYear: { startDate: "", endDate: "" },
  reportCardTemplates: ["Standard Progress Report"],
  roles: ["Administrator", "Teacher", "Parent"]
};

const STORAGE_KEY = "brightsteps-hub-data";

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

const EVENT_TYPES = ["Academic", "Holiday", "Staff", "Event", "Meeting"];
const EVENT_TYPE_COLOR = { Academic: "#2F6B7A", Holiday: "#B8842F", Staff: "#6E4E9E", Event: "#2F7A5C", Meeting: "#B5473B" };

const ADMISSION_STAGES = ["Inquiry", "Tour Scheduled", "Application Submitted", "Enrolled", "Declined"];
const ADMISSION_STAGE_COLOR = {
  "Inquiry": "#B8842F",
  "Tour Scheduled": "#2F6B7A",
  "Application Submitted": "#6E4E9E",
  "Enrolled": "#2F7A5C",
  "Declined": "#B5473B"
};
const ADMISSION_SOURCES = ["Real Estate Partner", "WhatsApp Referral", "Flyer", "Walk-in", "Website", "Other"];

const BEHAVIOR_TYPES = ["Positive", "Concern"];
const BEHAVIOR_CATEGORIES_POSITIVE = ["Kindness", "Leadership", "Responsibility", "Effort", "Collaboration", "Other"];
const BEHAVIOR_CATEGORIES_CONCERN = ["Disruption", "Conflict with a peer", "Not following instructions", "Safety concern", "Property damage", "Other"];

const LETTER_GRADES = ["A", "B", "C", "D", "F"];
const letterFromScore = (score) => {
  const n = Number(score);
  if (Number.isNaN(n)) return "";
  if (n >= 90) return "A";
  if (n >= 80) return "B";
  if (n >= 70) return "C";
  if (n >= 60) return "D";
  return "F";
};
const LETTER_GRADE_COLOR = { A: "#2F7A5C", B: "#2F6B7A", C: "#B8842F", D: "#B5473B", F: "#801524" };

const STAFF_ROLES = ["Administrator", "Teacher", "Learning Assistant", "Coordinator", "Support Staff", "Other"];

const RESOURCE_CATEGORIES = ["Policies", "Curriculum", "Forms & Templates", "Professional Development", "Parent Resources", "Other"];

const ACCRED_STATUSES = ["Not Started", "In Progress", "Met"];
const ACCRED_STATUS_COLOR = { "Not Started": "#8A9698", "In Progress": "#B8842F", "Met": "#2F7A5C" };

const DEFAULT_MILESTONES = [
  "Study the IB Standards and Practices",
  "Purchase and study the PYP starter pack",
  "Identify the programme coordinator",
  "Coordinator completes Category 1 Leading the Learning workshop",
  "Submit Application for candidacy",
  "Complete at least one academic year of trial implementation",
  "Submit Application for authorization",
  "Verification visit"
];

const emptyData = { students: [], classes: [], portfolio: [], plans: [], announcements: [], attendance: {}, assessments: [], rubrics: [], settings: DEFAULT_SETTINGS, events: [], admissions: [], assignments: [], reports: [], behaviorIncidents: [], gradeEntries: [], standards: [], staff: [], resources: [], accreditation: { milestones: [], checklist: [] } };

function syncGlobalsFromSettings(settings) {
  if (!settings) return;
  if (settings.grades && settings.grades.length) {
    GRADES.length = 0;
    GRADES.push(...settings.grades);
  }
  if (settings.assessmentLevels && settings.assessmentLevels.length) {
    ASSESS_LEVELS.length = 0;
    ASSESS_LEVELS.push(...settings.assessmentLevels);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function useSchoolData() {
  const [data, setData] = useState(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res && res.value) {
          const parsed = { ...emptyData, ...JSON.parse(res.value) };
          if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
          if (!parsed.settings.branding) parsed.settings.branding = DEFAULT_SETTINGS.branding;
          if (!parsed.settings.branding.logoUrl) {
            parsed.settings = { ...parsed.settings, branding: { ...parsed.settings.branding, logoUrl: BRIGHTSTEPS_LOGO_DATA_URI } };
          }
          syncGlobalsFromSettings(parsed.settings);

          // Rename the old "Pre Nursery" grade name to the new "Pre-N" everywhere it is saved.
          let renamedGrade = false;
          if (parsed.settings && parsed.settings.grades && parsed.settings.grades.includes("Pre Nursery")) {
            parsed.settings = {
              ...parsed.settings,
              grades: parsed.settings.grades.map((g) => (g === "Pre Nursery" ? "Pre-N" : g))
            };
            renamedGrade = true;
          }
          parsed.students = (parsed.students || []).map((s) => {
            if (s.grade === "Pre Nursery") { renamedGrade = true; return { ...s, grade: "Pre-N" }; }
            return s;
          });
          if (renamedGrade) {
            syncGlobalsFromSettings(parsed.settings);
          }

          // Give every existing student a student ID number if they don't have one yet.
          let studentsChanged = false;
          const assignedSoFar = (parsed.students || []).map((s) => s.studentIdNumber).filter(Boolean);
          parsed.students = (parsed.students || []).map((s) => {
            if (s.studentIdNumber) return s;
            const newIdNumber = nextStudentIdNumber(assignedSoFar);
            assignedSoFar.push(newIdNumber);
            studentsChanged = true;
            return { ...s, studentIdNumber: newIdNumber };
          });

          setData(parsed);
          if (studentsChanged || renamedGrade) {
            window.storage.set(STORAGE_KEY, JSON.stringify(parsed), true).catch((e) => {
              console.error("Failed to save backfilled student ID numbers", e);
            });
          }
        }
        // No saved row yet is fine (brand new school), that is not an error.
        setLoaded(true);
      } catch (e) {
        // A real failure to reach storage. Do NOT mark this as loaded with
        // an empty dataset, that would risk a later save overwriting real
        // data with nothing. Show a blocking error instead.
        console.error("Failed to load school data", e);
        setLoadError(true);
      }
    })();
  }, []);

  const persist = async (next) => {
    if (loadError) {
      // Refuse to save if we never confirmed we loaded the real data first.
      console.error("Refusing to save: data was never successfully loaded.");
      return;
    }
    syncGlobalsFromSettings(next.settings);
    setData(next);
    setSaving(true);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), true);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  return { data, persist, loaded, saving, loadError };
}

function Field({ label, children }) {
  return (
    <label className="bsf-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="bsf-modal-backdrop" onClick={onClose}>
      <div className="bsf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bsf-modal-head">
          <h3>{title}</h3>
          <button className="bsf-iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="bsf-modal-body">{children}</div>
      </div>
    </div>
  );
}

function GradeLadder({ counts, activeGrade, onSelect }) {
  const max = Math.max(1, ...GRADES.map((g) => counts[g] || 0));
  return (
    <div className="bsf-ladder">
      {GRADES.map((g, i) => {
        const count = counts[g] || 0;
        const width = 24 + (count / max) * 76;
        const active = activeGrade === g;
        return (
          <button
            key={g}
            className={`bsf-rung ${active ? "active" : ""}`}
            onClick={() => onSelect(active ? null : g)}
          >
            <span className="bsf-rung-label">{g}</span>
            <span className="bsf-rung-track">
              <span className="bsf-rung-fill" style={{ width: `${width}%` }} />
            </span>
            <span className="bsf-rung-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function Dashboard({ data }) {
  const { t } = useLanguage();
  const settings = data.settings || DEFAULT_SETTINGS;
  const counts = useMemo(() => {
    const c = {};
    data.students.forEach((s) => { c[s.grade] = (c[s.grade] || 0) + 1; });
    return c;
  }, [data.students]);

  const total = data.students.length;
  const recentPortfolio = [...data.portfolio].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const recentAnnouncements = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const today = todayStr();
  const nextEvents = [...(data.events || [])]
    .filter((e) => (e.endDate || e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("dashboard.eyebrow")}</p>
        <h1>BrightSteps at a glance</h1>
        <p className="bsf-hero-sub">{total} student{total === 1 ? "" : "s"} across {Object.keys(counts).length} grade level{Object.keys(counts).length === 1 ? "" : "s"}</p>
        {settings.branding.mission && <p className="bsf-mission">{settings.branding.mission}</p>}
        {(settings.academicYear.startDate || settings.academicYear.endDate) && (
          <p className="bsf-muted">Academic year: {settings.academicYear.startDate || "?"} to {settings.academicYear.endDate || "?"}</p>
        )}
      </div>

      <section className="bsf-card">
        <h2>Enrollment by grade</h2>
        <GradeLadder counts={counts} activeGrade={null} onSelect={() => {}} />
      </section>

      <section className="bsf-card">
        <h2>Next up</h2>
        {nextEvents.length === 0 && <p className="bsf-empty">Nothing scheduled yet. Add one from the Calendar tab.</p>}
        {nextEvents.map((e) => (
          <div key={e.id} className="bsf-row">
            <span
              className="bsf-status-pill"
              style={{ background: `${EVENT_TYPE_COLOR[e.type]}1A`, color: EVENT_TYPE_COLOR[e.type] }}
            >
              {e.type}
            </span>
            <div>
              <strong>{e.title}</strong>
              <p>{e.date}{e.endDate && e.endDate !== e.date ? ` to ${e.endDate}` : ""}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Latest portfolio entries</h2>
        {recentPortfolio.length === 0 && <p className="bsf-empty">No entries yet. Add one from the Portfolio tab.</p>}
        {recentPortfolio.map((p) => (
          <div key={p.id} className="bsf-row">
            <span className="bsf-tag">{p.tag}</span>
            <div>
              <strong>{p.studentName}</strong>
              <p>{p.note}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Latest family updates</h2>
        {recentAnnouncements.length === 0 && <p className="bsf-empty">Nothing posted yet. Share one from Family Updates.</p>}
        {recentAnnouncements.map((a) => (
          <div key={a.id} className="bsf-row">
            <div>
              <strong>{a.titleEn}</strong>
              <p>{a.bodyEn}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function FamilyViewModal({ student, data, onClose }) {
  const today = todayStr();

  const attendanceSummary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0 };
    Object.values(data.attendance || {}).forEach((day) => {
      const status = day[student.id];
      if (status) counts[status] += 1;
    });
    return counts;
  }, [data.attendance, student.id]);

  const portfolioEntries = [...data.portfolio]
    .filter((p) => p.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const assessments = [...(data.assessments || [])]
    .filter((a) => a.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const events = [...(data.events || [])]
    .filter((e) => (e.endDate || e.date) >= today)
    .filter((e) => !e.grades || e.grades.length === 0 || e.grades.includes(student.grade))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const assignmentsDue = [...(data.assignments || [])]
    .filter((a) => !a.dueDate || a.dueDate >= today)
    .filter((a) => (a.grades || []).includes(student.grade))
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 5);

  const announcements = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  return (
    <Modal title={`${student.name}'s family view`} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <StudentThumb photo={student.photo} />
        <p className="bsf-muted" style={{ margin: 0 }}>
          This is a preview of what a parent would see for {student.name}. It isn't a separate login yet.
        </p>
      </div>

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

      <section className="bsf-card">
        <h2>Attendance</h2>
        <p className="bsf-muted">
          {attendanceSummary.present} present · {attendanceSummary.absent} absent · {attendanceSummary.late} late this year
        </p>
      </section>

      <section className="bsf-card">
        <h2>Upcoming for {student.grade}</h2>
        {events.length === 0 && <p className="bsf-empty">Nothing scheduled yet.</p>}
        {events.map((e) => (
          <div key={e.id} className="bsf-row">
            <span className="bsf-status-pill" style={{ background: `${EVENT_TYPE_COLOR[e.type]}1A`, color: EVENT_TYPE_COLOR[e.type] }}>
              {e.type}
            </span>
            <div>
              <strong>{e.title}</strong>
              <p>{e.date}{e.endDate && e.endDate !== e.date ? ` to ${e.endDate}` : ""}</p>
            </div>
          </div>
        ))}
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
          <div key={p.id} className="bsf-row">
            <span className="bsf-tag">{p.tag}</span>
            <div>
              <div className="bsf-row-head">
                <span className={`bsf-author-badge ${p.author === "student" ? "student" : "teacher"}`}>
                  {p.author === "student" ? "Student reflection" : "Teacher note"}
                </span>
                <span className="bsf-muted">{p.date}</span>
              </div>
              <p>{p.note}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Assessments</h2>
        {assessments.length === 0 && <p className="bsf-empty">No assessments recorded yet.</p>}
        {assessments.map((a) => (
          <div key={a.id} className="bsf-row">
            {a.rows && a.rows.length > 0 ? (
              <span className="bsf-tag">{a.rubricName || "Rubric"}</span>
            ) : (
              <span className="bsf-status-pill" style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}>
                {a.level}
              </span>
            )}
            <div>
              <p className="bsf-muted">{a.date}{a.subject ? ` · ${a.subject}` : ""}</p>
              {a.rows && a.rows.length > 0 ? (
                <div className="bsf-rubric-rows">
                  {a.rows.map((r, i) => (
                    <div key={i} className="bsf-rubric-row">
                      <span>{r.text}</span>
                      <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>{r.level}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{a.criteria}</p>
              )}
              {a.feedback && <p className="bsf-muted">{a.feedback}</p>}
            </div>
          </div>
        ))}
      </section>

      <section className="bsf-card">
        <h2>Family updates</h2>
        {announcements.length === 0 && <p className="bsf-empty">Nothing posted yet.</p>}
        {announcements.map((a) => (
          <div key={a.id} className="bsf-row">
            <div>
              <strong>{a.titleEn}</strong>
              <p>{a.bodyEn}</p>
            </div>
          </div>
        ))}
      </section>
    </Modal>
  );
}

const emptyStudentForm = {
  firstName: "", middleName: "", lastName: "", grade: GRADES[0], dob: "", gender: "", nationalities: [],
  photo: null,
  guardian1Name: "", guardian1Relationship: "", guardian1Phone: "", guardian1Email: "",
  guardian2Name: "", guardian2Relationship: "", guardian2Phone: "", guardian2Email: "",
  allergies: "", medicalConditions: "",
  emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "",
  enrollmentDate: "", previousSchool: "", homeAddress: ""
};

const fullName = (p) => [p.firstName, p.middleName, p.lastName].filter((x) => x && x.trim()).join(" ");

function StudentThumb({ photo }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!photo || !photo.path) { setUrl(""); return; }
    getAttachmentUrl(photo.path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [photo && photo.path]);
  return (
    <div className="bsf-student-thumb">
      {url ? <img src={url} alt="" /> : <Users size={18} />}
    </div>
  );
}

const GENDERS = ["Female", "Male", "Prefer not to say"];

const COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua & Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia & Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo - Brazzaville","Congo - Kinshasa","Costa Rica","Cote d'Ivoire","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar (Burma)","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Samoa","San Marino","Sao Tome & Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","St. Kitts & Nevis","St. Lucia","St. Vincent & Grenadines","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad & Tobago","Tunisia","Turkiye","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"];

function StudentMessages({ student, data, persist }) {
  const { profile } = useAuth();
  const [messageText, setMessageText] = useState("");

  const addMessage = () => {
    if (!messageText.trim()) return;
    const message = {
      id: uid(),
      author: (profile && profile.full_name) || "Someone",
      role: (profile && profile.role) || "",
      text: messageText.trim(),
      date: new Date().toISOString().slice(0, 10)
    };
    persist({
      ...data,
      students: data.students.map((s) => (s.id === student.id ? { ...s, messages: [...(s.messages || []), message] } : s))
    });
    setMessageText("");
  };

  const removeMessage = (msgId) => {
    persist({
      ...data,
      students: data.students.map((s) => (s.id === student.id ? { ...s, messages: (s.messages || []).filter((m) => m.id !== msgId) } : s))
    });
  };

  return (
    <>
      <h3 className="bsf-subheading">Messages</h3>
      <p className="bsf-muted" style={{ marginBottom: 8 }}>A private thread between parents and teachers about {student.name}.</p>
      <div className="bsf-comments">
        {(student.messages || []).length === 0 && <p className="bsf-empty">No messages yet.</p>}
        {(student.messages || []).map((m) => (
          <div key={m.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{m.author}{m.role ? ` · ${m.role}` : ""}</strong>
              <span className="bsf-muted">{m.date}</span>
            </div>
            <p>{m.text}</p>
            <button className="bsf-textbtn" onClick={() => removeMessage(m.id)}>Remove</button>
          </div>
        ))}
      </div>
      <Field label="Write a message">
        <textarea rows={2} value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Share an update or ask a question" />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addMessage} style={{ marginBottom: 16 }}>Send message</button>
    </>
  );
}

function ParentStudentView({ data, persist, profile }) {
  const linkedIds = profile?.student_ids || [];
  const myStudents = data.students.filter((s) => linkedIds.includes(s.id));
  const [activeChildId, setActiveChildId] = useState(null);

  const activeStudent = myStudents.find((s) => s.id === activeChildId) || myStudents[0];

  if (myStudents.length === 0) {
    return (
      <div className="bsf-screen">
        <div className="bsf-screen-head"><h1>My child</h1></div>
        <p className="bsf-empty">No student is linked to your account yet. Please contact the school administrator.</p>
      </div>
    );
  }

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head"><h1>My child</h1></div>

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
        <section key={activeStudent.id} className="bsf-card">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <StudentThumb photo={activeStudent.photo} />
            <div>
              <strong>{activeStudent.name}</strong>
              <p className="bsf-muted">{activeStudent.grade}</p>
            </div>
          </div>
          {activeStudent.allergies && <p className="bsf-alert-note">Allergies: {activeStudent.allergies}</p>}
          {activeStudent.medicalConditions && <p className="bsf-alert-note">Medical: {activeStudent.medicalConditions}</p>}
          <hr className="bsf-divider" />
          <StudentMessages student={activeStudent} data={data} persist={persist} />
        </section>
      )}
    </div>
  );
}

function StudentsTab({ data, persist }) {
  const [activeGrade, setActiveGrade] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [familyViewId, setFamilyViewId] = useState(null);
  const [form, setForm] = useState(emptyStudentForm);
  const [formError, setFormError] = useState("");

  const counts = useMemo(() => {
    const c = {};
    data.students.forEach((s) => { c[s.grade] = (c[s.grade] || 0) + 1; });
    return c;
  }, [data.students]);

  const filtered = activeGrade ? data.students.filter((s) => s.grade === activeGrade) : data.students;
  const familyViewStudent = data.students.find((s) => s.id === familyViewId);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyStudentForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (student) => {
    setEditingId(student.id);
    const base = student.firstName ? student : { ...student, firstName: student.name || "", middleName: "", lastName: "" };
    const withNationalities = base.nationalities ? base : { ...base, nationalities: base.nationality ? [base.nationality] : [] };
    setForm({ ...emptyStudentForm, ...withNationalities });
    setFormError("");
    setShowForm(true);
  };

  const saveStudent = () => {
    if (!form.firstName.trim()) {
      setFormError("Please enter a first name before saving.");
      return;
    }
    const record = { ...form, name: fullName(form) };
    if (editingId) {
      persist({ ...data, students: data.students.map((s) => (s.id === editingId ? { ...s, ...record } : s)) });
    } else {
      const existingIdNumbers = data.students.map((s) => s.studentIdNumber).filter(Boolean);
      const studentIdNumber = nextStudentIdNumber(existingIdNumbers);
      persist({ ...data, students: [...data.students, { id: uid(), studentIdNumber, ...record }] });
      setActiveGrade(null);
    }
    setForm(emptyStudentForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeStudent = (id) => {
    persist({ ...data, students: data.students.filter((s) => s.id !== id) });
  };

  const editingStudent = data.students.find((s) => s.id === editingId);

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Students</h1>
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>

      <section className="bsf-card">
        <GradeLadder counts={counts} activeGrade={activeGrade} onSelect={setActiveGrade} />
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No students in this view yet.</p>}
        {filtered.map((s) => (
          <div key={s.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(s)}>
            <StudentThumb photo={s.photo} />
            <div>
              <strong>{s.name}</strong>
              <p className="bsf-muted">{s.grade}{(s.nationalities && s.nationalities.length) ? ` · ${s.nationalities.join(", ")}` : (s.nationality ? ` · ${s.nationality}` : "")}</p>
              {s.studentIdNumber && <p className="bsf-muted">ID: {s.studentIdNumber}</p>}
              <p className="bsf-muted" style={{ fontSize: 11, opacity: 0.6 }}>Account link code: {s.id}</p>
              {s.guardian1Name && <p className="bsf-muted">Guardian: {s.guardian1Name}{s.guardian1Phone ? ` · ${s.guardian1Phone}` : ""}</p>}
              {s.allergies && <p className="bsf-alert-note">Allergies: {s.allergies}</p>}
            </div>
            <div className="bsf-student-actions">
              <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); setFamilyViewId(s.id); }} aria-label="Family view"><UserCheck size={16} /></button>
              <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeStudent(s.id); }} aria-label="Remove"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit student" : "Add student"} onClose={() => setShowForm(false)}>
          <h3 className="bsf-subheading">Basic info</h3>
          <Field label="First name">
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" />
          </Field>
          <Field label="Middle name">
            <input value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Last name">
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" />
          </Field>
          <Field label="Grade">
            <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Photo">
            <StudentPhotoField photo={form.photo} onChange={(photo) => setForm({ ...form, photo })} />
          </Field>
          <div className="bsf-two-col">
            <Field label="Date of birth">
              <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </Field>
            <Field label="Gender">
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Nationality">
            <div className="bsf-chiprow">
              {(form.nationalities || []).map((n) => (
                <span key={n} className="bsf-chip bsf-editable-chip">
                  {n}
                  <button type="button" onClick={() => setForm({ ...form, nationalities: form.nationalities.filter((x) => x !== n) })} aria-label={`Remove ${n}`}>×</button>
                </span>
              ))}
            </div>
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val && !form.nationalities.includes(val)) {
                  setForm({ ...form, nationalities: [...form.nationalities, val] });
                }
              }}
            >
              <option value="">Add a nationality</option>
              {COUNTRIES.filter((c) => !(form.nationalities || []).includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Guardian 1</h3>
          <Field label="Name">
            <input value={form.guardian1Name} onChange={(e) => setForm({ ...form, guardian1Name: e.target.value })} />
          </Field>
          <div className="bsf-two-col">
            <Field label="Relationship">
              <input value={form.guardian1Relationship} onChange={(e) => setForm({ ...form, guardian1Relationship: e.target.value })} placeholder="e.g. Mother" />
            </Field>
            <Field label="Phone">
              <input value={form.guardian1Phone} onChange={(e) => setForm({ ...form, guardian1Phone: e.target.value })} placeholder="Phone or WhatsApp" />
            </Field>
          </div>
          <Field label="Email">
            <input value={form.guardian1Email} onChange={(e) => setForm({ ...form, guardian1Email: e.target.value })} />
          </Field>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Guardian 2 (optional)</h3>
          <Field label="Name">
            <input value={form.guardian2Name} onChange={(e) => setForm({ ...form, guardian2Name: e.target.value })} />
          </Field>
          <div className="bsf-two-col">
            <Field label="Relationship">
              <input value={form.guardian2Relationship} onChange={(e) => setForm({ ...form, guardian2Relationship: e.target.value })} placeholder="e.g. Father" />
            </Field>
            <Field label="Phone">
              <input value={form.guardian2Phone} onChange={(e) => setForm({ ...form, guardian2Phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Email">
            <input value={form.guardian2Email} onChange={(e) => setForm({ ...form, guardian2Email: e.target.value })} />
          </Field>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Health &amp; safety</h3>
          <Field label="Allergies">
            <textarea rows={2} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="Leave blank if none" />
          </Field>
          <Field label="Medical conditions">
            <textarea rows={2} value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} placeholder="Leave blank if none" />
          </Field>
          <Field label="Emergency contact name">
            <input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="If different from guardians" />
          </Field>
          <div className="bsf-two-col">
            <Field label="Relationship">
              <input value={form.emergencyContactRelationship} onChange={(e) => setForm({ ...form, emergencyContactRelationship: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
            </Field>
          </div>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Enrollment</h3>
          <Field label="Enrollment date">
            <input type="date" value={form.enrollmentDate} onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })} />
          </Field>
          <Field label="Previous school">
            <input value={form.previousSchool} onChange={(e) => setForm({ ...form, previousSchool: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Home address">
            <textarea rows={2} value={form.homeAddress} onChange={(e) => setForm({ ...form, homeAddress: e.target.value })} />
          </Field>

          {editingId && editingStudent && (
            <>
              <hr className="bsf-divider" />
              <StudentMessages student={editingStudent} data={data} persist={persist} />
            </>
          )}

          <button className="bsf-btn bsf-btn-block" onClick={saveStudent}>{editingId ? "Save changes" : "Save student"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {familyViewStudent && (
        <FamilyViewModal student={familyViewStudent} data={data} onClose={() => setFamilyViewId(null)} />
      )}
    </div>
  );
}

function ClassesTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [studentIds, setStudentIds] = useState([]);
  const [formError, setFormError] = useState("");

  const classes = data.classes || [];
  const sortedStudents = [...data.students].sort((a, b) => {
    const gi = (s) => GRADES.indexOf(s.grade);
    return gi(a) - gi(b) || a.name.localeCompare(b.name);
  });

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setStudentIds([]);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (cls) => {
    setEditingId(cls.id);
    setName(cls.name);
    setStudentIds(cls.studentIds || []);
    setFormError("");
    setShowForm(true);
  };

  const toggleStudent = (id) => {
    setStudentIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const saveClass = () => {
    if (!name.trim()) {
      setFormError("Please enter a class name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, classes: classes.map((c) => (c.id === editingId ? { ...c, name, studentIds } : c)) });
    } else {
      persist({ ...data, classes: [...classes, { id: uid(), name, studentIds }] });
    }
    setShowForm(false);
  };

  const removeClass = (id) => persist({ ...data, classes: classes.filter((c) => c.id !== id) });

  const gradeSpan = (cls) => {
    const grades = [...new Set((cls.studentIds || []).map((id) => data.students.find((s) => s.id === id)?.grade).filter(Boolean))];
    return grades.sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b)).join(", ");
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Classes</h1>
        <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>
      </div>
      {data.students.length === 0 && <p className="bsf-empty">Add students first, then group them into classes here.</p>}

      <section className="bsf-list">
        {classes.length === 0 && data.students.length > 0 && <p className="bsf-empty">No classes yet. Group students by homeroom, even across grade levels.</p>}
        {classes.map((c) => (
          <div key={c.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(c)}>
            <div>
              <strong>{c.name}</strong>
              <p className="bsf-muted">{gradeSpan(c) || "No grades yet"} · {(c.studentIds || []).length} student{(c.studentIds || []).length === 1 ? "" : "s"}</p>
              <div className="bsf-chiprow" style={{ marginTop: 6 }}>
                {(c.studentIds || []).map((id) => {
                  const s = data.students.find((st) => st.id === id);
                  return s ? <span key={id} className="bsf-minitag">{s.name}</span> : null;
                })}
              </div>
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeClass(c.id); }} aria-label="Remove">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit class" : "New class"} onClose={() => setShowForm(false)}>
          <Field label="Class name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pre-Nursery / PreK, Grade 1 / 2" />
          </Field>
          <Field label="Students">
            <div className="bsf-checklist">
              {sortedStudents.map((s) => (
                <label key={s.id} className="bsf-checklist-row">
                  <input type="checkbox" checked={studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                  <span>{s.name} <span className="bsf-muted">· {s.grade}</span></span>
                </label>
              ))}
            </div>
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveClass}>Save class</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

function PortfolioTab({ data, persist }) {
  const { t } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ studentId: "", tag: TAGS[0], note: "", author: "teacher", files: [] });
  const [formError, setFormError] = useState("");

  const entries = [...data.portfolio].sort((a, b) => b.date.localeCompare(a.date));

  const addEntry = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError(t("portfolio.errorChooseStudent"));
      return;
    }
    if (!form.note.trim()) {
      setFormError(t("portfolio.errorAddNote"));
      return;
    }
    const entry = {
      id: uid(),
      studentId: student.id,
      studentName: student.name,
      tag: form.tag,
      note: form.note,
      author: form.author,
      files: form.files,
      date: new Date().toISOString().slice(0, 10)
    };
    persist({ ...data, portfolio: [...data.portfolio, entry] });
    setForm({ studentId: "", tag: TAGS[0], note: "", author: "teacher", files: [] });
    setFormError("");
    setShowAdd(false);
  };

  const removeEntry = (id) => persist({ ...data, portfolio: data.portfolio.filter((p) => p.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>{t("portfolio.title")}</h1>
        <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }} disabled={data.students.length === 0}><Plus size={16} /> {t("common.add")}</button>
      </div>
      {data.students.length === 0 && <p className="bsf-empty">{t("portfolio.emptyStudents")}</p>}

      <section className="bsf-list">
        {entries.map((p) => (
          <div key={p.id} className="bsf-card bsf-student">
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{t(`tag.${p.tag}`)}</span>
                <span className="bsf-muted">{p.date}</span>
              </div>
              <div className="bsf-row-head">
                <strong>{p.studentName}</strong>
                <span className={`bsf-author-badge ${p.author === "student" ? "student" : "teacher"}`}>
                  {p.author === "student" ? t("portfolio.studentReflection") : t("portfolio.teacherNote")}
                </span>
              </div>
              <p>{p.note}</p>
              {(p.files || []).length > 0 && (
                <AttachmentField
                  folder="portfolio"
                  files={p.files}
                  onChange={(files) =>
                    persist({ ...data, portfolio: data.portfolio.map((e) => (e.id === p.id ? { ...e, files } : e)) })
                  }
                />
              )}
            </div>
            <button className="bsf-iconbtn" onClick={() => removeEntry(p.id)} aria-label={t("common.remove")}><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showAdd && (
        <Modal title={t("portfolio.newEntry")} onClose={() => setShowAdd(false)}>
          <Field label={t("portfolio.entryType")}>
            <div className="bsf-chiprow">
              <button
                type="button"
                className={`bsf-chip ${form.author === "teacher" ? "active" : ""}`}
                onClick={() => setForm({ ...form, author: "teacher" })}
              >
                {t("portfolio.teacherNote")}
              </button>
              <button
                type="button"
                className={`bsf-chip ${form.author === "student" ? "active" : ""}`}
                onClick={() => setForm({ ...form, author: "student" })}
              >
                {t("portfolio.studentReflection")}
              </button>
            </div>
          </Field>
          <Field label={t("portfolio.student")}>
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">{t("portfolio.chooseStudent")}</option>
              {data.students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
          </Field>
          <Field label={t("portfolio.focusArea")}>
            <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
              {TAGS.map((tg) => <option key={tg} value={tg}>{t(`tag.${tg}`)}</option>)}
            </select>
          </Field>
          <Field label={form.author === "student" ? t("portfolio.whatStudentWrote") : t("portfolio.whatDidTheyDo")}>
            <textarea
              rows={4}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={form.author === "student" ? t("portfolio.placeholderStudentWords") : t("portfolio.placeholderLearningMoment")}
            />
          </Field>
          <Field label={t("portfolio.attachmentsOptional")}>
            <AttachmentField folder="portfolio" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addEntry}>{t("portfolio.saveEntry")}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyPlanForm = {
  grades: [],
  theme: "",
  subject: "",
  title: "",
  centralIdea: "",
  keyConcepts: "",
  linesOfInquiry: "",
  keyVocabulary: "",
  learningOutcomes: "",
  atlSkills: "",
  learnerProfileFocus: "",
  differentiation: "",
  resources: "",
  startDate: "",
  endDate: "",
  lessonPlanText: "",
  lessonPlanLink: "",
  lessonPlanFiles: [],
  assessmentFormative: "",
  evidenceLink: "",
  evidenceNotes: "",
  evidenceFiles: [],
  assessmentSummative: "",
  studentAction: "",
  reflection: "",
  comments: []
};

function PlanDetailModal({ plan, onClose, onUpdate }) {
  const [lessonPlanText, setLessonPlanText] = useState(plan.lessonPlanText || "");
  const [lessonPlanLink, setLessonPlanLink] = useState(plan.lessonPlanLink || "");
  const [assessmentFormative, setAssessmentFormative] = useState(plan.assessmentFormative || "");
  const [evidenceLink, setEvidenceLink] = useState(plan.evidenceLink || "");
  const [evidenceNotes, setEvidenceNotes] = useState(plan.evidenceNotes || "");
  const [assessmentSummative, setAssessmentSummative] = useState(plan.assessmentSummative || "");
  const [studentAction, setStudentAction] = useState(plan.studentAction || "");
  const [reflection, setReflection] = useState(plan.reflection || "");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");

  const saveField = (patch) => onUpdate(plan.id, patch);

  const addComment = () => {
    if (!commentText.trim()) return;
    const comment = {
      id: uid(),
      author: commentAuthor.trim() || "Team member",
      text: commentText.trim(),
      date: new Date().toISOString().slice(0, 10)
    };
    onUpdate(plan.id, { comments: [...(plan.comments || []), comment] });
    setCommentText("");
  };

  const removeComment = (id) => {
    onUpdate(plan.id, { comments: (plan.comments || []).filter((c) => c.id !== id) });
  };

  return (
    <Modal title={plan.title} onClose={onClose}>
      <div className="bsf-row-head">
        <span className="bsf-tag">
          {plan.grades && plan.grades.length === GRADES.length ? "All grades" : (plan.grades || []).join(", ") || plan.grade}
        </span>
        {plan.subject && <span className="bsf-muted">{plan.subject}</span>}
      </div>
      {plan.theme && <p className="bsf-muted">Theme: {plan.theme}</p>}
      {plan.centralIdea && <p>{plan.centralIdea}</p>}
      {plan.keyConcepts && <p className="bsf-muted">Key concepts: {plan.keyConcepts}</p>}
      {plan.linesOfInquiry && <p className="bsf-loi">{plan.linesOfInquiry}</p>}

      <hr className="bsf-divider" />

      <Field label="Lesson plan notes">
        <textarea
          rows={5}
          value={lessonPlanText}
          onChange={(e) => setLessonPlanText(e.target.value)}
          onBlur={() => saveField({ lessonPlanText })}
          placeholder="Paste or write the lesson plan content here"
        />
      </Field>
      <Field label="Lesson plan link (optional)">
        <input
          value={lessonPlanLink}
          onChange={(e) => setLessonPlanLink(e.target.value)}
          onBlur={() => saveField({ lessonPlanLink })}
          placeholder="Link to a doc, if it lives elsewhere"
        />
      </Field>
      <Field label="Lesson plan attachments">
        <AttachmentField
          folder="planning"
          files={plan.lessonPlanFiles}
          onChange={(files) => saveField({ lessonPlanFiles: files })}
        />
      </Field>
      <Field label="Assessment (formative)">
        <textarea
          rows={3}
          value={assessmentFormative}
          onChange={(e) => setAssessmentFormative(e.target.value)}
          onBlur={() => saveField({ assessmentFormative })}
          placeholder="Quick checks along the way to see how understanding is developing"
        />
      </Field>

      <hr className="bsf-divider" />

      <Field label="Evidence link">
        <input
          value={evidenceLink}
          onChange={(e) => setEvidenceLink(e.target.value)}
          onBlur={() => saveField({ evidenceLink })}
          placeholder="Link to photos, documents, or student work"
        />
      </Field>
      <Field label="Evidence notes">
        <textarea
          rows={3}
          value={evidenceNotes}
          onChange={(e) => setEvidenceNotes(e.target.value)}
          onBlur={() => saveField({ evidenceNotes })}
          placeholder="Describe what the evidence shows"
        />
      </Field>
      <Field label="Evidence attachments">
        <AttachmentField
          folder="planning"
          files={plan.evidenceFiles}
          onChange={(files) => saveField({ evidenceFiles: files })}
        />
      </Field>
      <Field label="Assessment (summative)">
        <textarea
          rows={3}
          value={assessmentSummative}
          onChange={(e) => setAssessmentSummative(e.target.value)}
          onBlur={() => saveField({ assessmentSummative })}
          placeholder="The final task or product that shows understanding"
        />
      </Field>

      <hr className="bsf-divider" />

      <Field label="Student action">
        <textarea
          rows={3}
          value={studentAction}
          onChange={(e) => setStudentAction(e.target.value)}
          onBlur={() => saveField({ studentAction })}
          placeholder="How learning connects to something students do or change beyond the classroom"
        />
      </Field>

      <Field label="Reflection">
        <textarea
          rows={4}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          onBlur={() => saveField({ reflection })}
          placeholder="What worked, what would you change next time"
        />
      </Field>

      <hr className="bsf-divider" />

      <h3 className="bsf-subheading">Team notes</h3>
      <div className="bsf-comments">
        {(plan.comments || []).length === 0 && <p className="bsf-empty">No notes yet. Teachers can leave one below.</p>}
        {(plan.comments || []).map((c) => (
          <div key={c.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{c.author}</strong>
              <span className="bsf-muted">{c.date}</span>
            </div>
            <p>{c.text}</p>
            <button className="bsf-textbtn" onClick={() => removeComment(c.id)}>Remove</button>
          </div>
        ))}
      </div>
      <Field label="Your name">
        <input value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} placeholder="e.g. Myriam" />
      </Field>
      <Field label="Add a note">
        <textarea rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Share a thought with the team" />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addComment}>Post note</button>
    </Modal>
  );
}

function PlanningTab({ data, persist }) {
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(emptyPlanForm);
  const [formError, setFormError] = useState("");
  const [gradeFilter, setGradeFilter] = useState(null);

  const plans = [...data.plans].sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  const filtered = gradeFilter
    ? plans.filter((p) => (p.grades || []).includes(gradeFilter))
    : plans;
  const allSelected = form.grades.length === GRADES.length;
  const detailPlan = data.plans.find((p) => p.id === detailId);

  const toggleGrade = (g) => {
    setForm((f) => ({
      ...f,
      grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g]
    }));
  };

  const toggleAllGrades = () => {
    setForm((f) => ({ ...f, grades: allSelected ? [] : [...GRADES] }));
  };

  const applyTemplate = () => {
    setForm((f) => ({
      ...f,
      centralIdea: f.centralIdea || PLAN_TEMPLATE.centralIdea,
      keyConcepts: f.keyConcepts || PLAN_TEMPLATE.keyConcepts,
      linesOfInquiry: f.linesOfInquiry || PLAN_TEMPLATE.linesOfInquiry
    }));
  };

  const addPlan = () => {
    if (!form.title.trim() || form.grades.length === 0) {
      setFormError("Please add a title and choose at least one grade.");
      return;
    }
    persist({ ...data, plans: [...data.plans, { id: uid(), ...form }] });
    setForm(emptyPlanForm);
    setFormError("");
    setShowAdd(false);
  };

  const removePlan = (id) => persist({ ...data, plans: data.plans.filter((p) => p.id !== id) });

  const updatePlan = (id, patch) => {
    persist({ ...data, plans: data.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Planning</h1>
        <button className="bsf-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button>
      </div>

      <div className="bsf-chiprow">
        <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
        {GRADES.map((g) => (
          <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
        ))}
      </div>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No units planned yet.</p>}
        {filtered.map((p) => (
          <div key={p.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setDetailId(p.id)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">
                  {p.grades && p.grades.length === GRADES.length
                    ? "All grades"
                    : (p.grades || []).join(", ") || p.grade}
                </span>
                {p.subject && <span className="bsf-muted">{p.subject}</span>}
              </div>
              {p.theme && <p className="bsf-muted">Theme: {p.theme}</p>}
              <strong>{p.title}</strong>
              {p.centralIdea && <p>{p.centralIdea}</p>}
              {p.keyConcepts && <p className="bsf-muted">Key concepts: {p.keyConcepts}</p>}
              {p.linesOfInquiry && <p className="bsf-loi">{p.linesOfInquiry}</p>}
              {(p.startDate || p.endDate) && <p className="bsf-muted">{p.startDate || "?"} to {p.endDate || "?"}</p>}
              <div className="bsf-chiprow bsf-status-chips">
                {p.lessonPlanText || p.lessonPlanLink ? <span className="bsf-minitag">Lesson plan</span> : null}
                {p.evidenceLink || p.evidenceNotes ? <span className="bsf-minitag">Evidence</span> : null}
                {p.reflection ? <span className="bsf-minitag">Reflection</span> : null}
                {(p.comments || []).length > 0 ? <span className="bsf-minitag">{p.comments.length} note{p.comments.length === 1 ? "" : "s"}</span> : null}
              </div>
            </div>
            <button
              className="bsf-iconbtn"
              onClick={(e) => { e.stopPropagation(); removePlan(p.id); }}
              aria-label="Remove"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>

      {showAdd && (
        <Modal title="New unit plan" onClose={() => setShowAdd(false)}>
          <Field label="Grades covered">
            <div className="bsf-chiprow">
              <button className={`bsf-chip ${allSelected ? "active" : ""}`} onClick={toggleAllGrades}>All grades</button>
              {GRADES.map((g) => (
                <button
                  key={g}
                  className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`}
                  onClick={() => toggleGrade(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Transdisciplinary theme">
            <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
              <option value="">No theme</option>
              {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Science, Literacy, or Whole school" />
          </Field>
          <Field label="Unit title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. How the World Works" />
          </Field>

          <button type="button" className="bsf-templatebtn" onClick={applyTemplate}>Fill in unit plan template</button>

          <Field label="Central idea">
            <textarea rows={3} value={form.centralIdea} onChange={(e) => setForm({ ...form, centralIdea: e.target.value })} placeholder="What big idea drives this unit" />
          </Field>
          <Field label="Key concepts">
            <input value={form.keyConcepts} onChange={(e) => setForm({ ...form, keyConcepts: e.target.value })} placeholder="e.g. Form, Change, Connection" />
          </Field>
          <Field label="Lines of inquiry">
            <textarea rows={3} value={form.linesOfInquiry} onChange={(e) => setForm({ ...form, linesOfInquiry: e.target.value })} placeholder="One idea per line" />
          </Field>
          <Field label="Key vocabulary">
            <textarea rows={2} value={form.keyVocabulary} onChange={(e) => setForm({ ...form, keyVocabulary: e.target.value })} placeholder="Important words students should know by the end" />
          </Field>
          <Field label="Learning outcomes">
            <textarea rows={3} value={form.learningOutcomes} onChange={(e) => setForm({ ...form, learningOutcomes: e.target.value })} placeholder="What students should know or be able to do" />
          </Field>
          <Field label="Approaches to learning skills">
            <textarea rows={2} value={form.atlSkills} onChange={(e) => setForm({ ...form, atlSkills: e.target.value })} placeholder="e.g. Research, communication, self management" />
          </Field>
          <Field label="Learner profile focus">
            <input value={form.learnerProfileFocus} onChange={(e) => setForm({ ...form, learnerProfileFocus: e.target.value })} placeholder="e.g. Curious, caring, reflective" />
          </Field>
          <Field label="Differentiation">
            <textarea rows={3} value={form.differentiation} onChange={(e) => setForm({ ...form, differentiation: e.target.value })} placeholder="How the unit adapts for different learners" />
          </Field>
          <Field label="Resources and materials">
            <textarea rows={2} value={form.resources} onChange={(e) => setForm({ ...form, resources: e.target.value })} placeholder="Books, websites, supplies needed" />
          </Field>
          <div className="bsf-two-col">
            <Field label="Start date">
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field label="End date">
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <button className="bsf-btn bsf-btn-block" onClick={addPlan}>Save unit plan</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {detailPlan && (
        <PlanDetailModal plan={detailPlan} onClose={() => setDetailId(null)} onUpdate={updatePlan} />
      )}
    </div>
  );
}

function UpdatesTab({ data, persist }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ titleEn: "", bodyEn: "", titleFr: "", bodyFr: "" });
  const [formError, setFormError] = useState("");

  const posts = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date));

  const addPost = () => {
    if (!form.titleEn.trim()) {
      setFormError("Please add an English title before posting.");
      return;
    }
    const post = { id: uid(), ...form, date: new Date().toISOString().slice(0, 10) };
    persist({ ...data, announcements: [...data.announcements, post] });
    setForm({ titleEn: "", bodyEn: "", titleFr: "", bodyFr: "" });
    setFormError("");
    setShowAdd(false);
  };

  const removePost = (id) => persist({ ...data, announcements: data.announcements.filter((a) => a.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Family Updates</h1>
        <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }}><Plus size={16} /> Post</button>
      </div>

      <section className="bsf-list">
        {posts.length === 0 && <p className="bsf-empty">Nothing posted yet.</p>}
        {posts.map((a) => (
          <div key={a.id} className="bsf-card bsf-student">
            <div>
              <span className="bsf-muted">{a.date}</span>
              <strong>{a.titleEn}</strong>
              <p>{a.bodyEn}</p>
              {a.titleFr && (
                <div className="bsf-fr-block">
                  <strong>{a.titleFr}</strong>
                  <p>{a.bodyFr}</p>
                </div>
              )}
            </div>
            <button className="bsf-iconbtn" onClick={() => removePost(a.id)} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showAdd && (
        <Modal title="New family update" onClose={() => setShowAdd(false)}>
          <Field label="Title (English)">
            <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
          </Field>
          <Field label="Message (English)">
            <textarea rows={3} value={form.bodyEn} onChange={(e) => setForm({ ...form, bodyEn: e.target.value })} />
          </Field>
          <Field label="Titre (Francais)">
            <input value={form.titleFr} onChange={(e) => setForm({ ...form, titleFr: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Message (Francais)">
            <textarea rows={3} value={form.bodyFr} onChange={(e) => setForm({ ...form, bodyFr: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addPost}>Publish update</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const STATUS_CYCLE = ["present", "absent", "late"];
const STATUS_LABEL = { present: "Present", absent: "Absent", late: "Late" };
const STATUS_COLOR = { present: "#2F7A5C", absent: "#B5473B", late: "#B8842F" };

function AttendanceTab({ data, persist }) {
  const [date, setDate] = useState(todayStr());
  const [activeGrade, setActiveGrade] = useState(GRADES[0]);

  const dayRecord = data.attendance[date] || {};
  const gradeStudents = data.students.filter((s) => s.grade === activeGrade);

  const setStatus = (studentId, status) => {
    const nextDay = { ...dayRecord, [studentId]: status };
    persist({ ...data, attendance: { ...data.attendance, [date]: nextDay } });
  };

  const cycleStatus = (studentId) => {
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
      if (st) counts[st] += 1; else counts.unmarked += 1;
    });
    return counts;
  }, [dayRecord, gradeStudents]);

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Attendance</h1>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bsf-dateinput" />
      </div>

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

      <section className="bsf-card">
        <div className="bsf-row-head">
          <h2>{activeGrade}</h2>
          <button className="bsf-btn" onClick={markAllPresent} disabled={gradeStudents.length === 0}>Mark all present</button>
        </div>
        <p className="bsf-muted">
          {summary.present} present · {summary.absent} absent · {summary.late} late · {summary.unmarked} unmarked
        </p>
      </section>

      <section className="bsf-list">
        {gradeStudents.length === 0 && <p className="bsf-empty">No students in this grade yet.</p>}
        {gradeStudents.map((s) => {
          const status = dayRecord[s.id];
          return (
            <button key={s.id} className="bsf-card bsf-attend-row" onClick={() => cycleStatus(s.id)}>
              <span>
                <strong>{s.name}</strong>
              </span>
              <span
                className="bsf-status-pill"
                style={{
                  background: status ? `${STATUS_COLOR[status]}1A` : "#EEE6D2",
                  color: status ? STATUS_COLOR[status] : "#8A9698"
                }}
              >
                {status ? STATUS_LABEL[status] : "Tap to mark"}
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function RubricLibraryModal({ data, persist, onClose }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [itemsText, setItemsText] = useState("");

  const rubrics = data.rubrics || [];

  const addRubric = () => {
    const items = itemsText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!name.trim() || items.length === 0) return;
    const rubric = { id: uid(), name: name.trim(), subject: subject.trim(), items };
    persist({ ...data, rubrics: [...rubrics, rubric] });
    setName(""); setSubject(""); setItemsText("");
  };

  const removeRubric = (id) => persist({ ...data, rubrics: rubrics.filter((r) => r.id !== id) });

  return (
    <Modal title="Rubric library" onClose={onClose}>
      <p className="bsf-muted" style={{ marginBottom: 12 }}>Build reusable rubrics once, then apply them when recording an assessment.</p>

      <div className="bsf-comments">
        {rubrics.length === 0 && <p className="bsf-empty">No rubrics saved yet.</p>}
        {rubrics.map((r) => (
          <div key={r.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{r.name}</strong>
              <button className="bsf-textbtn" onClick={() => removeRubric(r.id)}>Remove</button>
            </div>
            {r.subject && <p className="bsf-muted">{r.subject}</p>}
            <ul className="bsf-rubric-items">
              {r.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">New rubric</h3>
      <Field label="Rubric name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Writing a paragraph" />
      </Field>
      <Field label="Subject (optional)">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Literacy" />
      </Field>
      <Field label="Criteria, one per line">
        <textarea rows={4} value={itemsText} onChange={(e) => setItemsText(e.target.value)} placeholder={"Uses a clear topic sentence\nSupports ideas with detail\nUses correct punctuation"} />
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addRubric}>Save rubric</button>
    </Modal>
  );
}

function StandardsLibraryModal({ data, persist, onClose }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

  const standards = data.standards || [];

  const addStandard = () => {
    if (!description.trim()) return;
    const standard = { id: uid(), code: code.trim(), description: description.trim(), subject: subject.trim(), grade };
    persist({ ...data, standards: [...standards, standard] });
    setCode(""); setDescription(""); setSubject(""); setGrade("");
  };

  const removeStandard = (id) => persist({ ...data, standards: standards.filter((s) => s.id !== id) });

  return (
    <Modal title="Standards library" onClose={onClose}>
      <p className="bsf-muted" style={{ marginBottom: 12 }}>Build a list of curriculum standards once, then tag assessments to them to track progress over time.</p>

      <div className="bsf-comments">
        {standards.length === 0 && <p className="bsf-empty">No standards added yet.</p>}
        {standards.map((s) => (
          <div key={s.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{s.code ? `${s.code} · ` : ""}{s.subject}{s.grade ? ` · ${s.grade}` : ""}</strong>
              <button className="bsf-textbtn" onClick={() => removeStandard(s.id)}>Remove</button>
            </div>
            <p>{s.description}</p>
          </div>
        ))}
      </div>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">New standard</h3>
      <Field label="Code (optional)">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CCSS.MATH.3.OA.1" />
      </Field>
      <Field label="Description">
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Solves two step word problems" />
      </Field>
      <Field label="Subject">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Math" />
      </Field>
      <Field label="Grade (optional)">
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Any grade</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Field>
      <button className="bsf-btn bsf-btn-block" onClick={addStandard}>Save standard</button>
    </Modal>
  );
}

function AssessmentTab({ data, persist }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showRubrics, setShowRubrics] = useState(false);
  const [showStandards, setShowStandards] = useState(false);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    studentId: "", planId: "", subject: "", criteria: "", level: ASSESS_LEVELS[1],
    feedback: "", rubricId: "", rows: [], standardId: ""
  });

  const assessments = [...(data.assessments || [])].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = gradeFilter ? assessments.filter((a) => a.grade === gradeFilter) : assessments;
  const rubrics = data.rubrics || [];
  const standards = data.standards || [];

  const eligiblePlans = form.studentId
    ? data.plans.filter((p) => {
        const student = data.students.find((s) => s.id === form.studentId);
        if (!student) return false;
        return !p.grades || p.grades.length === 0 || p.grades.includes(student.grade);
      })
    : data.plans;

  const applyRubric = (rubricId) => {
    const rubric = rubrics.find((r) => r.id === rubricId);
    setForm((f) => ({
      ...f,
      rubricId,
      subject: rubric && !f.subject ? (rubric.subject || f.subject) : f.subject,
      rows: rubric ? rubric.items.map((text) => ({ text, level: ASSESS_LEVELS[1] })) : []
    }));
  };

  const setRowLevel = (idx, level) => {
    setForm((f) => ({ ...f, rows: f.rows.map((r, i) => (i === idx ? { ...r, level } : r)) }));
  };

  const addAssessment = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    const usingRubric = form.rubricId && form.rows.length > 0;
    if (!usingRubric && !form.criteria.trim()) {
      setFormError("Please describe what was assessed, or choose a rubric.");
      return;
    }
    const plan = data.plans.find((p) => p.id === form.planId);
    const rubric = rubrics.find((r) => r.id === form.rubricId);
    const standard = standards.find((s) => s.id === form.standardId);
    const entry = {
      id: uid(),
      studentId: student.id,
      studentName: student.name,
      grade: student.grade,
      planId: plan ? plan.id : "",
      planTitle: plan ? plan.title : "",
      subject: form.subject,
      feedback: form.feedback,
      standardId: form.standardId,
      standardLabel: standard ? (standard.code ? `${standard.code} - ${standard.description}` : standard.description) : "",
      date: new Date().toISOString().slice(0, 10),
      ...(usingRubric
        ? { rubricName: rubric ? rubric.name : "", rows: form.rows }
        : { criteria: form.criteria, level: form.level })
    };
    persist({ ...data, assessments: [...(data.assessments || []), entry] });
    setForm({ studentId: "", planId: "", subject: "", criteria: "", level: ASSESS_LEVELS[1], feedback: "", rubricId: "", rows: [], standardId: "" });
    setFormError("");
    setGradeFilter(null);
    setShowAdd(false);
  };

  const removeAssessment = (id) => persist({ ...data, assessments: (data.assessments || []).filter((a) => a.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Assessment</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="bsf-btn bsf-btn-ghost" onClick={() => setShowStandards(true)}>Standards</button>
          <button className="bsf-btn bsf-btn-ghost" onClick={() => setShowRubrics(true)}>Rubrics</button>
          <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }} disabled={data.students.length === 0}><Plus size={16} /> Add</button>
        </div>
      </div>
      {data.students.length === 0 && <p className="bsf-empty">Add students first, then record assessments here.</p>}

      {data.students.length > 0 && (
        <section className="bsf-card">
          <h2>Filter by grade</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {GRADES.map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No assessments recorded yet.</p>}
        {filtered.map((a) => (
          <div key={a.id} className="bsf-card bsf-student">
            <div>
              <div className="bsf-row-head">
                {a.rows && a.rows.length > 0 ? (
                  <span className="bsf-tag">{a.rubricName || "Rubric"}</span>
                ) : (
                  <span
                    className="bsf-status-pill"
                    style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}
                  >
                    {a.level}
                  </span>
                )}
                <span className="bsf-muted">{a.date}</span>
              </div>
              <strong>{a.studentName}</strong>
              <p className="bsf-muted">{a.grade}{a.subject ? ` · ${a.subject}` : ""}{a.planTitle ? ` · ${a.planTitle}` : ""}</p>
              {a.rows && a.rows.length > 0 ? (
                <div className="bsf-rubric-rows">
                  {a.rows.map((r, i) => (
                    <div key={i} className="bsf-rubric-row">
                      <span>{r.text}</span>
                      <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>
                        {r.level}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{a.criteria}</p>
              )}
              {a.feedback && <p className="bsf-muted">{a.feedback}</p>}
              {a.standardLabel && <p className="bsf-muted">Standard: {a.standardLabel}</p>}
            </div>
            <button className="bsf-iconbtn" onClick={() => removeAssessment(a.id)} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showAdd && (
        <Modal title="New assessment" onClose={() => setShowAdd(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value, planId: "" })}>
              <option value="">Choose a student</option>
              {data.students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
          </Field>
          <Field label="Linked unit plan (optional)">
            <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              <option value="">No unit plan</option>
              {eligiblePlans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math, Literacy" />
          </Field>
          <Field label="Use a rubric (optional)">
            <select value={form.rubricId} onChange={(e) => applyRubric(e.target.value)}>
              <option value="">No rubric, use free text below</option>
              {rubrics.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Linked standard (optional)">
            <select value={form.standardId} onChange={(e) => setForm({ ...form, standardId: e.target.value })}>
              <option value="">No standard</option>
              {standards.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} - ` : ""}{s.description}</option>)}
            </select>
          </Field>

          {form.rows.length > 0 ? (
            <div className="bsf-rubric-form">
              {form.rows.map((row, idx) => (
                <div key={idx} className="bsf-rubric-form-row">
                  <p className="bsf-rubric-form-label">{row.text}</p>
                  <div className="bsf-chiprow">
                    {ASSESS_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        className={`bsf-chip ${row.level === lvl ? "active" : ""}`}
                        onClick={() => setRowLevel(idx, lvl)}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Field label="What was assessed">
                <input value={form.criteria} onChange={(e) => setForm({ ...form, criteria: e.target.value })} placeholder="e.g. Adding two digit numbers" />
              </Field>
              <Field label="Level">
                <div className="bsf-chiprow">
                  {ASSESS_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      className={`bsf-chip ${form.level === lvl ? "active" : ""}`}
                      onClick={() => setForm({ ...form, level: lvl })}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field label="Feedback">
            <textarea rows={3} value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} placeholder="Notes for the student or family" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addAssessment}>Save assessment</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {showRubrics && <RubricLibraryModal data={data} persist={persist} onClose={() => setShowRubrics(false)} />}
      {showStandards && <StandardsLibraryModal data={data} persist={persist} onClose={() => setShowStandards(false)} />}
    </div>
  );
}

const OFFICIAL_CALENDAR_2026_27 = [
  { title: "Faculty Orientation", type: "Staff", date: "2026-08-17", endDate: "2026-08-25" },
  { title: "Prophet's Birthday", type: "Holiday", date: "2026-08-26" },
  { title: "First Day of School", type: "Academic", date: "2026-08-27" },
  { title: "Welcome Coffee", type: "Event", date: "2026-09-04" },
  { title: "Halloween / Culture Day", type: "Event", date: "2026-10-16" },
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

function CalendarTab({ data, persist }) {
  const [showAdd, setShowAdd] = useState(false);
  const [typeFilter, setTypeFilter] = useState(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ title: "", type: EVENT_TYPES[0], date: "", endDate: "", grades: [], description: "" });

  const events = [...(data.events || [])].sort((a, b) => a.date.localeCompare(b.date));
  const today = todayStr();
  const filtered = typeFilter ? events.filter((e) => e.type === typeFilter) : events;
  const upcoming = filtered.filter((e) => (e.endDate || e.date) >= today);
  const past = filtered.filter((e) => (e.endDate || e.date) < today);

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g] }));
  };

  const addEvent = () => {
    if (!form.title.trim() || !form.date) {
      setFormError("Please add a title and a date.");
      return;
    }
    persist({ ...data, events: [...(data.events || []), { id: uid(), ...form }] });
    setForm({ title: "", type: EVENT_TYPES[0], date: "", endDate: "", grades: [], description: "" });
    setFormError("");
    setTypeFilter(null);
    setShowAdd(false);
  };

  const removeEvent = (id) => persist({ ...data, events: (data.events || []).filter((e) => e.id !== id) });

  const alreadyLoaded = OFFICIAL_CALENDAR_2026_27.every((oe) =>
    (data.events || []).some((e) => e.title === oe.title && e.date === oe.date)
  );

  const importOfficialCalendar = () => {
    const existing = data.events || [];
    const toAdd = OFFICIAL_CALENDAR_2026_27.filter(
      (oe) => !existing.some((e) => e.title === oe.title && e.date === oe.date)
    ).map((oe) => ({ id: uid(), grades: [], description: "", ...oe }));
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
            {e.type}
          </span>
          <span className="bsf-muted">{e.date}{e.endDate && e.endDate !== e.date ? ` to ${e.endDate}` : ""}</span>
        </div>
        <strong>{e.title}</strong>
        <p className="bsf-muted">{e.grades && e.grades.length > 0 ? e.grades.join(", ") : "Whole school"}</p>
        {e.description && <p>{e.description}</p>}
      </div>
      <button className="bsf-iconbtn" onClick={() => removeEvent(e.id)} aria-label="Remove"><Trash2 size={16} /></button>
    </div>
  );

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Calendar</h1>
        <button className="bsf-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Add</button>
      </div>

      {!alreadyLoaded && (
        <button type="button" className="bsf-templatebtn" onClick={importOfficialCalendar}>
          Load the 2026–27 academic calendar
        </button>
      )}

      <section className="bsf-card">
        <h2>Filter by type</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${typeFilter === null ? "active" : ""}`} onClick={() => setTypeFilter(null)}>All</button>
          {EVENT_TYPES.map((t) => (
            <button key={t} className={`bsf-chip ${typeFilter === t ? "active" : ""}`} onClick={() => setTypeFilter(t)}>{t}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        <h2 className="bsf-listheading">Upcoming</h2>
        {upcoming.length === 0 && <p className="bsf-empty">Nothing scheduled yet.</p>}
        {upcoming.map(renderEvent)}
      </section>

      {past.length > 0 && (
        <section className="bsf-list">
          <h2 className="bsf-listheading">Past</h2>
          {past.map(renderEvent)}
        </section>
      )}

      {showAdd && (
        <Modal title="New calendar event" onClose={() => setShowAdd(false)}>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Welcome Coffee" />
          </Field>
          <Field label="Type">
            <div className="bsf-chiprow">
              {EVENT_TYPES.map((t) => (
                <button key={t} type="button" className={`bsf-chip ${form.type === t ? "active" : ""}`} onClick={() => setForm({ ...form, type: t })}>{t}</button>
              ))}
            </div>
          </Field>
          <div className="bsf-two-col">
            <Field label="Date">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="End date (optional)">
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
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

const emptyAdmissionForm = {
  childName: "", gradeInterested: GRADES[0], guardianName: "", guardianContact: "",
  source: ADMISSION_SOURCES[0], stage: ADMISSION_STAGES[0], inquiryDate: "", followUpDate: "", notes: ""
};

function AdmissionsTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [stageFilter, setStageFilter] = useState(null);
  const [form, setForm] = useState(emptyAdmissionForm);
  const [formError, setFormError] = useState("");

  const admissions = [...(data.admissions || [])].sort((a, b) => (b.inquiryDate || "").localeCompare(a.inquiryDate || ""));
  const filtered = stageFilter ? admissions.filter((a) => a.stage === stageFilter) : admissions;

  const counts = useMemo(() => {
    const c = {};
    (data.admissions || []).forEach((a) => { c[a.stage] = (c[a.stage] || 0) + 1; });
    return c;
  }, [data.admissions]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyAdmissionForm, inquiryDate: todayStr() });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({ ...emptyAdmissionForm, ...a });
    setFormError("");
    setShowForm(true);
  };

  const saveAdmission = () => {
    if (!form.childName.trim()) {
      setFormError("Please enter the child's name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, admissions: (data.admissions || []).map((a) => (a.id === editingId ? { ...a, ...form } : a)) });
    } else {
      persist({ ...data, admissions: [...(data.admissions || []), { id: uid(), ...form }] });
      setStageFilter(null);
    }
    setForm(emptyAdmissionForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeAdmission = (id) => persist({ ...data, admissions: (data.admissions || []).filter((a) => a.id !== id) });

  const convertToStudent = (a) => {
    const parts = a.childName.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
    const newStudent = {
      id: uid(),
      ...emptyStudentForm,
      firstName,
      lastName,
      name: a.childName,
      grade: a.gradeInterested,
      guardian1Name: a.guardianName,
      guardian1Phone: a.guardianContact,
      enrollmentDate: todayStr()
    };
    persist({
      ...data,
      students: [...data.students, newStudent],
      admissions: data.admissions.map((x) => (x.id === a.id ? { ...x, addedToRoster: true } : x))
    });
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Admissions</h1>
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>

      <section className="bsf-card">
        <h2>Filter by stage</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${stageFilter === null ? "active" : ""}`} onClick={() => setStageFilter(null)}>All ({admissions.length})</button>
          {ADMISSION_STAGES.map((s) => (
            <button key={s} className={`bsf-chip ${stageFilter === s ? "active" : ""}`} onClick={() => setStageFilter(s)}>
              {s} ({counts[s] || 0})
            </button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No admissions leads yet.</p>}
        {filtered.map((a) => (
          <div key={a.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(a)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-status-pill" style={{ background: `${ADMISSION_STAGE_COLOR[a.stage]}1A`, color: ADMISSION_STAGE_COLOR[a.stage] }}>
                  {a.stage}
                </span>
                <span className="bsf-muted">{a.inquiryDate}</span>
              </div>
              <strong>{a.childName}</strong>
              <p className="bsf-muted">{a.gradeInterested} · {a.source}</p>
              {a.guardianName && <p className="bsf-muted">{a.guardianName}{a.guardianContact ? ` · ${a.guardianContact}` : ""}</p>}
              {a.followUpDate && <p className="bsf-muted">Follow up: {a.followUpDate}</p>}
              {a.notes && <p>{a.notes}</p>}
              {a.stage === "Enrolled" && !a.addedToRoster && (
                <button className="bsf-textbtn" onClick={(e) => { e.stopPropagation(); convertToStudent(a); }}>Add to Students roster</button>
              )}
              {a.addedToRoster && <span className="bsf-minitag">Added to roster</span>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeAdmission(a.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit admissions lead" : "New admissions lead"} onClose={() => setShowForm(false)}>
          <Field label="Child's name">
            <input value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Grade interested">
            <select value={form.gradeInterested} onChange={(e) => setForm({ ...form, gradeInterested: e.target.value })}>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Guardian name">
            <input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
          </Field>
          <Field label="Guardian contact">
            <input value={form.guardianContact} onChange={(e) => setForm({ ...form, guardianContact: e.target.value })} placeholder="Phone or WhatsApp" />
          </Field>
          <Field label="Source">
            <div className="bsf-chiprow">
              {ADMISSION_SOURCES.map((s) => (
                <button key={s} type="button" className={`bsf-chip ${form.source === s ? "active" : ""}`} onClick={() => setForm({ ...form, source: s })}>{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Stage">
            <div className="bsf-chiprow">
              {ADMISSION_STAGES.map((s) => (
                <button key={s} type="button" className={`bsf-chip ${form.stage === s ? "active" : ""}`} onClick={() => setForm({ ...form, stage: s })}>{s}</button>
              ))}
            </div>
          </Field>
          <div className="bsf-two-col">
            <Field label="Inquiry date">
              <input type="date" value={form.inquiryDate} onChange={(e) => setForm({ ...form, inquiryDate: e.target.value })} />
            </Field>
            <Field label="Follow up date">
              <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Tour feedback, questions, anything worth remembering" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveAdmission}>{editingId ? "Save changes" : "Save lead"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyAssignmentForm = { title: "", description: "", grades: [], subject: "", dueDate: "", link: "", files: [] };

function AssignmentsTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [form, setForm] = useState(emptyAssignmentForm);
  const [formError, setFormError] = useState("");

  const today = todayStr();
  const assignments = [...(data.assignments || [])].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const filtered = gradeFilter ? assignments.filter((a) => (a.grades || []).includes(gradeFilter)) : assignments;
  const upcoming = filtered.filter((a) => !a.dueDate || a.dueDate >= today);
  const past = filtered.filter((a) => a.dueDate && a.dueDate < today);

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g] }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyAssignmentForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (a) => {
    setEditingId(a.id);
    setForm({ ...emptyAssignmentForm, ...a });
    setFormError("");
    setShowForm(true);
  };

  const saveAssignment = () => {
    if (!form.title.trim() || form.grades.length === 0) {
      setFormError("Please add a title and choose at least one grade.");
      return;
    }
    if (editingId) {
      persist({ ...data, assignments: (data.assignments || []).map((a) => (a.id === editingId ? { ...a, ...form } : a)) });
    } else {
      persist({ ...data, assignments: [...(data.assignments || []), { id: uid(), ...form }] });
      setGradeFilter(null);
    }
    setForm(emptyAssignmentForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeAssignment = (id) => persist({ ...data, assignments: (data.assignments || []).filter((a) => a.id !== id) });

  const renderAssignment = (a) => (
    <div key={a.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(a)}>
      <div>
        <div className="bsf-row-head">
          <span className="bsf-tag">{(a.grades || []).length === GRADES.length ? "All grades" : (a.grades || []).join(", ")}</span>
          {a.dueDate && <span className="bsf-muted">Due {a.dueDate}</span>}
        </div>
        {a.subject && <p className="bsf-muted">{a.subject}</p>}
        <strong>{a.title}</strong>
        {a.description && <p>{a.description}</p>}
        {a.link && <p className="bsf-muted">{a.link}</p>}
        {(a.files || []).length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <AttachmentField
              folder="assignments"
              files={a.files}
              onChange={(files) =>
                persist({ ...data, assignments: (data.assignments || []).map((x) => (x.id === a.id ? { ...x, files } : x)) })
              }
            />
          </div>
        )}
      </div>
      <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeAssignment(a.id); }} aria-label="Remove"><Trash2 size={16} /></button>
    </div>
  );

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Assignments</h1>
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>

      <section className="bsf-card">
        <h2>Filter by grade</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
          {GRADES.map((g) => (
            <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        <h2 className="bsf-listheading">Due</h2>
        {upcoming.length === 0 && <p className="bsf-empty">Nothing assigned yet.</p>}
        {upcoming.map(renderAssignment)}
      </section>

      {past.length > 0 && (
        <section className="bsf-list">
          <h2 className="bsf-listheading">Past due</h2>
          {past.map(renderAssignment)}
        </section>
      )}

      {showForm && (
        <Modal title={editingId ? "Edit assignment" : "New assignment"} onClose={() => setShowForm(false)}>
          <Field label="Grades">
            <div className="bsf-chiprow">
              <button
                type="button"
                className={`bsf-chip ${form.grades.length === GRADES.length ? "active" : ""}`}
                onClick={() => setForm({ ...form, grades: form.grades.length === GRADES.length ? [] : [...GRADES] })}
              >
                All grades
              </button>
              {GRADES.map((g) => (
                <button key={g} type="button" className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`} onClick={() => toggleGrade(g)}>{g}</button>
              ))}
            </div>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math, Literacy" />
          </Field>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Fractions worksheet" />
          </Field>
          <Field label="Description">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What students need to do" />
          </Field>
          <Field label="Due date">
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          <Field label="Link (optional)">
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Link to a worksheet or resource" />
          </Field>
          <Field label="Attachments (optional)">
            <AttachmentField folder="assignments" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveAssignment}>{editingId ? "Save changes" : "Post assignment"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

function ReportViewModal({ report, onClose, onRemove }) {
  const kind = report.kind || "student";

  return (
    <Modal
      title={
        kind === "student" ? `${report.studentName}'s report`
        : kind === "attendance" ? "Attendance report"
        : kind === "assessment" ? "Assessment report"
        : kind === "behavior" ? "Behavior report"
        : kind === "transcript" ? `${report.studentName}'s transcript`
        : "Standards report"
      }
      onClose={onClose}
    >
      {kind === "student" && (
        <>
          <p className="bsf-muted">{report.template} · {report.grade}</p>
          <p className="bsf-muted">Period: {report.periodStart || "?"} to {report.periodEnd || "?"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Attendance</h3>
          <p className="bsf-muted">
            {report.attendanceSummary.present} present · {report.attendanceSummary.absent} absent · {report.attendanceSummary.late} late during this period
          </p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Grades</h3>
          {(!report.grades || report.grades.length === 0) && <p className="bsf-empty">No grades recorded in this period.</p>}
          {(report.grades || []).map((g, i) => (
            <div key={i} className="bsf-row">
              <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[g.letter] || "#8A9698"}1A`, color: LETTER_GRADE_COLOR[g.letter] || "#8A9698" }}>
                {g.scoreType === "Percentage" ? `${g.score}% · ${g.letter}` : g.letter}
              </span>
              <div>
                <strong>{g.subject}{g.term ? ` · ${g.term}` : ""}</strong>
                {g.comments && <p>{g.comments}</p>}
              </div>
            </div>
          ))}

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Assessments</h3>
          {report.assessments.length === 0 && <p className="bsf-empty">No assessments recorded in this period.</p>}
          {report.assessments.map((a, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{a.subject || "General"}</strong>
                {a.rows && a.rows.length > 0 ? (
                  <span className="bsf-tag">{a.rubricName || "Rubric"}</span>
                ) : (
                  <span className="bsf-status-pill" style={{ background: `${getLevelColor(a.level)}1A`, color: getLevelColor(a.level) }}>{a.level}</span>
                )}
              </div>
              {a.rows && a.rows.length > 0 ? (
                <div className="bsf-rubric-rows">
                  {a.rows.map((r, j) => (
                    <div key={j} className="bsf-rubric-row">
                      <span>{r.text}</span>
                      <span className="bsf-status-pill" style={{ background: `${getLevelColor(r.level)}1A`, color: getLevelColor(r.level) }}>{r.level}</span>
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
          <h3 className="bsf-subheading">Portfolio highlights</h3>
          {report.portfolio.length === 0 && <p className="bsf-empty">No portfolio entries in this period.</p>}
          {report.portfolio.map((p, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <span className="bsf-tag">{p.tag}</span>
                <span className="bsf-muted">{p.date}</span>
              </div>
              <p>{p.note}</p>
            </div>
          ))}

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Teacher comments</h3>
          <p>{report.teacherComments || "No comments added."}</p>
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
          <p className="bsf-muted">{report.grade} · Period: {report.periodStart || "Full history"} to {report.periodEnd || "present"}</p>
          <p className="bsf-muted">Generated {report.createdDate}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">GPA</h3>
          <p className="bsf-muted">{report.gpa !== null ? `${report.gpa} average across ${report.entries.length} grade${report.entries.length === 1 ? "" : "s"}` : "Not enough graded entries yet."}</p>

          <hr className="bsf-divider" />
          <h3 className="bsf-subheading">Grade history</h3>
          {report.entries.length === 0 && <p className="bsf-empty">No grades recorded for this student yet.</p>}
          {report.entries.map((e, i) => (
            <div key={i} className="bsf-comment">
              <div className="bsf-row-head">
                <strong>{e.subject}{e.term ? ` · ${e.term}` : ""}</strong>
                <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[e.letter] || "#8A9698"}1A`, color: LETTER_GRADE_COLOR[e.letter] || "#8A9698" }}>
                  {e.scoreType === "Percentage" ? `${e.score}% · ${e.letter}` : e.letter}
                </span>
              </div>
              <p className="bsf-muted">{e.date}</p>
              {e.comments && <p>{e.comments}</p>}
            </div>
          ))}
        </>
      )}

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

      <button className="bsf-btn bsf-btn-block" onClick={() => window.print()}>Print / Save as PDF</button>
      <button className="bsf-textbtn" style={{ marginTop: 10 }} onClick={() => onRemove(report.id)}>Delete this report</button>
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

function ReportsTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [kind, setKind] = useState("student");
  const settings = data.settings || DEFAULT_SETTINGS;
  const templates = settings.reportCardTemplates && settings.reportCardTemplates.length ? settings.reportCardTemplates : ["Standard Progress Report"];

  const [form, setForm] = useState({
    studentId: "", template: templates[0], grade: "", subject: "",
    periodStart: "", periodEnd: "", teacherComments: ""
  });
  const [formError, setFormError] = useState("");

  const reports = [...(data.reports || [])].sort((a, b) => b.createdDate.localeCompare(a.createdDate));
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
        if (status) attendanceSummary[status] += 1;
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
        if (date >= start && date <= end) {
          const status = day[s.id];
          if (status) counts[status] += 1;
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

  const kindLabel = (r) => REPORT_KINDS.find((k) => k.id === (r.kind || "student")).label;

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Reports</h1>
        <button className="bsf-btn" onClick={() => openForm("student")} disabled={data.students.length === 0}><Plus size={16} /> Generate</button>
      </div>
      {data.students.length === 0 && <p className="bsf-empty">Add students first, then generate reports here.</p>}

      <section className="bsf-list">
        {reports.length === 0 && <p className="bsf-empty">No reports generated yet.</p>}
        {reports.map((r) => (
          <div key={r.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setViewingId(r.id)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{kindLabel(r)}</span>
                <span className="bsf-muted">{r.createdDate}</span>
              </div>
              <strong>{r.kind === "student" || !r.kind ? r.studentName : r.grade}</strong>
              <p className="bsf-muted">
                {r.kind === "student" || !r.kind ? r.grade : (r.kind === "assessment" && r.subject ? r.subject : "")}
                {" "}· {r.periodStart || "?"} to {r.periodEnd || "?"}
              </p>
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeReport(r.id); }} aria-label="Remove"><Trash2 size={16} /></button>
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
                {data.students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
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
                <option value="">All grades</option>
                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
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
        <ReportViewModal report={viewingReport} onClose={() => setViewingId(null)} onRemove={removeReport} />
      )}
    </div>
  );
}

const emptyBehaviorForm = { studentId: "", type: BEHAVIOR_TYPES[0], category: BEHAVIOR_CATEGORIES_POSITIVE[0], description: "", actionTaken: "", reportedBy: "" };

function BehaviorTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [form, setForm] = useState(emptyBehaviorForm);
  const [formError, setFormError] = useState("");

  const incidents = [...(data.behaviorIncidents || [])].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = gradeFilter ? incidents.filter((i) => i.grade === gradeFilter) : incidents;
  const categoryOptions = form.type === "Positive" ? BEHAVIOR_CATEGORIES_POSITIVE : BEHAVIOR_CATEGORIES_CONCERN;

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyBehaviorForm });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (i) => {
    setEditingId(i.id);
    setForm({ ...emptyBehaviorForm, ...i });
    setFormError("");
    setShowForm(true);
  };

  const setType = (type) => {
    const cats = type === "Positive" ? BEHAVIOR_CATEGORIES_POSITIVE : BEHAVIOR_CATEGORIES_CONCERN;
    setForm({ ...form, type, category: cats[0] });
  };

  const saveIncident = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    if (!form.description.trim()) {
      setFormError("Please describe what happened before saving.");
      return;
    }
    const record = { ...form, studentId: student.id, studentName: student.name, grade: student.grade };
    if (editingId) {
      persist({ ...data, behaviorIncidents: (data.behaviorIncidents || []).map((i) => (i.id === editingId ? { ...i, ...record } : i)) });
    } else {
      persist({ ...data, behaviorIncidents: [...(data.behaviorIncidents || []), { id: uid(), date: todayStr(), ...record }] });
      setGradeFilter(null);
    }
    setForm(emptyBehaviorForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeIncident = (id) => persist({ ...data, behaviorIncidents: (data.behaviorIncidents || []).filter((i) => i.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Behavior</h1>
        <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>
      </div>
      {data.students.length === 0 && <p className="bsf-empty">Add students first, then log behavior notes here.</p>}

      {data.students.length > 0 && (
        <section className="bsf-card">
          <h2>Filter by grade</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {GRADES.map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No behavior notes recorded yet.</p>}
        {filtered.map((i) => (
          <div key={i.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(i)}>
            <div>
              <div className="bsf-row-head">
                <span
                  className="bsf-status-pill"
                  style={{
                    background: i.type === "Positive" ? "#E7F0EA" : "#FBEAE8",
                    color: i.type === "Positive" ? "#2F7A5C" : "#B5473B"
                  }}
                >
                  {i.type} · {i.category}
                </span>
                <span className="bsf-muted">{i.date}</span>
              </div>
              <strong>{i.studentName}</strong>
              <p className="bsf-muted">{i.grade}</p>
              <p>{i.description}</p>
              {i.actionTaken && <p className="bsf-muted">Action: {i.actionTaken}</p>}
              {i.reportedBy && <p className="bsf-muted">Reported by: {i.reportedBy}</p>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeIncident(i.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit behavior note" : "New behavior note"} onClose={() => setShowForm(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Choose a student</option>
              {data.students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <div className="bsf-chiprow">
              {BEHAVIOR_TYPES.map((t) => (
                <button key={t} type="button" className={`bsf-chip ${form.type === t ? "active" : ""}`} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>
          </Field>
          <Field label="Category">
            <div className="bsf-chiprow">
              {categoryOptions.map((c) => (
                <button key={c} type="button" className={`bsf-chip ${form.category === c ? "active" : ""}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="What happened">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the moment factually" />
          </Field>
          <Field label="Action taken (optional)">
            <textarea rows={2} value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} placeholder="e.g. Spoke with student, notified guardian" />
          </Field>
          <Field label="Reported by">
            <input value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} placeholder="Teacher name" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveIncident}>{editingId ? "Save changes" : "Save note"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyGradeForm = { studentId: "", subject: "", term: "", scoreType: "Percentage", score: "", letter: "", comments: "" };

function GradebookTab({ data, persist, onNavigate }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [gradeFilter, setGradeFilter] = useState(null);
  const [showStandards, setShowStandards] = useState(false);
  const [form, setForm] = useState(emptyGradeForm);
  const [formError, setFormError] = useState("");

  const entries = [...(data.gradeEntries || [])].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = gradeFilter ? entries.filter((e) => e.grade === gradeFilter) : entries;

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyGradeForm, date: todayStr() });
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (e) => {
    setEditingId(e.id);
    setForm({ ...emptyGradeForm, ...e });
    setFormError("");
    setShowForm(true);
  };

  const saveEntry = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student before saving.");
      return;
    }
    if (!form.subject.trim()) {
      setFormError("Please enter a subject before saving.");
      return;
    }
    const letter = form.scoreType === "Percentage" ? letterFromScore(form.score) : form.letter;
    const record = { ...form, studentId: student.id, studentName: student.name, grade: student.grade, letter };
    if (editingId) {
      persist({ ...data, gradeEntries: (data.gradeEntries || []).map((e) => (e.id === editingId ? { ...e, ...record } : e)) });
    } else {
      persist({ ...data, gradeEntries: [...(data.gradeEntries || []), { id: uid(), date: todayStr(), ...record }] });
      setGradeFilter(null);
    }
    setForm(emptyGradeForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeEntry = (id) => persist({ ...data, gradeEntries: (data.gradeEntries || []).filter((e) => e.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Gradebook</h1>
        <button className="bsf-btn" onClick={openAdd} disabled={data.students.length === 0}><Plus size={16} /> Add</button>
      </div>
      {data.students.length === 0 && <p className="bsf-empty">Add students first, then enter grades here.</p>}

      <section className="bsf-card">
        <h2>Related tools</h2>
        <div className="bsf-chiprow">
          <button className="bsf-chip" onClick={() => setShowStandards(true)}>Standards library</button>
          <button className="bsf-chip" onClick={() => onNavigate && onNavigate("reports")}>Report Cards</button>
          <button className="bsf-chip" onClick={() => onNavigate && onNavigate("reports")}>Transcripts</button>
        </div>
        <p className="bsf-muted" style={{ marginTop: 8 }}>Report Cards and Transcripts are generated from Reports, using the grades entered here.</p>
      </section>

      {data.students.length > 0 && (
        <section className="bsf-card">
          <h2>Filter by grade level</h2>
          <div className="bsf-chiprow">
            <button className={`bsf-chip ${gradeFilter === null ? "active" : ""}`} onClick={() => setGradeFilter(null)}>All</button>
            {GRADES.map((g) => (
              <button key={g} className={`bsf-chip ${gradeFilter === g ? "active" : ""}`} onClick={() => setGradeFilter(g)}>{g}</button>
            ))}
          </div>
        </section>
      )}

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No grades entered yet.</p>}
        {filtered.map((e) => (
          <div key={e.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(e)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-status-pill" style={{ background: `${LETTER_GRADE_COLOR[e.letter] || "#8A9698"}1A`, color: LETTER_GRADE_COLOR[e.letter] || "#8A9698" }}>
                  {e.scoreType === "Percentage" ? `${e.score}% · ${e.letter}` : e.letter}
                </span>
                <span className="bsf-muted">{e.date}</span>
              </div>
              <strong>{e.studentName}</strong>
              <p className="bsf-muted">{e.grade} · {e.subject}{e.term ? ` · ${e.term}` : ""}</p>
              {e.comments && <p>{e.comments}</p>}
            </div>
            <button className="bsf-iconbtn" onClick={(ev) => { ev.stopPropagation(); removeEntry(e.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit grade" : "New grade entry"} onClose={() => setShowForm(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Choose a student</option>
              {data.students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math" />
          </Field>
          <Field label="Term or period">
            <input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} placeholder="e.g. Term 1" />
          </Field>
          <Field label="Grade type">
            <div className="bsf-chiprow">
              <button type="button" className={`bsf-chip ${form.scoreType === "Percentage" ? "active" : ""}`} onClick={() => setForm({ ...form, scoreType: "Percentage" })}>Percentage</button>
              <button type="button" className={`bsf-chip ${form.scoreType === "Letter" ? "active" : ""}`} onClick={() => setForm({ ...form, scoreType: "Letter" })}>Letter grade</button>
            </div>
          </Field>
          {form.scoreType === "Percentage" ? (
            <Field label="Score (0 to 100)">
              <input type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
              {form.score !== "" && <p className="bsf-muted" style={{ marginTop: 4 }}>Letter grade: {letterFromScore(form.score)}</p>}
            </Field>
          ) : (
            <Field label="Letter grade">
              <div className="bsf-chiprow">
                {LETTER_GRADES.map((l) => (
                  <button key={l} type="button" className={`bsf-chip ${form.letter === l ? "active" : ""}`} onClick={() => setForm({ ...form, letter: l })}>{l}</button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Comments">
            <textarea rows={3} value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveEntry}>{editingId ? "Save changes" : "Save grade"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {showStandards && <StandardsLibraryModal data={data} persist={persist} onClose={() => setShowStandards(false)} />}
    </div>
  );
}

const emptyStaffForm = { name: "", role: STAFF_ROLES[0], position: "", gradesAssigned: [], subjectsTaught: "", email: "", phone: "", startDate: "", notes: "" };

function StaffTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [roleFilter, setRoleFilter] = useState(null);
  const [form, setForm] = useState(emptyStaffForm);
  const [formError, setFormError] = useState("");

  const staff = [...(data.staff || [])].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = roleFilter ? staff.filter((s) => s.role === roleFilter) : staff;

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, gradesAssigned: f.gradesAssigned.includes(g) ? f.gradesAssigned.filter((x) => x !== g) : [...f.gradesAssigned, g] }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyStaffForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({ ...emptyStaffForm, ...s });
    setFormError("");
    setShowForm(true);
  };

  const saveStaff = () => {
    if (!form.name.trim()) {
      setFormError("Please enter a name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, staff: (data.staff || []).map((s) => (s.id === editingId ? { ...s, ...form } : s)) });
    } else {
      persist({ ...data, staff: [...(data.staff || []), { id: uid(), ...form }] });
      setRoleFilter(null);
    }
    setForm(emptyStaffForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeStaff = (id) => persist({ ...data, staff: (data.staff || []).filter((s) => s.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Staff</h1>
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>

      <section className="bsf-card">
        <h2>Filter by role</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${roleFilter === null ? "active" : ""}`} onClick={() => setRoleFilter(null)}>All</button>
          {STAFF_ROLES.map((r) => (
            <button key={r} className={`bsf-chip ${roleFilter === r ? "active" : ""}`} onClick={() => setRoleFilter(r)}>{r}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No staff added yet.</p>}
        {filtered.map((s) => (
          <div key={s.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(s)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{s.role}</span>
              </div>
              <strong>{s.name}</strong>
              {s.position && <p className="bsf-muted">{s.position}</p>}
              {s.gradesAssigned && s.gradesAssigned.length > 0 && <p className="bsf-muted">{s.gradesAssigned.join(", ")}</p>}
              {s.subjectsTaught && <p className="bsf-muted">{s.subjectsTaught}</p>}
              {(s.email || s.phone) && <p className="bsf-muted">{s.email}{s.email && s.phone ? " · " : ""}{s.phone}</p>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeStaff(s.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit staff member" : "Add staff member"} onClose={() => setShowForm(false)}>
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
          </Field>
          <Field label="Role">
            <div className="bsf-chiprow">
              {STAFF_ROLES.map((r) => (
                <button key={r} type="button" className={`bsf-chip ${form.role === r ? "active" : ""}`} onClick={() => setForm({ ...form, role: r })}>{r}</button>
              ))}
            </div>
          </Field>
          <Field label="Position / Title">
            <input
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder={
                form.role === "Administrator" ? "e.g. Director and Principal, Office Manager"
                : form.role === "Support Staff" ? "e.g. School Nurse, IT Support, Cook, Driver"
                : form.role === "Teacher" ? "e.g. Grade 3 Teacher, PE Specialist, Art Specialist"
                : "Specific title for this role"
              }
            />
          </Field>
          {(form.role === "Teacher" || form.role === "Learning Assistant") && (
            <Field label="Grades assigned">
              <div className="bsf-chiprow">
                {GRADES.map((g) => (
                  <button key={g} type="button" className={`bsf-chip ${form.gradesAssigned.includes(g) ? "active" : ""}`} onClick={() => toggleGrade(g)}>{g}</button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Subjects taught (optional)">
            <input value={form.subjectsTaught} onChange={(e) => setForm({ ...form, subjectsTaught: e.target.value })} placeholder="e.g. Math, Science, or PE for specialists" />
          </Field>
          <Field label="Email">
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone or WhatsApp" />
          </Field>
          <Field label="Start date">
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveStaff}>{editingId ? "Save changes" : "Save staff member"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyResourceForm = { title: "", category: RESOURCE_CATEGORIES[0], link: "", description: "" };

function ResourcesTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [form, setForm] = useState(emptyResourceForm);
  const [formError, setFormError] = useState("");

  const resources = [...(data.resources || [])].sort((a, b) => a.title.localeCompare(b.title));
  const filtered = categoryFilter ? resources.filter((r) => r.category === categoryFilter) : resources;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyResourceForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({ ...emptyResourceForm, ...r });
    setFormError("");
    setShowForm(true);
  };

  const saveResource = () => {
    if (!form.title.trim()) {
      setFormError("Please enter a title before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, resources: (data.resources || []).map((r) => (r.id === editingId ? { ...r, ...form } : r)) });
    } else {
      persist({ ...data, resources: [...(data.resources || []), { id: uid(), date: todayStr(), ...form }] });
      setCategoryFilter(null);
    }
    setForm(emptyResourceForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeResource = (id) => persist({ ...data, resources: (data.resources || []).filter((r) => r.id !== id) });

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Resources</h1>
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>

      <section className="bsf-card">
        <h2>Filter by category</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${categoryFilter === null ? "active" : ""}`} onClick={() => setCategoryFilter(null)}>All</button>
          {RESOURCE_CATEGORIES.map((c) => (
            <button key={c} className={`bsf-chip ${categoryFilter === c ? "active" : ""}`} onClick={() => setCategoryFilter(c)}>{c}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">No resources added yet.</p>}
        {filtered.map((r) => (
          <div key={r.id} className="bsf-card bsf-student">
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{r.category}</span>
              </div>
              <strong>{r.title}</strong>
              {r.description && <p>{r.description}</p>}
              {r.link && (
                <a className="bsf-resource-link" href={r.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {r.link}
                </a>
              )}
            </div>
            <div className="bsf-student-actions">
              <button className="bsf-iconbtn" onClick={() => openEdit(r)} aria-label="Edit"><FileText size={16} /></button>
              <button className="bsf-iconbtn" onClick={() => removeResource(r.id)} aria-label="Remove"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit resource" : "Add resource"} onClose={() => setShowForm(false)}>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Parent Handbook 2026-27" />
          </Field>
          <Field label="Category">
            <div className="bsf-chiprow">
              {RESOURCE_CATEGORIES.map((c) => (
                <button key={c} type="button" className={`bsf-chip ${form.category === c ? "active" : ""}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Link">
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Link to a Google Drive doc, PDF, or website" />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveResource}>{editingId ? "Save changes" : "Save resource"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

const emptyChecklistForm = { name: "", category: "", status: ACCRED_STATUSES[0], evidenceLink: "", notes: "" };

function AccreditationTab({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyChecklistForm);
  const [formError, setFormError] = useState("");

  const accreditation = data.accreditation || { milestones: [], checklist: [] };
  const milestones = accreditation.milestones || [];
  const checklist = accreditation.checklist || [];

  const loadMilestoneTemplate = () => {
    const seeded = DEFAULT_MILESTONES.map((label) => ({ id: uid(), label, status: ACCRED_STATUSES[0], targetDate: "", notes: "" }));
    persist({ ...data, accreditation: { ...accreditation, milestones: seeded } });
  };

  const updateMilestone = (id, patch) => {
    persist({ ...data, accreditation: { ...accreditation, milestones: milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) } });
  };

  const removeMilestone = (id) => {
    persist({ ...data, accreditation: { ...accreditation, milestones: milestones.filter((m) => m.id !== id) } });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyChecklistForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({ ...emptyChecklistForm, ...item });
    setFormError("");
    setShowForm(true);
  };

  const saveChecklistItem = () => {
    if (!form.name.trim()) {
      setFormError("Please enter a name before saving.");
      return;
    }
    if (editingId) {
      persist({ ...data, accreditation: { ...accreditation, checklist: checklist.map((c) => (c.id === editingId ? { ...c, ...form } : c)) } });
    } else {
      persist({ ...data, accreditation: { ...accreditation, checklist: [...checklist, { id: uid(), ...form }] } });
    }
    setForm(emptyChecklistForm);
    setEditingId(null);
    setFormError("");
    setShowForm(false);
  };

  const removeChecklistItem = (id) => {
    persist({ ...data, accreditation: { ...accreditation, checklist: checklist.filter((c) => c.id !== id) } });
  };

  const metCount = checklist.filter((c) => c.status === "Met").length;

  return (
    <div className="bsf-screen">
      <div className="bsf-screen-head">
        <h1>Accreditation</h1>
      </div>

      <section className="bsf-card">
        <div className="bsf-row-head">
          <h2>Candidacy milestones</h2>
          {milestones.length === 0 && (
            <button className="bsf-textbtn" onClick={loadMilestoneTemplate}>Load starter checklist</button>
          )}
        </div>
        {milestones.length === 0 && <p className="bsf-empty">Load the starter checklist to track the standard IB candidacy stages.</p>}
        {milestones.map((m) => (
          <div key={m.id} className="bsf-comment">
            <div className="bsf-row-head">
              <strong>{m.label}</strong>
              <button className="bsf-textbtn" onClick={() => removeMilestone(m.id)}>Remove</button>
            </div>
            <div className="bsf-chiprow" style={{ marginTop: 6 }}>
              {ACCRED_STATUSES.map((s) => (
                <button
                  key={s}
                  className="bsf-chip"
                  style={m.status === s ? { background: ACCRED_STATUS_COLOR[s], borderColor: ACCRED_STATUS_COLOR[s], color: "#fff" } : {}}
                  onClick={() => updateMilestone(m.id, { status: s })}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={m.targetDate}
              onChange={(e) => updateMilestone(m.id, { targetDate: e.target.value })}
              className="bsf-dateinput"
              style={{ marginTop: 8 }}
            />
          </div>
        ))}
      </section>

      <div className="bsf-screen-head">
        <h2 className="bsf-listheading" style={{ margin: 0 }}>Standards checklist ({metCount}/{checklist.length} met)</h2>
        <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
      </div>
      <section className="bsf-list">
        {checklist.length === 0 && <p className="bsf-empty">Add the specific standards or practices you're tracking toward.</p>}
        {checklist.map((c) => (
          <div key={c.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(c)}>
            <div>
              <div className="bsf-row-head">
                <span className="bsf-status-pill" style={{ background: `${ACCRED_STATUS_COLOR[c.status]}1A`, color: ACCRED_STATUS_COLOR[c.status] }}>{c.status}</span>
                {c.category && <span className="bsf-muted">{c.category}</span>}
              </div>
              <strong>{c.name}</strong>
              {c.notes && <p>{c.notes}</p>}
              {c.evidenceLink && <a className="bsf-resource-link" href={c.evidenceLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{c.evidenceLink}</a>}
            </div>
            <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeChecklistItem(c.id); }} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>

      {showForm && (
        <Modal title={editingId ? "Edit checklist item" : "Add checklist item"} onClose={() => setShowForm(false)}>
          <Field label="Standard or practice">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Written curriculum reflects the programme" />
          </Field>
          <Field label="Category (optional)">
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Philosophy, Organization, Curriculum" />
          </Field>
          <Field label="Status">
            <div className="bsf-chiprow">
              {ACCRED_STATUSES.map((s) => (
                <button key={s} type="button" className={`bsf-chip ${form.status === s ? "active" : ""}`} onClick={() => setForm({ ...form, status: s })}>{s}</button>
              ))}
            </div>
          </Field>
          <Field label="Evidence link (optional)">
            <input value={form.evidenceLink} onChange={(e) => setForm({ ...form, evidenceLink: e.target.value })} placeholder="Link to supporting document" />
          </Field>
          <Field label="Notes">
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={saveChecklistItem}>{editingId ? "Save changes" : "Save item"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

function buildSchoolContext(data) {
  const settings = data.settings || DEFAULT_SETTINGS;
  const counts = {};
  data.students.forEach((s) => { counts[s.grade] = (counts[s.grade] || 0) + 1; });
  const gradeSummary = Object.entries(counts).map(([g, n]) => `${g}: ${n}`).join(", ") || "no students added yet";

  const upcoming = [...(data.events || [])]
    .filter((e) => (e.endDate || e.date) >= todayStr())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
    .map((e) => `${e.title} (${e.date})`)
    .join("; ") || "none scheduled";

  return `You are the AI Assistant inside BrightSteps Hub, an internal tool for BrightSteps International School in Grand Bassam, Cote d'Ivoire. Today's date is ${todayStr()}.
Curriculum framework: ${settings.curriculumFramework}.
Enrollment by grade: ${gradeSummary}.
Upcoming events: ${upcoming}.

Help the school director and teachers with tasks like drafting parent communications, writing report card comments, summarizing student progress, and answering questions about how to use the hub.
Style rules to always follow when drafting anything for parents or families: never use hyphens or dashes anywhere in the text, always put English before French in any bilingual material, keep a warm and polished international school tone.
Keep answers concise and directly useful. If asked something outside your knowledge of this school, say so plainly rather than guessing.`;
}

function AIAssistantTab({ data }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: buildSchoolContext(data),
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content }))
        })
      });
      const json = await response.json();
      const replyText = (json.content || []).map((c) => (c.type === "text" ? c.text : "")).filter(Boolean).join("\n");
      setMessages((prev) => [...prev, { role: "assistant", content: replyText || "I couldn't generate a response, please try again." }]);
    } catch (e) {
      setError("Something went wrong reaching the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Draft a bilingual reminder about the Welcome Coffee",
    "Write a report card comment for a student who is progressing well in reading",
    "Summarize what I should follow up on this week"
  ];

  return (
    <div className="bsf-screen bsf-ai-screen">
      <div className="bsf-screen-head">
        <h1>AI Assistant</h1>
      </div>

      {messages.length === 0 && (
        <section className="bsf-card">
          <h2>Try asking</h2>
          <div className="bsf-chiprow">
            {suggestions.map((s) => (
              <button key={s} className="bsf-chip" onClick={() => setInput(s)}>{s}</button>
            ))}
          </div>
        </section>
      )}

      <div className="bsf-ai-thread">
        {messages.map((m, i) => (
          <div key={i} className={`bsf-ai-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="bsf-ai-bubble assistant bsf-ai-loading">Thinking…</div>}
        {error && <p className="bsf-formerror">{error}</p>}
      </div>

      <div className="bsf-ai-inputrow">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask the assistant anything about BrightSteps"
        />
        <button className="bsf-iconbtn bsf-ai-sendbtn" onClick={send} disabled={loading} aria-label="Send">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

const FRAMEWORKS = ["Inquiry Based Learning", "IB PYP", "IB MYP", "Common Core", "British National Curriculum", "Other"];

function ListEditor({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <Field label={label}>
      <div className="bsf-chiprow">
        {items.map((it, i) => (
          <span key={i} className="bsf-chip bsf-editable-chip">
            {it}
            <button type="button" onClick={() => remove(i)} aria-label={`Remove ${it}`}>×</button>
          </span>
        ))}
      </div>
      <div className="bsf-inline-add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="bsf-btn" onClick={add}>Add</button>
      </div>
    </Field>
  );
}

function SettingsModal({ data, persist, onClose }) {
  const { signOut, profile } = useAuth();
  const { t } = useLanguage();
  const settings = data.settings || DEFAULT_SETTINGS;
  const update = (patch) => persist({ ...data, settings: { ...settings, ...patch } });
  const updateBranding = (patch) => update({ branding: { ...settings.branding, ...patch } });
  const updateYear = (patch) => update({ academicYear: { ...settings.academicYear, ...patch } });

  const isParent = profile?.role === "parent";

  return (
    <Modal title={isParent ? t("settings.account") : "School settings"} onClose={onClose}>
      {!isParent && (
        <>
      <h3 className="bsf-subheading">Curriculum framework</h3>
      <Field label="Framework">
        <select value={settings.curriculumFramework} onChange={(e) => update({ curriculumFramework: e.target.value })}>
          {FRAMEWORKS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Grade structure</h3>
      <ListEditor
        label="Grade levels, in order"
        items={settings.grades}
        onChange={(grades) => update({ grades })}
        placeholder="e.g. Grade 8"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Assessment scale</h3>
      <ListEditor
        label="Levels, low to high"
        items={settings.assessmentLevels}
        onChange={(assessmentLevels) => update({ assessmentLevels })}
        placeholder="e.g. Mastered"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">School branding</h3>
      <Field label="Primary color">
        <input type="color" value={settings.branding.primaryColor} onChange={(e) => updateBranding({ primaryColor: e.target.value })} className="bsf-colorinput" />
      </Field>
      <Field label="Logo URL">
        <input value={settings.branding.logoUrl} onChange={(e) => updateBranding({ logoUrl: e.target.value })} placeholder="https://..." />
      </Field>
      {settings.branding.logoUrl && (
        <img src={settings.branding.logoUrl} alt="School logo preview" className="bsf-logo-preview" />
      )}
      <Field label="Mission statement">
        <textarea rows={2} value={settings.branding.mission} onChange={(e) => updateBranding({ mission: e.target.value })} />
      </Field>
      <Field label="Slogan">
        <input value={settings.branding.slogan} onChange={(e) => updateBranding({ slogan: e.target.value })} />
      </Field>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Languages</h3>
      <ListEditor
        label="Languages used at school"
        items={settings.languages}
        onChange={(languages) => update({ languages })}
        placeholder="e.g. Spanish"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Academic calendar</h3>
      <div className="bsf-two-col">
        <Field label="Year start">
          <input type="date" value={settings.academicYear.startDate} onChange={(e) => updateYear({ startDate: e.target.value })} />
        </Field>
        <Field label="Year end">
          <input type="date" value={settings.academicYear.endDate} onChange={(e) => updateYear({ endDate: e.target.value })} />
        </Field>
      </div>

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">Report card templates</h3>
      <ListEditor
        label="Templates"
        items={settings.reportCardTemplates}
        onChange={(reportCardTemplates) => update({ reportCardTemplates })}
        placeholder="e.g. Early Years Narrative Report"
      />

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">User roles</h3>
      <ListEditor
        label="Roles"
        items={settings.roles}
        onChange={(roles) => update({ roles })}
        placeholder="e.g. Coordinator"
      />
      <p className="bsf-muted" style={{ marginTop: 6 }}>Roles are a reference list for now. Real logins and permissions come with hosting.</p>
        </>
      )}

      <hr className="bsf-divider" />
      <h3 className="bsf-subheading">{t("settings.account")}</h3>
      {profile?.email && <p className="bsf-muted">{t("settings.signedInAs")} {profile.email}</p>}
      <button
        className="bsf-btn bsf-btn-block"
        style={{ background: "#801524" }}
        onClick={() => { onClose(); signOut(); }}
      >
        {t("settings.signOut")}
      </button>
    </Modal>
  );
}

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
  const { data, persist, loaded, saving, loadError } = useSchoolData();
  const { t, language, canSwitch, setLanguage } = useLanguage();
  const [tab, setTab] = useState("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isParent = profile?.role === "parent";
  const PARENT_HIDDEN_TABS = ["classes", "staff", "admissions", "reports", "behavior", "resources", "accreditation", "ai"];

  useEffect(() => {
    if (isParent && PARENT_HIDDEN_TABS.includes(tab)) setTab("dashboard");
  }, [isParent, tab]);

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 380 }}>
          <h2 style={{ color: "#801524" }}>{t("loadError.title")}</h2>
          <p style={{ color: "#555" }}>
            {t("loadError.body")}
          </p>
          <button className="bsf-btn" onClick={() => window.location.reload()}>{t("loadError.reload")}</button>
        </div>
      </div>
    );
  }

  const branding = (data.settings || DEFAULT_SETTINGS).branding;

  const allSectionsRaw = [
    { id: "dashboard", label: "Dashboard", navKey: "nav.dashboard", icon: LayoutDashboard },
    { id: "students", label: "Students", navKey: "nav.students", icon: Users },
    { id: "classes", label: "Classes", navKey: "nav.classes", icon: UserCheck },
    { id: "staff", label: "Staff", navKey: "nav.staff", icon: Briefcase },
    { id: "attendance", label: "Attendance", navKey: "nav.attendance", icon: CheckSquare },
    { id: "portfolio", label: "Portfolio", navKey: "nav.portfolio", icon: BookOpen },
    { id: "assessment", label: "Assessment", navKey: "nav.assessment", icon: ClipboardCheck },
    { id: "gradebook", label: "Gradebook", navKey: "nav.gradebook", icon: Percent },
    { id: "planning", label: "Planning", navKey: "nav.planning", icon: ClipboardList },
    { id: "calendar", label: "Calendar", navKey: "nav.calendar", icon: CalendarIcon },
    { id: "admissions", label: "Admissions", navKey: "nav.admissions", icon: UserPlus },
    { id: "assignments", label: "Assignments", navKey: "nav.assignments", icon: FileText },
    { id: "reports", label: "Reports", navKey: "nav.reports", icon: FileCheck },
    { id: "behavior", label: "Behavior", navKey: "nav.behavior", icon: Flag },
    { id: "resources", label: "Resources", navKey: "nav.resources", icon: FolderOpen },
    { id: "accreditation", label: "Accreditation", navKey: "nav.accreditation", icon: Award },
    { id: "ai", label: "AI Assistant", navKey: "nav.ai", icon: Sparkles },
    { id: "updates", label: "Communication", navKey: "nav.updates", icon: Megaphone }
  ];
  const allSections = isParent ? allSectionsRaw.filter((s) => !PARENT_HIDDEN_TABS.includes(s.id)) : allSectionsRaw;

  const primaryIds = ["dashboard", "attendance", "portfolio", "assessment"];
  const bottomTabs = primaryIds.map((id) => allSections.find((s) => s.id === id));

  const goTo = (id) => {
    setTab(id);
    setShowMenu(false);
  };

  return (
    <div className="bsf-app" style={{ "--teal": branding.primaryColor, "--gold": branding.primaryColor }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;0,700;1,500&family=Work+Sans:wght@400;500;600;700&display=swap');

        .bsf-app {
          --ink: #241012;
          --teal: #801524;
          --teal-light: #A02E3B;
          --sand: #FFFFFF;
          --sand-deep: #F5E4E6;
          --gold: #801524;
          --gold-dark: #5C0F1A;
          --line: #EAD7DA;
          --white: #FFFFFF;
          font-family: 'Work Sans', sans-serif;
          background: var(--sand);
          color: var(--ink);
          min-height: 100vh;
          max-width: 480px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .bsf-app h1, .bsf-app h2 { font-family: 'Fraunces', serif; margin: 0; }
        .bsf-app * { box-sizing: border-box; }

        @media (min-width: 768px) {
          .bsf-app {
            max-width: 900px;
          }
        }
        @media (min-width: 1200px) {
          .bsf-app {
            max-width: 1100px;
          }
        }

        .bsf-topbar {
          padding: 18px 20px 12px;
          background: var(--teal);
          color: var(--white);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .bsf-brand { display: flex; align-items: center; gap: 10px; }
        .bsf-topbar-logo { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; background: var(--white); }
        .bsf-wordmark { font-family: 'Fraunces', serif; font-weight: 700; font-size: 20px; letter-spacing: 0.2px; }
        .bsf-slogan { font-size: 11px; color: #F0D9DD; margin-top: 2px; }
        .bsf-topbar-actions { display: flex; align-items: center; gap: 10px; }
        .bsf-savestate { font-size: 11px; color: #F0D9DD; opacity: 0.85; }
        .bsf-settingsbtn { color: var(--white); }
        .bsf-settingsbtn:hover { background: rgba(255,255,255,0.15); }

        .bsf-screen { padding: 16px 16px 90px; flex: 1; overflow-y: auto; }

        .bsf-hero { padding: 6px 4px 18px; }
        .bsf-eyebrow { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold-dark); font-weight: 600; margin: 0 0 6px; }
        .bsf-hero h1 { font-size: 26px; line-height: 1.15; font-weight: 600; }
        .bsf-hero-sub { margin: 8px 0 0; color: var(--teal-light); font-weight: 500; }

        .bsf-screen-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding: 4px; }
        .bsf-screen-head h1 { font-size: 22px; font-weight: 600; }

        .bsf-card {
          background: var(--white);
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 14px;
        }
        .bsf-card h2 { font-size: 16px; font-weight: 600; margin-bottom: 10px; }

        .bsf-row { display: flex; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
        .bsf-row:first-of-type { border-top: none; padding-top: 0; }
        .bsf-row p { margin: 2px 0 0; font-size: 14px; color: #3B4A4C; }
        .bsf-row-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }

        .bsf-list { display: flex; flex-direction: column; }
        .bsf-student { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .bsf-student p { margin: 2px 0 0; font-size: 13px; }

        .bsf-tag {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          background: var(--sand-deep);
          color: var(--gold-dark);
          padding: 3px 9px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .bsf-muted { color: #6E7B7D; font-size: 12px; }
        .bsf-empty { color: #6E7B7D; font-size: 14px; padding: 8px 2px; }

        .bsf-fr-block { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--line); }

        .bsf-btn {
          background: var(--teal);
          color: var(--white);
          border: none;
          border-radius: 10px;
          padding: 9px 14px;
          font-size: 14px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }
        .bsf-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .bsf-btn-block { width: 100%; justify-content: center; margin-top: 6px; }
        .bsf-iconbtn {
          background: transparent;
          border: none;
          color: #8A6A2E;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
        }
        .bsf-iconbtn:hover { background: var(--sand-deep); }

        .bsf-ladder { display: flex; flex-direction: column; gap: 9px; }
        .bsf-rung {
          display: grid;
          grid-template-columns: 78px 1fr 22px;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 4px 6px;
          cursor: pointer;
          text-align: left;
        }
        .bsf-rung.active { border-color: var(--gold); background: #FBF6E9; }
        .bsf-rung-label { font-size: 12px; color: var(--ink); font-weight: 500; }
        .bsf-rung-track { height: 8px; background: var(--sand-deep); border-radius: 6px; overflow: hidden; }
        .bsf-rung-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--teal-light), var(--gold)); border-radius: 6px; }
        .bsf-rung-count { font-size: 12px; color: #6E7B7D; text-align: right; }

        .bsf-tabbar {
          position: sticky;
          bottom: 0;
          background: var(--white);
          border-top: 1px solid var(--line);
          display: flex;
          padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
        }
        .bsf-tab {
          flex: 1;
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 7px 2px;
          color: #8A9698;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .bsf-tab.active { color: var(--teal); }

        .bsf-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(43, 18, 22, 0.45);
          display: flex;
          align-items: flex-end;
          z-index: 40;
        }
        .bsf-modal {
          background: var(--white);
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          border-radius: 18px 18px 0 0;
          padding: 18px 18px 24px;
        }
        .bsf-modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .bsf-modal-head h3 { font-family: 'Fraunces', serif; font-size: 18px; font-weight: 600; }

        .bsf-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 13px; font-weight: 600; color: #3B4A4C; }
        .bsf-field input, .bsf-field select, .bsf-field textarea {
          font-family: 'Work Sans', sans-serif;
          font-weight: 400;
          font-size: 14px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #FCFAF4;
          color: var(--ink);
        }
        .bsf-field textarea { resize: vertical; }
        .bsf-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .bsf-dateinput {
          font-family: 'Work Sans', sans-serif;
          font-size: 13px;
          padding: 7px 9px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--white);
          color: var(--ink);
        }
        .bsf-chiprow { display: flex; flex-wrap: wrap; gap: 7px; }
        .bsf-chip {
          font-size: 12px;
          font-weight: 600;
          padding: 6px 11px;
          border-radius: 100px;
          border: 1px solid var(--line);
          background: var(--white);
          color: #3B4A4C;
          cursor: pointer;
        }
        .bsf-chip.active { background: var(--teal); border-color: var(--teal); color: var(--white); }
        .bsf-attend-row {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-align: left;
          font-family: 'Work Sans', sans-serif;
          cursor: pointer;
        }
        .bsf-status-pill {
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .bsf-templatebtn {
          width: 100%;
          background: var(--sand-deep);
          color: var(--gold-dark);
          border: 1px dashed var(--teal);
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 14px;
        }
        .bsf-loi { white-space: pre-line; }
        .bsf-author-badge {
          font-size: 10.5px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .bsf-author-badge.teacher { background: var(--sand-deep); color: var(--gold-dark); }
        .bsf-author-badge.student { background: #E7F0EA; color: #2F7A5C; }
        .bsf-clickable { cursor: pointer; }
        .bsf-checklist { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
        .bsf-checklist-row { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 4px 2px; }
        .bsf-checklist-row input { flex-shrink: 0; }
        .bsf-minitag {
          font-size: 10.5px;
          font-weight: 600;
          background: var(--sand-deep);
          color: var(--gold-dark);
          padding: 3px 8px;
          border-radius: 100px;
        }
        .bsf-status-chips { margin-top: 8px; gap: 6px; }
        .bsf-divider { border: none; border-top: 1px solid var(--line); margin: 16px 0; }
        .bsf-subheading { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600; margin: 0 0 8px; }
        .bsf-comments { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .bsf-comment { background: #FCFAF4; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
        .bsf-comment p { margin: 4px 0 6px; font-size: 13px; }
        .bsf-textbtn {
          background: none;
          border: none;
          color: var(--gold-dark);
          font-size: 12px;
          font-weight: 600;
          padding: 0;
          cursor: pointer;
        }
        .bsf-btn-ghost {
          background: var(--white);
          color: var(--teal);
          border: 1px solid var(--line);
        }
        .bsf-rubric-items { margin: 4px 0 0; padding-left: 18px; font-size: 13px; }
        .bsf-rubric-items li { margin-bottom: 2px; }
        .bsf-rubric-rows { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
        .bsf-rubric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          padding: 4px 0;
          border-top: 1px dashed var(--line);
        }
        .bsf-rubric-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px; }
        .bsf-rubric-form-row { background: #FCFAF4; border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
        .bsf-rubric-form-label { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: var(--ink); }
        .bsf-mission { font-style: italic; color: var(--teal-light); margin: 10px 0 0; font-size: 14px; }
        .bsf-editable-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--sand-deep);
          color: var(--gold-dark);
          border-color: transparent;
          cursor: default;
        }
        .bsf-editable-chip button {
          background: none;
          border: none;
          color: var(--gold-dark);
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }
        .bsf-inline-add { display: flex; gap: 8px; margin-top: 8px; }
        .bsf-inline-add input {
          flex: 1;
          font-family: 'Work Sans', sans-serif;
          font-size: 14px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: #FCFAF4;
        }
        .bsf-colorinput { width: 60px; height: 36px; padding: 2px; border: 1px solid var(--line); border-radius: 8px; cursor: pointer; }
        .bsf-logo-preview { width: 64px; height: 64px; object-fit: contain; border-radius: 10px; border: 1px solid var(--line); margin: -4px 0 12px; background: var(--white); }
        .bsf-listheading { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600; margin: 4px 4px 8px; }
        .bsf-student-actions { display: flex; gap: 2px; }
        .bsf-menu-list { display: flex; flex-direction: column; gap: 4px; }
        .bsf-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          border-radius: 10px;
          padding: 12px 10px;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          cursor: pointer;
        }
        .bsf-menu-item:hover { background: var(--sand-deep); }
        .bsf-menu-item.active { background: var(--sand-deep); color: var(--gold-dark); }
        .bsf-alert-note { color: #B5473B; font-weight: 600; font-size: 12.5px; margin-top: 4px; }
        .bsf-formerror { color: #B5473B; font-weight: 600; font-size: 13px; margin-top: 8px; text-align: center; }
        .bsf-attachments { margin-top: 8px; }
        .bsf-attachment-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
        .bsf-attachment-chip { display: flex; align-items: center; justify-content: space-between; background: #F7F3F2; border-radius: 8px; padding: 6px 10px; }
        .bsf-attachment-open { display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; font-size: 13px; color: #801524; padding: 0; }
        .bsf-attachment-upload { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #801524; cursor: pointer; border: 1px dashed #cbb; border-radius: 8px; padding: 6px 10px; }
        .bsf-spin { animation: bsf-spin 1s linear infinite; }
        @keyframes bsf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .bsf-student-thumb { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #F5E4E6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #801524; }
        .bsf-student-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .bsf-photofield { display: flex; align-items: center; gap: 12px; }
        .bsf-photofield-preview { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; background: #F5E4E6; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #801524; }
        .bsf-photofield-preview img { width: 100%; height: 100%; object-fit: cover; }
        .bsf-photofield-actions { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .bsf-resource-link { display: inline-block; color: var(--teal); font-size: 12.5px; word-break: break-all; margin-top: 4px; }
        .bsf-ai-screen { display: flex; flex-direction: column; }
        .bsf-ai-thread { display: flex; flex-direction: column; gap: 10px; padding: 4px; flex: 1; }
        .bsf-ai-bubble {
          max-width: 85%;
          padding: 10px 13px;
          border-radius: 14px;
          font-size: 14px;
          line-height: 1.45;
          white-space: pre-wrap;
        }
        .bsf-ai-bubble.user {
          align-self: flex-end;
          background: var(--teal);
          color: var(--white);
          border-bottom-right-radius: 4px;
        }
        .bsf-ai-bubble.assistant {
          align-self: flex-start;
          background: var(--sand-deep);
          color: var(--ink);
          border-bottom-left-radius: 4px;
        }
        .bsf-ai-loading { opacity: 0.6; font-style: italic; }
        .bsf-ai-inputrow {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          padding: 10px 4px 4px;
          position: sticky;
          bottom: 0;
          background: var(--sand);
        }
        .bsf-ai-inputrow textarea {
          flex: 1;
          font-family: 'Work Sans', sans-serif;
          font-size: 14px;
          padding: 9px 10px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: #FCFAF4;
          color: var(--ink);
          resize: none;
        }
        .bsf-ai-sendbtn { background: var(--teal); color: var(--white); border-radius: 10px; padding: 10px; }
        .bsf-ai-sendbtn:hover { background: var(--teal-light); }
      `}</style>

      <div className="bsf-topbar">
        <div className="bsf-brand">
          {branding.logoUrl && <img src={branding.logoUrl} alt="School logo" className="bsf-topbar-logo" />}
          <div>
            <span className="bsf-wordmark">BrightSteps Hub</span>
            {branding.slogan && <div className="bsf-slogan">{branding.slogan}</div>}
          </div>
        </div>
        <div className="bsf-topbar-actions">
          <span className="bsf-savestate">{saving ? t("top.saving") : loaded ? t("top.saved") : t("top.loading")}</span>
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
          <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => setShowMenu(true)} aria-label={t("top.menu")}>
            <MenuIcon size={19} />
          </button>
          <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => setShowSettings(true)} aria-label={t("top.settings")}>
            <SettingsIcon size={18} />
          </button>
          <button className="bsf-iconbtn bsf-settingsbtn" onClick={() => signOut()} aria-label={t("settings.signOut")} title={t("settings.signOut")}>
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {tab === "dashboard" && <Dashboard data={data} />}
      {tab === "students" && (isParent ? <ParentStudentView data={data} persist={persist} profile={profile} /> : <StudentsTab data={data} persist={persist} />)}
      {tab === "classes" && !isParent && <ClassesTab data={data} persist={persist} />}
      {tab === "staff" && !isParent && <StaffTab data={data} persist={persist} />}
      {tab === "attendance" && <AttendanceTab data={data} persist={persist} />}
      {tab === "portfolio" && <PortfolioTab data={data} persist={persist} />}
      {tab === "assessment" && <AssessmentTab data={data} persist={persist} />}
      {tab === "gradebook" && <GradebookTab data={data} persist={persist} onNavigate={goTo} />}
      {tab === "planning" && <PlanningTab data={data} persist={persist} />}
      {tab === "calendar" && <CalendarTab data={data} persist={persist} />}
      {tab === "admissions" && !isParent && <AdmissionsTab data={data} persist={persist} />}
      {tab === "assignments" && <AssignmentsTab data={data} persist={persist} />}
      {tab === "reports" && !isParent && <ReportsTab data={data} persist={persist} />}
      {tab === "behavior" && !isParent && <BehaviorTab data={data} persist={persist} />}
      {tab === "resources" && !isParent && <ResourcesTab data={data} persist={persist} />}
      {tab === "accreditation" && !isParent && <AccreditationTab data={data} persist={persist} />}
      {tab === "ai" && !isParent && <AIAssistantTab data={data} />}
      {tab === "updates" && <UpdatesTab data={data} persist={persist} />}

      {showSettings && <SettingsModal data={data} persist={persist} onClose={() => setShowSettings(false)} />}

      {showMenu && (
        <Modal title={t("nav.allSections")} onClose={() => setShowMenu(false)}>
          <div className="bsf-menu-list">
            {allSections.map(({ id, navKey, icon: Icon }) => (
              <button key={id} className={`bsf-menu-item ${tab === id ? "active" : ""}`} onClick={() => goTo(id)}>
                <Icon size={18} />
                <span>{t(navKey)}</span>
              </button>
            ))}
          </div>
          <p className="bsf-muted" style={{ marginTop: 10 }}>{t("nav.moreSectionsNote")}</p>
        </Modal>
      )}

      <nav className="bsf-tabbar">
        {bottomTabs.map(({ id, navKey, icon: Icon }) => (
          <button key={id} className={`bsf-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            <Icon size={19} />
            {t(navKey)}
          </button>
        ))}
        <button className="bsf-tab" onClick={() => setShowMenu(true)}>
          <MenuIcon size={19} />
          {t("nav.more")}
        </button>
      </nav>
    </div>
  );
}

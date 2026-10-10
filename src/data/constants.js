// The school's ten grades. These are always shown, in this order, even if
// the grade list saved in Settings is missing some (that used to make grade
// buttons disappear and treat young students as upper school).
const CORE_GRADES = [
  "Pre-N", "PreK", "Kindergarten",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4",
  "Grade 5", "Grade 6", "Grade 7"
];

let GRADES = [...CORE_GRADES];

const TAGS = ["Inquiry", "Literacy", "Numeracy", "Social Emotional", "Creative Arts", "Physical"];

const THEMES = [
  "Identity and relationships",
  "Time, place and change",
  "Expression and creativity",
  "How the world works",
  "Systems and communities",
  "Our planet and its future"
];

const PLAN_TEMPLATE = {
  centralIdea: "Students will understand that ",
  keyConcepts: "Form, Change, Connection",
  linesOfInquiry: "An exploration of \nA connection between \nThe way that "
};

let ASSESS_LEVELS = ["Emerging", "Developing", "Proficient", "Confident"];

const LEVEL_PALETTE = ["#B5473B", "#8A6420", "#2F6B7A", "#2F7A5C", "#6E4E9E", "#3A6EA5"];

const getLevelColor = (level) => {
  const idx = ASSESS_LEVELS.indexOf(level);
  return LEVEL_PALETTE[idx >= 0 ? idx % LEVEL_PALETTE.length : 0];
};

// The school logo is a normal file (public/logo.png) instead of a long text
// copy inside the code and the school data. Older saved data may still hold
// the old built-in copy; that is swapped for the file when the data loads.
const BRIGHTSTEPS_LOGO_DATA_URI = "/logo.png";

const OLD_BUILTIN_LOGO_START = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAYAAAA+VemSAAAzFElEQVR42u29eZwlVXnw/31O1V17mZ6d";

const usesOldBuiltinLogo = (url) => typeof url === "string" && url.startsWith(OLD_BUILTIN_LOGO_START);

const DEFAULT_SETTINGS = {
  curriculumFramework: "Inquiry-based learning",
  grades: [...GRADES],
  assessmentLevels: [...ASSESS_LEVELS],
  branding: { primaryColor: "#801524", logoUrl: BRIGHTSTEPS_LOGO_DATA_URI, mission: "", slogan: "" },
  languages: ["English", "French"],
  academicYear: { startDate: "", endDate: "" },
  terms: [
    { name: "Term 1", startDate: "", endDate: "" },
    { name: "Term 2", startDate: "", endDate: "" },
    { name: "Term 3", startDate: "", endDate: "" }
  ],
  reportCardTemplates: ["Standard Progress Report"],
  roles: ["Administrator", "Teacher", "Parent"]
};

const EVENT_TYPES = ["Academic", "Holiday", "Staff", "Event", "Meeting"];

const EVENT_TYPE_COLOR = { Academic: "#2F6B7A", Holiday: "#8A6420", Staff: "#6E4E9E", Event: "#2F7A5C", Meeting: "#B5473B" };

// A calendar event is staff only when it is marked so, or (older events with no
// setting) when its type is "Staff". Parents and students never see these; the
// database also removes them before the data reaches a parent's or student's screen.
const isStaffOnlyEvent = (e) => e?.audience === "staff" || (!e?.audience && e?.type === "Staff");

const ADMISSION_STAGES = ["Inquiry", "Tour Scheduled", "Application Submitted", "Enrolled", "Declined"];

const ADMISSION_STAGE_COLOR = {
  "Inquiry": "#8A6420",
  "Tour Scheduled": "#2F6B7A",
  "Application Submitted": "#6E4E9E",
  "Enrolled": "#2F7A5C",
  "Declined": "#B5473B"
};

const ADMISSION_SOURCES = ["Real Estate Partner", "WhatsApp Referral", "Flyer", "Walk-in", "Website", "Other"];

const BEHAVIOR_TYPES = ["Positive", "Concern"];

// School values used to label behaviour notes (both positive notes and concerns).
const SCHOOL_VALUES = ["Respect", "Responsibility", "Safety", "Honesty", "Kindness", "Other"];

const BEHAVIOR_CATEGORIES_POSITIVE = SCHOOL_VALUES;

const BEHAVIOR_CATEGORIES_CONCERN = SCHOOL_VALUES;

// Grades whose students' behaviour notes this person may see and add.
// Admin: every grade. Teacher: their grades, minus grades where they are only the assistant.
// Everyone else (learning assistants, parents, students, accountant): none.
function behaviorGradesFor(profile) {
  if (!profile) return [];
  if (profile.role === "admin") return GRADES;
  if (profile.role !== "teacher") return [];
  const assisting = Array.isArray(profile.assistant_grades) ? profile.assistant_grades : [];
  return (Array.isArray(profile.grades_assigned) ? profile.grades_assigned : []).filter((g) => !assisting.includes(g));
}

const LETTER_GRADES = ["A+", "A", "B+", "B", "C+", "C", "D"];

const LETTER_GRADE_MEANING = {
  "A+": "Outstanding",
  "A": "Excellent",
  "B+": "Very Good",
  "B": "Good",
  "C+": "Satisfactory",
  "C": "Developing",
  "D": "Needs improvement"
};

// Maps each letter grade to the school's official Learning Progress band.
const LEARNING_PROGRESS_BAND = {
  "A+": "Exceeding Expectations",
  "A": "Exceeding Expectations",
  "B+": "Meeting Expectations",
  "B": "Meeting Expectations",
  "C+": "Approaching Expectations",
  "C": "Approaching Expectations",
  "D": "Below Expectations"
};

const letterFromScore = (score) => {
  const n = Number(score);
  if (Number.isNaN(n)) return "";
  if (n >= 97) return "A+";
  if (n >= 90) return "A";
  if (n >= 87) return "B+";
  if (n >= 80) return "B";
  if (n >= 77) return "C+";
  if (n >= 70) return "C";
  return "D";
};

const LETTER_GRADE_COLOR = {
  "A+": "#2F7A5C", "A": "#2F7A5C",
  "B+": "#2F6B7A", "B": "#2F6B7A",
  "C+": "#8A6420", "C": "#8A6420",
  "D": "#B5473B"
};

const STAFF_ROLES = ["Administrator", "Teacher", "Learning Assistant", "Coordinator", "Support Staff", "Other"];

const RESOURCE_CATEGORIES = ["Policies", "Curriculum", "Staff Resources", "Professional Development", "Forms & Templates", "Parent Resources"];

// A parent should only ever browse by these, the rest are internal/staff categories.
const PARENT_RESOURCE_CATEGORIES = ["Policies", "Forms & Templates", "Parent Resources"];

const ACCRED_STATUSES = ["Not Started", "In Progress", "Met"];

const ACCRED_STATUS_COLOR = { "Not Started": "#6B7578", "In Progress": "#8A6420", "Met": "#2F7A5C" };

const DEFAULT_MILESTONES = [
  "Study the accreditation standards and practices",
  "Purchase and study the programme starter resources",
  "Identify the programme coordinator",
  "Coordinator completes leadership training",
  "Submit application",
  "Complete at least one academic year of trial implementation",
  "Submit application for authorisation",
  "Verification visit"
];

const emptyData = { students: [], classes: [], portfolio: [], plans: [], announcements: [], attendance: {}, assessments: [], rubrics: [], settings: DEFAULT_SETTINGS, events: [], admissions: [], assignments: [], reports: [], behaviorIncidents: [], gradeEntries: [], standards: [], staff: [], resources: [], accreditation: { milestones: [], checklist: [] } };

function syncGlobalsFromSettings(settings) {
  if (!settings) return;
  const extraGrades = (settings.grades || []).filter((g) => g && !CORE_GRADES.includes(g) && g !== "Pre Nursery");
  GRADES.length = 0;
  GRADES.push(...CORE_GRADES, ...extraGrades);
  if (settings.assessmentLevels && settings.assessmentLevels.length) {
    ASSESS_LEVELS.length = 0;
    ASSESS_LEVELS.push(...settings.assessmentLevels);
  }
}

// Human-readable names for each part of the school's data, used to describe
// what changed in the activity log without needing to know every field.
const ACTIVITY_AREA_LABELS = {
  students: "Students",
  billing: "Billing",
  feeSchedule: "Billing (fee schedule)",
  assessments: "Assessment",
  gradeEntries: "Gradebook",
  attendance: "Attendance",
  portfolio: "Portfolio",
  resources: "Resources",
  curriculumDocuments: "Curriculum",
  plans: "Curriculum (unit planning)",
  announcements: "Family Updates",
  events: "Calendar",
  classes: "Classes",
  staff: "Staff",
  admissions: "Admissions",
  behaviorIncidents: "Behavior",
  reports: "Reports",
  settings: "Settings",
  standards: "Standards library",
  rubrics: "Rubrics",
  checklist: "Accreditation",
  assignments: "Assignments"
};

const SHORT_GRADE_LABEL = {
  "Pre-N": "Pre-N", "PreK": "PreK", "Kindergarten": "K",
  "Grade 1": "1", "Grade 2": "2", "Grade 3": "3", "Grade 4": "4",
  "Grade 5": "5", "Grade 6": "6", "Grade 7": "7"
};

const GENDERS = ["Female", "Male", "Prefer not to say"];

export { CORE_GRADES, GRADES, TAGS, THEMES, PLAN_TEMPLATE, ASSESS_LEVELS, getLevelColor, BRIGHTSTEPS_LOGO_DATA_URI, usesOldBuiltinLogo, DEFAULT_SETTINGS, EVENT_TYPES, EVENT_TYPE_COLOR, isStaffOnlyEvent, ADMISSION_STAGES, ADMISSION_STAGE_COLOR, ADMISSION_SOURCES, BEHAVIOR_TYPES, SCHOOL_VALUES, BEHAVIOR_CATEGORIES_POSITIVE, BEHAVIOR_CATEGORIES_CONCERN, behaviorGradesFor, LETTER_GRADES, LETTER_GRADE_MEANING, LEARNING_PROGRESS_BAND, letterFromScore, LETTER_GRADE_COLOR, STAFF_ROLES, RESOURCE_CATEGORIES, PARENT_RESOURCE_CATEGORIES, ACCRED_STATUSES, ACCRED_STATUS_COLOR, DEFAULT_MILESTONES, emptyData, syncGlobalsFromSettings, ACTIVITY_AREA_LABELS, SHORT_GRADE_LABEL, GENDERS };

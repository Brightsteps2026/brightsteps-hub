import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, UserCheck, Flag } from "lucide-react";
import StudentPhotoField from "../StudentPhotoField";
import { GRADES, behaviorGradesFor, GENDERS } from "../data/constants";
import { COUNTRIES } from "../data/countries";
import { uid, nextStudentIdNumber } from "../lib/format";
import { Field, Modal, EnrollmentStairs, AvatarStack, StudentThumb } from "../ui/common";
import { FamilyViewModal } from "./ParentStudentView";
import { StudentMessages } from "./Messages";
import { StudentBehavior } from "./Behavior";
import { pending } from "../data/pending";

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

function AccountSetupHelper({ student }) {
  const [copiedWhich, setCopiedWhich] = useState("");

  const copy = async (which, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhich(which);
      setTimeout(() => setCopiedWhich(""), 2500);
    } catch {
      setCopiedWhich("error");
      setTimeout(() => setCopiedWhich(""), 2500);
    }
  };

  const parentSql = `-- Step 1: In Authentication -> Add user, create the parent's login with their real email.
-- Step 2: Copy the User UID it gives you, paste it in place of PASTE_USER_UID_HERE below.
-- Step 3: Replace the placeholder name and email with the real ones, then run this.
insert into profiles (id, full_name, email, role, student_ids)
values (
  'PASTE_USER_UID_HERE',
  'Parent Full Name',
  'parent-real-email@example.com',
  'parent',
  array['${student.id}']
);`;

  const studentEmail = student.studentIdNumber ? `${student.studentIdNumber}@students.brightstepshub.local` : "STUDENT_ID@students.brightstepshub.local";
  const studentSql = `-- Step 1: In Authentication -> Add user, use this exact email: ${studentEmail}
-- Choose any password, then click Create user.
-- Step 2: Copy the User UID it gives you, paste it in place of PASTE_USER_UID_HERE below.
-- Step 3: Run this, nothing else to change, it's already filled in for ${student.name}.
insert into profiles (id, full_name, email, role, student_ids)
values (
  'PASTE_USER_UID_HERE',
  '${student.name}',
  '${studentEmail}',
  'student',
  array['${student.id}']
);`;

  return (
    <div className="bsf-inlinenote">
      <p style={{ marginBottom: 8 }}>Account link code: <code>{student.id}</code></p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="bsf-btn bsf-btn-ghost" onClick={() => copy("parent", parentSql)}>
          {copiedWhich === "parent" ? "Copied!" : "Copy parent setup SQL"}
        </button>
        <button type="button" className="bsf-btn bsf-btn-ghost" onClick={() => copy("student", studentSql)}>
          {copiedWhich === "student" ? "Copied!" : "Copy student setup SQL"}
        </button>
      </div>
      {copiedWhich === "error" && <p className="bsf-formerror">Couldn't copy automatically, you can still select the text manually.</p>}
      <p className="bsf-muted" style={{ marginTop: 8 }}>
        This fills in {student.name}'s real details for you. You'll still need to create the login itself in Supabase's Authentication tab, that one step can't be skipped, but you'll never have to type their name or account code by hand again.
      </p>
    </div>
  );
}

function StudentsTab({ data, persist, profile }) {
  const [activeGrade, setActiveGrade] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [familyViewId, setFamilyViewId] = useState(null);
  const [form, setForm] = useState(emptyStudentForm);
  const [formError, setFormError] = useState("");

  const isLearningAssistant = profile?.role === "learning_assistant";
  const isTeacherRole = profile?.role === "teacher" || isLearningAssistant;
  const myAssignedGrades = profile?.grades_assigned || [];
  const canEditStudents = !isTeacherRole;

  const importBulkStudents = () => {
    setBulkError("");
    setBulkSuccess("");
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setBulkError("Paste one student per line before importing.");
      return;
    }
    const newStudents = [];
    const idNumbersSoFar = data.students.map((s) => s.studentIdNumber).filter(Boolean);
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 4) {
        setBulkError(`This line is missing some fields, each line needs at least First Name | Last Name | Grade | Guardian Name: "${line.slice(0, 50)}..."`);
        return;
      }
      const [firstName, lastName, grade, guardianName, guardianPhone = "", allergies = ""] = parts;
      if (!GRADES.includes(grade)) {
        setBulkError(`"${grade}" isn't a valid grade name. Use exactly: ${GRADES.join(", ")}`);
        return;
      }
      const studentIdNumber = nextStudentIdNumber(idNumbersSoFar);
      idNumbersSoFar.push(studentIdNumber);
      newStudents.push({
        id: uid(),
        studentIdNumber,
        firstName, middleName: "", lastName, grade,
        name: [firstName, lastName].filter(Boolean).join(" "),
        dob: "", gender: "", nationalities: [], photo: null,
        guardian1Name: guardianName, guardian1Relationship: "", guardian1Phone: guardianPhone, guardian1Email: "",
        guardian2Name: "", guardian2Relationship: "", guardian2Phone: "", guardian2Email: "",
        allergies, medicalConditions: "",
        emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelationship: "",
        enrollmentDate: "", previousSchool: "", homeAddress: ""
      });
    }
    persist({ ...data, students: [...data.students, ...newStudents] });
    setBulkText("");
    setBulkSuccess(`Added ${newStudents.length} student${newStudents.length === 1 ? "" : "s"}. You can open each one afterward to fill in anything extra, like nationality or medical notes.`);
  };

  const visibleStudents = isTeacherRole
    ? data.students.filter((s) => myAssignedGrades.includes(s.grade))
    : data.students;

  const counts = useMemo(() => {
    const c = {};
    visibleStudents.forEach((s) => { c[s.grade] = (c[s.grade] || 0) + 1; });
    return c;
  }, [visibleStudents]);

  const filtered = (activeGrade ? visibleStudents.filter((s) => s.grade === activeGrade) : visibleStudents)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const familyViewStudent = visibleStudents.find((s) => s.id === familyViewId);
  const [messagingId, setMessagingId] = useState(() => {
    const id = pending.messageStudentId;
    pending.messageStudentId = null;
    return id;
  });
  useEffect(() => {
    const open = (e) => { pending.messageStudentId = null; setMessagingId(e.detail); };
    window.addEventListener("bs-open-thread", open);
    return () => window.removeEventListener("bs-open-thread", open);
  }, []);
  const messagingStudent = visibleStudents.find((s) => s.id === messagingId);
  const myBehaviorGrades = behaviorGradesFor(profile);
  const [behaviorId, setBehaviorId] = useState(null);
  const behaviorStudent = visibleStudents.find((s) => s.id === behaviorId && myBehaviorGrades.includes(s.grade));

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyStudentForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (student) => {
    // Teachers can't edit student records; tapping a student opens the
    // parent-teacher message thread instead.
    // Learning assistants don't message parents: they get the read-only family view.
    if (isLearningAssistant) { setFamilyViewId(student.id); return; }
    if (!canEditStudents) { setMessagingId(student.id); return; }
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
    const st = data.students.find((s) => s.id === id);
    const name = st ? (st.name || `${st.firstName || ""} ${st.lastName || ""}`.trim()) : "this student";
    if (!window.confirm(`Remove ${name} from the Hub? Their profile and their message thread with parents will be deleted. This cannot be undone.`)) return;
    persist({ ...data, students: data.students.filter((s) => s.id !== id) });
  };

  const editingStudent = data.students.find((s) => s.id === editingId);
  const total = visibleStudents.length;
  const recentStudents = [...visibleStudents].sort((a, b) => (b.studentIdNumber || "").localeCompare(a.studentIdNumber || "")).slice(0, 6);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((s) => {
      if (!groups[s.grade]) groups[s.grade] = [];
      groups[s.grade].push(s);
    });
    return GRADES.filter((g) => groups[g]).map((g) => ({ grade: g, students: groups[g] }));
  }, [filtered]);

  const renderStudentCard = (s) => (
    <div key={s.id} className="bsf-card bsf-student bsf-clickable" onClick={() => openEdit(s)}>
      <StudentThumb photo={s.photo} />
      <div className="bsf-student-info">
        <strong>{s.name}</strong>
        <p className="bsf-muted">{(s.nationalities && s.nationalities.length) ? s.nationalities.join(" - ") : (s.nationality || "")}{s.studentIdNumber ? `${(s.nationalities?.length || s.nationality) ? " · " : ""}ID ${s.studentIdNumber}` : ""}</p>
        {!isTeacherRole && s.guardian1Name && <p className="bsf-muted">{s.guardian1Name}{s.guardian1Phone ? ` · ${s.guardian1Phone}` : ""}</p>}
        {s.allergies && <span className="bsf-tag bsf-tag-alert">Allergy: {s.allergies}</span>}
      </div>
      <div className="bsf-student-actions">
        <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); setFamilyViewId(s.id); }} aria-label="Family view"><UserCheck size={16} /></button>
        {myBehaviorGrades.includes(s.grade) && (
          <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); setBehaviorId(s.id); }} aria-label="Behaviour" title="Behaviour"><Flag size={16} /></button>
        )}
        {canEditStudents && <button className="bsf-iconbtn" onClick={(e) => { e.stopPropagation(); removeStudent(s.id); }} aria-label="Remove"><Trash2 size={16} /></button>}
      </div>
    </div>
  );

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Students</p>
        <h1>{total} student{total === 1 ? "" : "s"} enrolled</h1>
        {recentStudents.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <AvatarStack students={recentStudents} />
          </div>
        )}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {canEditStudents && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="bsf-btn bsf-btn-ghost" onClick={() => { setBulkError(""); setBulkSuccess(""); setShowBulkAdd(true); }}>Add many</button>
            <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>
          </div>
        )}
      </div>

      <section className="bsf-card bsf-stairs-card">
        <h2>{activeGrade ? `Showing ${activeGrade}` : "Tap a grade to filter"}</h2>
        <EnrollmentStairs counts={counts} activeGrade={activeGrade} onSelect={setActiveGrade} />
      </section>

      {filtered.length === 0 && <p className="bsf-empty">No students in this view yet.</p>}

      {activeGrade
        ? <section className="bsf-list">{filtered.map(renderStudentCard)}</section>
        : grouped.map(({ grade, students }) => (
            <section key={grade} className="bsf-list">
              <p className="bsf-group-label">{grade} · {students.length} student{students.length === 1 ? "" : "s"}</p>
              {students.map(renderStudentCard)}
            </section>
          ))
      }

      {showForm && canEditStudents && (
        <Modal title={editingId ? "Edit student" : "Add student"} onClose={() => setShowForm(false)}>
          {editingId && editingStudent && (
            <AccountSetupHelper student={editingStudent} />
          )}
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

      {messagingStudent && (
        <Modal title={messagingStudent.name} onClose={() => setMessagingId(null)}>
          <StudentMessages student={messagingStudent} data={data} persist={persist} />
        </Modal>
      )}

      {behaviorStudent && (
        <Modal title={`${behaviorStudent.name} · Behaviour`} onClose={() => setBehaviorId(null)}>
          <StudentBehavior student={behaviorStudent} data={data} persist={persist} profile={profile} />
        </Modal>
      )}

      {familyViewStudent && (
        <FamilyViewModal student={familyViewStudent} data={data} onClose={() => setFamilyViewId(null)} hideContacts={isTeacherRole} />
      )}

      {showBulkAdd && canEditStudents && (
        <Modal title="Add many students at once" onClose={() => setShowBulkAdd(false)}>
          <p className="bsf-muted" style={{ marginBottom: 8 }}>
            Paste one student per line, in this format:
          </p>
          <p className="bsf-inlinenote">
            <code>First Name | Last Name | Grade | Guardian Name | Guardian Phone | Allergies</code>
            <br /><br />
            Guardian Phone and Allergies can be left blank. Grade must be written exactly like:
            <br />
            <code>{GRADES.join(", ")}</code>
            <br /><br />
            Example:
            <br />
            <code>Amara | Kone | Grade 2 | Fatou Kone | 0708112233 |</code>
            <br />
            <code>Yannick | Diallo | Grade 4 | Ibrahim Diallo | 0555221100 | Peanuts</code>
          </p>
          <Field label="Paste students here">
            <textarea rows={8} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="One student per line" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={importBulkStudents}>Import students</button>
          {bulkError && <p className="bsf-formerror">{bulkError}</p>}
          {bulkSuccess && <p className="bsf-muted" style={{ marginTop: 8 }}>{bulkSuccess}</p>}
        </Modal>
      )}
    </div>
  );
}

export { emptyStudentForm, StudentsTab };

import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GRADES, ADMISSION_STAGES, ADMISSION_STAGE_COLOR, ADMISSION_SOURCES } from "../data/constants";
import { uid, todayStr } from "../lib/format";
import { Field, Modal } from "../ui/common";
import { emptyStudentForm } from "./Students";

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
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Admissions</p>
        <h1>{(data.admissions || []).length} in the pipeline</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
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

export { AdmissionsTab };

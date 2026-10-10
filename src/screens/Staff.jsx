import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { GRADES, STAFF_ROLES } from "../data/constants";
import { uid } from "../lib/format";
import { Field, Modal } from "../ui/common";

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
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Staff</p>
        <h1>{(data.staff || []).length} team member{(data.staff || []).length === 1 ? "" : "s"}</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
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

export { StaffTab };

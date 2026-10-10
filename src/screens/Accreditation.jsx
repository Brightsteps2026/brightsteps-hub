import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ACCRED_STATUSES, ACCRED_STATUS_COLOR, DEFAULT_MILESTONES } from "../data/constants";
import { uid, safeLink } from "../lib/format";
import { Field, Modal } from "../ui/common";

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
        {milestones.length === 0 && <p className="bsf-empty">Load the starter checklist to track the main stages towards accreditation.</p>}
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
              {c.evidenceLink && <a className="bsf-resource-link" href={safeLink(c.evidenceLink)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{c.evidenceLink}</a>}
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

export { AccreditationTab };

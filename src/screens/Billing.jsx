import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { uid, todayStr, formatCurrency, computeFeeBreakdown, feeCategoryIcon } from "../lib/format";
import { Field, Modal, StudentThumb } from "../ui/common";

const FEE_CATEGORIES = ["Registration", "Tuition", "Other"];

function BillingTab({ data, persist }) {
  const [studentFilter, setStudentFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleRows, setScheduleRows] = useState({});
  const [form, setForm] = useState({ studentId: "", type: "payment", category: "Tuition", amount: "", description: "", date: todayStr() });
  const [formError, setFormError] = useState("");

  const billing = data.billing || [];
  const students = [...data.students].sort((a, b) => a.name.localeCompare(b.name));

  const balanceForStudent = (studentId) =>
    computeFeeBreakdown(data, studentId).reduce((sum, item) => sum + item.due, 0);

  const feeBreakdownFor = (studentId) => computeFeeBreakdown(data, studentId);

  const openSchedule = (studentId) => {
    const existing = {};
    FEE_CATEGORIES.forEach((cat) => {
      const entry = (data.feeSchedule || []).find((f) => f.studentId === studentId && f.category === cat);
      const listPrice = entry ? (entry.listPrice != null ? entry.listPrice : entry.amountDue) : "";
      existing[cat] = {
        listPrice: listPrice ? String(listPrice) : "",
        discountAmount: entry?.discountAmount ? String(entry.discountAmount) : "",
        discountReason: entry?.discountReason || "",
        waived: !!entry?.waived
      };
    });
    setScheduleRows(existing);
    setShowSchedule(true);
  };

  const updateScheduleRow = (cat, patch) => {
    setScheduleRows({ ...scheduleRows, [cat]: { ...scheduleRows[cat], ...patch } });
  };

  const saveSchedule = () => {
    const withoutThisStudent = (data.feeSchedule || []).filter((f) => f.studentId !== studentFilter);
    const newEntries = FEE_CATEGORIES
      .filter((cat) => (scheduleRows[cat]?.listPrice && Number(scheduleRows[cat].listPrice) > 0) || scheduleRows[cat]?.waived)
      .map((cat) => ({
        id: uid(),
        studentId: studentFilter,
        category: cat,
        listPrice: Number(scheduleRows[cat].listPrice || 0),
        discountAmount: Number(scheduleRows[cat].discountAmount || 0),
        discountReason: scheduleRows[cat].discountReason || "",
        waived: !!scheduleRows[cat].waived
      }));
    persist({ ...data, feeSchedule: [...withoutThisStudent, ...newEntries] });
    setShowSchedule(false);
  };

  const filteredEntries = [...billing]
    .filter((b) => !studentFilter || b.studentId === studentFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const addEntry = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError("Please choose a student.");
      return;
    }
    const amt = Number(form.amount);
    if (!form.amount || Number.isNaN(amt) || amt <= 0) {
      setFormError("Please enter an amount greater than 0.");
      return;
    }
    const entry = { id: uid(), studentId: student.id, studentName: student.name, type: form.type, category: form.category, amount: amt, description: form.description, date: form.date || todayStr() };
    persist({ ...data, billing: [...billing, entry] });
    setForm({ studentId: "", type: "payment", category: "Tuition", amount: "", description: "", date: todayStr() });
    setFormError("");
    setShowAdd(false);
  };

  const removeEntry = (id) => persist({ ...data, billing: billing.filter((b) => b.id !== id) });

  const totalOwed = students.reduce((sum, s) => sum + Math.max(0, balanceForStudent(s.id)), 0);
  const selectedStudent = students.find((s) => s.id === studentFilter);

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Billing</p>
        <h1>{formatCurrency(totalOwed)} owed school-wide</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }} disabled={students.length === 0}><Plus size={16} /> Add entry</button>
      </div>

      <section className="bsf-card">
        <h2>Select a student</h2>
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
          <option value="">All students</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
        </select>
      </section>

      {!studentFilter && (
        <section className="bsf-list">
          <p className="bsf-group-label">Every student, at a glance</p>
          {students.length === 0 && <p className="bsf-empty">Add students first, then track their billing here.</p>}
          {students.map((s) => {
            const bal = balanceForStudent(s.id);
            return (
              <div key={s.id} className="bsf-card bsf-student bsf-clickable" onClick={() => setStudentFilter(s.id)}>
                <StudentThumb photo={s.photo} />
                <div style={{ flex: 1 }}>
                  <strong>{s.name}</strong>
                  <p className="bsf-muted">{s.grade}</p>
                </div>
                <span className="bsf-status-pill" style={{ background: bal > 0 ? "#FCE8E8" : "#E6F2EC", color: bal > 0 ? "#B23A3A" : "#2F7A5C" }}>
                  {formatCurrency(Math.abs(bal))}{bal > 0 ? " due" : bal < 0 ? " credit" : " settled"}
                </span>
              </div>
            );
          })}
        </section>
      )}

      {studentFilter && selectedStudent && (() => {
        const feeItems = feeBreakdownFor(studentFilter);
        const balance = balanceForStudent(studentFilter);
        return (
          <>
            <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
              <span />
              <button className="bsf-btn bsf-btn-ghost" onClick={() => openSchedule(studentFilter)}>Set fee schedule</button>
            </div>
            <section className="bsf-card bsf-invoicecard">
              <div className="bsf-invoicehead">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StudentThumb photo={selectedStudent.photo} />
                  <div>
                    <p className="bsf-eyebrow" style={{ margin: 0 }}>{selectedStudent.name}</p>
                    <p className="bsf-muted" style={{ margin: "2px 0 0" }}>{selectedStudent.grade}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="bsf-invoicetotal" style={{ color: balance > 0 ? "#B23A3A" : "#2F7A5C" }}>{formatCurrency(Math.abs(balance))}</p>
                  <p className="bsf-muted" style={{ margin: 0 }}>{balance > 0 ? "Total balance due" : balance < 0 ? "Credit on file" : "Fully settled"}</p>
                </div>
              </div>
              {feeItems.length === 0 ? (
                <p className="bsf-empty">No fee schedule set for this student yet. Tap "Set fee schedule" above to get started.</p>
              ) : (
                <div className="bsf-invoicelines">
                  {feeItems.map((item) => {
                    const statusColor = item.status === "Paid in full" ? "#2F7A5C" : item.status === "Waived" ? "#6B5B95" : item.status === "Partially paid" ? "#8A6420" : item.status === "No fee set" ? "#6B7578" : "#B23A3A";
                    const CatIcon = feeCategoryIcon(item.category);
                    return (
                      <div key={item.category} className="bsf-invoiceline">
                        <div className="bsf-invoiceline-top">
                          <div className="bsf-invoiceline-label">
                            <span className="bsf-invoiceline-icon" style={{ background: `${statusColor}1A`, color: statusColor }}><CatIcon size={15} /></span>
                            <strong>{item.category === "Registration" ? "Registration Fee" : item.category}</strong>
                          </div>
                          <span className="bsf-status-pill" style={{ background: `${statusColor}1A`, color: statusColor }}>{item.status}</span>
                        </div>
                        <div className="bsf-invoicebar"><span style={{ width: `${item.pct}%`, background: statusColor }} /></div>
                        {item.waived ? (
                          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>Real price {formatCurrency(item.listPrice)} · fully waived</p>
                        ) : item.discountAmount > 0 ? (
                          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>
                            Real price {formatCurrency(item.listPrice)} · {formatCurrency(item.discountAmount)} discount{item.discountReason ? ` (${item.discountReason})` : ""}
                          </p>
                        ) : null}
                        <div className="bsf-invoiceline-bottom">
                          <span className="bsf-muted">{formatCurrency(item.paid)} paid of {formatCurrency(item.charged)} owed</span>
                          {item.due > 0 && <span style={{ color: statusColor, fontWeight: 600 }}>{formatCurrency(item.due)} due</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <p className="bsf-group-label">Full transaction history</p>
          </>
        );
      })()}

      <section className="bsf-list">
        {studentFilter && filteredEntries.length === 0 && <p className="bsf-empty">No transactions recorded for this student yet.</p>}
        {filteredEntries.map((b) => {
          const isPayment = b.type !== "charge";
          return (
          <div key={b.id} className="bsf-card bsf-txnrow">
            <span className="bsf-txnicon" style={{ background: isPayment ? "#E6F2EC" : "#FCE8E8", color: isPayment ? "#2F7A5C" : "#B23A3A" }}>
              {isPayment ? "+" : "−"}
            </span>
            <div style={{ flex: 1 }}>
              {!studentFilter && <strong style={{ display: "block" }}>{b.studentName}</strong>}
              <div className="bsf-row-head">
                <strong style={{ color: isPayment ? "#2F7A5C" : "#B23A3A" }}>{formatCurrency(b.amount)}</strong>
                <span className="bsf-muted">{b.date}</span>
              </div>
              <p className="bsf-muted" style={{ margin: 0 }}>{b.category || "Tuition"}{b.description ? ` · ${b.description}` : ""}</p>
            </div>
            <button className="bsf-iconbtn" onClick={() => removeEntry(b.id)} aria-label="Remove"><Trash2 size={16} /></button>
          </div>
          );
        })}
      </section>

      {showAdd && (
        <Modal title="New billing entry" onClose={() => setShowAdd(false)}>
          <Field label="Student">
            <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Choose a student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
            </select>
          </Field>
          <Field label="Fee category">
            <div className="bsf-chiprow">
              {FEE_CATEGORIES.map((cat) => (
                <button key={cat} type="button" className={`bsf-chip ${form.category === cat ? "active" : ""}`} onClick={() => setForm({ ...form, category: cat })}>{cat}</button>
              ))}
            </div>
          </Field>
          <Field label="Type">
            <div className="bsf-chiprow">
              <button type="button" className={`bsf-chip ${form.type === "payment" ? "active" : ""}`} onClick={() => setForm({ ...form, type: "payment" })}>Payment received</button>
              <button type="button" className={`bsf-chip ${form.type === "charge" ? "active" : ""}`} onClick={() => setForm({ ...form, type: "charge" })}>Extra charge (e.g. a late fee)</button>
            </div>
            <p className="bsf-muted" style={{ marginTop: 4 }}>
              What's normally owed is set once in "Set fee schedule." Use "Extra charge" only for something additional, like a late fee.
            </p>
          </Field>
          <Field label="Amount (FCFA)">
            <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 500000" />
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Description (optional)">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Term 1 tuition, or Mobile money payment" />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addEntry}>Save entry</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {showSchedule && selectedStudent && (
        <Modal title={`Fee schedule: ${selectedStudent.name}`} onClose={() => setShowSchedule(false)}>
          <p className="bsf-muted" style={{ marginBottom: 12 }}>
            Enter the real price for each category, then add a discount or mark it waived if this student doesn't pay full price.
          </p>
          {FEE_CATEGORIES.map((cat) => {
            const row = scheduleRows[cat] || { listPrice: "", discountAmount: "", discountReason: "", waived: false };
            const net = row.waived ? 0 : Math.max(0, Number(row.listPrice || 0) - Number(row.discountAmount || 0));
            return (
              <div key={cat} className="bsf-schedulerow">
                <p className="bsf-group-label" style={{ margin: "0 0 8px" }}>{cat}</p>
                <Field label="Real price (FCFA)">
                  <input
                    type="number" min="0"
                    value={row.listPrice}
                    onChange={(e) => updateScheduleRow(cat, { listPrice: e.target.value })}
                    placeholder="e.g. 150000"
                    disabled={row.waived}
                  />
                </Field>
                <div className="bsf-two-col">
                  <Field label="Discount amount (optional)">
                    <input
                      type="number" min="0"
                      value={row.discountAmount}
                      onChange={(e) => updateScheduleRow(cat, { discountAmount: e.target.value })}
                      placeholder="e.g. 50000"
                      disabled={row.waived}
                    />
                  </Field>
                  <Field label="Discount reason (optional)">
                    <input
                      value={row.discountReason}
                      onChange={(e) => updateScheduleRow(cat, { discountReason: e.target.value })}
                      placeholder="e.g. Sibling discount"
                      disabled={row.waived}
                    />
                  </Field>
                </div>
                <label className="bsf-checkboxrow" style={{ marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={row.waived}
                    onChange={(e) => updateScheduleRow(cat, { waived: e.target.checked })}
                  />
                  <span>Fully waived, this student doesn't owe anything for {cat.toLowerCase()}</span>
                </label>
                {(row.listPrice || row.waived) && (
                  <p className="bsf-muted" style={{ marginTop: 2 }}>
                    {row.waived ? "Waived, 0 FCFA owed" : `They actually owe: ${formatCurrency(net)}${Number(row.discountAmount) > 0 ? ` (${formatCurrency(Number(row.discountAmount))} discount applied)` : ""}`}
                  </p>
                )}
                <hr className="bsf-divider" />
              </div>
            );
          })}
          <button className="bsf-btn bsf-btn-block" onClick={saveSchedule}>Save fee schedule</button>
        </Modal>
      )}
    </div>
  );
}

export { BillingTab };

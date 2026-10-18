import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { Plus, Trash2, FileText } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { useLanguage, pluralKey } from "../lib/i18n";
import { RESOURCE_CATEGORIES, PARENT_RESOURCE_CATEGORIES } from "../data/constants";
import { uid, safeLink, todayStr, formatDateLong, tLabel } from "../lib/format";
import { Field, Modal, SignaturePad } from "../ui/common";

const emptyResourceForm = { title: "", category: RESOURCE_CATEGORIES[0], link: "", description: "", files: [], filesFr: [], visibleToParents: false, requiresSignature: false, requiresStaffSignature: false };

// Staff who are asked to read and sign a staff document.
const SIGNING_ROLES = ["teacher", "learning_assistant"];

function ResourcesTab({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [form, setForm] = useState(emptyResourceForm);
  const [formError, setFormError] = useState("");

  const [signingId, setSigningId] = useState(null);
  const [signatureName, setSignatureName] = useState(profile?.full_name || "");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [signatureError, setSignatureError] = useState("");

  const isParent = profile?.role === "parent";
  const isAdminView = profile?.role === "admin" || profile?.role === "viewer";
  const signsAsStaff = SIGNING_ROLES.includes(profile?.role);

  // Staff signatures live in their own table (staff_signatures): each person sees their own,
  // the admin sees everyone's.
  const [staffSigs, setStaffSigs] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const loadStaffSigs = () => {
    if (isParent) return;
    supabase.from("staff_signatures").select("id, resource_id, user_id, full_name, signed_at")
      .then(({ data: rows, error }) => { if (!error) setStaffSigs(rows || []); });
  };
  useEffect(() => {
    loadStaffSigs();
    if (isAdminView) {
      supabase.from("profiles").select("id, full_name, email, role").in("role", SIGNING_ROLES)
        .then(({ data: rows }) => setStaffList((rows || []).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))));
    }
  }, []);
  const sigsFor = (rid) => staffSigs.filter((x) => x.resource_id === rid);
  const mySig = (rid) => staffSigs.find((x) => x.resource_id === rid && x.user_id === profile?.id);

  const openSign = (id) => {
    setSigningId(id);
    setSignatureName(profile?.full_name || "");
    setSignatureDataUrl("");
    setSignatureConfirmed(false);
    setSignatureError("");
  };

  const saveSignature = async () => {
    if (!signatureName.trim()) {
      setSignatureError(t("sign.errName"));
      return;
    }
    if (!signatureDataUrl) {
      setSignatureError(t("sign.errSignature"));
      return;
    }
    if (!signatureConfirmed) {
      setSignatureError(t("sign.errConfirm"));
      return;
    }
    if (!isParent) {
      const doc = (data.resources || []).find((r) => r.id === signingId);
      const { error } = await supabase.from("staff_signatures").insert({
        resource_id: signingId, resource_title: doc?.title || null, user_id: profile.id,
        full_name: signatureName.trim(), signature: signatureDataUrl
      });
      if (error) { setSignatureError(/staff_signatures/.test(error.message) ? "Signing isn't switched on yet. Please tell the office." : "Not saved: " + error.message); return; }
      setSigningId(null);
      loadStaffSigs();
      return;
    }
    const signature = { id: uid(), parentId: profile.id, parentName: signatureName.trim(), signatureDataUrl, date: todayStr() };
    persist({
      ...data,
      resources: (data.resources || []).map((r) =>
        r.id === signingId ? { ...r, signatures: [...(r.signatures || []).filter((s) => s.parentId !== profile.id), signature] } : r
      )
    });
    setSigningId(null);
  };

  const resources = [...(data.resources || [])]
    .filter((r) => !isParent || r.visibleToParents)
    .sort((a, b) => a.title.localeCompare(b.title));
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
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("nav.resources")}</p>
        <h1>{t(pluralKey("resources.count", resources.length, language), { n: resources.length })}</h1>
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isParent && <button className="bsf-btn" onClick={openAdd}><Plus size={16} /> Add</button>}
      </div>

      <section className="bsf-card">
        <h2>{t("common.filterByCategory")}</h2>
        <div className="bsf-chiprow">
          <button className={`bsf-chip ${categoryFilter === null ? "active" : ""}`} onClick={() => setCategoryFilter(null)}>{t("common.all")}</button>
          {(isParent ? PARENT_RESOURCE_CATEGORIES : RESOURCE_CATEGORIES).map((c) => (
            <button key={c} className={`bsf-chip ${categoryFilter === c ? "active" : ""}`} onClick={() => setCategoryFilter(c)}>{tLabel(t, "resourceCat.", c)}</button>
          ))}
        </div>
      </section>

      <section className="bsf-list">
        {filtered.length === 0 && <p className="bsf-empty">{isParent ? t("resources.emptyParent") : "No resources added yet."}</p>}
        {filtered.map((r) => {
          const mySignature = (r.signatures || []).find((s) => s.parentId === profile?.id);
          // Parents see only the file in their language (English when there is no French one).
          const parentFiles = language === "fr" && (r.filesFr || []).length > 0 ? r.filesFr : (r.files || []).length > 0 ? r.files : r.filesFr || [];
          return (
          <div key={r.id} className="bsf-card bsf-student">
            <div>
              <div className="bsf-row-head">
                <span className="bsf-tag">{tLabel(t, "resourceCat.", r.category)}</span>
              </div>
              <strong>{r.title}</strong>
              {r.description && <p>{r.description}</p>}
              {r.link && (
                <a className="bsf-resource-link" href={safeLink(r.link)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {r.link}
                </a>
              )}
              {isParent && parentFiles.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <AttachmentField folder="resources" files={parentFiles} onChange={() => {}} readOnly />
                </div>
              )}
              {!isParent && (r.files || []).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <p className="bsf-muted" style={{ marginBottom: 2 }}>English</p>
                  <AttachmentField folder="resources" files={r.files} onChange={(files) => persist({ ...data, resources: (data.resources || []).map((x) => (x.id === r.id ? { ...x, files } : x)) })} />
                </div>
              )}
              {!isParent && (r.filesFr || []).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <p className="bsf-muted" style={{ marginBottom: 2 }}>Français</p>
                  <AttachmentField folder="resources" files={r.filesFr} onChange={(filesFr) => persist({ ...data, resources: (data.resources || []).map((x) => (x.id === r.id ? { ...x, filesFr } : x)) })} />
                </div>
              )}
              {!isParent && r.requiresSignature && (
                <span className="bsf-minitag" style={{ marginTop: 8, display: "inline-block" }}>{(r.signatures || []).length} parent{(r.signatures || []).length === 1 ? "" : "s"} signed</span>
              )}
              {!isParent && r.requiresStaffSignature && isAdminView && (
                <span className="bsf-minitag" style={{ marginTop: 8, marginLeft: 6, display: "inline-block" }}>
                  {sigsFor(r.id).length} of {staffList.length} staff signed
                </span>
              )}
              {!isParent && r.requiresStaffSignature && signsAsStaff && (
                mySig(r.id) ? (
                  <p className="bsf-minitag" style={{ marginTop: 8, display: "inline-block" }}>✓ You signed on {formatDateLong(mySig(r.id).signed_at.slice(0, 10), "en")}</p>
                ) : (
                  <button className="bsf-btn" style={{ marginTop: 8, display: "block" }} onClick={() => openSign(r.id)}>Read and sign</button>
                )
              )}
              {isParent && r.requiresSignature && (
                mySignature ? (
                  <p className="bsf-minitag" style={{ marginTop: 8, display: "inline-block" }}>{t("dash.signedOn", { date: formatDateLong(mySignature.date, language) })}</p>
                ) : (
                  <button className="bsf-btn" style={{ marginTop: 8 }} onClick={() => openSign(r.id)}>{t("dash.readAndSign")}</button>
                )
              )}
            </div>
            {!isParent && (
              <div className="bsf-student-actions">
                <button className="bsf-iconbtn" onClick={() => openEdit(r)} aria-label="Edit"><FileText size={16} /></button>
                <button className="bsf-iconbtn" onClick={() => removeResource(r.id)} aria-label="Remove"><Trash2 size={16} /></button>
              </div>
            )}
          </div>
          );
        })}
      </section>

      {showForm && !isParent && (
        <Modal title={editingId ? "Edit resource" : "Add resource"} onClose={() => setShowForm(false)}>
          <Field label="Title">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Parent and Student Handbook" />
          </Field>
          <Field label="Category">
            <div className="bsf-chiprow">
              {RESOURCE_CATEGORIES.map((c) => (
                <button key={c} type="button" className={`bsf-chip ${form.category === c ? "active" : ""}`} onClick={() => setForm({ ...form, category: c })}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Link (optional)">
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Link to a Google Drive doc, PDF, or website" />
          </Field>
          <Field label="Description">
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="File (English)">
            <AttachmentField folder="resources" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <Field label="File (Français)">
            <AttachmentField folder="resources" files={form.filesFr} onChange={(filesFr) => setForm({ ...form, filesFr })} />
          </Field>
          <label className="bsf-checkboxrow" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={form.visibleToParents}
              onChange={(e) => setForm({ ...form, visibleToParents: e.target.checked })}
            />
            <span>Visible to parents (e.g. the Parent and Student Handbook)</span>
          </label>
          {!form.visibleToParents && (
            <label className="bsf-checkboxrow" style={{ marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={form.requiresStaffSignature}
                onChange={(e) => setForm({ ...form, requiresStaffSignature: e.target.checked })}
              />
              <span>Staff must read and sign (teachers and learning assistants), e.g. the Staff Handbook</span>
            </label>
          )}
          {editingId && form.requiresStaffSignature && isAdminView && (() => {
            const signed = sigsFor(editingId);
            const missing = staffList.filter((p) => !signed.some((x) => x.user_id === p.id));
            return (
              <div className="bsf-inlinenote" style={{ marginBottom: 14 }}>
                <strong style={{ display: "block", marginBottom: 6 }}>{signed.length} of {staffList.length} staff signed</strong>
                {signed.map((x) => (
                  <p key={x.id} className="bsf-muted" style={{ margin: "2px 0" }}>✓ {x.full_name} · {formatDateLong(x.signed_at.slice(0, 10), "en")}</p>
                ))}
                {missing.length > 0 && (
                  <p className="bsf-muted" style={{ margin: "8px 0 0" }}>Not signed yet: {missing.map((p) => p.full_name || p.email).join(", ")}</p>
                )}
              </div>
            );
          })()}
          {form.visibleToParents && (
            <label className="bsf-checkboxrow" style={{ marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={form.requiresSignature}
                onChange={(e) => setForm({ ...form, requiresSignature: e.target.checked })}
              />
              <span>Requires a signature to acknowledge</span>
            </label>
          )}
          {editingId && (data.resources || []).find((r) => r.id === editingId)?.requiresSignature && (
            <div className="bsf-inlinenote">
              <strong style={{ display: "block", marginBottom: 6 }}>
                {((data.resources || []).find((r) => r.id === editingId)?.signatures || []).length} parent{((data.resources || []).find((r) => r.id === editingId)?.signatures || []).length === 1 ? "" : "s"} signed so far
              </strong>
              {((data.resources || []).find((r) => r.id === editingId)?.signatures || []).map((s) => (
                <p key={s.id} className="bsf-muted" style={{ margin: "2px 0" }}>{s.parentName} · {s.date}</p>
              ))}
            </div>
          )}
          <button className="bsf-btn bsf-btn-block" onClick={saveResource}>{editingId ? "Save changes" : "Save resource"}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {signingId && (() => {
        const doc = (data.resources || []).find((r) => r.id === signingId);
        if (!doc) return null;
        return (
          <Modal title={t("sign.title", { title: doc.title })} onClose={() => setSigningId(null)}>
            <p className="bsf-muted" style={{ marginBottom: 12 }}>
              {t("sign.intro")}
            </p>
            <Field label={t("sign.fullName")}>
              <input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
            </Field>
            <Field label={t("sign.signature")}>
              <SignaturePad onChange={setSignatureDataUrl} />
            </Field>
            <label className="bsf-checkboxrow" style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={signatureConfirmed} onChange={(e) => setSignatureConfirmed(e.target.checked)} />
              <span>{t("sign.confirm", { title: doc.title })}</span>
            </label>
            <button className="bsf-btn bsf-btn-block" onClick={saveSignature}>{t("sign.submit")}</button>
            {signatureError && <p className="bsf-formerror">{signatureError}</p>}
          </Modal>
        );
      })()}
    </div>
  );
}

// Staff Dashboard: documents still waiting for this person's signature.
function StaffToSignCard({ data, profile, onNavigate }) {
  const [signedIds, setSignedIds] = useState(null);
  useEffect(() => {
    if (!SIGNING_ROLES.includes(profile?.role)) return;
    supabase.from("staff_signatures").select("resource_id").eq("user_id", profile.id)
      .then(({ data: rows, error }) => setSignedIds(error ? null : (rows || []).map((r) => r.resource_id)));
  }, [profile?.id]);
  if (!SIGNING_ROLES.includes(profile?.role) || !signedIds) return null;
  const todo = (data?.resources || []).filter((r) => r.requiresStaffSignature && !signedIds.includes(r.id));
  if (!todo.length) return null;
  return (
    <section className="bsf-card" style={{ border: "2px solid #801524" }}>
      <h2 style={{ marginTop: 0 }}>Please read and sign</h2>
      <p style={{ margin: "0 0 10px" }}>{todo.map((r) => r.title).join(", ")}</p>
      <button className="bsf-btn" onClick={() => onNavigate && onNavigate("resources")}>Go to Resources</button>
    </section>
  );
}

export { ResourcesTab, StaffToSignCard };

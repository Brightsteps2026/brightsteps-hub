import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { useAuth } from "../LoginGate";
import { useLanguage, pluralKey } from "../lib/i18n";
import { GRADES } from "../data/constants";
import { uid, formatDateLong } from "../lib/format";
import { Field, Modal } from "../ui/common";
import { LinkedText } from "../ui/LinkedText";

function UpdatesTab({ data, persist }) {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const isParent = profile?.role === "parent";
  const isTeacherRole = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const myAssignedGrades = profile?.grades_assigned || [];
  const linkedIds = profile?.student_ids || [];
  const myChildGrades = isParent ? [...new Set(data.students.filter((s) => linkedIds.includes(s.id)).map((s) => s.grade))] : [];

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ titleEn: "", bodyEn: "", titleFr: "", bodyFr: "", grades: [], files: [], filesFr: [] });
  const [formError, setFormError] = useState("");
  const [translatingId, setTranslatingId] = useState(null);
  const [translateForm, setTranslateForm] = useState({ titleFr: "", bodyFr: "" });
  // Show the post as families will see it, before publishing (new post and French translation).
  const [showPreview, setShowPreview] = useState(false);
  const [showFrPreview, setShowFrPreview] = useState(false);

  const allPosts = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date));
  const posts = isParent
    ? allPosts.filter((a) => !a.grades || a.grades.length === 0 || a.grades.some((g) => myChildGrades.includes(g)))
    : allPosts;

  const toggleGrade = (g) => {
    setForm((f) => ({ ...f, grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g] }));
  };

  const addPost = () => {
    if (!form.titleEn.trim()) {
      setFormError("Please add an English title before posting.");
      return;
    }
    if (isTeacherRole && form.grades.length === 0) {
      setFormError("Please choose at least one of your grades to send this to.");
      return;
    }
    const post = { id: uid(), ...form, date: new Date().toISOString().slice(0, 10) };
    persist({ ...data, announcements: [...data.announcements, post] });
    setForm({ titleEn: "", bodyEn: "", titleFr: "", bodyFr: "", grades: [], files: [], filesFr: [] });
    setFormError("");
    setShowPreview(false);
    setShowAdd(false);
  };

  const previewCard = (title, body, lang) => (
    <div className="bsf-preview" aria-live="polite">
      <p className="bsf-preview-label" style={{ marginBottom: 10 }}>Preview · how families will see it</p>
      <div className="bsf-preview-card">
        <span className="bsf-muted">{formatDateLong(new Date().toISOString().slice(0, 10), lang)}</span>
        <strong style={{ display: "block" }}>{title || <span className="bsf-muted">(No title yet)</span>}</strong>
        {body.trim() ? <LinkedText text={body} /> : <p className="bsf-muted">(No message yet)</p>}
      </div>
      <p className="bsf-preview-note">Tap the links above to check they open correctly. Nothing has been posted yet.</p>
    </div>
  );

  const setPostFiles = (id, key, files) => persist({
    ...data,
    announcements: data.announcements.map((a) => (a.id === id ? { ...a, [key]: files } : a))
  });

  const removePost = (id) => {
    const post = data.announcements.find((a) => a.id === id);
    if (!window.confirm(`Delete "${post?.titleEn || "this update"}"? Families will no longer see it. This cannot be undone.`)) return;
    persist({ ...data, announcements: data.announcements.filter((a) => a.id !== id) });
  };

  const openTranslate = (post) => {
    setTranslateForm({ titleFr: post.titleFr || "", bodyFr: post.bodyFr || "" });
    setShowFrPreview(false);
    setTranslatingId(post.id);
  };

  const saveTranslation = () => {
    persist({
      ...data,
      announcements: data.announcements.map((a) => (a.id === translatingId ? { ...a, ...translateForm } : a))
    });
    setTranslatingId(null);
  };

  const translatingPost = data.announcements.find((a) => a.id === translatingId);

  const audienceLabel = (a) => {
    if (!a.grades || a.grades.length === 0) return "Whole school";
    return a.grades.join(", ");
  };

  const recentCount = posts.filter((a) => a.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).length;

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">{t("nav.updates")}</p>
        <h1>{t(pluralKey("updates.posts", posts.length, language), { n: posts.length })}</h1>
        {recentCount > 0 && <p className="bsf-hero-sub">{t("common.inLast7Days", { n: recentCount })}</p>}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isParent && <button className="bsf-btn" onClick={() => { setFormError(""); setForm({ titleEn: "", bodyEn: "", titleFr: "", bodyFr: "", grades: [], files: [], filesFr: [] }); setShowPreview(false); setShowAdd(true); }}><Plus size={16} /> Post</button>}
      </div>

      <section className="bsf-list">
        {posts.length === 0 && <p className="bsf-empty">{t("dash.nothingPosted")}</p>}
        {posts.map((a) => {
          if (isParent) {
            const showFrench = language === "fr" && a.titleFr;
            return (
              <div key={a.id} className="bsf-card bsf-student">
                <div>
                  <span className="bsf-muted">{formatDateLong(a.date, language)}</span>
                  <strong>{showFrench ? a.titleFr : a.titleEn}</strong>
                  <LinkedText text={showFrench ? a.bodyFr : a.bodyEn} />
                  {(() => {
                    const postFiles = language === "fr" && (a.filesFr || []).length > 0 ? a.filesFr : (a.files || []).length > 0 ? a.files : a.filesFr || [];
                    return postFiles.length > 0 && (
                      <AttachmentField folder="resources" files={postFiles} onChange={() => {}} readOnly />
                    );
                  })()}
                </div>
              </div>
            );
          }
          return (
            <div key={a.id} className="bsf-card bsf-student">
              <div>
                <div className="bsf-row-head">
                  <span className="bsf-muted">{a.date}</span>
                  <span className="bsf-tag">{audienceLabel(a)}</span>
                </div>
                <strong>{a.titleEn}</strong>
                <LinkedText text={a.bodyEn} />
                <div style={{ marginTop: 6 }}>
                  <p className="bsf-muted" style={{ marginBottom: 2 }}>File (English)</p>
                  <AttachmentField folder="resources" files={a.files || []} onChange={(files) => setPostFiles(a.id, "files", files)} />
                </div>
                <div style={{ marginTop: 6 }}>
                  <p className="bsf-muted" style={{ marginBottom: 2 }}>File (Français)</p>
                  <AttachmentField folder="resources" files={a.filesFr || []} onChange={(filesFr) => setPostFiles(a.id, "filesFr", filesFr)} />
                </div>
                {a.titleFr && (
                  <div className="bsf-fr-block">
                    <strong>{a.titleFr}</strong>
                    <LinkedText text={a.bodyFr} />
                  </div>
                )}
                <button className="bsf-textbtn" onClick={() => openTranslate(a)} style={{ marginTop: 6 }}>
                  {a.titleFr ? "Edit French translation" : "Add French translation"}
                </button>
              </div>
              <button className="bsf-iconbtn" onClick={() => removePost(a.id)} aria-label="Delete update" title="Delete update"><Trash2 size={16} /></button>
            </div>
          );
        })}
      </section>

      {showAdd && (
        <Modal title="New family update" onClose={() => setShowAdd(false)}>
          <Field label={isTeacherRole ? "Send to (choose your grade or grades)" : "Send to"}>
            <div className="bsf-chiprow">
              {isTeacherRole ? (
                myAssignedGrades.length === 0 ? (
                  <p className="bsf-empty">You don't have any grades assigned yet. Ask your administrator.</p>
                ) : (
                  myAssignedGrades.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`}
                      onClick={() => toggleGrade(g)}
                    >
                      {g}
                    </button>
                  ))
                )
              ) : (
                <>
                  <button
                    type="button"
                    className={`bsf-chip ${form.grades.length === 0 ? "active" : ""}`}
                    onClick={() => setForm({ ...form, grades: [] })}
                  >
                    Whole school
                  </button>
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`bsf-chip ${form.grades.includes(g) ? "active" : ""}`}
                      onClick={() => toggleGrade(g)}
                    >
                      {g}
                    </button>
                  ))}
                </>
              )}
            </div>
          </Field>
          <Field label="Title (English)">
            <input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} />
          </Field>
          <Field label="Message (English)">
            <textarea rows={8} value={form.bodyEn} onChange={(e) => setForm({ ...form, bodyEn: e.target.value })} />
          </Field>
          <Field label="File, e.g. newsletter (English, optional)">
            <AttachmentField folder="resources" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <Field label="File (Français, optional)">
            <AttachmentField folder="resources" files={form.filesFr} onChange={(filesFr) => setForm({ ...form, filesFr })} />
          </Field>
          <p className="bsf-muted" style={{ marginBottom: 12 }}>
            You can add the French translation afterward, once it's ready, from the post itself.
          </p>
          {showPreview && previewCard(form.titleEn, form.bodyEn, "en")}
          <button type="button" className="bsf-textbtn" style={{ marginBottom: 12 }} onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          <button className="bsf-btn bsf-btn-block" onClick={addPost}>Publish update</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}

      {translatingPost && (
        <Modal title="French translation" onClose={() => setTranslatingId(null)}>
          <p className="bsf-muted" style={{ marginBottom: 12 }}>
            English version: <strong>{translatingPost.titleEn}</strong>
          </p>
          <Field label="Titre (Français)">
            <input value={translateForm.titleFr} onChange={(e) => setTranslateForm({ ...translateForm, titleFr: e.target.value })} />
          </Field>
          <Field label="Message (Français)">
            <textarea rows={8} value={translateForm.bodyFr} onChange={(e) => setTranslateForm({ ...translateForm, bodyFr: e.target.value })} />
          </Field>
          {showFrPreview && previewCard(translateForm.titleFr, translateForm.bodyFr, "fr")}
          <button type="button" className="bsf-textbtn" style={{ marginBottom: 12 }} onClick={() => setShowFrPreview(!showFrPreview)}>
            {showFrPreview ? "Hide preview" : "Preview"}
          </button>
          <button className="bsf-btn bsf-btn-block" onClick={saveTranslation}>Save translation</button>
        </Modal>
      )}
    </div>
  );
}

export { UpdatesTab };

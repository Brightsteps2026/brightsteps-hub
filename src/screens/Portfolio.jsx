import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { useLanguage, pluralKey } from "../lib/i18n";
import { TAGS } from "../data/constants";
import { uid, formatDateLong } from "../lib/format";
import { Field, Modal, StudentThumb } from "../ui/common";

function PortfolioTab({ data, persist, profile }) {
  const { t, language } = useLanguage();
  const isParent = profile?.role === "parent";
  const isStudent = profile?.role === "student";
  const isStaffScoped = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const linkedIds = profile?.student_ids || [];
  const myAssignedGrades = profile?.grades_assigned || [];
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ studentId: "", tag: TAGS[0], note: "", author: "teacher", files: [] });
  const [formError, setFormError] = useState("");

  const myStudentId = isStudent ? linkedIds[0] : null;
  const myStudent = myStudentId ? data.students.find((s) => s.id === myStudentId) : null;

  const visibleStudentIds = isStaffScoped
    ? data.students.filter((s) => myAssignedGrades.includes(s.grade)).map((s) => s.id)
    : null;

  const entries = [...data.portfolio]
    .filter((p) => !isParent || linkedIds.includes(p.studentId))
    .filter((p) => !isStudent || p.studentId === myStudentId)
    .filter((p) => !visibleStudentIds || visibleStudentIds.includes(p.studentId))
    .sort((a, b) => b.date.localeCompare(a.date));

  const openAddAsStudent = () => {
    if (!myStudent) return;
    setForm({ studentId: myStudent.id, tag: TAGS[0], note: "", author: "student", files: [] });
    setFormError("");
    setShowAdd(true);
  };

  const addEntry = () => {
    const student = data.students.find((s) => s.id === form.studentId);
    if (!student) {
      setFormError(t("portfolio.errorChooseStudent"));
      return;
    }
    if (!form.note.trim() && form.files.length === 0) {
      setFormError(isStudent ? "Write something or add a photo before saving." : t("portfolio.errorAddNote"));
      return;
    }
    const entry = {
      id: uid(),
      studentId: student.id,
      studentName: student.name,
      tag: form.tag,
      note: form.note,
      author: isStudent ? "student" : form.author,
      files: form.files,
      date: new Date().toISOString().slice(0, 10)
    };
    persist({ ...data, portfolio: [...data.portfolio, entry] });
    setForm({ studentId: "", tag: TAGS[0], note: "", author: "teacher", files: [] });
    setFormError("");
    setShowAdd(false);
  };

  const removeEntry = (id) => persist({ ...data, portfolio: data.portfolio.filter((p) => p.id !== id) });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentEntries = entries.filter((p) => p.date >= sevenDaysAgo);
  const earlierEntries = entries.filter((p) => p.date < sevenDaysAgo);

  const renderEntry = (p) => {
    const student = data.students.find((s) => s.id === p.studentId);
    const canEditThisEntry = !isParent && (!isStudent || p.author === "student");
    const reactions = p.reactions || [];
    const iReacted = profile?.id && reactions.some((r) => r.profileId === profile.id);
    const toggleReaction = () => {
      if (!profile?.id) return;
      const nextReactions = iReacted
        ? reactions.filter((r) => r.profileId !== profile.id)
        : [...reactions, { profileId: profile.id, name: profile.full_name || "Someone" }];
      persist({ ...data, portfolio: data.portfolio.map((e) => (e.id === p.id ? { ...e, reactions: nextReactions } : e)) });
    };
    return (
      <div key={p.id} className="bsf-card bsf-portfolio-entry">
        <StudentThumb photo={student?.photo} />
        <div style={{ flex: 1 }}>
          <div className="bsf-row-head">
            <strong>{p.studentName}</strong>
            <span className={`bsf-author-badge ${p.author === "student" ? "student" : "teacher"}`}>
              {p.author === "student" ? t("portfolio.studentReflection") : t("portfolio.teacherNote")}
            </span>
          </div>
          <div className="bsf-row-head" style={{ marginTop: 2 }}>
            <span className="bsf-tag">{t(`tag.${p.tag}`)}</span>
            <span className="bsf-muted">{isParent ? formatDateLong(p.date, language) : p.date}</span>
          </div>
          <p style={{ marginTop: 8 }}>{p.note}</p>
          {(!isParent || (p.files || []).length > 0) && (
            <AttachmentField
              folder="portfolio"
              files={p.files || []}
              onChange={(files) =>
                persist({ ...data, portfolio: data.portfolio.map((e) => (e.id === p.id ? { ...e, files } : e)) })
              }
              readOnly={isParent}
            />
          )}
          <div className="bsf-reactionrow">
            <button type="button" className={`bsf-reactbtn ${iReacted ? "active" : ""}`} onClick={toggleReaction}>
              <span>{iReacted ? "❤️" : "🤍"}</span>
              {reactions.length > 0 && <span>{reactions.length}</span>}
            </button>
            {reactions.length > 0 && (
              <span className="bsf-muted bsf-reactionnames">
                {reactions.slice(0, 3).map((r) => r.name.split(" ")[0]).join(", ")}{reactions.length > 3 ? t("portfolio.andMore", { n: reactions.length - 3 }) : ""}
              </span>
            )}
          </div>
        </div>
        {canEditThisEntry && <button className="bsf-iconbtn" onClick={() => removeEntry(p.id)} aria-label={t("common.remove")}><Trash2 size={16} /></button>}
      </div>
    );
  };

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        {isStudent && myStudent ? (
          <>
            <p className="bsf-eyebrow">{myStudent.grade}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
              <StudentThumb photo={myStudent.photo} />
              <div>
                <h1 style={{ marginBottom: 2 }}>Welcome back, {myStudent.firstName || myStudent.name.split(" ")[0]}</h1>
                <p className="bsf-hero-sub" style={{ margin: 0 }}>This is your space, your work, your voice.</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="bsf-eyebrow">{t("portfolio.title")}</p>
            <h1>{t(pluralKey("portfolio.entries", entries.length, language), { n: entries.length })}</h1>
          </>
        )}
        {recentEntries.length > 0 && <p className="bsf-hero-sub" style={{ marginTop: 10 }}>{t("portfolio.addedRecent", { n: recentEntries.length })}</p>}
      </div>

      <div className="bsf-screen-head" style={{ marginBottom: 0 }}>
        <span />
        {!isParent && !isStudent && <button className="bsf-btn" onClick={() => { setFormError(""); setShowAdd(true); }} disabled={data.students.length === 0}><Plus size={16} /> {t("common.add")}</button>}
        {isStudent && myStudent && <button className="bsf-btn" onClick={openAddAsStudent}><Plus size={16} /> Add my reflection</button>}
      </div>

      {data.students.length === 0 && !isParent && !isStudent && <p className="bsf-empty">{t("portfolio.emptyStudents")}</p>}
      {isParent && entries.length === 0 && <p className="bsf-empty">{t("portfolio.emptyChild")}</p>}
      {isStudent && !myStudent && <p className="bsf-empty">Your account isn't linked to a student record yet. Ask your teacher or admin.</p>}
      {isStudent && myStudent && entries.length === 0 && <p className="bsf-empty">No entries yet, tap "Add my reflection" to share your first one.</p>}

      {recentEntries.length > 0 && (
        <section className="bsf-list">
          <p className="bsf-group-label">{t("portfolio.thisWeek")}</p>
          {recentEntries.map(renderEntry)}
        </section>
      )}
      {earlierEntries.length > 0 && (
        <section className="bsf-list">
          <p className="bsf-group-label">{t("portfolio.earlier")}</p>
          {earlierEntries.map(renderEntry)}
        </section>
      )}

      {showAdd && (
        <Modal title={isStudent ? "My reflection" : t("portfolio.newEntry")} onClose={() => setShowAdd(false)}>
          {!isStudent && (
            <>
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
                  {(isStaffScoped ? data.students.filter((s) => myAssignedGrades.includes(s.grade)) : data.students).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.grade}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label={t("portfolio.focusArea")}>
            <select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
              {TAGS.map((tg) => <option key={tg} value={tg}>{t(`tag.${tg}`)}</option>)}
            </select>
          </Field>
          <Field label={isStudent ? "Write about it (optional if you're adding a photo)" : (form.author === "student" ? t("portfolio.whatStudentWrote") : t("portfolio.whatDidTheyDo"))}>
            <textarea
              rows={4}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={isStudent ? "Tell us about your work..." : (form.author === "student" ? t("portfolio.placeholderStudentWords") : t("portfolio.placeholderLearningMoment"))}
            />
          </Field>
          <Field label={isStudent ? "Add a photo" : t("portfolio.attachmentsOptional")}>
            <AttachmentField folder="portfolio" files={form.files} onChange={(files) => setForm({ ...form, files })} />
          </Field>
          <button className="bsf-btn bsf-btn-block" onClick={addEntry}>{isStudent ? "Save my reflection" : t("portfolio.saveEntry")}</button>
          {formError && <p className="bsf-formerror">{formError}</p>}
        </Modal>
      )}
    </div>
  );
}

export { PortfolioTab };

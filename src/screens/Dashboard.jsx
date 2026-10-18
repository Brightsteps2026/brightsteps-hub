import { useState, useEffect, useMemo } from "react";
import { Users, Calendar as CalendarIcon, Utensils } from "lucide-react";
import AttachmentField from "../AttachmentField";
import { useLanguage } from "../lib/i18n";
import { supabase } from "../lib/supabaseClient";
import { ReportAbsenceCard } from "../AbsenceReport";
import StaffDeadlinesCard from "../StaffDeadlines";
import { WeeklyUpdateCard } from "../WeeklyUpdates";
import { StaffToSignCard } from "./Resources";
import { GRADES, DEFAULT_SETTINGS, isStaffOnlyEvent } from "../data/constants";
import { uid, formatEventWhen, todayStr, lunchWeekLabel, isThisSchoolWeek, useTodayWeekday, formatCurrency, formatDateLong, formatTimestampDate, gradeLabel, tLabel, computeFeeBreakdown, feeCategoryIcon, attendanceCountsForRange } from "../lib/format";
import { EventRow, Field, Modal, EnrollmentStairs, SignaturePad, StudentThumb } from "../ui/common";
import { pending } from "../data/pending";

function Dashboard({ data, profile, persist, onNavigate }) {
  const { t, language } = useLanguage();
  const settings = data.settings || DEFAULT_SETTINGS;
  const isParent = profile?.role === "parent";
  const linkedIds = profile?.student_ids || [];
  const myStudents = isParent ? data.students.filter((s) => linkedIds.includes(s.id)) : [];

  const [signingDocId, setSigningDocId] = useState(null);
  const [signatureName, setSignatureName] = useState(profile?.full_name || "");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [signatureError, setSignatureError] = useState("");
  const isAdmin = profile?.role === "admin";
  const LUNCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const LUNCH_DAY_LABELS = {
    en: { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri" },
    fr: { Monday: "Lun", Tuesday: "Mar", Wednesday: "Mer", Thursday: "Jeu", Friday: "Ven" }
  };
  const lunchMenu = data.lunchMenu || { weekOf: "", days: {} };
  const [editingLunch, setEditingLunch] = useState(false);
  const [savingLunch, setSavingLunch] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnForm, setShowAnnForm] = useState(false);
  const emptyAnnForm = { title: "", title_fr: "", body: "", body_fr: "", audience: "school", show_staff: true, email: true };
  const [annForm, setAnnForm] = useState(emptyAnnForm);
  const [editingAnnId, setEditingAnnId] = useState(null);
  const [emailingAnnId, setEmailingAnnId] = useState(null);
  const [showAllAnn, setShowAllAnn] = useState(false);
const [postingAnn, setPostingAnn] = useState(false);
// Email an announcement to the parents who can see it (once per announcement).
const emailAnnouncement = async (id) => {
  setEmailingAnnId(id);
  const { data: res, error } = await supabase.functions.invoke("notify-announcement", { body: { id } });
  setEmailingAnnId(null);
  if (error || res?.error) { console.error("announcement email failed", error || res?.error); alert("The announcement is posted, but the email could not be sent. You can try again with \"Email parents\"."); return false; }
  const stamp = new Date().toISOString();
  setAnnouncements((list) => list.map((a) => (a.id === id ? { ...a, emailed_at: a.emailed_at || stamp } : a)));
  if (res?.already) alert("This announcement was already emailed to parents.");
  else alert(`Emailed to ${res?.sent || 0} parent${res?.sent === 1 ? "" : "s"}.`);
  return true;
};
const openNewAnnouncement = () => { setEditingAnnId(null); setAnnForm(emptyAnnForm); setShowAnnForm(true); };
const openEditAnnouncement = (a) => {
  setEditingAnnId(a.id);
  setAnnForm({ title: a.title || "", title_fr: a.title_fr || "", body: a.body || "", body_fr: a.body_fr || "", audience: a.audience || "school", show_staff: a.show_staff !== false, email: false });
  setShowAnnForm(true);
};
const closeAnnForm = () => { setShowAnnForm(false); setEditingAnnId(null); setAnnForm(emptyAnnForm); };
const postAnnouncement = async () => {
  if (!annForm.title.trim() || !annForm.body.trim() || postingAnn) return;
  setPostingAnn(true);
  const fields = { title: annForm.title.trim(), title_fr: annForm.title_fr.trim(), body: annForm.body.trim(), body_fr: annForm.body_fr.trim(), audience: annForm.audience, show_staff: annForm.show_staff };
  if (editingAnnId) {
    // Fixing a mistake: no new bell notice and no new email.
    const { data: row, error } = await supabase.from("announcements").update({ ...fields, edited_at: new Date().toISOString() }).eq("id", editingAnnId).select().single();
    setPostingAnn(false);
    if (error) { console.error("announcement edit failed", error); alert("Could not save your changes."); return; }
    setAnnouncements(announcements.map((a) => (a.id === row.id ? row : a)));
    closeAnnForm();
    return;
  }
  const { data: row, error } = await supabase.from("announcements").insert(fields).select().single();
  setPostingAnn(false);
  if (error) { console.error("announcement failed", error); alert("Could not post announcement."); return; }
  setAnnouncements([row, ...announcements]);
  const sendEmail = annForm.email;
  closeAnnForm();
  if (sendEmail) emailAnnouncement(row.id);
};
const deleteAnnouncement = async (id) => {
  if (!window.confirm("Delete this announcement? Parents will no longer see it.")) return;
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) { console.error("delete failed", error); alert("Could not delete."); return; }
  setAnnouncements(announcements.filter((a) => a.id !== id));
};
useEffect(() => {
  supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(60).then(({ data, error }) => {
    if (error) { console.error("announcements load failed", error); return; }
    setAnnouncements(data || []);
  });
}, []);
  // Each person only sees the announcements meant for them: families by their
  // children's grades, staff only those marked "Also show on staff dashboard".
  const visibleAnnouncements = (() => {
    const role = profile?.role;
    if (role === "admin" || role === "viewer") return announcements;
    if (role === "parent" || role === "student") {
      const kids = data.students.filter((s) => linkedIds.includes(s.id));
      const lowerEnd = GRADES.indexOf("Grade 5");
      return announcements.filter((a) =>
        a.audience === "school" || !a.audience ||
        kids.some((k) => {
          const gi = GRADES.indexOf(k.grade);
          if (a.audience === "lower") return gi >= 0 && gi <= lowerEnd;
          if (a.audience === "upper") return gi > lowerEnd;
          return a.audience === k.grade;
        })
      );
    }
    return announcements.filter((a) => a.show_staff !== false);
  })();
  const [gradeStaff, setGradeStaff] = useState({});
    const isFr = language === "fr";
useEffect(() => {
  supabase.from("grade_staff").select("*").then(({ data, error }) => {
    if (error) { console.error("grade staff load failed", error); return; }
    const map = {};
    (data || []).forEach((r) => { map[r.grade] = r; });
    setGradeStaff(map);
  });
}, []);
  const [lunchForm, setLunchForm] = useState(lunchMenu);

  const openLunchEdit = () => {
    setLunchForm(data.lunchMenu || { weekOf: "", days: {} });
    setEditingLunch(true);
  };
const saveLunchMenu = async () => {
    if (savingLunch) return;
    setSavingLunch(true);
    const ok = await persist({ ...data, lunchMenu: lunchForm });
    if (!ok) {
      setSavingLunch(false);
      alert("The menu could not be saved. Please check your connection and try again.");
      return;
    }
    const weekEn = lunchWeekLabel(lunchForm.weekOf, "en");
    const weekFr = lunchWeekLabel(lunchForm.weekOf, "fr");
    const { data: row, error } = await supabase.from("announcements").insert({
      title: "Lunch menu updated",
      title_fr: "Menu de la cantine mis à jour",
      body: "The lunch menu" + (weekEn ? " for the week of " + weekEn : "") + " has been updated. You can see it on your dashboard.",
      body_fr: "Le menu de la cantine" + (weekFr ? " de la semaine du " + weekFr : "") + " a été mis à jour. Vous pouvez le consulter sur votre tableau de bord.",
      audience: "school",
      show_staff: true
    }).select().single();
    if (error) { console.error("menu announcement failed", error); }
    else { setAnnouncements([row, ...announcements]); }
    // Bell notice for every parent.
    supabase.rpc("notify_lunch_menu", { p_week: /^\d{4}-\d{2}-\d{2}$/.test(lunchForm.weekOf || "") ? lunchForm.weekOf : null })
      .then(({ error: e }) => { if (e) console.error("lunch bell notice failed", e); });
    setSavingLunch(false);
    setEditingLunch(false);
  };
 // Was: LUNCH_DAYS[new Date().getDay() - 1]. That was computed once per render,
  // so an open tab kept highlighting a stale day, and on Sat/Sun it read index
  // 5 / -1 and quietly produced undefined.
  const todayWeekday = useTodayWeekday();
  // Only highlight today's lunch when the menu is for this week (an old menu
  // used to show as "today's lunch"). Older menus with a typed week still highlight.
  const lunchIsThisWeek = !/^\d{4}-\d{2}-\d{2}$/.test(lunchMenu.weekOf || "") || isThisSchoolWeek(lunchMenu.weekOf);
  const todayLunchName = lunchIsThisWeek && LUNCH_DAYS.includes(todayWeekday) ? todayWeekday : null;
  const activeLunchDays = language === "fr" ? (lunchMenu.daysFr || {}) : (lunchMenu.days || {});
  const hasLunchMenu = lunchMenu.weekOf || LUNCH_DAYS.some((d) => lunchMenu.days?.[d] || lunchMenu.daysFr?.[d]);

  const openSign = (docId) => {
    setSigningDocId(docId);
    setSignatureName(profile?.full_name || "");
    setSignatureDataUrl("");
    setSignatureConfirmed(false);
    setSignatureError("");
  };

  const saveSignature = () => {
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
    const signature = {
      id: uid(),
      parentId: profile.id,
      parentName: signatureName.trim(),
      signatureDataUrl,
      date: todayStr()
    };
    persist({
      ...data,
      resources: (data.resources || []).map((r) =>
        r.id === signingDocId ? { ...r, signatures: [...(r.signatures || []).filter((s) => s.parentId !== profile.id), signature] } : r
      )
    });
    setSigningDocId(null);
  };

  const balanceFor = (studentId) => computeFeeBreakdown(data, studentId).reduce((sum, item) => sum + item.due, 0);

  // Breaks a child's fees down by category (Registration, Tuition, Other), the
  // way a real school invoice would, rather than one lump number.
  const feeBreakdownFor = (studentId) => computeFeeBreakdown(data, studentId);

  const attendanceFor = (studentId) => attendanceCountsForRange(data.attendance, studentId);

  const isGradeScopedStaff = profile?.role === "teacher" || profile?.role === "learning_assistant";
  const dashStudents = isGradeScopedStaff
    ? data.students.filter((s) => (profile?.grades_assigned || []).includes(s.grade))
    : data.students;

  const counts = useMemo(() => {
    const c = {};
    dashStudents.forEach((s) => { c[s.grade] = (c[s.grade] || 0) + 1; });
    return c;
  }, [dashStudents]);

  const total = dashStudents.length;
  const recentPortfolio = [...data.portfolio]
    .filter((p) => !isParent || linkedIds.includes(p.studentId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const recentAnnouncements = [...data.announcements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  const today = todayStr();
  const nextEvents = [...(data.events || [])]
    .filter((e) => (e.endDate || e.date) >= today)
    .filter((e) => !isParent || !isStaffOnlyEvent(e))
    .filter((e) => !isParent || !e.grades || e.grades.length === 0 || myStudents.some((s) => e.grades.includes(s.grade)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const openChildProfile = (studentId) => {
    pending.childProfileId = studentId;
    if (onNavigate) onNavigate("students");
  };

  const recentStudents = isParent
    ? myStudents
    : [...dashStudents].sort((a, b) => (b.studentIdNumber || "").localeCompare(a.studentIdNumber || "")).slice(0, 6);

  return (
    <div className="bsf-screen">
            {(() => {
        const now = new Date();
        const hour = now.getHours();
        const greetEn = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
        const greetFr = hour < 18 ? "Bonjour" : "Bonsoir";
        const firstName = (profile?.full_name || "").split(" ")[0];
        const nameBit = firstName ? `, ${firstName}` : "";
        const dateEn = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
        const dateFr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        const startY = (settings.academicYear.startDate || "").slice(0, 4);
        const endY = (settings.academicYear.endDate || "").slice(0, 4);
        const yearLabel = startY && endY ? `${startY}–${endY}` : "";
        const nextEvent = nextEvents[0];
        const todayLunch = todayLunchName ? activeLunchDays[todayLunchName]?.dish : "";
        const gradeCount = Object.keys(counts).length;
        return (
          <>
            <div className="bsf-welcome">
              <div className="bsf-welcome-glow" />
              <div className="bsf-welcome-row">
                <div>
                                    <p className="bsf-welcome-date">{isFr ? dateFr : dateEn}</p>
                                    <h1 className="bsf-welcome-title">{isFr ? greetFr : greetEn}{nameBit}</h1>
                  {!isParent && settings.branding.mission && <p className="bsf-welcome-mission">{settings.branding.mission}</p>}
                </div>
                {yearLabel && <span className="bsf-welcome-pill">{yearLabel}</span>}
              </div>
            </div>
            {!isParent && (
              <div className="bsf-tiles">
                <div className="bsf-tile">
                  <p className="bsf-tile-label"><Users size={14} /> Students</p>
                  <p className="bsf-tile-number">{total}</p>
                  <p className="bsf-tile-sub">across {gradeCount} grade{gradeCount === 1 ? "" : "s"}</p>
                </div>
                <div className="bsf-tile">
                  <p className="bsf-tile-label"><CalendarIcon size={14} /> Next event</p>
                  <p className="bsf-tile-value">{nextEvent ? nextEvent.title : "Nothing scheduled"}</p>
                  {nextEvent && <p className="bsf-tile-sub">{formatEventWhen(nextEvent, language)}</p>}
                </div>
                <div className="bsf-tile">
                  <p className="bsf-tile-label"><Utensils size={14} /> Today's lunch</p>
                  <p className="bsf-tile-value">{todayLunch || "No menu today"}</p>
                </div>
              </div>
            )}
            {isParent && myStudents.length > 0 && (
              <div className="bsf-tiles">
                {myStudents.map((s) => (
                  <div key={s.id} className="bsf-tile bsf-child-tile bsf-clickable" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => openChildProfile(s.id)} onKeyDown={(e) => { if (e.key === "Enter") openChildProfile(s.id); }}>
                    <div className="bsf-child-photo"><StudentThumb photo={s.photo} /></div>
                    <div>
                      <p className="bsf-tile-value">{s.firstName || s.name.split(" ")[0]}</p>
                                            <p className="bsf-tile-sub">{gradeLabel(s.grade, language)} · {gradeStaff[s.grade]?.homeroom_teacher || t("dash.toBeConfirmed")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}

      {isParent && myStudents.length > 0 && (
        <WeeklyUpdateCard students={myStudents} language={language}
          onOpen={(id) => { pending.scrollToWeekly = true; openChildProfile(id); }} />
      )}
      {isParent && myStudents.length > 0 && <ReportAbsenceCard students={myStudents} />}

      {!isParent && <StaffToSignCard data={data} profile={profile} onNavigate={onNavigate} />}
      {!isParent && <StaffDeadlinesCard profile={profile} events={data.events} onNavigate={onNavigate} />}

         {isParent && (() => {
        // Once this parent has signed a document, it leaves the Dashboard (it stays in Resources).
        const parentDocs = (data.resources || []).filter((d) => d.visibleToParents && !(d.requiresSignature && (d.signatures || []).some((s) => s.parentId === profile?.id)));
        if (parentDocs.length === 0) return null;
        return (
          <section className="bsf-card">
            <h2>{t("dash.schoolDocuments")}</h2>
            <div className="bsf-list">
              {parentDocs.map((d) => {
                const mySignature = (d.signatures || []).find((s) => s.parentId === profile?.id);
                // Only the file in the parent's language; English when there is no French one.
                const docFiles = language === "fr" && (d.filesFr || []).length > 0 ? d.filesFr : (d.files || []).length > 0 ? d.files : d.filesFr || [];
                return (
                <div key={d.id} style={{ marginBottom: 14 }}>
                  <strong>{d.title}</strong>
                  {d.description && <p className="bsf-muted">{d.description}</p>}
                  {docFiles.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <AttachmentField folder="resources" files={docFiles} onChange={() => {}} readOnly />
                    </div>
                  )}
                  {d.requiresSignature && (
                    mySignature ? (
                      <p className="bsf-minitag" style={{ marginTop: 8, display: "inline-block" }}>{t("dash.signedOn", { date: formatDateLong(mySignature.date, language) })}</p>
                    ) : (
                      <button className="bsf-btn" style={{ marginTop: 8 }} onClick={() => openSign(d.id)}>{t("dash.readAndSign")}</button>
                    )
                  )}
                </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {signingDocId && (() => {
        const doc = (data.resources || []).find((d) => d.id === signingDocId);
        if (!doc) return null;
        return (
          <Modal title={t("sign.title", { title: doc.title })} onClose={() => setSigningDocId(null)}>
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

      {isParent && myStudents.length === 0 && (
        <section className="bsf-card">
          <p className="bsf-empty">{t("dash.noChildLinked")}</p>
        </section>
      )}

      {isParent && myStudents.map((s) => {
        const balance = balanceFor(s.id);
        const attend = attendanceFor(s.id);
        const feeItems = feeBreakdownFor(s.id);
        return (
          <div key={s.id}>
            <section className="bsf-card">
              <div role="button" tabIndex={0} onClick={() => openChildProfile(s.id)} onKeyDown={(e) => { if (e.key === "Enter") openChildProfile(s.id); }} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, cursor: "pointer" }}>
                <StudentThumb photo={s.photo} />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontFamily: "'Fraunces', serif", fontSize: 17 }}>{s.name}</strong>
                  <p className="bsf-muted" style={{ margin: 0 }}>
                    {gradeLabel(s.grade, language)}{(s.nationalities && s.nationalities.length) ? ` · ${s.nationalities.join(" - ")}` : (s.nationality ? ` · ${s.nationality}` : "")}
                  </p>
                </div>
                <span className="bsf-muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>{isFr ? "Voir le profil ›" : "View profile ›"}</span>
              </div>
                            <div style={{ borderTop: "0.5px solid var(--line)", paddingTop: 10, marginBottom: 6, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                                    <span className="bsf-muted">{t("dash.homeroomTeacher")}</span>
                  <strong style={{ textAlign: "right" }}>{gradeStaff[s.grade]?.homeroom_teacher || t("dash.toBeConfirmed")}</strong>
                </div>
                {gradeStaff[s.grade]?.learning_assistant && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "4px 0" }}>
                                        <span className="bsf-muted">{t("dash.learningAssistant")}</span>
                    <strong style={{ textAlign: "right" }}>{gradeStaff[s.grade].learning_assistant}</strong>
                  </div>
                )}
              </div>
              {s.allergies && <p className="bsf-alert-note">{t("dash.allergies")} {s.allergies}</p>}
            </section>

            <section className="bsf-card bsf-invoicecard">
              <div className="bsf-invoicehead">
                <div>
                  <p className="bsf-eyebrow" style={{ margin: 0 }}>{t("fees.title")}</p>
                  <p className="bsf-muted" style={{ margin: "2px 0 0" }}>{s.firstName || s.name.split(" ")[0]} · {settings.academicYear.startDate ? settings.academicYear.startDate.slice(0, 4) : ""}{settings.academicYear.endDate ? `–${settings.academicYear.endDate.slice(2, 4)}` : ""}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="bsf-invoicetotal" style={{ color: balance > 0 ? "#B23A3A" : "#2F7A5C" }}>{formatCurrency(Math.abs(balance))}</p>
                  <p className="bsf-muted" style={{ margin: 0 }}>{balance > 0 ? t("fees.totalDue") : balance < 0 ? t("fees.credit") : t("fees.settled")}</p>
                </div>
              </div>

              {feeItems.length === 0 ? (
                <p className="bsf-empty">{t("fees.noSchedule")}</p>
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
                            <strong>{item.category === "Registration" ? t("fees.registrationFee") : tLabel(t, "fees.cat.", item.category)}</strong>
                          </div>
                          <span className="bsf-status-pill" style={{ background: `${statusColor}1A`, color: statusColor }}>{tLabel(t, "fees.status.", item.status)}</span>
                        </div>
                        <div className="bsf-invoicebar">
                          <span style={{ width: `${item.pct}%`, background: statusColor }} />
                        </div>
                        {item.waived ? (
                          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>{t("fees.realPriceWaived", { price: formatCurrency(item.listPrice) })}</p>
                        ) : item.discountAmount > 0 ? (
                          <p className="bsf-muted" style={{ margin: "4px 0 0" }}>
                            {t("fees.realPriceDiscount", { price: formatCurrency(item.listPrice), discount: formatCurrency(item.discountAmount) })}{item.discountReason ? ` (${item.discountReason})` : ""}
                          </p>
                        ) : null}
                        <div className="bsf-invoiceline-bottom">
                          <span className="bsf-muted">{t("fees.paidOf", { paid: formatCurrency(item.paid), owed: formatCurrency(item.charged) })}</span>
                          {item.due > 0 && <span style={{ color: statusColor, fontWeight: 600 }}>{t("fees.due", { amount: formatCurrency(item.due) })}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {(() => {
              const history = [...(data.billing || [])].filter((b) => b.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
              if (history.length === 0) return null;
              return (
                <section className="bsf-card">
                  <h2>{t("fees.history")}</h2>
                  <div className="bsf-list">
                    {history.map((b) => {
                      const isPayment = b.type !== "charge";
                      return (
                        <div key={b.id} className="bsf-txnrow" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                          <span className="bsf-txnicon" style={{ background: isPayment ? "#E6F2EC" : "#FCE8E8", color: isPayment ? "#2F7A5C" : "#B23A3A" }}>
                            {isPayment ? "+" : "−"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div className="bsf-row-head">
                              <strong style={{ color: isPayment ? "#2F7A5C" : "#B23A3A" }}>{formatCurrency(b.amount)}</strong>
                              <span className="bsf-muted">{formatDateLong(b.date, language)}</span>
                            </div>
                            <p className="bsf-muted" style={{ margin: 0 }}>{tLabel(t, "fees.cat.", b.category || "Tuition")}{b.description ? ` · ${b.description}` : ""}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()}

            <section className="bsf-card">
              <h2>{t("dash.attendanceFor", { name: s.firstName || s.name.split(" ")[0] })}</h2>
              <p className="bsf-muted">{t("dash.attendanceYear", attend)}</p>
            </section>
          </div>
        );
      })}

      {!isParent && (
        <section className="bsf-card bsf-stairs-card">
          <h2>Enrollment by grade</h2>
          <EnrollmentStairs counts={counts} />
        </section>
      )}

      <div className="bsf-dashboard-grid">
        <section className="bsf-card">
          <h2>{isParent ? t("dash.nextUp") : "Next up"}</h2>
          {nextEvents.length === 0 && <p className="bsf-empty">{isParent ? t("dash.nothingScheduled") : "Nothing scheduled yet. Add one from the Calendar tab."}</p>}
          {nextEvents.map((e) => (<EventRow key={e.id} event={e} />))}
        </section>

        <section className="bsf-card">
          <h2>{isParent ? t("dash.familyUpdates") : "Family updates"}</h2>
          {recentAnnouncements.length === 0 && <p className="bsf-empty">{isParent ? t("dash.nothingPosted") : "Nothing posted yet. Share one from Family Updates."}</p>}
          {recentAnnouncements.map((a) => {
            const showFrench = isParent && language === "fr" && a.titleFr;
            return (
              <div key={a.id} className="bsf-row">
                <div>
                  <strong>{showFrench ? a.titleFr : a.titleEn}</strong>
                  <p style={{ whiteSpace: "pre-wrap" }}>{showFrench ? a.bodyFr : a.bodyEn}</p>
                  {(() => {
                    const postFiles = language === "fr" && (a.filesFr || []).length > 0 ? a.filesFr : (a.files || []).length > 0 ? a.files : a.filesFr || [];
                    return postFiles.length > 0 && (
                      <AttachmentField folder="resources" files={postFiles} onChange={() => {}} readOnly />
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </section>
      </div> 
          <section className="bsf-card">
        <div className="bsf-row-head">
        <h2>{isParent ? t("dash.announcements") : "School announcements"}</h2>
          {isAdmin && !showAnnForm && (
  <button className="bsf-textbtn" onClick={openNewAnnouncement}>New announcement</button>
)}
          {isAdmin && showAnnForm && (
  <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 8 }}>
    {editingAnnId && <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Edit announcement</p>}
    <p style={{ fontSize: 12, color: "#6B7578", margin: "0 0 4px" }}>Send to</p>
    <select value={annForm.audience} onChange={(e) => setAnnForm({ ...annForm, audience: e.target.value })} style={{ width: "100%", height: 34, marginBottom: 10 }}>
      <option value="school">Whole school</option>
      <option value="lower">Lower school (Pre-N to Grade 5)</option>
      <option value="upper">Upper school (Grade 6 to Grade 7)</option>
      {GRADES.map((g) => <option key={g} value={g}>{g} only</option>)}
    </select>
    <p style={{ fontSize: 12, color: "#6B7578", margin: "0 0 4px" }}>Title (English)</p>
    <input value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} style={{ width: "100%", marginBottom: 10 }} />
    <p style={{ fontSize: 12, color: "#6B7578", margin: "0 0 4px" }}>Titre (Français)</p>
    <input value={annForm.title_fr} onChange={(e) => setAnnForm({ ...annForm, title_fr: e.target.value })} style={{ width: "100%", marginBottom: 10 }} />
    <p style={{ fontSize: 12, color: "#6B7578", margin: "0 0 4px" }}>Message (English)</p>
    <textarea rows={8} value={annForm.body} onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })} style={{ width: "100%", marginBottom: 10 }} />
    <p style={{ fontSize: 12, color: "#6B7578", margin: "0 0 4px" }}>Message (Français)</p>
    <textarea rows={8} value={annForm.body_fr} onChange={(e) => setAnnForm({ ...annForm, body_fr: e.target.value })} style={{ width: "100%", marginBottom: 10 }} />
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
      <input type="checkbox" checked={annForm.show_staff} onChange={(e) => setAnnForm({ ...annForm, show_staff: e.target.checked })} />
      Also show on staff dashboard
    </label>
    {!editingAnnId && (
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
        <input type="checkbox" checked={annForm.email} onChange={(e) => setAnnForm({ ...annForm, email: e.target.checked })} />
        Also email parents
      </label>
    )}
    {editingAnnId && <p style={{ fontSize: 12, color: "#6B7578", margin: "0 0 12px" }}>Saving changes updates the announcement on the Hub. Parents are not notified again.</p>}
    <div style={{ display: "flex", gap: 8 }}>
      <button className="bsf-btn" onClick={postAnnouncement} disabled={postingAnn}>{postingAnn ? (editingAnnId ? "Saving…" : "Posting…") : (editingAnnId ? "Save changes" : "Post announcement")}</button>
      <button className="bsf-textbtn" onClick={closeAnnForm}>Cancel</button>
    </div>
  </div>
)}
        </div>
        {visibleAnnouncements.length === 0 && <p className="bsf-empty">{isParent ? t("dash.noAnnouncements") : "No announcements yet."}</p>}
        {(showAllAnn ? visibleAnnouncements : visibleAnnouncements.slice(0, 3)).map((a) => (
        <div key={a.id} style={{ borderTop: "1px solid #eee", padding: "12px 0" }}>
        <p style={{ fontSize: 12, color: "#6B7578", margin: "0 0 4px" }}>{isParent
          ? `${a.audience === "school" || !a.audience ? t("common.wholeSchool") : a.audience === "lower" ? t("dash.audienceLower") : a.audience === "upper" ? t("dash.audienceUpper") : gradeLabel(a.audience, language)} · ${formatTimestampDate(a.created_at, language)}`
          : `${a.audience === "school" ? "Whole school" : a.audience === "lower" ? "Lower school" : a.audience === "upper" ? "Upper school" : a.audience} · ${formatTimestampDate(a.created_at, "en")}${a.edited_at ? " · Edited" : ""}${isAdmin && a.emailed_at ? " · Emailed" : ""}`}</p>
        <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 2px" }}>{language === "fr" && a.title_fr ? a.title_fr : a.title}</p>
        <p style={{ fontSize: 13, color: "#3B4A4C", margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{language === "fr" && a.body_fr ? a.body_fr : a.body}</p>
        {isAdmin && (
  <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
    <button className="bsf-textbtn" style={{ fontSize: 12 }} onClick={() => openEditAnnouncement(a)}>Edit</button>
    {!a.emailed_at && a.title !== "Lunch menu updated" && (
      <button className="bsf-textbtn" style={{ fontSize: 12 }} disabled={emailingAnnId === a.id}
        onClick={() => { if (window.confirm("Email this announcement to the parents who can see it?")) emailAnnouncement(a.id); }}>
        {emailingAnnId === a.id ? "Sending…" : "Email parents"}
      </button>
    )}
    <button className="bsf-textbtn" style={{ fontSize: 12 }} onClick={() => deleteAnnouncement(a.id)}>Delete</button>
  </div>
)}
        </div>
        ))}
        {visibleAnnouncements.length > 3 && (
          <button className="bsf-textbtn" style={{ fontSize: 13, marginTop: 4 }} onClick={() => setShowAllAnn(!showAllAnn)}>
            {showAllAnn
              ? (isParent ? t("dash.showFewerAnnouncements") : "Show fewer")
              : (isParent ? t("dash.seeAllAnnouncements") : "See all announcements") + ` (${visibleAnnouncements.length})`}
          </button>
        )}
        </section>
          <section className="bsf-card">
<div className="bsf-row-head">
  <h2>{isParent ? t("dash.lunchMenu") : "Lunch Menu"}</h2>
          {isAdmin && !editingLunch && (
            <button className="bsf-textbtn" onClick={openLunchEdit}>Edit menu</button>
          )}
        </div>
        {lunchMenu.weekOf && <p className="bsf-muted" style={{ marginBottom: 8 }}>{language === "fr" ? "Semaine du" : "Week of"} {lunchWeekLabel(lunchMenu.weekOf, language)}</p>}
        {hasLunchMenu && LUNCH_DAYS.map((day) => (
          <div key={day} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 8, padding: "8px 10px", borderRadius: 8, background: day === todayLunchName ? "#eaf1fb" : "transparent" }}>
            <p style={{ fontWeight: 500, fontSize: 13, margin: 0, color: day === todayLunchName ? "#185fa5" : "#4A5658" }}>
              {LUNCH_DAY_LABELS[language]?.[day] || day}
              {day === todayLunchName && <><br /><span style={{ fontWeight: 400, fontSize: 11 }}>{t("common.today")}</span></>}
            </p>
            <p style={{ fontSize: 13, margin: 0 }}>
              {activeLunchDays[day]?.dish || "—"}
              {activeLunchDays[day]?.dessert && <span style={{ color: "#6B7578" }}> · {activeLunchDays[day].dessert}</span>}
            </p>
          </div>
        ))}
      </section>

      {editingLunch && (
        <Modal title="Edit lunch menu" onClose={() => setEditingLunch(false)}>
          <Field label="Week of (pick the Monday)">
            <input
              type="date"
              value={/^\d{4}-\d{2}-\d{2}$/.test(lunchForm.weekOf || "") ? lunchForm.weekOf : ""}
              onChange={(e) => setLunchForm({ ...lunchForm, weekOf: e.target.value })}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: "6px 8px", fontSize: 12, color: "#6B7578", marginTop: 12 }}>
            <span></span><span>English</span><span>Français</span>
          </div>
          {LUNCH_DAYS.map((day) => (
            <div key={day}>
              <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: "6px 8px", alignItems: "center", padding: "6px 0", borderTop: "1px solid #eee" }}>
                <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>{LUNCH_DAY_LABELS.en[day]}</p>
                <input
                  value={lunchForm.days?.[day]?.dish || ""}
                  onChange={(e) => setLunchForm({ ...lunchForm, days: { ...lunchForm.days, [day]: { ...lunchForm.days?.[day], dish: e.target.value } } })}
                  placeholder="Dish"
                  style={{ height: 30, fontSize: 13 }}
                />
                <input
                  value={lunchForm.daysFr?.[day]?.dish || ""}
                  onChange={(e) => setLunchForm({ ...lunchForm, daysFr: { ...lunchForm.daysFr, [day]: { ...lunchForm.daysFr?.[day], dish: e.target.value } } })}
                  placeholder="Plat"
                  style={{ height: 30, fontSize: 13 }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 1fr", gap: "6px 8px", alignItems: "center", padding: "0 0 8px" }}>
                <span></span>
                <input
                  value={lunchForm.days?.[day]?.dessert || ""}
                  onChange={(e) => setLunchForm({ ...lunchForm, days: { ...lunchForm.days, [day]: { ...lunchForm.days?.[day], dessert: e.target.value } } })}
                  placeholder="Dessert"
                  style={{ height: 30, fontSize: 13 }}
                />
                <input
                  value={lunchForm.daysFr?.[day]?.dessert || ""}
                  onChange={(e) => setLunchForm({ ...lunchForm, daysFr: { ...lunchForm.daysFr, [day]: { ...lunchForm.daysFr?.[day], dessert: e.target.value } } })}
                  placeholder="Dessert"
                  style={{ height: 30, fontSize: 13 }}
                />
              </div>
            </div>
          ))}
          <button className="bsf-btn bsf-btn-block" onClick={saveLunchMenu} disabled={savingLunch} style={{ marginTop: 14 }}>{savingLunch ? "Saving…" : "Save menu"}</button>
        </Modal>
      )}

      <section className="bsf-card">
        <h2>{isParent ? t("dash.latestPortfolioChild") : "Latest portfolio entries"}</h2>
        {recentPortfolio.length === 0 && <p className="bsf-empty">{isParent ? t("dash.noEntries") : "No entries yet. Add one from the Portfolio tab."}</p>}
        {recentPortfolio.map((p) => {
          const student = data.students.find((s) => s.id === p.studentId);
          return (
            <div key={p.id} className="bsf-row bsf-portfolio-row">
              {student && <StudentThumb photo={student.photo} />}
              <div style={{ flex: 1 }}>
                <div className="bsf-row-head">
                  <strong>{p.studentName}</strong>
                  <span className="bsf-tag">{tLabel(t, "tag.", p.tag)}</span>
                </div>
                <p>{p.note}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export { Dashboard };

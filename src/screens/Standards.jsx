import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Link2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { GRADES } from "../data/constants";
import { Field, Modal } from "../ui/common";

// Progress by standard (Oct 2026). Staff screen.
//   Library: the school's standards (e.g. Common Core codes) by grade and subject.
//   Link: tick which standards each Gradebook assessment checks.
//   Progress: every student against every standard, worked out from the Gradebook marks.

const SUBJECTS = ["English Language Arts", "Math", "French", "Unit of Inquiry", "Art", "Music", "Physical Education", "Swimming", "Technology"];
const EARLY = ["Pre-N", "PreK", "Kindergarten", "Grade 1", "Grade 2"];
const LEVEL = {
  emerging: { label: "Emerging", bg: "#FBE9E7", fg: "#B23A2B" },
  developing: { label: "Developing", bg: "#FFF3DC", fg: "#9A6400" },
  meeting: { label: "Meeting", bg: "#E6F2EA", fg: "#2E7D4F" },
  exceeding: { label: "Exceeding", bg: "#EDE7F6", fg: "#5B3C99" }
};
function pctColor(p) {
  if (p >= 80) return { bg: "#E6F2EA", fg: "#2E7D4F" };
  if (p >= 60) return { bg: "#FFF3DC", fg: "#9A6400" };
  return { bg: "#FBE9E7", fg: "#B23A2B" };
}

function StandardsTab({ profile }) {
  const role = profile?.role;
  const canEditAll = role === "admin";
  const editGrades = canEditAll
    ? GRADES
    : role === "teacher"
    ? [...new Set([...(profile?.grades_assigned || []), ...(profile?.assigned_grades || [])])].filter((g) => !(profile?.assistant_grades || []).includes(g))
    : [];
  const viewGrades = role === "admin" || role === "viewer"
    ? GRADES
    : GRADES.filter((g) => [...(profile?.grades_assigned || []), ...(profile?.assigned_grades || []), ...(profile?.assistant_grades || [])].includes(g));

  const [grade, setGrade] = useState(viewGrades[0] || null);
  const [subject, setSubject] = useState("Math");
  const [standards, setStandards] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [links, setLinks] = useState([]);
  const [progress, setProgress] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);
  const canEdit = !!grade && editGrades.includes(grade);
  const early = EARLY.includes(grade);

  useEffect(() => {
    if (!grade) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const [st, as, stu] = await Promise.all([
        supabase.from("gb_standards").select("*").eq("grade", grade).order("sort").order("code"),
        supabase.from("gb_assessments").select("id, title, subject, term, assessed_on, grading").eq("grade", grade).order("assessed_on", { ascending: false, nullsFirst: false }),
        supabase.from("students").select("id, full_name").eq("grade", grade).order("full_name")
      ]);
      if (cancelled) return;
      if (st.error || as.error || stu.error) {
        console.error(st.error || as.error || stu.error);
        setError("Could not load standards. If this is the first time, run standards-progress.sql in Supabase.");
        setLoading(false);
        return;
      }
      const ids = (st.data || []).map((s) => s.id);
      const aIds = (as.data || []).map((a) => a.id);
      const [ln, pr] = await Promise.all([
        aIds.length ? supabase.from("gb_assessment_standards").select("*").in("assessment_id", aIds) : { data: [] },
        ids.length ? supabase.from("gb_standard_progress").select("*").in("standard_id", ids) : { data: [] }
      ]);
      if (cancelled) return;
      setStandards(st.data || []);
      setAssessments(as.data || []);
      setStudents(stu.data || []);
      setLinks(ln.data || []);
      setProgress(pr.data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [grade, reloadKey]);

  const subjStandards = standards.filter((s) => (s.subject || "") === subject);
  const subjAssessments = assessments.filter((a) => a.subject === subject);
  const progressMap = useMemo(() => Object.fromEntries(progress.map((p) => [`${p.standard_id}:${p.student_id}`, p])), [progress]);
  const usedSubjects = [...new Set([...SUBJECTS, ...standards.map((s) => s.subject).filter(Boolean)])];

  const removeStandard = async (s) => {
    if (!window.confirm(`Delete ${s.code || "this standard"}? It will be unlinked from every assessment.`)) return;
    const { error: e } = await supabase.from("gb_standards").delete().eq("id", s.id);
    if (e) { setError("Could not delete. Please try again."); return; }
    reload();
  };

  if (viewGrades.length === 0) {
    return <div className="bsf-screen"><p className="bsf-empty">No classes are assigned to your account yet.</p></div>;
  }

  return (
    <div className="bsf-screen">
      <div className="bsf-hero">
        <p className="bsf-eyebrow">Standards</p>
        <h1>Progress by standard</h1>
        <p className="bsf-hero-sub">Link Gradebook assessments to standards to see where each student is.</p>
      </div>

      <section className="bsf-card">
        <div className="bsf-chiprow" style={{ marginBottom: 8 }}>
          {viewGrades.map((g) => <button key={g} className={`bsf-chip ${grade === g ? "active" : ""}`} onClick={() => setGrade(g)}>{g}</button>)}
        </div>
        <div className="bsf-chiprow">
          {usedSubjects.map((s) => <button key={s} className={`bsf-chip ${subject === s ? "active" : ""}`} onClick={() => setSubject(s)}>{s}</button>)}
        </div>
      </section>

      {error && <p className="bsf-formerror">{error}</p>}
      {loading && <p className="bsf-muted">Loading…</p>}

      {!loading && !error && (
        <>
          <section className="bsf-card">
            <h2>Progress</h2>
            {subjStandards.length === 0 ? (
              <p className="bsf-empty">No {subject} standards for {grade} yet. Add them in the library below.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 8px", position: "sticky", left: 0, background: "#fff" }}>Student</th>
                      {subjStandards.map((s) => (
                        <th key={s.id} title={s.description} style={{ padding: "6px 8px", whiteSpace: "nowrap", fontWeight: 600 }}>{s.code || s.description.slice(0, 12)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((stu) => (
                      <tr key={stu.id} style={{ borderTop: "1px solid #F0E8E2" }}>
                        <td style={{ padding: "6px 8px", whiteSpace: "nowrap", position: "sticky", left: 0, background: "#fff" }}>{stu.full_name}</td>
                        {subjStandards.map((s) => {
                          const p = progressMap[`${s.id}:${stu.id}`];
                          if (!p || (p.avg_pct == null && !p.latest_level)) return <td key={s.id} style={{ textAlign: "center", color: "#B9AAA0" }}>—</td>;
                          const c = early && p.latest_level ? LEVEL[p.latest_level] : pctColor(p.avg_pct);
                          const text = early && p.latest_level ? LEVEL[p.latest_level].label : `${p.avg_pct}%`;
                          return (
                            <td key={s.id} style={{ textAlign: "center", padding: 4 }}>
                              <span title={`${p.evidence} assessment${p.evidence === 1 ? "" : "s"}`} style={{ background: c.bg, color: c.fg, borderRadius: 8, padding: "3px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{text}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="bsf-muted" style={{ fontSize: 12 }}>
                  {early ? "Shows the most recent level recorded for each standard." : "Average of the marks on the assessments linked to each standard. Green 80%+, amber 60–79%, red under 60%."}
                </p>
              </div>
            )}
          </section>

          <section className="bsf-card">
            <h2>Link assessments to standards</h2>
            {subjAssessments.length === 0 && <p className="bsf-empty">No {subject} assessments in the Gradebook for {grade} yet.</p>}
            {subjAssessments.map((a) => {
              const linked = links.filter((l) => l.assessment_id === a.id).map((l) => standards.find((s) => s.id === l.standard_id)).filter(Boolean);
              return (
                <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid #F0E8E2", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{a.title}</strong>
                    <div className="bsf-muted" style={{ fontSize: 12 }}>Term {a.term}{a.assessed_on ? ` · ${a.assessed_on}` : ""}</div>
                    <div className="bsf-chiprow" style={{ marginTop: 4 }}>
                      {linked.length === 0 ? <span className="bsf-muted" style={{ fontSize: 12 }}>No standards linked</span>
                        : linked.map((s) => <span key={s.id} className="bsf-minitag" title={s.description}>{s.code || s.description.slice(0, 20)}</span>)}
                    </div>
                  </div>
                  {canEdit && subjStandards.length > 0 && (
                    <button className="bsf-textbtn" onClick={() => setLinking(a)}><Link2 size={14} /> Link</button>
                  )}
                </div>
              );
            })}
          </section>

          <section className="bsf-card">
            <div className="bsf-row-head">
              <h2>{subject} standards · {grade}</h2>
              {canEdit && <button className="bsf-textbtn" onClick={() => setShowAdd(true)}><Plus size={14} /> Add standards</button>}
            </div>
            {subjStandards.length === 0 && <p className="bsf-muted">None yet.</p>}
            {subjStandards.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0E8E2" }}>
                <span><strong>{s.code}</strong> {s.description}</span>
                {canEdit && <button className="bsf-iconbtn" onClick={() => removeStandard(s)} aria-label="Delete"><Trash2 size={15} /></button>}
              </div>
            ))}
          </section>
        </>
      )}

      {linking && (
        <LinkModal
          assessment={linking}
          standards={subjStandards}
          linkedIds={links.filter((l) => l.assessment_id === linking.id).map((l) => l.standard_id)}
          onClose={() => setLinking(null)}
          onSaved={() => { setLinking(null); reload(); }}
        />
      )}
      {showAdd && (
        <AddStandards grade={grade} subject={subject} count={subjStandards.length} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); reload(); }} />
      )}
    </div>
  );
}

function LinkModal({ assessment, standards, linkedIds, onClose, onSaved }) {
  const [chosen, setChosen] = useState(linkedIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toggle = (id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const save = async () => {
    setSaving(true);
    setError("");
    const toAdd = chosen.filter((id) => !linkedIds.includes(id)).map((id) => ({ assessment_id: assessment.id, standard_id: id }));
    const toRemove = linkedIds.filter((id) => !chosen.includes(id));
    const a = toAdd.length ? await supabase.from("gb_assessment_standards").insert(toAdd) : { error: null };
    const r = toRemove.length ? await supabase.from("gb_assessment_standards").delete().eq("assessment_id", assessment.id).in("standard_id", toRemove) : { error: null };
    setSaving(false);
    if (a.error || r.error) { console.error(a.error || r.error); setError("Could not save. Please try again."); return; }
    onSaved();
  };

  return (
    <Modal title={`Standards for "${assessment.title}"`} onClose={onClose}>
      {standards.map((s) => (
        <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0" }}>
          <input type="checkbox" checked={chosen.includes(s.id)} onChange={() => toggle(s.id)} />
          <span><strong>{s.code}</strong> {s.description}</span>
        </label>
      ))}
      <button className="bsf-btn bsf-btn-block" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
      {error && <p className="bsf-formerror">{error}</p>}
    </Modal>
  );
}

function AddStandards({ grade, subject, count, onClose, onSaved }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { setError("Type or paste at least one standard."); return; }
    const rows = lines.map((line, i) => {
      const m = line.match(/^([^|\s]+)\s*[|:–-]\s*(.+)$/) || line.match(/^(\S+\.\S+)\s+(.+)$/);
      return m
        ? { code: m[1].trim(), description: m[2].trim(), grade, subject, sort: count + i }
        : { code: null, description: line, grade, subject, sort: count + i };
    });
    setSaving(true);
    const { error: e } = await supabase.from("gb_standards").insert(rows);
    setSaving(false);
    if (e) { console.error(e); setError("Could not save. Please try again."); return; }
    onSaved();
  };

  return (
    <Modal title={`Add ${subject} standards · ${grade}`} onClose={onClose}>
      <p className="bsf-muted" style={{ marginTop: 0 }}>One standard per line: the code, then the description. For example:</p>
      <p className="bsf-muted" style={{ fontFamily: "monospace", fontSize: 12 }}>3.NF.A.1 | Understand a fraction 1/b as one part of a whole</p>
      <Field label="Standards">
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"CODE | Description\nCODE | Description"} />
      </Field>
      <button className="bsf-btn bsf-btn-block" disabled={saving} onClick={save}>{saving ? "Saving…" : "Add"}</button>
      {error && <p className="bsf-formerror">{error}</p>}
    </Modal>
  );
}

export { StandardsTab };

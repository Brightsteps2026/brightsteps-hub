import { useEffect, useState } from "react";
import { uploadAttachment } from "../lib/attachments";
import { supabase } from "../lib/supabaseClient";
import { uid, todayStr } from "../lib/format";

// Curriculum extras (Oct 2026), staff screens only.
//   LoadCurriculumFiles: admin one-click upload of the Life Skills scope and
//   sequence and unit plans, filed under their subject and grades. The files
//   ship in /public/curriculum-files only until they have been uploaded to the private
//   attachments bucket; a document whose title already exists is skipped.
//   CurriculumStandards: the grade's ELA and Math standards (from the Standards library)
//   shown inside Curriculum, read only.

const WHOLE = "Whole school";
const CLASSES = [
  ["Pre-Nursery", "Pre-Nursery", ["Pre-N"]],
  ["Pre-K and KG", "PreK_and_KG", ["PreK", "Kindergarten"]],
  ["Grade 1–2", "Grade_1-2", ["Grade 1", "Grade 2"]],
  ["Grade 3–4", "Grade_3-4", ["Grade 3", "Grade 4", "Grade 5"]],
  ["Grade 6–7", "Grade_6-7", ["Grade 6", "Grade 7"]]
];
const PROGRAMS = [
  ["Life Skills", "Life Skills", "BrightSteps_Life_Skills"]
];

export const SEED_DOCUMENTS = PROGRAMS.flatMap(([label, subject, prefix]) => [
  {
    title: `${label} Scope and Sequence 2026–2027`,
    subject,
    grades: [WHOLE],
    description: `Whole-school ${label} plan: six modules, progressions by grade, low-cost materials kit, assessment and home links. Alternates with SEL on Fridays.`,
    base: `${prefix}_Scope_and_Sequence_2026-2027`
  },
  ...CLASSES.map(([cls, file, grades]) => ({
    title: `${label} Unit Plans · ${cls}`,
    subject,
    grades,
    description: `18 lesson plans (six modules of three) for ${cls}, with timings, materials and checks.`,
    base: `${prefix}_Unit_Plans_${file}`
  }))
]);

const TYPES = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };

export function LoadCurriculumFiles({ data, persist }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const have = new Set((data.curriculumDocuments || []).map((d) => (d.title || "").trim().toLowerCase()));
  const missing = SEED_DOCUMENTS.filter((d) => !have.has(d.title.toLowerCase()));
  if (missing.length === 0 && !msg) return null;

  const run = async () => {
    if (!window.confirm(`Add ${missing.length} Life Skills document${missing.length === 1 ? "" : "s"} to Curriculum, each with its PDF and Word file?`)) return;
    setBusy(true); setErr(""); setMsg("");
    const added = [];
    try {
      for (const [i, d] of missing.entries()) {
        setMsg(`Uploading ${i + 1} of ${missing.length}: ${d.title}`);
        const files = [];
        for (const ext of ["pdf", "docx"]) {
          const name = `${d.base}.${ext}`;
          const res = await fetch(`/curriculum-files/${name}`);
          if (!res.ok) throw new Error(`Missing ${name}`);
          const blob = await res.blob();
          files.push(await uploadAttachment(new File([blob], name, { type: TYPES[ext] }), "curriculum"));
        }
        added.push({ id: uid(), date: todayStr(), title: d.title, subject: d.subject, grades: d.grades, description: d.description, files });
      }
    } catch (e) {
      console.error(e);
      setErr("Could not finish. The documents uploaded so far are saved; press the button again to add the rest.");
    }
    if (added.length) persist({ ...data, curriculumDocuments: [...(data.curriculumDocuments || []), ...added] });
    setMsg(added.length ? `Added ${added.length} document${added.length === 1 ? "" : "s"}.` : "");
    setBusy(false);
  };

  return (
    <section className="bsf-card" style={{ background: "#E6F2EC", borderColor: "#BFDCCB" }}>
      <div className="bsf-row-head" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <strong style={{ color: "#2F7A5C" }}>Life Skills documents</strong>
          <p className="bsf-muted" style={{ margin: "2px 0 0" }}>
            {missing.length
              ? `${missing.length} ready to add: the scope and sequence, and unit plans for every class.`
              : "All added."}
          </p>
        </div>
        {missing.length > 0 && <button className="bsf-btn" disabled={busy} onClick={run}>{busy ? "Adding…" : "Add them"}</button>}
      </div>
      {msg && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#2F7A5C", fontWeight: 600 }}>{msg}</p>}
      {err && <p className="bsf-formerror">{err}</p>}
    </section>
  );
}

const STD_SUBJECTS = ["English Language Arts", "Math"];

export function CurriculumStandards({ grade, subject }) {
  const subjects = subject ? STD_SUBJECTS.filter((s) => s === subject) : STD_SUBJECTS;
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const show = grade && grade !== WHOLE && subjects.length > 0;

  useEffect(() => {
    if (!show) return;
    let live = true;
    setRows(null); setFailed(false); setOpen(null); setQ("");
    supabase.from("gb_standards").select("id, code, subject, grade, description, sort").eq("grade", grade).order("sort").order("code")
      .then(({ data, error }) => {
        if (!live) return;
        if (error) { console.error(error); setFailed(true); setRows([]); } else setRows(data || []);
      });
    return () => { live = false; };
  }, [grade, show]);

  if (!show) return null;
  const needle = q.trim().toLowerCase();
  return (
    <section className="bsf-card">
      <h2 style={{ marginTop: 0 }}>Standards · {grade}</h2>
      {rows === null && <p className="bsf-muted">Loading…</p>}
      {failed && <p className="bsf-muted">Could not load the standards.</p>}
      {rows && !failed && subjects.map((s) => {
        const list = rows.filter((r) => r.subject === s);
        const isOpen = open === s || !!subject;
        const shown = needle ? list.filter((r) => `${r.code || ""} ${r.description}`.toLowerCase().includes(needle)) : list;
        return (
          <div key={s} style={{ borderTop: "1px solid #F0E8E2", padding: "8px 0" }}>
            <div className="bsf-row-head" style={{ justifyContent: "space-between" }}>
              <strong>{s} · {list.length}</strong>
              {!subject && list.length > 0 && (
                <button className="bsf-textbtn" onClick={() => { setOpen(isOpen ? null : s); setQ(""); }}>{isOpen ? "Hide" : "Show"}</button>
              )}
            </div>
            {list.length === 0 && <p className="bsf-muted" style={{ margin: "4px 0 0" }}>None yet. The admin can load them on the Standards screen.</p>}
            {isOpen && list.length > 0 && (
              <>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list.length} standards`} aria-label={`Search ${s} standards`}
                  style={{ width: "100%", boxSizing: "border-box", margin: "6px 0" }} />
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {shown.length === 0 && <p className="bsf-muted">No standards match.</p>}
                  {shown.map((r) => (
                    <p key={r.id} style={{ margin: 0, padding: "6px 0", borderBottom: "1px solid #F6F0EC", fontSize: 13 }}>
                      <strong>{r.code}</strong> {r.description}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
      <p className="bsf-muted" style={{ fontSize: 11, margin: "8px 0 0" }}>Teachers tick the ones a unit covers in Unit Planning, Stage 2.</p>
    </section>
  );
}

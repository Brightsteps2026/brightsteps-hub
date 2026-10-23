import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { getAttachmentUrl } from "./lib/attachments";
import { uid } from "./lib/format";
import AttachmentField from "./AttachmentField";
import { COLORS, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, pill } from "./ui/tokens";
import { eyObservationAreas, eyEnrichment, EY_LEVELS, EY_TO_PORTFOLIO_TAG } from "./data/earlyYears";

// Staff Assessment for Pre-Nursery, PreK and Kindergarten (English only).
// Observation-based: teachers and assistants record moments for each area of
// development; the class overview shows where every child stands; the report
// card is written from these observations (Report cards section).
// Observations live in ey_observations (supabase/early-years-observations.sql).
// "Share in portfolio" (off by default) copies one into the child's portfolio,
// which families see.

const SCHOOL_YEAR = "2026-2027";
const GOLD = "#8A6A2E";
const card = { ...cardToken, marginBottom: 14 };
const serif = "'Fraunces', serif";
const todayISO = () => new Date().toISOString().slice(0, 10);

function currentTerm(settings) {
  const today = todayISO();
  const terms = settings?.terms || [];
  const i = terms.findIndex((t) => t.startDate && t.endDate && t.startDate <= today && today <= t.endDate);
  return i >= 0 ? i + 1 : 1;
}

function LevelDot({ level, size = 11 }) {
  const i = EY_LEVELS.findIndex((l) => l.id === level);
  if (i < 0) return null;
  const fill = i === 0 ? "transparent" : i === 1 ? `linear-gradient(90deg, ${GOLD} 50%, transparent 50%)` : GOLD;
  return <span aria-hidden="true" style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", border: `1.5px solid ${GOLD}`, background: fill, flexShrink: 0 }} />;
}
const levelName = (id) => EY_LEVELS.find((l) => l.id === id)?.en || "";

function usePhotoUrls(paths) {
  const key = paths.filter(Boolean).join("|");
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let alive = true;
    const list = key ? key.split("|") : [];
    Promise.all(list.map((p) => getAttachmentUrl(p).then((u) => [p, u]).catch(() => [p, null])))
      .then((pairs) => { if (alive) setUrls(Object.fromEntries(pairs)); });
    return () => { alive = false; };
  }, [key]);
  return urls;
}

const shortDate = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

export default function EarlyYearsAssessment({ grades, editGrades, profile, data, persist, SubjectComments }) {
  const [grade, setGrade] = useState(grades[0]);
  const [term, setTerm] = useState(() => currentTerm(data?.settings));
  const [tab, setTab] = useState("overview");
  const [students, setStudents] = useState([]);
  const [obs, setObs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(null); // { studentIds, area }
  const [focus, setFocus] = useState(null);   // { studentId, area }

  const preN = grade === "Pre-N";
  const areas = eyObservationAreas(grade);
  const devAreas = areas.filter((a) => !eyEnrichment(grade).some((e) => e.id === a.id));
  const canEdit = editGrades.includes(grade);
  const canShare = canEdit;

  async function load() {
    setLoading(true); setError("");
    const st = await supabase.from("students").select("id, full_name, legacy_id, grade").eq("grade", grade).order("full_name");
    if (st.error) { setError(st.error.message); setLoading(false); return; }
    const ob = await supabase.from("ey_observations").select("*")
      .eq("grade", grade).eq("term", term).eq("school_year", SCHOOL_YEAR)
      .order("observed_on", { ascending: false }).order("created_at", { ascending: false });
    if (ob.error) {
      setError(/ey_observations/.test(ob.error.message)
        ? "Observations aren't switched on yet. Please ask the office to run early-years-observations.sql."
        : ob.error.message);
      setStudents(st.data || []);
      setLoading(false);
      return;
    }
    setStudents(st.data || []);
    setObs(ob.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); setFocus(null); setAdding(null); setStatus(""); }, [grade, term]); // eslint-disable-line react-hooks/exhaustive-deps

  const byCell = useMemo(() => {
    const m = {};
    obs.forEach((o) => {
      const k = `${o.student_id}:${o.area}`;
      (m[k] = m[k] || []).push(o);
    });
    return m;
  }, [obs]);
  const latestLevel = (list) => (list || []).find((o) => o.level)?.level || null;

  // Families see an observation only through the portfolio.
  function portfolioEntryFor(o, student) {
    return {
      id: uid(),
      studentId: student.legacy_id,
      studentName: student.full_name,
      tag: EY_TO_PORTFOLIO_TAG[o.area] || "Inquiry",
      eyArea: o.area,
      note: o.note || "",
      author: "teacher",
      files: o.photo ? [o.photo] : [],
      date: o.observed_on || todayISO()
    };
  }

  async function setShared(o, next) {
    if (!persist || !data) return;
    const student = students.find((s) => s.id === o.student_id);
    if (!student?.legacy_id) { setStatus("This child has no portfolio yet."); return; }
    let entryId = o.portfolio_entry_id;
    if (next && !entryId) {
      const entry = portfolioEntryFor(o, student);
      const ok = await persist({ ...data, portfolio: [...(data.portfolio || []), entry] });
      if (ok === false) { setStatus("Not shared: the portfolio could not be saved. Try again."); return; }
      entryId = entry.id;
    } else if (!next) {
      // Find the portfolio copy (by its id, or by child + area + note for older rows).
      const match = (p) => (entryId ? p.id === entryId : p.studentId === student.legacy_id && p.eyArea === o.area && (p.note || "") === (o.note || ""));
      if ((data.portfolio || []).some(match)) {
        const ok = await persist({ ...data, portfolio: (data.portfolio || []).filter((p) => !match(p)) });
        if (ok === false) { setStatus("Not changed: the portfolio could not be saved. Try again."); return; }
      }
      entryId = null;
    }
    const { error: e } = await supabase.from("ey_observations").update({ shared: next, portfolio_entry_id: entryId }).eq("id", o.id);
    if (e) { setStatus(`Not saved: ${e.message}`); return; }
    setObs((list) => list.map((x) => (x.id === o.id ? { ...x, shared: next, portfolio_entry_id: entryId } : x)));
    setStatus(next ? "Shared in the child's portfolio. Families can see it." : "Removed from the portfolio. Only staff see it now.");
  }

  async function removeObs(o) {
    if (!window.confirm("Delete this observation? This cannot be undone.")) return;
    const { error: e } = await supabase.from("ey_observations").delete().eq("id", o.id);
    if (e) { setStatus(`Not deleted: ${e.message}`); return; }
    if (o.portfolio_entry_id && persist && data) await persist({ ...data, portfolio: (data.portfolio || []).filter((p) => p.id !== o.portfolio_entry_id) });
    setObs((list) => list.filter((x) => x.id !== o.id));
  }

  const nameOf = (sid) => students.find((s) => s.id === sid)?.full_name || "";
  const areaName = (id) => areas.find((a) => a.id === id)?.en || id;
  const photoUrls = usePhotoUrls(obs.map((o) => o.photo?.path));

  return (
    <>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {grades.map((g) => <button key={g} onClick={() => setGrade(g)} style={grade === g ? chipOn : chip}>{g}</button>)}
          </div>
          <button style={primaryBtn} onClick={() => setAdding({ studentIds: [], area: "" })} disabled={!!error}>+ Add observation</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {[1, 2, 3].map((t) => <button key={t} onClick={() => setTerm(t)} style={term === t ? chipOn : chip}>Term {t}</button>)}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 14, borderBottom: `1px solid ${COLORS.line}`, flexWrap: "wrap" }}>
          {[["overview", "Class overview"], ["list", "Observations"], ["specials", preN ? "Enrichment comments" : "Specialist comments"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ font: "inherit", fontSize: 14, fontWeight: tab === id ? 600 : 400, padding: "10px 14px", background: "none", border: "none", borderBottom: `3px solid ${tab === id ? COLORS.brand : "transparent"}`, color: tab === id ? COLORS.brand : COLORS.muted, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
        {status && <p style={{ margin: "10px 0 0", fontSize: 13, color: COLORS.ok }}>{status}</p>}
        {error && <p style={{ margin: "10px 0 0", fontSize: 13, color: COLORS.bad }}>{error}</p>}
      </div>

      {adding && (
        <ObservationForm
          grade={grade} term={term} students={students} areas={areas} preset={adding} canShare={canShare}
          profile={profile}
          onCancel={() => setAdding(null)}
          onSaved={async (rows, share) => {
            setAdding(null);
            if (share && persist && data) {
              const entries = [];
              const updates = [];
              rows.forEach((o) => {
                const s = students.find((x) => x.id === o.student_id);
                if (!s?.legacy_id) return;
                const e = portfolioEntryFor(o, s);
                entries.push(e);
                updates.push({ id: o.id, entryId: e.id });
              });
              let sharedCount = 0;
              if (entries.length) {
                const ok = await persist({ ...data, portfolio: [...(data.portfolio || []), ...entries] });
                if (ok !== false) {
                  for (const u of updates) {
                    const { error: e } = await supabase.from("ey_observations").update({ shared: true, portfolio_entry_id: u.entryId }).eq("id", u.id);
                    if (!e) sharedCount += 1;
                  }
                }
              }
              setStatus(sharedCount === rows.length
                ? `${rows.length} observation${rows.length > 1 ? "s" : ""} saved and shared in the portfolio.`
                : `${rows.length} observation${rows.length > 1 ? "s" : ""} saved. ${sharedCount ? `Only ${sharedCount} could be shared` : "Sharing in the portfolio did not work"}: use "Share in portfolio" in the list to try again.`);
              load();
              return;
            }
            setStatus(`${rows.length} observation${rows.length > 1 ? "s" : ""} saved.`);
            load();
          }}
        />
      )}

      {tab === "overview" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 14 }}><strong>{grade} · Term {term}</strong> · {students.length} children · {obs.length} observations</p>
            {!preN ? (
              <span style={{ display: "flex", gap: 14, fontSize: 12, color: COLORS.text2, flexWrap: "wrap" }}>
                {EY_LEVELS.map((l) => <span key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><LevelDot level={l.id} />{l.en}</span>)}
                <span style={{ ...pill("warn"), fontSize: 11 }}>Not yet</span>
              </span>
            ) : (
              <span style={{ fontSize: 12, color: COLORS.muted }}>No levels in Pre-Nursery: observations only.</span>
            )}
          </div>
          {loading ? <p style={{ margin: 0, color: COLORS.muted }}>Loading…</p> : students.length === 0 ? <p style={{ margin: 0, color: COLORS.muted }}>No children in {grade}.</p> : (
            <div style={{ overflowX: "auto", border: `1px solid ${COLORS.line}`, borderRadius: 12 }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px 12px", fontSize: 12, textAlign: "left", background: "#F7EEEF", position: "sticky", left: 0, zIndex: 1 }}>Child</th>
                    {devAreas.map((a) => <th key={a.id} style={{ padding: "10px 6px", fontSize: 12, fontWeight: 600, color: COLORS.text2, background: "#F7EEEF", lineHeight: 1.3, minWidth: 82 }}>{a.en.replace("Physical development: ", "")}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: 14, borderTop: "1px solid #F1E4E6", position: "sticky", left: 0, background: "#fff", whiteSpace: "nowrap" }}>{s.full_name}</td>
                      {devAreas.map((a) => {
                        const list = byCell[`${s.id}:${a.id}`] || [];
                        const lv = latestLevel(list);
                        return (
                          <td key={a.id} style={{ borderTop: "1px solid #F1E4E6", textAlign: "center", padding: 2 }}>
                            <button onClick={() => setFocus({ studentId: s.id, area: a.id })} aria-label={`${s.full_name}, ${a.en}: ${list.length} observations`}
                              style={{ font: "inherit", background: focus?.studentId === s.id && focus?.area === a.id ? COLORS.tint : "none", border: "none", borderRadius: 8, padding: "8px 4px", width: "100%", minHeight: 44, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                              {list.length === 0 ? <span style={{ ...pill("warn"), fontSize: 11 }}>Not yet</span> : (
                                <>
                                  {!preN && lv && <LevelDot level={lv} size={12} />}
                                  <span style={{ fontSize: 11, color: COLORS.muted }}>{list.length} obs.</span>
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ margin: "10px 0 0", fontSize: 12, color: COLORS.muted }}>Tap a box to see that child's observations for the area.{!preN ? " The dot is the most recent level recorded." : ""}</p>
        </div>
      )}

      {tab === "overview" && focus && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontFamily: serif, fontWeight: 500, fontSize: 20 }}>{nameOf(focus.studentId)} · {areaName(focus.area)}</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={ghostBtn} onClick={() => setAdding({ studentIds: [focus.studentId], area: focus.area })}>+ Observation</button>
              <button style={ghostBtn} onClick={() => setFocus(null)}>Close</button>
            </div>
          </div>
          <ObsList list={byCell[`${focus.studentId}:${focus.area}`] || []} urls={photoUrls} preN={preN} profile={profile} canEdit={canEdit} canShare={canShare}
            showChild={false} showArea={false} areaName={areaName} nameOf={nameOf} onShare={setShared} onDelete={removeObs} />
        </div>
      )}

      {tab === "list" && (
        <div style={card}>
          <ObsList list={obs} urls={photoUrls} preN={preN} profile={profile} canEdit={canEdit} canShare={canShare}
            showChild showArea areaName={areaName} nameOf={nameOf} onShare={setShared} onDelete={removeObs} />
        </div>
      )}

      {tab === "specials" && (
        <SpecialComments grade={grade} term={term} canEdit={canEdit} SubjectComments={SubjectComments} />
      )}
    </>
  );
}

function ObsList({ list, urls, preN, profile, canEdit, canShare, showChild, showArea, areaName, nameOf, onShare, onDelete }) {
  if (!list.length) return <p style={{ margin: 0, fontSize: 14, color: COLORS.muted }}>No observations yet.</p>;
  return list.map((o) => {
    const mine = o.created_by && o.created_by === profile?.id;
    return (
      <div key={o.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: `1px solid ${COLORS.line}`, flexWrap: "wrap" }}>
        <div style={{ width: 110, height: 82, borderRadius: 8, background: COLORS.neutralBg, overflow: "hidden", flexShrink: 0 }}>
          {o.photo?.path && urls[o.photo.path] && <img src={urls[o.photo.path]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
        </div>
        <div style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: COLORS.muted }}>
            <span>{shortDate(o.observed_on)}</span>
            {showChild && <><span>·</span><strong style={{ color: COLORS.ink }}>{nameOf(o.student_id)}</strong></>}
            {showArea && <><span>·</span><span>{areaName(o.area)}</span></>}
            {o.created_by_name && <><span>·</span><span>{o.created_by_name}</span></>}
            {!preN && o.level && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: GOLD }}><LevelDot level={o.level} />{levelName(o.level)}</span>}
          </div>
          {o.note && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>{o.note}</p>}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
            <span style={{ ...pill(o.shared ? "ok" : "neutral"), fontSize: 11 }}>{o.shared ? "Shared in portfolio" : "Staff only"}</span>
            {canShare && (
              <button onClick={() => onShare(o, !o.shared)} style={{ ...ghostBtn, minHeight: 34, padding: "5px 10px", fontSize: 12 }}>
                {o.shared ? "Stop sharing" : "Share in portfolio"}
              </button>
            )}
            {(canEdit || mine) && <button onClick={() => onDelete(o)} style={{ ...ghostBtn, minHeight: 34, padding: "5px 10px", fontSize: 12, color: COLORS.bad }}>Delete</button>}
          </div>
        </div>
      </div>
    );
  });
}

function ObservationForm({ grade, term, students, areas, preset, canShare, profile, onCancel, onSaved }) {
  const preN = grade === "Pre-N";
  const [kids, setKids] = useState(preset.studentIds || []);
  const [area, setArea] = useState(preset.area || "");
  const [note, setNote] = useState("");
  const [level, setLevel] = useState(null);
  const [files, setFiles] = useState([]);
  const [date, setDate] = useState(todayISO());
  const [share, setShare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggleKid = (id) => setKids((k) => (k.includes(id) ? k.filter((x) => x !== id) : [...k, id]));
  const photo = files.find((f) => (f.type || "").startsWith("image/")) || files[0] || null;

  async function save() {
    if (!kids.length) { setErr("Choose at least one child."); return; }
    if (!area) { setErr("Choose the area."); return; }
    if (!note.trim() && !photo) { setErr("Write what you saw or add a photo."); return; }
    setSaving(true); setErr("");
    const who = profile?.display_name || profile?.full_name || null;
    const rows = kids.map((sid) => ({
      school_year: SCHOOL_YEAR, term, grade, student_id: sid, area,
      note: note.trim() || null, level: preN ? null : level, photo: photo ? { path: photo.path, name: photo.name, type: photo.type } : null,
      observed_on: date || todayISO(), shared: false, created_by_name: who
    }));
    const { data: saved, error } = await supabase.from("ey_observations").insert(rows).select("*");
    setSaving(false);
    if (error) { setErr(`Not saved: ${error.message}`); return; }
    onSaved(saved || [], canShare && share);
  }

  const label = { display: "block", fontSize: 13, fontWeight: 600, margin: "14px 0 6px" };
  return (
    <div style={card}>
      <h3 style={{ margin: 0, fontFamily: serif, fontWeight: 500, fontSize: 20, color: COLORS.brand }}>Add an observation</h3>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>{grade} · Term {term}</p>

      <span style={label}>Children <span style={{ fontWeight: 400, color: COLORS.muted }}>(pick more than one for a group moment)</span></span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {students.map((s) => <button key={s.id} type="button" onClick={() => toggleKid(s.id)} style={kids.includes(s.id) ? chipOn : chip}>{s.full_name}</button>)}
      </div>

      <span style={label}>Area</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {areas.map((a) => <button key={a.id} type="button" onClick={() => setArea(a.id)} style={area === a.id ? chipOn : chip}>{a.en}</button>)}
      </div>

      <label style={label} htmlFor="ey-note">What did you see?</label>
      <textarea id="ey-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the child did or said, in a sentence or two."
        style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />

      <span style={label}>Photo (optional)</span>
      <AttachmentField folder="portfolio" files={files} onChange={setFiles} />

      {!preN && (
        <>
          <span style={label}>Level now (optional)</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {EY_LEVELS.map((l) => <button key={l.id} type="button" onClick={() => setLevel(level === l.id ? null : l.id)} style={level === l.id ? chipOn : chip}>{l.en}</button>)}
          </div>
        </>
      )}

      <label style={label} htmlFor="ey-date">Date</label>
      <input id="ey-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, maxWidth: 220 }} />

      {canShare && (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, padding: 12, borderRadius: 12, background: COLORS.tint, cursor: "pointer" }}>
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} style={{ width: 20, height: 20, margin: 0, accentColor: COLORS.brand, flexShrink: 0 }} />
          <span style={{ fontSize: 13, lineHeight: 1.45 }}><strong>Also share in the child's portfolio.</strong> Families will see the photo and your note. Leave it unticked for observations only staff should see.</span>
        </label>
      )}

      {err && <p style={{ margin: "10px 0 0", fontSize: 13, color: COLORS.bad }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button style={primaryBtn} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save observation"}</button>
        <button style={ghostBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// Specialist teachers write one term comment per child (it goes on the report card).
function SpecialComments({ grade, term, canEdit, SubjectComments: Comp }) {
  const list = eyEnrichment(grade);
  const [subject, setSubject] = useState(list[0].subject);
  useEffect(() => { setSubject(eyEnrichment(grade)[0].subject); }, [grade]);
  return (
    <div style={card}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {list.map((e) => <button key={e.id} onClick={() => setSubject(e.subject)} style={subject === e.subject ? chipOn : chip}>{e.en}</button>)}
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: COLORS.muted }}>One comment per child for this term. It appears on the report card under {grade === "Pre-N" ? "Enrichment" : "specialist subjects"}.</p>
      {Comp ? <Comp key={`${grade}:${subject}:${term}`} grade={grade} subject={subject} term={term} canEdit={canEdit} /> : null}
    </div>
  );
}

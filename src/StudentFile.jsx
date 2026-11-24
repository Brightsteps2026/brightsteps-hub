// Student file (Myri, 24 Nov 2026).
// One file per student: the Director's and the homeroom teacher's entries (parent meetings,
// academic, learning support, office notes, documents), with incidents (Incidents tab) and
// behaviour notes (Behaviour) shown alongside. Seen by the Director (admin) and the student's
// homeroom teacher only, never by parents. Teachers add entries; only admins edit or
// delete. "Director only" entries are seen by Myriam alone (not other admins, not teachers).
// Safeguarding concerns stay with the DSL and are not shown here. Staff screen, English only.

import { useEffect, useMemo, useState } from "react";
import { Paperclip, Lock } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment, getAttachmentUrl } from "./lib/attachments";
import { COLORS, card, input, chip, chipOn, primaryBtn, ghostBtn, label, muted } from "./ui/tokens";

const KINDS = {
  parent_meeting: { label: "Parent meeting", bg: COLORS.infoBg, fg: COLORS.info },
  academic: { label: "Academic", bg: COLORS.okBg, fg: COLORS.ok },
  learning_support: { label: "Learning support", bg: COLORS.tint, fg: COLORS.brand },
  office_note: { label: "Office note", bg: COLORS.neutralBg, fg: COLORS.muted },
  document: { label: "Document", bg: COLORS.neutralBg, fg: COLORS.text2 },
  other: { label: "Other", bg: COLORS.neutralBg, fg: COLORS.text2 },
  incident: { label: "Incident", bg: COLORS.warnBg, fg: COLORS.warn },
  behavior: { label: "Behavior", bg: COLORS.badBg, fg: COLORS.bad }
};
const FILTERS = [
  ["all", "All"], ["incident", "Incidents"], ["behavior", "Behavior"], ["parent_meeting", "Parent meetings"],
  ["academic", "Academic"], ["learning_support", "Learning support"], ["office_note", "Office notes"], ["document", "Documents"]
];
const ENTRY_KINDS = ["parent_meeting", "academic", "learning_support", "office_note", "document", "other"];

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const niceDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const niceTime = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }) : "");
const emptyForm = () => ({ date: todayIso(), kind: "parent_meeting", title: "", details: "", directorOnly: false, file: null });

function Badge({ kind, text }) {
  const k = KINDS[kind] || KINDS.other;
  return <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: k.bg, color: k.fg }}>{text || k.label}</span>;
}

async function openFile(path) {
  try { window.open(await getAttachmentUrl(path), "_blank", "noopener"); }
  catch { alert("This file could not be opened."); }
}

export default function StudentFile({ student, data }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null); // entry id the Director is editing
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const load = () => supabase.rpc("student_file", { p_legacy: student.id }).then(({ data: d, error: e }) => {
    if (e) setError(e.message); else { setFile(d); setError(""); }
  });
  useEffect(() => { load(); }, [student.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    if (!file) return [];
    const own = (file.entries || []).map((e) => ({ ...e, source: "entry", sort: `${e.date}T${(e.created_at || "").slice(11)}` }));
    const inc = (file.incidents || []).map((i) => ({
      id: `inc-${i.id}`, source: "incident", kind: "incident", date: String(i.at || "").slice(0, 10), sort: i.at || "",
      title: i.description || "Incident", badge: `Incident${i.level ? ` · Level ${i.level}` : ""}`,
      details: [i.first_aid && `First aid: ${i.first_aid}`, i.informed_at && `Parent informed${i.informed_method ? ` by ${i.informed_method}` : ""} at ${niceTime(i.informed_at)}`].filter(Boolean).join(" · "),
      by: i.by, from: "From the Incidents tab"
    }));
    const beh = (data?.behaviorIncidents || []).filter((b) => b.studentId === student.id).map((b) => ({
      id: `beh-${b.id}`, source: "behavior", kind: "behavior", date: b.date || "", sort: b.date || "",
      title: b.description || "Behavior note", badge: b.type === "Positive" ? "Behavior · Positive" : "Behavior",
      details: [b.category, b.actionTaken && `Action: ${b.actionTaken}`].filter(Boolean).join(" · "),
      by: b.reportedBy, from: "From the behavior notes"
    }));
    return [...own, ...inc, ...beh].sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
  }, [file, data, student.id]);

  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);
  const manage = !!file?.can_manage;
  const director = !!file?.is_director;

  const startEdit = (e) => {
    setEditing(e.id);
    setForm({ date: e.date, kind: e.kind, title: e.title, details: e.details || "", directorOnly: !!e.director_only, file: null, keepPath: e.file_path, keepName: e.file_name });
    setFormError("");
  };
  const cancel = () => { setEditing(null); setForm(emptyForm()); setFormError(""); };

  const save = async () => {
    if (!form.title.trim()) { setFormError("Give the entry a short title."); return; }
    setBusy(true); setFormError("");
    try {
      let path = form.keepPath || null, name = form.keepName || null;
      if (form.file) {
        const up = await uploadAttachment(form.file, `student-file/${file.student_id}`);
        path = up.path; name = up.name;
      }
      const row = { entry_date: form.date || todayIso(), kind: form.kind, title: form.title.trim(), details: form.details.trim() || null,
        director_only: director ? form.directorOnly : false, file_path: path, file_name: name };
      const res = editing
        ? await supabase.from("student_file_entries").update({ ...row, updated_at: new Date().toISOString() }).eq("id", editing)
        : await supabase.from("student_file_entries").insert({ ...row, student_id: file.student_id });
      if (res.error) throw res.error;
      cancel();
      await load();
    } catch (e) {
      setFormError(e.message || "The entry could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e) => {
    if (!window.confirm(`Delete "${e.title}" from ${student.name}'s file? This cannot be undone.`)) return;
    const { error: err } = await supabase.from("student_file_entries").delete().eq("id", e.id);
    if (err) { alert(err.message); return; }
    if (e.file_path) await supabase.storage.from("attachments").remove([e.file_path]);
    if (editing === e.id) cancel();
    load();
  };

  if (error) return <p style={{ ...card, ...muted }}>{error}</p>;
  if (!file) return <p style={muted}>Loading the student file…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ ...muted, margin: 0 }}>Seen by the Director and the homeroom teacher. Never shown to parents. Safeguarding concerns stay with the DSL.</p>

      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{editing ? "Edit entry" : "Add an entry"}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <label style={{ flex: "1 1 150px" }}><span style={label}>Date</span>
            <input type="date" style={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label style={{ flex: "1 1 180px" }}><span style={label}>Type</span>
            <select style={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {ENTRY_KINDS.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
            </select></label>
        </div>
        <label><span style={label}>Title</span>
          <input style={input} value={form.title} placeholder="Short summary" onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label><span style={label}>Details</span>
          <textarea rows={4} style={{ ...input, resize: "vertical" }} value={form.details} placeholder="What happened, what was agreed, next step"
            onChange={(e) => setForm({ ...form, details: e.target.value })} /></label>
        <label style={{ ...label, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <Paperclip size={16} />
          <span>{form.file ? form.file.name : form.keepName ? `Attached: ${form.keepName} (choose a file to replace it)` : "Attach a file (PDF, photo)"}</span>
          <input type="file" accept=".pdf,image/*,.doc,.docx" style={{ display: "none" }} onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
        </label>
        {director && (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 8, background: COLORS.tint, marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={form.directorOnly} onChange={(e) => setForm({ ...form, directorOnly: e.target.checked })} style={{ width: 18, height: 18, margin: "1px 0 0" }} />
            <span><strong>Director only</strong><br /><span style={{ fontSize: 12, color: COLORS.muted }}>The homeroom teacher will not see this entry.</span></span>
          </label>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ ...primaryBtn, flex: 1 }} disabled={busy} onClick={save}>{busy ? "Saving…" : editing ? "Save changes" : "Save entry"}</button>
          {editing && <button style={ghostBtn} onClick={cancel}>Cancel</button>}
        </div>
        {formError && <p style={{ color: COLORS.bad, fontSize: 13, margin: "6px 0 0" }}>{formError}</p>}
        {!manage && <p style={{ ...muted, fontSize: 12, margin: "6px 0 0" }}>Once saved, an entry can only be changed or deleted by the Director.</p>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {FILTERS.map(([id, text]) => (
          <button key={id} style={filter === id ? chipOn : chip} onClick={() => setFilter(id)}>
            {text}{id === "all" ? ` · ${items.length}` : ""}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p style={{ ...card, ...muted }}>Nothing in this student file yet.</p>}
      {shown.map((e) => (
        <div key={e.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 6, border: e.director_only ? `1px dashed ${COLORS.brand}` : card.border }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: COLORS.muted, minWidth: 92 }}>{niceDate(e.date)}</span>
            <Badge kind={e.kind} text={e.badge} />
            {e.director_only && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: COLORS.tint, color: COLORS.brand, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Lock size={12} /> Director only
              </span>
            )}
            <span style={{ fontSize: 12, color: COLORS.muted }}>{e.from ? `${e.from}${e.by ? ` · ${e.by}` : ""}` : e.by ? `Added by ${e.by}` : ""}</span>
          </div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{e.title}</p>
          {e.details && <p style={{ margin: 0, fontSize: 14, color: COLORS.text2, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{e.details}</p>}
          {e.file_path && (
            <button style={{ ...ghostBtn, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => openFile(e.file_path)}>
              <Paperclip size={14} /> {e.file_name || "Open file"}
            </button>
          )}
          {manage && e.source === "entry" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button style={ghostBtn} onClick={() => startEdit(e)}>Edit</button>
              <button style={{ ...ghostBtn, color: COLORS.bad }} onClick={() => remove(e)}>Delete</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Which students' files the signed-in person can open (admin: all; teacher: their homeroom students).
export function useStudentFileAccess(profile) {
  const [ids, setIds] = useState([]);
  const role = profile?.role;
  useEffect(() => {
    if (role !== "admin" && role !== "teacher") { setIds([]); return; }
    supabase.rpc("student_file_students").then(({ data }) => setIds(data || []));
  }, [role, profile?.id]);
  return ids;
}

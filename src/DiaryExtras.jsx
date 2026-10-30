// Pre-N Diary, part 2: families' morning notes, learning stories, class posts, and
// reactions/comments. Comments are private between each family and the class team.
// Staff screens are English only; family views follow the EN/FR toggle.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Camera, Image as ImageIcon, Loader2, Trash2, Send } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment, getAttachmentUrl, deleteAttachment, shrinkImage } from "./lib/attachments";
import { COLORS, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, pill } from "./ui/tokens";
import { eyObservationAreas } from "./data/earlyYears";
import { useAuth } from "./LoginGate";

const card = { ...cardToken, marginBottom: 14 };
const small = { fontSize: 13, color: COLORS.muted };
const pad = (n) => String(n).padStart(2, "0");
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const firstName = (st) => st?.first_name || (st?.full_name || "").split(" ")[0] || "Child";
const dateShort = (s, lang = "en") => new Date(`${s}T12:00:00`).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
const timeOf = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const AREAS = eyObservationAreas("Pre-N").filter((a) => !["music", "pe", "art", "swim"].includes(a.id));

// ---------- photos ----------

export function PhotoImg({ path, style, alt = "" }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let live = true;
    getAttachmentUrl(path).then((u) => live && setUrl(u)).catch(() => live && setUrl(""));
    return () => { live = false; };
  }, [path]);
  return url
    ? <img src={url} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, display: "block", ...style }} />
    : <div style={{ width: "100%", height: "100%", minHeight: 80, borderRadius: 14, background: COLORS.neutralBg, ...style }} />;
}

function PhotoGrid({ paths }) {
  if (!paths?.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(paths.length, 3)}, minmax(0, 1fr))`, gap: 6, marginTop: 10 }}>
      {paths.map((p) => <div key={p} style={{ aspectRatio: "1 / 1" }}><PhotoImg path={p} /></div>)}
    </div>
  );
}

// Pick photos (camera or gallery), up to `max`, with previews.
function PhotoPicker({ files, setFiles, max = 4 }) {
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  const add = (list) => setFiles((cur) => [...cur, ...[...(list || [])].filter((f) => f.type.startsWith("image/"))].slice(0, max));
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44 }}>
          <Camera size={17} />Take photo
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
        <label style={{ ...ghostBtn, display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44 }}>
          <ImageIcon size={17} />Choose from phone
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {previews.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 8 }}>
          {previews.map((u, i) => (
            <div key={u} style={{ position: "relative", aspectRatio: "1 / 1" }}>
              <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
              <button aria-label="Remove photo" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: 3, right: 3, width: 30, height: 30, borderRadius: 15, border: "none", background: "rgba(36,16,18,.65)", color: "#fff", cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function uploadAll(files, grade, kind) {
  const folder = `daily/${grade.replace(/[^a-zA-Z0-9-]/g, "_")}/${kind}`;
  const paths = [];
  for (const f of files) paths.push((await uploadAttachment(await shrinkImage(f, 1600), folder)).path);
  return paths;
}

// ---------- reactions and comments ----------

// Family side: like + this family's private thread with the team.
export function FamilyFeedback({ type, id, hub, lang = "en" }) {
  const { profile } = useAuth() || {};
  const [rows, setRows] = useState([]);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const L = lang === "fr"
    ? { like: "J'aime", comment: "Commenter", team: "Équipe Pre-N", you: "Vous", send: "Envoyer", ph: "Écrire à l'équipe…" }
    : { like: "Like", comment: "Comment", team: "Pre-N team", you: "You", send: "Send", ph: "Write to the team…" };
  const load = useCallback(async () => {
    const { data } = await supabase.from("daily_feedback").select("*").eq("target_type", type).eq("target_id", id).eq("hub_student_id", hub).order("created_at");
    setRows(data || []);
  }, [type, id, hub]);
  useEffect(() => { load(); }, [load]);
  const mine = rows.find((r) => r.kind === "like" && r.created_by === profile?.id);
  const comments = rows.filter((r) => r.kind === "comment");
  const toggleLike = async () => {
    if (mine) await supabase.from("daily_feedback").delete().eq("id", mine.id);
    else await supabase.from("daily_feedback").insert({ target_type: type, target_id: id, hub_student_id: hub, kind: "like" });
    load();
  };
  const send = async () => {
    if (!text.trim()) return;
    const { error } = await supabase.from("daily_feedback").insert({ target_type: type, target_id: id, hub_student_id: hub, kind: "comment", body: text.trim() });
    if (!error) { setText(""); load(); }
  };
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={toggleLike} aria-pressed={!!mine}
          style={{ ...ghostBtn, minHeight: 40, display: "inline-flex", alignItems: "center", gap: 6, color: mine ? COLORS.brand : COLORS.text2, borderColor: mine ? COLORS.brand : COLORS.line }}>
          <Heart size={16} fill={mine ? COLORS.brand : "none"} />{L.like}
        </button>
        <button onClick={() => setOpen(!open)} style={{ ...ghostBtn, minHeight: 40, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <MessageCircle size={16} />{L.comment}{comments.length ? ` (${comments.length})` : ""}
        </button>
      </div>
      {(open || comments.length > 0) && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ alignSelf: c.from_staff ? "flex-start" : "flex-end", maxWidth: "85%", background: c.from_staff ? COLORS.tint : COLORS.neutralBg, borderRadius: 12, padding: "8px 11px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.from_staff ? COLORS.brand : COLORS.muted }}>{c.from_staff ? L.team : (c.created_by === profile?.id ? L.you : "")} · {timeOf(c.created_at)}</div>
              <div style={{ fontSize: 14, lineHeight: 1.45 }}>{c.body}</div>
            </div>
          ))}
          {open && (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={L.ph} style={input} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
              <button style={{ ...primaryBtn, minHeight: 40 }} onClick={send} aria-label={L.send}><Send size={16} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Staff side: likes count + every family's thread, with a reply box per family.
export function StaffFeedback({ type, id, students }) {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("daily_feedback").select("*").eq("target_type", type).eq("target_id", id).order("created_at");
    setRows(data || []);
  }, [type, id]);
  useEffect(() => { load(); }, [load]);
  const likes = rows.filter((r) => r.kind === "like").length;
  const threads = useMemo(() => {
    const m = {};
    rows.filter((r) => r.kind === "comment").forEach((r) => { (m[r.hub_student_id] = m[r.hub_student_id] || []).push(r); });
    return m;
  }, [rows]);
  const nameOf = (hub) => firstName(students.find((s) => s.legacy_id === hub));
  const reply = async (hub) => {
    const body = (drafts[hub] || "").trim();
    if (!body) return;
    const { error } = await supabase.from("daily_feedback").insert({ target_type: type, target_id: id, hub_student_id: hub, kind: "comment", body });
    if (!error) { setDrafts({ ...drafts, [hub]: "" }); load(); }
  };
  const n = Object.keys(threads).length;
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", padding: "6px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: COLORS.muted, display: "inline-flex", gap: 12 }}>
        <span><Heart size={14} style={{ verticalAlign: "-2px" }} /> {likes}</span>
        <span><MessageCircle size={14} style={{ verticalAlign: "-2px" }} /> {n ? `${n} family ${n === 1 ? "thread" : "threads"}` : "No comments"}</span>
      </button>
      {open && Object.entries(threads).map(([hub, list]) => (
        <div key={hub} style={{ background: COLORS.surface2, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 10, marginTop: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.brand, marginBottom: 4 }}>{nameOf(hub)}'s family</div>
          {list.map((c) => (
            <p key={c.id} style={{ margin: "3px 0", fontSize: 14 }}><strong style={{ fontSize: 12, color: c.from_staff ? COLORS.brand : COLORS.muted }}>{c.from_staff ? "Team" : "Family"} · {timeOf(c.created_at)}</strong> {c.body}</p>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input value={drafts[hub] || ""} onChange={(e) => setDrafts({ ...drafts, [hub]: e.target.value })} placeholder="Reply to this family…" style={input} />
            <button style={{ ...primaryBtn, minHeight: 40 }} onClick={() => reply(hub)} aria-label="Send reply"><Send size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- morning notes ----------

const NOTE_ITEMS = [
  { id: "slept_badly", en: "Slept badly", fr: "A mal dormi" },
  { id: "medicine_home", en: "Had medicine at home", fr: "A pris un médicament à la maison" },
  { id: "not_100", en: "Not feeling 100%", fr: "Pas tout à fait en forme" },
  { id: "no_breakfast", en: "Didn't eat breakfast", fr: "N'a pas pris de petit-déjeuner" },
  { id: "other_pickup", en: "Someone else is picking up", fr: "Quelqu'un d'autre vient le/la chercher" },
  { id: "early_pickup", en: "Leaving early today", fr: "Part plus tôt aujourd'hui" }
];
const itemLabel = (id, lang = "en") => (NOTE_ITEMS.find((i) => i.id === id) || {})[lang] || id;

// Staff: today's notes from families (at the top of Today).
export function StaffFamilyNotes({ grade, day, students }) {
  const [rows, setRows] = useState([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("daily_parent_notes").select("*").eq("grade", grade).eq("day", day).order("created_at");
    setRows(data || []);
  }, [grade, day]);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  if (!rows.length) return null;
  const markRead = async (r) => { await supabase.from("daily_parent_notes").update({ read_at: new Date().toISOString() }).eq("id", r.id); load(); };
  return (
    <section style={{ ...card, background: COLORS.warnBg, border: "none" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Notes from families today</h2>
      {rows.map((r) => (
        <div key={r.id} style={{ borderTop: "1px solid rgba(138,100,32,.2)", padding: "8px 0", display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <strong>{firstName(students.find((s) => s.id === r.student_id))}</strong> <span style={small}>{timeOf(r.created_at)}</span>
            {r.items?.length > 0 && <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.warn }}>{r.items.map((i) => itemLabel(i)).join(" · ")}</div>}
            {r.note && <div style={{ fontSize: 14 }}>{r.note}</div>}
          </div>
          {r.read_at ? <span style={pill("ok")}>Read</span> : <button style={{ ...ghostBtn, minHeight: 36 }} onClick={() => markRead(r)}>Mark read</button>}
        </div>
      ))}
    </section>
  );
}

// Family: send a note to the team (today only).
export function FamilyMorningNote({ student, lang = "en" }) {
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const L = lang === "fr"
    ? { title: "Un mot pour l'équipe", btn: "Écrire un mot à l'équipe", send: "Envoyer", sent: "Envoyé", read: "Lu par l'équipe", ph: "Autre chose à savoir aujourd'hui ? (facultatif)", hint: "Pour un médicament à donner à l'école ou une urgence, appelez l'école." }
    : { title: "A note for the team", btn: "Write a note to the team", send: "Send", sent: "Sent", read: "Read by the team", ph: "Anything else the team should know today? (optional)", hint: "For medicine to be given at school, or anything urgent, please call the school." };
  const load = useCallback(async () => {
    const { data } = await supabase.from("daily_parent_notes").select("*").eq("hub_student_id", student.id).eq("day", todayStr()).order("created_at");
    setRows(data || []);
  }, [student.id]);
  useEffect(() => { load(); }, [load]);
  const send = async () => {
    if (!items.length && !note.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("diary_family_note", { p_hub_student: student.id, p_items: items, p_note: note.trim() || null });
    setBusy(false);
    if (!error) { setItems([]); setNote(""); setOpen(false); load(); }
  };
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 14 }}>
      {rows.map((r) => (
        <div key={r.id} style={{ fontSize: 14, marginBottom: 8 }}>
          <span style={pill(r.read_at ? "ok" : "info")}>{r.read_at ? L.read : L.sent} · {timeOf(r.created_at)}</span>
          <div style={{ marginTop: 4 }}>{[...(r.items || []).map((i) => itemLabel(i, lang)), r.note].filter(Boolean).join(" · ")}</div>
        </div>
      ))}
      {!open ? (
        <button style={{ ...ghostBtn, minHeight: 44, width: "100%" }} onClick={() => setOpen(true)}>{L.btn}</button>
      ) : (
        <>
          <p style={{ margin: "0 0 8px", fontWeight: 700, color: COLORS.brand, fontSize: 14 }}>{L.title}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {NOTE_ITEMS.map((i) => (
              <button key={i.id} style={{ ...(items.includes(i.id) ? chipOn : chip), minHeight: 40 }}
                onClick={() => setItems(items.includes(i.id) ? items.filter((x) => x !== i.id) : [...items, i.id])}>{i[lang]}</button>
            ))}
          </div>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={L.ph} style={{ ...input, marginTop: 8, resize: "vertical" }} />
          <p style={{ ...small, margin: "6px 0" }}>{L.hint}</p>
          <button style={{ ...primaryBtn, minHeight: 44 }} disabled={busy || (!items.length && !note.trim())} onClick={send}>{L.send}</button>
        </>
      )}
    </div>
  );
}

// ---------- learning stories ----------

const areaLabel = (id, lang = "en") => (AREAS.find((a) => a.id === id) || {})[lang] || id;
const AREA_TONES = ["#F7E6E8:#801524", "#E7ECF5:#2F4A7F", "#E4EFE7:#2F6040", "#F6EED9:#7A5B16", "#F1E6F2:#6B3A6E", "#E4EDF7:#2F5E8A"];
const toneFor = (id) => { const i = Math.max(0, AREAS.findIndex((a) => a.id === id)) % AREA_TONES.length; const [bg, fg] = AREA_TONES[i].split(":"); return { bg, fg }; };

export function StaffStories({ grade, students, profile }) {
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("learning_stories").select("*").eq("grade", grade).order("created_at", { ascending: false }).limit(40);
    setRows(data || []);
  }, [grade]);
  useEffect(() => { load(); }, [load]);

  const perChild = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - 14);
    const m = {};
    rows.filter((r) => r.status === "shared" && new Date(r.shared_at) >= since).forEach((r) => r.student_ids.forEach((id) => { m[id] = (m[id] || 0) + 1; }));
    return m;
  }, [rows]);

  const share = async (r) => {
    if (!window.confirm("Share this learning story with the families of the children in it?")) return;
    await supabase.rpc("ls_share", { p_id: r.id });
    load();
  };
  const remove = async (r) => {
    if (!window.confirm("Delete this learning story?")) return;
    const { error } = await supabase.from("learning_stories").delete().eq("id", r.id);
    if (!error) for (const p of r.photos || []) await deleteAttachment(p).catch(() => {});
    load();
  };

  return (
    <>
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17 }}>Learning stories</h2>
            <p style={{ ...small, margin: "4px 0 0" }}>One short story per child each week: what happened, what it shows, and an idea for home.</p>
          </div>
          <button style={primaryBtn} onClick={() => setEditing({})}>New learning story</button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {students.map((s) => (
            <span key={s.id} style={pill(perChild[s.id] ? "ok" : "warn")}>{firstName(s)} · {perChild[s.id] || 0} in 2 weeks</span>
          ))}
        </div>
      </section>

      {editing && <StoryEditor grade={grade} students={students} story={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      {rows.map((r) => (
        <section key={r.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
            <div>
              <div style={small}>{dateShort(r.day)} · {r.student_ids.map((id) => firstName(students.find((s) => s.id === id))).join(", ")}</div>
              <h3 style={{ margin: "2px 0 0", fontSize: 16 }}>{r.title || "Learning story"}</h3>
            </div>
            <span style={pill(r.status === "shared" ? "ok" : "warn")}>{r.status === "shared" ? "Shared" : "Draft"}</span>
          </div>
          <StoryBody story={r} lang="en" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {r.status === "draft" && <button style={primaryBtn} onClick={() => share(r)}>Share with families</button>}
            {r.status === "draft" && <button style={ghostBtn} onClick={() => setEditing(r)}>Edit</button>}
            {(isAdmin || r.created_by === profile?.id) && <button style={ghostBtn} onClick={() => remove(r)} aria-label="Delete story"><Trash2 size={15} /></button>}
          </div>
          {r.status === "shared" && <StaffFeedback type="story" id={r.id} students={students} />}
        </section>
      ))}
    </>
  );
}

function StoryEditor({ grade, students, story, onClose, onSaved }) {
  const [kids, setKids] = useState(story.student_ids || []);
  const [title, setTitle] = useState(story.title || "");
  const [text, setText] = useState(story.story || "");
  const [learning, setLearning] = useState(story.learning || "");
  const [areas, setAreas] = useState(story.areas || []);
  const [home, setHome] = useState(story.home_idea || "");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = kids.some((id) => students.find((s) => s.id === id)?.no_photos);
  const lbl = { ...small, fontWeight: 600, display: "block", margin: "12px 0 6px" };
  const toggle = (list, set, id) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const save = async (andShare) => {
    if (!kids.length) { setError("Choose at least one child."); return; }
    if (!text.trim()) { setError("Write what happened."); return; }
    if (files.length && blocked) { setError("A chosen child has no photo consent. Remove the photos or that child."); return; }
    setBusy(true); setError("");
    try {
      const newPaths = files.length ? await uploadAll(files, grade, "stories") : [];
      const row = { grade, student_ids: kids, title: title.trim() || null, story: text.trim(), learning: learning.trim() || null,
        areas, home_idea: home.trim() || null, photos: [...(story.photos || []), ...newPaths] };
      const res = story.id
        ? await supabase.from("learning_stories").update(row).eq("id", story.id).select().single()
        : await supabase.from("learning_stories").insert(row).select().single();
      if (res.error) throw res.error;
      if (andShare) await supabase.rpc("ls_share", { p_id: res.data.id });
      onSaved();
    } catch (e) {
      setError(/consent/i.test(e?.message || "") ? "A chosen child has no photo consent." : "Could not save. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <section style={{ ...card, border: `2px solid ${COLORS.brand}` }}>
      <h2 style={{ margin: 0, fontSize: 17 }}>{story.id ? "Edit learning story" : "New learning story"}</h2>
      <span style={lbl}>Who is it about?</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {students.map((s) => <button key={s.id} style={{ ...(kids.includes(s.id) ? chipOn : chip), minHeight: 40 }} onClick={() => toggle(kids, setKids, s.id)}>{firstName(s)}{s.no_photos ? " · no photos" : ""}</button>)}
      </div>
      <label style={lbl}>Title (optional)</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The tallest tower" style={input} />
      <label style={lbl}>What happened</label>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} style={{ ...input, resize: "vertical" }}
        placeholder="e.g. Léo stacked six blocks, watched it fall, laughed and tried again with the big blocks at the bottom." />
      <label style={lbl}>What it shows about their learning</label>
      <textarea rows={2} value={learning} onChange={(e) => setLearning(e.target.value)} style={{ ...input, resize: "vertical" }}
        placeholder="e.g. He is keeping going when something is hard, and starting to notice size." />
      <span style={lbl}>Areas of development</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {AREAS.map((a) => <button key={a.id} style={{ ...(areas.includes(a.id) ? chipOn : chip), minHeight: 40 }} onClick={() => toggle(areas, setAreas, a.id)}>{a.en}</button>)}
      </div>
      <label style={lbl}>Idea to try at home (optional)</label>
      <input value={home} onChange={(e) => setHome(e.target.value)} placeholder="e.g. Build with boxes or cups and count them together." style={input} />
      <span style={lbl}>Photos (up to 4)</span>
      {(story.photos || []).length > 0 && <PhotoGrid paths={story.photos} />}
      <PhotoPicker files={files} setFiles={setFiles} max={4} />
      {error && <p style={{ ...pill("bad"), display: "block", whiteSpace: "normal", fontSize: 13, padding: "8px 12px", marginTop: 10 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button style={primaryBtn} disabled={busy} onClick={() => save(true)}>{busy ? <Loader2 size={16} className="bsf-spin" /> : "Share with families"}</button>
        <button style={ghostBtn} disabled={busy} onClick={() => save(false)}>Save as draft</button>
        <button style={ghostBtn} disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </section>
  );
}

function StoryBody({ story, lang }) {
  const L = lang === "fr" ? { learn: "Ce que cela montre", home: "À essayer à la maison" } : { learn: "What it shows", home: "Try at home" };
  return (
    <>
      <PhotoGrid paths={story.photos} />
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55 }}>{story.story}</p>
      {story.learning && <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55 }}><strong style={{ color: COLORS.brand }}>{L.learn}: </strong>{story.learning}</p>}
      {story.areas?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {story.areas.map((a) => { const t = toneFor(a); return <span key={a} style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: t.bg, color: t.fg }}>{areaLabel(a, lang)}</span>; })}
        </div>
      )}
      {story.home_idea && <p style={{ margin: "8px 0 0", fontSize: 14, background: COLORS.okBg, borderRadius: 10, padding: "8px 10px" }}><strong style={{ color: COLORS.ok }}>{L.home}: </strong>{story.home_idea}</p>}
    </>
  );
}

export function FamilyStories({ student, lang = "en" }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from("learning_stories").select("*").contains("hub_student_ids", [student.id]).eq("status", "shared")
      .order("shared_at", { ascending: false }).limit(30).then(({ data }) => setRows(data || []));
  }, [student.id]);
  if (rows === null) return <p className="bsf-muted">…</p>;
  if (!rows.length) return <p className="bsf-muted">{lang === "fr" ? "Aucune histoire d'apprentissage pour l'instant." : "No learning stories yet."}</p>;
  return rows.map((r) => (
    <div key={r.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 14, marginBottom: 10 }}>
      <div style={small}>{dateShort(r.day, lang)}</div>
      <h3 style={{ margin: "2px 0 0", fontSize: 16, fontFamily: "'Fraunces', serif" }}>{r.title || (lang === "fr" ? "Histoire d'apprentissage" : "Learning story")}</h3>
      <StoryBody story={r} lang={lang} />
      <FamilyFeedback type="story" id={r.id} hub={student.id} lang={lang} />
    </div>
  ));
}

// ---------- class posts ----------

export function StaffPosts({ grade, students, profile }) {
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState([]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("class_posts").select("*").eq("grade", grade).order("created_at", { ascending: false }).limit(30);
    setRows(data || []);
  }, [grade]);
  useEffect(() => { load(); }, [load]);
  const post = async () => {
    if (!body.trim()) { setError("Write a few words first."); return; }
    if (!window.confirm(`Post this to every ${grade} family?`)) return;
    setBusy(true); setError("");
    try {
      const photos = files.length ? await uploadAll(files, grade, "posts") : [];
      const { error: e } = await supabase.from("class_posts").insert({ grade, body: body.trim(), photos });
      if (e) throw e;
      setBody(""); setFiles([]); load();
    } catch { setError("Could not post. Check your connection and try again."); }
    setBusy(false);
  };
  const remove = async (r) => {
    if (!window.confirm("Delete this post for every family?")) return;
    const { error: e } = await supabase.from("class_posts").delete().eq("id", r.id);
    if (!e) for (const p of r.photos || []) await deleteAttachment(p).catch(() => {});
    load();
  };
  const noPhotoKids = students.filter((s) => s.no_photos).map(firstName);
  return (
    <>
      <section style={card}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Post to the whole class</h2>
        <p style={{ ...small, margin: "0 0 10px" }}>Every {grade} family sees it, e.g. "Today we went on a leaf hunt in the garden."</p>
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} style={{ ...input, resize: "vertical" }} placeholder="What did the class do today?" />
        <div style={{ marginTop: 8 }}><PhotoPicker files={files} setFiles={setFiles} max={6} /></div>
        {files.length > 0 && noPhotoKids.length > 0 && (
          <p style={{ ...pill("warn"), display: "block", whiteSpace: "normal", fontSize: 13, padding: "8px 12px", marginTop: 8 }}>
            Every family sees these photos. Make sure {noPhotoKids.join(", ")} {noPhotoKids.length === 1 ? "is" : "are"} not in them (no photo consent).
          </p>
        )}
        {error && <p style={{ ...pill("bad"), display: "block", whiteSpace: "normal", fontSize: 13, padding: "8px 12px", marginTop: 8 }}>{error}</p>}
        <button style={{ ...primaryBtn, marginTop: 10, minHeight: 46 }} disabled={busy} onClick={post}>{busy ? "Posting…" : "Post to families"}</button>
      </section>
      {rows.map((r) => (
        <section key={r.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={small}>{dateShort(r.day)} · {timeOf(r.created_at)}</span>
            {(isAdmin || r.created_by === profile?.id) && <button style={{ ...ghostBtn, minHeight: 32, padding: "4px 10px" }} onClick={() => remove(r)} aria-label="Delete post"><Trash2 size={15} /></button>}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-line" }}>{r.body}</p>
          <PhotoGrid paths={r.photos} />
          <StaffFeedback type="post" id={r.id} students={students} />
        </section>
      ))}
    </>
  );
}

export function FamilyPosts({ student, lang = "en" }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.from("class_posts").select("*").eq("grade", student.grade).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setRows(data || []));
  }, [student.grade]);
  if (rows === null) return <p className="bsf-muted">…</p>;
  if (!rows.length) return <p className="bsf-muted">{lang === "fr" ? "Pas encore de nouvelles de la classe." : "No class news yet."}</p>;
  return rows.map((r) => (
    <div key={r.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 14, marginBottom: 10 }}>
      <div style={small}>{dateShort(r.day, lang)} · {timeOf(r.created_at)}</div>
      <p style={{ margin: "6px 0 0", fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-line" }}>{r.body}</p>
      <PhotoGrid paths={r.photos} />
      <FamilyFeedback type="post" id={r.id} hub={student.id} lang={lang} />
    </div>
  ));
}

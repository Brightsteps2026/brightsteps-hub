import { useEffect, useState } from "react";
import { FolderLock } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { uploadAttachment, getAttachmentUrl } from "./lib/attachments";
import { PayrollSummary, SignaturesOverview, ContractCard, DocumentsCard, LeaveBalanceCard, OnboardingCard, SectionChips } from "./HrExtras";
import { COLORS, TONES, card as cardToken, chip, chipOn, primaryBtn, ghostBtn, input, label, pill } from "./ui/tokens";

export { FolderLock as StaffFilesIcon };

// Staff files (Myri, 20 Nov 2026). Staff screen, English only.
// Admin: adds and edits entries. Accountant: reads. Staff never see their file (Myri, 20 Nov 2026).
const wrap = { padding: "16px 16px 90px", maxWidth: 820, margin: "0 auto" };
const card = { ...cardToken, marginBottom: 12 };
const heading = { margin: "0 0 12px", fontSize: 18, fontWeight: 600 };
const small = { fontSize: 13, color: COLORS.muted, margin: 0 };
const row = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };

export const CATEGORIES = [
  { id: "explanation_request", label: "Request for explanation", tone: "warn" },
  { id: "absence", label: "Absence", tone: "warn" },
  { id: "lateness", label: "Lateness", tone: "warn" },
  { id: "conduct", label: "Conduct", tone: "bad" },
  { id: "performance", label: "Performance", tone: "info" },
  { id: "observation", label: "Classroom observation", tone: "info" },
  { id: "appraisal", label: "Appraisal", tone: "info" },
  { id: "warning", label: "Written warning", tone: "bad" },
  { id: "meeting", label: "Meeting", tone: "neutral" },
  { id: "return_to_work", label: "Return to work", tone: "neutral" },
  { id: "emergency_plans", label: "Emergency plans", tone: "info" },
  { id: "commendation", label: "Commendation", tone: "ok" },
  { id: "note", label: "Note", tone: "neutral" }
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const REASONS = [
  { id: "sudden_illness", label: "Sudden illness" },
  { id: "family_emergency", label: "Family emergency" },
  { id: "forgot_check_in", label: "I was at school but forgot to check in" },
  { id: "transport", label: "Transport problem" },
  { id: "other", label: "Other" }
];
const REASON = Object.fromEntries(REASONS.map((r) => [r.id, r.label]));

const REQ_STATUS = {
  awaiting: { label: "Awaiting reply", tone: "warn" },
  answered: { label: "Reply received", tone: "info" },
  accepted: { label: "Explanation accepted", tone: "ok" },
  not_accepted: { label: "Not accepted", tone: "bad" },
  withdrawn: { label: "Withdrawn", tone: "neutral" }
};

function fmtDate(s) {
  if (!s) return "";
  return new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(s) {
  if (!s) return "";
  return new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
async function openFile(path) {
  try {
    window.open(await getAttachmentUrl(path), "_blank", "noopener");
  } catch (e) {
    alert("Couldn't open the file: " + e.message);
  }
}
const Pill = ({ tone, children }) => <span style={pill(tone)}>{children}</span>;
const folder = (id) => `staff-file/${id}`;

export default function StaffFilesTab({ profile }) {
  const role = profile?.role;
  if (role === "admin" || role === "accountant") return <OfficeView canEdit={role === "admin"} />;
  return null;
}

// ---------- Admin / accountant ----------

function OfficeView({ canEdit }) {
  const [people, setPeople] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [section, setSection] = useState("files");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const { data, error } = await supabase.rpc("staff_file_people");
    if (error) setError(error.message);
    setPeople(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const person = people.find((p) => p.id === openId);
  if (loading) return <div style={wrap}><p style={small}>Loading…</p></div>;
  if (error) return <div style={wrap}><p style={{ ...card, color: COLORS.bad }}>Couldn't load staff files: {error}</p></div>;
  if (person) return <PersonFile person={person} canEdit={canEdit} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <div style={wrap}>
      <h2 style={heading}>HR</h2>
      <SectionChips value={section} onChange={setSection} options={[["files", "Staff files"], ["payroll", "Monthly summary"], ["signatures", "Policy signatures"]]} />
      {section === "payroll" && <PayrollSummary />}
      {section === "signatures" && <SignaturesOverview />}
      {section === "files" && <p style={{ ...small, marginBottom: 12 }}>Private to the Director and HR. Staff members never see their file. They only see absence explanation requests, in their Leave tab.</p>}
      {section === "files" && people.map((p) => (
        <button key={p.id} onClick={() => setOpenId(p.id)}
          style={{ ...card, width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: COLORS.tint, color: COLORS.brand, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
            {(p.full_name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{p.display_name || p.full_name}</span>
            <span style={small}>{p.display_name ? `${p.full_name} · ` : ""}{p.role === "learning_assistant" ? "Learning assistant" : p.role === "accountant" ? "Accountant" : "Teacher"}</span>
          </span>
          <span style={{ ...row, justifyContent: "flex-end" }}>
            {p.awaiting > 0 && <Pill tone="warn">{p.awaiting} to follow up</Pill>}
            {p.absences_90 >= 3 && <Pill tone="bad">{p.absences_90} absences (3 months)</Pill>}
            {p.role !== "accountant" && !p.plans_submitted_at && <Pill tone="neutral">No emergency plans</Pill>}
            <Pill tone="neutral">{p.entries} entr{p.entries === 1 ? "y" : "ies"}</Pill>
          </span>
        </button>
      ))}
    </div>
  );
}

function PersonFile({ person, canEdit, onBack }) {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState(null);
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [e, s] = await Promise.all([
      supabase.from("staff_file_entries").select("*").eq("staff_id", person.id).order("created_at", { ascending: false }),
      supabase.from("staff_file_status").select("*").eq("staff_id", person.id).maybeSingle()
    ]);
    if (e.error) setError(e.error.message);
    setEntries(e.data || []);
    setStatus(s.data || null);
  }
  useEffect(() => { load(); }, [person.id]);

  const shown = entries.filter((x) =>
    filter === "all" ? true :
    filter === "followup" ? x.category === "explanation_request" && ["awaiting", "answered"].includes(x.status) :
    true);

  async function markPlansChecked() {
    const { error } = await supabase.from("staff_file_status")
      .upsert({ staff_id: person.id, emergency_plans_checked_at: new Date().toISOString() }, { onConflict: "staff_id" });
    if (error) return alert(error.message);
    load();
  }

  return (
    <div style={wrap}>
      <button style={{ ...ghostBtn, marginBottom: 12 }} onClick={onBack}>← All staff</button>
      <div style={{ ...card, ...row, justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{person.display_name || person.full_name}</p>
          <p style={small}>{person.full_name}</p>
        </div>
        {canEdit && <button style={primaryBtn} onClick={() => setAdding(true)}>Add entry</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
        <Metric label="Absences, last 3 months" value={person.absences_90} alert={person.absences_90 >= 3} />
        <Metric label="To follow up" value={entries.filter((x) => x.category === "explanation_request" && ["awaiting", "answered"].includes(x.status)).length} />
        <Metric label="Entries" value={entries.length} />
      </div>

      {person.role !== "accountant" && (
        <div style={{ ...card, ...row, justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Emergency lesson plans</p>
            <p style={small}>
              {status?.emergency_plans_submitted_at
                ? `Submitted ${fmtDate(status.emergency_plans_submitted_at)}${status.emergency_plans_checked_at ? ` · checked ${fmtDate(status.emergency_plans_checked_at)}` : " · not checked yet"}`
                : "Not submitted yet"}
            </p>
          </div>
          <span style={row}>
            {status?.emergency_plans_path && <button style={ghostBtn} onClick={() => openFile(status.emergency_plans_path)}>Open</button>}
            {canEdit && status?.emergency_plans_submitted_at && !status?.emergency_plans_checked_at &&
              <button style={ghostBtn} onClick={markPlansChecked}>Mark as checked</button>}
          </span>
        </div>
      )}

      <ContractCard staffId={person.id} canEdit={canEdit} />
      {person.role !== "accountant" && <LeaveBalanceCard staffId={person.id} canEdit={canEdit} />}
      <DocumentsCard staffId={person.id} canEdit={canEdit} />
      <OnboardingCard staffId={person.id} canEdit={canEdit} />

      <h3 style={{ margin: "18px 0 10px", fontSize: 16, fontWeight: 600 }}>File entries</h3>
      {adding && <EntryForm staffId={person.id} onDone={() => { setAdding(false); load(); }} />}

      <div style={{ ...row, marginBottom: 12 }}>
        {[["all", "All"], ["followup", "To follow up"]].map(([id, l]) => (
          <button key={id} style={filter === id ? chipOn : chip} onClick={() => setFilter(id)}>{l}</button>
        ))}
      </div>
      {error && <p style={{ ...card, color: COLORS.bad }}>{error}</p>}
      {shown.length === 0 && <p style={{ ...card, ...small }}>Nothing here yet.</p>}
      {shown.map((e) => <EntryCard key={e.id} e={e} canEdit={canEdit} reload={load} />)}
    </div>
  );
}

function Metric({ label: l, value, alert: a }) {
  return (
    <div style={{ background: a ? COLORS.badBg : COLORS.neutralBg, borderRadius: 10, padding: "8px 12px" }}>
      <p style={{ margin: 0, fontSize: 12, color: a ? COLORS.bad : COLORS.muted }}>{l}</p>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: a ? COLORS.bad : COLORS.ink }}>{value}</p>
    </div>
  );
}

function EntryForm({ staffId, entry, onDone }) {
  const [f, setF] = useState({
    category: entry?.category || "note",
    entry_date: entry?.entry_date || "",
    title: entry?.title || "",
    details: entry?.details || "",
    visibility: entry?.visibility || "private"
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });

  async function save() {
    if (!f.title.trim()) return setErr("Give the entry a title.");
    if (f.category === "explanation_request" && !entry &&
        !window.confirm("The staff member will be asked to explain in their Leave tab. Continue?")) return;
    setBusy(true);
    const patch = { ...f, visibility: "private", title: f.title.trim(), details: f.details.trim() || null, entry_date: f.entry_date || null };
    if (f.category === "explanation_request" && !entry) Object.assign(patch, { status: "awaiting", reply_due_at: new Date(Date.now() + 72 * 3600e3).toISOString() });
    const { data: me } = await supabase.auth.getUser();
    const { error } = entry
      ? await supabase.from("staff_file_entries").update(patch).eq("id", entry.id)
      : await supabase.from("staff_file_entries").insert({ ...patch, staff_id: staffId, created_by: me?.user?.id });
    setBusy(false);
    if (error) return setErr(error.message);
    onDone();
  }

  return (
    <div style={{ ...card, borderColor: COLORS.brand }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{entry ? "Edit entry" : "New entry"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <div>
          <span style={label}>Type</span>
          <select style={input} value={f.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <span style={label}>Date of the facts</span>
          <input type="date" style={input} value={f.entry_date || ""} onChange={set("entry_date")} />
        </div>
      </div>
      <span style={label}>Title</span>
      <input style={input} value={f.title} onChange={set("title")} placeholder="Same-day absence notice" />
      <span style={label}>What happened (facts only)</span>
      <textarea style={{ ...input, minHeight: 110 }} value={f.details} onChange={set("details")}
        placeholder="Contacted the Director at 7:45 am to say she would not come in. Policy requires notice the day before." />
      <p style={{ ...small, marginTop: 10 }}>{f.category === "explanation_request" ? "The staff member gets a notification asking them to explain, in their Leave tab. They never see the rest of their file." : "Private to the Director and HR. Staff members never see their file."}</p>
      {err && <p style={{ color: COLORS.bad, fontSize: 13 }}>{err}</p>}
      <div style={{ ...row, marginTop: 12 }}>
        <button style={primaryBtn} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        <button style={ghostBtn} onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function EntryCard({ e, canEdit, reload, staffView }) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const cat = CAT[e.category] || CAT.note;
  const isReq = e.category === "explanation_request";
  const st = isReq && REQ_STATUS[e.status];

  if (editing) return <EntryForm entry={e} onDone={() => { setEditing(false); reload(); }} />;

  async function update(patch) {
    const { error } = await supabase.from("staff_file_entries").update(patch).eq("id", e.id);
    if (error) return setErr(error.message);
    reload();
  }
  async function decide(status) {
    if (status === "not_accepted" && !note.trim()) return setErr("Write a short reason first.");
    update({ status, decision_note: note.trim() || null, decided_at: new Date().toISOString() });
  }
  async function remove() {
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    const { error } = await supabase.from("staff_file_entries").delete().eq("id", e.id);
    if (error) return setErr(error.message);
    reload();
  }

  return (
    <div style={card}>
      <div style={{ ...row, marginBottom: 6 }}>
        <Pill tone={cat.tone}>{cat.label}</Pill>
        {st && <Pill tone={st.tone}>{st.label}</Pill>}
        <span style={{ ...small, marginLeft: "auto" }}>{e.entry_date ? fmtDate(e.entry_date) : "Date to confirm"}</span>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{e.title}</p>
      {e.details && <p style={{ margin: "4px 0 0", fontSize: 14, whiteSpace: "pre-wrap", color: COLORS.text2 }}>{e.details}</p>}
      {isReq && e.status === "awaiting" && e.reply_due_at && (
        <p style={{ ...small, marginTop: 6, color: new Date(e.reply_due_at) < new Date() ? COLORS.bad : COLORS.muted }}>
          Reply due by {fmtDateTime(e.reply_due_at)}
        </p>
      )}

      {e.replied_at && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: COLORS.surface2, border: `1px solid ${COLORS.line}` }}>
          <p style={{ ...small, fontWeight: 600 }}>{staffView ? "Your reply" : "Staff reply"} · {fmtDateTime(e.replied_at)}</p>
          {e.staff_reason && <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600 }}>{REASON[e.staff_reason]}</p>}
          {e.staff_reply && <p style={{ margin: "4px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{e.staff_reply}</p>}
          {e.reply_proof_path && <button style={{ ...ghostBtn, marginTop: 6 }} onClick={() => openFile(e.reply_proof_path)}>Open proof{e.reply_proof_name ? ` (${e.reply_proof_name})` : ""}</button>}
        </div>
      )}
      {e.decision_note && <p style={{ ...small, marginTop: 8 }}>Director's decision: {e.decision_note}</p>}


      {canEdit && isReq && e.status === "answered" && (
        <div style={{ marginTop: 10 }}>
          <input style={input} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Your decision note (required if not accepted)" />
          <div style={{ ...row, marginTop: 8 }}>
            <button style={primaryBtn} onClick={() => decide("accepted")}>Accept explanation</button>
            <button style={ghostBtn} onClick={() => decide("not_accepted")}>Not accepted</button>
          </div>
        </div>
      )}
      {canEdit && (
        <div style={{ ...row, marginTop: 10 }}>
          <button style={ghostBtn} onClick={() => setEditing(true)}>Edit</button>
          <button style={{ ...ghostBtn, color: COLORS.bad }} onClick={remove}>Delete</button>
        </div>
      )}
      {err && <p style={{ color: COLORS.bad, fontSize: 13 }}>{err}</p>}
    </div>
  );
}


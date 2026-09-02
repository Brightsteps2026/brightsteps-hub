import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

const PRICES = { day: 2700, week: 13000, month: 50000 };

const LABELS = {
  day: "Day",
  week: "Week",
  month: "Month",
};

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeFor(type, dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  if (type === "day") {
    return { start: dateStr, end: dateStr };
  }
  if (type === "week") {
    const dow = d.getDay();
    const offset = dow === 0 ? 1 : 1 - dow;
    const mon = new Date(d);
    mon.setDate(d.getDate() + offset);
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    return { start: toISO(mon), end: toISO(fri) };
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toISO(first), end: toISO(last) };
}

function money(n) {
  return n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ");
}

const box = {
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 16,
  background: "#fff",
  marginBottom: 16,
};

const btn = {
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: "8px 14px",
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
};

const btnOn = {
  ...btn,
  borderColor: "#1d9e75",
  background: "#e1f5ee",
  fontWeight: 500,
};

export default function CanteenTab({ profile }) {
  const role = profile?.role;
  const canEdit = role === "admin" || role === "accountant";
  const canView = canEdit || role === "teacher";

  const [students, setStudents] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [passType, setPassType] = useState("day");
  const [passDate, setPassDate] = useState(toISO(new Date()));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const s = await supabase
      .from("students")
      .select("id, full_name, grade")
      .order("full_name");
    if (s.error) {
      setError(s.error.message);
      setLoading(false);
      return;
    }
    const p = await supabase
      .from("canteen_passes")
      .select("id, student_id, pass_type, start_date, end_date, amount, paid")
      .order("start_date", { ascending: false });
    if (p.error) {
      setError(p.error.message);
      setLoading(false);
      return;
    }
    setStudents(s.data || []);
    setPasses(p.data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (canView) load();
    else setLoading(false);
  }, [canView]);

  async function addPass() {
    if (!selected) return;
    const { start, end } = rangeFor(passType, passDate);

    const clash = passes.find(
      (x) =>
        x.student_id === selected.id &&
        x.start_date <= end &&
        x.end_date >= start
    );
    if (clash) {
      setStatus(
        `Already covered: a ${LABELS[clash.pass_type].toLowerCase()} pass runs ${clash.start_date} to ${clash.end_date}.`
      );
      return;
    }

    setSaving(true);
    setStatus("");
    const { error: err } = await supabase.from("canteen_passes").insert({
      student_id: selected.id,
      pass_type: passType,
      start_date: start,
      end_date: end,
      amount: PRICES[passType],
      paid: true,
    });
    setSaving(false);
    if (err) {
      setStatus(`Could not save: ${err.message}`);
      return;
    }
    setStatus(`Saved. ${start} to ${end}.`);
    load();
  }

  async function removePass(id) {
    const { error: err } = await supabase
      .from("canteen_passes")
      .delete()
      .eq("id", id);
    if (err) {
      setStatus(`Could not remove: ${err.message}`);
      return;
    }
    load();
  }

  if (!canView) {
    return (
      <div style={box}>
        <p style={{ margin: 0 }}>
          Canteen ordering for parents is coming soon.
        </p>
      </div>
    );
  }

  if (loading) return <div style={box}>Loading…</div>;
  if (error) return <div style={box}>Could not load: {error}</div>;

  const today = toISO(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toISO(tomorrowDate);

  const eatingTomorrow = passes.filter(
    (p) => p.start_date <= tomorrow && p.end_date >= tomorrow
  );

  const byGrade = {};
  eatingTomorrow.forEach((p) => {
    const st = students.find((s) => s.id === p.student_id);
    const g = st?.grade || "—";
    byGrade[g] = (byGrade[g] || 0) + 1;
  });

  const term = search.trim().toLowerCase();
  const shown = term
    ? students.filter((s) => (s.full_name || "").toLowerCase().includes(term))
    : students;

  const selectedPasses = selected
    ? passes.filter((p) => p.student_id === selected.id)
    : [];

  return (
    <div>
      <div style={box}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 500 }}>
          Kitchen count for tomorrow
        </h3>
        <p style={{ margin: "0 0 12px", color: "#666", fontSize: 13 }}>
          {tomorrow}
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 500 }}>
          {eatingTomorrow.length}
        </p>
        {Object.keys(byGrade).length === 0 ? (
          <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
            No meals booked yet.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {Object.entries(byGrade)
              .sort()
              .map(([g, n]) => (
                <span key={g} style={{ fontSize: 14 }}>
                  {g}: <strong style={{ fontWeight: 500 }}>{n}</strong>
                </span>
              ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div style={box}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 500 }}>
            Record a pass
          </h3>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a student"
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #ccc",
              borderRadius: 8,
              fontSize: 14,
              marginBottom: 10,
            }}
          />

          <div
            style={{
              maxHeight: 160,
              overflowY: "auto",
              border: "1px solid #eee",
              borderRadius: 8,
              marginBottom: 14,
            }}
          >
            {shown.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  setSelected(s);
                  setStatus("");
                }}
                style={{
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontSize: 14,
                  background:
                    selected?.id === s.id ? "#e1f5ee" : "transparent",
                  borderBottom: "1px solid #f2f2f2",
                }}
              >
                {s.full_name}
                <span style={{ color: "#888", marginLeft: 8, fontSize: 13 }}>
                  {s.grade}
                </span>
              </div>
            ))}
            {shown.length === 0 && (
              <div style={{ padding: 10, color: "#888", fontSize: 14 }}>
                No student found.
              </div>
            )}
          </div>

          {selected && (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                Selected: <strong style={{ fontWeight: 500 }}>{selected.full_name}</strong>
              </p>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {["day", "week", "month"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setPassType(t)}
                    style={passType === t ? btnOn : btn}
                  >
                    {LABELS[t]} · {money(PRICES[t])}
                  </button>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: "#666" }}>
                  {passType === "day"
                    ? "Date"
                    : passType === "week"
                    ? "Any day in the week"
                    : "Any day in the month"}
                </label>
                <br />
                <input
                  type="date"
                  value={passDate}
                  onChange={(e) => setPassDate(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    fontSize: 14,
                    marginTop: 4,
                  }}
                />
              </div>

              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#666" }}>
                Covers {rangeFor(passType, passDate).start} to{" "}
                {rangeFor(passType, passDate).end}
              </p>

              <button onClick={addPass} disabled={saving} style={btnOn}>
                {saving ? "Saving…" : "Record as paid"}
              </button>

              {status && (
                <p style={{ margin: "10px 0 0", fontSize: 14 }}>{status}</p>
              )}

              {selectedPasses.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 13,
                      color: "#666",
                    }}
                  >
                    Passes for {selected.full_name}
                  </p>
                  {selectedPasses.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: "1px solid #f2f2f2",
                        fontSize: 14,
                      }}
                    >
                      <span>
                        {LABELS[p.pass_type]} · {p.start_date} to {p.end_date} ·{" "}
                        {money(p.amount)}
                      </span>
                      <button
                        onClick={() => removePass(p.id)}
                        style={{
                          ...btn,
                          padding: "4px 10px",
                          fontSize: 13,
                          color: "#a32d2d",
                          borderColor: "#f09595",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import { GRADES } from "../data/constants";
import { isWeekendStr, lastSchoolDayStr } from "../lib/format";
import { StudentThumb } from "../ui/common";

// Attendance over a period (Nov 2026): totals, averages and per-student rates
// between two dates, for staff. Weekends and Hub calendar holidays/breaks are
// never counted. Late counts as attended (the child was in school).

const COLOR = { present: "#2F7A5C", late: "#8A6420", absent: "#B5473B", none: "#D9CBCD" };
const LOW_RATE = 90; // below this a student is flagged

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const shortDate = (s) => parse(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const longDate = (s) => parse(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

// Every date covered by a Holiday event (whole school, or this grade).
function holidaySet(events, grade) {
  const set = new Set();
  (events || []).forEach((e) => {
    if (e.type !== "Holiday" || !e.date) return;
    if (grade && e.grades && e.grades.length > 0 && !e.grades.includes(grade)) return;
    const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
    for (let d = parse(e.date); ymd(d) <= end; d.setDate(d.getDate() + 1)) set.add(ymd(d));
  });
  return set;
}

function schoolDaysBetween(start, end, holidays) {
  const days = [];
  if (!start || !end || start > end) return days;
  for (let d = parse(start); ymd(d) <= end; d.setDate(d.getDate() + 1)) {
    const s = ymd(d);
    if (!isWeekendStr(s) && !holidays.has(s)) days.push(s);
  }
  return days;
}

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const fmtPct = (v) => (v === null ? "–" : `${v % 1 === 0 ? v : v.toFixed(1)}%`);

function AttendanceRange({ data, grades, allowAllGrades, onOpenDay }) {
  const attendance = data.attendance || {};
  const firstDay = useMemo(() => {
    const dates = Object.entries(attendance)
      .filter(([d, day]) => !isWeekendStr(d) && Object.keys(day || {}).length > 0)
      .map(([d]) => d).sort();
    return dates[0] || lastSchoolDayStr();
  }, [attendance]);
  const today = lastSchoolDayStr();

  const presets = useMemo(() => {
    const now = parse(today);
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const list = [{ id: "start", label: "Since we started", from: firstDay, to: today }];
    const term = (data.settings?.terms || []).find((tm) => tm.startDate && tm.endDate && tm.startDate <= today && today <= tm.endDate);
    if (term) list.push({ id: "term", label: term.name || "This term", from: term.startDate, to: today });
    list.push({ id: "month", label: "This month", from: ymd(monthStart), to: today });
    list.push({ id: "week", label: "This week", from: ymd(monday), to: today });
    return list;
  }, [firstDay, today, data.settings]);

  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(today);
  const [grade, setGrade] = useState(allowAllGrades ? "all" : (grades[0] || null));
  const [sortBy, setSortBy] = useState("name");

  const students = useMemo(
    () => data.students.filter((s) => (grade === "all" ? grades.includes(s.grade) : s.grade === grade)),
    [data.students, grade, grades]
  );

  const stats = useMemo(() => {
    const holidays = holidaySet(data.events, grade === "all" ? null : grade);
    const schoolDays = schoolDaysBetween(from, to, holidays);
    const ids = new Set(students.map((s) => s.id));
    const per = {};
    students.forEach((s) => { per[s.id] = { present: 0, late: 0, absent: 0, excused: 0 }; });
    const daily = [];
    schoolDays.forEach((d) => {
      const day = attendance[d] || {};
      const c = { present: 0, late: 0, absent: 0 };
      Object.entries(day).forEach(([sid, st]) => {
        if (!ids.has(sid) || !st) return;
        const p = per[sid];
        if (st === "present") { p.present += 1; c.present += 1; }
        else if (st === "late") { p.late += 1; c.late += 1; }
        else { p.absent += 1; c.absent += 1; if (st === "excused") p.excused += 1; }
      });
      const marked = c.present + c.late + c.absent;
      daily.push({ date: d, ...c, marked });
    });
    const taken = daily.filter((d) => d.marked > 0);
    const tot = taken.reduce((a, d) => ({ present: a.present + d.present, late: a.late + d.late, absent: a.absent + d.absent }), { present: 0, late: 0, absent: 0 });
    const marks = tot.present + tot.late + tot.absent;
    const excused = Object.values(per).reduce((n, p) => n + p.excused, 0);
    const rows = students.map((s) => {
      const p = per[s.id];
      const m = p.present + p.late + p.absent;
      return { s, ...p, marked: m, rate: pct(p.present + p.late, m) };
    });
    return {
      schoolDays, daily, taken,
      tot, marks, excused,
      rate: pct(tot.present + tot.late, marks),
      avgIn: taken.length ? Math.round(((tot.present + tot.late) / taken.length) * 10) / 10 : 0,
      avgAbsent: taken.length ? Math.round((tot.absent / taken.length) * 10) / 10 : 0,
      rows
    };
  }, [attendance, data.events, students, grade, from, to]);

  const rows = useMemo(() => {
    const r = [...stats.rows];
    if (sortBy === "rate") r.sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || a.s.name.localeCompare(b.s.name));
    else if (sortBy === "absent") r.sort((a, b) => b.absent - a.absent || a.s.name.localeCompare(b.s.name));
    else if (sortBy === "late") r.sort((a, b) => b.late - a.late || a.s.name.localeCompare(b.s.name));
    else r.sort((a, b) => (grade === "all" ? GRADES.indexOf(a.s.grade) - GRADES.indexOf(b.s.grade) : 0) || a.s.name.localeCompare(b.s.name));
    return r;
  }, [stats.rows, sortBy, grade]);

  const activePreset = presets.find((p) => p.from === from && p.to === to)?.id;
  const notTaken = stats.schoolDays.length - stats.taken.length;
  const lowCount = stats.rows.filter((r) => r.rate !== null && r.rate < LOW_RATE).length;
  const gradeChoices = allowAllGrades ? ["all", ...grades] : grades;

  return (
    <>
      <section className="bsf-card">
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Period</h2>
        <div className="bsf-chiprow" style={{ marginBottom: 12 }}>
          {presets.map((p) => (
            <button key={p.id} className={`bsf-chip ${activePreset === p.id ? "active" : ""}`} onClick={() => { setFrom(p.from); setTo(p.to); }}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>From
            <input type="date" className="bsf-dateinput" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>To
            <input type="date" className="bsf-dateinput" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
        {gradeChoices.length > 1 && (
          <div className="bsf-chiprow" style={{ marginTop: 14 }}>
            {gradeChoices.map((g) => (
              <button key={g} className={`bsf-chip ${grade === g ? "active" : ""}`} onClick={() => setGrade(g)}>{g === "all" ? "All grades" : g}</button>
            ))}
          </div>
        )}
      </section>

      <section className="bsf-card">
        <p className="bsf-muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
          {longDate(from)} to {longDate(to)} · {grade === "all" ? "All grades" : grade} · {students.length} student{students.length === 1 ? "" : "s"}
        </p>
        <div className="bsf-range-stats">
          <div><strong>{fmtPct(stats.rate)}</strong><span>attendance rate</span></div>
          <div><strong>{stats.avgIn}</strong><span>in school per day, on average</span></div>
          <div><strong>{stats.avgAbsent}</strong><span>absent per day, on average</span></div>
          <div><strong>{stats.taken.length}<small> / {stats.schoolDays.length}</small></strong><span>school days with register taken</span></div>
        </div>
        {stats.marks > 0 && (
          <>
            <div className="bsf-attend-segbar" style={{ marginTop: 16 }}>
              {stats.tot.present > 0 && <span style={{ flex: stats.tot.present, background: COLOR.present }} />}
              {stats.tot.late > 0 && <span style={{ flex: stats.tot.late, background: COLOR.late }} />}
              {stats.tot.absent > 0 && <span style={{ flex: stats.tot.absent, background: COLOR.absent }} />}
            </div>
            <div className="bsf-range-legend">
              <span><i style={{ background: COLOR.present }} />{stats.tot.present} present</span>
              <span><i style={{ background: COLOR.late }} />{stats.tot.late} late</span>
              <span><i style={{ background: COLOR.absent }} />{stats.tot.absent} absent{stats.excused > 0 ? ` (${stats.excused} excused)` : ""}</span>
            </div>
          </>
        )}
        {notTaken > 0 && stats.schoolDays.length > 0 && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: COLOR.absent }}>
            The register was not taken on {notTaken} school day{notTaken === 1 ? "" : "s"} in this period. Those days are left out of the averages.
          </p>
        )}
      </section>

      {stats.daily.length > 0 && (
        <section className="bsf-card">
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>Day by day</h2>
          <p className="bsf-muted" style={{ margin: "0 0 12px", fontSize: 12.5 }}>Each bar is one school day. Tap a bar to open that day's register.</p>
          <div className="bsf-range-days">
            {stats.daily.map((d) => {
              const r = d.marked ? (d.present + d.late) / d.marked : 0;
              return (
                <button key={d.date} title={`${longDate(d.date)}: ${d.marked ? `${d.present + d.late} in, ${d.absent} absent` : "register not taken"}`}
                  onClick={() => onOpenDay && onOpenDay(d.date)}>
                  <span className="bar">
                    {d.marked ? (
                      <span style={{ height: `${Math.max(4, r * 100)}%`, background: COLOR.present }} />
                    ) : <span style={{ height: "100%", background: "transparent", border: `1px dashed ${COLOR.none}` }} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#6B7578", marginTop: 6 }}>
            <span>{shortDate(stats.daily[0].date)}</span>
            <span>{shortDate(stats.daily[stats.daily.length - 1].date)}</span>
          </div>
        </section>
      )}

      <div className="bsf-screen-head" style={{ marginBottom: 0, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 16 }}>By student</h2>
        <div className="bsf-chiprow">
          {[["name", "Name"], ["rate", "Lowest rate"], ["absent", "Most absences"], ["late", "Most lates"]].map(([id, label]) => (
            <button key={id} className={`bsf-chip ${sortBy === id ? "active" : ""}`} onClick={() => setSortBy(id)}>{label}</button>
          ))}
        </div>
      </div>
      <p className="bsf-muted" style={{ margin: "6px 4px 14px", fontSize: 13 }}>
        Rate = days in school (present or late) out of days marked.{lowCount > 0 ? ` ${lowCount} student${lowCount === 1 ? " is" : "s are"} below ${LOW_RATE}%.` : ""}
      </p>

      <section className="bsf-list">
        {rows.length === 0 && <p className="bsf-empty">No students in this grade yet.</p>}
        {rows.map((r) => {
          const low = r.rate !== null && r.rate < LOW_RATE;
          return (
            <div key={r.s.id} className="bsf-card bsf-attend-row" style={{ cursor: "default", alignItems: "center" }}>
              <StudentThumb photo={r.s.photo} />
              <span style={{ minWidth: 0 }}>
                <strong>{r.s.name}</strong>
                <span className="bsf-range-counts">
                  {grade === "all" && <>{r.s.grade} · </>}
                  {r.present} present · {r.late} late · {r.absent} absent{r.excused ? ` (${r.excused} excused)` : ""}
                </span>
              </span>
              <span className="bsf-status-pill" style={{
                background: r.rate === null ? "#EEE6D2" : `${low ? COLOR.absent : COLOR.present}1A`,
                color: r.rate === null ? "#6B7578" : low ? COLOR.absent : COLOR.present,
                minWidth: 62, textAlign: "center"
              }}>{r.rate === null ? "No marks" : fmtPct(r.rate)}</span>
            </div>
          );
        })}
      </section>
    </>
  );
}

export { AttendanceRange };

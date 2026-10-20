import { Component, useState, useEffect } from "react";
import { Users, X } from "lucide-react";
import { getAttachmentUrl } from "../lib/attachments";
import { useLanguage } from "../lib/i18n";
import { GRADES, EVENT_TYPE_COLOR, SHORT_GRADE_LABEL } from "../data/constants";
import { formatEventWhen, tLabel, eventTypeLabel } from "../lib/format";

// One upcoming event: a small date chip, then the title and the dates.
function EventRow({ event: e }) {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const color = EVENT_TYPE_COLOR[e.type] || "#801524";
  const start = new Date(`${e.date}T12:00:00`);
  return (
    <div className="bsf-eventrow">
      <div className="bsf-datechip" style={{ background: `${color}14`, color }}>
        <span className="bsf-datechip-day">{start.getDate()}</span>
        <span className="bsf-datechip-month">{start.toLocaleDateString(locale, { month: "short" }).replace(".", "")}</span>
      </div>
      <div className="bsf-eventrow-text">
        <strong>{e.title}</strong>
        <p>{formatEventWhen(e, language)}<span className="bsf-eventrow-type" style={{ color }}> · {eventTypeLabel(t, e)}</span></p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="bsf-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="bsf-modal-backdrop" onClick={onClose}>
      <div className="bsf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bsf-modal-head">
          <h3>{title}</h3>
          <button className="bsf-iconbtn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="bsf-modal-body">{children}</div>
      </div>
    </div>
  );
}

function GradeLadder({ counts, activeGrade, onSelect }) {
  const max = Math.max(1, ...GRADES.map((g) => counts[g] || 0));
  return (
    <div className="bsf-ladder">
      {GRADES.map((g, i) => {
        const count = counts[g] || 0;
        const width = 24 + (count / max) * 76;
        const active = activeGrade === g;
        return (
          <button
            key={g}
            className={`bsf-rung ${active ? "active" : ""}`}
            onClick={() => onSelect(active ? null : g)}
          >
            <span className="bsf-rung-label">{g}</span>
            <span className="bsf-rung-track">
              <span className="bsf-rung-fill" style={{ width: `${width}%` }} />
            </span>
            <span className="bsf-rung-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function EnrollmentStairs({ counts, activeGrade = null, onSelect = null }) {
  const max = Math.max(1, ...GRADES.map((g) => counts[g] || 0));
  const interactive = !!onSelect;
  return (
    <div className="bsf-stairs">
      {GRADES.map((g) => {
        const count = counts[g] || 0;
        const heightPct = count === 0 ? 6 : 18 + (count / max) * 82;
        const isActive = activeGrade === g;
        const Tag = interactive ? "button" : "div";
        return (
          <Tag
            key={g}
            type={interactive ? "button" : undefined}
            className={`bsf-stair ${interactive ? "bsf-stair-interactive" : ""} ${isActive ? "active" : ""}`}
            onClick={interactive ? () => onSelect(isActive ? null : g) : undefined}
          >
            <span className="bsf-stair-count">{count > 0 ? count : ""}</span>
            <span className="bsf-stair-bar" style={{ height: `${heightPct}%` }} />
            <span className="bsf-stair-label">{SHORT_GRADE_LABEL[g] || g}</span>
          </Tag>
        );
      })}
    </div>
  );
}

function AvatarStack({ students }) {
  if (!students.length) return null;
  return (
    <div className="bsf-avatar-stack">
      {students.slice(0, 6).map((s, i) => (
        <div key={s.id} className="bsf-avatar-stack-item" style={{ zIndex: 10 - i }}>
          <StudentThumb photo={s.photo} />
        </div>
      ))}
      {students.length > 6 && <div className="bsf-avatar-stack-more">+{students.length - 6}</div>}
    </div>
  );
}

// If one screen hits an error, only that screen shows a message; the rest of
// the Hub (top bar, menu, other tabs) keeps working.
class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error, info) {
    console.error("Screen error", error, info);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const fr = this.props.language === "fr";
    return (
      <div className="bsf-screen">
        <section className="bsf-card">
          <h2>{fr ? "Cette page n'a pas pu s'afficher" : "This page could not be shown"}</h2>
          <p className="bsf-muted">
            {fr
              ? "Un problème est survenu. Rechargez la page ou ouvrez une autre section."
              : "Something went wrong. Reload the page or open another section."}
          </p>
          <button className="bsf-btn" onClick={() => window.location.reload()}>{fr ? "Recharger" : "Reload"}</button>
        </section>
      </div>
    );
  }
}

function SignaturePad({ onChange }) {
  const { t } = useLanguage();
  const [typed, setTyped] = useState("");

  const handle = (value) => {
    setTyped(value);
    if (onChange) onChange(value.trim());
  };

  return (
    <div>
      <input
        value={typed}
        onChange={(e) => handle(e.target.value)}
        placeholder={t("sign.padPlaceholder")}
        style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 22,
          padding: "14px 12px",
          width: "100%",
          border: "1px solid #EAD7DA",
          borderRadius: 12,
          background: "#FCFAF4",
          color: "#241012"
        }}
      />
      <p className="bsf-muted" style={{ marginTop: 6 }}>
        {t("sign.padHelp")}
      </p>
    </div>
  );
}

function StudentThumb({ photo }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (!photo || !photo.path) { setUrl(""); return; }
    getAttachmentUrl(photo.path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [photo && photo.path]);
  return (
    <div className="bsf-student-thumb">
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <Users size={18} />}
    </div>
  );
}

export { EventRow, Field, Modal, EnrollmentStairs, AvatarStack, TabErrorBoundary, SignaturePad, StudentThumb, GradeLadder };

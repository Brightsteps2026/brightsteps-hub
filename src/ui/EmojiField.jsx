// A text box (or one-line input) with an "Emojis & shapes" button.
// Used for Family Updates and School Announcements so staff can add emojis, symbols,
// bullets and ready-made divider lines without copy-pasting from elsewhere.
// Everything inserted is plain text (Unicode), so it shows the same in the Hub,
// in emails and on phones, and LinkedText still renders it safely as text.

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { COLORS, RADIUS } from "./tokens";

const GROUPS = [
  {
    id: "school",
    label: "School",
    items: ["📚", "📖", "✏️", "📝", "🎒", "🏫", "🧑‍🏫", "👩‍🏫", "👨‍🏫", "🧒", "👧", "👦", "👨‍👩‍👧", "🎓", "🔬", "🧪", "🔭", "🧮", "💻", "🌍", "🗺️", "🖍️", "📐", "📏", "🧠", "💡", "🏆", "🥇", "🎖️", "📢", "📣", "🔔"]
  },
  {
    id: "dates",
    label: "Dates & reminders",
    items: ["📅", "🗓️", "⏰", "🕗", "⌛", "📌", "📍", "📎", "🔖", "✅", "☑️", "❗", "❕", "⚠️", "🚫", "❓", "ℹ️", "📩", "✉️", "📞", "📲", "💳", "💰", "🧾", "🚌", "🚸", "🏥", "🩹", "😷", "🧴"]
  },
  {
    id: "celebrate",
    label: "Celebrate",
    items: ["🎉", "🎊", "🥳", "🎈", "🎂", "🎁", "🌟", "⭐", "✨", "💫", "👏", "🙌", "👍", "💪", "🤝", "🙏", "❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "😊", "😀", "😃", "🤩", "😍", "🥰", "🤗", "😎", "🌈"]
  },
  {
    id: "activities",
    label: "Sport, arts & food",
    items: ["⚽", "🏀", "🏐", "🏊", "🏃", "🤸", "🎾", "🏓", "🎨", "🖌️", "🎭", "🎵", "🎶", "🎤", "🎹", "🥁", "🎸", "📸", "🎬", "🍎", "🍌", "🥭", "🍍", "🥗", "🍽️", "🥤", "💧", "🧃", "🌴", "🌞", "🌧️", "🌱"]
  },
  {
    id: "seasons",
    label: "Seasons & holidays",
    items: ["🎄", "🎅", "⛄", "❄️", "🕯️", "🔔", "🎆", "🎇", "🐣", "🌸", "🌺", "🌻", "🍂", "🎃", "🕌", "⛪", "🌙", "☪️", "✝️", "🇨🇮", "🏖️", "✈️", "🧳", "🌅"]
  },
  {
    id: "shapes",
    label: "Shapes & symbols",
    items: ["●", "○", "◆", "◇", "■", "□", "▪", "▫", "▲", "△", "▶", "►", "▸", "➤", "➜", "→", "⇒", "←", "↓", "↑", "★", "☆", "✦", "✧", "❖", "✿", "❀", "❁", "♥", "♡", "✓", "✔", "✗", "✘", "•", "◦", "‣", "※", "§", "№", "©", "®", "™", "°", "½", "€"]
  },
  {
    id: "colors",
    label: "Coloured shapes",
    items: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜", "🔶", "🔷", "🔸", "🔹", "🔺", "🔻", "💠", "🔘"]
  },
  {
    id: "lines",
    label: "Lines & headings",
    // Each line is inserted on its own line.
    lines: [
      "────────────────",
      "━━━━━━━━━━━━━━━━",
      "═══════════════",
      "• • • • • • • • • •",
      "✦ ─────── ✦ ─────── ✦",
      "★ ☆ ★ ☆ ★ ☆ ★",
      "🌟 ✨ 🌟 ✨ 🌟",
      "📅 Dates to remember",
      "📅 Dates à retenir",
      "📌 Reminders",
      "📌 Rappels",
      "🎉 Celebrations",
      "🎉 Célébrations",
      "📚 What we are learning",
      "📚 Ce que nous apprenons",
      "🙏 Thank you",
      "🙏 Merci",
      "▸ ",
      "✔ ",
      "➤ "
    ]
  }
];

function EmojiField({ as = "textarea", value, onChange, rows = 8, style, ...rest }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(GROUPS[0].id);
  const fieldRef = useRef(null);
  const wrapRef = useRef(null);
  // Remember where the cursor was, since clicking the panel takes focus away.
  const caret = useRef({ start: null, end: null });

  const rememberCaret = () => {
    const el = fieldRef.current;
    if (el) caret.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const insert = (text, asLine = false) => {
    const current = String(value ?? "");
    const start = caret.current.start ?? current.length;
    const end = caret.current.end ?? current.length;
    let piece = text;
    if (asLine && as === "textarea") {
      // Put headings and divider lines on their own line.
      const before = current.slice(0, start);
      if (before && !before.endsWith("\n")) piece = "\n" + piece;
      if (!text.endsWith(" ")) piece += "\n";
    }
    const next = current.slice(0, start) + piece + current.slice(end);
    onChange(next);
    const pos = start + piece.length;
    caret.current = { start: pos, end: pos };
    requestAnimationFrame(() => {
      const el = fieldRef.current;
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(pos, pos); } catch { /* some inputs do not support it */ }
    });
  };

  const Tag = as === "input" ? "input" : "textarea";
  const active = GROUPS.find((g) => g.id === group) || GROUPS[0];

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", ...(style?.marginBottom != null ? { marginBottom: style.marginBottom } : {}) }}>
      <Tag
        ref={fieldRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); caret.current = { start: e.target.selectionStart, end: e.target.selectionEnd }; }}
        onSelect={rememberCaret}
        onKeyUp={rememberCaret}
        onClick={rememberCaret}
        {...(Tag === "textarea" ? { rows } : {})}
        style={{ width: "100%", ...style, marginBottom: 0, paddingRight: Tag === "input" ? 40 : undefined }}
        {...rest}
      />
      {Tag === "input" ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="Add emojis and shapes"
          title="Emojis & shapes"
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: COLORS.brand, padding: 4, display: "flex" }}
        >
          <Smile size={18} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, background: COLORS.tint, color: COLORS.brand, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.pill, padding: "5px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          <Smile size={15} /> Emojis &amp; shapes
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Emojis and shapes"
          style={{ position: "absolute", zIndex: 50, left: 0, right: 0, top: "100%", marginTop: 6, background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.md, boxShadow: "0 10px 30px rgba(36,16,18,0.14)", padding: 10, maxWidth: 440 }}
        >
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${COLORS.line}` }}>
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                style={{ flex: "0 0 auto", border: `1px solid ${g.id === group ? COLORS.brand : COLORS.line}`, background: g.id === group ? COLORS.brand : COLORS.surface, color: g.id === group ? "#fff" : COLORS.text2, borderRadius: RADIUS.pill, padding: "4px 10px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {g.label}
              </button>
            ))}
          </div>

          {active.lines ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
              {active.lines.map((line) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => insert(line, true)}
                  style={{ textAlign: "left", background: COLORS.surface2, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.sm, padding: "6px 10px", fontSize: 14, cursor: "pointer", color: COLORS.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {line.endsWith(" ") ? `${line.trim()}  new bullet point` : line}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))", gap: 4, maxHeight: 220, overflowY: "auto" }}>
              {active.items.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => insert(ch)}
                  title={ch}
                  style={{ height: 38, fontSize: 22, lineHeight: 1, background: "none", border: "1px solid transparent", borderRadius: RADIUS.sm, cursor: "pointer", color: COLORS.ink }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.tint; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: COLORS.faint, margin: "8px 0 0" }}>Tap to add at the cursor. You can tap several in a row.</p>
        </div>
      )}
    </div>
  );
}

export default EmojiField;
export { EmojiField };

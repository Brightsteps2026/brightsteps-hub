// Shared design tokens for BrightSteps Hub screens.
// Import from "./ui/tokens" instead of redefining colours and styles per file.

export const COLORS = {
  brand: "#801524",
  brand2: "#A02E3B",
  ink: "#241012",
  text2: "#3B4A4C",
  muted: "#5F6B6D", // readable grey for secondary text
  faint: "#6B7578", // small labels, hints
  bg: "#FBF7F3",
  surface: "#FFFFFF",
  surface2: "#FCFAF4", // input background
  tint: "#F5E4E6",
  line: "#EAD7DA",
  accent: "#8A6A2E",
  ok: "#2F7A5C",
  okBg: "#E6F2EC",
  warn: "#8A6420",
  warnBg: "#FBF0DC",
  bad: "#B23A3A",
  badBg: "#FCE8E8",
  info: "#2F5E8A",
  infoBg: "#E4EDF7",
  neutralBg: "#F1EFEF"
};

export const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 };
export const FONT = { xs: 12, sm: 13, md: 14, lg: 16, xl: 22 };

// Status tones: { bg, fg } pairs for badges, notices and hint boxes.
export const TONES = {
  ok: { bg: COLORS.okBg, fg: COLORS.ok },
  warn: { bg: COLORS.warnBg, fg: COLORS.warn },
  bad: { bg: COLORS.badBg, fg: COLORS.bad },
  info: { bg: COLORS.infoBg, fg: COLORS.info },
  brand: { bg: COLORS.tint, fg: COLORS.brand },
  neutral: { bg: COLORS.neutralBg, fg: COLORS.muted }
};

export const card = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.line}`,
  borderRadius: RADIUS.lg,
  padding: 16,
  boxShadow: "0 1px 3px rgba(36,16,18,0.06)"
};

export const input = {
  width: "100%",
  minHeight: 40,
  padding: "9px 10px",
  border: `1px solid ${COLORS.line}`,
  borderRadius: RADIUS.sm,
  fontSize: FONT.md,
  background: COLORS.surface2,
  boxSizing: "border-box",
  fontFamily: "inherit"
};

export const label = { display: "block", fontSize: FONT.sm, color: COLORS.muted, margin: "12px 0 5px" };

export const muted = { fontSize: FONT.sm, color: COLORS.muted };

export const chip = {
  minHeight: 36,
  border: `1px solid ${COLORS.line}`,
  borderRadius: RADIUS.pill,
  padding: "7px 13px",
  background: COLORS.surface,
  cursor: "pointer",
  fontSize: FONT.sm,
  fontWeight: 600,
  color: COLORS.text2,
  fontFamily: "inherit"
};

export const chipOn = { ...chip, background: COLORS.brand, borderColor: COLORS.brand, color: "#fff" };

export const primaryBtn = {
  minHeight: 40,
  background: COLORS.brand,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  fontSize: FONT.md,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit"
};

export const ghostBtn = {
  minHeight: 40,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 10,
  padding: "9px 14px",
  background: COLORS.surface,
  cursor: "pointer",
  fontSize: FONT.sm,
  fontWeight: 600,
  color: COLORS.text2,
  fontFamily: "inherit"
};

// Status badge. `tone` is a key of TONES ("ok" | "warn" | "bad" | "info" | "brand" | "neutral")
// or a { bg, fg } pair.
export function pill(tone = "neutral") {
  const t = typeof tone === "string" ? TONES[tone] || TONES.neutral : tone || TONES.neutral;
  return {
    display: "inline-block",
    fontSize: FONT.xs,
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: RADIUS.pill,
    background: t.bg,
    color: t.fg,
    whiteSpace: "nowrap"
  };
}

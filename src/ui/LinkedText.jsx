// Shows a block of plain text (announcements, family updates) with every web link and
// email address turned into a tappable link. The text itself is still rendered as text,
// never as HTML, so nothing a post contains can inject markup.
//
//   https://forms.gle/abc      -> opens in a new tab
//   www.bischoolci.org         -> opens https://www.bischoolci.org in a new tab
//   clubs@bischoolci.org       -> opens the mail app (mailto:)

const TOKEN = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
// Punctuation that usually ends a sentence rather than the link itself.
const TRAILING = /[.,;:!?)\]'"»]+$/;

function splitLinks(text) {
  const parts = [];
  const source = String(text ?? "");
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    let raw = match[0];
    const trail = raw.match(TRAILING);
    // Keep a closing bracket that belongs to the link, e.g. a Wikipedia "(…)" address.
    let tail = trail ? trail[0] : "";
    if (tail.startsWith(")") && raw.includes("(")) tail = tail.slice(1);
    if (tail) raw = raw.slice(0, raw.length - tail.length);
    if (!raw) continue;
    const start = match.index;
    if (start > last) parts.push({ text: source.slice(last, start) });
    const isEmail = !/^(https?:\/\/|www\.)/i.test(raw);
    const href = isEmail ? `mailto:${raw}` : /^www\./i.test(raw) ? `https://${raw}` : raw;
    parts.push({ text: raw, href, isEmail });
    last = start + raw.length;
  }
  if (last < source.length) parts.push({ text: source.slice(last) });
  return parts;
}

function LinkedText({ text, as: Tag = "p", style, className }) {
  const parts = splitLinks(text);
  return (
    <Tag className={className} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>
      {parts.map((p, i) =>
        p.href ? (
          <a
            key={i}
            href={p.href}
            className="bsf-textlink"
            {...(p.isEmail ? {} : { target: "_blank", rel: "noopener noreferrer" })}
          >
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </Tag>
  );
}

export { LinkedText, splitLinks };

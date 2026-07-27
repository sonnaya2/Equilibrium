/**
 * Allowlist HTML sanitizer for RuneScape Wiki article fragments.
 * Server-side only path: sanitize before HTML lands in API responses.
 * Never trust wiki HTML merely because the host is runescape.wiki.
 */

import sanitizeHtml from "sanitize-html";

/** Local constants — do not import wikiArticle (circular: wikiArticle imports this). */
const WIKI_HOST = "runescape.wiki";
const WIKI_ORIGIN = `https://${WIKI_HOST}`;

/** Prose + table tags needed for wiki article lead/body/drop HTML fallbacks. */
const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "div",
  "span",
  "section",
  "article",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "del",
  "ins",
  "sub",
  "sup",
  "small",
  "abbr",
  "cite",
  "code",
  "pre",
  "blockquote",
  "q",
  "mark",
  "wbr",
] as const;

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title", "rel", "target"],
  th: ["colspan", "rowspan", "scope"],
  td: ["colspan", "rowspan"],
  col: ["span"],
  colgroup: ["span"],
  // class is used by wiki wikitables; strip inline style / events via global deny.
  "*": ["class", "id", "lang", "dir"],
};

const FORBIDDEN_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "noscript",
  "svg",
  "math",
  "video",
  "audio",
  "source",
  "track",
  "canvas",
  "img",
  "picture",
  "map",
  "area",
  "link",
  "meta",
  "base",
  "template",
  "slot",
];

function isSafeHttpsUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.startsWith("#")) return true; // fragment-only anchors ok
  if (/^mailto:/i.test(value) || /^data:/i.test(value) || /^javascript:/i.test(value)) {
    return false;
  }
  try {
    let href = value;
    if (href.startsWith("//")) href = `https:${href}`;
    else if (href.startsWith("/")) href = `${WIKI_ORIGIN}${href}`;
    const u = new URL(href);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function absolutizeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("#")) return value;
  try {
    let href = value;
    if (href.startsWith("//")) href = `https:${href}`;
    else if (href.startsWith("/w/") || href.startsWith("/wiki/")) {
      href = `${WIKI_ORIGIN}${href.replace(/^\/wiki\//, "/w/")}`;
    } else if (href.startsWith("/")) {
      href = `${WIKI_ORIGIN}${href}`;
    }
    const u = new URL(href);
    if (u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize wiki article HTML for safe `dangerouslySetInnerHTML` use.
 * Strips scripts, styles, media, forms, SVG/MathML, event handlers, inline styles,
 * and non-https links. External https links get rel=noreferrer noopener + target=_blank.
 */
export function sanitizeWikiHtml(dirty: string): string {
  if (!dirty || typeof dirty !== "string") return "";

  return sanitizeHtml(dirty, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: ALLOWED_ATTRIBUTES,
    disallowedTagsMode: "discard",
    // Drop everything not on the allowlist — including unknown tags.
    nonTextTags: ["script", "style", "textarea", "option", "noscript"],
    // No inline styles, no data-* event smuggling.
    allowVulnerableTags: false,
    allowedSchemes: ["https"],
    allowedSchemesByTag: {
      a: ["https"],
    },
    allowedSchemesAppliedToAttributes: ["href"],
    allowProtocolRelative: false,
    // Enforce attribute policy even if a transform adds attributes.
    parseStyleAttributes: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ? absolutizeHref(attribs.href) : null;
        if (!href || !isSafeHttpsUrl(href)) {
          // Drop the link but keep text content (unwrap).
          return {
            tagName: "span",
            attribs: {},
          };
        }
        const next: Record<string, string> = {
          href,
          rel: "noreferrer noopener",
        };
        if (attribs.title) next.title = attribs.title;
        // External (or any absolute) links open safely in a new tab.
        try {
          const host = new URL(href).hostname;
          if (host !== WIKI_HOST && host !== `www.${WIKI_HOST}`) {
            next.target = "_blank";
          } else {
            next.target = "_blank";
          }
        } catch {
          next.target = "_blank";
        }
        return { tagName, attribs: next };
      },
    },
    exclusiveFilter(frame) {
      const tag = frame.tag?.toLowerCase() ?? "";
      if (FORBIDDEN_TAGS.includes(tag)) return true;
      // Strip any element that still carries an event handler or style.
      const attrs = frame.attribs ?? {};
      for (const key of Object.keys(attrs)) {
        const lower = key.toLowerCase();
        if (lower.startsWith("on")) return true;
        if (lower === "style") return true;
        if (lower === "srcdoc") return true;
        if (lower === "formaction") return true;
        if (lower === "xlink:href") return true;
      }
      return false;
    },
  });
}

/** Policy snapshot for tests / docs — not used at runtime for decisions. */
export const WIKI_HTML_SANITIZE_POLICY = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  forbiddenTags: FORBIDDEN_TAGS,
  linkSchemes: ["https"] as const,
  linkRel: "noreferrer noopener",
} as const;

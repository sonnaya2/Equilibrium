/**
 * Live wiki article helpers for /data — page resolution + HTML cleanup.
 * No wiki images. Pure (no React). Server route and client dialog both use the view shape.
 */

import { safeExternalHref } from "./safeHref";

export const WIKI_HOST = "runescape.wiki";
export const WIKI_ORIGIN = `https://${WIKI_HOST}`;
export const WIKI_USER_AGENT =
  "Equilibrium/0.1 RuneScape fan tool (github.com/sonnaya2/Equilibrium)";

const LEAD_MAX = 520;
const BODY_HTML_MAX = 48_000;
const DROPS_HTML_MAX = 32_000;
const DROP_ROW_CAP = 80;

const DROP_HEADING =
  /\b(?:drops?|loot|100\s*%\s*drops?|always\s+drops?|main\s+drops?|tertiary|rare\s+drop\s+table|unique\s+drops?)\b/i;

/** Prefer these when ordering structured drop rows (unique/main first). */
const PREFERRED_DROP_HEADING =
  /\b(?:unique\s+drops?|main\s+drops?|100\s*%\s*drops?|always\s+drops?)\b/i;

const DROP_TABLE_HINT =
  /\b(?:rarity|quantity|ge\s*price|ge\s*market|drop\s*rate|rarity\s*tier)\b/i;

const ITEM_HEADER = /^(?:item|name)s?$/i;
const QTY_HEADER = /^(?:quantity|qty|amount)s?$/i;
const RARITY_HEADER = /^(?:rarity|rate|chance|drop\s*rate)s?$/i;

/** Whole sections removed (heading + content). */
const STRIP_SECTION_HEADING =
  /\b(?:strategy|tactics|gallery|trivia|history|update\s+history|references?|external\s+links?|see\s+also|transcript|dialogue|music|sounds?|graphical\s+updates?|concepts?|development|achievements?|hard\s+mode|normal\s+mode|money\s*making(?:\s+guide)?|boss\s*pet|boss\s*log|senntisten\s+achievements?|pets?|titles?|music\s+tracks?|points?\s+of\s+interest|monsters?|mobs?|bosses|minibosses?|map|lore|credits?|spotlight|getting\s+there)\b/i;

// Whole-cell header labels only (never match "Item 12" data rows).
const ITEM_HEADER_LOOSE = /^(?:items?|names?|drops?|loot)$/i;
const QTY_HEADER_LOOSE = /^(?:quantity|qty|amount|number|#)$/i;
const RARITY_HEADER_LOOSE = /^(?:rarity|rate|chance|drop\s*rate|frequency)$/i;
const IMAGE_HEADER = /^(?:image|icon|pic(?:ture)?|img)?$/i;

export type WikiFact = { label: string; value: string };

export type WikiDropRow = {
  item: string;
  quantity: string;
  rarity: string;
  /**
   * Live wiki inventory icon (https://runescape.wiki/… or protocol-relative made absolute).
   * Harvested from the drop table image column / cell img — not a local /game path.
   */
  iconUrl?: string | null;
};

export type WikiArticleView = {
  title: string;
  pageUrl: string;
  leadHtml: string;
  facts: WikiFact[];
  /** Structured drop rows (primary). Parsed from wikitables in drop sections. */
  drops: WikiDropRow[];
  /** Fallback HTML blob of drop sections (image-free). */
  dropsHtml: string;
  bodyHtml: string;
  hasDrops: boolean;
};

export type SafeWikiPage = {
  pageTitle: string;
  pageUrl: string;
};

/** Accept only https://runescape.wiki/w/… article URLs. */
export function safeWikiPage(url: unknown): SafeWikiPage | null {
  const href = safeExternalHref(url);
  if (!href) return null;
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return null;
  }
  if (parsed.hostname !== WIKI_HOST && parsed.hostname !== `www.${WIKI_HOST}`) {
    return null;
  }
  const match = parsed.pathname.match(/^\/w\/([^#]+)$/);
  if (!match?.[1]) return null;
  let pageTitle: string;
  try {
    pageTitle = decodeURIComponent(match[1].replace(/_/g, " "));
  } catch {
    return null;
  }
  pageTitle = pageTitle.replace(/\+/g, " ").trim();
  if (!pageTitle) return null;
  // Main + a few content namespaces only; never Special/File media.
  if (/^(?:Special|File|Image|Media|User|Help|MediaWiki):/i.test(pageTitle)) {
    return null;
  }

  const encoded = pageTitle
    .split("/")
    .map((part) => encodeURIComponent(part.replace(/ /g, "_")))
    .join("/");
  return {
    pageTitle,
    pageUrl: `${WIKI_ORIGIN}/w/${encoded}`,
  };
}

export function wikiParseApiUrl(pageTitle: string): string {
  const params = new URLSearchParams({
    action: "parse",
    page: pageTitle,
    prop: "text|displaytitle",
    format: "json",
    formatversion: "2",
    disableeditsection: "1",
    redirects: "1",
  });
  return `${WIKI_ORIGIN}/api.php?${params.toString()}`;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCodePoint(Number.parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCodePoint(Number.parseInt(n, 10)),
    );
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function clampHtml(html: string, max: number): string {
  if (html.length <= max) return html;
  return `${html.slice(0, max)}…`;
}

/** Keep wiki drop icons for harvest; still kill script/iframe/etc. */
export function stripWikiChromeKeepImages(html: string): string {
  let out = html;
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(
    /<(?:script|style|iframe|object|embed|form|input|button|textarea|select|noscript|svg|math|video|audio|map|area|link|meta)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|form|textarea|select|noscript|svg|math|video|audio)>/gi,
    "",
  );
  out = out.replace(
    /<(?:script|style|iframe|object|embed|form|input|button|textarea|select|noscript|svg|math|video|audio|map|area|link|meta|br)\b[^>]*\/?>/gi,
    "",
  );
  out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\shref\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, ' href="#"');
  return out.trim();
}

/** Absolute https URL for a wiki image src, or null. */
export function absolutizeWikiIconUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  const raw = src.trim();
  if (!raw || raw.startsWith("data:")) return null;
  try {
    let href = raw;
    if (href.startsWith("//")) href = `https:${href}`;
    else if (href.startsWith("/")) href = `${WIKI_ORIGIN}${href}`;
    const u = new URL(href);
    if (u.protocol !== "https:") return null;
    // RS wiki media only — never random hosts.
    if (
      u.hostname !== WIKI_HOST &&
      u.hostname !== `www.${WIKI_HOST}` &&
      !u.hostname.endsWith(".runescape.wiki")
    ) {
      return null;
    }
    return u.href;
  } catch {
    return null;
  }
}

/** First inventory-looking img in a table cell. Prefers larger non-1px assets. */
export function extractWikiIconFromCell(cellHtml: string): string | null {
  if (!cellHtml) return null;
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  let fallback: string | null = null;
  while ((m = re.exec(cellHtml)) !== null) {
    const abs = absolutizeWikiIconUrl(m[1]);
    if (!abs) continue;
    // Skip spacer / tracking pixels when a better candidate exists.
    const isTiny =
      /\b(?:width|height)=["']?1["']?/i.test(m[0]) ||
      /\/1px-/i.test(abs);
    if (isTiny) {
      fallback = fallback ?? abs;
      continue;
    }
    return abs;
  }
  return fallback;
}

/** Remove scripts, images, forms, and wiki chrome blocks. */
export function stripWikiChrome(html: string): string {
  let out = html;
  // Comments
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // Dangerous / non-content elements (including images — body/lead stay image-free)
  out = out.replace(
    /<(?:script|style|iframe|object|embed|form|input|button|textarea|select|noscript|svg|math|img|picture|source|video|audio|map|area|link|meta)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|form|textarea|select|noscript|svg|math|picture|video|audio)>/gi,
    "",
  );
  out = out.replace(
    /<(?:script|style|iframe|object|embed|form|input|button|textarea|select|noscript|svg|math|img|picture|source|video|audio|map|area|link|meta|br)\b[^>]*\/?>/gi,
    "",
  );
  // Wiki chrome by class/id
  const chromeClass =
    /(?:mw-editsection|mw-empty-elt|navbox|navbox-styles|vertical-navbox|catlinks|printfooter|toc|toctoggle|toclevel|mw-indicators|reference|references|reflist|noprint|metadata|navbox-inner|portal|sistersitebox|ambox|tmbox|ombox|cmbox|fmbox|imbox|hatnote|dablink|rellink|mainpage_|thumbinner|magnify|filehistory|fileinfotpl|licensetpl|navigation-not-searchable|mw-heading\s+mw-heading[1-6][^"]*noprint)/i;

  // Repeatedly strip class-marked blocks (nested-safe enough for wiki chrome)
  for (let i = 0; i < 8; i++) {
    const before = out;
    out = out.replace(
      /<([a-z][a-z0-9]*)\b[^>]*\bclass="[^"]*(?:navbox|catlinks|printfooter|toc|mw-editsection|references|reflist|hatnote|dablink|sistersitebox|portal|thumb|gallery|navbox-styles|mw-indicators|metadata|noprint)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    );
    out = out.replace(
      /<([a-z][a-z0-9]*)\b[^>]*\bid="(?:toc|catlinks|footer-info|footer-places|footer-icons)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    );
    if (out === before) break;
  }

  // Edit / citation brackets left as text
  out = out.replace(/\[(?:edit|citation needed|source|note\s*\d*)\]/gi, "");
  // Reference superscripts like [1]
  out = out.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "");
  // Event handlers + javascript hrefs
  out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/\shref\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, ' href="#"');
  // Empty anchors used as fragment junk
  out = out.replace(/<a\b[^>]*>\s*<\/a>/gi, "");
  // Collapse whitespace between tags lightly
  out = out.replace(/\n{3,}/g, "\n\n");
  void chromeClass;
  return out.trim();
}

type Section = { heading: string; level: number; html: string };

function extractSections(html: string): { lead: string; sections: Section[] } {
  const headingRe = /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const sections: Section[] = [];
  let lead = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const matches: { index: number; end: number; level: number; heading: string }[] = [];

  while ((match = headingRe.exec(html)) !== null) {
    matches.push({
      index: match.index,
      end: match.index + match[0].length,
      level: Number(match[1]),
      heading: stripTags(match[2]),
    });
  }

  if (!matches.length) {
    return { lead: html, sections: [] };
  }

  lead = html.slice(0, matches[0].index);
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    sections.push({
      heading: matches[i].heading,
      level: matches[i].level,
      html: html.slice(start, end).trim(),
    });
    lastIndex = end;
  }
  void lastIndex;
  return { lead, sections };
}

function isDropSection(section: Section): boolean {
  if (DROP_HEADING.test(section.heading)) return true;
  if (DROP_TABLE_HINT.test(section.html) && /<table\b/i.test(section.html)) return true;
  return false;
}

function isPreferredDropSection(section: Section): boolean {
  return PREFERRED_DROP_HEADING.test(section.heading);
}

function isStripSection(section: Section): boolean {
  return STRIP_SECTION_HEADING.test(section.heading);
}

function classifyDropHeader(text: string): "item" | "quantity" | "rarity" | "image" | null {
  const t = text.trim();
  // Empty / image headers = glyph column after stripWikiChrome.
  if (!t || IMAGE_HEADER.test(t)) return "image";
  if (QTY_HEADER.test(t) || QTY_HEADER_LOOSE.test(t)) return "quantity";
  if (RARITY_HEADER.test(t) || RARITY_HEADER_LOOSE.test(t)) return "rarity";
  if (
    ITEM_HEADER.test(t) ||
    (ITEM_HEADER_LOOSE.test(t) && !QTY_HEADER_LOOSE.test(t) && !RARITY_HEADER_LOOSE.test(t))
  ) {
    return "item";
  }
  return null;
}

type DropColMap = { item: number; quantity: number; rarity: number };

function mapDropHeaders(cells: string[]): DropColMap | null {
  let item = -1;
  let quantity = -1;
  let rarity = -1;
  for (let i = 0; i < cells.length; i++) {
    const kind = classifyDropHeader(cells[i] ?? "");
    if (kind === "item" && item < 0) item = i;
    else if (kind === "quantity" && quantity < 0) quantity = i;
    else if (kind === "rarity" && rarity < 0) rarity = i;
  }
  if (item < 0) return null;
  return { item, quantity, rarity };
}

/** Prefer wiki link text / title over full cell text (drops often wrap icon+link). */
function cellItemText(cellHtml: string): string {
  const title = cellHtml.match(/\btitle="([^"]+)"/i)?.[1];
  if (title) {
    const t = decodeEntities(title).replace(/\s+/g, " ").trim();
    if (t && !/^(?:file|image):/i.test(t) && t.length < 80) return cleanDropItemName(t);
  }
  const anchor = cellHtml.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
  if (anchor) {
    const t = stripTags(anchor);
    if (t) return cleanDropItemName(t);
  }
  return cleanDropItemName(stripTags(cellHtml));
}

/** Strip wiki drop-cell junk so local icon resolve can hit. */
export function cleanDropItemName(raw: string): string {
  return decodeEntities(raw)
    .replace(/\u00a0/g, " ")
    .replace(/\[(?:edit|citation needed)\]/gi, "")
    .replace(/\s*\((?:noted|item|drop|untradeable|tradeable)\)\s*/gi, " ")
    .replace(/\s+noted\b/gi, "")
    .replace(/\s*[·•]\s*.*$/, "") // trailing meta after bullet
    .replace(/\s{2,}/g, " ")
    .trim();
}

function rowCellHtmls(rowInner: string): string[] {
  const cells: string[] = [];
  const re = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rowInner)) !== null) {
    cells.push(m[1]);
  }
  return cells;
}

/**
 * Parse wikitable drop rows from HTML. Header match: Item|Name,
 * Quantity|Qty, Rarity|Rate|Chance. Caps at 80 unique rows.
 */
export function extractDropRows(html: string): WikiDropRow[] {
  const rows: WikiDropRow[] = [];
  const seen = new Set<string>();
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];

  for (const table of tables) {
    if (rows.length >= DROP_ROW_CAP) break;
    const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let tr: RegExpExecArray | null;
    let cols: DropColMap | null = null;

    while ((tr = trRe.exec(table)) !== null) {
      if (rows.length >= DROP_ROW_CAP) break;
      const cellHtmls = rowCellHtmls(tr[1]);
      if (!cellHtmls.length) continue;
      const texts = cellHtmls.map((c) => stripTags(c));

      if (!cols) {
        const mapped = mapDropHeaders(texts);
        if (mapped) {
          cols = mapped;
          continue;
        }
        // No usable headers — skip until we see one (don't invent combat-stat tables).
        continue;
      }

      // Secondary header row (sub-table / repeated headers)
      const remapped = mapDropHeaders(texts);
      if (remapped) {
        cols = remapped;
        continue;
      }

      const item = cellItemText(cellHtmls[cols.item] ?? "");
      if (!item) continue;
      // Skip rows that restate headers or look like pure rarity tokens.
      if (classifyDropHeader(item) && classifyDropHeader(item) !== "image") continue;
      if (/^(?:always|common|uncommon|rare|very rare|varies)$/i.test(item)) continue;

      const quantity =
        cols.quantity >= 0
          ? cleanDropItemName(stripTags(cellHtmls[cols.quantity] ?? ""))
          : "";
      const rarity =
        cols.rarity >= 0
          ? cleanDropItemName(stripTags(cellHtmls[cols.rarity] ?? ""))
          : "";

      // Icon: dedicated image column, else any img in the item cell, else first img on the row.
      let iconUrl: string | null = null;
      for (let i = 0; i < cellHtmls.length; i++) {
        const headerKind =
          i === cols.item
            ? "item"
            : i === cols.quantity
              ? "quantity"
              : i === cols.rarity
                ? "rarity"
                : null;
        // Prefer non-qty/rarity cells for icons.
        if (headerKind === "quantity" || headerKind === "rarity") continue;
        iconUrl = extractWikiIconFromCell(cellHtmls[i] ?? "");
        if (iconUrl) break;
      }
      if (!iconUrl) {
        for (const cell of cellHtmls) {
          iconUrl = extractWikiIconFromCell(cell);
          if (iconUrl) break;
        }
      }

      const key = `${item.toLowerCase()}\0${quantity}\0${rarity}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ item, quantity, rarity, iconUrl });
    }
  }

  return rows;
}

function extractLeadHtml(leadChunk: string): string {
  const cleaned = stripWikiChrome(leadChunk);
  // Prefer first paragraphs; drop huge tables from lead
  const texts: string[] = [];
  let total = 0;
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(cleaned)) !== null) {
    const text = stripTags(m[1]);
    if (text.length < 12) continue;
    if (/^(?:coordinates|released|update)/i.test(text)) continue;
    if (total >= LEAD_MAX) break;
    const room = LEAD_MAX - total;
    if (text.length > room) {
      texts.push(`${text.slice(0, Math.max(0, room - 1)).trim()}…`);
      total = LEAD_MAX;
      break;
    }
    texts.push(text);
    total += text.length;
    if (texts.length >= 2) break;
  }
  if (texts.length) {
    return texts.map((t) => `<p>${escapeText(t)}</p>`).join("");
  }

  // Fallback: plain text slice
  const text = stripTags(cleaned);
  if (!text) return "";
  const sliced = text.length > LEAD_MAX ? `${text.slice(0, LEAD_MAX).trim()}…` : text;
  return sliced ? `<p>${escapeText(sliced)}</p>` : "";
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pull label/value pairs from the first infobox-like table in the lead. */
export function extractInfoboxFacts(html: string, limit = 8): WikiFact[] {
  const cleaned = stripWikiChrome(html);
  const tableMatch = cleaned.match(
    /<table\b[^>]*class="[^"]*infobox[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch) return [];

  const facts: WikiFact[] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(tableMatch[1])) !== null) {
    const cells = row[1];
    const th = cells.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i);
    const td = cells.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i);
    if (!th || !td) continue;
    const label = stripTags(th[1]).replace(/:$/, "").trim();
    const value = stripTags(td[1]).trim();
    if (!label || !value) continue;
    if (/^(?:image|icon|examine|map)$/i.test(label)) continue;
    facts.push({ label, value });
    if (facts.length >= limit) break;
  }
  return facts;
}

function cleanFragment(html: string): string {
  let out = stripWikiChrome(html);
  // Drop empty paragraphs
  out = out.replace(/<p\b[^>]*>\s*<\/p>/gi, "");
  // Soft-strip multi-paragraph waffle: keep tables, lists, short p
  const keep: string[] = [];
  const tokenRe =
    /<(table|ul|ol|dl|h[2-4]|p)\b[^>]*>[\s\S]*?<\/\1>|<p\b[^>]*\/>/gi;
  let m: RegExpExecArray | null;
  let matched = false;
  while ((m = tokenRe.exec(out)) !== null) {
    matched = true;
    const tag = m[1]?.toLowerCase() ?? "p";
    if (tag === "p") {
      const text = stripTags(m[0]);
      if (text.length < 8) continue;
      if (text.length > 280) {
        // Keep a short slice of long prose
        keep.push(`<p>${escapeText(text.slice(0, 220).trim())}…</p>`);
        continue;
      }
    }
    keep.push(m[0]);
  }
  if (matched) return keep.join("\n");
  return out;
}

function sectionBlock(section: Section): string {
  const level = Math.min(4, Math.max(2, section.level));
  const heading = escapeText(section.heading);
  const body = cleanFragment(section.html);
  if (!body && !section.heading) return "";
  return `<h${level}>${heading}</h${level}>\n${body}`;
}

/**
 * Turn MediaWiki parse HTML into a compact article view.
 * Lead/body stay image-free. Drop rows harvest live wiki icon URLs before strip.
 */
export function processWikiHtml(
  rawHtml: string,
  meta: { title: string; pageUrl: string },
): WikiArticleView {
  const raw = rawHtml || "";
  // Keep imgs while locating drop sections so inventory icons survive harvest.
  const withImages = stripWikiChromeKeepImages(raw);
  const { lead: leadWithImgs, sections: sectionsWithImgs } =
    extractSections(withImages);

  const preferredDropHtml: string[] = [];
  const otherDropHtml: string[] = [];
  for (const section of sectionsWithImgs) {
    if (isStripSection(section)) continue;
    if (!isDropSection(section)) continue;
    if (isPreferredDropSection(section)) preferredDropHtml.push(section.html);
    else otherDropHtml.push(section.html);
  }
  const leadDropTables: string[] = [];
  if (
    !preferredDropHtml.length &&
    !otherDropHtml.length &&
    DROP_TABLE_HINT.test(leadWithImgs) &&
    /<table\b/i.test(leadWithImgs)
  ) {
    for (const table of leadWithImgs.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
      if (DROP_TABLE_HINT.test(table)) leadDropTables.push(table);
    }
  }

  // Preferred (unique/main/always) first so the 80-row cap keeps them + icons.
  const drops = extractDropRows(
    [...preferredDropHtml, ...otherDropHtml, ...leadDropTables].join("\n"),
  );

  // Display path: strip all images from prose / fallback HTML.
  const base = stripWikiChrome(raw);
  const facts = extractInfoboxFacts(base);
  const { lead, sections } = extractSections(base);

  const dropParts: string[] = [];
  const bodyParts: string[] = [];
  for (const section of sections) {
    if (isStripSection(section)) continue;
    if (isDropSection(section)) {
      dropParts.push(sectionBlock(section));
      continue;
    }
    bodyParts.push(sectionBlock(section));
  }

  if (!dropParts.length && DROP_TABLE_HINT.test(lead) && /<table\b/i.test(lead)) {
    for (const table of lead.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
      if (DROP_TABLE_HINT.test(table)) dropParts.push(cleanFragment(table));
    }
  }

  let dropsHtml = clampHtml(dropParts.join("\n"), DROPS_HTML_MAX);
  let bodyHtml = clampHtml(bodyParts.join("\n"), BODY_HTML_MAX);
  const leadHtml = extractLeadHtml(lead);

  dropsHtml = dropsHtml.replace(/^(?:\s|<br\s*\/?>)*$/, "");
  bodyHtml = bodyHtml.replace(/^(?:\s|<br\s*\/?>)*$/, "");

  return {
    title: meta.title,
    pageUrl: meta.pageUrl,
    leadHtml,
    facts,
    drops,
    dropsHtml,
    bodyHtml,
    hasDrops: Boolean(drops.length || dropsHtml.trim()),
  };
}

/** Rewrite remaining wiki links to absolute https; leave external alone. */
export function absolutizeWikiHrefs(html: string): string {
  return html
    .replace(
      /\shref="\/w\/([^"]+)"/gi,
      (_m, path: string) => ` href="${WIKI_ORIGIN}/w/${path}"`,
    )
    .replace(
      /\shref="\/wiki\/([^"]+)"/gi,
      (_m, path: string) => ` href="${WIKI_ORIGIN}/w/${path}"`,
    )
    .replace(/\shref="\/\/([^"]+)"/gi, (_m, rest: string) => ` href="https://${rest}"`);
}

export function finalizeArticleHtml(view: WikiArticleView): WikiArticleView {
  return {
    ...view,
    drops: (view.drops ?? []).map((row) => ({
      ...row,
      iconUrl: absolutizeWikiIconUrl(row.iconUrl) ?? null,
    })),
    leadHtml: absolutizeWikiHrefs(view.leadHtml),
    dropsHtml: absolutizeWikiHrefs(view.dropsHtml),
    bodyHtml: absolutizeWikiHrefs(view.bodyHtml),
  };
}

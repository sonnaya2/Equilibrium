/**
 * Live wiki article helpers for /data — page resolution + HTML cleanup.
 * No wiki images. Pure (no React). Server route and client dialog both use the view shape.
 */

import { safeExternalHref } from "./safeHref";
import { decodeHtmlEntities } from "./htmlEntities";
import { sanitizeWikiHtml } from "./sanitizeWikiHtml";

export const WIKI_HOST = "runescape.wiki";
export const WIKI_ORIGIN = `https://${WIKI_HOST}`;
export const WIKI_USER_AGENT =
  "Equilibrium/0.1 RuneScape fan tool (github.com/sonnaya2/Equilibrium)";

/** Keep a fuller wiki intro — fills the hero summary and reduces empty plate. */
const LEAD_MAX = 1600;
const LEAD_PARAGRAPH_CAP = 6;
const BODY_HTML_MAX = 48_000;
const DROPS_HTML_MAX = 32_000;
const DROP_ROW_CAP = 80;
/** After loot-subpage expansion (e.g. Vorkath normal loot tables). */
export const DROP_ROW_CAP_EXPANDED = 160;

const DROP_HEADING =
  /\b(?:drops?|loot|rewards?|100\s*%\s*drops?|always\s+drops?|main\s+drops?|tertiary|secondary|rare\s+drop\s+table|uniques?(?:\s+(?:drops?|rewards?))?|common\s+drops?|elite\s+table|both\s+modes|pet\s+drop|weapon\s+and\s+armou?r|shard\s+of\b)\b/i;

/**
 * Prefer these when ordering structured drop rows (unique/100%/always first).
 * Match short wiki subheads: "Unique", "Uniques", "Unique (5 mechanics)",
 * "Unique drops", "Unique rewards", "100%", "Always drops", plus Amascut-style
 * chase tables ("Weapon and armour table", "Shard of Genesis Essence table").
 * Bare "Uniques" needs uniques? — unique + optional trailing s — or the final s
 * fails the trailing word-boundary check.
 */
const PREFERRED_DROP_HEADING =
  /(?:^|\b)(?:uniques?(?:\s+(?:drops?|rewards?))?|100\s*%(?:\s+drops?)?|always(?:\s+drops?)?|weapon\s+and\s+armou?r|shard\s+of\b)(?:\b|$|\s*\(|\s+table\b)/i;

/**
 * Recipe / source / mechanics prose that is not a kill-drop table.
 * Matched on the full trimmed heading so "Rewards" (Vorkath) still counts.
 */
const NON_DROP_SECTION_HEADING =
  /^(?:creation|products?|repair|item\s+sources?|drop\s+sources?|disassembly|usage\s+cost|loot\s+system|drop\s+mechanics|loot\s+sets)$/i;

const DROP_TABLE_HINT = /\b(?:rarity|quantity|ge\s*price|ge\s*market|drop\s*rate|rarity\s*tier)\b/i;

const ITEM_HEADER = /^(?:item|name)s?$/i;
const QTY_HEADER = /^(?:quantity|qty|amount)s?$/i;
const RARITY_HEADER = /^(?:rarity|rate|chance|drop\s*rate)s?$/i;

/**
 * Whole sections removed (heading + content).
 * Do NOT bare-match "Normal mode" / "Hard mode" / "Pet drop" — those are often
 * drop-table subheads (TzKal-Zuk, Arch-Glacor). Strip strategy guides via the
 * longer patterns instead. Never strip a section that isDropSection() accepts.
 */
const STRIP_SECTION_HEADING =
  /\b(?:strategy|tactics|gallery|trivia|history|update\s+history|references?|external\s+links?|see\s+also|transcript|dialogue|music|sounds?|graphical\s+updates?|concepts?|development|achievements?|(?:hard|normal)\s+mode\s+(?:guide|strategy|tactics)|money\s*making(?:\s+guide)?|boss\s*pet|boss\s*log|senntisten\s+achievements?|titles?|music\s+tracks?|points?\s+of\s+interest|monsters?|mobs?|bosses|minibosses?|map|lore|credits?|spotlight|getting\s+there|mentioned|flawless\s+run|deity\s+info)\b/i;

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
  /**
   * Wiki section heading this row was harvested under (e.g. "Unique (5 mechanics)", "Charms").
   * Presentation-only — never invent mechanics; omit when unknown.
   */
  group?: string | null;
  /** True when the wiki marks the drop as noted — UI shows a note badge, not "(noted)" text. */
  noted?: boolean;
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
  return decodeHtmlEntities(text);
}

function stripTags(html: string): string {
  // Drop empty italic/lang/bold shells before tag→space so they don't leave
  // "Fire )" style tails (wiki often wraps meaning glosses in <i lang=…>).
  const s = html.replace(/<(i|em|b|strong|span)\b[^>]*>\s*<\/\1>/gi, "");
  return decodeEntities(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function clampHtml(html: string, max: number): string {
  if (html.length <= max) return html;
  return `${html.slice(0, max)}…`;
}

/**
 * Keep wiki drop icons for harvest; still kill script/iframe/etc.
 * Closers must match openers — a bare `<button>` without `</button>` in the
 * closer set used to swallow entire articles (infobox mode toggles on Zuk/etc.).
 */
const DANGEROUS_OPEN =
  "script|style|iframe|object|embed|form|button|textarea|select|noscript|svg|math|video|audio";

export function stripWikiChromeKeepImages(html: string): string {
  let out = html;
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // Paired elements only (open + matching close).
  out = out.replace(new RegExp(`<(${DANGEROUS_OPEN})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, "gi"), "");
  // Unclosed openers left after a truncated/malformed chunk — strip the tag.
  out = out.replace(new RegExp(`<(?:${DANGEROUS_OPEN})\\b[^>]*>`, "gi"), "");
  // Void / self-closing chrome.
  out = out.replace(/<(?:input|map|area|link|meta|br)\b[^>]*\/?>/gi, "");
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

/**
 * Wiki chrome glyphs that appear next to drop tables but are not inventory icons
 * (High Level Alchemy, yes/no checks, skill badges).
 */
const NON_INVENTORY_ICON =
  /(?:High_Level_Alchemy|Yes_check|X_mark|Coins_detail|GE_detail|graph|Coins_10000_detail|\/thumb\/(?:Attack|Strength|Defence|Ranged|Magic|Prayer|Constitution|Slayer|Summoning|Herblore|Farming|Mining|Smithing|Fishing|Cooking|Firemaking|Woodcutting|Crafting|Fletching|Runecrafting|Construction|Agility|Thieving|Hunter|Divination|Invention|Archaeology|Necromancy)-icon)/i;

function imgSrcCandidates(tag: string): string[] {
  const out: string[] = [];
  const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (src) out.push(src);
  const dataSrc = tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1];
  if (dataSrc) out.push(dataSrc);
  // Prefer the last (usually 2x) candidate in srcset when present.
  const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
  if (srcset) {
    const parts = srcset
      .split(",")
      .map((p) => p.trim().split(/\s+/)[0])
      .filter(Boolean) as string[];
    out.push(...parts);
  }
  return out;
}

/** First inventory-looking img in a table cell. Prefers real item glyphs. */
export function extractWikiIconFromCell(cellHtml: string): string | null {
  if (!cellHtml) return null;
  const re = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  let fallback: string | null = null;
  while ((m = re.exec(cellHtml)) !== null) {
    const tag = m[0];
    for (const rawSrc of imgSrcCandidates(tag)) {
      const abs = absolutizeWikiIconUrl(rawSrc);
      if (!abs) continue;
      // Skip spacer / tracking pixels when a better candidate exists.
      const isTiny = /\b(?:width|height)=["']?1["']?/i.test(tag) || /\/1px-/i.test(abs);
      if (isTiny) {
        fallback = fallback ?? abs;
        continue;
      }
      // Alchemy / check / skill chrome — keep only as last-resort fallback.
      if (NON_INVENTORY_ICON.test(abs) || NON_INVENTORY_ICON.test(tag)) {
        fallback = fallback ?? abs;
        continue;
      }
      return abs;
    }
  }
  return fallback;
}

/** True when a cell is the dedicated inventory glyph column on RS drop tables. */
function isInventoryImageCell(cellHtml: string): boolean {
  return /\binventory-image\b|\bdrops-img\b|\bclass="[^"]*\bimage\b/i.test(cellHtml);
}

/** Skip GE price / high-alch columns — they often embed non-item icons. */
function isMetaDropCell(cellHtml: string): boolean {
  return /\b(?:ge-column|alch-column|drops-ge|high.?alch)\b/i.test(cellHtml);
}

const STRIP_OPEN =
  "script|style|iframe|object|embed|form|button|textarea|select|noscript|svg|math|picture|video|audio";

/** Remove scripts, images, forms, and wiki chrome blocks. */
export function stripWikiChrome(html: string): string {
  let out = html;
  // Comments
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // Paired elements (open + matching close). Keep closer list aligned with openers —
  // a mismatched pair (e.g. button → form) used to delete half the article.
  out = out.replace(new RegExp(`<(${STRIP_OPEN})\\b[^>]*>[\\s\\S]*?<\\/\\1>`, "gi"), "");
  // Unclosed openers (truncated parse chunks, missing closers).
  out = out.replace(new RegExp(`<(?:${STRIP_OPEN})\\b[^>]*>`, "gi"), "");
  // Void / self-closing + images (lead/body stay image-free).
  out = out.replace(/<(?:img|source|input|map|area|link|meta|br)\b[^>]*\/?>/gi, "");
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

/** True when a section's tables look like item/qty/rarity drop tables. */
function sectionHasDropTable(html: string): boolean {
  if (!html || !/<table\b/i.test(html)) return false;
  for (const table of html.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
    const headerRow = table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/i)?.[0];
    if (!headerRow) continue;
    const cells: string[] = [];
    const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(headerRow)) !== null) {
      cells.push(stripTags(cm[1] ?? ""));
    }
    const map = mapDropHeaders(cells);
    // Require item + at least one of qty/rarity so recipe GE tables stay out.
    if (map && (map.quantity >= 0 || map.rarity >= 0)) return true;
  }
  return false;
}

function isDropSection(section: Section): boolean {
  const heading = section.heading.trim();
  if (NON_DROP_SECTION_HEADING.test(heading)) return false;
  if (DROP_HEADING.test(heading)) return true;
  // Table-hint path: only real drop tables, not Creation/Products GE recipes.
  if (DROP_TABLE_HINT.test(section.html) && sectionHasDropTable(section.html)) {
    return true;
  }
  return false;
}

function isPreferredDropSection(section: Section): boolean {
  return PREFERRED_DROP_HEADING.test(section.heading);
}

/**
 * Preferred unique/always sections plus deeper child headings nested under them
 * (e.g. Uniques → Weapon and armour table) so they claim DROP_ROW_CAP first.
 * When a nested child is itself preferred by name (Shard of… table), keep the
 * ancestor nest level so sibling tables (Devourer's Nexus) stay preferred too.
 */
function preferredDropSections(sections: Section[]): Section[] {
  const out: Section[] = [];
  let preferUnderLevel: number | null = null;
  for (const section of sections) {
    if (isStripSection(section) || !isDropSection(section)) {
      if (preferUnderLevel !== null && section.level <= preferUnderLevel) {
        preferUnderLevel = null;
      }
      continue;
    }
    if (isPreferredDropSection(section)) {
      out.push(section);
      // Only open/raise the nest at this section's level when shallower or new.
      if (preferUnderLevel === null || section.level <= preferUnderLevel) {
        preferUnderLevel = section.level;
      }
      continue;
    }
    if (preferUnderLevel !== null && section.level > preferUnderLevel) {
      out.push(section);
      continue;
    }
    if (preferUnderLevel !== null && section.level <= preferUnderLevel) {
      preferUnderLevel = null;
    }
  }
  return out;
}

function isStripSection(section: Section): boolean {
  // Drop harvest wins: "Normal mode" / "Hard mode" under Drops keep wikitables.
  if (isDropSection(section)) return false;
  // Bare mode labels without drop tables are strategy stubs — drop them.
  if (/^(?:hard|normal)\s+mode$/i.test(section.heading.trim())) return true;
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

/**
 * Strip wiki footnote / citation markers from user-facing text.
 * We don't render a references section, so [1] / [ 2 ] / [d 3] go nowhere.
 *
 * Also heals tag-strip residue: `Fire</b>)` → `Fire )` after stripTags
 * (TzKal-Zuk meaning parenthetical). Collapse empty italic/lang shells and
 * space-before-`)` without eating real parenthetical content.
 */
export function cleanWikiFootnotes(raw: string): string {
  return (
    decodeEntities(raw)
      .replace(/\u00a0|\u200b|\u200c|\u200d|\ufeff/g, " ")
      // Drop-rate footnotes: [ d 1 ], [d1], [d 2]
      .replace(/\[\s*[dD]\s*\d+\s*\]/g, "")
      // Generic numeric cites: [1], [ 12 ], [3]
      .replace(/\[\s*\d+\s*\]/g, "")
      // Letter+number cites: [a], [b 2], [m 1]
      .replace(/\[\s*[a-zA-Z]\s*\d*\s*\]/g, "")
      .replace(/\[\s*(?:edit|citation needed|source|note\s*\d*|m\s*\d+)\s*\]/gi, "")
      // Residual empty brackets / double spaces around punctuation
      .replace(/\[\s*\]/g, "")
      .replace(/\s{2,}/g, " ")
      // Tag-strip leaves spaces at paren edges: "Fire )" / "( meaning"
      .replace(/\s+([,.;:!?)\]])/g, "$1")
      .replace(/([(\[])\s+/g, "$1")
      .replace(/\(\s*\)/g, "")
      // Empty "meaning …" shell after lang/italic content vanished
      .replace(/\(\s*meaning\s*\)/gi, "")
      .replace(/([,.;:])\s*(?=[,.;:])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

const NOTED_MARK = /(?:\s*\(\s*notes?\s*\)|\s*\(\s*noted\s*\)|\s+noted\b|\s+notes\b)/gi;

/** Detect wiki noted markers in item or quantity text. */
export function hasNotedMark(raw: string): boolean {
  return /(?:\(\s*notes?\s*\)|\(\s*noted\s*\)|\bnoted\b|\bnotes\b)/i.test(raw);
}

/** Strip wiki drop-cell junk so local icon resolve can hit. */
export function cleanDropItemName(raw: string): string {
  return cleanWikiFootnotes(
    decodeEntities(raw)
      .replace(/\u00a0/g, " ")
      .replace(NOTED_MARK, " ")
      .replace(/\s*\((?:item|drop|untradeable|tradeable)\)\s*/gi, " ")
      .replace(/\s*[·•]\s*.*$/, "") // trailing meta after bullet
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
}

/** Quantity / rarity cell text — keep rates, kill footnote litter. Never leave "(noted)". */
export function cleanDropCellText(raw: string): string {
  return cleanWikiFootnotes(
    decodeEntities(raw)
      .replace(/\u00a0/g, " ")
      .replace(NOTED_MARK, " ")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
}

/**
 * Split quantity cell into clean qty + noted flag.
 * `"7–12 (noted)"` → `{ quantity: "7–12", noted: true }`.
 */
export function parseDropQuantity(raw: string): { quantity: string; noted: boolean } {
  const noted = hasNotedMark(raw);
  return { quantity: cleanDropCellText(raw), noted };
}

/**
 * Wiki often stubs main tables as a single "Boss loot (normal)" row that links
 * to a subpage with the real Item/Qty/Rarity table (Vorkath, some EGWD modes).
 */
export function isLootContainerItem(item: string): boolean {
  const t = item.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/\bloot\s*\(/i.test(t)) return true;
  if (/\b(?:loot|reward)\s+(?:table|chest|crate|bag|box)\b/i.test(t)) return true;
  return false;
}

/**
 * Prefer normal-mode loot subpages, then hard, then story, then any other shell.
 * Returns wiki page titles (usually identical to the drop item label).
 */
export function pickLootExpandTitles(drops: WikiDropRow[], limit = 1): string[] {
  const containers = drops.filter((d) => isLootContainerItem(d.item));
  if (!containers.length) return [];

  const rank = (name: string): number => {
    if (/\(\s*normal\s*\)/i.test(name)) return 0;
    if (/\(\s*hard\s*\)/i.test(name)) return 1;
    if (/\(\s*story\s*\)/i.test(name)) return 2;
    return 3;
  };

  const sorted = [...containers].sort((a, b) => {
    const dr = rank(a.item) - rank(b.item);
    if (dr !== 0) return dr;
    return a.item.localeCompare(b.item);
  });

  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of sorted) {
    const title = row.item.replace(/\s+/g, " ").trim();
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= limit) break;
  }
  return out;
}

function dropRowKey(row: WikiDropRow): string {
  return `${row.item.toLowerCase()}\0${row.quantity}\0${row.rarity}\0${row.noted ? 1 : 0}`;
}

/**
 * Merge base-page drops with loot-subpage rows. Shell "loot (mode)" rows are
 * dropped once expansion succeeded so the UI only shows real items.
 */
export function mergeExpandedDrops(
  base: WikiDropRow[],
  expanded: WikiDropRow[],
  cap = DROP_ROW_CAP_EXPANDED,
): WikiDropRow[] {
  const out: WikiDropRow[] = [];
  const indexByKey = new Map<string, number>();
  const push = (row: WikiDropRow) => {
    if (expanded.length > 0 && isLootContainerItem(row.item)) return;
    const key = dropRowKey(row);
    const existing = indexByKey.get(key);
    if (existing != null) {
      // Prefer a row that actually has a live inventory icon.
      const prev = out[existing]!;
      if (!prev.iconUrl && row.iconUrl) out[existing] = { ...prev, iconUrl: row.iconUrl };
      return;
    }
    if (out.length >= cap) return;
    indexByKey.set(key, out.length);
    out.push(row);
  };

  // Keep base uniques / non-shell rows first (already preferred-ordered).
  for (const row of base) push(row);
  for (const row of expanded) push(row);
  return out;
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
 * Optional `group` is the wiki section heading (presentation metadata).
 */
export function extractDropRows(html: string, options?: { group?: string | null }): WikiDropRow[] {
  const rows: WikiDropRow[] = [];
  const seen = new Set<string>();
  const group = options?.group?.replace(/\s+/g, " ").trim() || null;
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

      const qtyRaw = cols.quantity >= 0 ? stripTags(cellHtmls[cols.quantity] ?? "") : "";
      const itemCellRaw = stripTags(cellHtmls[cols.item] ?? "");
      const parsedQty = parseDropQuantity(qtyRaw);
      // Noted may live on the item cell ("Coins (noted)") or the qty cell.
      const noted = parsedQty.noted || hasNotedMark(itemCellRaw);
      const quantity = parsedQty.quantity;
      const rarity =
        cols.rarity >= 0 ? cleanDropCellText(stripTags(cellHtmls[cols.rarity] ?? "")) : "";

      // Icon priority: inventory-image column → item cell → other non-meta cells.
      let iconUrl: string | null = null;
      const tryCell = (cell: string | undefined) => {
        if (!cell || isMetaDropCell(cell)) return null;
        return extractWikiIconFromCell(cell);
      };
      for (const cell of cellHtmls) {
        if (isInventoryImageCell(cell)) {
          iconUrl = tryCell(cell);
          if (iconUrl) break;
        }
      }
      if (!iconUrl) iconUrl = tryCell(cellHtmls[cols.item]);
      if (!iconUrl) {
        for (let i = 0; i < cellHtmls.length; i++) {
          if (i === cols.quantity || i === cols.rarity) continue;
          iconUrl = tryCell(cellHtmls[i]);
          if (iconUrl) break;
        }
      }

      const key = `${item.toLowerCase()}\0${quantity}\0${rarity}\0${noted ? 1 : 0}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        item,
        quantity,
        rarity,
        iconUrl,
        ...(noted ? { noted: true } : {}),
        ...(group ? { group } : {}),
      });
    }
  }

  return rows;
}

function extractLeadHtml(leadChunk: string): string {
  // Prefer the image-keeping strip path: full-page stripWikiChrome can mangle
  // long leads when void <img> tags pair across huge spans.
  const cleaned = stripWikiChromeKeepImages(leadChunk);
  const texts: string[] = [];
  let total = 0;
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(cleaned)) !== null) {
    // Kill cite markers — we have no references panel for [1] to land on.
    const text = cleanWikiFootnotes(stripTags(m[1]));
    if (text.length < 12) continue;
    if (/^(?:coordinates|released|update)/i.test(text)) continue;
    // Skip pure hatnote / disambiguation crumbs.
    if (/^this article is (?:a |about )/i.test(text) && text.length < 80) continue;
    if (total >= LEAD_MAX) break;
    const room = LEAD_MAX - total;
    if (text.length > room) {
      texts.push(`${text.slice(0, Math.max(0, room - 1)).trim()}…`);
      total = LEAD_MAX;
      break;
    }
    texts.push(text);
    total += text.length;
    if (texts.length >= LEAD_PARAGRAPH_CAP) break;
  }
  if (texts.length) {
    return texts.map((t) => `<p>${escapeText(t)}</p>`).join("");
  }

  // Fallback: plain text slice (still image-free, cites stripped).
  const text = cleanWikiFootnotes(stripTags(stripWikiChrome(leadChunk)));
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

/** Pull label/value pairs from the first usable infobox-like table. */
export function extractInfoboxFacts(html: string, limit = 8): WikiFact[] {
  const cleaned = stripWikiChrome(html);
  // Prefer monster/NPC infoboxes; fall back to any infobox table.
  const tables =
    cleaned.match(/<table\b[^>]*class="[^"]*infobox[^"]*"[^>]*>([\s\S]*?)<\/table>/gi) ?? [];
  if (!tables.length) return [];

  const ranked = [...tables].sort((a, b) => {
    const score = (t: string) =>
      /infobox-monster|infobox-npc|infobox-boss/i.test(t) ? 0 : /infobox/i.test(t) ? 1 : 2;
    return score(a) - score(b);
  });

  const facts: WikiFact[] = [];
  const seen = new Set<string>();
  for (const table of ranked) {
    const body = table.replace(/^<table\b[^>]*>/i, "").replace(/<\/table>$/i, "");
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let row: RegExpExecArray | null;
    while ((row = rowRe.exec(body)) !== null) {
      const cells = row[1];
      const th = cells.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i);
      const td = cells.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i);
      if (!th || !td) continue;
      const label = cleanWikiFootnotes(stripTags(th[1]).replace(/:$/, "").trim());
      let value = cleanWikiFootnotes(stripTags(td[1]).trim());
      if (!label || !value) continue;
      if (/^(?:image|icon|examine|map|version|id)$/i.test(label)) continue;
      if (value.length > 100) continue;
      if (/\{\s*"/.test(value) || /^\?\s*\(edit\)/i.test(value)) continue;
      // Collapse multi-value junk from switch infoboxes.
      if (/&&SPLITPOINT&&/.test(value)) {
        value = value.split("&&SPLITPOINT&&")[0]?.trim() ?? value;
      }
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push({ label, value });
      if (facts.length >= limit) return facts;
    }
    if (facts.length >= 3) break;
  }
  return facts;
}

function cleanFragment(html: string): string {
  let out = stripWikiChrome(html);
  // Drop empty paragraphs
  out = out.replace(/<p\b[^>]*>\s*<\/p>/gi, "");
  // Soft-strip multi-paragraph waffle: keep tables, lists, short p
  const keep: string[] = [];
  const tokenRe = /<(table|ul|ol|dl|h[2-4]|p)\b[^>]*>[\s\S]*?<\/\1>|<p\b[^>]*\/>/gi;
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
  const { lead: leadWithImgs, sections: sectionsWithImgs } = extractSections(withImages);

  // Preferred unique sections + nested child tables first (Uniques → weapon table).
  const preferredSections = preferredDropSections(sectionsWithImgs);
  const preferredSet = new Set(preferredSections);
  const preferredDropHtml: string[] = preferredSections.map((s) => s.html);
  const otherDropHtml: string[] = [];
  for (const section of sectionsWithImgs) {
    if (isStripSection(section) || !isDropSection(section)) continue;
    if (preferredSet.has(section)) continue;
    otherDropHtml.push(section.html);
  }
  const leadDropTables: string[] = [];
  if (
    !preferredDropHtml.length &&
    !otherDropHtml.length &&
    DROP_TABLE_HINT.test(leadWithImgs) &&
    sectionHasDropTable(leadWithImgs)
  ) {
    for (const table of leadWithImgs.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
      if (DROP_TABLE_HINT.test(table) && sectionHasDropTable(table)) {
        leadDropTables.push(table);
      }
    }
  }

  // Preferred (unique/main/always + nested chase tables) first so DROP_ROW_CAP
  // keeps uniques before potions/supplies fill the budget.
  // Harvest per section so `group` carries the wiki heading for presentation.
  const drops: WikiDropRow[] = [];
  const seenDrop = new Set<string>();
  const pushSectionRows = (html: string, group: string | null) => {
    for (const row of extractDropRows(html, { group })) {
      if (drops.length >= DROP_ROW_CAP) return;
      const key = `${row.item.toLowerCase()}\0${row.quantity}\0${row.rarity}\0${row.noted ? 1 : 0}`;
      if (seenDrop.has(key)) continue;
      seenDrop.add(key);
      drops.push(row);
    }
  };
  for (const section of preferredSections) {
    pushSectionRows(section.html, section.heading);
  }
  for (const section of sectionsWithImgs) {
    if (isStripSection(section) || !isDropSection(section)) continue;
    if (preferredSet.has(section)) continue;
    pushSectionRows(section.html, section.heading);
  }
  for (const table of leadDropTables) {
    pushSectionRows(table, null);
  }
  // Fallback if section classifiers missed tables but blobs still hold them.
  if (!drops.length) {
    pushSectionRows([...preferredDropHtml, ...otherDropHtml, ...leadDropTables].join("\n"), null);
  }

  // Display path: strip all images from prose / fallback HTML.
  // Facts + lead from the image-keeping pass — stripWikiChrome can mangle long
  // leads / multi-infobox pages when void <img> tags pair across huge spans.
  const facts = extractInfoboxFacts(withImages);
  const leadHtml = extractLeadHtml(leadWithImgs);
  const base = stripWikiChrome(raw);
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

  if (!dropParts.length && DROP_TABLE_HINT.test(lead) && sectionHasDropTable(lead)) {
    for (const table of lead.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
      if (DROP_TABLE_HINT.test(table) && sectionHasDropTable(table)) {
        dropParts.push(cleanFragment(table));
      }
    }
  }

  let dropsHtml = clampHtml(dropParts.join("\n"), DROPS_HTML_MAX);
  let bodyHtml = clampHtml(bodyParts.join("\n"), BODY_HTML_MAX);

  dropsHtml = dropsHtml.replace(/^(?:\s|<br\s*\/?>)*$/, "");
  bodyHtml = bodyHtml.replace(/^(?:\s|<br\s*\/?>)*$/, "");

  // Structured rows only — never flash empty drops chrome for Creation /
  // Item sources / Rewards prose when extractDropRows returned nothing.
  const hasDrops = drops.length > 0;

  return {
    // Decode here so callers need not rely on API-route displayTitle() alone.
    title: decodeHtmlEntities(meta.title),
    pageUrl: meta.pageUrl,
    leadHtml,
    facts,
    drops,
    dropsHtml: hasDrops ? dropsHtml : "",
    bodyHtml,
    hasDrops,
  };
}

/** Rewrite remaining wiki links to absolute https; leave external alone. */
export function absolutizeWikiHrefs(html: string): string {
  return html
    .replace(/\shref="\/w\/([^"]+)"/gi, (_m, path: string) => ` href="${WIKI_ORIGIN}/w/${path}"`)
    .replace(/\shref="\/wiki\/([^"]+)"/gi, (_m, path: string) => ` href="${WIKI_ORIGIN}/w/${path}"`)
    .replace(/\shref="\/\/([^"]+)"/gi, (_m, rest: string) => ` href="https://${rest}"`);
}

export function finalizeArticleHtml(view: WikiArticleView): WikiArticleView {
  // Allowlist sanitize after href rewrite — last boundary before API/JSON.
  const leadHtml = sanitizeWikiHtml(absolutizeWikiHrefs(view.leadHtml));
  const dropsHtml = sanitizeWikiHtml(absolutizeWikiHrefs(view.dropsHtml));
  const bodyHtml = sanitizeWikiHtml(absolutizeWikiHrefs(view.bodyHtml));
  return {
    ...view,
    title: decodeHtmlEntities(view.title),
    drops: (view.drops ?? []).map((row) => ({
      ...row,
      iconUrl: absolutizeWikiIconUrl(row.iconUrl) ?? null,
    })),
    leadHtml,
    dropsHtml,
    bodyHtml,
  };
}

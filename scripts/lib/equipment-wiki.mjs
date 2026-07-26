/**
 * Equipment wiki scrape helpers for combat gear candidate extraction.
 * Uses runescape-wiki.mjs (wikiApi) for rendered HTML tables.
 * Candidates only — never write data/combat/equipment.json from here.
 */

import { wikiApi } from "./runescape-wiki.mjs";

export const COMBAT_STYLES = ["melee", "ranged", "magic", "necromancy"];

/** Wiki list pages that enumerate high-signal armour / weapon candidates. */
export const EQUIPMENT_PAGES = [
  { title: "Armour/Melee armour", style: "melee", kind: "armour" },
  { title: "Armour/Ranged armour", style: "ranged", kind: "armour" },
  { title: "Armour/Magic armour", style: "magic", kind: "armour" },
  { title: "Armour/Necromancy armour", style: "necromancy", kind: "armour" },
  { title: "Weapon/Melee weapons", style: "melee", kind: "weapon" },
  { title: "Weapon/Ranged weapons", style: "ranged", kind: "weapon" },
  { title: "Weapon/Magic weapons", style: "magic", kind: "weapon" },
  { title: "Weapon/Necromancy weapons", style: "necromancy", kind: "weapon" },
];

/** Wiki slot labels → EquipmentRecord slot ids. */
export const SLOT_MAP = {
  head: "helmet",
  helmet: "helmet",
  "head slot": "helmet",
  torso: "body",
  body: "body",
  "torso slot": "body",
  "body slot": "body",
  legs: "legs",
  "legs slot": "legs",
  hands: "gloves",
  gloves: "gloves",
  "hands slot": "gloves",
  feet: "boots",
  boots: "boots",
  "feet slot": "boots",
  "main hand": "mainhand",
  mainhand: "mainhand",
  "main-hand": "mainhand",
  "main hand slot": "mainhand",
  "off hand": "offhand",
  offhand: "offhand",
  "off-hand": "offhand",
  "off hand slot": "offhand",
  "two-handed": "twohand",
  twohand: "twohand",
  "two hand": "twohand",
  "two-hand": "twohand",
  "2h": "twohand",
};

const SKIP_TITLE_RE =
  /^(file|category|template|module|help|special|user|talk|mediawiki):/i;
const SKIP_LINK_RE =
  /^(head slot|torso slot|legs slot|hands slot|feet slot|main hand slot|off.?hand slot|two.?handed? slot|hit chance|life points|prayer|membership subscription|free-to-play|members|defence|attack|strength|ranged|magic|necromancy|constitution|melee|slayer|agility|smithing|fletching|dungeoneering|quest points)$/i;
const WEAPON_SKIP_RE = /\b(hatchet|pickaxe|hatchets|pickaxes)\b/i;
const DISCONTINUED_RE = /\bdiscontinued\b/i;
const FUN_RE = /\bfun\b/i;

export function slugId(title) {
  const base = String(title ?? "")
    .replace(/['’]/g, "")
    .replace(/\+/g, " plus ")
    .replace(/[()]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `item:${base}`;
}

export function decodeHtml(text) {
  return String(text)
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function stripTags(html) {
  return decodeHtml(String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function mapSlotLabel(label) {
  if (!label) return null;
  const key = String(label).toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return SLOT_MAP[key] ?? null;
}

/** Fetch rendered page HTML via action=parse&prop=text. */
export async function fetchPageHtml(title) {
  const data = await wikiApi({ action: "parse", page: title, prop: "text|revid" });
  const html = data?.parse?.text;
  if (typeof html !== "string" || html.length === 0) {
    throw new Error(`Missing rendered Wiki page: ${title}`);
  }
  return {
    title: data.parse.title ?? title,
    revid: data.parse.revid ?? null,
    html,
  };
}

function isSkippableTitle(title) {
  if (!title || typeof title !== "string") return true;
  const t = title.trim();
  if (!t || t === "-" || t === "–" || t === "—") return true;
  if (SKIP_TITLE_RE.test(t)) return true;
  if (SKIP_LINK_RE.test(t)) return true;
  if (DISCONTINUED_RE.test(t) || FUN_RE.test(t)) return true;
  return false;
}

export function shouldSkipCandidate(name, kind, sectionHint = "") {
  if (!name) return true;
  if (isSkippableTitle(name)) return true;
  if (DISCONTINUED_RE.test(sectionHint) || FUN_RE.test(sectionHint)) return true;
  if (kind === "weapon" && WEAPON_SKIP_RE.test(name)) return true;
  // Family / list pages that are not wearable pieces
  if (/\b(weapons?|equipment|armour|armor)\s*$/i.test(name) && !/\b(plate|chain|robe)\b/i.test(name)) {
    // Keep specific named pieces; drop pure family indexes only when they look generic
    if (/^(bronze|iron|steel|black|white|mithril|adamant|rune|dragon|orikalkum|necronium|bane|elder rune|primal)\s+(weapons?|equipment)$/i.test(name)) {
      return true;
    }
  }
  return false;
}

/** Extract article links from a cell: { title, name, href }. */
export function extractItemLinks(cellHtml) {
  const links = [];
  const re = /<a\b[^>]*href="\/w\/([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(cellHtml)) !== null) {
    const hrefTitle = decodeURIComponent(match[1].replace(/_/g, " "));
    const attrs = match[0];
    const titleAttr = /title="([^"]*)"/i.exec(attrs);
    const wikiTitle = titleAttr ? decodeHtml(titleAttr[1]) : hrefTitle;
    const name = stripTags(match[2]) || wikiTitle;
    if (isSkippableTitle(wikiTitle) || isSkippableTitle(name)) continue;
    // Image-only file links already filtered via File:
    if (/^File:/i.test(hrefTitle)) continue;
    links.push({ wikiTitle, name: name.trim() || wikiTitle, href: hrefTitle });
  }
  return links;
}

/**
 * Parse a tier/level *cell* (not free prose).
 * Accepts "90", "70-74", "70 Defence" — rejects "TzHaar whip 7" / item names with trailing digits.
 */
export function parseTierFromText(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t || t === "-" || t === "–") return null;
  const pure = /^(\d{1,3})(?:\s*[-–]\s*\d{1,3})?$/.exec(t);
  if (pure) {
    const n = Number(pure[1]);
    return n >= 1 && n <= 120 ? n : null;
  }
  // Stripped skillreq: "90 Defence" / "90 Attack"
  const skill = /^(\d{1,3})\s+(defence|attack|strength|ranged|magic|necromancy|constitution|prayer)\b/i.exec(t);
  if (skill) {
    const n = Number(skill[1]);
    return n >= 1 && n <= 120 ? n : null;
  }
  return null;
}

/** Loose tier hunt for wikitext lines (last resort). */
export function parseTierLoose(text) {
  const m = /\b(\d{1,3})\b/.exec(String(text ?? ""));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 120 ? n : null;
}

/** Infer weapon slot from display / wiki title when table lacks a slot column. */
export function inferWeaponSlot(name) {
  const n = String(name).toLowerCase();
  if (/^off[-\s]?hand\b/.test(n) || /\boff[-\s]?hand\b/.test(n)) return "offhand";
  if (
    /\b(2h|two[-\s]?handed?)\b/.test(n) ||
    /\b(godsword|scythe|halberd|maul|battlestaff|staff of|noxious staff|noxious longbow|seren godbow|eldritch crossbow|bow of the last guardian|hexhunter bow|wyvern crossbow|zaryte bow|dark bow|sunspear|spear of annihilation|masterwork spear|terrasaur maul|ek-zekkil|tumeken'?s light)\b/.test(n)
  ) {
    return "twohand";
  }
  if (/\b(defender|orb|book of|focus sight|shield|buckler|repriser|ward)\b/.test(n) && !/\bshieldbow\b/.test(n)) {
    return "offhand";
  }
  // Default 1h weapons to mainhand when no off-hand cue
  if (/\b(wand|rapier|dagger|scimitar|longsword|sword|mace|whip|claw|khopesh|crossbow|thrownaxe|javelin|chinchompa)\b/.test(n)) {
    return "mainhand";
  }
  return null;
}

/**
 * Parse one wikitable into header labels + raw cell HTML rows.
 * Header labels prefer link title attrs (slot icons) then stripped text.
 */
export function parseTable(tableHtml) {
  const trs = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  if (trs.length === 0) return null;
  const rows = [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<t([dh])\b[^>]*>([\s\S]*?)<\/t\1>/gi)].map((m) => ({
      tag: m[1].toLowerCase(),
      html: m[2],
      text: stripTags(m[2]),
    }));
    if (cells.length) rows.push(cells);
  }
  if (rows.length === 0) return null;

  // Find header row: first row with mostly th, or first row containing "Tier"/"Type"/"Set"
  let headerIdx = rows.findIndex((r) => r.some((c) => c.tag === "th"));
  if (headerIdx < 0) {
    headerIdx = rows.findIndex((r) =>
      r.some((c) => /^(type|tier|set|item|weapon|name|attack level|level)$/i.test(c.text)),
    );
  }
  if (headerIdx < 0) headerIdx = 0;

  const headerCells = rows[headerIdx];
  const headers = headerCells.map((cell) => {
    const titleMatch = /title="([^"]+)"/i.exec(cell.html);
    if (titleMatch) {
      const t = decodeHtml(titleMatch[1]);
      const slot = mapSlotLabel(t);
      if (slot) return t;
      if (/slot$/i.test(t)) return t;
    }
    const hrefMatch = /href="\/w\/([^"#?]+)"/i.exec(cell.html);
    if (hrefMatch) {
      const t = decodeURIComponent(hrefMatch[1].replace(/_/g, " "));
      if (mapSlotLabel(t) || /slot$/i.test(t)) return t;
    }
    return cell.text || "";
  });

  return {
    headers,
    headerCells,
    dataRows: rows.slice(headerIdx + 1),
  };
}

function colIndex(headers, predicates) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (predicates.some((p) => (typeof p === "string" ? h === p || h.includes(p) : p.test(h)))) {
      return i;
    }
  }
  return -1;
}

function slotColumns(headers) {
  const cols = [];
  for (let i = 0; i < headers.length; i++) {
    const slot = mapSlotLabel(headers[i]);
    if (slot) cols.push({ index: i, slot, label: headers[i] });
  }
  return cols;
}

function makeCandidate({ name, wikiTitle, style, kind, tier, slot, setName, sourcePage, section }) {
  const title = wikiTitle || name;
  if (shouldSkipCandidate(title, kind, section) || shouldSkipCandidate(name, kind, section)) {
    return null;
  }
  const out = {
    id: slugId(title),
    name: name || title,
    wikiTitle: title,
    style,
    kind,
    sourcePage,
  };
  if (tier != null) out.tier = tier;
  if (slot) out.slot = slot;
  if (setName) out.setName = setName;
  if (section) out.section = section;
  return out;
}

/**
 * Armour set tables: Tier + Head/Torso/Legs/Hands/Feet piece columns.
 * Also harvests Set column as setName context.
 */
export function parseArmourSetTable(table, { style, sourcePage, section, minTier }) {
  const { headers, dataRows } = table;
  const tierIdx = colIndex(headers, ["tier"]);
  const setIdx = colIndex(headers, [/^set$/, "set name", "armour set"]);
  const slots = slotColumns(headers);
  if (tierIdx < 0 || slots.length === 0) return [];

  const candidates = [];
  for (const row of dataRows) {
    const tier = parseTierFromText(row[tierIdx]?.text ?? "");
    if (tier == null || tier < minTier) continue;
    const setLinks = setIdx >= 0 ? extractItemLinks(row[setIdx]?.html ?? "") : [];
    const setName =
      setLinks[0]?.name ??
      (setIdx >= 0 ? row[setIdx]?.text : null) ??
      null;

    for (const { index, slot } of slots) {
      const cell = row[index];
      if (!cell || /^[-–—]?$/.test(cell.text) || /table-na/i.test(cell.html)) continue;
      for (const link of extractItemLinks(cell.html)) {
        const c = makeCandidate({
          name: link.name,
          wikiTitle: link.wikiTitle,
          style,
          kind: "armour",
          tier,
          slot,
          setName: setName || undefined,
          sourcePage,
          section,
        });
        if (c) candidates.push(c);
      }
    }
  }
  return candidates;
}

/**
 * Non-set armour / generic item tables: Item|Name + Tier columns, optional slot from section.
 */
export function parseGenericItemTable(table, { style, kind, sourcePage, section, minTier, defaultSlot }) {
  const { headers, dataRows } = table;
  const tierIdx = colIndex(headers, ["tier", "level", "attack level", "defence level", "requirement"]);
  const nameIdx = colIndex(headers, [/^item$/, /^name$/, /^weapon$/, /^armour$/, "equipment"]);
  const slotIdx = colIndex(headers, ["slot", "handedness"]);
  const slots = slotColumns(headers);

  // Level-list style: Attack Level | Type (links) — common on Weapon/* pages
  const levelList =
    tierIdx >= 0 &&
    nameIdx < 0 &&
    headers.some((h) => /level|type|weapon/i.test(h));

  const candidates = [];
  let rowspanTier = null; // inherit Attack Level across rowspan-collapsed rows

  for (const row of dataRows) {
    let tier = tierIdx >= 0 ? parseTierFromText(row[tierIdx]?.text ?? "") : null;

    if (levelList) {
      // Rowspan: level cell only appears on the first row of a level group
      if (tier != null) rowspanTier = tier;
      else if (rowspanTier != null) tier = rowspanTier;
      else {
        for (const cell of row) {
          const t = parseTierFromText(cell.text);
          if (t != null) {
            tier = t;
            rowspanTier = t;
            break;
          }
        }
      }
      if (tier == null || tier < minTier) continue;
      for (const cell of row) {
        for (const link of extractItemLinks(cell.html)) {
          if (shouldSkipCandidate(link.wikiTitle, kind, section)) continue;
          const slot =
            defaultSlot ??
            (kind === "weapon" ? inferWeaponSlot(link.wikiTitle) : mapSlotLabel(section));
          const c = makeCandidate({
            name: link.name,
            wikiTitle: link.wikiTitle,
            style,
            kind,
            tier,
            slot: slot || undefined,
            sourcePage,
            section,
          });
          if (c) candidates.push(c);
        }
      }
      continue;
    }

    // Explicit name column or harvest all item links with row tier
    if (tier != null) rowspanTier = tier;
    else if (rowspanTier != null && tierIdx >= 0 && !(row[tierIdx]?.text ?? "").trim()) {
      tier = rowspanTier;
    }

    if (tier != null && tier < minTier) continue;

    if (nameIdx >= 0) {
      const cell = row[nameIdx];
      if (!cell) continue;
      const links = extractItemLinks(cell.html);
      if (tier == null) tier = parseTierFromText(row.map((c) => c.text).join(" "));
      // Require a known tier that meets the floor — skip taxonomy rows (Dagger, Scimitar, …)
      if (tier == null || tier < minTier) continue;
      let slot = defaultSlot;
      if (slotIdx >= 0) {
        const handed = row[slotIdx]?.text ?? "";
        if (/two/i.test(handed)) slot = "twohand";
        else if (/off/i.test(handed)) slot = "offhand";
        else if (/main/i.test(handed)) slot = "mainhand";
      }
      if (slots.length === 1) slot = slots[0].slot;
      for (const link of links) {
        const c = makeCandidate({
          name: link.name,
          wikiTitle: link.wikiTitle,
          style,
          kind,
          tier,
          slot: slot || (kind === "weapon" ? inferWeaponSlot(link.wikiTitle) : mapSlotLabel(section)) || undefined,
          sourcePage,
          section,
        });
        if (c) candidates.push(c);
      }
      continue;
    }

    // Slot columns without set structure (rare)
    if (slots.length > 0 && tier != null) {
      for (const { index, slot } of slots) {
        for (const link of extractItemLinks(row[index]?.html ?? "")) {
          const c = makeCandidate({
            name: link.name,
            wikiTitle: link.wikiTitle,
            style,
            kind,
            tier,
            slot,
            sourcePage,
            section,
          });
          if (c) candidates.push(c);
        }
      }
    }
  }
  return candidates;
}

/**
 * Wikitext fallback: [[Item name]] near tier numbers in high-value sections only.
 */
export function parseWikitextTierLinks(wikitext, { style, kind, sourcePage, minTier }) {
  const candidates = [];
  // Split on == headings ==
  const sections = String(wikitext).split(/(?=^={2,3}\s*[^=].*?={2,3}\s*$)/m);
  for (const block of sections) {
    const headingMatch = /^={2,3}\s*(.*?)\s*={2,3}/.exec(block);
    const section = headingMatch ? stripTags(headingMatch[1].replace(/\[\[|\]\]/g, "")) : "";
    if (DISCONTINUED_RE.test(section) || FUN_RE.test(section)) continue;
    // Prefer high-level / requirements / combat stats / 70+
    if (
      kind === "weapon" &&
      section &&
      !/(requirement|combat stat|stat comparison|high.?level|70|80|90|weaponry|equipment)/i.test(section) &&
      !/(drygore|noxious|chaotic|barrows|god wars|crystal|elite)/i.test(section)
    ) {
      continue;
    }
    const lines = block.split("\n");
    let lastTier = null;
    for (const line of lines) {
      const cleaned = line.replace(/\{\{[^}]+\}\}/g, " ");
      // Prefer strict cell-like match; fall back to leading "| 90" / "tier 90" patterns
      let tierInLine = parseTierFromText(cleaned.trim());
      if (tierInLine == null) {
        const labeled = /(?:tier|level|req(?:uirement)?s?)\s*[:=]?\s*(\d{1,3})\b/i.exec(cleaned)
          || /^\D{0,4}(\d{1,3})\s*(?:\||$)/.exec(cleaned.trim());
        if (labeled) {
          const n = Number(labeled[1]);
          if (n >= 1 && n <= 120) tierInLine = n;
        }
      }
      if (tierInLine != null && tierInLine >= minTier) lastTier = tierInLine;
      const linkRe = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;
      let m;
      while ((m = linkRe.exec(line)) !== null) {
        const wikiTitle = m[1].trim();
        const name = (m[2] || m[1]).trim();
        if (lastTier == null || lastTier < minTier) continue;
        if (shouldSkipCandidate(wikiTitle, kind, section)) continue;
        const slot =
          kind === "weapon"
            ? inferWeaponSlot(wikiTitle)
            : mapSlotLabel(section) || undefined;
        const c = makeCandidate({
          name,
          wikiTitle,
          style,
          kind,
          tier: lastTier,
          slot: slot || undefined,
          sourcePage,
          section: section || "wikitext",
        });
        if (c) {
          c.parsePath = "wikitext";
          candidates.push(c);
        }
      }
    }
  }
  return candidates;
}

/** Split HTML by h2/h3 headings → [{ heading, body }]. */
export function splitSections(html) {
  const parts = [];
  const re = /<div class="mw-heading[^"]*"[^>]*>[\s\S]*?<h([23])\b[^>]*>([\s\S]*?)<\/h\1>[\s\S]*?<\/div>|<h([23])\b[^>]*>([\s\S]*?)<\/h\3>/gi;
  const matches = [...html.matchAll(re)];
  if (matches.length === 0) return [{ heading: "", body: html }];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const heading = stripTags(m[2] ?? m[4] ?? "");
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : html.length;
    parts.push({ heading, body: html.slice(start, end) });
  }
  // Preamble before first heading
  if (matches[0].index > 0) {
    parts.unshift({ heading: "", body: html.slice(0, matches[0].index) });
  }
  return parts;
}

/**
 * Extract all equipment candidates from a rendered list page.
 * Prefer HTML tables; optional wikitext fallback when HTML yields nothing useful.
 */
export function parseEquipmentPageHtml(html, { style, kind, sourcePage, minTier = 70 }) {
  const candidates = [];
  const warnings = [];
  const sections = splitSections(html);

  for (const { heading, body } of sections) {
    if (DISCONTINUED_RE.test(heading) || FUN_RE.test(heading)) continue;
    // Slot context from non-set section headings
    const sectionSlot = mapSlotLabel(heading) || (
      /^head$/i.test(heading) ? "helmet"
        : /^body$/i.test(heading) ? "body"
          : /^hands$/i.test(heading) ? "gloves"
            : /^feet$/i.test(heading) ? "boots"
              : null
    );

    const tables = body.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
    for (const tableHtml of tables) {
      const table = parseTable(tableHtml);
      if (!table) continue;
      const slots = slotColumns(table.headers);
      const hasTier = table.headers.some((h) => /^tier$/i.test(h.trim()) || h.toLowerCase() === "tier");
      const isArmourSet = kind === "armour" && hasTier && slots.length >= 2;

      let found = [];
      if (isArmourSet) {
        found = parseArmourSetTable(table, {
          style,
          sourcePage,
          section: heading,
          minTier,
        });
      } else {
        found = parseGenericItemTable(table, {
          style,
          kind,
          sourcePage,
          section: heading,
          minTier,
          defaultSlot: sectionSlot || undefined,
        });
      }
      for (const c of found) candidates.push(c);
    }
  }

  if (candidates.length === 0) {
    warnings.push(`${sourcePage}: no table candidates above tier ${minTier}`);
  }
  return { candidates, warnings };
}

/** Deduplicate candidates by id+slot+tier (keep richest row). */
export function dedupeCandidates(list) {
  const map = new Map();
  for (const c of list) {
    const key = `${c.id}|${c.slot ?? ""}|${c.tier ?? ""}|${c.style}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, c);
      continue;
    }
    // Prefer entry with setName / more fields
    const score = (x) => (x.setName ? 2 : 0) + (x.slot ? 1 : 0) + (x.tier != null ? 1 : 0);
    if (score(c) > score(prev)) map.set(key, c);
  }
  return [...map.values()].sort((a, b) => {
    const styleCmp = (a.style ?? "").localeCompare(b.style ?? "");
    if (styleCmp) return styleCmp;
    const tierCmp = (b.tier ?? 0) - (a.tier ?? 0);
    if (tierCmp) return tierCmp;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

/** Count matrix style × slot (and style × kind when slot missing). */
export function countByStyleSlot(candidates) {
  const matrix = {};
  for (const c of candidates) {
    const style = c.style ?? "unknown";
    const slot = c.slot ?? "(none)";
    matrix[style] ??= {};
    matrix[style][slot] = (matrix[style][slot] ?? 0) + 1;
  }
  return matrix;
}

export function printStyleSlotMatrix(matrix, label = "style × slot") {
  console.log(label);
  const styles = Object.keys(matrix).sort();
  const slots = [...new Set(styles.flatMap((s) => Object.keys(matrix[s])))].sort((a, b) => {
    if (a === "(none)") return 1;
    if (b === "(none)") return -1;
    return a.localeCompare(b);
  });
  const pad = (s, n) => String(s).padEnd(n);
  const colW = Math.max(10, ...slots.map((s) => s.length));
  console.log(pad("style", 12) + slots.map((s) => pad(s, colW)).join(" ") + "  total");
  for (const style of styles) {
    let total = 0;
    const cells = slots.map((slot) => {
      const n = matrix[style][slot] ?? 0;
      total += n;
      return pad(n || "-", colW);
    });
    console.log(pad(style, 12) + cells.join(" ") + `  ${total}`);
  }
}

/** Tiny HTML fixture check — run: node -e "import('./scripts/lib/equipment-wiki.mjs').then(m=>m.selfCheck())" */
export function selfCheck() {
  const html = `
<div class="mw-heading mw-heading3"><h3>High-level (70+)</h3></div>
<table class="wikitable">
<tr>
  <th>Type</th><th>Tier</th><th>Set</th>
  <th><a href="/w/Head_slot" title="Head slot">H</a></th>
  <th><a href="/w/Torso_slot" title="Torso slot">T</a></th>
  <th><a href="/w/Legs_slot" title="Legs slot">L</a></th>
  <th><a href="/w/Hands_slot" title="Hands slot">G</a></th>
  <th><a href="/w/Feet_slot" title="Feet slot">B</a></th>
</tr>
<tr>
  <td>Power</td><td>90</td>
  <td><a href="/w/Malevolent_armour" title="Malevolent armour">Malevolent armour</a></td>
  <td><a href="/w/Malevolent_helm" title="Malevolent helm"><img/></a></td>
  <td><a href="/w/Malevolent_cuirass" title="Malevolent cuirass"><img/></a></td>
  <td><a href="/w/Malevolent_greaves" title="Malevolent greaves"><img/></a></td>
  <td class="table-na">-</td>
  <td class="table-na">-</td>
</tr>
<tr>
  <td>Tank</td><td>5</td>
  <td><a href="/w/Bronze_equipment" title="Bronze equipment">Bronze</a></td>
  <td><a href="/w/Bronze_full_helm" title="Bronze full helm"><img/></a></td>
  <td><a href="/w/Bronze_platebody" title="Bronze platebody"><img/></a></td>
  <td><a href="/w/Bronze_platelegs" title="Bronze platelegs"><img/></a></td>
  <td><a href="/w/Bronze_gauntlets" title="Bronze gauntlets"><img/></a></td>
  <td><a href="/w/Bronze_armoured_boots" title="Bronze armoured boots"><img/></a></td>
</tr>
</table>
<div class="mw-heading mw-heading2"><h2>Requirements</h2></div>
<table class="wikitable">
<tr><th>Attack Level</th><th>Type</th></tr>
<tr><td>70</td><td><a href="/w/Abyssal_whip" title="Abyssal whip">Abyssal whip</a></td></tr>
<tr><td><a href="/w/Drygore_rapier" title="Drygore rapier">Drygore rapier</a></td></tr>
<tr><td>90</td><td><a href="/w/Noxious_scythe" title="Noxious scythe">Noxious scythe</a></td></tr>
<tr><td>25</td><td><a href="/w/Rune_hatchet" title="Rune hatchet">Rune hatchet</a></td></tr>
</table>`;

  const armour = parseEquipmentPageHtml(html, {
    style: "melee",
    kind: "armour",
    sourcePage: "Armour/Melee armour",
    minTier: 70,
  });
  const weapons = parseEquipmentPageHtml(html, {
    style: "melee",
    kind: "weapon",
    sourcePage: "Weapon/Melee weapons",
    minTier: 70,
  });

  const helm = armour.candidates.find((c) => c.id === "item:malevolent-helm");
  const bronze = armour.candidates.find((c) => c.id === "item:bronze-full-helm");
  const whip = weapons.candidates.find((c) => c.id === "item:abyssal-whip");
  const scythe = weapons.candidates.find((c) => c.id === "item:noxious-scythe");
  const hatchet = weapons.candidates.find((c) => /hatchet/i.test(c.name));
  const drygore = weapons.candidates.find((c) => c.id === "item:drygore-rapier");

  const checks = [
    ["slugId plus", slugId("Iron full helm + 1") === "item:iron-full-helm-plus-1"],
    ["slugId apostrophe", slugId("Dharok's greataxe") === "item:dharoks-greataxe"],
    ["malevolent helm tier 90 helmet", helm?.tier === 90 && helm?.slot === "helmet"],
    ["bronze filtered by min-tier", bronze == null],
    ["armour pieces >= 3", armour.candidates.length >= 3],
    ["abyssal whip tier 70", whip?.tier === 70],
    ["noxious scythe twohand", scythe?.slot === "twohand" && scythe?.tier === 90],
    ["hatchet skipped", hatchet == null],
    ["rowspan drygore inherits 70", drygore?.tier === 70],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) console.log(`  ${ok ? "[OK]" : "[FAIL]"} ${name}`);
  if (failed.length) {
    console.log("selfCheck FAILED", { armour: armour.candidates, weapons: weapons.candidates });
    throw new Error(`equipment-wiki selfCheck: ${failed.length} failure(s)`);
  }
  console.log("equipment-wiki selfCheck OK");
  return true;
}

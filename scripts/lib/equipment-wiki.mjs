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
  "main-hand slot": "mainhand",
  "off hand": "offhand",
  offhand: "offhand",
  "off-hand": "offhand",
  "off hand slot": "offhand",
  "off-hand slot": "offhand",
  "two-handed": "twohand",
  twohand: "twohand",
  "two hand": "twohand",
  "two-hand": "twohand",
  "two-handed slot": "twohand",
  "two hand slot": "twohand",
  "2h": "twohand",
  "2h slot": "twohand",
};

const SKIP_TITLE_RE =
  /^(file|category|template|module|help|special|user|talk|mediawiki):/i;
const SKIP_LINK_RE =
  /^(head slot|torso slot|legs slot|hands slot|feet slot|main hand slot|off.?hand slot|two.?handed? slot|equipment slot|hit chance|life points|prayer|membership subscription|free-to-play|members|defence|attack|strength|ranged|magic|necromancy|constitution|melee|slayer|agility|smithing|fletching|dungeoneering|quest points|skills?)$/i;
const WEAPON_SKIP_RE = /\b(hatchet|pickaxe|hatchets|pickaxes|arrow|arrows|bolt|bolts|grapple)\b/i;
const DISCONTINUED_RE = /\bdiscontinued\b/i;
const FUN_RE = /\bfun\b/i;
/**
 * Sections that are not wearable combat gear tables.
 * Note: do NOT bare-match "bolts" inside "Crossbows (bolts)" — that is a weapon section.
 */
function shouldSkipSection(heading) {
  if (!heading) return false;
  const h = String(heading).trim();
  if (DISCONTINUED_RE.test(h) || FUN_RE.test(h)) return true;
  if (/^(arrows?|bolts?|ammunition|pouches?|mithril grapple|update history|upgrading|other slots|best in slot equipment|best in slot|neckwear|rings?|capes?|ammo|f2p|p2p|free-to-play shields|members shields|defenders)$/i.test(h)) {
    return true;
  }
  if (/\b(ogre and brutal arrows|core thrown weapons|other thrown weapons|other ranged equipment|mithril grapple)\b/i.test(h)) {
    return true;
  }
  // Dedicated ammo subsections only (not "Crossbows (bolts)" / "Bows (arrows)")
  if (/^arrows?\b/i.test(h) || /^bolts?\b/i.test(h) || /^ammunition\b/i.test(h)) return true;
  if (/\b(pouches?|grapple)\b/i.test(h) && !/\b(weapon|crossbow|bow|guard|lantern)\b/i.test(h)) return true;
  return false;
}
/** Non-item wiki titles that ride along in wikitext / notes. */
const JUNK_TITLE_RE =
  /\b(armoursmith|croesus|flakes?|abilit(y|ies)|achievements?|kili'?s knowledge|liberation of mazcab|sostratus|quest points?|music track|emote|title unlock|boss pet|familiar|summoning pouch|grand exchange)\b/i;
const JUNK_EXACT_RE =
  /^(armoursmith|croesus|croesus flakes|defence abilities|attack abilities|strength abilities|ranged abilities|magic abilities|necromancy abilities|constitution abilities|prayer abilities|liberation of mazcab|kili'?s knowledge|teci|starbloom cloth|masterwork white cloth|elite tectonic repair patch|elite tectonic repair patches|tectonic repair patch)$/i;
const MATERIAL_RE =
  /\b(flakes?|cloth|patch(es)?|bars?|ores?|logs?|hides?|leather|scales?|shards?|splinters?|tokens?|teci|essence|runes?|coins?)\b/i;
const ARMOUR_PIECE_RE =
  /\b(helm|helmet|hat|coif|hood|mask|visage|body|top|robe|platebody|chestplate|hauberk|cuirass|legs|skirt|tassets|chaps|cuisse|greaves|gloves|gauntlets|vambraces|cuffs|boots|shoes|sabatons|treads|sallet|coif|faceguard|armour \(top\)|armour \(legs\))\b/i;

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

/**
 * Map wiki slot label / header text → equipment slot id.
 * Armour headers often contain Head/Torso/Legs/Hands/Feet (with or without "slot").
 */
export function mapSlotLabel(label) {
  if (!label) return null;
  const key = String(label).toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!key || key === "equipment slot") return null;
  if (SLOT_MAP[key]) return SLOT_MAP[key];
  // Containment match for icon titles / short headers (armour set tables)
  if (/\bhead\b/.test(key) && !/chance|hit|behead/.test(key)) return "helmet";
  if (/\btorso\b/.test(key)) return "body";
  if (/\bbody\b/.test(key) && !/ability|damage/.test(key)) return "body";
  if (/\blegs?\b/.test(key) && !/legacy/.test(key)) return "legs";
  if (/\bhands?\b/.test(key)) return "gloves";
  if (/\bfeet\b/.test(key)) return "boots";
  if (/\bmain[-\s]?hand\b/.test(key)) return "mainhand";
  if (/\boff[-\s]?hand\b/.test(key)) return "offhand";
  if (/\btwo[-\s]?hand/.test(key) || /\b2h\b/.test(key)) return "twohand";
  return null;
}

/** Section heading → default slot for items listed there. */
export function sectionDefaultSlot(heading, kind) {
  if (!heading) return null;
  const h = String(heading);
  if (kind === "armour") {
    return mapSlotLabel(h) || (
      /^head$/i.test(h) ? "helmet"
        : /^(body|torso)$/i.test(h) ? "body"
          : /^legs$/i.test(h) ? "legs"
            : /^hands$/i.test(h) ? "gloves"
              : /^feet$/i.test(h) ? "boots"
                : /shield/i.test(h) ? "offhand"
                  : null
    );
  }
  // Weapon section families on Weapon/* pages
  if (/\bsiphons?\b/i.test(h)) return "mainhand";
  if (/\bconduits?\b/i.test(h)) return "offhand";
  if (/\b(shortbows?|longbows?|shieldbows?|bows?\s*\(|bows?\s*$)/i.test(h)) return "twohand";
  if (/\b(staves|staff)\b/i.test(h)) return "twohand";
  if (/\borbs?\b/i.test(h)) return "offhand";
  if (/\bwands?\b/i.test(h)) return "mainhand";
  if (/\b(defenders?|shields?|books?)\b/i.test(h)) return "offhand";
  if (/\bthrow/i.test(h)) return "mainhand";
  // Crossbows / mixed dual-wield — leave null; infer from name
  return null;
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
  if (JUNK_EXACT_RE.test(t)) return true;
  if (JUNK_TITLE_RE.test(t)) return true;
  return false;
}

export function shouldSkipCandidate(name, kind, sectionHint = "") {
  if (!name) return true;
  if (isSkippableTitle(name)) return true;
  if (DISCONTINUED_RE.test(sectionHint) || FUN_RE.test(sectionHint)) return true;
  if (shouldSkipSection(sectionHint)) return true;
  if (kind === "weapon" && WEAPON_SKIP_RE.test(name)) return true;
  // Materials / currencies / repair kits (not wearable pieces)
  if (MATERIAL_RE.test(name) && !ARMOUR_PIECE_RE.test(name) && !/\b(staff|wand|bow|sword|rapier|dagger|mace|whip|orb|lantern|guard|crossbow|maul|scythe|spear|halberd|claw|khopesh|chinchompa|javelin|thrownaxe|siphon|conduit)\b/i.test(name)) {
    return true;
  }
  // Armour set / family pages (not a single wearable piece)
  if (kind === "armour") {
    if (/\b(armour|armor|equipment|set)\s*$/i.test(name) && !ARMOUR_PIECE_RE.test(name)) {
      return true;
    }
  }
  // Family / list pages that are not wearable pieces
  if (/\b(weapons?|equipment|armour|armor)\s*$/i.test(name) && !/\b(plate|chain|robe)\b/i.test(name)) {
    if (/^(bronze|iron|steel|black|white|mithril|adamant|rune|dragon|orikalkum|necronium|bane|elder rune|primal)\s+(weapons?|equipment)$/i.test(name)) {
      return true;
    }
  }
  // Generic plural family indexes
  if (/^(siphons?|conduits?|shortbows?|longbows?|crossbows?|wands?|orbs?|staves|shields?|defenders?)$/i.test(name)) {
    return true;
  }
  return false;
}

/** Extract article links from a cell: { title, name, href }. */
export function extractItemLinks(cellHtml) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href="\/w\/([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(cellHtml)) !== null) {
    const hrefTitle = decodeURIComponent(match[1].replace(/_/g, " "));
    const attrs = match[0];
    const titleAttr = /title="([^"]*)"/i.exec(attrs);
    const wikiTitle = titleAttr ? decodeHtml(titleAttr[1]) : hrefTitle;
    const name = stripTags(match[2]) || wikiTitle;
    if (isSkippableTitle(wikiTitle) || isSkippableTitle(name)) continue;
    if (/^File:/i.test(hrefTitle)) continue;
    const key = wikiTitle.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
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
  const skill = /^(\d{1,3})\s+(defence|attack|strength|ranged|magic|necromancy|constitution|prayer|dungeoneering|agility|smithing)\b/i.exec(t);
  if (skill) {
    const n = Number(skill[1]);
    return n >= 1 && n <= 120 ? n : null;
  }
  // "70 (tier 70)" style leftovers — still reject free prose with multiple numbers
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
  // Necromancy: siphons / death guards / omni guard = mainhand; lanterns / conduits = offhand
  if (/\b(skull lantern|lantern|conduit|soulbound lantern|ruinous lantern|gravite lantern)\b/.test(n)) {
    return "offhand";
  }
  if (/\b(death guard|gravite guard|ruinous guard|omni guard|devourer'?s guard|siphon|chaotic guard)\b/.test(n)) {
    return "mainhand";
  }
  if (
    /\b(2h|two[-\s]?handed?)\b/.test(n) ||
    /\b(godsword|scythe|halberd|maul|battlestaff|staff|longbow|shortbow|shieldbow|godbow|bow of|noxious longbow|seren godbow|hexhunter bow|zaryte bow|dark bow|chargebow|seercull|decimation|hellfire bow|gloomfire bow|masterwork bow|crystal bow|attuned crystal bow|winds of waiko|sunspear|spear of annihilation|masterwork spear|terrasaur maul|ek-zekkil|tumeken'?s light|bow of the last guardian)\b/.test(n)
  ) {
    // 1h crossbows are mainhand; 2h eldritch is twohand
    if (/\bcrossbow\b/.test(n) && !/\beldritch crossbow\b/.test(n) && !/\b(2h|two[-\s]?hand)/.test(n)) {
      // fall through — handled below
    } else if (!/\bcrossbow\b/.test(n) || /\beldritch crossbow\b/.test(n)) {
      return "twohand";
    }
  }
  if (/\b(eldritch crossbow)\b/.test(n)) return "twohand";
  if (/\b(defender|orb|book of|focus sight|shield|buckler|repriser|ward)\b/.test(n) && !/\bshieldbow\b/.test(n)) {
    return "offhand";
  }
  // Default 1h weapons to mainhand when no off-hand cue
  if (/\b(wand|rapier|dagger|scimitar|longsword|sword|mace|whip|claw|khopesh|crossbow|thrownaxe|javelin|chinchompa|dart|knife|throwing)\b/.test(n)) {
    return "mainhand";
  }
  // Generic "bow" leftover
  if (/\bbow\b/.test(n)) return "twohand";
  if (/\b(staff|spear|halberd|maul|scythe)\b/.test(n)) return "twohand";
  return null;
}

function cellColspan(attrs) {
  const m = /\bcolspan\s*=\s*["']?(\d+)/i.exec(attrs);
  return m ? Math.max(1, Number(m[1])) : 1;
}

function resolveHeaderLabel(cell) {
  // Prefer slot icon titles / hrefs (Head slot, Two-handed slot, …)
  const titleMatches = [...cell.html.matchAll(/title="([^"]+)"/gi)].map((m) => decodeHtml(m[1]));
  for (const t of titleMatches) {
    const slot = mapSlotLabel(t);
    if (slot) return t;
    if (/slot$/i.test(t) && !/^equipment slot$/i.test(t)) return t;
  }
  const hrefMatch = /href="\/w\/([^"#?]+)"/i.exec(cell.html);
  if (hrefMatch) {
    const t = decodeURIComponent(hrefMatch[1].replace(/_/g, " "));
    if (mapSlotLabel(t) || (/slot$/i.test(t) && !/^equipment slot$/i.test(t))) return t;
  }
  // "Level" under a combat skill icon — keep as Level (tier)
  const text = cell.text || "";
  if (/^level$/i.test(text) || /level$/i.test(text)) return "Level";
  // th title="Equipment slot" → Slot (handedness column, not a piece slot)
  if (/equipment slot/i.test(cell.html) || /^slot$/i.test(text)) return "Slot";
  return text;
}

/**
 * Parse one wikitable into header labels + raw cell HTML rows.
 * Expands colspan on headers so column indices align with data cells
 * (Weapon/* pages use colspan=2 Item = image + name).
 */
export function parseTable(tableHtml) {
  // Skip navboxes / non-data tables early
  if (/\bnavbox\b/i.test(tableHtml.slice(0, 200))) return null;

  const trs = tableHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  if (trs.length === 0) return null;
  const rows = [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<t([dh])(\s[^>]*)?>([\s\S]*?)<\/t\1>/gi)].map((m) => {
      const attrs = m[2] || "";
      return {
        tag: m[1].toLowerCase(),
        html: m[3],
        text: stripTags(m[3]),
        colspan: cellColspan(attrs),
        attrs,
      };
    });
    if (cells.length) rows.push(cells);
  }
  if (rows.length === 0) return null;

  // Header row: first row with th that isn't a single-cell spacer
  let headerIdx = rows.findIndex(
    (r) => r.some((c) => c.tag === "th") && r.filter((c) => c.tag === "th").length >= 2,
  );
  if (headerIdx < 0) {
    headerIdx = rows.findIndex((r) => r.some((c) => c.tag === "th"));
  }
  if (headerIdx < 0) {
    headerIdx = rows.findIndex((r) =>
      r.some((c) => /^(type|tier|set|item|weapon|name|attack level|level|slot)$/i.test(c.text)),
    );
  }
  if (headerIdx < 0) headerIdx = 0;

  const headerCells = rows[headerIdx];
  // Expand colspan so [Item colspan=2] → ["Item","Item"] aligning image+name data cells
  const headers = [];
  for (const cell of headerCells) {
    const label = resolveHeaderLabel(cell);
    for (let i = 0; i < cell.colspan; i++) headers.push(label);
  }

  // Drop pure continuation header rows (hidden th, empty) from data
  const dataRows = rows.slice(headerIdx + 1).filter((r) => {
    if (r.every((c) => c.tag === "th" && (!c.text || c.text.length < 2))) return false;
    // spacer rows: single empty th colspan
    if (r.length === 1 && r[0].tag === "th" && !r[0].text) return false;
    return true;
  });

  return {
    headers,
    headerCells,
    dataRows,
  };
}

function colIndex(headers, predicates) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    if (predicates.some((p) => (typeof p === "string" ? h === p || (p.length > 3 && h.includes(p)) : p.test(h)))) {
      return i;
    }
  }
  return -1;
}

/** First combat-skill Level column (not secondary skill Level). */
function tierColumnIndex(headers) {
  // Prefer explicit Tier, then Attack/Ranged/Magic/Necromancy Level, then plain Level
  let idx = colIndex(headers, [/^tier$/i]);
  if (idx >= 0) return idx;
  idx = colIndex(headers, [/^attack level$/i, /^ranged level$/i, /^magic level$/i, /^necromancy level$/i, /^defence level$/i]);
  if (idx >= 0) return idx;
  // Plain "Level" — take the first
  return colIndex(headers, [/^level$/i, "level"]);
}

function nameColumnIndex(headers) {
  // Exact item/name only — do NOT match "equipment slot" via includes("equipment")
  return colIndex(headers, [/^item$/i, /^name$/i, /^weapon$/i, /^armour$/i, /^armor$/i]);
}

function slotColumns(headers) {
  const cols = [];
  const seen = new Set();
  for (let i = 0; i < headers.length; i++) {
    const slot = mapSlotLabel(headers[i]);
    // Skip handedness "Slot" column — only piece columns (head/torso/… or main/off/two hand as set cols)
    if (!slot) continue;
    // Handedness column labeled just "Slot" / "Equipment slot" is not a piece column
    if (/^slot$/i.test(headers[i].trim())) continue;
    if (seen.has(i)) continue;
    // Avoid treating a single handedness icon column as armour set columns
    cols.push({ index: i, slot, label: headers[i] });
    seen.add(i);
  }
  return cols;
}

/** Read slot from a data cell (icon link title or text). */
export function parseSlotFromCell(cell) {
  if (!cell) return null;
  for (const m of cell.html.matchAll(/title="([^"]+)"/gi)) {
    const s = mapSlotLabel(decodeHtml(m[1]));
    if (s) return s;
  }
  for (const m of cell.html.matchAll(/href="\/w\/([^"#?]+)"/gi)) {
    const s = mapSlotLabel(decodeURIComponent(m[1].replace(/_/g, " ")));
    if (s) return s;
  }
  const text = cell.text || "";
  if (/two/i.test(text)) return "twohand";
  if (/off/i.test(text)) return "offhand";
  if (/main/i.test(text)) return "mainhand";
  return mapSlotLabel(text);
}

function makeCandidate({ name, wikiTitle, style, kind, tier, slot, setName, sourcePage, section, parsePath }) {
  const title = wikiTitle || name;
  if (shouldSkipCandidate(title, kind, section) || shouldSkipCandidate(name, kind, section)) {
    return null;
  }
  // Prefer display name from text links over empty/image-derived
  const display = (name && name.trim() && !/^\[/.test(name) ? name : title).trim();
  const out = {
    id: slugId(title),
    name: display || title,
    wikiTitle: title,
    style,
    kind,
    sourcePage,
  };
  if (tier != null) out.tier = tier;
  if (slot) out.slot = slot;
  if (setName) out.setName = setName;
  if (section) out.section = section;
  if (parsePath) out.parsePath = parsePath;
  return out;
}

/**
 * Armour set tables: Tier + Head/Torso/Legs/Hands/Feet piece columns.
 * Also harvests Set column as setName context.
 */
export function parseArmourSetTable(table, { style, sourcePage, section, minTier }) {
  const { headers, dataRows } = table;
  const tierIdx = colIndex(headers, [/^tier$/i, "tier"]);
  const setIdx = colIndex(headers, [/^set$/i, /^set name$/i, "armour set"]);
  const slots = slotColumns(headers).filter((s) =>
    ["helmet", "body", "legs", "gloves", "boots"].includes(s.slot),
  );
  if (tierIdx < 0 || slots.length === 0) return [];

  const candidates = [];
  for (const row of dataRows) {
    // Align by min length when colspan left residual mismatch
    const tier = parseTierFromText(row[tierIdx]?.text ?? "");
    if (tier == null || tier < minTier) continue;
    const setLinks = setIdx >= 0 ? extractItemLinks(row[setIdx]?.html ?? "") : [];
    const setName =
      setLinks[0]?.name ??
      (setIdx >= 0 ? row[setIdx]?.text : null) ??
      null;
    // Skip if setName is the only link target (already filtered) — still harvest pieces

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
          parsePath: "table",
        });
        if (c) candidates.push(c);
      }
    }
  }
  return candidates;
}

/**
 * Collect item links from a name column, also checking adjacent image cell
 * when Item is split image|name (plinkt-image + plinkt-link).
 */
function linksFromNameColumn(row, nameIdx) {
  const cells = [];
  if (nameIdx >= 0 && row[nameIdx]) cells.push(row[nameIdx]);
  // Prefer text link cell next to image when present
  if (nameIdx >= 0 && row[nameIdx + 1] && /plinkt-link|text-align:\s*left/i.test(row[nameIdx + 1].html + (row[nameIdx + 1].attrs || ""))) {
    cells.unshift(row[nameIdx + 1]);
  }
  // If nameIdx points at first of two Item cols, also try nameIdx+1 always
  if (nameIdx >= 0 && row[nameIdx + 1]) cells.push(row[nameIdx + 1]);
  const out = [];
  const seen = new Set();
  for (const cell of cells) {
    for (const link of extractItemLinks(cell.html)) {
      const k = link.wikiTitle.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(link);
    }
  }
  return out;
}

/**
 * Non-set armour / generic item tables: Item|Name + Tier/Level columns, optional slot.
 * Handles Weapon/Ranged (Item colspan image+name, Level, Slot icon) and
 * Weapon/Necromancy (Item colspan, Level, no slot col — section default).
 */
export function parseGenericItemTable(table, { style, kind, sourcePage, section, minTier, defaultSlot }) {
  const { headers, dataRows } = table;
  const tierIdx = tierColumnIndex(headers);
  const nameIdx = nameColumnIndex(headers);
  const slotIdx = colIndex(headers, [/^slot$/i, /^handedness$/i]);
  const slots = slotColumns(headers).filter((s) => {
    // For weapons, piece-style columns rare; keep armour piece slots for hybrid tables
    if (kind === "weapon") return ["mainhand", "offhand", "twohand"].includes(s.slot);
    return true;
  });

  // Level-list style: Attack Level | Type (links) — common on Weapon/Melee|Magic pages
  const levelList =
    tierIdx >= 0 &&
    nameIdx < 0 &&
    headers.some((h) => /level|type|weapon/i.test(h));

  // Material/upgrade tables: Tier + Material — skip for weapon kind
  if (kind === "weapon" && /material/i.test(headers.join(" ")) && !/damage|accuracy|item/i.test(headers.join(" "))) {
    return [];
  }

  const candidates = [];
  let rowspanTier = null;

  for (const row of dataRows) {
    // Skip sub-header / material separator rows
    if (row.every((c) => c.tag === "th")) continue;

    let tier = tierIdx >= 0 ? parseTierFromText(row[tierIdx]?.text ?? "") : null;

    if (levelList) {
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
            parsePath: "table",
          });
          if (c) candidates.push(c);
        }
      }
      continue;
    }

    if (tier != null) rowspanTier = tier;
    else if (rowspanTier != null && tierIdx >= 0 && !(row[tierIdx]?.text ?? "").trim()) {
      tier = rowspanTier;
    }

    // Try scanning pure-number cells if tier column misaligned
    if (tier == null) {
      for (let i = 0; i < row.length; i++) {
        if (i === nameIdx || i === nameIdx + 1) continue;
        const t = parseTierFromText(row[i]?.text ?? "");
        if (t != null) {
          tier = t;
          break;
        }
      }
    }

    if (tier != null && tier < minTier) continue;

    if (nameIdx >= 0) {
      let links = linksFromNameColumn(row, nameIdx);
      // Fallback: any item links in the row (image-only name col)
      if (links.length === 0) {
        for (const cell of row) {
          links = links.concat(extractItemLinks(cell.html));
        }
        // Dedupe
        const seen = new Set();
        links = links.filter((l) => {
          const k = l.wikiTitle.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
      if (tier == null) {
        // last resort: (tier N) in item name
        for (const link of links) {
          const m = /\(tier\s*(\d{1,3})\)/i.exec(link.wikiTitle);
          if (m) {
            const n = Number(m[1]);
            if (n >= 1 && n <= 120) {
              tier = n;
              break;
            }
          }
        }
      }
      if (tier == null || tier < minTier) continue;

      let slot = defaultSlot;
      if (slotIdx >= 0) {
        slot = parseSlotFromCell(row[slotIdx]) || slot;
      }
      if (slots.length === 1) slot = slots[0].slot;

      for (const link of links) {
        // Skip price/members icon links already filtered; skip skill pages
        const resolvedSlot =
          slot ||
          (kind === "weapon" ? inferWeaponSlot(link.wikiTitle) : mapSlotLabel(section)) ||
          undefined;
        const c = makeCandidate({
          name: link.name,
          wikiTitle: link.wikiTitle,
          style,
          kind,
          tier,
          slot: resolvedSlot,
          sourcePage,
          section,
          parsePath: "table",
        });
        if (c) candidates.push(c);
      }
      continue;
    }

    // Slot columns without set structure (rare hybrid tables)
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
            parsePath: "table",
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
 * Marked parsePath=wikitext — table rows with slots win on dedupe.
 */
export function parseWikitextTierLinks(wikitext, { style, kind, sourcePage, minTier }) {
  const candidates = [];
  const sections = String(wikitext).split(/(?=^={2,3}\s*[^=].*?={2,3}\s*$)/m);
  for (const block of sections) {
    const headingMatch = /^={2,3}\s*(.*?)\s*={2,3}/.exec(block);
    const section = headingMatch ? stripTags(headingMatch[1].replace(/\[\[|\]\]/g, "")) : "";
    if (DISCONTINUED_RE.test(section) || FUN_RE.test(section)) continue;
    if (shouldSkipSection(section)) continue;
    // Prefer high-level / requirements / combat stats / 70+
    if (
      kind === "weapon" &&
      section &&
      !/(requirement|combat stat|stat comparison|high.?level|70|80|90|weaponry|equipment|siphon|conduit|shortbow|longbow|crossbow|wand|orb|staff|throw)/i.test(section) &&
      !/(drygore|noxious|chaotic|barrows|god wars|crystal|elite)/i.test(section)
    ) {
      continue;
    }
    // Armour wikitext: only high-level / tank / power sections
    if (
      kind === "armour" &&
      section &&
      !/(high.?level|70|80|90|tank|power|head|body|hands|feet|legs|non-set)/i.test(section)
    ) {
      continue;
    }
    const lines = block.split("\n");
    let lastTier = null;
    for (const line of lines) {
      const cleaned = line.replace(/\{\{[^}]+\}\}/g, " ");
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
            ? inferWeaponSlot(wikiTitle) || sectionDefaultSlot(section, kind)
            : sectionDefaultSlot(section, kind) || mapSlotLabel(section) || undefined;
        const c = makeCandidate({
          name,
          wikiTitle,
          style,
          kind,
          tier: lastTier,
          slot: slot || undefined,
          sourcePage,
          section: section || "wikitext",
          parsePath: "wikitext",
        });
        if (c) candidates.push(c);
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
  if (matches[0].index > 0) {
    parts.unshift({ heading: "", body: html.slice(0, matches[0].index) });
  }
  return parts;
}

/**
 * Extract all equipment candidates from a rendered list page.
 * Prefer HTML tables; wikitext is a separate path in the sync script.
 */
export function parseEquipmentPageHtml(html, { style, kind, sourcePage, minTier = 70 }) {
  const candidates = [];
  const warnings = [];
  const sections = splitSections(html);

  for (const { heading, body } of sections) {
    if (DISCONTINUED_RE.test(heading) || FUN_RE.test(heading)) continue;
    if (shouldSkipSection(heading)) continue;

    const sectionSlot = sectionDefaultSlot(heading, kind);

    // Only wikitables / sortable bonus tables — skip navboxes (parseTable already nulls navbox)
    const tables = body.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
    for (const tableHtml of tables) {
      const table = parseTable(tableHtml);
      if (!table || table.headers.length < 2) continue;

      const pieceSlots = slotColumns(table.headers).filter((s) =>
        ["helmet", "body", "legs", "gloves", "boots"].includes(s.slot),
      );
      const hasTier = table.headers.some((h) => /^tier$/i.test(h.trim()));
      const isArmourSet = kind === "armour" && hasTier && pieceSlots.length >= 2;

      let found = [];
      if (isArmourSet) {
        found = parseArmourSetTable(table, {
          style,
          sourcePage,
          section: heading,
          minTier,
        });
      } else if (kind === "armour" && !sectionSlot && pieceSlots.length === 0) {
        // Detail/material tables under "Malevolent (90)" etc. — no piece columns, no
        // Head/Body section context. Skip rather than harvest unslotted junk.
        found = [];
      } else {
        found = parseGenericItemTable(table, {
          style,
          kind,
          sourcePage,
          section: heading,
          minTier,
          defaultSlot: sectionSlot || undefined,
        });
        // Armour must carry a slot (set column or section heading)
        if (kind === "armour") found = found.filter((c) => c.slot);
      }
      for (const c of found) candidates.push(c);
    }
  }

  if (candidates.length === 0) {
    warnings.push(`${sourcePage}: no table candidates above tier ${minTier}`);
  }
  return { candidates, warnings };
}

function candidateScore(x) {
  // Prefer table-parsed rows with explicit slot over wikitext harvest junk
  return (
    (x.parsePath === "table" ? 10 : 0) +
    (x.parsePath === "wikitext" ? 0 : x.parsePath ? 4 : 6) +
    (x.slot ? 5 : 0) +
    (x.setName ? 2 : 0) +
    (x.tier != null ? 1 : 0)
  );
}

/**
 * Deduplicate candidates by id+style+kind (one slot per piece).
 * Prefer table-parsed rows with explicit slot over wikitext harvest.
 */
export function dedupeCandidates(list) {
  const map = new Map();
  for (const c of list) {
    const key = `${c.id}|${c.style}|${c.kind}`;
    const prev = map.get(key);
    if (!prev || candidateScore(c) > candidateScore(prev)) map.set(key, c);
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

/** Slot presence counts by style (for sync report). */
export function countSlotPresence(candidates) {
  const out = {};
  for (const c of candidates) {
    const style = c.style ?? "unknown";
    out[style] ??= { withSlot: 0, withoutSlot: 0, total: 0 };
    out[style].total += 1;
    if (c.slot) out[style].withSlot += 1;
    else out[style].withoutSlot += 1;
  }
  return out;
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
</table>
<div class="mw-heading mw-heading3"><h3>Shortbows</h3></div>
<table class="wikitable">
<tr>
  <th colspan="2">Item</th>
  <th>Level</th>
  <th title="Equipment slot">Slot</th>
</tr>
<tr>
  <td class="plinkt-image"><a href="/w/Yew_shortbow" title="Yew shortbow"><img/></a></td>
  <td class="plinkt-link"><a href="/w/Yew_shortbow" title="Yew shortbow">Yew shortbow</a></td>
  <td>70</td>
  <td><a href="/w/Two-handed_slot" title="Two-handed slot"><img/></a></td>
</tr>
<tr>
  <td class="plinkt-image"><a href="/w/Oak_shortbow" title="Oak shortbow"><img/></a></td>
  <td class="plinkt-link"><a href="/w/Oak_shortbow" title="Oak shortbow">Oak shortbow</a></td>
  <td>10</td>
  <td><a href="/w/Two-handed_slot" title="Two-handed slot"><img/></a></td>
</tr>
</table>
<div class="mw-heading mw-heading2"><h2>Siphons</h2></div>
<table class="wikitable">
<tr><th colspan="2">Item</th><th>Level</th><th>Damage</th></tr>
<tr>
  <td class="plinkt-image"><a href="/w/Death_guard_(tier_70)" title="Death guard (tier 70)"><img/></a></td>
  <td class="plinkt-link"><a href="/w/Death_guard_(tier_70)" title="Death guard (tier 70)">Death guard (tier 70)</a></td>
  <td>70</td><td>672</td>
</tr>
<tr>
  <td class="plinkt-image"><a href="/w/Omni_guard" title="Omni guard"><img/></a></td>
  <td class="plinkt-link"><a href="/w/Omni_guard" title="Omni guard">Omni guard</a></td>
  <td>95</td><td>912</td>
</tr>
</table>
<div class="mw-heading mw-heading2"><h2>Conduits</h2></div>
<table class="wikitable">
<tr><th colspan="2">Item</th><th>Level</th></tr>
<tr>
  <td class="plinkt-image"><a href="/w/Skull_lantern_(tier_90)" title="Skull lantern (tier 90)"><img/></a></td>
  <td class="plinkt-link"><a href="/w/Skull_lantern_(tier_90)" title="Skull lantern (tier 90)">Skull lantern (tier 90)</a></td>
  <td>90</td>
</tr>
</table>
<div class="mw-heading mw-heading2"><h2>Arrows</h2></div>
<table class="wikitable">
<tr><th colspan="2">Item</th><th>Level</th></tr>
<tr>
  <td><a href="/w/Rune_arrow" title="Rune arrow">Rune arrow</a></td>
  <td></td>
  <td>50</td>
</tr>
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
  const ranged = parseEquipmentPageHtml(html, {
    style: "ranged",
    kind: "weapon",
    sourcePage: "Weapon/Ranged weapons",
    minTier: 70,
  });
  const necro = parseEquipmentPageHtml(html, {
    style: "necromancy",
    kind: "weapon",
    sourcePage: "Weapon/Necromancy weapons",
    minTier: 70,
  });

  const helm = armour.candidates.find((c) => c.id === "item:malevolent-helm");
  const bronze = armour.candidates.find((c) => c.id === "item:bronze-full-helm");
  const whip = weapons.candidates.find((c) => c.id === "item:abyssal-whip");
  const scythe = weapons.candidates.find((c) => c.id === "item:noxious-scythe");
  const hatchet = weapons.candidates.find((c) => /hatchet/i.test(c.name));
  const drygore = weapons.candidates.find((c) => c.id === "item:drygore-rapier");
  const yew = ranged.candidates.find((c) => c.id === "item:yew-shortbow");
  const oak = ranged.candidates.find((c) => c.id === "item:oak-shortbow");
  const arrow = ranged.candidates.find((c) => /arrow/i.test(c.name));
  const deathGuard = necro.candidates.find((c) => c.id === "item:death-guard-tier-70");
  const omni = necro.candidates.find((c) => c.id === "item:omni-guard");
  const lantern = necro.candidates.find((c) => c.id === "item:skull-lantern-tier-90");
  const junk = shouldSkipCandidate("Armoursmith", "armour", "Tank armours");
  const flakes = shouldSkipCandidate("croesus flakes", "armour", "Tank armours");

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
    ["yew shortbow twohand tier 70", yew?.slot === "twohand" && yew?.tier === 70],
    ["oak shortbow filtered", oak == null],
    ["arrows section skipped", arrow == null],
    ["death guard mainhand 70", deathGuard?.slot === "mainhand" && deathGuard?.tier === 70],
    ["omni guard mainhand 95", omni?.slot === "mainhand" && omni?.tier === 95],
    ["skull lantern offhand 90", lantern?.slot === "offhand" && lantern?.tier === 90],
    ["junk Armoursmith skipped", junk === true],
    ["junk flakes skipped", flakes === true],
    ["table parsePath", helm?.parsePath === "table"],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) console.log(`  ${ok ? "[OK]" : "[FAIL]"} ${name}`);
  if (failed.length) {
    console.log("selfCheck FAILED", {
      armour: armour.candidates,
      weapons: weapons.candidates,
      ranged: ranged.candidates,
      necro: necro.candidates,
    });
    throw new Error(`equipment-wiki selfCheck: ${failed.length} failure(s)`);
  }
  console.log("equipment-wiki selfCheck OK");
  return true;
}

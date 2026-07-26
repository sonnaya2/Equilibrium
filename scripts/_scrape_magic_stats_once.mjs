/**
 * One-shot: scrape Infobox Bonuses for style===magic wearables.
 * Writes ONLY scraped-data/equipment-stats-magic-2026-07-26.json
 * Does not touch data/combat/equipment.json
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wikiApi, wikiSources } from "./lib/runescape-wiki.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = "2026-07-26";
const OUT = join(ROOT, "scraped-data", `equipment-stats-magic-${TODAY}.json`);
const EQ = join(ROOT, "data/combat/equipment.json");

const ARMOUR_SLOTS = new Set(["helmet", "body", "legs", "gloves", "boots"]);
const WEAPON_SLOTS = new Set(["mainhand", "offhand", "twohand"]);

/** setId inference from piece names (armour only). First match wins. */
const SET_RULES = [
  [/elite\s+tectonic/i, "elite-tectonic"],
  [/\btectonic\b/i, "tectonic"],
  [/\bvirtus\b/i, "virtus"],
  [/\bcryptbloom\b/i, "cryptbloom"],
  [/tumeken.?s\s+resplendence/i, "tumekens-resplendence"],
  [/\bsubjugation\b/i, "subjugation"],
  [/anima\s+core\s+of\s+seren/i, "anima-core-seren"],
  [/\bganodermic\b/i, "ganodermic"],
  [/\bseasinger\b/i, "seasinger"],
  [/superior\s+zuriel/i, "superior-zuriel"],
  [/\bzuriel/i, "zuriel"],
  [/ancestral/i, "ancestral"],
  [/achto\s+primeval/i, "achto-primeval"],
  [/\bprimeval\b/i, "primeval"],
  [/t90\s+tanzanite/i, "tanzanite"],
  [/t90\s+seasinger/i, "seasinger"],
  [/elite\s+sirenic/i, "elite-sirenic"],
  [/sirenic/i, "sirenic"],
  [/lunar\s+(staff|helm|torso|legs|gloves|boots|cape)/i, "lunar"],
  [/mystic\s+/i, "mystic"],
  [/batwing/i, "batwing"],
  [/infinity/i, "infinity"],
  [/dagon'?hai/i, "dagonhai"],
  [/aetherium/i, "aetherium"],
  [/druidic/i, "druidic"],
  [/skeletal/i, "skeletal"],
  [/splitbark/i, "splitbark"],
  [/robe\s+of\s+darkness/i, "robe-of-darkness"],
  [/superior\s+sea\s*singer/i, "superior-seasinger"],
  [/haunted\s+/i, "haunted"],
  [/agent\s+of\s+the\s+dark/i, "agent-of-the-dark"],
  [/warpriest\s+of\s+armadyl/i, "warpriest-armadyl"],
  [/warpriest\s+of\s+saradomin/i, "warpriest-saradomin"],
  [/warpriest\s+of\s+zamorak/i, "warpriest-zamorak"],
  [/warpriest\s+of\s+bandos/i, "warpriest-bandos"],
  [/warpriest\s+of\s+zaros/i, "warpriest-zaros"],
  [/warpriest\s+of\s+sliske/i, "warpriest-sliske"],
  [/anima\s+core\s+of\s+sliske/i, "anima-core-sliske"],
  [/anima\s+core\s+of\s+zamorak/i, "anima-core-zamorak"],
  [/refined\s+anima\s+core\s+of\s+seren/i, "refined-anima-core-seren"],
  [/refined\s+anima\s+core\s+of\s+sliske/i, "refined-anima-core-sliske"],
];

const PRIORITY_RE =
  /fractured\s+staff\s+of\s+armadyl|staff\s+of\s+armadyl|staff\s+of\s+sliske|noxious\s+staff|inquisitor\s+staff|seismic\s+(wand|singularity)|wand\s+of\s+the\s+praesul|imperium\s+core|roar\s+of\s+awakening|ode\s+to\s+deceit|elite\s+tectonic|tectonic|virtus|cryptbloom|subjugation|anima\s+core\s+of\s+seren|tumeken.?s\s+resplendence|ganodermic|seasinger|hailfire|blast\s+diffusion|masterwork\s+staff|igneous\s+kal-mej/i;

function wikiTitleFromRecord(r) {
  const url = r.sources?.find((s) => s.url?.includes("runescape.wiki"))?.url;
  if (url) {
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/w\/(.+)$/);
      if (m) return decodeURIComponent(m[1].replace(/_/g, " "));
    } catch {
      /* fall through */
    }
  }
  return r.name;
}

function parseNum(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/,/g, "").replace(/[^\d.+-eE]/g, "").trim();
  if (!s || s === "-" || s === "+") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Extract first {{Infobox Bonuses ...}} parameter map from wikitext. */
function parseInfoboxBonuses(wikitext) {
  if (!wikitext) return null;
  const start = wikitext.search(/\{\{\s*Infobox\s+Bonuses\b/i);
  if (start < 0) return null;
  // Brace-match template body
  let i = start;
  let depth = 0;
  let end = -1;
  for (; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i++;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) return null;
  const body = wikitext.slice(start, end);
  // Drop nested templates content for param parse simplicity: replace {{...}} once
  let flat = body;
  // Remove nested {{ }} by iterative replace of innermost
  for (let n = 0; n < 20; n++) {
    const next = flat.replace(/\{\{[^{}]*\}\}/g, " ");
    if (next === flat) break;
    flat = next;
  }
  // First line is template name — strip
  flat = flat.replace(/^\{\{\s*Infobox\s+Bonuses/i, "");
  flat = flat.replace(/\}\}$/, "");
  const params = {};
  for (const part of flat.split("|")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const val = part.slice(eq + 1).replace(/\s+/g, " ").trim();
    if (!key) continue;
    params[key] = val;
  }
  return params;
}

function pick(params, base) {
  if (!params) return null;
  if (params[base] != null && String(params[base]).trim() !== "") return params[base];
  // Prefer version 1 (Normal / new)
  if (params[`${base}1`] != null && String(params[`${base}1`]).trim() !== "") return params[`${base}1`];
  // Any other numbered version
  for (const k of Object.keys(params)) {
    if (k === base || (k.startsWith(base) && /^\d+$/.test(k.slice(base.length)))) {
      if (String(params[k]).trim() !== "") return params[k];
    }
  }
  return null;
}

/**
 * Map wiki Infobox Bonuses → { damage, accuracy, armour, prayer }.
 * Magic style bonus (magic=) → damage. Weapon damage= only if non-zero and no style bonus.
 */
function mapBonuses(params) {
  if (!params) return { bonuses: {}, raw: null };
  const accuracy = parseNum(pick(params, "accuracy"));
  const armour = parseNum(pick(params, "armour"));
  const prayer = parseNum(pick(params, "prayer"));
  // Style bonuses: magic / melee / ranged / necromancy
  const styleBonus =
    parseNum(pick(params, "magic")) ??
    parseNum(pick(params, "melee")) ??
    parseNum(pick(params, "ranged")) ??
    parseNum(pick(params, "necromancy")) ??
    parseNum(pick(params, "strength")); // legacy rare
  const weaponDamage = parseNum(pick(params, "damage"));

  const bonuses = {};
  if (accuracy != null) bonuses.accuracy = accuracy;
  if (armour != null) bonuses.armour = armour;
  if (prayer != null && prayer !== 0) bonuses.prayer = prayer;
  // Prefer style bonus as damage (armour / jewellery). Else non-zero weapon damage.
  if (styleBonus != null && styleBonus !== 0) bonuses.damage = styleBonus;
  else if (weaponDamage != null && weaponDamage !== 0) bonuses.damage = weaponDamage;

  return {
    bonuses,
    raw: {
      accuracy: pick(params, "accuracy"),
      armour: pick(params, "armour"),
      prayer: pick(params, "prayer"),
      magic: pick(params, "magic"),
      damage: pick(params, "damage"),
      tier: pick(params, "tier"),
      class: pick(params, "class"),
      slot: pick(params, "slot"),
      type: pick(params, "type"),
    },
  };
}

function inferSetId(name, existing, slot) {
  if (existing) return existing;
  if (!ARMOUR_SLOTS.has(slot) && slot !== "cape") return undefined;
  for (const [re, id] of SET_RULES) {
    if (re.test(name)) return id;
  }
  return undefined;
}

function hasAnyBonus(b) {
  return b && Object.keys(b).length > 0;
}

async function resolveTitle(title) {
  // Follow redirects via query
  const data = await wikiApi({
    action: "query",
    prop: "info",
    titles: title,
    redirects: "1",
  });
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  return page.title;
}

const eq = JSON.parse(await readFile(EQ, "utf8"));
const wearables = (eq.records ?? []).filter((r) => r.style === "magic" && r.slot);
console.log(`magic wearables: ${wearables.length}`);

// Build unique wiki titles
const items = wearables.map((r) => {
  const wikiTitle = wikiTitleFromRecord(r);
  return {
    id: r.id,
    name: r.name,
    slot: r.slot,
    tier: r.tier ?? null,
    setId: r.setId,
    existingBonuses: r.bonuses ?? {},
    wikiTitle,
    sourceUrl: r.sources?.find((s) => s.url)?.url ?? null,
    priority: PRIORITY_RE.test(r.name) || PRIORITY_RE.test(wikiTitle),
  };
});

// Resolve titles (redirects) in batches via query — wikiSources uses exact titles
const uniqueTitles = [...new Set(items.map((i) => i.wikiTitle))];
const titleMap = new Map(); // requested → canonical or null
for (let i = 0; i < uniqueTitles.length; i += 40) {
  const batch = uniqueTitles.slice(i, i + 40);
  const data = await wikiApi({
    action: "query",
    prop: "info",
    titles: batch.join("|"),
    redirects: "1",
  });
  // Map normalized request → page
  const redirects = new Map((data?.query?.redirects ?? []).map((r) => [r.from, r.to]));
  const normalized = new Map((data?.query?.normalized ?? []).map((n) => [n.from, n.to]));
  const byTitle = new Map((data?.query?.pages ?? []).map((p) => [p.title, p]));
  for (const t of batch) {
    let cur = t;
    if (normalized.has(cur)) cur = normalized.get(cur);
    if (redirects.has(cur)) cur = redirects.get(cur);
    // chain one more redirect hop if present
    if (redirects.has(cur)) cur = redirects.get(cur);
    const page = byTitle.get(cur);
    titleMap.set(t, page && !page.missing ? page.title : null);
  }
  await new Promise((r) => setTimeout(r, 200));
}

const canonicalTitles = [...new Set([...titleMap.values()].filter(Boolean))];
console.log(`unique wiki titles: ${uniqueTitles.length} → resolved ${canonicalTitles.length}`);

// Fetch wikitext in batches of 20 (content is heavy)
const sources = new Map();
for (let i = 0; i < canonicalTitles.length; i += 20) {
  const batch = canonicalTitles.slice(i, i + 20);
  process.stdout.write(`  wikitext ${i + 1}-${Math.min(i + 20, canonicalTitles.length)}/${canonicalTitles.length}\n`);
  const data = await wikiApi({
    action: "query",
    prop: "revisions",
    rvprop: "ids|timestamp|content",
    rvslots: "main",
    titles: batch.join("|"),
  });
  for (const page of data?.query?.pages ?? []) {
    const rev = page?.revisions?.[0];
    const content = rev?.slots?.main?.content;
    if (!page?.title || page.missing || !content) continue;
    sources.set(page.title, {
      title: page.title,
      revid: rev.revid,
      timestamp: rev.timestamp,
      content,
    });
  }
  await new Promise((r) => setTimeout(r, 350));
}

const records = [];
const warnings = [];
let filled = 0;
let empty = 0;
let failed = 0;
const setIdCounts = {};
const priorityFilled = [];
const priorityMissing = [];

for (const item of items) {
  const canon = titleMap.get(item.wikiTitle);
  const src = canon ? sources.get(canon) : null;
  let bonuses = {};
  let raw = null;
  let revid = null;
  let wikiTs = null;
  let status = "ok";

  if (!canon || !src) {
    status = "missing-page";
    failed++;
    warnings.push(`${item.id}: wiki page missing (${item.wikiTitle})`);
  } else {
    revid = src.revid;
    wikiTs = src.timestamp;
    const params = parseInfoboxBonuses(src.content);
    if (!params) {
      status = "no-infobox";
      failed++;
      warnings.push(`${item.id}: no Infobox Bonuses on ${canon}`);
    } else {
      const mapped = mapBonuses(params);
      bonuses = mapped.bonuses;
      raw = mapped.raw;
      if (hasAnyBonus(bonuses)) filled++;
      else {
        empty++;
        warnings.push(`${item.id}: infobox present but all combat stats empty/zero`);
      }
    }
  }

  const setId = inferSetId(item.name, item.setId, item.slot);
  if (setId) setIdCounts[setId] = (setIdCounts[setId] || 0) + 1;

  const rec = {
    id: item.id,
    name: item.name,
    style: "magic",
    slot: item.slot,
    tier: item.tier,
    setId: setId ?? null,
    bonuses,
    priorBonuses: item.existingBonuses,
    wiki: {
      title: canon ?? item.wikiTitle,
      url: `https://runescape.wiki/w/${encodeURIComponent((canon ?? item.wikiTitle).replace(/ /g, "_")).replace(/%3A/gi, ":").replace(/%2F/gi, "/")}`,
      revid,
      timestamp: wikiTs,
      verifiedAt: TODAY,
    },
    status,
    priority: item.priority,
  };
  // Cleaner wiki URL (underscore spaces, keep apostrophes as %27)
  rec.wiki.url = `https://runescape.wiki/w/${(canon ?? item.wikiTitle).replace(/ /g, "_")}`;

  if (item.priority) {
    if (hasAnyBonus(bonuses)) priorityFilled.push(item.id);
    else priorityMissing.push(item.id);
  }
  records.push(rec);
}

// Sort: priority first, then by tier desc, name
records.sort((a, b) => {
  if (a.priority !== b.priority) return a.priority ? -1 : 1;
  const ta = a.tier ?? -1;
  const tb = b.tier ?? -1;
  if (ta !== tb) return tb - ta;
  return a.name.localeCompare(b.name);
});

const out = {
  fetched_at: new Date().toISOString(),
  snapshot_date: TODAY,
  purpose:
    "Wiki combat stats (Infobox Bonuses) for style===magic wearables. Candidates only — do not merge into equipment.json from this file without a separate agent. Magic style bonus maps to bonuses.damage.",
  mapping: {
    accuracy: "Infobox Bonuses accuracy → bonuses.accuracy",
    armour: "Infobox Bonuses armour → bonuses.armour",
    prayer: "Infobox Bonuses prayer → bonuses.prayer (omit 0)",
    damage:
      "Infobox Bonuses magic (style bonus) → bonuses.damage; else non-zero weapon damage field",
    setId: "Preserved from equipment.json or inferred from piece name patterns",
  },
  counts: {
    magicWearables: wearables.length,
    wikiResolved: canonicalTitles.length,
    filled: filled,
    emptyInfobox: empty,
    failed: failed,
    withSetId: records.filter((r) => r.setId).length,
    priorityFilled: priorityFilled.length,
    priorityMissing: priorityMissing.length,
    bySlot: Object.fromEntries(
      [...new Set(records.map((r) => r.slot))].map((s) => [
        s,
        records.filter((r) => r.slot === s).length,
      ]),
    ),
    bySetId: setIdCounts,
    bonusesNonEmpty: records.filter((r) => hasAnyBonus(r.bonuses)).length,
  },
  priorityIds: {
    filled: priorityFilled,
    missing: priorityMissing,
  },
  warnings,
  records,
};

await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(JSON.stringify(out.counts, null, 2));
console.log(`wrote ${OUT}`);
console.log(`warnings: ${warnings.length}`);
if (priorityMissing.length) console.log("priority missing:", priorityMissing.join(", "));

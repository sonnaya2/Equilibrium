import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Fetches the current RuneScape Wiki Magic ability tables and combat/hex/support
 * spell tables and normalizes them into scraped-data/combat-magic-wiki-<today>.json.
 * Conservative by design: only cleanly parsed fields are captured, skipped rows are
 * logged as warnings, and every record carries the page title + revision timestamp.
 * Run: node scripts/fetch-magic-wiki.mjs
 */

const ROOT = process.cwd();
const TODAY = new Date().toISOString().slice(0, 10);
const API = "https://runescape.wiki/api.php";
const UA = { "User-Agent": "EquilibriumQuestSync/1.0 (https://github.com/sonnaya2/Equilibrium)" };

async function api(params) {
  const query = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const res = await fetch(`${API}?${query}`, { headers: { ...UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Wiki API ${res.status}`);
  return res.json();
}

async function renderedPage(title) {
  const data = await api({ action: "parse", page: title, prop: "text|revid|displaytitle" });
  const revid = data?.parse?.revid;
  const html = data?.parse?.text;
  if (!html) throw new Error(`No rendered page for ${title}`);
  const meta = await api({ action: "query", prop: "revisions", rvprop: "timestamp", titles: title });
  const ts = meta?.query?.pages?.[0]?.revisions?.[0]?.timestamp ?? null;
  return { title, html, revid, ts };
}

const decode = (text) =>
  String(text)
    .replace(/&#(\d+);/g, (_, v) => String.fromCodePoint(Number(v)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const stripTags = (html) => decode(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

/** Splits a wikitable HTML block into rows of cell-text arrays. */
function tableRows(tableHtml) {
  const rows = [];
  const trs = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => stripTags(m[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseNumber(text) {
  const n = Number(String(text).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseAdrenaline(text) {
  if (/^\+/.test(text.trim())) return { kind: "gain", percent: parseNumber(text) };
  if (/^-|−/.test(text.trim())) return { kind: "cost", percent: Math.abs(parseNumber(text) ?? 0) };
  return null;
}

function parseCooldown(text) {
  const match = /(\d+(?:\.\d+)?)\s*seconds?/.exec(text);
  return match ? Number(match[1]) : null;
}

function parseBand(text) {
  const range = /(\d+)\s*%\s*[-–]\s*(\d+)\s*%/.exec(text);
  if (range) return [Number(range[1]), Number(range[2])];
  const dash = /(\d+)\s*[-–]\s*(\d+)\s*%/.exec(text);
  if (dash) return [Number(dash[1]), Number(dash[2])];
  const single = /(\d+)\s*%/.exec(text);
  return single ? [Number(single[1]), Number(single[1])] : null;
}

/** Ability tables from Magic abilities (Basic/Enhanced/Ultimate/Utility sections).
 *  Data rows carry a leading empty icon cell: [icon, name, level, adrenaline,
 *  target, avgDamage, cooldown, equipment, description, members]. */
function parseAbilitySections(html) {
  const abilities = [];
  const warnings = [];
  const sections = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi)];
  for (const [, headingRaw, body] of sections) {
    const heading = stripTags(headingRaw).toLowerCase();
    const category = ["basic", "enhanced", "ultimate", "utility"].find((c) => heading.includes(c));
    if (!category) continue;
    for (const table of body.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
      for (const row of tableRows(table)) {
        const cells = row[0] === "" ? row.slice(1) : row;
        if (cells.length < 9 || /ability/i.test(cells[0])) continue;
        const [name, level, adrenaline, target, avgDamage, cooldown, equipment, description, members] = cells;
        const band = parseBand(description);
        if (!band) warnings.push(`${name}: no damage band parsed from description`);
        const hitsMatch = /(\d+) hits?/i.exec(description);
        // The wiki lists Runic-Charged variants as their own rows; keep them distinct.
        const runic = /runic-charged/i.test(description) && abilities.some((a) => a.name === name);
        abilities.push({
          name: runic ? `${name} (Runic-Charged)` : name,
          level: parseNumber(level),
          type: category,
          adrenaline: parseAdrenaline(adrenaline),
          target: target.toLowerCase(),
          average_damage_percent: parseNumber(avgDamage),
          cooldown_seconds: parseCooldown(cooldown),
          equipment: equipment === "Any" ? undefined : equipment,
          damage_range_percent: band ? band.join("-") : undefined,
          hits: hitsMatch ? Number(hitsMatch[1]) : undefined,
          description,
          members: !/free-to-play/i.test(members ?? ""),
        });
      }
    }
  }
  return { abilities, warnings };
}

const cleanName = (name) => name.replace(/\s*\[\s*notes?[^\]]*\]/gi, "").trim();

/** Spell tables: 6 columns [icon, name, level, runes, xp, notes], categorized by the
 *  enclosing section. Damage bands are only read for combat spells, and only from an
 *  explicit "% ... damage" phrase in the notes. */
const SPELL_SECTIONS = [
  [/elemental/i, "combat", "standard"],
  [/hex/i, "hex", "standard"],
  [/support spells/i, "support", "standard"],
  [/lunar spells/i, "support", "lunar"],
];
function parseSpellSections(html, book) {
  const spells = [];
  const warnings = [];
  const sections = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[23]|$)/gi)];
  for (const [, headingRaw, body] of sections) {
    const heading = stripTags(headingRaw);
    const section = SPELL_SECTIONS.find(([re]) => re.test(heading));
    if (!section) continue;
    const [, category, sectionBook] = section;
    for (const table of body.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
      for (const row of tableRows(table)) {
        const cells = row[0] === "" || /^icon$/i.test(row[0]) ? row.slice(1) : row;
        if (cells.length < 5 || /^(spell|name)$/i.test(cells[0])) continue;
        const [nameRaw, level, runes, experience, notes] = cells;
        const name = cleanName(nameRaw);
        if (!name) continue;
        const damageMatch = category === "combat" ? /(\d+(?:\s*-\s*\d+)?)%[^.]*damage/i.exec(notes) : null;
        spells.push({
          name,
          book: book === "standard" ? sectionBook : book,
          category,
          level: parseNumber(level),
          runes: runes || undefined,
          experience: parseNumber(experience),
          damage_range_percent: damageMatch ? damageMatch[1].replace(/\s+/g, "") : undefined,
          description: notes,
        });
        if (category === "combat" && !damageMatch) warnings.push(`${name}: combat spell without stated damage`);
      }
    }
  }
  return { spells, warnings };
}

const magicAbilities = await renderedPage("Magic abilities");
const combatSpells = await renderedPage("Combat spells");
const ancientMagicks = await renderedPage("Ancient Magicks");

const abilityResult = parseAbilitySections(magicAbilities.html);
const standardSpells = parseSpellSections(combatSpells.html, "standard");
const ancientSpells = parseSpellSections(ancientMagicks.html, "ancient");

const output = {
  fetched_at: TODAY,
  purpose: "Magic abilities and combat/hex/support spells normalized from current RuneScape Wiki pages. Values are wiki-stated; unparsed fields stay absent.",
  pages: [
    { title: "Magic abilities", revision: magicAbilities.ts, url: "https://runescape.wiki/w/Magic_abilities" },
    { title: "Combat spells", revision: combatSpells.ts, url: "https://runescape.wiki/w/Combat_spells" },
    { title: "Ancient Magicks", revision: ancientMagicks.ts, url: "https://runescape.wiki/w/Ancient_Magicks" },
  ],
  abilities: abilityResult.abilities,
  spells: [...standardSpells.spells, ...ancientSpells.spells],
  warnings: [...abilityResult.warnings, ...standardSpells.warnings, ...ancientSpells.warnings],
};

const outPath = join(ROOT, `scraped-data/combat-magic-wiki-${TODAY}.json`);
await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`MAGIC WIKI FETCH`);
console.log(`abilities: ${output.abilities.length}  spells: ${output.spells.length}  warnings: ${output.warnings.length}`);
for (const warning of output.warnings.slice(0, 20)) console.log(`  warning: ${warning}`);
console.log(`-> ${outPath}`);

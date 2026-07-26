/**
 * Scrape RS Wiki armour/weapon list pages into equipment *candidates* under scraped-data/.
 * Does NOT write data/combat/equipment.json (merge is a separate agent).
 *
 * Usage:
 *   node scripts/sync-combat-equipment.mjs
 *   node scripts/sync-combat-equipment.mjs --min-tier=70 --style=all --dry-run
 *   node scripts/sync-combat-equipment.mjs --style=melee --min-tier=80
 *
 * Flags:
 *   --min-tier=N   minimum tier/level (default 70)
 *   --style=...    melee|ranged|magic|necromancy|all (default all)
 *   --dry-run      still writes the report JSON; skips nothing else (no equipment.json write ever)
 *   --wikitext-fallback  also harvest high-value wikitext [[links]] when set
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wikiSource } from "./lib/runescape-wiki.mjs";
import {
  COMBAT_STYLES,
  EQUIPMENT_PAGES,
  fetchPageHtml,
  parseEquipmentPageHtml,
  parseWikitextTierLinks,
  dedupeCandidates,
  countByStyleSlot,
  printStyleSlotMatrix,
} from "./lib/equipment-wiki.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = "2026-07-26";

function parseArgs(argv) {
  let minTier = 70;
  let style = "all";
  let dryRun = false;
  let wikitextFallback = false;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--wikitext-fallback") wikitextFallback = true;
    else if (arg.startsWith("--min-tier=")) {
      minTier = Number(arg.slice("--min-tier=".length));
      if (!Number.isFinite(minTier) || minTier < 1) throw new Error(`Bad --min-tier: ${arg}`);
    } else if (arg.startsWith("--style=")) {
      style = arg.slice("--style=".length).toLowerCase();
      if (style !== "all" && !COMBAT_STYLES.includes(style)) {
        throw new Error(`Bad --style: ${style} (melee|ranged|magic|necromancy|all)`);
      }
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node scripts/sync-combat-equipment.mjs [--min-tier=70] [--style=all] [--dry-run] [--wikitext-fallback]`);
      process.exit(0);
    }
  }
  return { minTier, style, dryRun, wikitextFallback };
}

const opts = parseArgs(process.argv.slice(2));
const pages = EQUIPMENT_PAGES.filter((p) => opts.style === "all" || p.style === opts.style);

console.log(`EQUIPMENT SYNC  min-tier=${opts.minTier}  style=${opts.style}  dry-run=${opts.dryRun}`);
console.log(`pages: ${pages.map((p) => p.title).join(" | ")}`);

const allCandidates = [];
const pageReports = [];
const warnings = [];

for (const page of pages) {
  process.stdout.write(`  fetch ${page.title} ... `);
  try {
    const rendered = await fetchPageHtml(page.title);
    const { candidates, warnings: pageWarnings } = parseEquipmentPageHtml(rendered.html, {
      style: page.style,
      kind: page.kind,
      sourcePage: rendered.title,
      minTier: opts.minTier,
    });
    let list = candidates;
    warnings.push(...pageWarnings);

    // Weapons list pages are uneven in HTML; always merge high-value wikitext [[links]]
    // near tier numbers (dedupe later). Armour only if HTML was thin or flag set.
    const wantWikitext =
      opts.wikitextFallback || page.kind === "weapon" || list.length < 8;
    if (wantWikitext) {
      try {
        const src = await wikiSource(page.title);
        const wt = parseWikitextTierLinks(src.content, {
          style: page.style,
          kind: page.kind,
          sourcePage: rendered.title,
          minTier: opts.minTier,
        });
        if (wt.length) {
          list = [...list, ...wt];
          warnings.push(`${page.title}: wikitext harvest added ${wt.length} raw links`);
        }
      } catch (err) {
        warnings.push(`${page.title}: wikitext harvest failed: ${err.message}`);
      }
    }

    // Light throttle — wiki is shared
    await new Promise((r) => setTimeout(r, 250));

    console.log(`${list.length} candidates (revid ${rendered.revid ?? "?"})`);
    pageReports.push({
      title: rendered.title,
      style: page.style,
      kind: page.kind,
      revid: rendered.revid,
      candidateCount: list.length,
    });
    allCandidates.push(...list);
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    warnings.push(`${page.title}: ${err.message}`);
    pageReports.push({
      title: page.title,
      style: page.style,
      kind: page.kind,
      error: err.message,
      candidateCount: 0,
    });
  }
}

const candidates = dedupeCandidates(allCandidates);
const matrix = countByStyleSlot(candidates);

const byKind = { armour: 0, weapon: 0 };
const byStyle = Object.fromEntries(COMBAT_STYLES.map((s) => [s, 0]));
for (const c of candidates) {
  byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  byStyle[c.style] = (byStyle[c.style] ?? 0) + 1;
}

const report = {
  fetched_at: new Date().toISOString(),
  snapshot_date: TODAY,
  purpose:
    "Wiki armour/weapon list-page candidates for combat equipment. Candidates only — do not treat as merged equipment.json.",
  options: {
    minTier: opts.minTier,
    style: opts.style,
    dryRun: opts.dryRun,
    wikitextFallback: opts.wikitextFallback,
  },
  pages: pageReports,
  counts: {
    total: candidates.length,
    byKind,
    byStyle,
    byStyleSlot: matrix,
  },
  warnings,
  candidates,
};

const outName = `equipment-sync-report-${TODAY}.json`;
const outPath = join(ROOT, "scraped-data", outName);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("");
console.log("EQUIPMENT SYNC RESULT");
console.log(`total candidates (deduped): ${candidates.length}`);
console.log(`  armour: ${byKind.armour ?? 0}  weapon: ${byKind.weapon ?? 0}`);
for (const s of COMBAT_STYLES) {
  if (opts.style === "all" || opts.style === s) console.log(`  ${s}: ${byStyle[s] ?? 0}`);
}
console.log("");
printStyleSlotMatrix(matrix, "counts by style × slot");
console.log("");
if (warnings.length) {
  console.log(`warnings: ${warnings.length}`);
  for (const w of warnings.slice(0, 25)) console.log(`  ! ${w}`);
  if (warnings.length > 25) console.log(`  ... +${warnings.length - 25} more`);
}
console.log(`-> ${outPath}`);
console.log("(equipment.json NOT modified)");

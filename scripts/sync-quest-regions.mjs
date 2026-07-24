import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wikiPageLinks, wikiSource, wikiSources } from "./lib/runescape-wiki.mjs";

const ROOT = process.cwd();
const RULES_PATH = join(ROOT, "data/league/quest-region-rules.json");
const OUTPUT_PATH = join(ROOT, "data/league/quests.json");

function luaQuestRequirements(source) {
  const raw = new Map();
  const entry = /\["((?:\\.|[^"])*)"\]\s*=\s*\{([\s\S]*?)\}\s*,/g;
  let match;
  while ((match = entry.exec(source))) {
    const title = match[1].replaceAll('\\"', '"');
    const requirements = [...match[2].matchAll(/"((?:\\.|[^"])*)"/g)]
      .map((item) => item[1].replaceAll('\\"', '"'));
    raw.set(title, requirements);
  }
  const names = new Set(raw.keys());
  return new Map([...raw].map(([title, reqs]) => [title, reqs.filter((req) => names.has(req))]));
}

function wikiParam(source, name) {
  const lines = source.split(/\r?\n/);
  const prefix = `|${name}`;
  for (const line of lines) {
    const compact = line.replace(/^\s+/, "");
    if (!compact.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const equals = compact.indexOf("=");
    if (equals !== -1) return compact.slice(equals + 1).trim();
  }
  return "";
}

function cleanWiki(value) {
  return value
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapArea(area, rules) {
  const value = cleanWiki(area).toLowerCase();
  if (!value || value === "none" || value === "n/a") return "unmapped";
  if (rules.global_terms.some((term) => value.includes(term.toLowerCase()))) return "global";
  if (rules.unmapped_terms.some((term) => value.includes(term.toLowerCase()))) return "unmapped";

  let best = null;
  for (const region of rules.regions) {
    for (const term of region.terms) {
      const needle = term.toLowerCase();
      if (!value.includes(needle)) continue;
      if (!best || needle.length > best.term.length) best = { id: region.id, term: needle };
    }
  }
  return best?.id ?? "unmapped";
}

function metadata(title, page, rules) {
  const area = cleanWiki(wikiParam(page.content, "area") || wikiParam(page.content, "area1"));
  const series = cleanWiki(wikiParam(page.content, "main_series") || wikiParam(page.content, "series"));
  const override = rules.overrides?.[title];

  let primaryRegion = mapArea(area, rules);
  let reason = primaryRegion === "global"
    ? `Start area is a non-region/global hub: ${area}`
    : primaryRegion === "unmapped"
      ? `Start area needs Equilibrium boundary review: ${area || "missing"}`
      : `Mapped from RuneScape Wiki start area: ${area}`;

  if (rules.series_force_unmapped.some((name) => series.toLowerCase().includes(name.toLowerCase()))) {
    primaryRegion = "unmapped";
    reason = `Series boundary needs Equilibrium review: ${series}`;
  }
  if (override?.primary_region) {
    primaryRegion = override.primary_region;
    reason = override.reason ?? "Explicit override";
  }

  return {
    title,
    start_area: area,
    series,
    quest_type: cleanWiki(wikiParam(page.content, "type")),
    release: cleanWiki(wikiParam(page.content, "release")),
    members: cleanWiki(wikiParam(page.content, "members")),
    primary_region: primaryRegion,
    mapping_reason: reason,
    source_url: `https://runescape.wiki/w/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
    source_revision: page.revid,
    source_revision_timestamp: page.timestamp,
  };
}

function requiredRegions(title, meta, prerequisites, memo, stack = new Set()) {
  if (memo.has(title)) return memo.get(title);
  const primary = meta.get(title)?.primary_region ?? "unmapped";
  if (stack.has(title)) return new Set([primary]);
  stack.add(title);
  const regions = new Set([primary]);
  for (const prerequisite of prerequisites.get(title) ?? []) {
    if (!meta.has(prerequisite)) continue;
    for (const region of requiredRegions(prerequisite, meta, prerequisites, memo, stack)) regions.add(region);
  }
  stack.delete(title);
  memo.set(title, regions);
  return regions;
}

const rules = JSON.parse(await readFile(RULES_PATH, "utf8"));
const [requirementsPage, globalsPage, listLinks] = await Promise.all([
  wikiSource("Module:Questreq/data"),
  wikiSource("Module:Globals/data"),
  wikiPageLinks("List of quests"),
]);

const prerequisites = luaQuestRequirements(requirementsPage.content);
const titles = [...prerequisites.keys()].filter((title) => listLinks.has(title)).sort((a, b) => a.localeCompare(b));
const expectedMatch = globalsPage.content.match(/\[['"]quests['"]\]\s*=\s*\{[\s\S]*?['"](\d+)['"]/);
const numberedQuestCount = expectedMatch ? Number(expectedMatch[1]) : null;
if (numberedQuestCount && (titles.length < numberedQuestCount || titles.length > numberedQuestCount + 25)) {
  throw new Error(`Quest list sanity check failed: ${titles.length} list entries vs ${numberedQuestCount} numbered quests`);
}

const pages = await wikiSources(titles);
const missing = titles.filter((title) => !pages.has(title));
if (missing.length) throw new Error(`Missing quest pages: ${missing.join(", ")}`);

const meta = new Map(titles.map((title) => [title, metadata(title, pages.get(title), rules)]));
const memo = new Map();
const quests = titles.map((title) => {
  const regions = [...requiredRegions(title, meta, prerequisites, memo)].sort((a, b) => a.localeCompare(b));
  const realRegions = regions.filter((region) => !["unmapped", "global"].includes(region));
  const primary = meta.get(title).primary_region;
  return {
    ...meta.get(title),
    direct_prerequisites: (prerequisites.get(title) ?? []).filter((name) => meta.has(name)),
    required_regions: regions,
    cross_region: realRegions.length > 1,
    region_confidence: primary === "unmapped"
      ? "needs_boundary_review"
      : primary === "global"
        ? "non_region_start_area"
        : "inferred_from_wiki_start_area_and_recursive_quest_requirements",
    equilibrium_auto_completion: {
      status: "unknown_pending_official_jagex_list",
      regions: [],
      source_urls: [],
    },
  };
});

const groupIds = [...rules.regions.map((region) => region.id), "global", "unmapped"];
const regionGroups = Object.fromEntries(groupIds.map((id) => [
  id,
  quests.filter((quest) => quest.required_regions.includes(id)).map((quest) => quest.title),
]));
const primaryRegionGroups = Object.fromEntries(groupIds.map((id) => [
  id,
  quests.filter((quest) => quest.primary_region === id).map((quest) => quest.title),
]));
const regionGroupCounts = Object.fromEntries(groupIds.map((id) => [id, regionGroups[id].length]));
const primaryRegionCounts = Object.fromEntries(groupIds.map((id) => [id, primaryRegionGroups[id].length]));

const output = {
  generated_at: new Date().toISOString(),
  snapshot_date: new Date().toISOString().slice(0, 10),
  quest_count: quests.length,
  quest_list_entry_count: quests.length,
  wiki_numbered_quest_count: numberedQuestCount,
  special_or_unnumbered_entry_delta: numberedQuestCount ? quests.length - numberedQuestCount : null,
  methodology: rules.method,
  source_urls: [
    "https://runescape.wiki/w/List_of_quests",
    "https://runescape.wiki/w/Module:Questreq/data",
    "https://runescape.wiki/w/Template:Infobox_Quest/doc",
    "https://runescape.wiki/w/Module:Globals/data",
  ],
  source_revisions: {
    quest_requirements: requirementsPage.revid,
    globals: globalsPage.revid,
  },
  region_group_counts: regionGroupCounts,
  primary_region_counts: primaryRegionCounts,
  region_groups: regionGroups,
  primary_region_groups: primaryRegionGroups,
  quests,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`QUEST SYNC: ${quests.length} list entries / ${numberedQuestCount ?? "?"} numbered; global ${regionGroups.global.length}; unmapped ${regionGroups.unmapped.length}; cross-region ${quests.filter((quest) => quest.cross_region).length}`);

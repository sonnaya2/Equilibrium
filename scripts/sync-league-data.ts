/**
 * Normalizes the verified research dump in scraped-data/ (2026-07-24 snapshot) into the
 * canonical store at data/league/{regions,relics,blessings,tasks}.json. Every record carries
 * SourceReference provenance derived from scraped-data/sources.json.
 *
 * Confidence policy: `confirmed_*` items land as data; `inferred_region` items land labelled as
 * inferred; `unrevealed` lands as explicit placeholder status, never as invented effects.
 * Envelopes stay `verified: false` while any content is inferred or unrevealed.
 *
 * Idempotent: reads only scraped-data/, rewrites only data/league/.
 * Run: npm run sync:league
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const SNAPSHOT = "2026-07-24";

interface SourceReference {
  source: "runescape-wiki" | "jagex" | "rs-analysis" | "pvme" | "derived";
  url: string;
  title?: string;
  publishedAt?: string;
  verifiedAt: string;
}

const read = (name: string) =>
  JSON.parse(readFileSync(join(ROOT, "scraped-data", name), "utf8"));
const write = (name: string, envelope: unknown) => {
  writeFileSync(join(ROOT, "data", "league", name), JSON.stringify(envelope, null, 2) + "\n");
  return JSON.stringify(envelope).length;
};

const sourcesRaw = read("sources.json").sources as Array<{
  id: string;
  title: string;
  publisher: string;
  published?: string;
  url: string;
}>;
const SOURCE_BY_ID = new Map(sourcesRaw.map((s) => [s.id, s]));

const dangling = new Set<string>();

function refs(ids: string[] = []): SourceReference[] {
  return [...new Set([...ids, "equilibrium_official_2026_07_23"])].flatMap((id) => {
    const s = SOURCE_BY_ID.get(id);
    if (!s) {
      // Scrape defect: record keeps its other sources, the missing id is reported below.
      dangling.add(id);
      return [];
    }
    return [
      {
        source: s.publisher.includes("Jagex") ? ("jagex" as const) : ("runescape-wiki" as const),
        url: s.url,
        title: s.title,
        ...(s.published ? { publishedAt: s.published } : {}),
        verifiedAt: SNAPSHOT,
      },
    ];
  });
}

// --- Regions -----------------------------------------------------------------

const DISPLAY_NAMES: Record<string, string> = {
  misthalin: "Misthalin",
  havenhythe: "Havenhythe",
  karamja: "Karamja",
  asgarnia: "Asgarnia",
  kandarin: "Kandarin",
  fremennik: "Fremennik Province",
  forinthry: "Wilderness",
  desert: "Kharidian Desert",
  morytania: "Morytania",
  tirannwn: "Tirannwn",
  anachronia: "Anachronia",
};

const equilibrium = read("equilibrium.json");
const UNLOCK_TEXT: Record<string, string> = {
  starting: "Unlocked from the start",
  automatic_early: "Unlocks at the first task milestone",
  elective: "Elective pick — 3 of 8",
};

interface RawContent {
  name: string;
  confidence?: string;
  note?: string;
  [k: string]: unknown;
}

function contentOf(region: Record<string, unknown>): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const groups: Record<string, string> = {
    notable_content: "notable",
    bosses_and_combat: "combat",
    skilling: "skilling",
    power_upgrades: "upgrade",
  };
  for (const [key, kind] of Object.entries(groups)) {
    for (const item of (region[key] as Array<RawContent | string> | undefined) ?? []) {
      const raw: RawContent = typeof item === "string" ? { name: item } : item;
      const { name, confidence, note, ...extra } = raw;
      out.push({
        name,
        kind,
        confidence: confidence ?? "inferred_region",
        ...(note ? { note } : {}),
        ...extra,
      });
    }
  }
  return out;
}

const deps = read("region-dependencies.json").dependencies as Array<{
  content: string;
  system: string;
  required_region: string;
  planner_rule: string;
}>;

const regions = (read("regions.json").regions as Array<Record<string, unknown>>).map((r) => {
  const id = r.id as string;
  return {
    id,
    name: DISPLAY_NAMES[id] ?? id,
    availability: r.availability,
    unlock: UNLOCK_TEXT[r.availability as string],
    majorAreas: r.major_areas ?? [],
    officialExamples: r.official_examples ?? [],
    content: contentOf(r),
    hardRules: deps
      .filter((d) => d.required_region === id)
      .map((d) => ({ content: d.content, system: d.system, rule: d.planner_rule })),
    ...(r.open_questions ? { openQuestions: r.open_questions } : {}),
    ...(r.legacy_warning ? { legacyWarning: r.legacy_warning } : {}),
    sources: refs(r.source_ids as string[] | undefined),
  };
});

// --- Relics ------------------------------------------------------------------

const relicTiers = Array.from({ length: equilibrium.relics.tiers }, (_, i) => {
  const tier = i + 1;
  if (tier === 1) {
    return {
      tier,
      status: "revealed",
      choices: (equilibrium.relics.tier_1 as Array<{ name: string; effects: string[] }>).map(
        (c) => ({ name: c.name, effects: c.effects, confidence: "confirmed_official" }),
      ),
      sources: refs(),
    };
  }
  return {
    tier,
    status: "unrevealed",
    revealSchedule: equilibrium.relics.tiers_2_to_7.reveal_schedule,
    choices: [],
    sources: refs(),
  };
});

// --- Blessings ---------------------------------------------------------------

const b = equilibrium.blessings;
const blessingTiers = Array.from({ length: b.tiers }, (_, i) => {
  const tier = i + 1;
  return {
    tier,
    godTier: b.god_tiers.includes(tier),
    pathsPerTier: b.paths.length,
    status: "unrevealed",
    sources: refs(),
  };
});
const blessingStructure = {
  focus: b.focus,
  unlockMethod: b.unlock_method,
  paths: b.paths,
  styleLock: b.style_lock,
  godTierResolution: b.god_tier_resolution,
  resets: b.resets,
  passiveBonusExamples: b.passive_bonus_examples,
};

// --- Tasks -------------------------------------------------------------------
// The Equilibrium list is still unpublished. Catalyst is an explicit UI test fixture only.

const taskSource = refs()[0] ?? {
  source: "jagex" as const,
  url: "https://secure.runescape.com/m=news/countdown-to-leagues-ii-equilibrium",
  title: "Countdown to LEAGUES II: EQUILIBRIUM!",
  publishedAt: "2026-07-23",
  verifiedAt: SNAPSHOT,
};

const taskEnvelope = {
  lastSynced: SNAPSHOT,
  verified: false,
  records: [],
  tiers: equilibrium.progression.task_point_values,
  tierConfidence: equilibrium.progression.task_point_value_confidence,
  pointValueNote: equilibrium.progression.task_point_value_note,
  note: "The full Equilibrium task list has not been published yet.",
  testFallback: {
    enabled: true,
    league: "Catalyst League",
    testingOnly: true,
    url: "https://runescape.wiki/w/Catalyst_League/Tasks",
    completionSource: "https://runescape.wiki/w/Module:Catalyst_League/Tasks/completion.json",
    expectedRecords: 1117,
    note: "Catalyst League tasks are temporarily shown on /tasks only to test the task browser. They are not Equilibrium tasks and must be replaced when the Equilibrium task list is published.",
  },
  source: taskSource,
};

// --- Write + report ----------------------------------------------------------

const envelopes: Array<[string, unknown, number]> = [
  ["regions.json", { lastSynced: SNAPSHOT, verified: false, records: regions }, regions.length],
  ["relics.json", { lastSynced: SNAPSHOT, verified: false, records: relicTiers }, relicTiers.length],
  [
    "blessings.json",
    { lastSynced: SNAPSHOT, verified: false, structure: blessingStructure, records: blessingTiers },
    blessingTiers.length,
  ],
  ["tasks.json", taskEnvelope, 0],
];

console.log("LEAGUE SYNC");
for (const [name, envelope, count] of envelopes) {
  write(name, envelope);
  console.log(`  ${name.padEnd(15)} records: ${count}`);
}
console.log(`  Snapshot ${SNAPSHOT}; unrevealed relic/blessing data left as placeholders.`);
if (dangling.size > 0) {
  console.log(`  Warnings: ${dangling.size} source id(s) referenced but missing from sources.json: ${[...dangling].join(", ")}`);
}

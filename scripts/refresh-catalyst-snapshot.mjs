/**
 * Refresh Catalyst League tasks from the Wiki, parse,
 * integrity-check, write data/league/catalyst-tasks-snapshot.json.
 * Production /tasks imports the snapshot — do not call this on every request.
 *
 * Locality mapping must stay in sync with src/tasks/catalyst.ts
 * CATALYST_LOCALITY_TO_REGION.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/league/catalyst-tasks-snapshot.json");
const API =
  "https://runescape.wiki/api.php?action=parse&page=Catalyst_League%2FTasks&prop=text&format=json&formatversion=2&disableeditsection=1";
const EXPECTED = 1117;
const SOURCE_URL = "https://runescape.wiki/w/Catalyst_League/Tasks";

const POINT_TO_TIER = new Map([
  [10, "easy"],
  [30, "medium"],
  [80, "hard"],
  [200, "elite"],
  [400, "master"],
]);

/** Keep in sync with src/tasks/catalyst.ts CATALYST_LOCALITY_TO_REGION */
const LOCALITY_TO_REGION = {
  global: "global",
  anachronia: "anachronia",
  karamja: "karamja",
  morytania: "morytania",
  desert: "desert",
  menaphos: "desert",
  fremennik: "fremennik",
  lunar: "fremennik",
  elves: "tirannwn",
  wilderness: "forinthry",
  daemonheim: "forinthry",
  falador: "asgarnia",
  burthorpe: "asgarnia",
  taverley: "asgarnia",
  portsarim: "asgarnia",
  ardougne: "kandarin",
  seer: "kandarin",
  yanille: "kandarin",
  gnomes: "kandarin",
  piscatoris: "kandarin",
  feldip: "kandarin",
  varrock: "misthalin",
  lumbridge: "misthalin",
  draynor: "misthalin",
  edgeville: "misthalin",
  um: "misthalin",
  fort: "misthalin",
};

const REGION_DISPLAY = {
  global: "Global",
  misthalin: "Misthalin",
  havenhythe: "Havenhythe",
  karamja: "Karamja",
  asgarnia: "Asgarnia",
  kandarin: "Kandarin",
  fremennik: "Fremennik",
  forinthry: "Forinthry",
  desert: "Desert",
  morytania: "Morytania",
  tirannwn: "Tirannwn",
  anachronia: "Anachronia",
};

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textFromHtml(value) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function attr(source, name) {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match?.[1];
}

function localityLabelFromCell(localityHtml) {
  const title = localityHtml.match(/\btitle="([^"]+)"/i)?.[1];
  if (title?.trim()) return decodeHtmlEntities(title.trim());
  const alt = localityHtml.match(/\balt="([^"]+)"/i)?.[1];
  if (alt?.trim()) return decodeHtmlEntities(alt.trim());
  const text = textFromHtml(localityHtml);
  return text || undefined;
}

function parseCompletionRate(value) {
  const match = value.match(/(<)?\s*(\d+(?:\.\d+)?)\s*%/);
  if (!match) return {};
  return {
    catalystCompletionRate: Number(match[2]),
    ...(match[1] === "<" ? { catalystCompletionRateQualifier: "<" } : {}),
  };
}

function parseCatalystTasksHtml(html) {
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  const taskTable = tables.find((table) => {
    const text = textFromHtml(table);
    return text.includes("Locality") && text.includes("Task") && text.includes("Comp%");
  });
  if (!taskTable) return [];

  const rows = taskTable.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  return rows.flatMap((row) => {
    const rawCells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (rawCells.length < 6) return [];

    const wikiTaskIdRaw = attr(row, "data-taskid") ?? attr(row, "id");
    const wikiTaskId =
      wikiTaskIdRaw && /^\d+$/.test(wikiTaskIdRaw) ? Number(wikiTaskIdRaw) : undefined;
    const localityKey = attr(row, "data-tbz-area-for-filtering")?.toLowerCase();

    const [localityHtml, taskHtml, informationHtml, requirementsHtml, pointsHtml, completionHtml] =
      rawCells;
    const localityLabel = localityLabelFromCell(localityHtml);
    const name = textFromHtml(taskHtml);
    const information = textFromHtml(informationHtml);
    const requirements = textFromHtml(requirementsHtml);
    const pointsMatch = textFromHtml(pointsHtml).match(/\b(10|30|80|200|400)\b/);
    const points = pointsMatch ? Number(pointsMatch[1]) : null;
    const tier = points === null ? undefined : POINT_TO_TIER.get(points);
    const regionId = localityKey ? LOCALITY_TO_REGION[localityKey] : undefined;
    const region =
      regionId && regionId !== "global"
        ? REGION_DISPLAY[regionId]
        : regionId === "global"
          ? "Global"
          : localityLabel;

    if (!name || !tier || points === null) return [];
    return [
      {
        name,
        tier,
        points,
        ...(wikiTaskId !== undefined ? { id: `wiki:${wikiTaskId}`, wikiTaskId } : {}),
        ...(information && information !== name ? { description: information } : {}),
        ...(region ? { region } : {}),
        ...(regionId ? { regionId } : {}),
        ...(localityKey ? { localityKey } : {}),
        ...(localityLabel ? { localityLabel } : {}),
        ...(requirements && requirements !== "N/A" ? { requirements } : {}),
        ...parseCompletionRate(textFromHtml(completionHtml)),
        sourceLeague: "catalyst",
      },
    ];
  });
}

const res = await fetch(API, {
  headers: {
    "User-Agent": "Equilibrium/0.1 RuneScape fan tool (github.com/sonnaya2/Equilibrium)",
  },
  signal: AbortSignal.timeout(120_000),
});
if (!res.ok) {
  console.error(`Wiki returned ${res.status}`);
  process.exit(1);
}
const payload = await res.json();
const html = payload?.parse?.text;
if (!html) {
  console.error("No parse.text in wiki response");
  process.exit(1);
}
const records = parseCatalystTasksHtml(html);
const min = Math.ceil(EXPECTED * 0.9);
if (records.length < min) {
  console.error(`Integrity fail: got ${records.length}, need >= ${min} of ${EXPECTED}`);
  process.exit(1);
}

const withId = records.filter((r) => typeof r.wikiTaskId === "number").length;
const withRegion = records.filter((r) => r.regionId).length;
const unmappedKeys = [
  ...new Set(
    records
      .filter((r) => r.localityKey && !r.regionId)
      .map((r) => r.localityKey),
  ),
].sort();

const snapshot = {
  snapshotDate: new Date().toISOString().slice(0, 10),
  sourceLeague: "catalyst",
  sourceUrl: SOURCE_URL,
  expectedRecords: EXPECTED,
  recordCount: records.length,
  note: "Static Catalyst League task list for Equilibrium pre-launch. Replaced when Equilibrium publishes its own list. Regenerated via scripts/refresh-catalyst-snapshot.mjs only. Comp% is overlaid live from Module:Catalyst_League/Tasks/completion.json at request time.",
  records,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
console.log(
  `CATALYST SNAPSHOT\nWrote ${records.length} tasks → ${OUT}\nwikiTaskId: ${withId} · regionId: ${withRegion}${
    unmappedKeys.length ? `\nUnmapped locality keys: ${unmappedKeys.join(", ")}` : ""
  }`,
);
if (unmappedKeys.length) {
  console.warn("Warning: unmapped locality keys — update CATALYST_LOCALITY_TO_REGION");
}

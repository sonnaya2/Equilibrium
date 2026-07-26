/**
 * One-shot / rare refresh: fetch Catalyst League tasks from the Wiki, parse,
 * integrity-check, write data/league/catalyst-tasks-snapshot.json.
 * Production /tasks imports the snapshot — do not call this on every request.
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
    const [localityHtml, taskHtml, informationHtml, requirementsHtml, pointsHtml, completionHtml] =
      rawCells;
    const locality = textFromHtml(localityHtml);
    const name = textFromHtml(taskHtml);
    const information = textFromHtml(informationHtml);
    const requirements = textFromHtml(requirementsHtml);
    const pointsMatch = textFromHtml(pointsHtml).match(/\b(10|30|80|200|400)\b/);
    const points = pointsMatch ? Number(pointsMatch[1]) : null;
    const tier = points === null ? undefined : POINT_TO_TIER.get(points);
    if (!name || !tier || points === null) return [];
    return [
      {
        name,
        tier,
        points,
        ...(information && information !== name ? { description: information } : {}),
        ...(locality ? { region: locality } : {}),
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

const snapshot = {
  snapshotDate: new Date().toISOString().slice(0, 10),
  sourceLeague: "catalyst",
  sourceUrl: SOURCE_URL,
  expectedRecords: EXPECTED,
  recordCount: records.length,
  note: "Static Catalyst League task list for Equilibrium pre-launch. Replaced when Equilibrium publishes its own list. Regenerated via scripts/refresh-catalyst-snapshot.mjs only.",
  records,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
console.log(`CATALYST SNAPSHOT\nWrote ${records.length} tasks → ${OUT}`);

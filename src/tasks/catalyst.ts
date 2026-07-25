import type { TaskRecord, TaskTier } from "./index";

export const CATALYST_TASKS_URL = "https://runescape.wiki/w/Catalyst_League/Tasks";

const CATALYST_TASKS_API =
  "https://runescape.wiki/api.php?action=parse&page=Catalyst_League%2FTasks&prop=text&format=json&formatversion=2&disableeditsection=1";

const POINT_TO_TIER = new Map<number, TaskTier>([
  [10, "easy"],
  [30, "medium"],
  [80, "hard"],
  [200, "elite"],
  [400, "master"],
]);

export interface CatalystTaskRecord extends TaskRecord {
  sourceLeague: "catalyst";
  testingOnly: true;
  requirements?: string;
  catalystCompletionRate?: number;
  catalystCompletionRateQualifier?: "<";
}

export interface CatalystTaskLoadResult {
  records: CatalystTaskRecord[];
  error?: string;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textFromHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseCompletionRate(value: string): Pick<
  CatalystTaskRecord,
  "catalystCompletionRate" | "catalystCompletionRateQualifier"
> {
  const match = value.match(/(<)?\s*(\d+(?:\.\d+)?)\s*%/);
  if (!match) return {};

  return {
    catalystCompletionRate: Number(match[2]),
    ...(match[1] === "<" ? { catalystCompletionRateQualifier: "<" as const } : {}),
  };
}

export function parseCatalystTasksHtml(html: string): CatalystTaskRecord[] {
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  const taskTable = tables.find((table) => {
    const text = textFromHtml(table);
    return text.includes("Locality") && text.includes("Task") && text.includes("Comp%");
  });

  if (!taskTable) return [];

  const rows = taskTable.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  return rows.flatMap((row) => {
    const rawCells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (rawCells.length < 6) return [];

    const [localityHtml, taskHtml, informationHtml, requirementsHtml, pointsHtml, completionHtml] = rawCells;
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
        sourceLeague: "catalyst" as const,
        testingOnly: true as const,
      },
    ];
  });
}

export async function loadCatalystTestTasks(): Promise<CatalystTaskLoadResult> {
  try {
    const response = await fetch(CATALYST_TASKS_API, {
      headers: {
        "User-Agent": "Equilibrium/0.1 RuneScape fan tool (github.com/sonnaya2/Equilibrium)",
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      throw new Error(`RuneScape Wiki returned ${response.status}`);
    }

    const payload = (await response.json()) as { parse?: { text?: string } };
    const html = payload.parse?.text;
    if (!html) throw new Error("RuneScape Wiki response did not include parsed task HTML");

    const records = parseCatalystTasksHtml(html);
    if (records.length === 0) throw new Error("Catalyst task table was not found in the RuneScape Wiki response");

    return { records };
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : "Unable to load Catalyst task data",
    };
  }
}

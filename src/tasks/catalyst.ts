import type { TaskRecord, TaskTier } from "./index";
import snapshot from "#data/league/catalyst-tasks-snapshot.json";

export const CATALYST_TASKS_URL = "https://runescape.wiki/w/Catalyst_League/Tasks";

/** Wiki table size used when callers omit expectedRecords (Catalyst stand-in integrity gate). */
export const CATALYST_EXPECTED_RECORDS = 1117;

/** Product path: static snapshot. Live fetch is only for scripts/refresh-catalyst-snapshot.mjs. */
const CATALYST_TASKS_API =
  "https://runescape.wiki/api.php?action=parse&page=Catalyst_League%2FTasks&prop=text&format=json&formatversion=2&disableeditsection=1";

const POINT_TO_TIER = new Map<number, TaskTier>([
  [10, "easy"],
  [30, "medium"],
  [80, "hard"],
  [200, "elite"],
  [400, "master"],
]);

/** Catalyst League task as a stand-in until Equilibrium ships its own list. */
export interface CatalystTaskRecord extends TaskRecord {
  sourceLeague: "catalyst";
  /** Present on some older rows; product no longer requires this flag. */
  testingOnly?: boolean;
  requirements?: string;
  catalystCompletionRate?: number;
  catalystCompletionRateQualifier?: "<";
}

export interface CatalystTaskLoadResult {
  records: CatalystTaskRecord[];
  error?: string;
  fromSnapshot?: boolean;
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
      },
    ];
  });
}

/** True when the parsed Catalyst table looks complete enough to show as stand-in. */
export function catalystRecordsPassIntegrity(
  recordCount: number,
  expectedRecords: number = CATALYST_EXPECTED_RECORDS,
): boolean {
  return recordCount >= expectedRecords * 0.9;
}

/**
 * Product path: read the static Catalyst snapshot (no network).
 * Refresh offline with: node scripts/refresh-catalyst-snapshot.mjs
 */
export function loadCatalystSnapshot(expectedRecords?: number): CatalystTaskLoadResult {
  const expected = expectedRecords ?? CATALYST_EXPECTED_RECORDS;
  const records = (snapshot.records ?? []) as CatalystTaskRecord[];
  if (records.length === 0) {
    return { records: [], error: "Catalyst task snapshot is empty", fromSnapshot: true };
  }
  if (!catalystRecordsPassIntegrity(records.length, expected)) {
    return {
      records: [],
      error: `Catalyst snapshot incomplete: got ${records.length}, expected at least ${Math.ceil(expected * 0.9)} of ${expected}`,
      fromSnapshot: true,
    };
  }
  return { records, fromSnapshot: true };
}

/**
 * @deprecated Prefer loadCatalystSnapshot for product. Kept for name stability;
 * now returns the static snapshot (no live fetch).
 */
export async function loadCatalystTestTasks(
  expectedRecords?: number,
): Promise<CatalystTaskLoadResult> {
  return loadCatalystSnapshot(expectedRecords);
}

/** Dev-only live fetch — used by refresh-catalyst-snapshot.mjs logic parity tests only. */
export async function fetchCatalystTasksLive(
  expectedRecords?: number,
): Promise<CatalystTaskLoadResult> {
  const expected = expectedRecords ?? CATALYST_EXPECTED_RECORDS;
  try {
    const response = await fetch(CATALYST_TASKS_API, {
      headers: {
        "User-Agent": "Equilibrium/0.1 RuneScape fan tool (github.com/sonnaya2/Equilibrium)",
      },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`RuneScape Wiki returned ${response.status}`);
    const payload = (await response.json()) as { parse?: { text?: string } };
    const html = payload.parse?.text;
    if (!html) throw new Error("RuneScape Wiki response did not include parsed task HTML");
    const records = parseCatalystTasksHtml(html);
    if (records.length === 0) {
      throw new Error("Catalyst task table was not found in the RuneScape Wiki response");
    }
    if (!catalystRecordsPassIntegrity(records.length, expected)) {
      throw new Error(
        `Catalyst task list incomplete: got ${records.length}, expected at least ${Math.ceil(expected * 0.9)} of ${expected}`,
      );
    }
    return { records };
  } catch (error) {
    return {
      records: [],
      error: error instanceof Error ? error.message : "Unable to load Catalyst task list",
    };
  }
}

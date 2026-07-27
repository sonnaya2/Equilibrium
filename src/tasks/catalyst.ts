import type { TaskRecord, TaskTier } from "./index";
import { mapCatalystLocality, regionDisplayName } from "./regionMap";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import snapshot from "#data/league/catalyst-tasks-snapshot.json";

export {
  CATALYST_LOCALITY_TO_REGION,
  CATALYST_TASKS_URL,
  isLeagueRegionId,
  mapCatalystLocality,
  regionDisplayName,
} from "./regionMap";

export const CATALYST_COMPLETION_URL =
  "https://runescape.wiki/w/Module:Catalyst_League/Tasks/completion.json?action=raw";

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
  testingOnly: true;
  requirements?: string;
  catalystCompletionRate?: number;
  catalystCompletionRateQualifier?: "<";
}

export interface CatalystTaskLoadResult {
  records: CatalystTaskRecord[];
  error?: string;
  fromSnapshot?: boolean;
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

function attr(source: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`, "i");
  const match = source.match(re);
  return match?.[1];
}

function localityLabelFromCell(localityHtml: string): string | undefined {
  const title = localityHtml.match(/\btitle="([^"]+)"/i)?.[1];
  if (title?.trim()) return decodeHtmlEntities(title.trim());
  const alt = localityHtml.match(/\balt="([^"]+)"/i)?.[1];
  if (alt?.trim()) return decodeHtmlEntities(alt.trim());
  const text = textFromHtml(localityHtml);
  return text || undefined;
}

function parseCompletionRate(
  value: string,
): Pick<CatalystTaskRecord, "catalystCompletionRate" | "catalystCompletionRateQualifier"> {
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
    const regionId = localityKey ? mapCatalystLocality(localityKey) : undefined;
    const region =
      regionId && regionId !== "global"
        ? regionDisplayName(regionId)
        : regionId === "global"
          ? "Global"
          : localityLabel;

    if (!name || !tier || points === null) return [];

    return [
      {
        name,
        tier,
        points,
        // Stable progress key + wiki deep-link identity
        ...(wikiTaskId !== undefined ? { id: `wiki:${wikiTaskId}`, wikiTaskId } : {}),
        ...(information && information !== name ? { description: information } : {}),
        ...(region ? { region } : {}),
        ...(regionId ? { regionId } : {}),
        ...(localityKey ? { localityKey } : {}),
        ...(localityLabel ? { localityLabel } : {}),
        ...(requirements && requirements !== "N/A" ? { requirements } : {}),
        ...parseCompletionRate(textFromHtml(completionHtml)),
        sourceLeague: "catalyst" as const,
        testingOnly: true as const,
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
 * Normalizes wikiTaskId → id for stable progress keys.
 */
export function loadCatalystSnapshot(expectedRecords?: number): CatalystTaskLoadResult {
  const expected = expectedRecords ?? CATALYST_EXPECTED_RECORDS;
  const raw = (snapshot.records ?? []) as CatalystTaskRecord[];
  if (raw.length === 0) {
    return { records: [], error: "Catalyst task snapshot is empty", fromSnapshot: true };
  }
  if (!catalystRecordsPassIntegrity(raw.length, expected)) {
    return {
      records: [],
      error: `Catalyst snapshot incomplete: got ${raw.length}, expected at least ${Math.ceil(expected * 0.9)} of ${expected}`,
      fromSnapshot: true,
    };
  }
  // Ensure progress keys use wiki ids even on older snapshots that lack `id`.
  const records = raw.map((r) => ({
    ...r,
    ...(typeof r.wikiTaskId === "number" && !r.id ? { id: `wiki:${r.wikiTaskId}` } : {}),
    testingOnly: true as const,
  }));
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

/** Overlay live WikiSync rates from Module:…/completion.json (keys t{taskId}). */
export function applyCompletionRates(
  records: readonly CatalystTaskRecord[],
  completion: Record<string, unknown> | null | undefined,
): CatalystTaskRecord[] {
  if (!completion || typeof completion !== "object") return records as CatalystTaskRecord[];

  return records.map((record) => {
    if (typeof record.wikiTaskId !== "number") return record;
    const raw = completion[`t${record.wikiTaskId}`];
    if (typeof raw !== "number" || !Number.isFinite(raw)) return record;
    const rate = raw;
    // Wiki HTML shows "<0.1%" for tiny positive rates; module stores the number.
    const qualifier =
      (rate > 0 && rate < 0.1) || (rate === 0 && record.catalystCompletionRateQualifier === "<")
        ? ("<" as const)
        : undefined;
    if (record.catalystCompletionRate === rate) {
      const had = record.catalystCompletionRateQualifier === "<";
      if (Boolean(qualifier) === had) return record;
    }
    const { catalystCompletionRateQualifier: _drop, ...rest } = record;
    return {
      ...rest,
      catalystCompletionRate: rate,
      ...(qualifier ? { catalystCompletionRateQualifier: qualifier } : {}),
    };
  });
}

export async function fetchCatalystCompletionRates(): Promise<{
  rates: Record<string, number> | null;
  error?: string;
  live: boolean;
}> {
  try {
    // Next extends fetch with `next.revalidate`; keep timeout so a hung wiki doesn't block the page forever.
    const response = await fetch(CATALYST_COMPLETION_URL, {
      headers: {
        "User-Agent": "Equilibrium/0.1 RuneScape fan tool (github.com/sonnaya2/Equilibrium)",
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    } as RequestInit & { next?: { revalidate: number } });
    if (!response.ok) throw new Error(`RuneScape Wiki returned ${response.status}`);
    const payload = (await response.json()) as Record<string, unknown>;
    const rates: Record<string, number> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === "number" && Number.isFinite(value)) rates[key] = value;
    }
    if (Object.keys(rates).length === 0) {
      throw new Error("Completion module had no numeric rates");
    }
    return { rates, live: true };
  } catch (error) {
    return {
      rates: null,
      live: false,
      error: error instanceof Error ? error.message : "Unable to load live Comp%",
    };
  }
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

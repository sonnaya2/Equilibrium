import tasksData from "#data/league/tasks.json";
import {
  applyCompletionRates,
  CATALYST_TASKS_URL,
  fetchCatalystCompletionRates,
  loadCatalystSnapshot,
  type CatalystTaskRecord,
} from "@/tasks/catalyst";

export async function loadConceptTasks() {
  const testFallback = (
    tasksData as {
      testFallback?: {
        enabled: boolean;
        url: string;
        note: string;
        expectedRecords: number;
      };
    }
  ).testFallback;

  const useCatalystStandIn = tasksData.records.length === 0 && testFallback?.enabled === true;
  const catalystResult = useCatalystStandIn
    ? loadCatalystSnapshot(testFallback?.expectedRecords)
    : { records: [] as CatalystTaskRecord[], error: undefined as string | undefined };

  let records: CatalystTaskRecord[] | typeof tasksData.records = useCatalystStandIn
    ? catalystResult.records
    : tasksData.records;
  let completionLive = false;

  if (useCatalystStandIn && catalystResult.records.length > 0) {
    const completion = await fetchCatalystCompletionRates();
    records = applyCompletionRates(catalystResult.records, completion.rates);
    completionLive = completion.live;
  }

  return {
    records,
    useCatalystStandIn,
    catalystError: catalystResult.error,
    tiers: tasksData.tiers,
    tierConfidence: useCatalystStandIn ? ({} as Record<string, string>) : tasksData.tierConfidence,
    note: tasksData.note,
    pointValueNote: tasksData.pointValueNote,
    tasksWikiUrl: useCatalystStandIn ? testFallback?.url ?? CATALYST_TASKS_URL : tasksData.source.url,
    completionLive,
  };
}

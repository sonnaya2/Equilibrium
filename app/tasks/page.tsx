import tasksData from "#data/league/tasks.json";
import unknownsData from "#data/reference/unknowns.json";
import { Page } from "@/components/Page";
import { TaskRecords } from "@/components/TaskRecords";
import { loadCatalystTestTasks } from "@/tasks/catalyst";

const TASK_ORDER = ["easy", "medium", "hard", "elite", "master"] as const;

export const revalidate = 60 * 60 * 24;

type UnknownItem = {
  key: string;
  known?: string;
  missing?: string[];
};

export default async function TasksPage() {
  const taskUnknown = (unknownsData.items as UnknownItem[]).find((item) => item.key === "equilibrium_tasks");
  const useCatalystTestData = tasksData.records.length === 0 && tasksData.testFallback.enabled;
  const catalystResult = useCatalystTestData
    ? await loadCatalystTestTasks()
    : { records: [], error: undefined };
  const records = useCatalystTestData ? catalystResult.records : tasksData.records;
  const sourceUrl = useCatalystTestData ? tasksData.testFallback.url : tasksData.source.url;
  const sourceLabel = useCatalystTestData ? "Catalyst task source" : "Jagex reveal";

  return (
    <Page>
      <header className="border-b border-stone-750 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {useCatalystTestData ? (
              <div className="mb-2 inline-flex border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-amber-200">
                Test data · Catalyst League
              </div>
            ) : null}
            <h1 className="text-xl font-semibold tracking-tight text-parch-50">Tasks</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
              {useCatalystTestData ? tasksData.testFallback.note : tasksData.pointValueNote}
            </p>
            {useCatalystTestData ? (
              <p className="mt-1 max-w-3xl text-xs leading-5 text-parch-400">
                Catalyst completion rate is the historical Comp% shown by the RuneScape Wiki for each Catalyst task.
              </p>
            ) : null}
          </div>
          <div className="flex gap-3">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300"
            >
              {sourceLabel}
            </a>
            {useCatalystTestData ? (
              <a
                href={tasksData.source.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-parch-300 underline decoration-stone-750 underline-offset-4 hover:text-parch-50 hover:decoration-parch-300"
              >
                Equilibrium reveal
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <section className="border-b border-stone-750 py-5">
        <h2 className="text-sm font-medium text-parch-50">Points</h2>
        <div className="mt-2 grid border-t border-stone-750 sm:grid-cols-5">
          {TASK_ORDER.map((tier, index) => (
            <div key={tier} className={`py-3 sm:px-3 ${index > 0 ? "border-t border-stone-750 sm:border-l sm:border-t-0" : ""}`}>
              <div className="text-xs capitalize text-parch-300">{tier}</div>
              <div className="mt-1 font-mono text-lg text-parch-50">{tasksData.tiers[tier]}</div>
              {!useCatalystTestData && tasksData.tierConfidence[tier]?.startsWith("provisional") ? (
                <div className="mt-1 text-[11px] text-parch-400">provisional</div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-parch-50">Task list</h2>
          <span className="text-xs text-parch-300">
            {records.length} tasks loaded
            {useCatalystTestData ? ` · ${tasksData.testFallback.expectedRecords} expected from Catalyst` : ""}
          </span>
        </div>
        <div className="mt-2 border-t border-stone-750">
          {records.length === 0 ? (
            <>
              {useCatalystTestData && catalystResult.error ? (
                <p className="border-b border-stone-750/70 py-3 text-sm leading-6 text-amber-200">
                  Catalyst test data could not be loaded: {catalystResult.error}
                </p>
              ) : null}
              <p className="border-b border-stone-750/70 py-3 text-sm leading-6 text-parch-300">{tasksData.note}</p>
              {taskUnknown?.known ? <p className="border-b border-stone-750/70 py-3 text-sm leading-6 text-parch-300">{taskUnknown.known}</p> : null}
              {taskUnknown?.missing?.length ? (
                <div className="border-b border-stone-750/70 py-3">
                  <div className="text-xs text-parch-300">Waiting on</div>
                  <div className="mt-1 text-sm leading-6 text-parch-50">{taskUnknown.missing.join(" · ")}</div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="py-3">
              <TaskRecords
                records={records}
                tiers={tasksData.tiers}
                tierConfidence={useCatalystTestData ? {} : tasksData.tierConfidence}
              />
            </div>
          )}
        </div>
      </section>
    </Page>
  );
}

import tasksData from "#data/league/tasks.json";
import unknownsData from "#data/reference/unknowns.json";
import { Page } from "@/components/Page";
import { TaskRecords } from "@/components/TaskRecords";

const TASK_ORDER = ["easy", "medium", "hard", "elite", "master"] as const;

type UnknownItem = {
  key: string;
  known?: string;
  missing?: string[];
};

export default function TasksPage() {
  const taskUnknown = (unknownsData.items as UnknownItem[]).find((item) => item.key === "equilibrium_tasks");

  return (
    <Page>
      <header className="border-b border-stone-750 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-parch-50">Tasks</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
              {tasksData.pointValueNote}
            </p>
          </div>
          <a
            href={tasksData.source.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300"
          >
            Jagex reveal
          </a>
        </div>
      </header>

      <section className="border-b border-stone-750 py-5">
        <h2 className="text-sm font-medium text-parch-50">Points</h2>
        <div className="mt-2 grid border-t border-stone-750 sm:grid-cols-5">
          {TASK_ORDER.map((tier, index) => (
            <div key={tier} className={`py-3 sm:px-3 ${index > 0 ? "border-t border-stone-750 sm:border-l sm:border-t-0" : ""}`}>
              <div className="text-xs capitalize text-parch-300">{tier}</div>
              <div className="mt-1 font-mono text-lg text-parch-50">{tasksData.tiers[tier]}</div>
              {tasksData.tierConfidence[tier]?.startsWith("provisional") ? <div className="mt-1 text-[11px] text-parch-400">provisional</div> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="py-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-parch-50">Task list</h2>
          <span className="text-xs text-parch-300">{tasksData.records.length} tasks loaded</span>
        </div>
        <div className="mt-2 border-t border-stone-750">
          {tasksData.records.length === 0 ? (
            <>
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
                records={tasksData.records}
                tiers={tasksData.tiers}
                tierConfidence={tasksData.tierConfidence}
              />
            </div>
          )}
        </div>
      </section>
    </Page>
  );
}

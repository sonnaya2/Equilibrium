import Link from "next/link";
import { getCurrentResearchCatalog } from "@/research/currentCatalog";

export default function OverviewPage() {
  const catalog = getCurrentResearchCatalog();
  const elective = catalog.regions.filter((region) => region.availability === "elective");

  return (
    <section>
      <header className="border-b border-stone-750 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-parch-50">Equilibrium planner data</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
              Current research snapshot for region locks, training, major upgrades and the 2026 combat ruleset. Unknowns stay marked instead of being filled with guesses.
            </p>
          </div>
          <Link
            href="/data"
            className="border border-stone-750 px-3 py-1.5 text-xs text-parch-50 hover:border-brass-400/70"
          >
            Browse by region or skill
          </Link>
        </div>
      </header>

      <div className="grid border-b border-stone-750 md:grid-cols-[1fr_1fr]">
        <section className="border-b border-stone-750 py-5 md:border-b-0 md:border-r md:pr-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-parch-300">Region model</h2>
          <div className="mt-2 border-t border-stone-750">
            {catalog.regions.map((region) => (
              <div key={region.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-stone-750/70 py-2.5 text-sm">
                <div>
                  <div className="text-parch-50">{region.name}</div>
                  <div className="mt-0.5 text-xs text-parch-300">{region.skills.slice(0, 7).join(" · ") || "skills not normalized yet"}</div>
                </div>
                <div className="text-xs text-parch-300">{region.training.length} methods</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-parch-300">{region.availability.replaceAll("_", " ")}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-5 md:pl-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-parch-300">Hard rules and audit state</h2>
          <div className="mt-2 border-t border-stone-750">
            {catalog.hardRules.map((rule) => (
              <p key={rule} className="border-b border-stone-750/70 py-3 text-sm leading-6 text-parch-50">{rule}</p>
            ))}
          </div>

          <h2 className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-parch-300">Coverage</h2>
          <div className="mt-2 border-t border-stone-750">
            {Object.entries(catalog.coverage).map(([name, state]) => (
              <div key={name} className="grid gap-1 border-b border-stone-750/70 py-2.5 sm:grid-cols-[150px_1fr]">
                <div className="text-xs text-parch-50">{name.replaceAll("_", " ")}</div>
                <div className="text-xs leading-5 text-parch-300">{state}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="py-4 text-xs leading-5 text-parch-300">
        Snapshot {catalog.snapshotDate}. {catalog.skills.length} skill views and {elective.length} elective regions are represented in the current research build.
      </footer>
    </section>
  );
}

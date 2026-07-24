import Link from "next/link";
import { getResearchCatalog } from "@/research/catalog";

const LINKS = [
  ["/data", "Region & skill data", "Training methods, upgrades, areas and source links."],
  ["/build", "Build", "Pick elective regions and the currently revealed relic."],
  ["/combat", "Combat", "2026 combat changes, current Melee/Ranged data and Catalyst reference."],
  ["/tasks", "Tasks", "Published task point values and release state."],
] as const;

export default function OverviewPage() {
  const catalog = getResearchCatalog();
  const elective = catalog.regions.filter((region) => region.availability === "elective");

  return (
    <section>
      <header className="border-b border-stone-750 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-parch-50">Equilibrium</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
              Regions, training, upgrades and current combat data for RuneScape Leagues II.
            </p>
          </div>
          <Link href="/data" className="border border-stone-750 px-3 py-1.5 text-xs text-parch-50 hover:bg-stone-850">
            Browse data
          </Link>
        </div>
      </header>

      <div className="grid border-b border-stone-750 md:grid-cols-[1fr_1fr]">
        <section className="border-b border-stone-750 py-5 md:border-b-0 md:border-r md:pr-6">
          <h2 className="text-xs font-medium text-parch-300">Regions</h2>
          <div className="mt-2 border-t border-stone-750">
            {catalog.regions.map((region) => (
              <div key={region.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-stone-750/70 py-2.5 text-sm">
                <div>
                  <div className="text-parch-50">{region.name}</div>
                  <div className="mt-0.5 text-xs text-parch-300">{region.skills.slice(0, 7).join(" · ") || "More data pending"}</div>
                </div>
                <div className="text-xs text-parch-300">{region.training.length} methods</div>
                <div className="text-[10px] uppercase tracking-[0.1em] text-parch-300">{region.availability.replaceAll("_", " ")}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-5 md:pl-6">
          <h2 className="text-xs font-medium text-parch-300">Browse</h2>
          <div className="mt-2 border-t border-stone-750">
            {LINKS.map(([href, title, description]) => (
              <Link key={href} href={href} className="grid gap-1 border-b border-stone-750/70 py-3 hover:bg-white/[0.02] sm:grid-cols-[150px_minmax(0,1fr)]">
                <span className="text-sm text-parch-50">{title}</span>
                <span className="text-xs leading-5 text-parch-300">{description}</span>
              </Link>
            ))}
          </div>

          <h2 className="mt-6 text-xs font-medium text-parch-300">Current data</h2>
          <div className="mt-2 border-t border-stone-750">
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2.5 text-sm"><span className="text-parch-300">Regions</span><span className="text-right text-parch-50">{catalog.datasets.regions}</span></div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2.5 text-sm"><span className="text-parch-300">Skills</span><span className="text-right text-parch-50">{catalog.datasets.skills}</span></div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2.5 text-sm"><span className="text-parch-300">Training methods</span><span className="text-right text-parch-50">{catalog.datasets.trainingMethods}</span></div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2.5 text-sm"><span className="text-parch-300">Relic tiers revealed</span><span className="text-right text-parch-50">{catalog.datasets.revealedRelicTiers}/{catalog.datasets.relicTiers}</span></div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2.5 text-sm"><span className="text-parch-300">Blessing tiers revealed</span><span className="text-right text-parch-50">{catalog.datasets.revealedBlessingTiers}/{catalog.datasets.blessingTiers}</span></div>
            <div className="grid grid-cols-2 border-b border-stone-750/70 py-2.5 text-sm"><span className="text-parch-300">Published tasks</span><span className="text-right text-parch-50">{catalog.datasets.publishedTasks || "pending"}</span></div>
          </div>

          <h2 className="mt-6 text-xs font-medium text-parch-300">Region rules</h2>
          <div className="mt-2 border-t border-stone-750">
            {catalog.hardRules.map((rule) => <p key={rule} className="border-b border-stone-750/70 py-3 text-sm leading-6 text-parch-50">{rule}</p>)}
          </div>
        </section>
      </div>

      <footer className="py-4 text-xs leading-5 text-parch-300">
        Updated {catalog.snapshotDate}. {catalog.skills.length} skills and {elective.length} elective regions listed.
      </footer>
    </section>
  );
}

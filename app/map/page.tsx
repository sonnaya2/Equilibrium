import { getResearchCatalog } from "@/research/catalog";

function accessLabel(value: string): string {
  if (value === "automatic_early") return "early unlock";
  return value.replaceAll("_", " ");
}

export default function MapPage() {
  const catalog = getResearchCatalog();

  return (
    <section>
      <header className="border-b border-stone-750 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-parch-50">Map</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-300">
          Region access and the areas currently mapped to each pick. Geometry comes later; this view only shows boundaries we can support with data.
        </p>
      </header>

      <div className="overflow-x-auto border-t border-stone-750">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="text-xs text-parch-300">
            <tr className="border-b border-stone-750">
              <th className="py-2 pr-4 font-medium">Region</th>
              <th className="py-2 pr-4 font-medium">Access</th>
              <th className="py-2 pr-4 font-medium">Areas</th>
              <th className="py-2 pr-4 font-medium">Training</th>
              <th className="py-2 font-medium">Upgrades</th>
            </tr>
          </thead>
          <tbody>
            {catalog.regions.map((region) => (
              <tr key={region.id} className="border-b border-stone-750/70 align-top">
                <td className="py-3 pr-4 text-parch-50">{region.name}</td>
                <td className="whitespace-nowrap py-3 pr-4 text-xs text-parch-300">{accessLabel(region.availability)}</td>
                <td className="max-w-2xl py-3 pr-4 text-xs leading-5 text-parch-300">{region.areas.join(" · ") || "—"}</td>
                <td className="py-3 pr-4 font-mono text-xs text-parch-50">{region.training.length}</td>
                <td className="py-3 font-mono text-xs text-parch-50">{region.upgrades.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="py-5">
        <h2 className="text-sm font-medium text-parch-50">Boundary rules</h2>
        <div className="mt-2 border-t border-stone-750">
          {catalog.hardRules.map((rule) => (
            <p key={rule} className="border-b border-stone-750/70 py-3 text-sm leading-6 text-parch-300">{rule}</p>
          ))}
        </div>
      </section>
    </section>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { GameIcon } from "@/components/GameIcon";
import { DataWorkbench } from "@/components/DataWorkbench";
import { WorkbenchTabs } from "@/components/WorkbenchTabs";
import { regionCrestPath } from "@/lib/gameArt";
import type { ResearchCatalog } from "@/research/catalog";
import type { ShellLayout } from "@/concepts/skins/registry";
import { DATA_CATEGORIES, type DataCategoryId, renderDataCategory } from "@/concepts/live/panels";

export function ConceptDataLive({
  layout,
  catalog,
  notes,
}: {
  layout: ShellLayout;
  catalog: ResearchCatalog;
  notes: ReactNode;
}) {
  if (layout === "tabs") {
    return (
      <DataWorkbench
        browse={renderDataCategory("browse", catalog, notes)}
        quests={renderDataCategory("quests", catalog, notes)}
        progression={renderDataCategory("progression", catalog, notes)}
        unlocks={renderDataCategory("unlocks", catalog, notes)}
        regional={renderDataCategory("regional", catalog, notes)}
        combatBis={renderDataCategory("combatBis", catalog, notes)}
        combos={renderDataCategory("combos", catalog, notes)}
        slayer={renderDataCategory("slayer", catalog, notes)}
        invention={renderDataCategory("invention", catalog, notes)}
        prayers={renderDataCategory("prayers", catalog, notes)}
        consumables={renderDataCategory("consumables", catalog, notes)}
        systems={renderDataCategory("systems", catalog, notes)}
        archaeology={renderDataCategory("crafting", catalog, notes)}
        masterwork={<></>}
        referenceNotes={renderDataCategory("notes", catalog, notes)}
        boundaries={renderDataCategory("boundaries", catalog, notes)}
        notes={null}
      />
    );
  }

  if (layout === "lattice") return <LatticeData catalog={catalog} notes={notes} />;
  if (layout === "wartable") return <WarTableData catalog={catalog} notes={notes} />;
  return <ControlData catalog={catalog} notes={notes} />;
}

function Inspector({
  catalog,
  cat,
  regionId,
}: {
  catalog: ResearchCatalog;
  cat: DataCategoryId;
  regionId: string | null;
}) {
  const region = catalog.regions.find((r) => r.id === regionId) ?? catalog.regions[0];
  const catLabel = DATA_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-stone-750 bg-stone-900 p-3 text-sm">
      <p className="font-display text-xs uppercase tracking-[0.14em] text-gold-400">Inspector</p>
      <p className="mt-2 text-parch-100">Category · {catLabel}</p>
      {region ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <GameIcon src={regionCrestPath(region.id)} size={28} />
            <div>
              <p className="text-base text-parch-50">{region.name}</p>
              <p className="text-xs text-parch-100">{region.availability.replaceAll("_", " ")}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 border-t border-stone-750 pt-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-parch-100">Training</dt>
              <dd className="font-mono text-gem-400">{region.training.length}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-parch-100">Upgrades</dt>
              <dd className="font-mono text-gem-400">{region.upgrades.length}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-parch-100">Content</dt>
              <dd className="font-mono text-parch-50">{region.content.length}</dd>
            </div>
          </dl>
        </>
      ) : null}
      <p className="mt-4 text-xs text-parch-300">Real catalog · {catalog.snapshotDate}</p>
    </aside>
  );
}

function LatticeData({ catalog, notes }: { catalog: ResearchCatalog; notes: ReactNode }) {
  const [cat, setCat] = useState<DataCategoryId>("browse");
  const [regionId, setRegionId] = useState(catalog.regions[0]?.id ?? "");
  const tabs = DATA_CATEGORIES.map((c) => ({ id: c.id, label: c.label }));

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col border border-stone-750">
      <WorkbenchTabs aria-label="Data categories" tabs={tabs} active={cat} onChange={setCat} />
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-b border-stone-750 bg-stone-900 p-2 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-parch-100">
            Region hex rail
          </p>
          <ul className="space-y-1">
            {catalog.regions.map((region) => (
              <li key={region.id}>
                <button
                  type="button"
                  onClick={() => setRegionId(region.id)}
                  className={`flex w-full items-center gap-2 border px-2 py-1.5 text-left text-[13px] ${
                    region.id === regionId
                      ? "border-gem-500 bg-stone-raised text-gem-300"
                      : "border-stone-750 bg-stone-850 text-parch-50 hover:border-gem-600"
                  }`}
                >
                  <span
                    className="inline-block h-3 w-3 shrink-0 rotate-45 border border-gem-500 bg-stone-800"
                    aria-hidden
                  />
                  <GameIcon src={regionCrestPath(region.id)} size={16} />
                  <span className="truncate">{region.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="min-h-0 overflow-auto p-3">
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-sm uppercase tracking-[0.14em] text-gold-400">
              {DATA_CATEGORIES.find((c) => c.id === cat)?.label}
            </h2>
            <span className="text-xs text-parch-100">Lattice · focus {regionId || "—"}</span>
          </header>
          {renderDataCategory(cat, catalog, notes)}
        </main>
      </div>
    </div>
  );
}

function WarTableData({ catalog, notes }: { catalog: ResearchCatalog; notes: ReactNode }) {
  const [cat, setCat] = useState<DataCategoryId>("browse");
  return (
    <div className="grid min-h-[calc(100vh-14rem)] grid-cols-1 border border-stone-750 lg:grid-cols-[200px_minmax(0,1fr)_240px]">
      <nav className="overflow-y-auto border-b border-stone-750 bg-stone-900 lg:border-b-0 lg:border-r">
        <p className="border-b border-stone-750 px-2 py-1.5 text-[11px] uppercase tracking-[0.08em] text-parch-100">
          Research rail
        </p>
        <ul>
          {DATA_CATEGORIES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setCat(item.id)}
                className={`w-full border-l-2 px-2.5 py-2 text-left text-[13px] ${
                  item.id === cat
                    ? "border-gem-400 bg-stone-850 text-parch-50"
                    : "border-transparent text-parch-100 hover:bg-stone-850"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section className="flex min-h-0 flex-col overflow-hidden">
        <header className="border-b border-stone-750 px-3 py-2 text-sm text-parch-50">
          {DATA_CATEGORIES.find((c) => c.id === cat)?.label}
          <span className="ml-2 font-mono text-xs text-parch-100">War Table</span>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {renderDataCategory(cat, catalog, notes)}
        </div>
      </section>
      <Inspector catalog={catalog} cat={cat} regionId={catalog.regions[0]?.id ?? null} />
    </div>
  );
}

function ControlData({ catalog, notes }: { catalog: ResearchCatalog; notes: ReactNode }) {
  const [cat, setCat] = useState<DataCategoryId>("browse");
  const [regionId, setRegionId] = useState(catalog.regions[0]?.id ?? "");

  return (
    <div className="grid min-h-[calc(100vh-14rem)] grid-cols-1 border border-stone-750 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
      <nav className="overflow-y-auto border-b border-stone-750 bg-stone-900 lg:border-b-0 lg:border-r">
        <p className="border-b border-stone-750 px-2 py-1.5 text-[11px] uppercase tracking-[0.08em] text-parch-100">
          System tree
        </p>
        <ul className="border-b border-stone-750 py-1">
          {DATA_CATEGORIES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setCat(item.id)}
                className={`w-full px-2.5 py-1.5 text-left text-[13px] ${
                  item.id === cat
                    ? "bg-stone-850 text-gem-300"
                    : "text-parch-100 hover:bg-stone-850"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        {cat === "browse" ? (
          <ul className="py-1">
            {catalog.regions.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setRegionId(r.id)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] ${
                    r.id === regionId ? "bg-stone-raised text-parch-50" : "text-parch-100 hover:bg-stone-850"
                  }`}
                >
                  <GameIcon src={regionCrestPath(r.id)} size={16} />
                  <span className="truncate">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </nav>
      <section className="min-h-0 overflow-auto p-3">
        <h2 className="mb-3 text-sm font-medium text-parch-50">
          {DATA_CATEGORIES.find((c) => c.id === cat)?.label}
        </h2>
        {renderDataCategory(cat, catalog, notes)}
      </section>
      <Inspector catalog={catalog} cat={cat} regionId={regionId || null} />
    </div>
  );
}

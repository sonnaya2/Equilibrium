import sourcesData from "#shard/research/sources.json";
import { Page } from "@/components/Page";
import { CombatTabs } from "@/components/combat/CombatTabs";
import { parseSourceRef, type SourceRefShape } from "@/lib/dataValidate";

function sourceByTitle(sources: SourceRefShape[], fragment: string): SourceRefShape | undefined {
  const needle = fragment.toLowerCase();
  return sources.find((source) => source.title?.toLowerCase().includes(needle));
}

function SourceLink({ source, label }: { source?: SourceRefShape; label?: string }) {
  if (!source) return null;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300"
    >
      {label ?? source.title ?? "Source"}
    </a>
  );
}

const sources = Array.isArray(sourcesData.records)
  ? sourcesData.records.map(parseSourceRef).filter((s): s is SourceRefShape => s != null)
  : [];

const combatWiki = sourceByTitle(sources, "Combat Style Modernisation");
const patchOne = sourceByTitle(sources, "Part 1 - Combat Style Modernisation");
const patchTwo = sourceByTitle(sources, "Part 2 - Combat Style Modernisation");

export default function CombatPage() {
  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="route-fill">
        <CombatTabs
          sourceLinks={
            <span className="flex gap-3">
              <SourceLink source={combatWiki} label="Wiki" />
              <SourceLink source={patchOne} label="Patch 1" />
              <SourceLink source={patchTwo} label="Patch 2" />
            </span>
          }
        />
      </div>
    </Page>
  );
}

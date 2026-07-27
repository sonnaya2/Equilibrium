import combatData from "#data/combat/modernisation-2026.json";
import updateIndexData from "#data/combat/update-index.json";
import catalystData from "#data/league/catalyst.json";
import changesData from "#data/reference/changes-2026.json";
import sourcesData from "#data/research/sources.json";
import { Page } from "@/components/Page";
import { CombatTabs } from "@/components/combat/CombatTabs";
import { CombatReference } from "@/components/combat/CombatReference";
import {
  parseAbilityList,
  parseSourceRef,
  type CombatAbilityRow,
  type SourceRefShape,
} from "@/lib/dataValidate";

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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function abilityEffect(ability: CombatAbilityRow): string {
  const parts: string[] = [];

  if (ability.damage_percent) parts.push(String(ability.damage_percent));
  if (ability.damage) parts.push(String(ability.damage));
  if (ability.two_handed) parts.push(`2H: ${ability.two_handed}`);
  if (ability.dual_wield) parts.push(`DW: ${ability.dual_wield}`);
  if (ability.special_rule) parts.push(String(ability.special_rule));
  if (ability.summary) parts.push(String(ability.summary));
  if (ability.igneous_variant) parts.push(`Igneous: ${ability.igneous_variant}`);
  if (ability.bloodlust) parts.push(String(ability.bloodlust));
  if (ability.other) parts.push(String(ability.other));
  if (ability.chain) parts.push(String(ability.chain));
  if (ability.movement) parts.push(String(ability.movement));
  if (ability.healing_percent) parts.push(`${ability.healing_percent}% healing`);
  if (ability.cooldown_seconds) parts.push(`${ability.cooldown_seconds}s cooldown`);
  if (ability.duration_seconds) parts.push(`${ability.duration_seconds}s duration`);
  if (ability.damage_multiplier) parts.push(`${ability.damage_multiplier}x outgoing damage`);
  if (ability.incoming_damage_multiplier)
    parts.push(`${ability.incoming_damage_multiplier}x incoming damage`);
  if (ability.bloodlust_gain) parts.push(`+${ability.bloodlust_gain} Bloodlust`);

  return parts.join(" · ") || "—";
}

const sources = Array.isArray(sourcesData.records)
  ? sourcesData.records.map(parseSourceRef).filter((s): s is SourceRefShape => s != null)
  : [];

const combat = combatData;
const catalyst = catalystData;
const changes = changesData.changes;
const combatWiki = sourceByTitle(sources, "Combat Style Modernisation");
const patchOne = sourceByTitle(sources, "Part 1 - Combat Style Modernisation");
const patchTwo = sourceByTitle(sources, "Part 2 - Combat Style Modernisation");
const catalystWiki = sourceByTitle(sources, "Catalyst League/Guide");

export default function CombatPage() {
  const meleeAbilities = parseAbilityList(
    combat.melee.important_abilities_after_initial_patches,
    "combat.melee.important_abilities_after_initial_patches",
  );

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="workbench-fill">
        <div className="combat-route-meta mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-parch-100">
          <span className="combat-route-title font-medium text-parch-50">Combat</span>
          <span className="ml-auto flex gap-3">
            <SourceLink source={combatWiki} label="Wiki" />
            <SourceLink source={patchOne} label="Patch 1" />
            <SourceLink source={patchTwo} label="Patch 2" />
          </span>
        </div>

        <CombatTabs
          reference={
            <CombatReference
              combat={combat}
              meleeAbilities={meleeAbilities}
              changes={changes}
              catalyst={catalyst}
              updateIndex={updateIndexData}
              catalystWiki={catalystWiki}
              sourceLink={SourceLink}
              abilityEffect={abilityEffect}
              formatNumber={formatNumber}
            />
          }
        />
      </div>
    </Page>
  );
}

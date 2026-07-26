import combatData from "#data/combat/modernisation-2026.json";
import updateIndexData from "#data/combat/update-index.json";
import catalystData from "#data/league/catalyst.json";
import changesData from "#data/reference/changes-2026.json";
import sourcesData from "#data/research/sources.json";
import { combatSyncFacts } from "@/combat/data";
import { Page } from "@/components/Page";
import { CombatTabs } from "@/components/combat/CombatTabs";

type SourceRecord = {
  source: string;
  url: string;
  title?: string;
};

type Ability = Record<string, string | number | boolean | undefined> & {
  name: string;
};

const sources = sourcesData.records as SourceRecord[];

function sourceByTitle(fragment: string): SourceRecord | undefined {
  const needle = fragment.toLowerCase();
  return sources.find((source) => source.title?.toLowerCase().includes(needle));
}

function SourceLink({ source, label }: { source?: SourceRecord; label?: string }) {
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

function abilityEffect(ability: Ability): string {
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
  if (ability.incoming_damage_multiplier) parts.push(`${ability.incoming_damage_multiplier}x incoming damage`);
  if (ability.bloodlust_gain) parts.push(`+${ability.bloodlust_gain} Bloodlust`);

  return parts.join(" · ") || "—";
}

const combat = combatData;
const catalyst = catalystData;
const changes = changesData.changes;
const combatWiki = sourceByTitle("Combat Style Modernisation");
const patchOne = sourceByTitle("Part 1 - Combat Style Modernisation");
const patchTwo = sourceByTitle("Part 2 - Combat Style Modernisation");
const catalystWiki = sourceByTitle("Catalyst League/Guide");

export default function CombatPage() {
  const meleeAbilities = combat.melee.important_abilities_after_initial_patches as unknown as Ability[];

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="workbench-fill">
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-parch-100">
          <span className="font-medium text-parch-50">Combat</span>
          <span className="text-parch-300">Live math on Quick · post-March 2026 kit</span>
          <span className="ml-auto flex gap-3">
            <SourceLink source={combatWiki} label="Wiki" />
            <SourceLink source={patchOne} label="Patch 1" />
            <SourceLink source={patchTwo} label="Patch 2" />
          </span>
        </div>

      <CombatTabs
        reference={
          <>
      <section className="border-b border-stone-750 py-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-parch-50">Data sync</h2>
          <span className="text-xs text-parch-300">
            {updateIndexData.records.length} tracked entities · polled {updateIndexData.lastSynced}
          </span>
        </div>
        <dl className="grid text-xs md:grid-cols-5">
          {combatSyncFacts().map((fact) => (
            <div key={fact.kind} className="border-t border-stone-750 py-2 md:pr-4">
              <dt className="capitalize text-parch-300">{fact.kind}</dt>
              <dd className="mt-0.5 font-mono text-parch-50">{fact.records} records</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-parch-300">
          Wiki poll: {(updateIndexData.records as Array<{ stale?: boolean }>).some((entry) => entry.stale)
            ? "stale rows — run npm run sync:combat"
            : "no tracked page revised since last verify"}
          {" · since "}
          {updateIndexData.trackedSince}
        </p>
      </section>

      <section className="grid border-b border-stone-750 md:grid-cols-4">
        {Object.entries(combat.style_identity).map(([style, identity], index) => (
          <div
            key={style}
            className={`py-3 md:px-3 ${index > 0 ? "border-t border-stone-750 md:border-l md:border-t-0" : ""}`}
          >
            <h2 className="text-sm font-medium capitalize text-parch-50">{style}</h2>
            <p className="mt-1 text-xs leading-5 text-parch-300">{identity}</p>
          </div>
        ))}
      </section>

      <section className="border-b border-stone-750 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-parch-50">2026 changes</h2>
          <span className="text-xs text-parch-300">Road to Restoration</span>
        </div>
        <div className="overflow-x-auto border-t border-stone-750">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="text-xs text-parch-300">
              <tr className="border-b border-stone-750">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Update</th>
                <th className="py-2 pr-4 font-medium">What changed</th>
                <th className="py-2 font-medium">League impact</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={`${change.date}-${change.name}`} className="border-b border-stone-750/70 align-top">
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-parch-300">{change.date}</td>
                  <td className="py-2 pr-4 text-parch-50">{change.name}</td>
                  <td className="max-w-lg py-2 pr-4 text-xs leading-5 text-parch-300">{change.summary}</td>
                  <td className="max-w-lg py-2 text-xs leading-5 text-parch-300">{change.league_impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-b border-stone-750 py-3">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)]">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Melee / Bloodlust</h2>
            <p className="mt-1.5 text-sm leading-5 text-parch-300">{combat.melee.bloodlust.summary}</p>
            <dl className="mt-3 border-t border-stone-750 text-sm">
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">Normal cap</dt>
                <dd className="text-right text-parch-50">{combat.melee.bloodlust.normal_max_stacks} stacks</dd>
              </div>
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">Berserk cap</dt>
                <dd className="text-right text-parch-50">{combat.melee.bloodlust.berserk_max_stacks} stacks</dd>
              </div>
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">Ability books</dt>
                <dd className="text-right text-parch-50">Strength folded into Attack</dd>
              </div>
            </dl>
          </div>

          <div className="overflow-x-auto border-t border-stone-750">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="text-xs text-parch-300">
                <tr className="border-b border-stone-750">
                  <th className="py-2 pr-4 font-medium">Ability</th>
                  <th className="py-2 pr-4 font-medium">Level</th>
                  <th className="py-2 pr-4 font-medium">Adrenaline</th>
                  <th className="py-2 font-medium">Current effect</th>
                </tr>
              </thead>
              <tbody>
                {meleeAbilities.map((ability) => (
                  <tr key={ability.name} className="border-b border-stone-750/70 align-top">
                    <td className="py-2 pr-4 text-parch-50">{ability.name}</td>
                    <td className="py-2 pr-4 text-xs text-parch-300">{ability.unlock_level ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs text-parch-300">
                      {ability.adrenaline_cost_percent
                        ? `${ability.adrenaline_cost_percent}% cost`
                        : ability.adrenaline_gain_percent
                          ? `+${ability.adrenaline_gain_percent}%`
                          : "—"}
                    </td>
                    <td className="py-2 text-xs leading-5 text-parch-300">{abilityEffect(ability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 text-parch-300">
          Retired legacy examples: {combat.melee.removed_or_retired_legacy_examples.join(", ")}.
        </p>
      </section>

      <section className="border-b border-stone-750 py-3">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Ranged ammunition</h2>
            <div className="mt-1.5 border-t border-stone-750">
              {combat.ranged.ammo_system.map((ammo) => (
                <div key={ammo.name} className="border-b border-stone-750/70 py-2">
                  <div className="text-sm text-parch-50">{ammo.name}</div>
                  <p className="mt-0.5 text-xs leading-5 text-parch-300">{ammo.effect}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-medium text-parch-50">Ranged ability changes</h2>
            <div className="mt-1.5 border-t border-stone-750">
              {combat.ranged.important_ability_changes.map((ability) => (
                <div key={ability.name} className="border-b border-stone-750/70 py-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="text-sm text-parch-50">{ability.name}</div>
                    {"adrenaline_cost_percent" in ability ? (
                      <div className="text-xs text-parch-300">{ability.adrenaline_cost_percent}% adrenaline</div>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-parch-300">{ability.effect}</p>
                  {"duration_seconds" in ability ? (
                    <p className="mt-0.5 text-xs text-parch-300">
                      {ability.duration_seconds}s base{"greater_duration_seconds" in ability ? ` · ${ability.greater_duration_seconds}s greater` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-b border-stone-750 py-3 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-parch-50">Magic</h2>
          <p className="mt-1.5 text-sm leading-5 text-parch-300">{combat.magic.identity}</p>
          <p className="mt-1 text-xs leading-5 text-parch-300">{combat.magic.data_status}</p>
        </div>
        <div>
          <h2 className="text-sm font-medium text-parch-50">Aura overhaul</h2>
          <p className="mt-1.5 text-sm leading-5 text-parch-300">{combat.aura_overhaul_follow_up.summary}</p>
          <p className="mt-1 text-xs leading-5 text-parch-300">{combat.aura_overhaul_follow_up.vampyrism_and_penance}</p>
          <p className="mt-1 text-xs leading-5 text-parch-300">{combat.aura_overhaul_follow_up.league_relevance}</p>
        </div>
      </section>

      <section className="border-b border-stone-750 py-3">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Catalyst baseline</h2>
            <p className="mt-0.5 text-xs text-parch-300">History only — not Equilibrium multipliers</p>
          </div>
          <SourceLink source={catalystWiki} label="Catalyst Wiki" />
        </div>
        <div className="overflow-x-auto border-t border-stone-750">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="text-xs text-parch-300">
              <tr className="border-b border-stone-750">
                <th className="py-2 pr-4 font-medium">Tier</th>
                <th className="py-2 pr-4 font-medium">Points</th>
                <th className="py-2 pr-4 font-medium">XP</th>
                <th className="py-2 pr-4 font-medium">Relics</th>
                <th className="py-2 font-medium">Passives</th>
              </tr>
            </thead>
            <tbody>
              {catalyst.tiers.map((tier) => (
                <tr key={tier.tier} className="border-b border-stone-750/70 align-top">
                  <td className="py-2 pr-4 text-parch-50">{tier.tier}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-parch-300">{formatNumber(tier.points_required)}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-parch-50">{tier.xp_multiplier}x</td>
                  <td className="max-w-sm py-2 pr-4 text-xs leading-5 text-parch-300">{tier.relic_choices.join(" · ")}</td>
                  <td className="max-w-xl py-2 text-xs leading-5 text-parch-300">{tier.passives.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="py-3">
        <h2 className="text-sm font-medium text-parch-50">Do not carry forward</h2>
        <div className="mt-1.5 border-t border-stone-750">
          {catalyst.equilibrium_comparison_notes.map((note) => (
            <p key={note} className="border-b border-stone-750/70 py-2 text-sm leading-5 text-parch-300">{note}</p>
          ))}
        </div>
      </section>
          </>
        }
      />
      </div>
    </Page>
  );
}

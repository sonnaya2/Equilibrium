import type { ReactNode } from "react";
import { combatSyncFacts } from "@/combat/data";
import { CombatFrameCorners } from "@/components/combat/CombatFrameCorners";
import type { CombatAbilityRow } from "@/lib/dataValidate";

type SourceRecord = {
  source: string;
  url: string;
  title?: string;
};

type ChangeRow = {
  date: string;
  name: string;
  summary: string;
  league_impact: string;
};

type AmmoRow = { name: string; effect: string };

type AbilityChangeRow = {
  name: string;
  effect: string;
  adrenaline_cost_percent?: number | string;
  duration_seconds?: number | string;
  greater_duration_seconds?: number | string;
};

type CatalystTier = {
  tier: string | number;
  points_required: number;
  xp_multiplier: number;
  relic_choices: string[];
  passives: string[];
};

export type CombatReferenceProps = {
  combat: {
    style_identity: Record<string, string>;
    melee: {
      bloodlust: {
        summary: string;
        normal_max_stacks: number | string;
        berserk_max_stacks: number | string;
      };
      removed_or_retired_legacy_examples: string[];
    };
    ranged: {
      ammo_system: AmmoRow[];
      important_ability_changes: AbilityChangeRow[];
    };
    magic: { identity: string; data_status: string };
    aura_overhaul_follow_up: {
      summary: string;
      vampyrism_and_penance: string;
      league_relevance: string;
    };
  };
  meleeAbilities: CombatAbilityRow[];
  changes: ChangeRow[];
  catalyst: {
    tiers: CatalystTier[];
    equilibrium_comparison_notes: string[];
  };
  updateIndex: {
    // Ledger rows may include many fields; only `stale` is read here.
    records: ReadonlyArray<Record<string, unknown>>;
    lastSynced: string;
    trackedSince: string;
  };
  catalystWiki?: SourceRecord;
  sourceLink: (props: { source?: SourceRecord; label?: string }) => ReactNode;
  abilityEffect: (ability: CombatAbilityRow) => string;
  formatNumber: (value: number) => string;
};

export function CombatReference({
  combat,
  meleeAbilities,
  changes,
  catalyst,
  updateIndex,
  catalystWiki,
  sourceLink: SourceLink,
  abilityEffect,
  formatNumber,
}: CombatReferenceProps) {
  return (
    <div className="combat-reference">
      <header className="combat-frame reference-header">
        <CombatFrameCorners />
        <h2 className="combat-page-title">Reference</h2>
      </header>
      <section className="border-b border-stone-750 py-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-parch-50">Data updates</h2>
          <span className="text-xs text-parch-300">
            {updateIndex.records.length} tracked pages · checked {updateIndex.lastSynced}
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
          Wiki check:{" "}
          {updateIndex.records.some((entry) => entry.stale === true)
            ? "stale rows. Run npm run sync:combat"
            : "no tracked page revised since last verify"}
          {" · since "}
          {updateIndex.trackedSince}
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
                <tr
                  key={`${change.date}-${change.name}`}
                  className="border-b border-stone-750/70 align-top"
                >
                  <td className="whitespace-nowrap py-2 pr-4 font-mono text-xs text-parch-300">
                    {change.date}
                  </td>
                  <td className="py-2 pr-4 text-parch-50">{change.name}</td>
                  <td className="max-w-lg py-2 pr-4 text-xs leading-5 text-parch-300">
                    {change.summary}
                  </td>
                  <td className="max-w-lg py-2 text-xs leading-5 text-parch-300">
                    {change.league_impact}
                  </td>
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
            <p className="mt-1.5 text-sm leading-5 text-parch-300">
              {combat.melee.bloodlust.summary}
            </p>
            <dl className="mt-3 border-t border-stone-750 text-sm">
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">Normal cap</dt>
                <dd className="text-right text-parch-50">
                  {combat.melee.bloodlust.normal_max_stacks} stacks
                </dd>
              </div>
              <div className="grid grid-cols-2 border-b border-stone-750/70 py-1.5">
                <dt className="text-parch-300">Berserk cap</dt>
                <dd className="text-right text-parch-50">
                  {combat.melee.bloodlust.berserk_max_stacks} stacks
                </dd>
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
                    <td className="py-2 pr-4 text-xs text-parch-300">
                      {ability.unlock_level ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs text-parch-300">
                      {ability.adrenaline_cost_percent
                        ? `${ability.adrenaline_cost_percent}% cost`
                        : ability.adrenaline_gain_percent
                          ? `+${ability.adrenaline_gain_percent}%`
                          : "—"}
                    </td>
                    <td className="py-2 text-xs leading-5 text-parch-300">
                      {abilityEffect(ability)}
                    </td>
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
                    {"adrenaline_cost_percent" in ability &&
                    ability.adrenaline_cost_percent != null ? (
                      <div className="text-xs text-parch-300">
                        {ability.adrenaline_cost_percent}% adrenaline
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-parch-300">{ability.effect}</p>
                  {"duration_seconds" in ability && ability.duration_seconds != null ? (
                    <p className="mt-0.5 text-xs text-parch-300">
                      {ability.duration_seconds}s base
                      {"greater_duration_seconds" in ability &&
                      ability.greater_duration_seconds != null
                        ? ` · ${ability.greater_duration_seconds}s greater`
                        : ""}
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
          <p className="mt-1.5 text-sm leading-5 text-parch-300">
            {combat.aura_overhaul_follow_up.summary}
          </p>
          <p className="mt-1 text-xs leading-5 text-parch-300">
            {combat.aura_overhaul_follow_up.vampyrism_and_penance}
          </p>
          <p className="mt-1 text-xs leading-5 text-parch-300">
            {combat.aura_overhaul_follow_up.league_relevance}
          </p>
        </div>
      </section>

      <section className="border-b border-stone-750 py-3">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-parch-50">Catalyst League reference</h2>
            <p className="mt-0.5 text-xs text-parch-300">
              Catalyst history. Not used in Equilibrium math.
            </p>
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
                  <td className="py-2 pr-4 font-mono text-xs text-parch-300">
                    {formatNumber(tier.points_required)}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-parch-50">
                    {tier.xp_multiplier}x
                  </td>
                  <td className="max-w-sm py-2 pr-4 text-xs leading-5 text-parch-300">
                    {tier.relic_choices.join(" · ")}
                  </td>
                  <td className="max-w-xl py-2 text-xs leading-5 text-parch-300">
                    {tier.passives.join(" ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="py-3">
        <h2 className="text-sm font-medium text-parch-50">Outdated Catalyst rules</h2>
        <div className="mt-1.5 border-t border-stone-750">
          {catalyst.equilibrium_comparison_notes.map((note) => (
            <p
              key={note}
              className="border-b border-stone-750/70 py-2 text-sm leading-5 text-parch-300"
            >
              {note}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

import type { ItemPassiveId } from "../../data/records";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import {
  COMMAND_REQUIRES_CONJURE,
  REVO_CONJURE_COMMAND_MORPH,
  conjureActive,
  findConjure,
} from "../../styles/necromancy/conjures";
import { castRejection, resolveCastAbility, type WeaponConfiguration } from "../cast/rules";
import { createRuntime } from "../runtime/runtime";
import type { RotationState } from "../runtime/state";
import { firstLegalTickFor } from "../runtime/state";
import type { CastRecord, RotationSummary, SimulateInput, SimulateOptions } from "./simulate";
import { combineStochasticSummaries, type StochasticLane } from "./summary";
import type { ResolvedLeagueRules } from "../../league/ruleset";
import { runWithHitReuseScope } from "../resolution/hitReuse";
import { performCast } from "../cast";
import { stochasticLaneCount } from "../runtime/stochastic";

export interface RevolutionInput extends Omit<SimulateInput, "rotation" | "autoWeave"> {
  bar: readonly AbilitySpec[];
  style: AbilitySpec["style"];
  durationTicks: number;
}

/** CD/lockout ready and castRejection clear (necroCanCast, adren, loadout). */
function revoAbilityLegal(
  state: RotationState,
  ability: AbilitySpec,
  level: number,
  weaponConfiguration: WeaponConfiguration | undefined,
  equipmentIds: readonly string[] | undefined,
  passiveIds: readonly ItemPassiveId[] | undefined,
  byId: ReadonlyMap<string, AbilitySpec>,
  league: ResolvedLeagueRules | undefined,
  activeWeapon: { specialAttackId?: string | null } | undefined,
): boolean {
  return (
    firstLegalTickFor(state, ability, level) <= state.tick &&
    castRejection(
      state,
      ability,
      state.tick,
      weaponConfiguration,
      equipmentIds,
      passiveIds,
      byId,
      league,
      activeWeapon,
    ) === null
  );
}

/**
 * Bar-slot readiness: resolve equipped variants, then morph conjure_* to
 * command_* only when spirit is active and the command is fully legal.
 * Returns the AbilitySpec to cast (command when morphed), not the bar id.
 *
 * Morph rules:
 * 1. Spirit active (conjureActive for that command's spirit)
 * 2. firstLegalTickFor(command) <= tick (CD + initial lockout)
 * 3. castRejection(command) === null (necroCanCast, adren, etc.)
 * 4. Spirit up but no legal command: skip slot (no re-cast conjure, no illegal command)
 * 5. Only return a command when legal so damage is real (or ghost Haunted once)
 */
function revoReadyCastAbility(
  barAbility: AbilitySpec,
  state: RotationState,
  input: RevolutionInput,
  byId: ReadonlyMap<string, AbilitySpec>,
): AbilitySpec | null {
  const { ability: castAbility } = resolveCastAbility(barAbility, {
    byId,
    weaponConfiguration: input.weaponConfiguration,
    equipmentIds: input.equipmentIds,
    passiveIds: input.equipmentEffects?.passiveIds,
    league: input.league,
    activeWeapon: input.equipmentEffects?.activeWeapon,
  });
  const legal = (ability: AbilitySpec) =>
    revoAbilityLegal(
      state,
      ability,
      input.level,
      input.weaponConfiguration,
      input.equipmentIds,
      input.equipmentEffects?.passiveIds,
      byId,
      input.league,
      input.equipmentEffects?.activeWeapon,
    );

  const morphIds = REVO_CONJURE_COMMAND_MORPH[castAbility.id];
  if (morphIds) {
    let spiritUp = false;
    for (const commandId of morphIds) {
      const command = byId.get(commandId);
      if (!command) continue;
      const spiritId = COMMAND_REQUIRES_CONJURE[commandId];
      if (!spiritId || !conjureActive(state.necromancy.conjures, spiritId, state.tick)) {
        continue;
      }
      spiritUp = true;
      // Ghost re-command is a no-op after Haunted is armed; skip 0-effect spam.
      if (commandId === "command_vengeful_ghost") {
        const ghost = findConjure(state.necromancy.conjures, "vengeful_ghost");
        if (ghost?.commanding) continue;
      }
      if (legal(command)) return command;
    }
    // Spirit(s) up but no legal command: fall through to next bar ability.
    if (spiritUp) return null;
    return legal(castAbility) ? castAbility : null;
  }

  return legal(castAbility) ? castAbility : null;
}

function simulateRevolutionLane(
  input: RevolutionInput,
  options: SimulateOptions | undefined,
  laneIndex: number,
  laneCount: number,
): StochasticLane {
  const rt = createRuntime(
    {
      ...input,
      horizonTicks: input.durationTicks,
      detailLevel: options?.detailLevel,
    },
    { laneIndex, laneCount, seed: options?.stochasticSeed },
  );
  const lane: StochasticLane = { weight: 1 / laneCount, rt };
  const offGcd = input.bar.find((ability) => ability.offGcd);
  if (offGcd) {
    lane.error = `${offGcd.name} is off-GCD and cannot be placed on a Revolution bar; trigger it manually`;
    return lane;
  }
  const selectedGroups = new Map<string, string>();
  for (const ability of input.bar) {
    if (!ability.replacementGroup) continue;
    const existing = selectedGroups.get(ability.replacementGroup);
    if (existing && existing !== ability.id) {
      lane.error = `${existing} and ${ability.id} are mutually exclusive variants`;
      return lane;
    }
    selectedGroups.set(ability.replacementGroup, ability.id);
  }

  let guard = 0;
  const maxCasts = Math.max(input.durationTicks * 2, 64);
  while (lane.error === undefined && rt.state.tick < input.durationTicks) {
    if (++guard > maxCasts) {
      lane.error = `revolution stalled at tick ${rt.state.tick}: cast guard exceeded`;
      break;
    }
    let ready: AbilitySpec | undefined;
    if (
      rt.nativeSpecial &&
      revoAbilityLegal(
        rt.state,
        rt.nativeSpecial,
        input.level,
        input.weaponConfiguration,
        input.equipmentIds,
        input.equipmentEffects?.passiveIds,
        rt.byId,
        input.league,
        input.equipmentEffects?.activeWeapon,
      )
    ) {
      ready = rt.nativeSpecial;
    }
    for (const barAbility of input.bar) {
      if (ready) break;
      const cast = revoReadyCastAbility(barAbility, rt.state, input, rt.byId);
      if (cast) {
        ready = cast;
        break;
      }
    }
    const basic = ready ? undefined : rt.basicByStyle.get(input.style);
    const ability = ready ?? basic;
    if (!ability) {
      lane.error = `revolution stalled at tick ${rt.state.tick}: no bar ability ready and no basic for ${input.style}`;
      break;
    }
    const attempt = performCast(rt, ability, rt.state.tick, ready === undefined);
    if (!attempt.ok) lane.error = attempt.error;
  }
  return lane;
}

export function simulateRevolution(
  input: RevolutionInput,
  options?: SimulateOptions,
): RotationSummary {
  const laneCount = stochasticLaneCount(
    input,
    [
      ...input.bar.map((ability) => ability.id),
      ...(input.nativeSpecialPolicy?.useEquippedWeaponSpecial === true &&
      input.equipmentEffects?.activeWeapon?.specialAttackId
        ? [input.equipmentEffects.activeWeapon.specialAttackId]
        : []),
    ],
    options?.stochasticLanes,
  );
  return runWithHitReuseScope(() => {
    const lanes = Array.from({ length: laneCount }, (_, laneIndex) =>
      simulateRevolutionLane(input, options, laneIndex, laneCount),
    );
    return combineStochasticSummaries(lanes, input.durationTicks, options);
  });
}

export const STRICT_PRIORITY_RESOURCE_DIVERGENCE_EXPLANATION =
  "Bar policy spent the additional resource differently; not a passive damage penalty." as const;

/** First tick where Vigour-on vs Vigour-off selected different bar abilities. */
export interface StrictPriorityResourceDivergence {
  kind: "strict-priority-resource-divergence";
  tick: number;
  abilityOff: string;
  abilityOn: string;
  adrenBeforeOff: number;
  adrenBeforeOn: number;
  explanation: typeof STRICT_PRIORITY_RESOURCE_DIVERGENCE_EXPLANATION;
}

function castStartingAt(casts: readonly CastRecord[], tick: number): CastRecord | undefined {
  return casts.find((c) => c.tick === tick);
}

function adrenBeforeAtTick(casts: readonly CastRecord[], tick: number): number {
  const at = castStartingAt(casts, tick);
  if (at) return at.adrenalineBefore;
  let prev: CastRecord | undefined;
  for (const c of casts) {
    if (c.tick < tick && (prev === undefined || c.tick > prev.tick)) prev = c;
  }
  return prev?.adrenalineAfter ?? 0;
}

/** First tick with differing selected ability; null when sequences match. */
export function diagnoseStrictPriorityResourceDivergence(
  off: Pick<RotationSummary, "casts">,
  on: Pick<RotationSummary, "casts">,
): StrictPriorityResourceDivergence | null {
  const ticks = new Set<number>();
  for (const c of off.casts) ticks.add(c.tick);
  for (const c of on.casts) ticks.add(c.tick);
  const ordered = [...ticks].sort((a, b) => a - b);
  for (const tick of ordered) {
    const castOff = castStartingAt(off.casts, tick);
    const castOn = castStartingAt(on.casts, tick);
    const abilityOff = castOff?.abilityId ?? "(none)";
    const abilityOn = castOn?.abilityId ?? "(none)";
    if (abilityOff === abilityOn) continue;
    return {
      kind: "strict-priority-resource-divergence",
      tick,
      abilityOff,
      abilityOn,
      adrenBeforeOff: adrenBeforeAtTick(off.casts, tick),
      adrenBeforeOn: adrenBeforeAtTick(on.casts, tick),
      explanation: STRICT_PRIORITY_RESOURCE_DIVERGENCE_EXPLANATION,
    };
  }
  return null;
}

/** Same bar with ringOfVigour forced off vs on; first selection divergence. */
export function compareRevolutionWithVigour(
  input: RevolutionInput,
  options?: SimulateOptions,
): {
  off: RotationSummary;
  on: RotationSummary;
  divergence: StrictPriorityResourceDivergence | null;
} {
  const adren = input.adrenaline;
  const off = simulateRevolution(
    {
      ...input,
      adrenaline: adren ? { ...adren, ringOfVigour: false } : { ringOfVigour: false },
    },
    options,
  );
  const on = simulateRevolution(
    {
      ...input,
      adrenaline: adren ? { ...adren, ringOfVigour: true } : { ringOfVigour: true },
    },
    options,
  );
  return {
    off,
    on,
    divergence: diagnoseStrictPriorityResourceDivergence(off, on),
  };
}

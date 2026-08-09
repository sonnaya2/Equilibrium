import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { tsunamiCritAdrenActive, tsunamiCritAdrenGrant } from "../../styles/magic/effects";
import { applyLengLandToDistribution } from "../../styles/melee/primordialIce";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { gainAdrenaline, patchMelee } from "../runtime/state";
import type { ResolvedDamage } from "../resolution/types";
import { capabilitiesOf } from "../../shared/damageProvenance";

function isLengEligible(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec | undefined,
  damage: ResolvedDamage,
): boolean {
  if (!ability || damage.max <= 0) return false;
  if (!event.procEligible || event.attached) return false;
  if (ability.style !== "melee") return false;
  if (event.family === "dot" || event.dotKind) return false;
  return rt.lengLandTable != null;
}

function tsunamiCritChance(damage: ResolvedDamage): number {
  const chance = damage.critical?.chance;
  return typeof chance === "number" && Number.isFinite(chance)
    ? Math.min(1, Math.max(0, chance))
    : 0;
}

function isTsunamiEligible(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec | undefined,
  damage: ResolvedDamage,
): boolean {
  if (!ability || ability.style !== "magic") return false;
  if (event.attached || !(event.procEligible || event.convertedChannel)) return false;
  // Tsunami counts non-necromancy player critical strikes; blessing-origin hits do not grant adren.
  if (capabilitiesOf(event.provenance).canGenerateResources !== true) return false;
  if (damage.max <= 0 && damage.expected <= 0) return false;
  return tsunamiCritAdrenActive(rt.state.magic, event.tick);
}

export function applyStatefulLandRng(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  const ability = rt.byId.get(event.abilityId);
  if (isLengEligible(rt, event, ability, damage)) {
    rt.state = patchMelee(rt.state, {
      primordialIce: applyLengLandToDistribution(
        rt.state.melee.primordialIce,
        rt.lengLandTable!,
        event.tick,
      ),
    });
  }

  if (!isTsunamiEligible(rt, event, ability, damage)) return;
  if (rt.state.adrenaline >= rt.state.adrenalineCap) return;
  const grant = tsunamiCritAdrenGrant(rt.state.naturalInstinctUntilTick, event.tick);
  if (grant <= 0) return;
  const actualCrit = damage.critical?.outcome;
  const critical =
    actualCrit !== undefined
      ? actualCrit
      : rt.stochastic.bernoulli("land:tsunami-crit-adrenaline", tsunamiCritChance(damage));
  if (critical) {
    rt.state = gainAdrenaline(rt.state, grant);
  }
}

import { applyCombust } from "../../../styles/magic/burn";
import {
  activateInstability,
  activateSunshine,
  armBlastInfused,
  CONC_BLAST_CRIT_PER_HIT_PCT,
  CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT,
  GREATER_CONC_BLAST_CRIT_PER_HIT_PCT,
  GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT,
  isConcentratedBlast,
} from "../../../styles/magic/effects";
import { animaCharged, consumeAnima } from "../../../styles/magic/runicCharge";
import { hasPassive } from "../../../shared/equipment";
import { patchMagic, patchTarget } from "../../runtime/state";
import type { CastEffectContext } from "./context";
import { armConflagrate } from "../../../styles/magic/songOfDestruction";
import {
  armKerapacWristWraps,
  KERAPAC_WRIST_WRAPS_PASSIVE_ID,
} from "../../../styles/magic/kerapacWristWraps";
import { burnActive } from "../../../styles/magic/burn";
import type { SimulationRuntime } from "../../runtime/runtime";

function clearCombust(state: import("../../../styles/magic/burn").BurnState) {
  const active = { ...state.active };
  delete active.combust;
  return { active };
}

function detonateRemainingCombust(rt: SimulationRuntime, castTick: number): number {
  if (!burnActive(rt.state.target.burns, "combust", castTick)) return 0;
  const pending = rt.queue
    .pending()
    .filter((event) => event.abilityId === "combust" && event.family === "dot");
  const detonationTick = pending[0]?.tick;
  if (detonationTick === undefined) return 0;
  const seqs = new Set(pending.map((event) => event.seq));
  rt.queue.cancelWhere((event) => seqs.has(event.seq));
  for (const event of pending) {
    rt.queue.push({
      ...event,
      tick: detonationTick,
      castSnap: event.castSnap
        ? { ...event.castSnap, kerapacCombustActive: true }
        : event.castSnap,
    });
  }
  rt.state = patchTarget(rt.state, {
    burns: {
      active: { ...rt.state.target.burns.active, combust: detonationTick + 1 },
    },
  });
  return detonationTick;
}

/** Per-stack crit grant a Concentrated Blast cast sets for its channel. */
function concCritPerStackPct(abilityId: string, empowered: boolean): number {
  if (abilityId === "concentrated_blast") {
    return empowered ? CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT : CONC_BLAST_CRIT_PER_HIT_PCT;
  }
  return empowered
    ? GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT
    : GREATER_CONC_BLAST_CRIT_PER_HIT_PCT;
}

/**
 * Immediate magic cast-state changes: the Sunshine and Instability windows,
 * Runic Charge consumption by the casts that empower off it, the Concentrated
 * Blast stack ledger, Combust's burn on the target, and Flow's consumption.

 * Flow is earned from event-carried data when Sonic Wave lands.
 */
export function applyMagicCastEffects(fx: CastEffectContext): void {
  const { rt, ability, candidate, prepared } = fx;
  const spendCharge = () => {
    rt.state = patchMagic(rt.state, { runicCharge: consumeAnima(rt.state.magic.runicCharge) });
  };

  if (ability.appliesEffect === "sunshine" || ability.appliesEffect === "greater_sunshine") {
    const greater = ability.appliesEffect === "greater_sunshine";
    rt.state = patchMagic(rt.state, {
      sunshine: activateSunshine(
        candidate,
        greater,
        !greater && rt.input.plantedFeet === true,
        fx.prepared.snap.castSeq,
      ),
    });
  }
  if (ability.appliesEffect === "instability") {
    rt.state = patchMagic(rt.state, {
      instability: activateInstability(candidate),
    });
  }

  // Blast Infused: Wild Magic + boots passive arms 10-tick basic damage window.
  if (
    ability.id === "wild_magic" &&
    hasPassive(rt.input.equipmentEffects, "blast-diffusion-inner-wrath")
  ) {
    rt.state = patchMagic(rt.state, { blastInfusedUntilTick: armBlastInfused(candidate) });
  }

  if (ability.id === "sonic_wave" || ability.id === "greater_sonic_wave") {
    const empowered = animaCharged(rt.state.magic.runicCharge, candidate);
    if (empowered) spendCharge();
  }
  // Runic-charged Dragon Breath spends the charge; its empowered band was
  // resolved during preparation.
  if (ability.id === "dragon_breath" && animaCharged(rt.state.magic.runicCharge, candidate)) {
    spendCharge();
  }
  if (
    ability.id === "dragon_breath" &&
    hasPassive(rt.input.equipmentEffects, KERAPAC_WRIST_WRAPS_PASSIVE_ID)
  ) {
    const detonationTick = detonateRemainingCombust(rt, candidate);
    rt.state = patchMagic(rt.state, {
      kerapacWristWrapsUntilTick: armKerapacWristWraps(candidate),
      kerapacCombustDetonationTick: detonationTick,
    });
  }
  if (isConcentratedBlast(ability.id)) {
    const empowered = animaCharged(rt.state.magic.runicCharge, candidate);
    rt.state = patchMagic(rt.state, {
      concCritPerStackPct: concCritPerStackPct(ability.id, empowered),
    });
    if (empowered) spendCharge();
  } else if (rt.state.magic.concCritStacks > 0) {
    // This non-CB magic attack is the one that consumed the accumulated stacks.
    rt.state = patchMagic(rt.state, { concCritStacks: 0 });
  }
  if (ability.id === "combust") {
    rt.state = patchTarget(rt.state, {
      burns: prepared.snap.songEmpowered || prepared.snap.kerapacCombustActive
        ? clearCombust(rt.state.target.burns)
        : applyCombust(rt.state.target.burns, candidate),
    });
  }
  if (ability.id === "soulfire" && rt.input.equipmentEffects?.songOfDestruction?.enabled === true) {
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        conflagrateUntilTick: armConflagrate(candidate),
      },
    });
  }
  // Flow is consumed by a listed positive-cost Magic spender even when Flow
  // reduced the actual cost to zero. Listed zero-cost abilities do not use it.
  if (
    ability.style === "magic" &&
    (ability.adrenaline?.cost ?? 0) > 0 &&
    candidate < rt.state.magic.flowUntilTick
  ) {
    rt.state = patchMagic(rt.state, { flowUntilTick: 0, flowReduction: 0 });
  }

  // Recast cancels prior Corruption Blast pending events (parent + tails) by owner.
  // Does not cancel Shot. Cast effects run after schedule; skip this cast's owner.
  if (ability.id === "corruption_blast") {
    const newOwner = prepared.snap.castSeq;
    const owners = new Set<number>();
    for (const e of rt.queue.pending()) {
      if (
        e.abilityId === "corruption_blast" &&
        e.cancelOwner != null &&
        e.cancelOwner !== newOwner
      ) {
        owners.add(e.cancelOwner);
      }
    }
    for (const owner of owners) rt.queue.cancelByOwner(owner);
  }
}

/**
 * Wiki reference bar selection and revo-managed ability lists.
 */
import { combatRevolutionBars, type RevolutionBarRecord } from "@/combat/data";
import * as combatSpecs from "@/combat/data/specs";
import { resolveBar, type ResolvedSlot } from "@/combat/data/specs";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import type { ItemPassiveId } from "@/combat/data/records";
import type { CalcStats } from "./loadoutStats";
import type { Loadout } from "./useLoadout";
import { equipAbilityForLoadout } from "./abilityLoadoutFilter";

export type RevoBarView = RevolutionBarRecord;

const STYLE_LABEL: Record<string, string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

/** Single-target only; multi-target bars are not shipped. */
export const SUPPORTED_BARS = combatRevolutionBars.records.filter(
  (bar) => bar.supported && (bar.target == null || bar.target === "single"),
) as RevoBarView[];

export function styleLabel(style: string): string {
  return STYLE_LABEL[style] ?? style.charAt(0).toUpperCase() + style.slice(1);
}

/** Select option label (not bare style ids). */
export function barOptionLabel(bar: RevoBarView): string {
  if (bar.name) return bar.name;

  const style = styleLabel(bar.style);
  if (bar.setup && bar.setup !== "Any") return `${style} · ${bar.setup}`;
  if (bar.mode === "basics") return `${style} · Basics`;
  if (bar.mode === "hybrid") return `${style} · Hybrid`;
  return style;
}

/**
 * Reference bar from Setup style + weapon shape (no manual picker).
 * Melee: twohand → 2h ST bar; dual-wield / defender → dual ST bar.
 * Other styles: revo++ "Any" when present.
 */
export function pickBarForLoadout(
  style: string,
  weaponConfiguration?: CalcStats["weaponConfiguration"] | Loadout["weaponConfiguration"],
): RevoBarView | undefined {
  const forStyle = SUPPORTED_BARS.filter((b) => b.style === style);
  if (forStyle.length === 0) return undefined;
  const revoPlus = forStyle.filter((b) => b.mode === "revo++");
  const pool = revoPlus.length > 0 ? revoPlus : forStyle;

  if (style === "melee") {
    const twoHand =
      weaponConfiguration === "twohand"
        ? pool.find(
            (b) =>
              /two.?hand/i.test(b.setup) ||
              /two.?hand|2h/i.test(b.id) ||
              /2h|two.?hand/i.test(b.name ?? ""),
          )
        : undefined;
    if (twoHand) return twoHand;

    const dual =
      weaponConfiguration === "dualwield" ||
      weaponConfiguration === "defender" ||
      weaponConfiguration === "mainhand" ||
      weaponConfiguration === "shield" ||
      weaponConfiguration === undefined
        ? pool.find(
            (b) => /dual/i.test(b.setup) || /dual/i.test(b.id) || /dual/i.test(b.name ?? ""),
          )
        : undefined;
    if (dual && weaponConfiguration !== "twohand") return dual;
  }

  return pool.find((b) => b.setup === "Any") ?? pool.find((b) => b.mode === "revo++") ?? pool[0];
}

type WeaponShape = CalcStats["weaponConfiguration"] | Loadout["weaponConfiguration"] | undefined;

/**
 * Revo-managed ability specs for the sim only (not manual keybind tail).
 * Prefer loadout/sim weaponConfiguration for Adaptive Strike form selection.
 * When passives are provided, base Overpower/Deadshot/Omnipower/Death Skulls
 * become the equipped Igneous upgrade (label + sim id).
 */
export function revoManagedModelled(
  bar: RevoBarView,
  weaponConfiguration?: WeaponShape,
  gate?: {
    passiveIds?: readonly ItemPassiveId[];
    equipmentIds?: readonly string[];
  },
): AbilitySpec[] {
  const helper = (
    combatSpecs as {
      revoManagedSlots?: (
        bar: RevolutionBarRecord,
        engine: ReadonlyMap<string, AbilitySpec>,
        weaponConfiguration?: WeaponShape,
      ) => AbilitySpec[] | ResolvedSlot[];
    }
  ).revoManagedSlots;

  let specs: AbilitySpec[];
  if (typeof helper === "function") {
    const out = helper(bar, ENGINE_SPECS, weaponConfiguration);
    if (out.length === 0) return [];
    const first = out[0] as AbilitySpec | ResolvedSlot;
    if (first && typeof first === "object" && "spec" in first) {
      specs = (out as ResolvedSlot[]).filter((s) => s.spec !== null).map((s) => s.spec!);
    } else {
      specs = out as AbilitySpec[];
    }
  } else {
    specs = resolveBar(bar, ENGINE_SPECS, weaponConfiguration)
      .slice(0, bar.revolutionSize)
      .filter((slot) => slot.spec !== null)
      .map((slot) => slot.spec!);
  }
  if (!gate?.passiveIds?.length && !gate?.equipmentIds?.length) return specs;
  return specs.map((s) => equipAbilityForLoadout(s, ENGINE_SPECS, gate));
}

/** Apply Igneous (etc.) upgrade to resolved bar slots for display + sim. */
export function applyLoadoutVariantsToSlots(
  slots: readonly ResolvedSlot[],
  gate?: {
    passiveIds?: readonly ItemPassiveId[];
    equipmentIds?: readonly string[];
  },
): ResolvedSlot[] {
  if (!gate?.passiveIds?.length && !gate?.equipmentIds?.length) return [...slots];
  return slots.map((slot) => {
    if (!slot.spec) return slot;
    const upgraded = equipAbilityForLoadout(slot.spec, ENGINE_SPECS, gate);
    if (upgraded.id === slot.spec.id) return slot;
    return {
      name: upgraded.name,
      modelledBy: slot.modelledBy,
      spec: upgraded,
    };
  });
}

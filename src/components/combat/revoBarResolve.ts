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
  if (gate == null) return specs;
  return specs.map((s) => equipAbilityForLoadout(s, ENGINE_SPECS, gate));
}

export function defaultRevoBarIds(
  style: string,
  weaponConfiguration?: WeaponShape,
  gate?: {
    passiveIds?: readonly ItemPassiveId[];
    equipmentIds?: readonly string[];
  },
): string[] {
  const bar = pickBarForLoadout(style, weaponConfiguration) ?? pickBarForLoadout(style);
  if (!bar) return [];
  return ensureNecroConjuresOnBarIds(
    revoManagedModelled(bar, weaponConfiguration, gate).map((ability) => ability.id),
    style,
    weaponConfiguration,
  );
}

/** Apply Igneous (etc.) upgrade or reverse-to-base on resolved bar slots. */
export function applyLoadoutVariantsToSlots(
  slots: readonly ResolvedSlot[],
  gate?: {
    passiveIds?: readonly ItemPassiveId[];
    equipmentIds?: readonly string[];
  },
): ResolvedSlot[] {
  if (gate == null) return [...slots];
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

/** Early-bar conjure engine ids from the wiki necro reference (revo-managed order). */
export function wikiNecroConjureIds(weaponConfiguration?: WeaponShape): string[] {
  const bar =
    pickBarForLoadout("necromancy", weaponConfiguration) ?? pickBarForLoadout("necromancy");
  if (!bar) return [];
  return revoManagedModelled(bar, weaponConfiguration)
    .map((s) => s.id)
    .filter((id) => id.startsWith("conjure_"));
}

/**
 * When necro bar ids have zero conjure_*, prepend wiki early-bar conjures.
 * Solver bars can drop summons; Run/seeds must not silently omit them.
 */
export function ensureNecroConjuresOnBarIds(
  barIds: readonly string[],
  style: string,
  weaponConfiguration?: WeaponShape,
): string[] {
  if (style !== "necromancy") return [...barIds];
  if (barIds.some((id) => id.startsWith("conjure_"))) return [...barIds];
  const conjures = wikiNecroConjureIds(weaponConfiguration);
  if (conjures.length === 0) return [...barIds];
  const existing = new Set(barIds);
  const inject = conjures.filter((id) => !existing.has(id));
  return inject.length === 0 ? [...barIds] : [...inject, ...barIds];
}

/**
 * Same as ensureNecroConjuresOnBarIds for modelled AbilitySpec lists (UI Run bar).
 */
export function ensureNecroConjuresOnSpecs(
  specs: readonly AbilitySpec[],
  style: string,
  weaponConfiguration?: WeaponShape,
  gate?: {
    passiveIds?: readonly ItemPassiveId[];
    equipmentIds?: readonly string[];
  },
): AbilitySpec[] {
  if (style !== "necromancy") return [...specs];
  if (specs.some((s) => s.id.startsWith("conjure_"))) return [...specs];
  const bar =
    pickBarForLoadout("necromancy", weaponConfiguration) ?? pickBarForLoadout("necromancy");
  if (!bar) return [...specs];
  const wikiConjures = revoManagedModelled(bar, weaponConfiguration, gate).filter((s) =>
    s.id.startsWith("conjure_"),
  );
  if (wikiConjures.length === 0) return [...specs];
  const existing = new Set(specs.map((s) => s.id));
  const inject = wikiConjures.filter((s) => !existing.has(s.id));
  return inject.length === 0 ? [...specs] : [...inject, ...specs];
}

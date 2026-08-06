import type { ItemPassiveId } from "../data/records";
import type { PassivePresentation, PassivePresentationContext, PassiveSupport } from "./contracts";
import { definitionById } from "./registry";

function toGearSupport(
  support: "modeled" | "partially-modeled" | "not-modeled" | "mechanics-unverified",
): PassiveSupport {
  if (support === "mechanics-unverified") return "not-modeled";
  return support;
}

/**
 * Gear passive row presentation. Enchantment-dependent labels for
 * enduring-ruin / champion / stalker / channeller match prior equipment.ts strings.
 */
export function presentPassive(
  id: ItemPassiveId,
  ctx: PassivePresentationContext,
): PassivePresentation {
  const def = definitionById(id);
  if (!def) {
    return { label: id, effects: [], support: "not-modeled" };
  }
  const support = toGearSupport(def.support);

  switch (id) {
    case "enduring-ruin":
      return {
        label: ctx.passageAgonyActive ? "Enduring Ruin + Agony" : "Enduring Ruin",
        effects: ctx.passageAgonyActive
          ? [
              "Rend grants +16% damage to the next attack for 6 seconds.",
              "Bleeds take +25% damage for 10 seconds.",
            ]
          : def.effects,
        support,
      };
    case "champion-ring":
      return {
        label: ctx.hasHeroism ? "Champion's ring + Heroism" : "Champion's ring",
        effects: ctx.hasHeroism
          ? [
              "+4% critical strike chance while a bleed is active.",
              "+1.5% critical strike damage per active bleed.",
            ]
          : def.effects,
        support,
      };
    case "stalker-ring":
      return {
        label: ctx.hasShadows ? "Stalker's ring + Shadows" : "Stalker's ring",
        effects: ctx.hasShadows
          ? ["With a bow: +4% critical strike chance.", "+3% critical strike damage."]
          : def.effects,
        support,
      };
    case "channeller-ring":
      return {
        label: ctx.hasMetaphysics ? "Channeller's ring + Metaphysics" : "Channeller's ring",
        effects: ctx.hasMetaphysics
          ? [
              "+4% critical strike chance per successive channel hit.",
              "+2.5% critical strike damage per successive channel hit.",
            ]
          : def.effects,
        support,
      };
    default:
      return { label: def.label, effects: def.effects, support };
  }
}

export function igneousCombinedPresentation(): PassivePresentation {
  return {
    label: "Igneous ultimate upgrades",
    effects: ["Unlocks upgraded Overpower, Deadshot, Omnipower, and Death Skulls."],
    support: "modeled",
  };
}

export function lengCombinedPresentation(): PassivePresentation {
  return {
    label: "Leng weapons",
    effects: [
      "Endless Frost / Boundless Chill: Primordial Ice stacks on hit (cap 10).",
      "Frostblades: +24% ability damage flat on melee ability hits for 9s after Chill procs.",
      "Icy Tempest spends stacks for reduced adrenaline cost and bonus damage.",
    ],
    support: "modeled",
  };
}

/** Build presentation context from ActiveEquipmentEffects-shaped input. */
export function presentationContextFromEffects(effects: {
  passage: { agonyActive: boolean };
  enchantments: readonly string[];
}): PassivePresentationContext {
  return {
    passageAgonyActive: effects.passage.agonyActive,
    hasHeroism: effects.enchantments.includes("heroism"),
    hasShadows: effects.enchantments.includes("shadows"),
    hasMetaphysics: effects.enchantments.includes("metaphysics"),
  };
}

import type { RangedAmmunitionMechanicId } from "../../data/ammunition";

const ARROW_EFFECT_LABELS: Readonly<Partial<Record<RangedAmmunitionMechanicId, string>>> = {
  "black-stone": "Black stone arrows · Armour reduction",
  deathspore: "Deathspore arrows · Feasting Spores",
  splintering: "Splintering arrows · Puncture",
  bik: "Bik arrows · Evolving Toxin",
  wen: "Wen arrows · Icy Chill",
  ful: "Ful arrows · Anima of Ful",
  "jas-dragonbane": "Jas dragonbane arrows",
  "jas-demonbane": "Jas demonbane arrows",
  dragonbane: "Dragonbane arrows",
  demonbane: "Demonbane arrows",
  opal: "Opal bolts · Lucky Lightning",
  pearl: "Pearl bolts · Sea Curse",
  hydrix: "Hydrix bolts · Deathmark",
  ascendri: "Ascendri bolts · Deathmark",
};

const EFFECT_LABELS: Readonly<Record<string, string>> = {
  perfect_equilibrium: "Perfect Equilibrium",
  puncture: "Splintering arrows · Puncture damage",
  "ammunition:wen-icy-precision": "Wen arrows · Icy Precision",
};

export function ammunitionAppliedEffectId(
  mechanicId: RangedAmmunitionMechanicId | null | undefined,
): string | null {
  return mechanicId && ARROW_EFFECT_LABELS[mechanicId] ? `ammunition:${mechanicId}` : null;
}

export function rangedEffectDisplayName(id: string): string | null {
  if (EFFECT_LABELS[id]) return EFFECT_LABELS[id];
  if (!id.startsWith("ammunition:")) return null;
  const mechanicId = id.slice("ammunition:".length) as RangedAmmunitionMechanicId;
  return ARROW_EFFECT_LABELS[mechanicId] ?? null;
}

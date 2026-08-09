export const AMMUNITION_FAMILIES = ["arrows", "bolts"] as const;
export type AmmunitionFamily = (typeof AMMUNITION_FAMILIES)[number];

export type RangedAmmunitionMechanicId =
  | "none"
  | "ordinary"
  | "bane"
  | "jas-dragonbane"
  | "jas-demonbane"
  | "dragonbane"
  | "demonbane"
  | "black-stone"
  | "deathspore"
  | "splintering"
  | "bik"
  | "wen"
  | "ful"
  | "opal"
  | "pearl"
  | "jade"
  | "topaz"
  | "sapphire"
  | "emerald"
  | "ruby"
  | "diamond"
  | "dragonstone"
  | "onyx"
  | "hydrix"
  | "ascendri";

export type RangedAmmunitionMode = "required" | "optional" | "none";

export type AmmunitionSupportStatus = "modeled" | "partially-modeled" | "unsupported";

export interface AmmunitionSupport {
  readonly status: AmmunitionSupportStatus;
  readonly label: string;
  readonly note?: string;
}

export type RangedWeaponAmmunitionCapability =
  | {
      readonly mode: "required" | "optional";
      readonly acceptedFamily: AmmunitionFamily;
    }
  | {
      readonly mode: "none";
      readonly acceptedFamily: null;
    };

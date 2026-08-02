export type SourceKind = "runescape-wiki" | "jagex" | "rs-analysis" | "pvme" | "derived";

export interface SourceReference {
  source: SourceKind;
  url: string;
  title?: string;
  revision?: string;
  publishedAt?: string;
  verifiedAt: string;
  derivedFrom?: SourceReference[];
}

export type CombatStyle = "melee" | "ranged" | "magic" | "necromancy";

export type DamageOverTimeKind = "bleed" | "burn" | "poison" | "other";

export type BleedId = "dismember" | "slaughter" | "massacre" | "abyssal-parasite";

export type ModifierStage =
  "base" | "ability" | "onCast" | "roll" | "critical" | "onHit" | "target" | "postHit";

export interface CombatContext {
  style: CombatStyle;
  ruleset?: "base" | "equilibrium";
  dotKind?: DamageOverTimeKind;
  abilityCategory?: "basic" | "enhanced" | "ultimate" | "utility";
  autoAttack?: boolean;
  area?: "aoe" | "multi-target";
  targetTiles?: number;
  blessingGenerated?: boolean;
}

export interface DamageState {
  damage: number;
}

export interface CombatModifier {
  id: string;
  stage: ModifierStage;
  priority: number;
  applies(context: CombatContext): boolean;
  apply(state: DamageState, context: CombatContext): DamageState;
  source: SourceReference;
}

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

export type ModifierStage =
  | "base"
  | "ability"
  | "onCast"
  | "roll"
  | "critical"
  | "onHit"
  | "target"
  | "postHit";

/** Shapes below are the contract from AGENTS.md; fields fill in as the engine lands. */
export interface CombatContext {
  style: CombatStyle;
  ruleset?: "base" | "equilibrium";
}

export interface DamageState {
  damage: number;
}

export interface CombatModifier {
  id: string;
  stage: ModifierStage;
  priority: number;
  applies(context: CombatContext): boolean;
  apply(state: DamageState): DamageState;
  source: SourceReference;
}

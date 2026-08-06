import type { ItemPassiveId } from "../data/records";
import type { SourceReference } from "../types";

/** Lifecycle hooks current mechanics care about for ownership mapping. */
export type PassiveLifecycle =
  | "loadout-static"
  | "ability-availability"
  | "ability-resolution"
  | "cast-preparation"
  | "resource-transaction"
  | "modifier-provider"
  | "crit-provider"
  | "cast-start"
  | "landed-hit"
  | "timed-runtime"
  | "presentation-only";

/** Full modeling status on registry definitions. */
export type PassiveModelingSupport =
  "modeled" | "partially-modeled" | "not-modeled" | "mechanics-unverified";

/** Gear / UI support badge (subset of modeling status). */
export type PassiveSupport = "modeled" | "partially-modeled" | "not-modeled";

export type PassiveDuplicatePolicy = "collapse" | "stack" | "mutually-exclusive";

/**
 * Ownership/support record for one ItemPassiveId.
 * Not a callback container - mechanics stay in implementationOwners.
 */
export interface PassiveDefinition {
  id: ItemPassiveId;
  label: string;
  support: PassiveModelingSupport;
  duplicatePolicy: PassiveDuplicatePolicy;
  lifecycle: readonly PassiveLifecycle[];
  /** Paths relative to src/combat/. */
  implementationOwners: readonly string[];
  /** Default Gear lines (non-enchantment baseline). */
  effects: readonly string[];
  source: SourceReference;
}

/** Enchantment / passage flags needed for Gear label overlays. */
export interface PassivePresentationContext {
  passageAgonyActive: boolean;
  hasHeroism: boolean;
  hasShadows: boolean;
  hasMetaphysics: boolean;
}

export interface PassivePresentation {
  label: string;
  effects: readonly string[];
  support: PassiveSupport;
}

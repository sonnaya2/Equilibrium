import type { CombatContext, OutgoingDamageSource } from "../types";

/**
 * Capability-derived damage provenance. Prefer kind + capabilities over ability-id lists.
 * Serializable plain object for branch signatures / IPC.
 *
 * wiki: Full Slayer Helmet / Salve apply to player direct attacks only (not DoT, conjure, procs).
 * Blessings: riders on direct+DoT+command; on-hit rolls on direct only; no recursion on blessing dmg.
 */

export type DamageProvenanceKind =
  | "player_direct"
  | "player_auto"
  | "player_dot"
  | "conjure_auto"
  | "conjure_poison"
  | "conjure_command"
  | "equipment_proc"
  | "invention_proc"
  | "attached"
  | "blessing"
  | "derived_bounce"
  | "derived_tail"
  | "reflected";

export interface DamageProvenance {
  kind: DamageProvenanceKind;
  /** Optional stable subtype (bleedId, procId, blessingId, spiritId, componentId). */
  detail?: string;
}

export interface DamageCapabilities {
  playerAttack: boolean;
  directHit: boolean;
  /** Slayer helmet / Salve. */
  onHitGear: boolean;
  /** Cinders / Big Boned riders. */
  blessingRider: boolean;
  /** Inferno / Light of Saradomin. */
  blessingOnHit: boolean;
  /** Default crit eligibility; hitSpec may still force false. */
  canCrit: boolean;
  canGenerateResources: boolean;
  /** ~procEligible for invention + gear land. */
  canTriggerProcs: boolean;
  recursiveDamage: boolean;
  prayerMods: boolean;
}

const CAPS: Record<DamageProvenanceKind, DamageCapabilities> = {
  player_direct: {
    playerAttack: true,
    directHit: true,
    onHitGear: true,
    blessingRider: true,
    blessingOnHit: true,
    canCrit: true,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: true,
    prayerMods: true,
  },
  player_auto: {
    playerAttack: true,
    directHit: true,
    onHitGear: true,
    blessingRider: true,
    blessingOnHit: true,
    canCrit: true,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: true,
    prayerMods: true,
  },
  player_dot: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    // Crackling charges from DoT family; style land stacks stay procEligible=false on events.
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
  },
  conjure_auto: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
  },
  conjure_poison: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
  },
  conjure_command: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    blessingOnHit: false,
    canCrit: true,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
  },
  equipment_proc: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    blessingOnHit: false,
    canCrit: true,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: true,
  },
  invention_proc: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
  },
  // Parent mods already in list; canTriggerProcs false so attached never inflate proc rolls.
  attached: {
    playerAttack: true,
    directHit: false,
    onHitGear: true,
    blessingRider: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: true,
  },
  blessing: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    blessingOnHit: false,
    canCrit: true,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
  },
  // Death Skulls bounce: separate hit counter / blessings; damage not re-modified.
  derived_bounce: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    blessingOnHit: true,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
  },
  // Bloat-style DoT tail: rider only; no on-hit re-roll.
  derived_tail: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
  },
  reflected: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
  },
};

export function capabilitiesOf(p: DamageProvenance): DamageCapabilities {
  return CAPS[p.kind];
}

export function assertProvenance(p: DamageProvenance | null | undefined): DamageProvenance {
  if (p == null || p.kind == null) {
    throw new Error("assertProvenance: missing DamageProvenance");
  }
  if (!(p.kind in CAPS)) {
    throw new Error(`assertProvenance: unknown kind ${String((p as DamageProvenance).kind)}`);
  }
  return p;
}

/** Legacy OutgoingDamageSource projection for signatures / blessing APIs. */
export function outgoingSourceOf(p: DamageProvenance): OutgoingDamageSource {
  switch (p.kind) {
    case "player_dot":
    case "derived_tail":
      return "dot";
    case "conjure_auto":
    case "conjure_poison":
      return "conjure";
    case "conjure_command":
      return "command";
    case "equipment_proc":
    case "invention_proc":
    case "reflected":
      return "proc";
    case "blessing":
      return "blessing";
    case "attached":
    case "player_direct":
    case "player_auto":
    case "derived_bounce":
    default:
      return "direct";
  }
}

export type LegacyDamageHints = {
  damageSource?: OutgoingDamageSource;
  dotKind?: CombatContext["dotKind"];
  autoAttack?: boolean;
  blessingGenerated?: boolean;
  /** When true, omit/ambiguous context throws instead of defaulting to player_direct. */
  strict?: boolean;
};

/**
 * Migration helper: map legacy damageSource / flags to provenance.
 * Bare `{ style }` (no source flags) -> player_direct for unit-test compat unless strict.
 */
export function provenanceFromLegacy(hints: LegacyDamageHints): DamageProvenance {
  if (hints.blessingGenerated === true || hints.damageSource === "blessing") {
    return { kind: "blessing" };
  }
  if (hints.damageSource === "proc") {
    return { kind: "equipment_proc" };
  }
  if (hints.damageSource === "command") {
    return { kind: "conjure_command" };
  }
  if (hints.damageSource === "conjure") {
    return hints.dotKind === "poison"
      ? { kind: "conjure_poison" }
      : { kind: "conjure_auto" };
  }
  if (hints.damageSource === "dot" || hints.dotKind != null) {
    return { kind: "player_dot", detail: hints.dotKind };
  }
  if (hints.damageSource === "direct") {
    return hints.autoAttack === true ? { kind: "player_auto" } : { kind: "player_direct" };
  }
  if (hints.autoAttack === true) {
    return { kind: "player_auto" };
  }
  if (hints.strict) {
    throw new Error(
      "provenanceFromLegacy: ambiguous context (no damageSource/dotKind/autoAttack/blessingGenerated)",
    );
  }
  // Test / bare-context default: player ability hit.
  return { kind: "player_direct" };
}

/**
 * Resolve provenance from CombatContext.
 * Explicit `context.provenance` wins; else legacy flags; bare style-only = player_direct.
 * With `strict: true`, ambiguous context throws (hit-path hardening).
 */
export function resolveCombatProvenance(
  context: CombatContext | undefined | null,
  opts?: { strict?: boolean },
): DamageProvenance {
  if (context?.provenance != null) {
    return assertProvenance(context.provenance);
  }
  return provenanceFromLegacy({
    damageSource: context?.damageSource,
    dotKind: context?.dotKind,
    autoAttack: context?.autoAttack,
    blessingGenerated: context?.blessingGenerated,
    strict: opts?.strict,
  });
}

/** Context with provenance + projected damageSource for pipeline applies. */
export function contextWithProvenance(
  context: CombatContext | undefined,
  provenance?: DamageProvenance,
  opts?: { strict?: boolean },
): CombatContext {
  const base = context ?? { style: "melee" as const };
  const p = provenance ?? resolveCombatProvenance(base, opts);
  return {
    ...base,
    provenance: p,
    damageSource: base.damageSource ?? outgoingSourceOf(p),
  };
}

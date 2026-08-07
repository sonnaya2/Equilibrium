import type { BleedId, CombatContext, DamageOverTimeKind, OutgoingDamageSource } from "../types";

/**
 * Capability-derived damage provenance. Prefer kind + capabilities over ability-id lists.
 * Serializable plain object for branch signatures / IPC.
 *
 * wiki: Full Slayer Helmet / Salve apply to player direct attacks only (not DoT, conjure, procs).
 * Big Boned follows blessingRider; Cinders follows direct player attacks and direct bounces.
 * Poison, DoT, conjure, proc, reflected, and blessing damage never re-open Cinders.
 * Abyssal Parasite stacks: only player_direct / player_auto (melee+passive gated at land).
 */

export type DamageProvenanceKind =
  | "player_direct"
  | "player_auto"
  | "player_dot"
  | "player_converted_channel"
  | "player_poison"
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

/**
 * Product gates. Prompt aliases:
 * onHitGear = Slayer Helmet + Salve
 * blessingOnHit = can roll on-hit blessings
 * canTriggerProcs = can trigger invention (family may refine)
 * canGenerateResources = can generate adrenaline
 * canApplyAbyssalParasite = qualifying direct player hits only
 * recursiveDamage = can recursively schedule damage
 * Separate hit / bleed state are event fields (attached, bleedId), not kind caps.
 */
export interface DamageCapabilities {
  playerAttack: boolean;
  directHit: boolean;
  /** Slayer helmet / Salve. */
  onHitGear: boolean;
  /** Big Boned riders. */
  blessingRider: boolean;
  /** Abyssal Cinders rider and Inferno roll. */
  cindersOnHit: boolean;
  /** Light of Saradomin and other direct on-hit effects. */
  blessingOnHit: boolean;
  /** Default crit eligibility; hitSpec may still force false. */
  canCrit: boolean;
  canGenerateResources: boolean;
  /** ~procEligible for invention + gear land. */
  canTriggerProcs: boolean;
  recursiveDamage: boolean;
  prayerMods: boolean;
  /** Stack Abyssal Parasite when melee + passive + damage (land-time). Matches directHit by product law. */
  canApplyAbyssalParasite: boolean;
  canApplyWeaponPoison: boolean;
  canApplyEvolvingToxin: boolean;
}

const CAPS: Record<DamageProvenanceKind, DamageCapabilities> = {
  player_direct: {
    playerAttack: true,
    directHit: true,
    onHitGear: true,
    blessingRider: true,
    cindersOnHit: true,
    blessingOnHit: true,
    canCrit: true,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: true,
    prayerMods: true,
    canApplyAbyssalParasite: true,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: true,
  },
  player_auto: {
    playerAttack: true,
    directHit: true,
    onHitGear: true,
    blessingRider: true,
    cindersOnHit: true,
    blessingOnHit: true,
    canCrit: true,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: true,
    prayerMods: true,
    canApplyAbyssalParasite: true,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  player_poison: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  player_dot: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    // Crackling charges from DoT family; style land stacks stay procEligible=false on events.
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  // Endless Assault converted channel: DoT family for gear, keeps prayer/window mods + crit.
  player_converted_channel: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGenerateResources: false,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  conjure_auto: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  // DoT-like: riders yes, on-hit rolls no (mirrors player_dot).
  conjure_poison: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  conjure_command: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  equipment_proc: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  invention_proc: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    // Crackling/Aftershock hit splats take Big Boned but are not attack hits.
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  // Parent mods already in list; canTriggerProcs false so attached never inflate proc rolls.
  attached: {
    playerAttack: true,
    directHit: false,
    onHitGear: true,
    blessingRider: false,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  blessing: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  // Death Skulls bounce: separate hit counter / blessings; damage not re-modified.
  derived_bounce: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: true,
    blessingOnHit: true,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  // Bloat-style DoT tail: rider only; no on-hit re-roll.
  derived_tail: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  reflected: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
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

/** Classify a cast hit once: schedule, resolve, and pipeline share this. */
export function provenanceForCastHit(args: {
  isCommand: boolean;
  isDot: boolean;
  convertedChannel?: boolean;
  /** @deprecated Legacy imported auto-attack provenance only. */
  autoAttack?: boolean;
  dotKind?: DamageOverTimeKind;
  bleedId?: BleedId | string;
}): DamageProvenance {
  if (args.isCommand) return { kind: "conjure_command" };
  if (args.convertedChannel) return { kind: "player_converted_channel" };
  if (args.isDot) {
    const detail = args.dotKind ?? args.bleedId;
    return detail != null ? { kind: "player_dot", detail: String(detail) } : { kind: "player_dot" };
  }
  if (args.autoAttack) return { kind: "player_auto" };
  return { kind: "player_direct" };
}

/** Legacy OutgoingDamageSource projection for signatures / blessing APIs. */
export function outgoingSourceOf(p: DamageProvenance): OutgoingDamageSource {
  switch (p.kind) {
    case "player_dot":
    case "player_converted_channel":
    case "player_poison":
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
  /** @deprecated Legacy imported auto-attack provenance only. */
  autoAttack?: boolean;
  blessingGenerated?: boolean;
  convertedChannel?: boolean;
  /** When true, omit/ambiguous context throws instead of defaulting to player_direct. */
  strict?: boolean;
};

/**
 * Migration helper: map legacy damageSource / flags to provenance.
 * Soft default to player_direct is unit-test only (bare `{ style }`, no source flags).
 * Engine / production hit paths must pass explicit provenance or a legacy damageSource;
 * use `{ strict: true }` when hardening a land path that must not inherit onHitGear.
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
    return hints.dotKind === "poison" ? { kind: "conjure_poison" } : { kind: "conjure_auto" };
  }
  if (hints.convertedChannel === true) {
    return { kind: "player_converted_channel" };
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
  // Soft default: unit-test bare context only. Not a production hit classification.
  return { kind: "player_direct" };
}

/**
 * Resolve provenance from CombatContext.
 * Explicit `context.provenance` wins; else legacy flags.
 * Soft default bare style-only -> player_direct is unit-test only (see provenanceFromLegacy).
 * `{ strict: true }` throws on ambiguous omit (engine hardening; not for bare pipeline unit tests).
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

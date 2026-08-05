import type { BleedId, CombatContext, DamageOverTimeKind, OutgoingDamageSource } from "../types";

/**
 * Capability-derived damage provenance. Prefer kind + capabilities over ability-id lists.
 * Serializable plain object for branch signatures / IPC.
 *
 * wiki: Full Slayer Helmet / Salve apply to player direct attacks only (not DoT, conjure, procs).
 * Blessings: riders on direct+DoT+command+conjure; on-hit rolls on direct only; no recursion on blessing dmg.
 * Abyssal Parasite stacks: only player_direct / player_auto (melee+passive gated at land).
 */

export type DamageProvenanceKind =
  | "player_direct"
  | "player_auto"
  | "player_dot"
  | "player_converted_channel"
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
  /** Stack Abyssal Parasite when melee + passive + damage (land-time). Matches directHit by product law. */
  canApplyAbyssalParasite: boolean;
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
    canApplyAbyssalParasite: true,
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
    canApplyAbyssalParasite: true,
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
    canApplyAbyssalParasite: false,
  },
  // Endless Assault converted channel: DoT family for gear, keeps prayer/window mods + crit.
  player_converted_channel: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    blessingOnHit: false,
    canCrit: true,
    canGenerateResources: false,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
  },
  conjure_auto: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
  },
  // DoT-like: riders yes, on-hit rolls no (mirrors player_dot).
  conjure_poison: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    blessingOnHit: false,
    canCrit: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
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
    canApplyAbyssalParasite: false,
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
    canApplyAbyssalParasite: false,
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
    canApplyAbyssalParasite: false,
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
    canApplyAbyssalParasite: false,
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
    canApplyAbyssalParasite: false,
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
    canApplyAbyssalParasite: false,
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
    canApplyAbyssalParasite: false,
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
    canApplyAbyssalParasite: false,
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
  autoAttack?: boolean;
  dotKind?: DamageOverTimeKind;
  bleedId?: BleedId | string;
}): DamageProvenance {
  if (args.isCommand) return { kind: "conjure_command" };
  if (args.convertedChannel) return { kind: "player_converted_channel" };
  if (args.isDot) {
    const detail = args.dotKind ?? args.bleedId;
    return detail != null
      ? { kind: "player_dot", detail: String(detail) }
      : { kind: "player_dot" };
  }
  if (args.autoAttack) return { kind: "player_auto" };
  return { kind: "player_direct" };
}

/** Legacy OutgoingDamageSource projection for signatures / blessing APIs. */
export function outgoingSourceOf(p: DamageProvenance): OutgoingDamageSource {
  switch (p.kind) {
    case "player_dot":
    case "player_converted_channel":
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
    return hints.dotKind === "poison"
      ? { kind: "conjure_poison" }
      : { kind: "conjure_auto" };
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

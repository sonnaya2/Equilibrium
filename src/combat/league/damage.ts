import type { HitCapRule } from "../core/hitCaps";
import type { CritLayers } from "../core/critical";
import {
  calculateAbility,
  type AbilityResult,
  type AbilitySpec,
} from "../pipeline/calculateAbility";
import { calculateHit, calculateRawHitBand, type HitResult } from "../pipeline/calculateHit";
import type { CombatContext, CombatModifier } from "../types";
import {
  netAdrenalineDeltaFromTransaction,
  previewAdrenalineTransaction,
} from "../shared/adrenalineTransaction";
import {
  capabilitiesOf,
  provenanceFromLegacy,
  type DamageProvenance,
} from "../shared/damageProvenance";
import { COMMAND_REQUIRES_CONJURE } from "../styles/necromancy/conjures";
import { blessingRule, resolveMaximumLife, type ResolvedLeagueRules } from "./ruleset";
import type { BlessingId } from "../../league/blessings";
import { packageCritical, type ResolvedDamage } from "../engine/resolution/types";
import { isBasicAttack } from "../shared/adrenalineGain";
import { mulFloor } from "../core/rounding";

/** Tag for blessing-generated damage instances shown in analysis. */
export type BlessingDamageTag = "bonus-damage";

export interface LeagueDamageComponent {
  effectId: string;
  blessingId: BlessingId;
  attached: boolean;
  /** Analysis tag (e.g. bonus-damage riders shown in the Bonus damage column). */
  damageTag?: BlessingDamageTag;
  /** Effect row that receives this bonus instead of the scheduling parent. */
  bonusTargetId?: string;
  /** Legacy application weight; kept for older consumers and EV packing. */
  expectedOccurrences: number;
  /** Expected proc rolls this component represents (Inferno 5% = 1). */
  expectedTriggerRolls: number;
  /** Expected activations (0.05 for one 5% roll; 1 for a deterministic rider). */
  expectedActivations: number;
  /** Expected separate hits; 0 when attached. */
  expectedSeparateHits: number;
  damage: ResolvedDamage;
  hitDetail?: HitResult;
}

/**
 * Damage provenance for blessing eligibility (shared by Quick calc + simulator).
 */
export type BlessingDamageSource =
  /** Player attack hit (incl. channel / multi-hit extras). */
  | "direct"
  /** Bleed or other DoT tick from a player attack. */
  | "dot"
  /** Conjure command hit (player cast, spirit delivered). */
  | "command"
  /** Autonomous conjure auto or its poison (no player cast). */
  | "conjure"
  /** Equipment/perk proc (Crackling, Aftershock, Abyssal parasite). */
  | "proc"
  /** Damage a blessing itself generated. */
  | "blessing";

export interface BlessingHitEligibility {
  /** Big Boned 5% max-life attached rider (not a unique hit). */
  rider: boolean;
  /** Cinders rider and Inferno roll; every independent damage hit qualifies. */
  cinders: boolean;
  /** Direct on-hit effects such as Light of Saradomin. */
  onHit: boolean;
}

const NO_BLESSING_DAMAGE: BlessingHitEligibility = {
  rider: false,
  cinders: false,
  onHit: false,
};

/**
 * Separate blessing hits that host Big Boned. Cinders has its own broader hit gate.
 */
export const SEPARATE_BLESSING_RIDER_HOSTS: ReadonlySet<string> = new Set([
  "light-of-saradomin",
  "inferno-of-zamorak",
]);

/**
 * Blessing eligibility from DamageCapabilities.
 * Big Boned, Cinders, and direct on-hit effects use separate capability gates.
 * Attached always ineligible.
 */
export function blessingHitEligibility(
  source: BlessingDamageSource | DamageProvenance,
  attached: boolean,
): BlessingHitEligibility {
  if (attached) return NO_BLESSING_DAMAGE;
  const p: DamageProvenance =
    typeof source === "string" ? provenanceFromLegacy({ damageSource: source }) : source;
  if (p.kind === "blessing" && (p.detail === "big-boned" || p.detail === "abyssal-cinders")) {
    return NO_BLESSING_DAMAGE;
  }
  const caps = capabilitiesOf(p);
  return {
    rider:
      caps.blessingRider ||
      (p.kind === "blessing" && p.detail != null && SEPARATE_BLESSING_RIDER_HOSTS.has(p.detail)),
    cinders: caps.cindersOnHit,
    onHit: caps.blessingOnHit,
  };
}

export interface LeagueDamageInput {
  rules: ResolvedLeagueRules;
  ability: AbilitySpec;
  hitIndex: number;
  /** Provenance of the damage instance these components hang off. */
  source: BlessingDamageSource | DamageProvenance;
  /** True when the instance is an attached component rather than its own hit. */
  attached?: boolean;
  /** Land tick for timed max-life (Powerburst); default 0 = freeze-at-request for single-cast. */
  landTick?: number;
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  /** Big Boned inherits this parent's crit eligibility and outcome. */
  parentCrit?: CritLayers;
  modifiers: readonly CombatModifier[];
  context: CombatContext;
  cap?: HitCapRule;
  strikingLightReady?: boolean;
  lordOfLightReady?: boolean;
}

export type LeagueAbilityInput = Parameters<typeof calculateAbility>[1] & {
  rules: ResolvedLeagueRules;
  /** Light of Saradomin's cooldown state entering the cast; ready by default. */
  strikingLightReady?: boolean;
  /** Lord of Light's independent cooldown state entering the cast. */
  lordOfLightReady?: boolean;
  /**
   * Loadout adren rules (FotS, Invigorating, AJ mult, CoE/RoV).
   * Analysis path: no Impatient/Relentless RNG (procs forced false).
   * When omitted, AJ blessing alone multiplies listed generation (legacy callers).
   */
  adrenaline?: {
    basicAdrenalineFlatBonus?: number;
    basicGainMultiplier?: number;
    abilityGainMultiplier?: number;
    conservationOfEnergyRefund?: number;
    ringOfVigour?: boolean;
  };
};

/** Analysis / preview net adren: shared pure transaction (no RNG). */
function analysisAdrenalineDelta(
  ability: AbilitySpec,
  adren: NonNullable<LeagueAbilityInput["adrenaline"]>,
): number {
  return netAdrenalineDeltaFromTransaction(previewAdrenalineTransaction(ability, adren));
}

export interface LeagueAbilityResult extends AbilityResult {
  leagueContributions: readonly LeagueDamageComponent[];
}

function damageOf(hit: HitResult): ResolvedDamage {
  return {
    min: hit.min,
    max: hit.max,
    expected: hit.expected,
    critExpected: hit.critExpected,
    capLoss: hit.capLoss,
    critical: packageCritical(hit.critChance, hit.critExpected, hit.nonCritExpected),
  };
}

function weightedDamage(
  hit: HitResult,
  expectedActivations: number,
  minActivations: number,
  maxActivations: number,
  inheritedCrit = false,
): ResolvedDamage {
  const damage = damageOf(hit);
  return {
    ...damage,
    min: damage.min * minActivations,
    max: damage.max * maxActivations,
    expected: damage.expected * expectedActivations,
    critExpected:
      damage.critExpected === undefined ? undefined : damage.critExpected * expectedActivations,
    capLoss: (damage.capLoss ?? 0) * expectedActivations,
    critical: damage.critical
      ? {
          ...damage.critical,
          contribution: damage.critical.contribution * expectedActivations,
          ...(inheritedCrit ? { inherited: true } : {}),
        }
      : undefined,
  };
}

/** Damage generated by one original hit; returned as explicit analysis/event components. */
export function leagueDamageComponents(input: LeagueDamageInput): LeagueDamageComponent[] {
  if (input.rules.ruleset !== "equilibrium") return [];
  const eligible = blessingHitEligibility(input.source, input.attached === true);
  if (!eligible.rider && !eligible.cinders && !eligible.onHit) return [];
  const targetModifiers = input.modifiers.filter(
    (modifier) => modifier.stage === "target" || modifier.stage === "postHit",
  );
  // Provenance kind "blessing" is canonical for recursion gates; ruleset uses resolveCombatProvenance.
  const blessingProv = (detail: string): DamageProvenance => ({
    kind: "blessing",
    detail,
  });
  const shared = {
    level: input.level,
    accuracy: input.accuracy,
    modifiers: targetModifiers,
    context: {
      ...input.context,
      damageSource: "blessing" as const,
      provenance: blessingProv("pending"),
    },
    cap: input.cap,
  };
  const noCrit: CritLayers = { chance: 0, eligible: false };
  const components: LeagueDamageComponent[] = [];

  const cinders = blessingRule(input.rules, "abyssal-cinders");
  const infernoChance = eligible.cinders ? (cinders?.inferno?.chance ?? 0) : 0;
  if (infernoChance < 0 || infernoChance >= 1) {
    throw new RangeError(`Abyssal Cinders chance ${infernoChance} must be in [0, 1)`);
  }
  // E[recursive Infernos] = p + p^2 + ... = p / (1 - p).
  const recursiveFactor = 1 / (1 - infernoChance);
  const infernoActivations = infernoChance * recursiveFactor;
  const cindersRiderActivations =
    eligible.cinders && cinders?.perHitAbilityDamagePercent !== undefined ? recursiveFactor : 0;

  const parentProvenance =
    typeof input.source === "string"
      ? provenanceFromLegacy({ damageSource: input.source })
      : input.source;
  const parentCrit = input.parentCrit ?? {
    ...input.crit,
    eligible:
      capabilitiesOf(parentProvenance).canCrit &&
      (input.ability.hits[input.hitIndex]?.critEligible ?? true),
  };
  const infernoCrit: CritLayers = { ...input.crit, eligible: true };

  // Split by parent so menu attribution and inherited crit state stay exact.
  const bigBoned = blessingRule(input.rules, "big-boned");
  const bigBonedPercent = bigBoned?.maxLifeDamagePercent;
  const rootBigBonedActivations = eligible.rider ? 1 : 0;
  if (bigBonedPercent !== undefined) {
    const pushBigBoned = (
      activations: number,
      minActivations: number,
      maxActivations: number,
      crit: CritLayers,
      bonusTargetId?: string,
    ) => {
      if (activations <= 0) return;
      const prov = blessingProv("big-boned");
      const hit = calculateHit({
        ...shared,
        provenance: prov,
        context: { ...shared.context, provenance: prov },
        base: resolveMaximumLife(input.rules, input.landTick ?? 0),
        band: {
          minPct: bigBonedPercent * 100,
          maxPct: bigBonedPercent * 100,
        },
        crit,
      });
      components.push({
        effectId: "big-boned",
        blessingId: "big-boned",
        attached: true,
        damageTag: "bonus-damage",
        ...(bonusTargetId ? { bonusTargetId } : {}),
        expectedOccurrences: activations,
        expectedTriggerRolls: 0,
        expectedActivations: activations,
        expectedSeparateHits: 0,
        damage: weightedDamage(hit, activations, minActivations, maxActivations, true),
        hitDetail: hit,
      });
    };

    pushBigBoned(
      rootBigBonedActivations,
      rootBigBonedActivations,
      rootBigBonedActivations,
      parentCrit,
    );
    pushBigBoned(
      cindersRiderActivations,
      1,
      1 + (infernoChance > 0 ? recursiveFactor : 0),
      noCrit,
      "abyssal-cinders",
    );
    pushBigBoned(infernoActivations, 0, recursiveFactor, infernoCrit, "inferno-of-zamorak");
  }

  // Cinders rides the root hit and every recursive Inferno; attached bonus is not itself a hit.
  if (eligible.cinders && cinders?.perHitAbilityDamagePercent !== undefined) {
    const prov = blessingProv("abyssal-cinders");
    const hit = calculateHit({
      ...shared,
      provenance: prov,
      context: { ...shared.context, provenance: prov },
      base: input.base,
      band: {
        minPct: cinders.perHitAbilityDamagePercent * 100,
        maxPct: cinders.perHitAbilityDamagePercent * 100,
      },
      crit: noCrit,
    });
    components.push({
      effectId: "abyssal-cinders",
      blessingId: "abyssal-cinders",
      attached: true,
      damageTag: "bonus-damage",
      expectedOccurrences: cindersRiderActivations,
      expectedTriggerRolls: 0,
      expectedActivations: cindersRiderActivations,
      expectedSeparateHits: 0,
      damage: weightedDamage(
        hit,
        cindersRiderActivations,
        1,
        1 + (infernoChance > 0 ? recursiveFactor : 0),
      ),
      hitDetail: hit,
    });
  }
  if (eligible.cinders && cinders?.inferno) {
    const prov = blessingProv("inferno-of-zamorak");
    const hit = calculateHit({
      ...shared,
      provenance: prov,
      context: { ...shared.context, provenance: prov },
      base: input.base,
      band: {
        minPct: cinders.inferno.abilityDamageBand[0],
        maxPct: cinders.inferno.abilityDamageBand[1],
      },
      crit: infernoCrit,
    });
    components.push({
      effectId: "inferno-of-zamorak",
      blessingId: "abyssal-cinders",
      attached: false,
      expectedOccurrences: infernoActivations,
      expectedTriggerRolls: recursiveFactor,
      expectedActivations: infernoActivations,
      expectedSeparateHits: infernoActivations,
      damage: weightedDamage(hit, infernoActivations, 0, recursiveFactor),
    });
  }

  const strikingLight = blessingRule(input.rules, "striking-light")?.light;
  const lordLight = blessingRule(input.rules, "lord-of-light")?.light;
  if (eligible.onHit && isBasicAttack(input.ability)) {
    const prayerMultiplier = 1 + input.rules.prayerBonus * (lordLight?.prayerDamagePerBonus ?? 0);
    const pushLights = (
      light: NonNullable<typeof strikingLight>,
      blessingId: "striking-light" | "lord-of-light",
      count: number,
    ) => {
      const armour = Math.floor(input.rules.totalArmour * light.armourPercent);
      const rawMin = Math.floor(input.base * (light.abilityDamageBand[0] / 100)) + armour;
      const rawMax = Math.floor(input.base * (light.abilityDamageBand[1] / 100)) + armour;
      const prov = blessingProv("light-of-saradomin");
      const hit = calculateRawHitBand({
        ...shared,
        provenance: prov,
        context: { ...shared.context, provenance: prov },
        min: mulFloor(rawMin, prayerMultiplier),
        max: mulFloor(rawMax, prayerMultiplier),
        crit: { ...input.crit, eligible: true },
      });
      for (let i = 0; i < count; i++) {
        components.push({
          effectId: "light-of-saradomin",
          blessingId,
          attached: false,
          expectedOccurrences: 1,
          expectedTriggerRolls: 0,
          expectedActivations: 1,
          expectedSeparateHits: 1,
          damage: damageOf(hit),
          hitDetail: hit,
        });
      }
    };
    if (input.strikingLightReady && strikingLight) {
      pushLights(strikingLight, "striking-light", 1);
    }
    if (input.lordOfLightReady && lordLight) {
      const targets = Math.min(
        lordLight.maxTargetsPerStrike ?? 1,
        Math.max(1, input.rules.areaTargets),
      );
      pushLights(lordLight, "lord-of-light", (lordLight.strikes ?? 1) * targets);
    }
  }

  return components;
}

export interface GraspOfGuthixInput {
  rules: ResolvedLeagueRules;
  /** Grasp triggers over the measured window, from the Barkscales scenario. */
  triggers: number;
  /** Tiles of the 3x3 holding a target; 0 when the target is poison-immune. */
  targetsStruck: number;
  base: number;
  level: number;
  accuracy: number;
  modifiers: readonly CombatModifier[];
  context: CombatContext;
  cap?: HitCapRule;
}

/**
 * Grasp of Guthix poison via hit pipeline; non-crit, provenance kind blessing (no feed-back).
 */
export function graspOfGuthixComponent(
  input: GraspOfGuthixInput,
): LeagueDamageComponent | undefined {
  const barkscales = blessingRule(input.rules, "barkscales")?.barkscales;
  if (!barkscales || input.triggers <= 0 || input.targetsStruck <= 0) return undefined;
  const applications = input.triggers * input.targetsStruck;
  const provenance: DamageProvenance = { kind: "blessing", detail: "grasp-of-guthix" };
  const hit = calculateHit({
    base: input.base,
    band: {
      minPct: barkscales.graspAbilityDamageBand[0],
      maxPct: barkscales.graspAbilityDamageBand[1],
    },
    level: input.level,
    accuracy: input.accuracy,
    crit: { chance: 0, eligible: false },
    modifiers: input.modifiers.filter(
      (modifier) => modifier.stage === "target" || modifier.stage === "postHit",
    ),
    provenance,
    context: {
      ...input.context,
      damageSource: "blessing",
      dotKind: "poison",
      provenance,
    },
    cap: input.cap,
  });
  const damage = damageOf(hit);
  return {
    effectId: "grasp-of-guthix",
    blessingId: "barkscales",
    attached: false,
    expectedOccurrences: applications,
    expectedTriggerRolls: 0,
    expectedActivations: applications,
    expectedSeparateHits: applications,
    damage: {
      ...damage,
      min: damage.min * applications,
      max: damage.max * applications,
      expected: damage.expected * applications,
      capLoss: (damage.capLoss ?? 0) * applications,
    },
    hitDetail: hit,
  };
}

/** Single-cast view using the same component resolver as scheduled simulation events. */
export function calculateLeagueAbility(
  ability: AbilitySpec,
  input: LeagueAbilityInput,
): LeagueAbilityResult {
  const { rules, strikingLightReady, lordOfLightReady, ...baseInput } = input;
  const ordinary = calculateAbility(ability, baseInput);
  // Light of Saradomin 9s CD: at most first direct hit of this cast can trigger.
  let strikingLightAvailable = strikingLightReady ?? true;
  let lordOfLightAvailable = lordOfLightReady ?? true;
  const contributions = ability.hits.flatMap((hit, hitIndex) => {
    const isCommand = COMMAND_REQUIRES_CONJURE[ability.id] !== undefined;
    const source: BlessingDamageSource = hit.dot ? "dot" : isCommand ? "command" : "direct";
    const provenance: DamageProvenance = hit.dot
      ? { kind: "player_dot", detail: hit.dotKind }
      : isCommand
        ? { kind: "conjure_command" }
        : { kind: "player_direct" };
    const sharedInput = {
      rules,
      ability,
      hitIndex,
      base: input.base,
      level: input.level,
      accuracy: input.accuracy,
      crit: input.crit,
      modifiers: input.modifiers ?? [],
      context: {
        ...input.context,
        style: ability.style,
        abilityCategory: ability.category,
        basicAttack: isBasicAttack(ability),
        area: ability.area,
        damageSource: source,
        provenance,
      },
      cap: input.cap,
    };
    const components = leagueDamageComponents({
      ...sharedInput,
      source,
      strikingLightReady: strikingLightAvailable,
      lordOfLightReady: lordOfLightAvailable,
    });
    if (components.some((component) => component.blessingId === "striking-light")) {
      strikingLightAvailable = false;
    }
    if (components.some((component) => component.blessingId === "lord-of-light")) {
      lordOfLightAvailable = false;
    }
    // Mirror land-time: Light is a separate hit and hosts its own packed Cinders chain.
    const ridersOnSeparate: LeagueDamageComponent[] = [];
    for (const component of components) {
      if (component.attached || component.effectId !== "light-of-saradomin") {
        continue;
      }
      const nested = leagueDamageComponents({
        ...sharedInput,
        source: { kind: "blessing", detail: component.effectId },
        attached: false,
        strikingLightReady: false,
        lordOfLightReady: false,
      });
      ridersOnSeparate.push(...nested);
    }
    return [...components, ...ridersOnSeparate];
  });
  return {
    ...ordinary,
    hits: [
      ...ordinary.hits,
      ...contributions.flatMap((component) =>
        !component.attached && component.expectedOccurrences === 1 && component.hitDetail
          ? [component.hitDetail]
          : [],
      ),
    ],
    min: ordinary.min + contributions.reduce((sum, component) => sum + component.damage.min, 0),
    max: ordinary.max + contributions.reduce((sum, component) => sum + component.damage.max, 0),
    expected:
      ordinary.expected +
      contributions.reduce((sum, component) => sum + component.damage.expected, 0),
    adrenalineDelta: (() => {
      if (input.adrenaline) {
        return analysisAdrenalineDelta(ability, input.adrenaline);
      }
      // Legacy: AJ blessing mult on listed generation only.
      const cost = ability.adrenaline?.cost ?? 0;
      const listed = ability.adrenaline?.gain ?? 0;
      const aj = blessingRule(rules, "adrenaline-junkie")?.adrenalineGenerationMultiplier ?? 1;
      return listed * aj - cost;
    })(),
    leagueContributions: contributions,
  };
}

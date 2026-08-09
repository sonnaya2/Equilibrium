import { describe, expect, it } from "vitest";
import { bandOf } from "../../core/abilityDamage";
import { mulFloor } from "../../core/rounding";
import {
  ESSENCE_CORRUPTION_DURATION_TICKS,
  ESSENCE_CORRUPTION_SOURCE,
  ESSENCE_CORRUPTION_STACK_CAP,
  SONG_TWO_PIECE_DAMAGE_MULTIPLIER,
  SOULFIRE_ABILITY,
  activeEssenceCorruptionStacks,
  essenceCorruptionFlatBonus,
  isEssenceCorruptionMagicHit,
  isEssenceCorruptionStackHit,
  landEssenceCorruptionHit,
  newSongOfDestructionRotationState,
  prepareEssenceCorruptionEmpowerment,
  songOfDestructionModifiers,
  songOfDestructionSummary,
} from "./songOfDestruction";
import { MAGIC_ABILITIES } from "./abilities";
import {
  isTrueDotDamage,
  outgoingSourceOf,
  provenanceForCastHit,
  type DamageProvenanceKind,
} from "../../shared/damageProvenance";
import { calculateAbility } from "../../pipeline/calculateAbility";
import { calculateHit, calculateHitWithAttached } from "../../pipeline/calculateHit";
import { abilityBehaviorFingerprint } from "../../shared/abilityFingerprint";
import { songOfDestructionEquipmentSummary } from "../../shared/equipment";

const onePiece = songOfDestructionSummary(1);
const twoPiece = songOfDestructionSummary(2);
const combust = {
  id: "combust",
  style: "magic" as const,
  essenceCorruptionEligible: true,
  songAffectedDot: true,
};
const corruption = {
  id: "corruption_blast",
  style: "magic" as const,
  essenceCorruptionEligible: true,
  songAffectedDot: true,
};
const directMagic = { id: "air_blast", style: "magic" as const };
const lightning = {
  id: "instability_lightning_surge",
  style: "magic" as const,
  essenceCorruptionMagicHitEligible: true,
};

describe("Song of Destruction helpers", () => {
  it("derives enabled thresholds from physical piece count", () => {
    expect(songOfDestructionSummary(0)).toEqual({ pieceCount: 0, enabled: false, twoPiece: false });
    expect(onePiece).toEqual({ pieceCount: 1, enabled: true, twoPiece: false });
    expect(twoPiece).toEqual({ pieceCount: 2, enabled: true, twoPiece: true });
    expect(songOfDestructionSummary(8).pieceCount).toBe(2);
  });

  it("counts physical Song items once and ignores virtual set-piece contribution", () => {
    expect(
      songOfDestructionEquipmentSummary({
        equipmentSlots: { mainhand: "item:roar-of-awakening" },
        equipmentIds: ["item:roar-of-awakening"],
        pieceContribution: { additionalPiecesPerItem: 2 },
      }),
    ).toEqual(onePiece);
    expect(
      songOfDestructionEquipmentSummary({
        equipmentSlots: {
          mainhand: "item:roar-of-awakening",
          offhand: "item:ode-to-deceit",
        },
        equipmentIds: ["item:roar-of-awakening", "item:ode-to-deceit"],
        pieceContribution: { additionalPiecesPerItem: 2 },
      }),
    ).toEqual(twoPiece);
  });

  it("uses the DamageProvenance matrix for flat eligibility", () => {
    const allowed: DamageProvenanceKind[] = ["player_direct", "player_auto", "player_dot"];
    for (const kind of allowed) {
      expect(isEssenceCorruptionMagicHit(directMagic, { kind }), kind).toBe(true);
    }

    expect(isEssenceCorruptionMagicHit(corruption, { kind: "derived_tail", detail: corruption.id })).toBe(
      true,
    );
    expect(isEssenceCorruptionMagicHit(directMagic, { kind: "derived_tail", detail: directMagic.id })).toBe(
      false,
    );
    expect(isEssenceCorruptionMagicHit(lightning, { kind: "equipment_proc", detail: "lightning_surge" })).toBe(
      true,
    );
    expect(isEssenceCorruptionMagicHit(directMagic, { kind: "equipment_proc", detail: "other" })).toBe(
      false,
    );

    const excluded: DamageProvenanceKind[] = [
      "attached",
      "invention_proc",
      "player_poison",
      "blessing",
      "conjure_auto",
      "target_status",
      "reflected",
      "derived_bounce",
      "player_converted_channel",
    ];
    for (const kind of excluded) {
      expect(isEssenceCorruptionMagicHit(directMagic, { kind }), kind).toBe(false);
    }
  });

  it("generates stacks only for matching affected DoT provenance", () => {
    expect(isEssenceCorruptionStackHit(combust, { kind: "player_dot", detail: "combust" })).toBe(true);
    expect(isEssenceCorruptionStackHit(corruption, { kind: "derived_tail", detail: "corruption_blast" })).toBe(
      true,
    );
    expect(isEssenceCorruptionStackHit(corruption, { kind: "derived_tail", detail: "other_ability" })).toBe(
      false,
    );
    expect(isEssenceCorruptionStackHit(directMagic, { kind: "player_dot" })).toBe(false);
    expect(isEssenceCorruptionStackHit(lightning, { kind: "equipment_proc", detail: "lightning_surge" })).toBe(
      false,
    );
  });

  it("uses prospective landed stacks for the integer flat term", () => {
    const state = { stacks: 9, expiresAtTick: 50 };
    const parent = { kind: "player_dot" as const, detail: "combust" };
    expect(essenceCorruptionFlatBonus(onePiece, state, 10, 99, combust, parent)).toBe(129);

    const capped = { stacks: 99, expiresAtTick: 50 };
    const tail = { kind: "derived_tail" as const, detail: "corruption_blast" };
    expect(essenceCorruptionFlatBonus(twoPiece, capped, 10, 120, corruption, tail)).toBe(420);
    expect(essenceCorruptionFlatBonus(twoPiece, state, 10, 120, directMagic, { kind: "attached" })).toBe(0);
  });

  it("preserves state while disabled and refreshes only actual qualifying lands", () => {
    const state = { stacks: 9, expiresAtTick: 50 };
    const parent = { kind: "player_dot" as const, detail: "combust" };
    expect(landEssenceCorruptionHit(songOfDestructionSummary(0), state, 10, combust, parent)).toEqual(state);
    expect(activeEssenceCorruptionStacks(songOfDestructionSummary(0), state, 10)).toBe(0);
    expect(landEssenceCorruptionHit(onePiece, state, 10, combust, parent)).toEqual({
      stacks: 10,
      expiresAtTick: 10 + ESSENCE_CORRUPTION_DURATION_TICKS,
    });

    const capped = landEssenceCorruptionHit(
      onePiece,
      { stacks: ESSENCE_CORRUPTION_STACK_CAP, expiresAtTick: 100 },
      20,
      combust,
      parent,
    );
    expect(capped).toEqual({ stacks: ESSENCE_CORRUPTION_STACK_CAP, expiresAtTick: 70 });
    expect(landEssenceCorruptionHit(onePiece, state, 10, directMagic, { kind: "player_direct" })).toEqual({
      stacks: 9,
      expiresAtTick: 50,
    });
  });

  it("rolls empowerment once per eligible cast and never mutates preparation state", () => {
    const state = { stacks: 1, expiresAtTick: 50 };
    expect(prepareEssenceCorruptionEmpowerment(onePiece, state, 10, combust, 0.1)).toEqual({
      scope: "cast-target",
      rollCount: 1,
      preCastStacks: 1,
      empowered: true,
    });
    expect(state).toEqual({ stacks: 1, expiresAtTick: 50 });
    expect(prepareEssenceCorruptionEmpowerment(onePiece, state, 10, directMagic, 0.1).rollCount).toBe(0);
  });

  it("keeps Conflagrate and the two-piece Song floors as separate ability steps", () => {
    const modifiers = songOfDestructionModifiers({
      summary: twoPiece,
      ability: combust,
      conflagrateActive: true,
    });
    expect(modifiers.map(({ id, stage, priority }) => ({ id, stage, priority }))).toEqual([
      { id: "song:conflagrate", stage: "ability", priority: 0 },
      { id: "song:two-piece-dot", stage: "ability", priority: 1 },
    ]);
    const damage = modifiers.reduce(
      (value, modifier) => modifier.apply({ damage: value }, { style: "magic" }).damage,
      101,
    );
    expect(damage).toBe(mulFloor(mulFloor(101, 1.4), 1.3));
  });

  // Wiki Soulfire: opener is direct; Song 2pc is DoT-only (no 1.3 on that hit).
  it("does not apply Song 2pc 1.3 to Soulfire direct opener provenance", () => {
    const modifiers = songOfDestructionModifiers({
      summary: twoPiece,
      ability: SOULFIRE_ABILITY,
    });
    const twoPieceDot = modifiers.find((modifier) => modifier.id === "song:two-piece-dot");
    expect(twoPieceDot).toBeDefined();
    expect(
      twoPieceDot!.applies({
        style: "magic",
        provenance: { kind: "player_direct" },
      }),
    ).toBe(false);
    expect(
      twoPieceDot!.applies({
        style: "magic",
        provenance: { kind: "player_dot", detail: "burn" },
      }),
    ).toBe(true);
  });

  it("exposes Essence as a post-Damage-Potential, pre-cap host term", () => {
    const targetMultiplier = {
      id: "test:target-double",
      stage: "target" as const,
      priority: 0,
      applies: () => true,
      apply: (state: { damage: number }) => ({ ...state, damage: state.damage * 2 }),
      source: ESSENCE_CORRUPTION_SOURCE,
    };
    const input = {
      base: 300,
      band: { minPct: 100, maxPct: 100 },
      level: 99,
      accuracy: 0.2,
      crit: { chance: 0 },
      modifiers: [targetMultiplier],
      postDamagePotentialFlat: 200,
    };
    expect(calculateHit(input).expected).toBe(320);
    expect(
      calculateHit({ ...input, modifiers: [], postDamagePotentialFlat: 200 }).expected,
    ).toBe(260);
  });

  it("reports only the cap-limited flat marginal", () => {
    const capped = calculateHit({
      base: 300,
      band: { minPct: 100, maxPct: 100 },
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      cap: { cap: 310 },
      postDamagePotentialFlat: 20,
    });
    expect(capped.expected).toBe(310);
    expect(capped.postDamagePotentialFlatContribution).toBe(10);
  });

  it("does not attribute the host Essence flat term to attached damage", () => {
    const composed = calculateHitWithAttached(
      {
        base: 300,
        band: { minPct: 100, maxPct: 100 },
        level: 99,
        accuracy: 0.2,
        crit: { chance: 0 },
        postDamagePotentialFlat: 200,
      },
      [{ id: "test:attached", amount: 100 }],
    );
    expect(composed.baseHit.expected).toBe(260);
    expect(composed.attached[0]?.hit.expected).toBe(20);
    expect(composed.hit.expected).toBe(280);
  });

  it("keeps Soulfire as the Roar native seven-hit special (1 direct + 6 DoT)", () => {
    expect(MAGIC_ABILITIES.find(({ id }) => id === "soulfire")).toBe(SOULFIRE_ABILITY);
    expect(SOULFIRE_ABILITY).toMatchObject({
      category: "enhanced",
      weaponSpecial: true,
      requiresSpecialAccess: true,
      adrenaline: { cost: 35 },
      cooldownSeconds: 45,
      essenceCorruptionEligible: true,
      songAffectedDot: true,
    });
    // Wiki: opener direct concurrent with first DoT; five more DoTs every 3 ticks.
    expect(SOULFIRE_ABILITY.hits).toHaveLength(7);
    expect(SOULFIRE_ABILITY.hits.map((hit) => hit.tickOffset ?? 0)).toEqual([0, 0, 3, 6, 9, 12, 15]);
    expect(SOULFIRE_ABILITY.hits[0]?.band).toEqual({ minPct: 130, maxPct: 160 });
    expect(SOULFIRE_ABILITY.hits[0]?.dot).toBeUndefined();
    expect(SOULFIRE_ABILITY.hits[0]?.critEligible).not.toBe(false);
    expect(
      SOULFIRE_ABILITY.hits.slice(1).every(
        (hit) =>
          hit.band.minPct === 170 &&
          hit.band.maxPct === 200 &&
          hit.dot === true &&
          hit.dotKind === "burn" &&
          hit.critEligible === false,
      ),
    ).toBe(true);
    expect(
      abilityBehaviorFingerprint(SOULFIRE_ABILITY),
    ).not.toBe(
      abilityBehaviorFingerprint({ ...SOULFIRE_ABILITY, requiresSpecialAccess: false }),
    );
  });

  // Wiki Soulfire: opener direct 130-160% (no Song 2pc); 6 burn DoTs 170-200% get 2pc x1.3.
  // Residual must exercise applies (pipeline filter), not only modifier.apply on a bare style.
  it("applies Song 2pc only to true DoT hits on Soulfire (not the direct opener)", () => {
    const modifiers = songOfDestructionModifiers({
      summary: twoPiece,
      ability: SOULFIRE_ABILITY,
    });
    const twoPieceDot = modifiers.find((modifier) => modifier.id === "song:two-piece-dot");
    expect(twoPieceDot).toBeDefined();

    const openerHit = SOULFIRE_ABILITY.hits[0]!;
    const burnHit = SOULFIRE_ABILITY.hits[1]!;
    const openerProvenance = provenanceForCastHit({
      isCommand: false,
      isDot: openerHit.dot === true || openerHit.dotKind != null,
      dotKind: openerHit.dotKind,
    });
    const burnProvenance = provenanceForCastHit({
      isCommand: false,
      isDot: burnHit.dot === true || burnHit.dotKind != null,
      dotKind: burnHit.dotKind,
    });
    const openerContext = {
      style: "magic" as const,
      provenance: openerProvenance,
      damageSource: outgoingSourceOf(openerProvenance),
      dotKind: openerHit.dotKind,
    };
    const burnContext = {
      style: "magic" as const,
      provenance: burnProvenance,
      damageSource: outgoingSourceOf(burnProvenance),
      dotKind: burnHit.dotKind,
    };

    expect(openerProvenance).toEqual({ kind: "player_direct" });
    expect(burnProvenance).toEqual({ kind: "player_dot", detail: "burn" });
    expect(isTrueDotDamage(openerContext)).toBe(false);
    expect(isTrueDotDamage(burnContext)).toBe(true);
    expect(twoPieceDot!.applies(openerContext)).toBe(false);
    expect(twoPieceDot!.applies(burnContext)).toBe(true);
    expect(twoPieceDot!.applies({ ...burnContext, style: "melee" })).toBe(false);

    const hitInput = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      context: { style: "magic" as const },
    };
    const bare = calculateAbility(SOULFIRE_ABILITY, hitInput);
    const withTwoPiece = calculateAbility(SOULFIRE_ABILITY, {
      ...hitInput,
      modifiers,
    });

    // Opener: same expected with or without 2pc (applies false on player_direct).
    expect(withTwoPiece.hits[0]!.expected).toBe(bare.hits[0]!.expected);
    expect(withTwoPiece.hits[0]!.expected).toBe(bandOf(1000, openerHit.band).expected);

    // DoT: independent ability-stage floor oracle (acc 1, no crit, no cap bind).
    const burnBand = bandOf(1000, burnHit.band);
    let burnTotal = 0;
    for (let roll = burnBand.min; roll <= burnBand.max; roll++) {
      burnTotal += mulFloor(roll, SONG_TWO_PIECE_DAMAGE_MULTIPLIER);
    }
    const burnExpectedWithTwoPiece = burnTotal / (burnBand.max - burnBand.min + 1);

    expect(bare.hits.slice(1).every((hit) => hit.expected === burnBand.expected)).toBe(true);
    expect(
      withTwoPiece.hits.slice(1).every((hit) => hit.expected === burnExpectedWithTwoPiece),
    ).toBe(true);
    expect(burnExpectedWithTwoPiece).toBeGreaterThan(burnBand.expected);
  });

  it("creates concrete lane-local Song state", () => {
    expect(newSongOfDestructionRotationState()).toEqual({
      essenceCorruption: { stacks: 0, expiresAtTick: 0 },
      conflagrateUntilTick: 0,
      adrenalineStream: { nextPulseTick: 0, remainingPulses: 0 },
    });
  });
});

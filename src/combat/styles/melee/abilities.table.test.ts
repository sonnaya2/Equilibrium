import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_STRIKE_DW_HIT_BAND,
  ADAPTIVE_STRIKE_PRIMARY_BAND,
  MELEE_ABILITIES,
  type MeleeAbilitySpec,
} from "./abilities";

type HitRow = {
  minPct: number;
  maxPct: number;
  tickOffset?: number;
  critEligible?: boolean;
  dot?: boolean;
  bleedId?: string;
};

type ExpectedRow = {
  id: string;
  hitCount: number;
  bands: HitRow[];
  channelTicks?: number;
  adrenGain?: number;
  adrenCost?: number;
  cooldownSeconds?: number;
  charges?: { max: number; secondChargeLevel?: number };
  weaponRequirement?: MeleeAbilitySpec["weaponRequirement"];
  replacementGroup?: string;
  supportStatus?: MeleeAbilitySpec["supportStatus"];
  bloodlustGain?: number;
};

/**
 * Source-backed expectation rows for every MELEE_ABILITIES entry.
 * Bands / adren / CD / charges from wiki ability pages (kit comments + Adaptive 2026-08-04).
 */
const EXPECTED: ExpectedRow[] = [
  {
    id: "attack",
    hitCount: 1,
    bands: [{ minPct: 110, maxPct: 130 }],
    adrenGain: 9,
    bloodlustGain: 1,
  },
  {
    id: "adaptive_strike_2h",
    hitCount: 1,
    bands: [{ ...ADAPTIVE_STRIKE_PRIMARY_BAND }],
    adrenGain: 12,
    cooldownSeconds: 5.4,
    weaponRequirement: "twohand",
    replacementGroup: "adaptive_strike",
    bloodlustGain: 1,
  },
  {
    id: "adaptive_strike_mh",
    hitCount: 1,
    bands: [{ ...ADAPTIVE_STRIKE_PRIMARY_BAND }],
    adrenGain: 12,
    cooldownSeconds: 5.4,
    weaponRequirement: "mainhand-empty",
    replacementGroup: "adaptive_strike",
    bloodlustGain: 1,
  },
  {
    id: "adaptive_strike_dw",
    hitCount: 2,
    bands: [{ ...ADAPTIVE_STRIKE_DW_HIT_BAND }, { ...ADAPTIVE_STRIKE_DW_HIT_BAND }],
    adrenGain: 12,
    cooldownSeconds: 5.4,
    weaponRequirement: "dualwield",
    replacementGroup: "adaptive_strike",
    bloodlustGain: 1,
  },
  {
    id: "rend",
    hitCount: 1,
    bands: [{ minPct: 135, maxPct: 165 }],
    adrenGain: 9,
    cooldownSeconds: 10.2,
    bloodlustGain: 2,
  },
  {
    id: "fury",
    hitCount: 1,
    bands: [{ minPct: 110, maxPct: 130 }],
    adrenGain: 9,
    cooldownSeconds: 15,
    replacementGroup: "fury",
    bloodlustGain: 1,
  },
  {
    id: "greater_fury",
    hitCount: 1,
    bands: [{ minPct: 120, maxPct: 140 }],
    adrenGain: 9,
    cooldownSeconds: 15,
    replacementGroup: "fury",
    bloodlustGain: 1,
  },
  {
    id: "backhand",
    hitCount: 1,
    bands: [{ minPct: 95, maxPct: 105 }],
    adrenGain: 9,
    cooldownSeconds: 15,
    charges: { max: 2, secondChargeLevel: 54 },
    bloodlustGain: 1,
  },
  {
    id: "punish",
    hitCount: 1,
    bands: [{ minPct: 110, maxPct: 130 }],
    adrenGain: 9,
    cooldownSeconds: 24,
    bloodlustGain: 1,
  },
  {
    id: "barge",
    hitCount: 1,
    bands: [{ minPct: 75, maxPct: 95 }],
    adrenGain: 9,
    cooldownSeconds: 20.4,
    replacementGroup: "barge",
    bloodlustGain: 1,
  },
  {
    id: "greater_barge",
    hitCount: 1,
    bands: [{ minPct: 75, maxPct: 95 }],
    adrenGain: 9,
    cooldownSeconds: 20.4,
    replacementGroup: "barge",
    bloodlustGain: 1,
  },
  {
    id: "chaos_roar",
    hitCount: 1,
    bands: [{ minPct: 100, maxPct: 120 }],
    adrenGain: 9,
    cooldownSeconds: 60,
    bloodlustGain: 1,
  },
  {
    id: "dismember",
    hitCount: 8,
    bands: Array.from({ length: 8 }, (_, i) => ({
      minPct: 25,
      maxPct: 35,
      tickOffset: (i + 1) * 2,
      critEligible: false,
      dot: true,
      bleedId: "dismember",
    })),
    cooldownSeconds: 24,
  },
  {
    id: "slaughter",
    hitCount: 6,
    bands: Array.from({ length: 6 }, (_, i) => ({
      minPct: 80,
      maxPct: 100,
      tickOffset: (i + 1) * 3,
      critEligible: false,
      dot: true,
      bleedId: "slaughter",
    })),
    adrenCost: 25,
  },
  {
    id: "massacre",
    hitCount: 7,
    bands: [
      { minPct: 110, maxPct: 130 },
      ...Array.from({ length: 6 }, (_, i) => ({
        minPct: 100,
        maxPct: 100,
        tickOffset: (i + 1) * 4,
        critEligible: false,
        dot: true,
        bleedId: "massacre",
      })),
    ],
    adrenCost: 25,
  },
  {
    id: "assault",
    hitCount: 4,
    bands: Array.from({ length: 4 }, (_, i) => ({
      minPct: 130,
      maxPct: 150,
      tickOffset: 1 + i * 2,
    })),
    channelTicks: 8,
    adrenCost: 25,
    cooldownSeconds: 6,
  },
  {
    id: "flurry",
    hitCount: 8,
    bands: Array.from({ length: 8 }, (_, i) => ({
      minPct: 60,
      maxPct: 70,
      tickOffset: i + 1,
    })),
    channelTicks: 8,
    adrenCost: 25,
    cooldownSeconds: 20.4,
    weaponRequirement: "dualwield",
    replacementGroup: "flurry",
  },
  {
    id: "greater_flurry",
    hitCount: 8,
    bands: Array.from({ length: 8 }, (_, i) => ({
      minPct: 60,
      maxPct: 70,
      tickOffset: i + 1,
    })),
    channelTicks: 8,
    adrenCost: 25,
    cooldownSeconds: 20.4,
    weaponRequirement: "dualwield",
    replacementGroup: "flurry",
  },
  {
    id: "hurricane",
    hitCount: 2,
    bands: [
      { minPct: 135, maxPct: 165 },
      { minPct: 155, maxPct: 185 },
    ],
    adrenCost: 25,
    cooldownSeconds: 20.4,
    weaponRequirement: "twohand",
  },
  {
    id: "overpower",
    hitCount: 1,
    bands: [{ minPct: 520, maxPct: 570, tickOffset: 3 }],
    adrenCost: 60,
    cooldownSeconds: 30,
    replacementGroup: "overpower",
  },
  {
    id: "overpower_igneous",
    hitCount: 2,
    bands: [
      { minPct: 280, maxPct: 340, tickOffset: 3 },
      { minPct: 280, maxPct: 340, tickOffset: 3 },
    ],
    adrenCost: 60,
    cooldownSeconds: 30,
    replacementGroup: "overpower",
  },
  {
    id: "icy_tempest",
    hitCount: 2,
    bands: [
      { minPct: 115, maxPct: 135 },
      { minPct: 175, maxPct: 205 },
    ],
    adrenCost: 30,
    cooldownSeconds: 15,
    // Weapon special: access via specialAttackId / EoF (requiresSpecialAccess), not shape/passive.
    weaponRequirement: undefined,
    supportStatus: undefined,
  },
  {
    id: "pulverise",
    hitCount: 1,
    bands: [{ minPct: 300, maxPct: 340 }],
    adrenCost: 60,
    cooldownSeconds: 60,
    weaponRequirement: "twohand",
  },
  {
    id: "berserk",
    hitCount: 0,
    bands: [],
    adrenCost: 100,
    cooldownSeconds: 60,
  },
  {
    id: "meteor_strike",
    hitCount: 1,
    bands: [{ minPct: 220, maxPct: 250 }],
    adrenCost: 60,
    cooldownSeconds: 60,
  },
];

function hitRow(hit: MeleeAbilitySpec["hits"][number]): HitRow {
  return {
    minPct: hit.band.minPct,
    maxPct: hit.band.maxPct,
    ...(hit.tickOffset !== undefined ? { tickOffset: hit.tickOffset } : {}),
    ...(hit.critEligible === false ? { critEligible: false } : {}),
    ...(hit.dot ? { dot: true } : {}),
    ...(hit.bleedId ? { bleedId: hit.bleedId } : {}),
  };
}

describe("MELEE_ABILITIES source table", () => {
  it("covers every catalogue entry exactly once", () => {
    const live = MELEE_ABILITIES.map((a) => a.id).sort();
    const expected = EXPECTED.map((r) => r.id).sort();
    expect(live).toEqual(expected);
  });

  it.each(EXPECTED)(
    "$id bands / hits / adren / CD / charges / weapon / group / support",
    (row) => {
      const ability = MELEE_ABILITIES.find((a) => a.id === row.id);
      expect(ability, row.id).toBeDefined();
      const a = ability!;

      expect(a.hits).toHaveLength(row.hitCount);
      expect(a.hits.map(hitRow)).toEqual(row.bands);

      expect(a.channelTicks).toBe(row.channelTicks);
      expect(a.adrenaline?.gain).toBe(row.adrenGain);
      expect(a.adrenaline?.cost).toBe(row.adrenCost);
      expect(a.cooldownSeconds).toBe(row.cooldownSeconds);
      expect(a.charges).toEqual(row.charges);
      expect(a.weaponRequirement).toBe(row.weaponRequirement);
      expect(a.replacementGroup).toBe(row.replacementGroup);
      expect(a.supportStatus).toBe(row.supportStatus);
      expect(a.bloodlustGain).toBe(row.bloodlustGain);
    },
  );
});

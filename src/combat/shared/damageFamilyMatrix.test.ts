import { describe, expect, it } from "vitest";
import {
  capabilitiesOf,
  type DamageCapabilities,
  type DamageProvenance,
  type DamageProvenanceKind,
} from "./damageProvenance";

/**
 * Producer -> capability matrix.
 * Rows are event families (producers); columns are capabilitiesOf gates + event-level notes.
 * Every capability cell is asserted explicitly (no implicit default / partial row).
 */

type CapKey = keyof DamageCapabilities;

const CAP_KEYS: CapKey[] = [
  "onHitGear",
  "blessingOnHit",
  "canTriggerProcs",
  "canGenerateResources",
  "canApplyAbyssalParasite",
  "canCrit",
  "recursiveDamage",
  "blessingRider",
  "prayerMods",
  "playerAttack",
  "directHit",
];

interface FamilyRow {
  id: string;
  /** Expected provenance kind for this producer. */
  kind: DamageProvenanceKind;
  /** Optional detail pattern on scheduled/resolved events (not used by capabilitiesOf). */
  detailPattern?: RegExp | string;
  expectedCaps: DamageCapabilities;
  /**
   * Event-level: separate hit counter / multiplicity.
   * false for attached riders (Searing Winds, Big Boned, Cinders rider).
   * Inferno is a separate chance-weighted blessing hit (true).
   */
  countsAsSeparateHit: boolean;
  /**
   * Event-level documentation only (not a CAPS field).
   * true for bleed family ticks that write bleedId state.
   */
  canAddBleedState: boolean;
  /** Attached component of parent hit (not its own queue event). */
  attached?: boolean;
  note?: string;
}

const fullPlayerDirect: DamageCapabilities = {
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
};

const playerDotCaps: DamageCapabilities = {
  playerAttack: true,
  directHit: false,
  onHitGear: false,
  blessingRider: true,
  blessingOnHit: false,
  canCrit: false,
  canGenerateResources: false,
  canTriggerProcs: true,
  recursiveDamage: false,
  prayerMods: false,
  canApplyAbyssalParasite: false,
};

const inventionProcCaps: DamageCapabilities = {
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
};

const equipmentProcCaps: DamageCapabilities = {
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
};

const blessingCaps: DamageCapabilities = {
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
};

const conjureSpiritCaps: DamageCapabilities = {
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
};

/** Producer families -> expected kind + full capability row + event-level flags. */
const FAMILIES: FamilyRow[] = [
  {
    id: "ordinary_direct_hit",
    kind: "player_direct",
    expectedCaps: fullPlayerDirect,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "channel",
    kind: "player_direct",
    expectedCaps: fullPlayerDirect,
    countsAsSeparateHit: true,
    canAddBleedState: false,
    note: "Ordinary channel hits stay player_direct (not DoT family).",
  },
  {
    id: "bleed",
    kind: "player_dot",
    detailPattern: /bleed|dismember|slaughter|massacre|blood_tendrils|fragmentation|corruption/,
    expectedCaps: playerDotCaps,
    countsAsSeparateHit: true,
    canAddBleedState: true,
  },
  {
    id: "burn",
    kind: "player_dot",
    detailPattern: "burn",
    expectedCaps: playerDotCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "bloat_tail",
    kind: "derived_tail",
    detailPattern: "bloat",
    expectedCaps: {
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
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "death_skulls",
    kind: "derived_bounce",
    detailPattern: /death_skulls/,
    expectedCaps: {
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
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "crackling",
    kind: "invention_proc",
    detailPattern: "crackling",
    expectedCaps: inventionProcCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "aftershock",
    kind: "invention_proc",
    detailPattern: "aftershock",
    expectedCaps: inventionProcCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "searing_winds",
    kind: "attached",
    detailPattern: "searing_winds",
    expectedCaps: {
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
    countsAsSeparateHit: false,
    canAddBleedState: false,
    attached: true,
    note: "Attached component of parent hit; not a separate hit counter.",
  },
  {
    id: "abyssal_parasite",
    kind: "equipment_proc",
    detailPattern: "abyssal_parasite",
    expectedCaps: equipmentProcCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
    note: "Parasite damage ticks; stacks gated by canApplyAbyssalParasite on parent land.",
  },
  {
    id: "conjure_auto",
    kind: "conjure_auto",
    detailPattern: /skeleton_warrior|vengeful_ghost|putrid_zombie/,
    expectedCaps: conjureSpiritCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "putrid_poison",
    kind: "conjure_poison",
    detailPattern: "putrid_zombie",
    expectedCaps: conjureSpiritCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "command",
    kind: "conjure_command",
    expectedCaps: {
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
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "big_boned",
    kind: "blessing",
    detailPattern: "big-boned",
    expectedCaps: blessingCaps,
    countsAsSeparateHit: false,
    canAddBleedState: false,
    attached: true,
  },
  {
    id: "cinders",
    kind: "blessing",
    detailPattern: "abyssal-cinders",
    expectedCaps: blessingCaps,
    countsAsSeparateHit: false,
    canAddBleedState: false,
    attached: true,
    note: "Abyssal Cinders rider (attached).",
  },
  {
    id: "inferno",
    kind: "blessing",
    detailPattern: "inferno-of-zamorak",
    expectedCaps: blessingCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
    attached: false,
    note: "Inferno of Zamorak: chance-weighted separate blessing hit.",
  },
  {
    id: "striking_light",
    kind: "blessing",
    detailPattern: "light-of-saradomin",
    expectedCaps: blessingCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
    attached: false,
  },
  {
    id: "lightning_surge",
    kind: "equipment_proc",
    detailPattern: "lightning_surge",
    expectedCaps: equipmentProcCaps,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "converted_channel",
    kind: "player_converted_channel",
    expectedCaps: {
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
    countsAsSeparateHit: true,
    canAddBleedState: false,
    note: "Endless Assault converted channel: DoT family for gear, keeps prayer/crit.",
  },
];

function provenanceFor(row: FamilyRow): DamageProvenance {
  if (row.detailPattern == null) return { kind: row.kind };
  if (typeof row.detailPattern === "string") {
    return { kind: row.kind, detail: row.detailPattern };
  }
  // Regex detail: pick a representative literal for the kind (caps ignore detail).
  const sample =
    row.id === "bleed"
      ? "bleed"
      : row.id === "death_skulls"
        ? "death_skulls"
        : row.id === "conjure_auto"
          ? "skeleton_warrior"
          : row.id;
  return { kind: row.kind, detail: sample };
}

describe("damage family matrix (producer -> capabilitiesOf)", () => {
  it("matrix covers required producer families", () => {
    const ids = new Set(FAMILIES.map((r) => r.id));
    for (const required of [
      "ordinary_direct_hit",
      "channel",
      "bleed",
      "burn",
      "bloat_tail",
      "death_skulls",
      "crackling",
      "aftershock",
      "searing_winds",
      "abyssal_parasite",
      "conjure_auto",
      "putrid_poison",
      "command",
      "big_boned",
      "cinders",
      "inferno",
      "striking_light",
      "lightning_surge",
      "converted_channel",
    ]) {
      expect(ids.has(required), `missing family row ${required}`).toBe(true);
    }
  });

  it("column set matches DamageCapabilities keys", () => {
    const sample = capabilitiesOf({ kind: "player_direct" });
    expect(Object.keys(sample).sort()).toEqual([...CAP_KEYS].sort());
  });

  for (const row of FAMILIES) {
    describe(row.id, () => {
      it(`capabilitiesOf(${row.kind}) matches every column cell`, () => {
        const actual = capabilitiesOf(provenanceFor(row));
        for (const key of CAP_KEYS) {
          expect(actual[key], `${row.id}.${key}`).toBe(row.expectedCaps[key]);
        }
        expect(actual).toMatchObject(row.expectedCaps);
      });

      it("documents event-level separate-hit / bleed-state flags", () => {
        // countsAsSeparateHit: false only for attached riders (SW, BB, Cinders).
        if (row.attached === true) {
          expect(row.countsAsSeparateHit, `${row.id} attached => not separate`).toBe(false);
        }
        if (row.id === "searing_winds" || row.id === "big_boned") {
          expect(row.countsAsSeparateHit).toBe(false);
          expect(row.attached).toBe(true);
        }
        // canAddBleedState is documentation only; true solely for bleed family.
        if (row.id === "bleed") {
          expect(row.canAddBleedState).toBe(true);
        } else {
          expect(row.canAddBleedState, `${row.id} must not claim canAddBleedState`).toBe(false);
        }
      });

      const detailPattern = row.detailPattern;
      if (detailPattern != null) {
        it("detail pattern matches representative producer detail", () => {
          const p = provenanceFor(row);
          expect(p.detail).toBeDefined();
          if (typeof detailPattern === "string") {
            expect(p.detail).toBe(detailPattern);
          } else {
            expect(p.detail).toMatch(detailPattern);
          }
        });
      }
    });
  }

  it("attached riders never count as separate hits (product law)", () => {
    const attached = FAMILIES.filter((r) => r.attached === true);
    expect(attached.map((r) => r.id).sort()).toEqual(
      ["big_boned", "cinders", "searing_winds"].sort(),
    );
    for (const r of attached) {
      expect(r.countsAsSeparateHit).toBe(false);
    }
  });

  it("inferno and striking_light are separate blessing hits (not attached)", () => {
    for (const id of ["inferno", "striking_light"] as const) {
      const row = FAMILIES.find((r) => r.id === id)!;
      expect(row.kind).toBe("blessing");
      expect(row.attached).toBe(false);
      expect(row.countsAsSeparateHit).toBe(true);
    }
  });
});

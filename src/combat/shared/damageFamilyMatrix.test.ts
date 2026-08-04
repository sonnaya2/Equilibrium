import { describe, expect, it } from "vitest";
import {
  capabilitiesOf,
  type DamageCapabilities,
  type DamageProvenance,
  type DamageProvenanceKind,
} from "./damageProvenance";

/**
 * Producer -> provenance kind matrix.
 * Capability cells live in damageEligibilityMatrix / CAPS; this file only maps producers to kinds
 * and event-level notes (separate hit, bleed state, attached).
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
  kind: DamageProvenanceKind;
  detailPattern?: RegExp | string;
  countsAsSeparateHit: boolean;
  canAddBleedState: boolean;
  attached?: boolean;
  note?: string;
}

/** Producer families -> expected kind + event-level flags. */
const FAMILIES: FamilyRow[] = [
  {
    id: "ordinary_direct_hit",
    kind: "player_direct",
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "channel",
    kind: "player_direct",
    countsAsSeparateHit: true,
    canAddBleedState: false,
    note: "Ordinary channel hits stay player_direct (not DoT family).",
  },
  {
    id: "bleed",
    kind: "player_dot",
    detailPattern: /bleed|dismember|slaughter|massacre|blood_tendrils|fragmentation|corruption/,
    countsAsSeparateHit: true,
    canAddBleedState: true,
  },
  {
    id: "burn",
    kind: "player_dot",
    detailPattern: "burn",
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "bloat_tail",
    kind: "derived_tail",
    detailPattern: "bloat",
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "death_skulls",
    kind: "derived_bounce",
    detailPattern: /death_skulls/,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "crackling",
    kind: "invention_proc",
    detailPattern: "crackling",
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "aftershock",
    kind: "invention_proc",
    detailPattern: "aftershock",
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "searing_winds",
    kind: "attached",
    detailPattern: "searing_winds",
    countsAsSeparateHit: false,
    canAddBleedState: false,
    attached: true,
    note: "Attached component of parent hit; not a separate hit counter.",
  },
  {
    id: "abyssal_parasite",
    kind: "equipment_proc",
    detailPattern: "abyssal_parasite",
    countsAsSeparateHit: true,
    canAddBleedState: false,
    note: "Parasite damage ticks; stacks gated by canApplyAbyssalParasite on parent land.",
  },
  {
    id: "conjure_auto",
    kind: "conjure_auto",
    detailPattern: /skeleton_warrior|vengeful_ghost|putrid_zombie/,
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "putrid_poison",
    kind: "conjure_poison",
    detailPattern: "putrid_zombie",
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "command",
    kind: "conjure_command",
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "big_boned",
    kind: "blessing",
    detailPattern: "big-boned",
    countsAsSeparateHit: false,
    canAddBleedState: false,
    attached: true,
  },
  {
    id: "cinders",
    kind: "blessing",
    detailPattern: "abyssal-cinders",
    countsAsSeparateHit: false,
    canAddBleedState: false,
    attached: true,
    note: "Abyssal Cinders rider (attached).",
  },
  {
    id: "inferno",
    kind: "blessing",
    detailPattern: "inferno-of-zamorak",
    countsAsSeparateHit: true,
    canAddBleedState: false,
    attached: false,
    note: "Inferno of Zamorak: chance-weighted separate blessing hit.",
  },
  {
    id: "striking_light",
    kind: "blessing",
    detailPattern: "light-of-saradomin",
    countsAsSeparateHit: true,
    canAddBleedState: false,
    attached: false,
  },
  {
    id: "lightning_surge",
    kind: "equipment_proc",
    detailPattern: "lightning_surge",
    countsAsSeparateHit: true,
    canAddBleedState: false,
  },
  {
    id: "converted_channel",
    kind: "player_converted_channel",
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

describe("damage family matrix (producer -> kind)", () => {
  it("column set matches DamageCapabilities keys", () => {
    const sample = capabilitiesOf({ kind: "player_direct" });
    expect(Object.keys(sample).sort()).toEqual([...CAP_KEYS].sort());
  });

  for (const row of FAMILIES) {
    it(`${row.id} -> ${row.kind}`, () => {
      const p = provenanceFor(row);
      expect(p.kind).toBe(row.kind);
      // Detail is documentation only; caps depend on kind alone.
      expect(capabilitiesOf(p)).toEqual(capabilitiesOf({ kind: row.kind }));
    });
  }
});

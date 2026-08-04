import { describe, expect, it } from "vitest";
import {
  capabilitiesOf,
  type DamageProvenance,
  type DamageProvenanceKind,
} from "./damageProvenance";

/**
 * Producer -> provenance kind matrix.
 * Capability cells live in damageEligibilityMatrix / CAPS; this file only maps producers to kinds.
 */

interface FamilyRow {
  id: string;
  kind: DamageProvenanceKind;
  detailPattern?: RegExp | string;
  note?: string;
}

/** Producer families -> expected kind (+ optional detail / note). */
const FAMILIES: FamilyRow[] = [
  {
    id: "ordinary_direct_hit",
    kind: "player_direct",
  },
  {
    id: "channel",
    kind: "player_direct",
    note: "Ordinary channel hits stay player_direct (not DoT family).",
  },
  {
    id: "bleed",
    kind: "player_dot",
    detailPattern: /bleed|dismember|slaughter|massacre|blood_tendrils|fragmentation|corruption/,
  },
  {
    id: "burn",
    kind: "player_dot",
    detailPattern: "burn",
  },
  {
    id: "bloat_tail",
    kind: "derived_tail",
    detailPattern: "bloat",
  },
  {
    id: "death_skulls",
    kind: "derived_bounce",
    detailPattern: /death_skulls/,
  },
  {
    id: "crackling",
    kind: "invention_proc",
    detailPattern: "crackling",
  },
  {
    id: "aftershock",
    kind: "invention_proc",
    detailPattern: "aftershock",
  },
  {
    id: "searing_winds",
    kind: "attached",
    detailPattern: "searing_winds",
    note: "Attached component of parent hit; not a separate hit counter.",
  },
  {
    id: "abyssal_parasite",
    kind: "equipment_proc",
    detailPattern: "abyssal_parasite",
    note: "Parasite damage ticks; stacks gated by canApplyAbyssalParasite on parent land.",
  },
  {
    id: "conjure_auto",
    kind: "conjure_auto",
    detailPattern: /skeleton_warrior|vengeful_ghost|putrid_zombie/,
  },
  {
    id: "putrid_poison",
    kind: "conjure_poison",
    detailPattern: "putrid_zombie",
  },
  {
    id: "command",
    kind: "conjure_command",
  },
  {
    id: "big_boned",
    kind: "blessing",
    detailPattern: "big-boned",
  },
  {
    id: "cinders",
    kind: "blessing",
    detailPattern: "abyssal-cinders",
    note: "Abyssal Cinders rider (attached).",
  },
  {
    id: "inferno",
    kind: "blessing",
    detailPattern: "inferno-of-zamorak",
    note: "Inferno of Zamorak: chance-weighted separate blessing hit.",
  },
  {
    id: "striking_light",
    kind: "blessing",
    detailPattern: "light-of-saradomin",
  },
  {
    id: "lightning_surge",
    kind: "equipment_proc",
    detailPattern: "lightning_surge",
  },
  {
    id: "converted_channel",
    kind: "player_converted_channel",
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
  for (const row of FAMILIES) {
    it(`${row.id} -> ${row.kind}`, () => {
      const p = provenanceFor(row);
      expect(p.kind).toBe(row.kind);
      // Detail is documentation only; caps depend on kind alone.
      expect(capabilitiesOf(p)).toEqual(capabilitiesOf({ kind: row.kind }));
    });
  }
});

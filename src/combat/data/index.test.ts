import { describe, expect, it } from "vitest";
import { isRegionId } from "../../league";
import {
  abilitiesByRegion,
  abilitiesByStyle,
  abilityById,
  combatAbilities,
  combatEffects,
  combatEquipment,
  combatPerks,
  combatPrayers,
  combatRevolutionBars,
  combatSyncFacts,
  recordsByRegion,
} from "./index";
import type { CombatDataset, RevolutionBarRecord } from "./records";

const datasets: Array<[string, CombatDataset<{ id: string; sources: { verifiedAt: string }[] }>]> = [
  ["abilities", combatAbilities],
  ["effects", combatEffects],
  ["equipment", combatEquipment],
  ["perks", combatPerks],
  ["prayers", combatPrayers],
];

const CORE_BAR_IDS = [
  "melee-dual-wield",
  "melee-two-handed",
  "ranged",
  "magic",
  "necromancy",
] as const;

const ENGINE_IDS = new Set([
  "attack",
  "ranged_attack",
  "magic_attack",
  "necromancy_basic",
  "volley_of_souls",
]);

function bars(): RevolutionBarRecord[] {
  return combatRevolutionBars.records;
}

function regionsOf(id: string): string[] {
  return combatEquipment.records.find((r) => r.id === id)?.unlock?.regions ?? [];
}

const equipmentIds = new Set(combatEquipment.records.map((record) => record.id));

describe("canonical combat datasets", () => {
  it("every dataset has unique ids, provenance, and post-2024 tracking", () => {
    for (const [kind, dataset] of datasets) {
      const seen = new Set<string>();
      for (const record of dataset.records) {
        expect(seen.has(record.id), `${kind} duplicate id ${record.id}`).toBe(false);
        seen.add(record.id);
        expect(record.sources.length, `${kind}/${record.id} has no SourceReference`).toBeGreaterThan(0);
        for (const source of record.sources) {
          expect(source.verifiedAt, `${kind}/${record.id} source missing verifiedAt`).toMatch(
            /^\d{4}-\d{2}-\d{2}$/,
          );
        }
      }
      expect(dataset.trackedSince, kind).toBe("2024-03-04");
      expect(dataset.records.length, kind).toBeGreaterThan(0);
    }
  });

  it("unlock regions on every dataset are valid League region ids", () => {
    for (const [kind, dataset] of datasets) {
      for (const record of dataset.records) {
        for (const region of (record as { unlock?: { regions?: string[] } }).unlock?.regions ?? []) {
          expect(isRegionId(region), `${kind}/${record.id} tags unknown region ${region}`).toBe(true);
        }
      }
    }
  });

  it("ability effect references resolve to effect records", () => {
    const effectIds = new Set(combatEffects.records.map((record) => record.id));
    for (const record of combatAbilities.records) {
      for (const effectId of record.effects ?? []) {
        expect(effectIds.has(effectId), `${record.id} references missing effect ${effectId}`).toBe(
          true,
        );
      }
    }
  });

  it("pins basic adrenaline and its named exceptions", () => {
    expect(abilityById("melee:dismember")?.adrenaline).toEqual({ kind: "gain", percent: 0 });
    expect(abilityById("melee:adaptive-strike")?.adrenaline).toEqual({ kind: "gain", percent: 12 });
    expect(abilityById("melee:chaos-roar")?.adrenaline).toEqual({ kind: "gain", percent: 9 });
    expect(abilityById("melee:chaos-roar")?.category).toBe("basic");
    expect(abilityById("melee:punish")?.category).toBe("basic");
    expect(abilityById("ranged:ricochet")?.adrenaline).toEqual({ kind: "gain", percent: 9 });
    expect(abilityById("magic:runic-charge")?.adrenaline).toBeUndefined();
  });

  it("keeps the Infernal Fire grant as Avernic Star data only", () => {
    const star = combatEquipment.records.find((record) => record.id === "item:avernic-star");
    expect(star).toMatchObject({
      name: "Avernic Star",
      slot: "pocket",
      style: "hybrid",
      bonuses: { damage: 18.7, prayer: 15 },
    });
    expect(star?.passiveId).toBeUndefined();
    expect(star?.passiveIds).toBeUndefined();
    expect(star?.mechanicalImplementation).toBeUndefined();
  });
});

describe("combat data accessors", () => {
  it("finds records by id", () => {
    expect(abilityById("melee:rend")?.name).toBe("Rend");
    expect(abilityById("nope:nothing")).toBeUndefined();
  });

  it("filters abilities by style", () => {
    const ranged = abilitiesByStyle("ranged");
    expect(ranged.length).toBeGreaterThan(0);
    expect(ranged.every((record) => record.style === "ranged")).toBe(true);
  });

  it("filters by region: only records tagged with that region (empty ≠ global)", () => {
    const misthalin = abilitiesByRegion("misthalin");
    const locked = abilitiesByRegion("misthalin", { regionLockedOnly: true });
    expect(locked.some((record) => record.id === "magic:greater-sonic-wave")).toBe(true);
    expect(locked.every((record) => record.unlock?.regions.includes("misthalin"))).toBe(true);
    expect(misthalin.map((r) => r.id).sort()).toEqual(locked.map((r) => r.id).sort());
    expect(
      recordsByRegion(combatAbilities.records, "kandarin", { regionLockedOnly: true }).map((r) => r.id),
    ).toContain("ranged:deaths-swiftness");
    expect(
      recordsByRegion(combatAbilities.records, "anachronia", { regionLockedOnly: true }).map(
        (r) => r.id,
      ),
    ).not.toContain("ranged:deaths-swiftness");
  });

  it("reports sync facts per dataset", () => {
    const facts = combatSyncFacts();
    expect(facts).toHaveLength(6);
    expect(facts.every((fact) => fact.records > 0 && fact.lastSynced)).toBe(true);
  });

  it("revolution bars resolve slots to records or engine ids, never invented ids", () => {
    const recordIds = new Set(combatAbilities.records.map((record) => record.id));
    for (const bar of combatRevolutionBars.records) {
      expect(bar.revolutionSize).toBeGreaterThanOrEqual(1);
      for (const slot of bar.slots) {
        if (slot.abilityId === null) continue;
        expect(recordIds.has(slot.abilityId) || ENGINE_IDS.has(slot.abilityId)).toBe(true);
      }
    }
    const necro = combatRevolutionBars.records.find((bar) => bar.id === "necromancy");
    expect(necro).toBeTruthy();
    if (necro?.supported) {
      expect(necro.slots.every((s) => s.abilityId != null)).toBe(true);
    } else {
      expect(necro?.unsupportedReason).toBeTruthy();
    }
  });

  it("prayer catalogue covers all three books with the codex overlay merged", () => {
    const books = new Set(combatPrayers.records.map((record) => record.book));
    expect(books).toEqual(new Set(["standard", "ancient", "seren"]));
    const ruination = combatPrayers.records.find((record) => record.id === "curse:ruination");
    expect(ruination?.level).toBe(99);
    expect(ruination?.unlock?.type).toBe("drop");
    expect(combatPrayers.records.filter((record) => record.name === "Ruination")).toHaveLength(1);
  });
});

/**
 * BiS / ladder region pins. One contract, many rows - each row is a distinct item→region ruling.
 * Family bulk (illuminated books, dracolich, deathwarden/dealer) is covered below as set rules.
 */
const REGION_CONTAINS: Array<[string, string]> = [
  ["item:drygore-mace", "desert"],
  ["item:drygore-rapier", "desert"],
  ["item:drygore-longsword", "desert"],
  ["item:off-hand-drygore-mace", "desert"],
  ["item:off-hand-drygore-rapier", "desert"],
  ["item:off-hand-drygore-longsword", "desert"],
  ["item:noxious-scythe", "morytania"],
  ["item:noxious-longbow", "morytania"],
  ["item:noxious-staff", "morytania"],
  ["item:seren-godbow", "desert"],
  ["item:zaros-godsword", "desert"],
  ["item:torva-full-helm", "asgarnia"],
  ["item:bandos-chestplate", "asgarnia"],
  ["item:cinderbane-gloves", "tirannwn"],
  ["item:essence-of-finality", "asgarnia"],
  ["item:eldritch-crossbow", "forinthry"],
  ["item:chaotic-rapier", "forinthry"],
  ["item:ascension-crossbow", "kandarin"],
  ["item:blightbound-crossbow", "tirannwn"],
  ["item:seismic-wand", "asgarnia"],
  ["item:luck-of-the-dwarves", "misthalin"],
  ["item:reaper-necklace", "misthalin"],
  ["item:amulet-of-souls", "misthalin"],
  ["item:ring-of-death", "misthalin"],
  ["item:deathguard-t90", "misthalin"],
  ["item:skull-lantern-t90", "misthalin"],
  ["item:jaws-of-the-abyss", "misthalin"],
  ["item:max-cape", "misthalin"],
  ["item:apex-hide-body", "havenhythe"],
  ["item:stalker-arrows", "forinthry"],
  ["item:off-hand-dragon-claw", "misthalin"],
  ["item:seasingers-hood", "asgarnia"],
  ["item:ruinous-rapier", "forinthry"],
  ["item:lava-whip", "forinthry"],
  ["item:dragon-rider-amulet", "misthalin"],
  ["item:spear-of-annihilation", "kandarin"],
  ["item:fire-cape", "karamja"],
  ["item:berserker-ring", "fremennik"],
  ["item:dragon-defender", "asgarnia"],
  ["item:abyssal-whip", "morytania"],
  ["item:dark-bow", "tirannwn"],
  ["item:hand-cannon", "fremennik"],
  ["item:achto-teralith-cuirass", "desert"],
  ["item:teralith-cuirass", "desert"],
  ["item:goliath-gloves", "desert"],
  ["item:razorback-gauntlets", "desert"],
  ["item:staff-of-light", "fremennik"],
  ["item:gemstone-helm", "karamja"],
  ["item:strykebow", "forinthry"],
  ["item:deathdealer-hood-t90", "misthalin"],
  ["item:occultists-ring", "anachronia"],
  ["item:ring-of-vigour", "forinthry"],
];

describe("equipment BiS region tags", () => {
  it("pins listed BiS items to their unlock region", () => {
    for (const [id, region] of REGION_CONTAINS) {
      if (!equipmentIds.has(id)) continue;
      expect(regionsOf(id), id).toContain(region);
    }
  });

  it("illuminated books are desert-only", () => {
    const books = combatEquipment.records.filter((r) => r.id.startsWith("item:illuminated-book-"));
    expect(books.length).toBeGreaterThan(0);
    for (const r of books) {
      expect(regionsOf(r.id), r.id).toContain("desert");
      expect(regionsOf(r.id), r.id).not.toContain("misthalin");
      expect(regionsOf(r.id), r.id).not.toContain("fremennik");
    }
  });

  it("dracolich pieces are forinthry-only", () => {
    const pieces = combatEquipment.records.filter((r) => r.id.includes("dracolich"));
    expect(pieces.length).toBeGreaterThan(0);
    for (const r of pieces) {
      expect(regionsOf(r.id), r.id).toContain("forinthry");
      expect(regionsOf(r.id), r.id).not.toContain("misthalin");
    }
  });

  it("deathwarden and deathdealer ladders are misthalin", () => {
    const ladder = combatEquipment.records.filter(
      (r) => r.id.startsWith("item:deathwarden") || r.id.startsWith("item:deathdealer"),
    );
    expect(ladder.length).toBeGreaterThan(0);
    for (const r of ladder) {
      expect(regionsOf(r.id), r.id).toContain("misthalin");
    }
  });

  it("hand-cannon is fremennik, not forinthry", () => {
    const regions = regionsOf("item:hand-cannon");
    expect(regions).toContain("fremennik");
    expect(regions).not.toContain("forinthry");
  });

  it("masterwork-ranged-body multi-region MW ruling", () => {
    const regions = regionsOf("item:masterwork-ranged-body");
    expect(regions).toEqual(["asgarnia", "tirannwn", "anachronia"]);
    expect(
      combatEquipment.records.find((r) => r.id === "item:masterwork-ranged-body")?.unlock?.requirement,
    ).toContain("Wilderness*");
  });

  it("masterwork-magic-hat contains asgarnia and desert", () => {
    const regions = regionsOf("item:masterwork-magic-hat");
    expect(regions).toEqual(expect.arrayContaining(["asgarnia", "desert"]));
  });

  it("has no bare deathdealer t70 residual", () => {
    const bareT70 = combatEquipment.records.filter(
      (r) =>
        r.id.startsWith("item:deathdealer") &&
        (r.id.includes("-t70") ||
          r.id.endsWith("-70") ||
          /deathdealer-(hood|robe|gloves|boots|leggings)?$/.test(r.id)),
    );
    expect(bareT70.map((r) => r.id), "bare or t70 deathdealer should be removed").toEqual([]);
  });

  it("deathguard ladder is misthalin t90 only — no base/t70/t80 residual", () => {
    const deathguard = combatEquipment.records.filter((r) => r.id.includes("deathguard"));
    expect(deathguard.map((r) => r.id).sort(), "only deathguard-t90 should remain").toEqual(
      equipmentIds.has("item:deathguard-t90") ? ["item:deathguard-t90"] : [],
    );
    for (const r of deathguard) {
      expect(regionsOf(r.id), r.id).toContain("misthalin");
      expect(regionsOf(r.id), r.id).not.toContain("forinthry");
    }
    expect(equipmentIds.has("item:deathguard")).toBe(false);
    expect(equipmentIds.has("item:deathguard-t70")).toBe(false);
    expect(equipmentIds.has("item:deathguard-t80")).toBe(false);
  });
});

describe("revolution bar contract", () => {
  it("keeps the core single-target Revo++ bar ids", () => {
    const ids = new Set(bars().map((bar) => bar.id));
    for (const id of CORE_BAR_IDS) {
      expect(ids.has(id), `missing core bar ${id}`).toBe(true);
    }
  });

  it("every abilityId is null or a combat ability / engine id (no invented refs)", () => {
    const recordIds = new Set(combatAbilities.records.map((record) => record.id));
    for (const bar of bars()) {
      for (const slot of bar.slots) {
        if (slot.abilityId === null) continue;
        expect(
          recordIds.has(slot.abilityId) || ENGINE_IDS.has(slot.abilityId),
          `${bar.id} slot ${slot.name} -> ${slot.abilityId}`,
        ).toBe(true);
      }
    }
  });

  it("every bar has a valid target, mode, and single-target catalogue", () => {
    for (const bar of bars()) {
      expect(["single", "multi"], `${bar.id} target`).toContain(bar.target);
      expect(["revo++", "hybrid", "basics"], `${bar.id} mode`).toContain(bar.mode);
      expect(bar.target, bar.id).toBe("single");
    }
  });

  it("revo++ and basics bars have slots.length >= revolutionSize", () => {
    for (const bar of bars()) {
      if (bar.mode === "hybrid") continue;
      expect(
        bar.slots.length,
        `${bar.id}: slots ${bar.slots.length} < revolutionSize ${bar.revolutionSize}`,
      ).toBeGreaterThanOrEqual(bar.revolutionSize);
    }
  });
});

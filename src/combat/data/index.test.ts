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

function bars(): RevolutionBarRecord[] {
  return combatRevolutionBars.records;
}

describe("canonical combat datasets", () => {
  it.each(datasets)("%s: unique ids, provenance on every record", (_kind, dataset) => {
    const seen = new Set<string>();
    for (const record of dataset.records) {
      expect(seen.has(record.id), `duplicate id ${record.id}`).toBe(false);
      seen.add(record.id);
      expect(record.sources.length, `${record.id} has no SourceReference`).toBeGreaterThan(0);
      for (const source of record.sources) {
        expect(source.verifiedAt, `${record.id} source missing verifiedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
    expect(dataset.trackedSince).toBe("2024-03-04");
    expect(dataset.records.length).toBeGreaterThan(0);
  });

  it.each(datasets)("%s: unlock regions are valid League region ids", (_kind, dataset) => {
    for (const record of dataset.records) {
      for (const region of (record as { unlock?: { regions?: string[] } }).unlock?.regions ?? []) {
        expect(isRegionId(region), `${record.id} tags unknown region ${region}`).toBe(true);
      }
    }
  });

  it("ability effect references resolve to effect records", () => {
    const effectIds = new Set(combatEffects.records.map((record) => record.id));
    for (const record of combatAbilities.records) {
      for (const effectId of record.effects ?? []) {
        expect(effectIds.has(effectId), `${record.id} references missing effect ${effectId}`).toBe(true);
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
    // regionLockedOnly is retained for API compat but empty regions are never implied global.
    expect(misthalin.map((r) => r.id).sort()).toEqual(locked.map((r) => r.id).sort());
    expect(
      recordsByRegion(combatAbilities.records, "kandarin", { regionLockedOnly: true }).map((r) => r.id),
    ).toContain("ranged:deaths-swiftness");
    expect(
      recordsByRegion(combatAbilities.records, "anachronia", { regionLockedOnly: true }).map((r) => r.id),
    ).not.toContain("ranged:deaths-swiftness");
  });

  it("reports sync facts per dataset", () => {
    const facts = combatSyncFacts();
    expect(facts).toHaveLength(6);
    expect(facts.every((fact) => fact.records > 0 && fact.lastSynced)).toBe(true);
  });

  it("revolution bars resolve slots to records or engine ids, never invented ids", () => {
    const ENGINE_IDS = new Set(["attack", "ranged_attack", "magic_attack", "necromancy_basic", "volley_of_souls"]);
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

function regionsOf(id: string): string[] {
  return combatEquipment.records.find((r) => r.id === id)?.unlock?.regions ?? [];
}

const equipmentIds = new Set(combatEquipment.records.map((record) => record.id));

describe("equipment BiS region tags", () => {
  const DRYGORE_IDS = [
    "item:drygore-mace",
    "item:drygore-rapier",
    "item:drygore-longsword",
    "item:off-hand-drygore-mace",
    "item:off-hand-drygore-rapier",
    "item:off-hand-drygore-longsword",
  ] as const;

  it.each(DRYGORE_IDS)("%s includes desert", (id) => {
    expect(regionsOf(id), id).toContain("desert");
  });

  it.each([
    "item:noxious-scythe",
    "item:noxious-longbow",
    "item:noxious-staff",
  ] as const)("%s includes morytania", (id) => {
    expect(regionsOf(id), id).toContain("morytania");
  });

  it.each(["item:seren-godbow", "item:zaros-godsword"] as const)("%s includes desert", (id) => {
    expect(regionsOf(id), id).toContain("desert");
  });

  it("item:torva-full-helm includes asgarnia", () => {
    expect(regionsOf("item:torva-full-helm")).toContain("asgarnia");
  });

  it("item:bandos-chestplate includes asgarnia", () => {
    expect(regionsOf("item:bandos-chestplate")).toContain("asgarnia");
  });

  it("item:cinderbane-gloves includes tirannwn", () => {
    expect(regionsOf("item:cinderbane-gloves")).toContain("tirannwn");
  });

  it("item:essence-of-finality includes asgarnia", () => {
    expect(regionsOf("item:essence-of-finality")).toContain("asgarnia");
  });

  it("item:eldritch-crossbow includes forinthry", () => {
    expect(regionsOf("item:eldritch-crossbow")).toContain("forinthry");
  });

  it("item:chaotic-rapier includes forinthry", () => {
    expect(regionsOf("item:chaotic-rapier")).toContain("forinthry");
  });

  it("item:ascension-crossbow includes kandarin", () => {
    expect(regionsOf("item:ascension-crossbow")).toContain("kandarin");
  });

  it("item:blightbound-crossbow includes tirannwn", () => {
    expect(regionsOf("item:blightbound-crossbow")).toContain("tirannwn");
  });

  it("item:seismic-wand includes asgarnia", () => {
    expect(regionsOf("item:seismic-wand")).toContain("asgarnia");
  });

  it.each([
    "item:luck-of-the-dwarves",
    "item:reaper-necklace",
    "item:amulet-of-souls",
    "item:ring-of-death",
    "item:deathguard-t90",
    "item:skull-lantern-t90",
    "item:jaws-of-the-abyss",
    "item:max-cape",
  ] as const)("%s includes misthalin", (id) => {
    expect(regionsOf(id), id).toContain("misthalin");
  });

  it.each(
    combatEquipment.records
      .filter((r) => r.id.startsWith("item:illuminated-book-"))
      .map((r) => r.id),
  )("%s is desert-only (illuminated books)", (id) => {
    const regions = regionsOf(id);
    expect(regions, id).toContain("desert");
    expect(regions, id).not.toContain("misthalin");
    expect(regions, id).not.toContain("fremennik");
  });

  it("item:hand-cannon is fremennik (not forinthry)", () => {
    const regions = regionsOf("item:hand-cannon");
    expect(regions).toContain("fremennik");
    expect(regions).not.toContain("forinthry");
  });

  it("item:apex-hide-body includes havenhythe", () => {
    expect(regionsOf("item:apex-hide-body")).toContain("havenhythe");
  });

  it("item:masterwork-ranged-body multi-region MW ruling", () => {
    const regions = regionsOf("item:masterwork-ranged-body");
    expect(regions).toEqual(["asgarnia", "tirannwn", "anachronia"]);
    expect(combatEquipment.records.find((r) => r.id === "item:masterwork-ranged-body")?.unlock?.requirement).toContain("Wilderness*");
  });

  it("item:masterwork-magic-hat contains asgarnia and desert", () => {
    const regions = regionsOf("item:masterwork-magic-hat");
    expect(regions).toEqual(expect.arrayContaining(["asgarnia", "desert"]));
  });

  it("item:stalker-arrows includes forinthry", () => {
    expect(regionsOf("item:stalker-arrows")).toContain("forinthry");
  });

  it("item:off-hand-dragon-claw includes misthalin", () => {
    expect(regionsOf("item:off-hand-dragon-claw")).toContain("misthalin");
  });

  it("item:seasingers-hood includes asgarnia", () => {
    expect(regionsOf("item:seasingers-hood")).toContain("asgarnia");
  });

  it.each([
    "item:ruinous-rapier",
    "item:lava-whip",
  ] as const)("%s includes forinthry", (id) => {
    expect(regionsOf(id), id).toContain("forinthry");
  });

  it("item:dragon-rider-amulet includes misthalin", () => {
    expect(regionsOf("item:dragon-rider-amulet")).toContain("misthalin");
  });

  it("item:spear-of-annihilation includes kandarin", () => {
    expect(regionsOf("item:spear-of-annihilation")).toContain("kandarin");
  });

  const PASS3_REGION_PINS: Array<[string, string]> = [
    ["item:fire-cape", "karamja"],
    ["item:berserker-ring", "fremennik"],
    ["item:dragon-defender", "asgarnia"],
    ["item:abyssal-whip", "morytania"],
    ["item:dark-bow", "tirannwn"],
    ["item:hand-cannon", "fremennik"],
  ];
  const pass3Cases: Array<[string, string]> = [
    ...PASS3_REGION_PINS.filter(([id]) => equipmentIds.has(id)),
    ...combatEquipment.records
      .filter((r) => r.id.startsWith("item:deathwarden"))
      .map((r): [string, string] => [r.id, "misthalin"]),
    ...combatEquipment.records
      .filter((r) => r.id.startsWith("item:deathdealer"))
      .map((r): [string, string] => [r.id, "misthalin"]),
  ];
  it.each(pass3Cases)("%s includes %s (pass3)", (id, region) => {
    expect(regionsOf(id), id).toContain(region);
  });

  it.each([
    "item:achto-teralith-cuirass",
    "item:teralith-cuirass",
    "item:goliath-gloves",
  ] as const)("%s includes desert", (id) => {
    expect(regionsOf(id), id).toContain("desert");
  });

  const PASS5_6_REGION_PINS: Array<[string, string]> = [
    ["item:razorback-gauntlets", "desert"],
    ["item:illuminated-book-of-law", "desert"],
    ["item:hand-cannon", "fremennik"],
    ["item:staff-of-light", "fremennik"],
    ["item:gemstone-helm", "karamja"],
    ["item:strykebow", "forinthry"],
    ["item:deathguard-t90", "misthalin"],
    ["item:deathdealer-hood-t90", "misthalin"],
  ];
  const pass5_6Cases = PASS5_6_REGION_PINS.filter(([id]) => equipmentIds.has(id));
  it.each(pass5_6Cases)("%s includes %s (pass5+6)", (id, region) => {
    expect(regionsOf(id), id).toContain(region);
  });

  it("has no bare deathdealer t70 residual (pass5+6)", () => {
    const bareT70 = combatEquipment.records.filter(
      (r) =>
        r.id.startsWith("item:deathdealer") &&
        (r.id.includes("-t70") || r.id.endsWith("-70") || /deathdealer-(hood|robe|gloves|boots|leggings)?$/.test(r.id)),
    );
    expect(
      bareT70.map((r) => r.id),
      "bare or t70 deathdealer should be removed",
    ).toEqual([]);
  });

  const PASS6_7_REGION_PINS: Array<[string, string]> = [
    ["item:dracolich-helm", "forinthry"],
    ["item:dracolich-body", "forinthry"], // hauberk
    ["item:dracolich-legs", "forinthry"],
    ["item:dracolich-gloves", "forinthry"],
    ["item:dracolich-boots", "forinthry"],
    ["item:elite-dracolich-helm", "forinthry"],
    ["item:elite-dracolich-body", "forinthry"], // elite hauberk
    ["item:elite-dracolich-legs", "forinthry"],
    ["item:elite-dracolich-gloves", "forinthry"],
    ["item:elite-dracolich-boots", "forinthry"],
    ["item:deathguard-t90", "misthalin"],
    ["item:fire-cape", "karamja"],
    ["item:occultists-ring", "anachronia"],
    ["item:ring-of-vigour", "forinthry"],
    ["item:razorback-gauntlets", "desert"],
    ["item:illuminated-book-of-law", "desert"],
    ["item:illuminated-book-of-war", "desert"],
    ["item:illuminated-book-of-chaos", "desert"],
    ["item:illuminated-book-of-wisdom", "desert"],
    ["item:illuminated-book-of-balance", "desert"],
    ["item:hand-cannon", "fremennik"],
  ];
  const pass6_7Cases = PASS6_7_REGION_PINS.filter(([id]) => equipmentIds.has(id));
  it.each(pass6_7Cases)("%s includes %s (pass6+7)", (id, region) => {
    expect(regionsOf(id), id).toContain(region);
  });

  it("deathguard ladder is misthalin t90 only — no base/t70/t80 residual (pass6+7)", () => {
    const deathguard = combatEquipment.records.filter((r) => r.id.includes("deathguard"));
    expect(
      deathguard.map((r) => r.id).sort(),
      "only deathguard-t90 should remain",
    ).toEqual(equipmentIds.has("item:deathguard-t90") ? ["item:deathguard-t90"] : []);
    for (const r of deathguard) {
      expect(regionsOf(r.id), r.id).toContain("misthalin");
      expect(regionsOf(r.id), r.id).not.toContain("forinthry");
    }
    expect(equipmentIds.has("item:deathguard")).toBe(false);
    expect(equipmentIds.has("item:deathguard-t70")).toBe(false);
    expect(equipmentIds.has("item:deathguard-t80")).toBe(false);
  });

  it.each(
    combatEquipment.records
      .filter((r) => r.id.includes("dracolich"))
      .map((r) => r.id),
  )("%s is forinthry-only (pass6+7 dracolich)", (id) => {
    const regions = regionsOf(id);
    expect(regions, id).toContain("forinthry");
    expect(regions, id).not.toContain("misthalin");
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
    const ENGINE_IDS = new Set(["attack", "ranged_attack", "magic_attack", "necromancy_basic", "volley_of_souls"]);
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

  it("every bar has a valid target", () => {
    for (const bar of bars()) {
      expect(["single", "multi"], `${bar.id} target`).toContain(bar.target);
    }
  });

  it("every bar has a valid mode", () => {
    for (const bar of bars()) {
      expect(["revo++", "hybrid", "basics"], `${bar.id} mode`).toContain(bar.mode);
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

  it("catalogue is single-target only", () => {
    for (const bar of bars()) {
      expect(bar.target, bar.id).toBe("single");
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
import { presentContentRewards } from "@/lib/dataContentPresentation";
import { dataEntityIconPath } from "@/lib/gameArt";
import { contentRewardsFull } from "@/lib/researchRewards";
import {
  getResearchCatalog,
  type ResearchCatalog,
  type ResearchRegion,
  type ResearchTrainingMethod,
} from "./catalog";

type SeedCatalog = Omit<ResearchCatalog, "regions"> & {
  regions: Array<
    Omit<ResearchRegion, "training"> & {
      trainingMethodIds: string[];
    }
  >;
};

// The catalog document, rebuilt from the canonical provenance files rather than
// from the database: its skeleton with every record written back over its own
// record path. Record paths sort parent-before-child, because a parent's path is
// a prefix of its children's, so a nested record lands inside the parent body
// that was just restored. Reading the JSONL directly is what keeps this an
// independent check on the normalized tables.
//
// Content/upgrades membership follows research/region-entries.jsonl (same as
// getResearchCatalog). Provenance source_records for unlinked faces stay for
// audit after unlink-research-entry + remove.
const CATALOG_FILE = "data/research/catalog.json";
const canonical = (name: string): Array<Record<string, unknown>> =>
  readFileSync(join(process.cwd(), "data/canonical/provenance", name), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

type RegionEntry = {
  entityId: string;
  regionId: string;
  section: string;
  ordinal: number;
};

function reconstructCatalog(): SeedCatalog {
  const document = canonical("source-documents.jsonl").find(({ path }) => path === CATALOG_FILE);
  if (!document) throw new Error(`Canonical provenance is missing ${CATALOG_FILE}`);
  const catalog = structuredClone(document.skeleton) as Record<string, unknown>;
  const records = canonical("source-records.jsonl")
    .filter(({ sourceFile }) => sourceFile === CATALOG_FILE)
    .sort((a, b) => String(a.recordPath).localeCompare(String(b.recordPath), "en"));
  if (!records.length) throw new Error(`Canonical provenance holds no ${CATALOG_FILE} records`);
  // entityId → preferred body. When set-record re-homes a face, stale paths for the
  // same entity may still exist in provenance for audit; path-sort last-write would
  // re-apply the pre-rehome body. Prefer the path that matches live region-entries.
  const bodiesByEntity = new Map<string, Array<{ path: string; record: unknown }>>();
  for (const { recordPath, record, entityId } of records) {
    const tokens = [...String(recordPath).matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)].map((match) =>
      match[1] === undefined ? Number(match[2]) : match[1],
    );
    let target = catalog as Record<string | number, unknown>;
    for (const token of tokens.slice(0, -1))
      target = target[token] as Record<string | number, unknown>;
    target[tokens.at(-1)!] = record;
    if (
      typeof entityId === "string" &&
      entityId &&
      /\.(content|upgrades)\[\d+\]$/.test(String(recordPath))
    ) {
      const list = bodiesByEntity.get(entityId) ?? [];
      list.push({ path: String(recordPath), record });
      bodiesByEntity.set(entityId, list);
    }
  }

  const regionEntries = readFileSync(
    join(process.cwd(), "data/canonical/research/region-entries.jsonl"),
    "utf8",
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RegionEntry);

  const regionOrdinalById = new Map(
    ((catalog as unknown as SeedCatalog).regions ?? []).map((region, index) => [region.id, index]),
  );

  const byRegionSection = new Map<string, RegionEntry[]>();
  for (const entry of regionEntries) {
    if (entry.section !== "content" && entry.section !== "upgrades") continue;
    const key = `${entry.regionId}|${entry.section}`;
    const list = byRegionSection.get(key) ?? [];
    list.push(entry);
    byRegionSection.set(key, list);
  }

  const pickBody = (entry: RegionEntry): unknown => {
    const candidates = bodiesByEntity.get(entry.entityId) ?? [];
    if (!candidates.length) return undefined;
    const regionOrdinal = regionOrdinalById.get(entry.regionId);
    if (regionOrdinal !== undefined) {
      const expected = `$.regions[${regionOrdinal}].${entry.section}[${entry.ordinal}]`;
      const exact = candidates.find((c) => c.path === expected);
      if (exact) return exact.record;
      // Same region+section, any ordinal (re-index) beats a foreign-region stale path.
      const sameHome = candidates.find((c) =>
        c.path.startsWith(`$.regions[${regionOrdinal}].${entry.section}[`),
      );
      if (sameHome) return sameHome.record;
    }
    // Last resort: last path-sorted candidate (stable with prior behaviour).
    return [...candidates].sort((a, b) => a.path.localeCompare(b.path, "en")).at(-1)?.record;
  };

  for (const region of (catalog as unknown as SeedCatalog).regions) {
    for (const section of ["content", "upgrades"] as const) {
      const faces = (byRegionSection.get(`${region.id}|${section}`) ?? [])
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((entry) => pickBody(entry))
        .filter((row): row is NonNullable<typeof row> => row != null);
      (region as Record<string, unknown>)[section] = faces;
    }
  }

  return catalog as unknown as SeedCatalog;
}

const catalogSeed = reconstructCatalog();

const methods = new Map<string, ResearchTrainingMethod>(
  catalogSeed.skills.flatMap((skill) => skill.methods.map((method) => [method.id, method])),
);
const catalogSource: ResearchCatalog = {
  ...catalogSeed,
  regions: catalogSeed.regions.map(({ trainingMethodIds, ...region }) => ({
    ...region,
    training: trainingMethodIds
      .map((id) => methods.get(id))
      .filter((method): method is ResearchTrainingMethod => Boolean(method)),
  })),
};

describe("research catalog", () => {
  it("reconstructs the immutable catalog exactly from normalized SQLite tables", () => {
    expect(getResearchCatalog()).toEqual(catalogSource);
  });

  it("has 11 regions whose ids match REGION_IDS", () => {
    const catalog = getResearchCatalog();
    expect(catalog.regions).toHaveLength(11);
    expect(catalog.datasets.regions).toBe(11);
    expect(catalog.regions.map((r) => r.id).sort()).toEqual([...REGION_IDS].sort());
  });

  it("derives dataset counts from live arrays", () => {
    const catalog = getResearchCatalog();
    const methodCount = catalogSource.skills.reduce((n, skill) => n + skill.methods.length, 0);
    expect(catalog.datasets.regions).toBe(11);
    expect(catalog.datasets.regions).toBe(catalog.regions.length);
    expect(catalog.datasets.skills).toBe(catalog.skills.length);
    expect(catalog.datasets.trainingMethods).toBe(methodCount);
    expect(catalog.datasets.trainingMethods).toBe(
      new Set(catalogSource.skills.flatMap((skill) => skill.methods.map((m) => m.id))).size,
    );
  });

  it("resolves every region trainingMethodId (no orphans)", () => {
    const methodIds = new Set(
      catalogSource.skills.flatMap((skill) => skill.methods.map((m) => m.id)),
    );
    const orphans: string[] = [];
    for (const region of catalogSeed.regions) {
      for (const id of region.trainingMethodIds) {
        if (!methodIds.has(id)) orphans.push(`${region.id}:${id}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it("shows region combos in every required region", () => {
    const misthalin = getResearchCatalog().regions.find((region) => region.id === "misthalin");
    const pouch = misthalin?.upgrades.find((upgrade) =>
      upgrade.name.startsWith("Expansive essence pouch"),
    );
    expect(pouch?.requiredRegions).toEqual(["misthalin", "forinthry"]);
  });

  it("normalizes structured Wiki XP rates", () => {
    const divination = catalogSource.skills.find((skill) => skill.id === "divination");
    expect(divination?.methods.find((method) => method.method === "Pale wisps")?.xpRate).toBe(
      "4,000–5,000 XP/h",
    );
    expect(
      divination?.methods.find(
        (method) => method.method === "Gate of Elidinis corrupt shard cleansing",
      )?.xpRate,
    ).toBe("285,000 XP/h at 99");
  });

  it("lists Asgarnia / Karamja / Forinthry content majors", () => {
    const catalog = catalogSource.regions;
    const asg = catalog.find((r) => r.id === "asgarnia");
    const kar = catalog.find((r) => r.id === "karamja");
    const for_ = catalog.find((r) => r.id === "forinthry");
    expect(asg && kar && for_).toBeTruthy();

    const asgNames = new Set((asg?.content ?? []).map((c) => c.name));
    for (const name of [
      "Invention Guild",
      "Mining Guild",
      "Warriors' Guild",
      "Artisans' Workshop",
      "Port Sarim docks and skilling hub",
      "The Arc",
      "Elite Dungeon 1",
      "Starbloom armour",
      "Praesul codex",
      "Scrimshaws",
      "Ports armour",
      "Nex",
      "Nex: Angel of Death",
      "Falador farm allotment / flower / herb patches",
    ]) {
      expect(asgNames.has(name), `asgarnia missing ${name}`).toBe(true);
    }
    const nexIdx = asg?.content.findIndex((row) => row.name === "Nex") ?? -1;
    const aodIdx = asg?.content.findIndex((row) => row.name === "Nex: Angel of Death") ?? -1;
    expect(aodIdx).toBe(nexIdx + 1);
    expect(asgNames.has("Rimmington Construction supply loop")).toBe(false);
    expect(asgNames.has("Player-owned port")).toBe(false);
    expect(asgNames.has("God Wars Dungeon 1")).toBe(false);

    const asgUpgradeNames = new Set((asg?.upgrades ?? []).map((upgrade) => upgrade.name));
    const removedAsgarniaPois = [
      "Bandos equipment (GWD1 melee power ladder)",
      "Essence of Finality amulet (neck BiS chain)",
      "Essence of Finality ornament kit (style bonus)",
      "Familiarisation (weekly triple-charm D&D)",
      "Flash Powder Factory Herblore outfits",
      "Games necklace teleport package",
      "God Wars Dungeon 1 (+ Nex)",
      "God Wars Dungeon 1 equipment",
      "Godswords (GWD1 hilt + shard assembly)",
      "Herb patch network (global herb-run map)",
      "Hops patch network (Entrana + run geography)",
      "Invention Guild named machine room",
      "Invention machines (Invention Guild + Fort Workshop power)",
      "Large Summoning obelisk production network",
      "Magic golem outfit",
      "Masterwork melee plate / glorious-bar smithing chain",
      "Masterwork Spear of Annihilation",
      "Mining Guild metal-bank smithing loop",
      "Mining Guild resource dungeon",
      "Modified blacksmith's helmet",
      "Modified botanist's mask",
      "Nex equipment",
      "Nex T80 power armour (Torva / Pernix / Virtus)",
      "Nex: Angel of Death progression",
      "Ore box tier upgrades",
      "Partial potion producer / DX (Invention Guild)",
      "Pernix armour",
      "Pikkupstix Summoning shop and large obelisk (Taverley)",
      "Plank maker / high capacity plank maker (Invention Guild)",
      "Player-owned house Aquarium and Prawnbroker",
      "Player-owned house portal towns and Construction utilities",
      "Player-owned ports skilling rewards (Asgarnia Arc mapping)",
      "Ports Reward Shop (Boni Waiko) permanent scrolls + trade-goods access",
      "POH gilded altar (Chapel offering)",
      "Praesul codex style curses (Malevolence / Desolation / Affliction / Ruination)",
      "Rogue equipment",
      "Rogue equipment (Flash Powder Factory rubble)",
      "Rogues' Den banking, safes, and Thieving",
      "Saradomin godsword special (heal switch)",
      "Scrimshaw Crafter (Player-owned port workshop)",
      "Scrimshaw of sacrifice (+ superior POP upgrade)",
      "Scrimshaw of the elements",
      "Scroll of cleansing + herb bag + botanist/factory Herblore stack",
      "Seasinger (Ports / Arc)",
      "Silverhawk boots (Agility XP from feathers/down)",
      "Skilling scrimshaw craft package (Player-owned port)",
      "Sojobo Arc contracts hub (Waiko)",
      "Taverley / Burthorpe early–mid skilling hub",
      "Temple of Aminishi (ED1)",
      "Thaler skilling rewards hub (Stanley Limelight Traders)",
      "The Arc skilling destinations (Equilibrium Asgarnia mapping)",
      "The Arc Waiko reward shop (chime economy)",
      "Toolbelt attach: Seedicide",
      "Torva armour and praesulic essence (melee)",
      "Trimmed / custom-fit trimmed masterwork melee armour",
      "Turael / Spria (Burthorpe starter Slayer Masters)",
      "Turtling perk (tank gizmo)",
      "Virtus equipment and Praesulic essence",
      "Vorago",
      "Vorago progression",
      "Waiko commodity sell permanent upgrades",
      "Waiko contracts-per-day permanent upgrades",
      "Waiko grill (permanent Arc Cooking station)",
      "Waiko uncharted supplies permanent upgrades (cap + cost)",
      "Whale's Maw campfire + deposit box permanent unlocks",
      "Wicked hood (Runecrafting talisman storage + altar teleports)",
    ];
    for (const name of removedAsgarniaPois) {
      expect(asgUpgradeNames.has(name), `asgarnia still lists ${name}`).toBe(false);
    }
    expect(
      asg?.upgrades.filter(
        (upgrade) =>
          upgrade.name !== "Invention Guild" &&
          /machine/i.test(`${upgrade.name} ${upgrade.category}`),
      ),
    ).toEqual([]);
    expect([...asgUpgradeNames].filter((name) => name.startsWith("Nex: Angel of Death"))).toEqual([
      "Nex: Angel of Death",
    ]);
    expect([...asgUpgradeNames].filter((name) => /scrimshaw/i.test(name))).toEqual([]);
    expect([...asgUpgradeNames].filter((name) => /^Vorago(?: progression)?$/.test(name))).toEqual(
      [],
    );
    expect(
      asg?.upgrades.find((upgrade) => upgrade.name === "Custom-fit trimmed masterwork"),
    ).toMatchObject({
      requiredRegions: ["asgarnia", "morytania"],
      regionRequirementType: "all_required",
    });

    const misthalin = catalog.find((region) => region.id === "misthalin");
    for (const name of [
      "Amulet of souls",
      "Deathtouch bracelet",
      "Essence of Finality amulet",
      "Reaper necklace",
      "Ring of death",
    ]) {
      expect(
        misthalin?.upgrades.some((upgrade) => upgrade.name === name),
        `misthalin missing ${name}`,
      ).toBe(true);
      expect(
        asg?.upgrades.some((upgrade) => upgrade.name.startsWith(name)),
        `asgarnia still lists ${name}`,
      ).toBe(false);
    }

    const nex = asg?.content.find((row) => row.name === "Nex");
    const nexRewards = presentContentRewards(contentRewardsFull(nex!, asg!.upgrades), 5);
    expect(nexRewards.icons.map((icon) => icon.label)).toEqual([
      "Torva armour",
      "Pernix armour",
      "Virtus armour",
      "Zaryte bow",
    ]);

    const flashPowder = asg?.content.find(
      (row) => row.name === "Flash Powder Factory minigame and reward shop",
    );
    expect(contentRewardsFull(flashPowder!, asg!.upgrades)).toBe(
      "Botanist's outfit, Factory outfit, Rogue equipment",
    );

    const praesul = asg?.content.find((row) => row.name === "Praesul codex");
    expect(contentRewardsFull(praesul!, asg!.upgrades)).toBe(
      "Praesul codex, Malevolence, Desolation, Affliction, Ruination",
    );

    const scrimshaws = asg?.content.find((row) => row.name === "Scrimshaws");
    expect(
      presentContentRewards(contentRewardsFull(scrimshaws!, asg!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual([
      "Scrimshaw of cruelty",
      "Scrimshaw of the elements",
      "Scrimshaw of vampyrism",
      "Scrimshaw of sacrifice",
      "Gem-finding scrimshaw",
    ]);

    const portsArmour = asg?.content.find((row) => row.name === "Ports armour");
    expect(
      presentContentRewards(contentRewardsFull(portsArmour!, asg!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Tetsu armour", "Death Lotus armour", "Seasinger's robes"]);

    const vorago = asg?.content.filter((row) => row.name === "Vorago");
    expect(vorago).toHaveLength(1);
    expect(contentRewardsFull(vorago![0]!, asg!.upgrades)).toBe(
      "Seismic wand, Seismic singularity, Tectonic energy",
    );

    expect(asg?.upgrades.find((row) => row.name === "Royal crossbow")).toMatchObject({
      category: "Tier 80 two-handed crossbow",
      detail: "Completed from the four royal components dropped by the Queen Black Dragon",
    });
    expect(asg?.upgrades.find((row) => row.name === "Shard of the Lumberjack")?.detail).toContain(
      "Hatchet of ember and glade",
    );
    expect(asg?.upgrades.find((row) => row.name === "Living Rock Caverns")?.detail).toContain(
      "Rocktail",
    );

    const queenBlackDragon = asg?.content.find((row) => row.name === "Queen Black Dragon");
    expect(queenBlackDragon).toMatchObject({
      kind: "Boss",
    });
    expect(asg?.upgrades.some((row) => row.name === "Queen Black Dragon")).toBe(false);
    // Row well is the boss plate; dragon kiteshield stays a reward chip only.
    expect(dataEntityIconPath({ name: queenBlackDragon?.name, kind: queenBlackDragon?.kind })).toBe(
      "/game/bosses/queen-black-dragon.webp",
    );
    expect(contentRewardsFull(queenBlackDragon!, asg!.upgrades)).toMatch(/Dragon kiteshield|Royal/i);

    const dwarfMulticannon = asg?.content.find((row) => row.name === "Dwarf multicannon");
    expect(dwarfMulticannon).toBeTruthy();
    expect(contentRewardsFull(dwarfMulticannon!, asg!.upgrades)).toMatch(
      /Dwarf multicannon.*Golden Cannon.*Royale Cannon.*Restocking Cannon.*Kinetic cyclone.*Oldak coil.*Dwarven siege engine/i,
    );
    expect(
      presentContentRewards(contentRewardsFull(dwarfMulticannon!, asg!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(
      expect.arrayContaining([
        "Dwarf multicannon",
        "Golden Cannon",
        "Royale Cannon",
        "Kinetic cyclone",
        "Oldak coil",
        "Dwarven siege engine",
      ]),
    );
    expect(asg?.upgrades.find((row) => row.name === "Dwarf multicannon")?.detail).toMatch(
      /Unlocks:.*Golden Cannon.*Kinetic cyclone.*Oldak coil/i,
    );

    const karNames = new Set((kar?.content ?? []).map((c) => c.name));
    for (const name of [
      "Herblore Habitat",
      "Nature altar",
      "Jadinko Lair",
      "Brimhaven Agility Arena",
      "Calquat tree patch",
      "Fruit tree patch",
      "Karamja overgrown idols",
      "Obsidian armour",
      "Duradel",
      "TzHaar Fight Cave",
      "Fight Kiln",
      "Hardwood Grove",
      "Tai Bwo Wannai Cleanup",
      "Shilo Village gem mine and Gemstone cavern",
    ]) {
      expect(karNames.has(name), `karamja missing ${name}`).toBe(true);
    }

    const forNames = new Set((for_?.content ?? []).map((c) => c.name));
    for (const name of [
      "Mage Arena",
      "Charming moths",
      "Daemonheim Dig Site",
      "Corporeal Beast",
      "Chaos Elemental",
      "Wilderness Agility Course",
      "Abyss Runecrafting",
      "Bloodweed & aggression potions",
      "Wilderness Slayer",
      "Chaotic weapons",
      "Ruinous weapons",
      "Dark facets",
      "Brawling gloves",
      "Daemonheim Rewards shop",
      "Magic axe hut chest",
      "Bandit Camp shops",
      "Infernal Puzzle Box",
    ]) {
      expect(forNames.has(name), `forinthry missing ${name}`).toBe(true);
    }

    for (const region of [asg!, kar!, for_!]) {
      for (const row of region.content) {
        expect(row.source?.url, `${region.id}/${row.name}`).toBeTruthy();
      }
    }
  });

  it("consolidates Kandarin hubs, outfits, and Legends' Guild recharge", () => {
    const catalog = catalogSource.regions;
    const kandarin = catalog.find((region) => region.id === "kandarin");
    const asgarnia = catalog.find((region) => region.id === "asgarnia");
    expect(kandarin && asgarnia).toBeTruthy();

    for (const name of [
      "Kuradal",
      "Manor Farm",
      "Seer's headband",
      "Enhanced Excalibur",
      "Eternal magic trees",
      "Enhanced nightmare gauntlets",
      "Nihils",
      "Thalmund's Forge",
      "Warforge Dig Site",
    ]) {
      expect(
        kandarin?.content.filter((row) => row.name === name),
        `kandarin missing or duplicated ${name}`,
      ).toHaveLength(1);
    }
    const warIdx = kandarin?.content.findIndex((row) => row.name === "Warforge Dig Site") ?? -1;
    const thalIdx = kandarin?.content.findIndex((row) => row.name === "Thalmund's Forge") ?? -1;
    expect(thalIdx).toBe(warIdx + 1);
    expect(
      kandarin?.content.some((row) => row.name === "Seers' Village"),
      "kandarin still lists Seers' Village content hub",
    ).toBe(false);

    for (const name of [
      "Ardougne farming patches and Manor Farm access geography",
      "Catherby fishing and farming hub",
      "Fishing Guild",
      "Kuradal's Dungeon and ferocious ring hub",
      "Manor Farm (Farming Guild) and reputation rewards",
      "Manor Farm animal perks",
      "Player-Owned Farm / Manor Farm",
    ]) {
      expect(
        kandarin?.content.some((row) => row.name === name),
        `kandarin still lists content ${name}`,
      ).toBe(false);
    }

    for (const name of [
      "Ardougne farming patches and Manor Farm access geography",
      "Catherby fishing and farming hub",
      "Farmers' Market and master farmer outfit",
      "Ferocious ring",
      "Fish Flingers (Isla Anglerine D&D)",
      "Fishing Guild",
      "Kuradal (Ancient Cavern Slayer Master)",
      "Kuradal's Dungeon and ferocious ring hub",
      "Manor Farm (Farming Guild) and reputation rewards",
      "Master farmer outfit",
      "Oo'glog spa pools (As a First Resort)",
      "Player-Owned Farm",
      "Seer's headband",
      "Seers' Village combat achievement rewards",
      "Seers' Village skilling hub",
      "Shark / fury shark fishing outfits",
      "Skillchompa supply hub (wild + PoF ladder)",
      "Skillchompas",
      "Skills necklace (guild teleports)",
      "Sous chef's outfit",
      "Spottier cape (Hunter weight-reduction cape)",
    ]) {
      expect(
        kandarin?.upgrades.some((row) => row.name === name),
        `kandarin still lists POI ${name}`,
      ).toBe(false);
    }

    const kuradal = kandarin?.content.find((row) => row.name === "Kuradal");
    expect(contentRewardsFull(kuradal!, kandarin!.upgrades)).toBe(
      "Slayer points, Kuradal's Dungeon, Ferocious ring",
    );

    const manorFarm = kandarin?.content.find((row) => row.name === "Manor Farm");
    expect(
      presentContentRewards(contentRewardsFull(manorFarm!, kandarin!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Master farmer outfit", "Beans", "Skillchompas", "NopeNopeNope", "Advance Time"]);

    const seersHeadband = kandarin?.content.find((row) => row.name === "Seer's headband");
    expect(
      presentContentRewards(contentRewardsFull(seersHeadband!, kandarin!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Seer's headband 4"]);
    expect(dataEntityIconPath({ name: seersHeadband?.name, kind: seersHeadband?.kind })).toBe(
      "/game/upgrades/permanent-unlocks/seers-headband-4.webp",
    );

    const enhancedExcalibur = kandarin?.content.find((row) => row.name === "Enhanced Excalibur");
    expect(
      presentContentRewards(contentRewardsFull(enhancedExcalibur!, kandarin!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Enhanced Excalibur"]);
    expect(
      dataEntityIconPath({ name: enhancedExcalibur?.name, kind: enhancedExcalibur?.kind }),
    ).toMatch(/\/enhanced-excalibur\.webp$/);

    const enhancedNightmare = kandarin?.content.find(
      (row) => row.name === "Enhanced nightmare gauntlets",
    );
    expect(enhancedNightmare, "kandarin major: Enhanced nightmare gauntlets").toBeTruthy();
    expect(contentRewardsFull(enhancedNightmare!, kandarin!.upgrades)).toMatch(
      /Enhanced nightmare gauntlets/i,
    );
    expect(
      presentContentRewards(contentRewardsFull(enhancedNightmare!, kandarin!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Enhanced nightmare gauntlets"]);
    expect(
      dataEntityIconPath({ name: enhancedNightmare?.name, kind: enhancedNightmare?.kind }),
    ).toBe("/game/combat/equipment/enhanced-nightmare-gauntlets.webp");
    expect(
      kandarin?.upgrades.some((row) => row.name === "Enhanced nightmare gauntlets"),
    ).toBe(true);

    const eternalMagic = kandarin?.content.find((row) => row.name === "Eternal magic trees");
    expect(contentRewardsFull(eternalMagic!, kandarin!.upgrades)).toMatch(
      /Eternal magic logs.*Eternal magic planks.*3x faster XP\/h than mahogany/i,
    );
    expect(
      presentContentRewards(contentRewardsFull(eternalMagic!, kandarin!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Eternal magic logs", "Eternal magic planks"]);
    expect(dataEntityIconPath({ name: eternalMagic?.name, kind: eternalMagic?.kind })).toMatch(
      /eternal-magic-(trees|logs)\.(webp|png)$/,
    );

    const nihils = kandarin?.content.find((row) => row.name === "Nihils");
    expect(contentRewardsFull(nihils!, kandarin!.upgrades)).toBe(
      "Blood nihil, Ice nihil, Shadow nihil, Smoke nihil",
    );
    const nihilRewards = presentContentRewards(
      contentRewardsFull(nihils!, kandarin!.upgrades),
      8,
    );
    expect(nihilRewards.tokens).toEqual([
      "Blood nihil",
      "Ice nihil",
      "Shadow nihil",
      "Smoke nihil",
    ]);
    // Only blood-nihil.webp is catalogued; other styles share the major face icon.
    expect(nihilRewards.icons.map((icon) => icon.label)).toEqual(["Blood nihil"]);
    expect(dataEntityIconPath({ name: nihils?.name, kind: nihils?.kind })).toMatch(
      /blood-nihil\.(webp|png)$/,
    );

    expect(kandarin?.upgrades.find((row) => row.name === "Diviner's outfit")?.detail).toContain(
      "modified headwear",
    );
    expect(
      kandarin?.upgrades.find((row) => row.name === "Gnome Restaurant and sous chef's outfit")
        ?.detail,
    ).toContain("modified toque");

    expect(
      kandarin?.upgrades.find((row) => row.name === "Legends' Guild totem jewellery recharge"),
    ).toMatchObject({
      category: "Jewellery recharge",
      detail: "The Legends' Guild totem recharges skills necklaces and combat bracelets",
      requiredRegions: ["kandarin"],
    });
    expect(asgarnia?.upgrades.some((row) => row.name === "Combat bracelet")).toBe(false);
  });

  it("consolidates Fremennik majors and removes duplicate POIs", () => {
    const fremennik = catalogSource.regions.find((region) => region.id === "fremennik");
    expect(fremennik).toBeTruthy();

    for (const name of [
      "Lunar Isle",
      "Livid Farm",
      "Penguin Agility Course",
      "Blast Furnace",
      "Sparkling wisp colony",
      "Dagannoth Kings",
      "Keldagrim",
      "Lava Flow Mine",
      "Neitiznot yaks",
      "Ungael",
    ]) {
      expect(
        fremennik?.content.filter((row) => row.name === name),
        `fremennik missing or duplicated ${name}`,
      ).toHaveLength(1);
    }

    const ungael = fremennik?.content.find((row) => row.name === "Ungael");
    expect(ungael).toMatchObject({
      kind: "Necromancy / combat island",
    });
    expect(dataEntityIconPath({ name: ungael?.name, kind: ungael?.kind })).toMatch(
      /\/(activities\/ungael|upgrades\/permanent-unlocks\/ungael)\.(webp|png)$/,
    );

    for (const name of [
      "Blast Furnace (Keldagrim)",
      "Keldagrim brewery (Laughing Miner Pub)",
      "Keldagrim dwarven hub",
      "Lava Flow Mine skilling unlocks",
      "Livid Farm Lunar spell unlocks",
      "Lunar Isle skilling hub",
      "Lunar spellbook and Lunar utility",
      "Neitiznot yak Crafting and Cooking loop",
      "Penguin Agility Course (Iceberg)",
      "Rellekka Fremennik hub",
    ]) {
      expect(
        fremennik?.content.some((row) => row.name === name),
        `fremennik still lists content ${name}`,
      ).toBe(false);
    }

    for (const name of [
      "Bake Pie (Lunar)",
      "Blast Furnace (Keldagrim)",
      "Cooking dual-brewery network (Keldagrim + Phasmatys)",
      "Dagannoth Kings",
      "Dagannoth Kings uniques",
      "Elite Fremennik combat rewards",
      "Elite skilling outfits core set (ironman fragment paths)",
      "Enchanted lyre",
      "Fremennik sea boots 1-4",
      "Humidify (Lunar)",
      "Keldagrim brewery (Laughing Miner Pub)",
      "Keldagrim dwarven hub",
      "Keldagrim dwarven traders and multi-step chests",
      "Lava Flow Mine skilling unlocks",
      "Lava geyser Imcando fragment path",
      "Liquid Gold Nymph golden mining suit path",
      "Livid Farm Lunar spell unlocks",
      "Lunar Isle skilling hub",
      "Lunar spellbook",
      "Lunar spellbook unlock",
      "Magic golem outfit",
      "Magic Imbue (Lunar)",
      "Make Leather (Lunar)",
      "Neitiznot yak Crafting and Cooking loop",
      "NPC Contact (Lunar)",
      "Penguin Agility Course (Iceberg)",
      "Plank Make (Lunar)",
      "Player-owned house Aquarium and Prawnbroker",
      "Rellekka Fremennik hub",
      "Repair Rune Pouch (Livid Farm Lunar)",
      "Sparkling wisp colony",
      "String Jewellery (Lunar)",
      "Superglass Make (Lunar)",
      "Telekinetic Grind (Lunar)",
      "Ungael ritual site pressure",
    ]) {
      expect(
        fremennik?.upgrades.some((row) => row.name === name),
        `fremennik still lists POI ${name}`,
      ).toBe(false);
    }

    expect(fremennik?.upgrades.filter((row) => row.name === "Hand cannon")).toHaveLength(1);
    expect(fremennik?.upgrades.filter((row) => row.name === "Fremennik sea boots")).toHaveLength(1);
    expect(fremennik?.upgrades.filter((row) => row.name === "Zorgoth's ring")).toHaveLength(1);
    expect(fremennik?.upgrades.filter((row) => row.name === "Ungael ritual site")).toHaveLength(1);
    expect(fremennik?.upgrades.find((row) => row.name === "Golden mining suit")?.detail).toBe(
      "The five-piece outfit grants 6% Mining XP and is awarded by the Liquid Gold Nymph",
    );

    const blastFurnace = fremennik?.content.find((row) => row.name === "Blast Furnace");
    expect(contentRewardsFull(blastFurnace!, fremennik!.upgrades)).toBe(
      "Blast fusion hammer, Coal-free bars, bank chest",
    );
    expect(
      presentContentRewards(contentRewardsFull(blastFurnace!, fremennik!.upgrades), 4).icons.map(
        (icon) => icon.label,
      ),
    ).toContain("Blast fusion hammer");
    expect(
      presentContentRewards(contentRewardsFull(blastFurnace!, fremennik!.upgrades), 4).icons.find(
        (icon) => icon.label === "Blast fusion hammer",
      )?.src,
    ).toMatch(/imcando-pickaxe\.(webp|png)$/);

    const lavaFlowMine = fremennik?.content.find((row) => row.name === "Lava Flow Mine");
    const lavaRewards = presentContentRewards(
      contentRewardsFull(lavaFlowMine!, fremennik!.upgrades),
      4,
    );
    expect(lavaRewards.icons.map((icon) => icon.label)).toEqual([
      "Golden mining suit",
      "Imcando pickaxe",
    ]);
    expect(lavaRewards.icons.find((icon) => icon.label === "Golden mining suit")?.src).toBe(
      "/game/upgrades/skilling-outfits/golden-mining-suit.webp",
    );
    expect(dataEntityIconPath({ name: "Golden mining suit" })).toBe(
      "/game/upgrades/skilling-outfits/golden-mining-suit.webp",
    );

    const sparkling = fremennik?.content.find((row) => row.name === "Sparkling wisp colony");
    expect(dataEntityIconPath({ name: sparkling?.name, kind: sparkling?.kind })).toBe(
      "/game/skills/divination.webp",
    );
  });

  it("keeps Desert POIs out of majors and lists Whirligigs instead", () => {
    const desert = catalogSource.regions.find((region) => region.id === "desert");
    expect(
      desert?.content.some((row) => row.name === "Sunken Pyramid / player-owned Slayer dungeon"),
    ).toBe(false);
    expect(desert?.content.some((row) => row.name === "Dundee's Crocodile Upgrades")).toBe(false);

    const whirligigs = desert?.content.filter((row) => row.name === "Whirligigs");
    expect(whirligigs).toHaveLength(1);
    expect(contentRewardsFull(whirligigs![0]!, desert!.upgrades)).toBe(
      "Dundee's Crocodile Upgrades",
    );

    const citharede = desert?.content.find((row) => row.name === "Citharede Abbey");
    expect(citharede).toMatchObject({ kind: "Quest / combat abilities" });
    expect(contentRewardsFull(citharede!, desert!.upgrades)).toMatch(
      /Sacrifice|Devotion|Transfigure|Illuminated god books/i,
    );
    expect(
      presentContentRewards(contentRewardsFull(citharede!, desert!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(
      expect.arrayContaining(["Sacrifice", "Devotion", "Transfigure", "Illuminated god books"]),
    );

    const sophanemDungeon = desert?.content.find(
      (row) => row.name === "Corrupted creatures & soul devourers",
    );
    expect(sophanemDungeon).toMatchObject({
      kind: "Slayer dungeon",
      detail: "Sophanem Slayer Dungeon for corrupted creatures and soul devourers.",
    });
    expect(contentRewardsFull(sophanemDungeon!, desert!.upgrades)).toBe(
      "Vital spark, Key to the Crossing, Corrupted gem, Corrupted magic logs",
    );
    expect(
      dataEntityIconPath({
        name: sophanemDungeon?.name,
        kind: sophanemDungeon?.kind,
      }),
    ).toBe("/game/upgrades/skilling-production/vital-spark.webp");
  });

  it("merges Anachronia Agility Course into one major", () => {
    const anachronia = catalogSource.regions.find((region) => region.id === "anachronia");
    const rows = [...(anachronia?.content ?? []), ...(anachronia?.upgrades ?? [])].filter((row) =>
      row.name.startsWith("Anachronia Agility"),
    );

    expect(rows).toEqual([
      expect.objectContaining({
        name: "Anachronia Agility Course",
        kind: "Agility course",
      }),
    ]);
    expect(
      [...(anachronia?.content ?? []), ...(anachronia?.upgrades ?? [])].filter(
        (row) => row.name === "Time altar" || row.name.startsWith("Time altar /"),
      ),
    ).toEqual([
      expect.objectContaining({
        name: "Time altar",
        kind: "Runecrafting altar",
      }),
    ]);
    expect(
      catalogSource.regions
        .flatMap((region) => [...region.content, ...region.upgrades])
        .some((row) => row.name === "Bait and Switch + Always Adze dual monolith skilling paths"),
    ).toBe(false);
    expect(anachronia?.upgrades.find((row) => row.name === "Dinosaur Farm animal buyers")).toEqual(
      expect.objectContaining({
        category: "Farming",
        detail:
          "Sell raised frogs, salamanders, jadinkos and dinosaurs for beans. Choose one small, medium and large buyer from the advertisement board",
      }),
    );
    const advanceTime = anachronia?.upgrades.find((row) => row.name === "Advance Time");
    expect(advanceTime).toMatchObject({
      category: "Dream of Iaia station restock spell",
      requiredRegions: ["anachronia"],
    });
    expect(advanceTime?.detail).toMatch(
      /Construction.*Crafting.*Fishing.*Fletching.*Herblore.*Hunter/i,
    );
    expect(contentRewardsFull(advanceTime!, anachronia!.upgrades)).toBe(
      "Construction, Crafting, Fishing, Fletching, Herblore, Hunter",
    );
    expect(dataEntityIconPath({ name: advanceTime?.name, kind: advanceTime?.category })).toMatch(
      /dream-of-iaia\.(webp|png)$/,
    );
    const dreamOfIaia = anachronia?.content.find((row) => row.name === "Dream of Iaia");
    expect(dreamOfIaia?.detail).toMatch(/Advance Time/i);
    expect(dreamOfIaia?.detail).toMatch(
      /Construction.*Crafting.*Fishing.*Fletching.*Herblore.*Hunter/i,
    );
    expect(
      anachronia?.upgrades.some((row) => row.name === "Artificer's measure component region map"),
    ).toBe(false);
    expect(
      anachronia?.upgrades.some((row) => row.name === "Essential oils (base-camp spa tier 3)"),
    ).toBe(false);
    expect(
      anachronia?.upgrades.some((row) => row.name === "Hunter Lodge (base-camp BGH permanent)"),
    ).toBe(false);
    expect(
      anachronia?.upgrades.some((row) => row.name === "Quick traps (BGH permanent trap speed)"),
    ).toBe(false);
    expect(anachronia?.upgrades.some((row) => row.name === "Ring of imbuing")).toBe(false);
    expect(anachronia?.upgrades.filter((row) => /Skeka.*hypnowand/i.test(row.name))).toEqual([
      expect.objectContaining({
        name: "Skeka's hypnowand",
        category: "Hunter skilling off-hand",
      }),
    ]);
    expect(anachronia?.upgrades.filter((row) => row.name.startsWith("Terrasaur maul"))).toEqual([
      expect.objectContaining({
        name: "Terrasaur maul",
        category: "Tier 80 two-handed melee weapon",
      }),
    ]);
    expect(anachronia?.upgrades.some((row) => row.name.startsWith("Gemstone armour"))).toBe(false);
    expect(
      [...(anachronia?.content ?? []), ...(anachronia?.upgrades ?? [])].filter((row) =>
        row.name.startsWith("Orthen Dig Site"),
      ),
    ).toEqual([
      expect.objectContaining({
        name: "Orthen Dig Site",
        kind: "Archaeology dig site",
      }),
    ]);
    expect(
      [...(anachronia?.content ?? []), ...(anachronia?.upgrades ?? [])].filter((row) =>
        row.name.startsWith("Raksha"),
      ),
    ).toEqual([
      expect.objectContaining({
        name: "Raksha",
        kind: "Boss",
      }),
    ]);
    expect(
      presentContentRewards(contentRewardsFull(rows[0]!, anachronia!.upgrades), 4).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Double Surge", "Double Escape"]);
  });

  it("keeps Barrows consolidated and names the weapon Sunspear", () => {
    const morytania = catalogSource.regions.find((region) => region.id === "morytania");

    expect(morytania?.content.filter((row) => row.name === "Barrows")).toHaveLength(1);
    for (const name of [
      "Barrows chest diary skilling utility",
      "Barrows defenders / shields progression",
      "Blisterwood and Sunspear weapon chain",
      "Burgh de Rott skilling hub",
      "Canifis farming and Slayer Tower hub",
      "Canifis–Mort'ton trapdoor shortcut",
      "Columbarium ring",
      "Darkmeyer Thieving and Ring of Vitur",
      "Ectophial",
      "Ectofuntus Pool of Slime (slime pit)",
      "Ectofuntus Prayer worship",
      "Fairy ring network (Zanaris hub)",
      "Full slayer helmet and point upgrades (reinforced through corrupted)",
      "Games necklace Burgh de Rott teleport",
      "Ghast familiar (Temple Trekking)",
      "Ghostly essence (attuned ectoplasmator supply)",
      "Hard Morytania Barrows rewards",
      "Mazchna / Achtryn (Canifis Slayer Masters)",
      "Modified first age tiara",
      "Mort Myre fungi Bloom harvest",
      "Nature Grotto altar of nature",
      "Port Phasmatys brewery",
      "Port Phasmatys skilling hub",
      "Ring of Vitur",
      "Ring of slaying (craft unlock)",
      "Slayer helmet (craft unlock + base helm)",
    ]) {
      expect(morytania?.upgrades.some((row) => row.name === name)).toBe(false);
    }
    for (const name of [
      "Burgh de Rott skilling hub",
      "Mort Myre fungi Bloom harvest",
      "Nature Grotto altar of nature",
      "Port Phasmatys",
      "Slayer Tower early floors",
    ]) {
      expect(morytania?.content.some((row) => row.name === name)).toBe(false);
    }
    expect(morytania?.content.filter((row) => row.name === "Slayer Tower")).toHaveLength(1);
    expect(morytania?.content.filter((row) => row.name === "Canifis mushroom patch")).toHaveLength(
      1,
    );
    expect(
      morytania?.content.filter((row) => row.name === "Port Phasmatys farming patches"),
    ).toHaveLength(1);
    expect(morytania?.content.filter((row) => row.name === "Shade keys")).toHaveLength(1);
    expect(morytania?.content.filter((row) => row.name === "Shiny columbarium key")).toHaveLength(
      1,
    );
    expect(morytania?.content.filter((row) => row.name === "Columbarium key")).toHaveLength(1);
    expect(morytania?.content.filter((row) => row.name === "Linza the Disgraced")).toHaveLength(1);
    expect(morytania?.content.filter((row) => row.name === "Blisterwood weapons")).toHaveLength(1);
    expect(morytania?.upgrades.filter((row) => row.name === "Blisterwood weapons")).toHaveLength(1);
    const barrowsRewards = contentRewardsFull(
      morytania!.content.find((row) => row.name === "Barrows")!,
      morytania!.upgrades,
    );
    expect(barrowsRewards).not.toMatch(/Linza/i);
    const linzaRewards = contentRewardsFull(
      morytania!.content.find((row) => row.name === "Linza the Disgraced")!,
      morytania!.upgrades,
    );
    expect(linzaRewards).toMatch(/Linza's helm/i);
    expect(
      catalogSource.regions
        .find((region) => region.id === "misthalin")
        ?.upgrades.some((row) => row.name === "Fairy ring network (Zanaris hub)"),
    ).toBe(false);
    expect(
      catalogSource.regions
        .find((region) => region.id === "fremennik")
        ?.upgrades.some((row) => row.name === "Ring of slaying (craft unlock)"),
    ).toBe(false);
    expect(morytania?.upgrades.filter((row) => row.name === "Sunspear")).toEqual([
      expect.objectContaining({
        category: "Hybrid weapon",
        detail: "Switches between melee, ranged, and magic forms and automatically cremates vyres",
      }),
    ]);

    const darkmeyer = morytania?.content.filter((row) => row.name === "Darkmeyer Thieving");
    expect(darkmeyer).toHaveLength(1);
    expect(
      presentContentRewards(contentRewardsFull(darkmeyer![0]!, morytania!.upgrades), 14).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual([
      "Ring of Vitur",
      "Extreme attack",
      "Extreme strength",
      "Extreme defence",
      "Extreme magic",
      "Extreme ranging",
      "Extreme necromancy",
      "Prayer renewal",
      "Aggression potion",
      "Spirit attraction potion",
      "Summoning potion",
      "Super Zamorak brew",
      "Weapon poison+++",
      "Potion flask",
    ]);
  });

  it("keeps removed queue rows out of every region", () => {
    const removed = new Set([
      "Artificer's measure component region map",
      "Cooking dual-brewery network (Keldagrim + Phasmatys)",
      "Scroll of cleansing + herb bag + botanist/factory Herblore stack",
      "Toolbelt attach: Seedicide",
    ]);
    const leftovers = catalogSource.regions.flatMap((region) =>
      [...region.content, ...region.upgrades]
        .filter((row) => removed.has(row.name))
        .map((row) => `${region.id}:${row.name}`),
    );
    expect(leftovers).toEqual([]);
  });

  it("lists Havenhythe majors with correct wiki homes and no thin stubs", () => {
    const haven = catalogSource.regions.find((r) => r.id === "havenhythe");
    expect(haven).toBeTruthy();
    const contentNames = new Set((haven?.content ?? []).map((c) => c.name));
    const upgradeNames = new Set((haven?.upgrades ?? []).map((u) => u.name));

    for (const name of [
      "Havenhythe Big Game Hunter",
      "Havenhythe birdhouses",
      "Clockwork box traps",
      "Wendlewick fish farm",
      "Moonrise Dig Site",
      "Masterwork Ranged Armour materials",
      "Jackalopes (BIS early–mid Hunter method)",
      "Charming moths / Highweald charm training",
      "Shaman's outfit",
      "Tear of Inanna",
      "Ring of Kayazu",
      "Necrite rocks, Phasmatite rocks, Platinum rocks and Havensilver rock",
      "Uncommon gem rocks",
      "Ivar, King of Bones uniques",
      "Silverquill, the Dreadhog uniques",
      "Sanguine Crawler uniques",
    ]) {
      expect(contentNames.has(name) || upgradeNames.has(name), name).toBe(true);
    }

    const bgh =
      haven?.content.find((c) => c.name === "Havenhythe Big Game Hunter") ??
      haven?.upgrades.find((u) => u.name === "Havenhythe Big Game Hunter");
    expect(bgh?.source?.url).toMatch(/Havenhythe_Big_Game_Hunter/);

    const fish =
      haven?.content.find((c) => /wendlewick fish farm/i.test(c.name)) ??
      haven?.upgrades.find((u) => /wendlewick fish farm/i.test(u.name));
    expect(fish?.source?.url).toMatch(/Wendlewick_fish_farm/);
    expect(fish?.source?.url).not.toMatch(/Player-Owned_Farm|Player_owned_farm/i);
    expect(contentNames.has("Shrine of Inanna and Spirit Wolves Summoning hub")).toBe(false);
    expect(upgradeNames.has("Highweald / Deserted Mine mining access")).toBe(false);
    expect(upgradeNames.has("Giant crayfish fishing and cooking")).toBe(false);
    expect(upgradeNames.has("Altar of Inanna")).toBe(false);

    const jack = haven?.upgrades.find((u) => /jackalopes \(bis early/i.test(u.name || ""));
    expect(jack?.name).toMatch(/BIS early/);
    expect(jack?.detail).toBeTruthy();

    for (const row of [...(haven?.content ?? []), ...(haven?.upgrades ?? [])]) {
      expect(row.detail, row.name).toBeTruthy();
      expect(row.source?.url, row.name).toBeTruthy();
    }
  });
});

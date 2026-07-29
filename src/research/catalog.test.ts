import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
import { presentContentRewards } from "@/lib/dataContentPresentation";
import { contentRewardsFull } from "@/lib/researchRewards";
import catalogSource from "#data/research/catalog.json";
import { getResearchCatalog } from "./catalog";

describe("research catalog", () => {
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
    for (const region of catalogSource.regions) {
      for (const id of region.trainingMethodIds ?? []) {
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
      "Nex",
      "God Wars Dungeon 1",
      "Falador farm allotment / flower / herb patches",
    ]) {
      expect(asgNames.has(name), `asgarnia missing ${name}`).toBe(true);
    }
    expect(asgNames.has("Rimmington Construction supply loop")).toBe(false);
    expect(asgNames.has("Player-owned port")).toBe(false);

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
      "POH gilded altar (Chapel offering)",
      "Saradomin godsword special (heal switch)",
      "Temple of Aminishi (ED1)",
      "The Arc skilling destinations (Equilibrium Asgarnia mapping)",
      "The Arc Waiko reward shop (chime economy)",
      "Trimmed / custom-fit trimmed masterwork melee armour",
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
    expect(
      asg?.upgrades.find((upgrade) => upgrade.name === "Custom-fit trimmed masterwork"),
    ).toMatchObject({
      requiredRegions: ["asgarnia", "morytania"],
      regionRequirementType: "all_required",
    });

    const misthalin = catalog.find((region) => region.id === "misthalin");
    expect(misthalin?.upgrades.some((upgrade) => upgrade.name === "Deathtouch bracelet")).toBe(
      true,
    );
    expect(asg?.upgrades.some((upgrade) => upgrade.name.startsWith("Deathtouch bracelet"))).toBe(
      false,
    );

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

    const karNames = new Set((kar?.content ?? []).map((c) => c.name));
    for (const name of [
      "Herblore Habitat",
      "Nature altar",
      "Jadinko Lair curly roots",
      "Brimhaven Agility Arena",
      "Shilo Village",
      "TzHaar City skilling hub",
      "Duradel",
      "TzHaar Fight Cave",
      "Fight Kiln",
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
    ]) {
      expect(forNames.has(name), `forinthry missing ${name}`).toBe(true);
    }

    for (const region of [asg!, kar!, for_!]) {
      for (const row of region.content) {
        expect(row.source?.url, `${region.id}/${row.name}`).toBeTruthy();
      }
    }
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
      "Shrine of Inanna and Spirit Wolves Summoning hub",
      "Shaman's outfit",
      "Empowered Summoning obelisks",
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

    const jack = haven?.upgrades.find((u) => /jackalopes \(bis early/i.test(u.name || ""));
    expect(jack?.name).toMatch(/BIS early/);
    expect(jack?.detail).toBeTruthy();

    for (const row of [...(haven?.content ?? []), ...(haven?.upgrades ?? [])]) {
      expect(row.detail, row.name).toBeTruthy();
      expect(row.source?.url, row.name).toBeTruthy();
    }
  });
});

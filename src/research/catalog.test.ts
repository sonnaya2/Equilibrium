import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
import { presentContentRewards } from "@/lib/dataContentPresentation";
import { dataEntityIconPath } from "@/lib/gameArt";
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
      "Praesul codex",
      "Scrimshaws",
      "Ports armour",
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

  it("consolidates Kandarin hubs, outfits, and Legends' Guild recharge", () => {
    const catalog = catalogSource.regions;
    const kandarin = catalog.find((region) => region.id === "kandarin");
    const asgarnia = catalog.find((region) => region.id === "asgarnia");
    expect(kandarin && asgarnia).toBeTruthy();

    for (const name of ["Kuradal", "Manor Farm", "Seers' Village"]) {
      expect(
        kandarin?.content.filter((row) => row.name === name),
        `kandarin missing or duplicated ${name}`,
      ).toHaveLength(1);
    }

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
    ).toEqual(["Master farmer outfit", "Beans", "Skillchompas", "NopeNopeNope"]);

    const seersVillage = kandarin?.content.find((row) => row.name === "Seers' Village");
    expect(
      presentContentRewards(contentRewardsFull(seersVillage!, kandarin!.upgrades), 8).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Seer's headband 4", "Enhanced Excalibur"]);

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
    ]) {
      expect(
        fremennik?.content.filter((row) => row.name === name),
        `fremennik missing or duplicated ${name}`,
      ).toHaveLength(1);
    }

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
    expect(fremennik?.upgrades.find((row) => row.name === "Golden mining suit")?.detail).toBe(
      "The five-piece outfit grants 6% Mining XP and is awarded by the Liquid Gold Nymph",
    );

    const lavaFlowMine = fremennik?.content.find((row) => row.name === "Lava Flow Mine");
    expect(
      presentContentRewards(contentRewardsFull(lavaFlowMine!, fremennik!.upgrades), 4).icons.map(
        (icon) => icon.label,
      ),
    ).toEqual(["Golden mining suit", "Imcando pickaxe"]);

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
    expect(anachronia?.upgrades.filter((row) => row.name.startsWith("Gemstone armour"))).toEqual([
      expect.objectContaining({
        name: "Gemstone armour",
        category: "Tier 80 hybrid armour",
      }),
    ]);
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
      "Port Phasmatys farming patches",
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
      "Port Phasmatys farming patches",
    ]) {
      expect(morytania?.content.some((row) => row.name === name)).toBe(false);
    }
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
    ]);
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

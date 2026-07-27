import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
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
    const methodCount = catalogSource.skills.reduce(
      (n, skill) => n + skill.methods.length,
      0,
    );
    expect(catalog.datasets.regions).toBe(11);
    expect(catalog.datasets.regions).toBe(catalog.regions.length);
    expect(catalog.datasets.skills).toBe(catalog.skills.length);
    expect(catalog.datasets.trainingMethods).toBe(methodCount);
    expect(catalog.datasets.trainingMethods).toBe(
      new Set(
        catalogSource.skills.flatMap((skill) => skill.methods.map((m) => m.id)),
      ).size,
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

  it("normalizes structured Wiki XP rates", () => {
    const divination = catalogSource.skills.find((skill) => skill.id === "divination");
    expect(divination?.methods.find((method) => method.method === "Pale wisps")?.xpRate).toBe(
      "4,000–5,000 XP/h",
    );
    expect(
      divination?.methods.find((method) => method.method === "Gate of Elidinis corrupt shard cleansing")
        ?.xpRate,
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
      "Rimmington Construction supply loop",
      "God Wars Dungeon 1",
      "Falador farm allotment / flower / herb patches",
    ]) {
      expect(asgNames.has(name), `asgarnia missing ${name}`).toBe(true);
    }

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
      "Forinthry Dungeon",
      "Charming moths",
      "Mage of Zamorak (Abyss entrance)",
      "Daemonheim",
      "Corporeal Beast",
      "Chaos Elemental",
      "Wilderness Agility Course",
      "Abyss entrance",
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
      "Shrine of Inanna Summoning",
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

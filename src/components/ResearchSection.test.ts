import { describe, expect, it } from "vitest";
import {
  clipProse,
  researchRowDetails,
  researchRowLinks,
  researchRowMatchesRegion,
  researchRowTitle,
  type ResearchRow,
} from "./ResearchSection";

const misthalin = {
  id: "misthalin",
  name: "Misthalin",
  aliases: [],
};

const wikiSource = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Crystal_hatchet",
  title: "Crystal tools",
  verifiedAt: "2026-07-26",
};

describe("researchRowTitle", () => {
  it("uses name and never stringifies a source object", () => {
    expect(
      researchRowTitle({
        name: "Crystal tools",
        source: wikiSource,
      }),
    ).toBe("Crystal tools");
  });

  it("falls through scalars only — source object is ignored", () => {
    expect(
      researchRowTitle({
        source: wikiSource,
        confidence: "partial",
      }),
    ).toBe("—");
  });

  it("uses perk / component / monster before id", () => {
    expect(researchRowTitle({ perk: "Biting 4", id: "x" })).toBe("Biting 4");
    expect(researchRowTitle({ component: "Binding essence", id: "x" })).toBe("Binding essence");
    expect(researchRowTitle({ monster: "Abyssal lords", id: "x" })).toBe("Abyssal lords");
  });
});

describe("researchRowLinks", () => {
  it("pulls url from SourceReference objects and string fields", () => {
    const row: ResearchRow = {
      source: wikiSource,
      source_url: "https://pvme.io/guide",
      sourceUrls: ["https://runescape.wiki/w/Crystal_pickaxe", "https://pvme.io/guide"],
      secondary_source_url: { url: "https://runescape.com/news" },
    };
    const urls = researchRowLinks(row);
    expect(urls).toHaveLength(4);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://runescape.wiki/w/Crystal_hatchet",
        "https://pvme.io/guide",
        "https://runescape.wiki/w/Crystal_pickaxe",
        "https://runescape.com/news",
      ]),
    );
  });
});

describe("researchRowMatchesRegion", () => {
  it("keeps selected and global rows while rejecting other and unmapped rows", () => {
    expect(researchRowMatchesRegion({ requiredRegions: ["misthalin"] }, misthalin)).toBe(true);
    expect(researchRowMatchesRegion({ region_hint: "global_once_unlocked" }, misthalin)).toBe(true);
    expect(researchRowMatchesRegion({ requiredRegions: ["desert"] }, misthalin)).toBe(false);
    expect(researchRowMatchesRegion({ name: "Unknown" }, misthalin)).toBe(false);
  });

  it("does not expand hard-req rows via soft regionHints", () => {
    const row = {
      id: "anachronia:laniakea-slayer-master",
      requiredRegions: ["anachronia"],
      regionHints: ["anachronia", "tirannwn", "kandarin", "forinthry", "desert"],
    };
    expect(
      researchRowMatchesRegion(row, { id: "anachronia", name: "Anachronia", aliases: [] }),
    ).toBe(true);
    expect(researchRowMatchesRegion(row, misthalin)).toBe(false);
    expect(researchRowMatchesRegion(row, { id: "desert", name: "Desert", aliases: [] })).toBe(
      false,
    );
  });

  it("does not treat invention: id prefix as every-region membership", () => {
    const row = {
      id: "invention:augmentor",
      requiredRegions: [] as string[],
      regionHints: [] as string[],
    };
    expect(researchRowMatchesRegion(row, misthalin)).toBe(false);
    expect(researchRowMatchesRegion(row, { id: "asgarnia", name: "Asgarnia", aliases: [] })).toBe(
      false,
    );
  });

  it("still hosts empty-req place rows via regionHints / region id prefix", () => {
    expect(
      researchRowMatchesRegion(
        { id: "asgarnia:invention-guild", regionHints: ["asgarnia"], requiredRegions: [] },
        { id: "asgarnia", name: "Asgarnia", aliases: [] },
      ),
    ).toBe(true);
    expect(
      researchRowMatchesRegion(
        { id: "asgarnia:invention-guild", regionHints: ["asgarnia"], requiredRegions: [] },
        misthalin,
      ),
    ).toBe(false);
  });

  it("treats no_region_requirement as global (standard prayers)", () => {
    const row = {
      name: "Clarity of Thought",
      required_regions: [] as string[],
      region_requirement_type: "no_region_requirement",
    };
    expect(researchRowMatchesRegion(row, misthalin)).toBe(true);
    expect(researchRowMatchesRegion(row, { id: "asgarnia", name: "Asgarnia", aliases: [] })).toBe(
      true,
    );
    expect(researchRowMatchesRegion(row, { id: "desert", name: "Desert", aliases: [] })).toBe(true);
  });
});

describe("researchRowDetails", () => {
  it("leads with bare detail and labels requirements", () => {
    const lines = researchRowDetails({
      id: "anachronia:agility-course",
      name: "Anachronia Agility Course",
      recordType: "activity",
      regionHints: ["anachronia"],
      requiredRegions: ["anachronia"],
      comboLabel: "",
      isRegionCombo: false,
      category: "Agility course",
      detail: "Primary overland routing around Anachronia.",
      requirements: ["30 Agility", "Anachronia access"],
      confidence: "confirmed_wiki",
      source: wikiSource,
      sourceFile: "enrichment.json",
      status: "obtainable",
    });
    expect(lines[0]).toBe("Primary overland routing around Anachronia.");
    expect(lines.some((l) => l.startsWith("Reqs:"))).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.join("\n")).not.toMatch(/confidence|sourceFile|recordType|status/i);
    expect(lines.join("\n")).not.toContain("runescape-wiki");
  });

  it("clips multi-kb audit essays to one short line", () => {
    const essay =
      "FINAL PASS Wave B5 canonical emit. Audit combo:orthen-furnace-superheat-autoheater. " +
      "This supersedes dual narrative with cross-region:orthen-furnace-core-stack for planners. " +
      "Orthen furnace plus Superheat Form is the real smithing stack for ironman loops.";
    const lines = researchRowDetails({
      name: "Orthen furnace stack",
      detail: essay,
      confidence: "partial",
      source: wikiSource,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.length).toBeLessThanOrEqual(121);
    expect(lines[0]).not.toMatch(/FINAL PASS|Wave B5|canonical emit/i);
  });

  it("skips combo plumbing essays when detail is present", () => {
    const lines = researchRowDetails({
      id: "combo:crystal-tools",
      name: "Crystal tools",
      regions: ["tirannwn"],
      optionalRegions: ["fremennik", "anachronia"],
      allRegions: ["tirannwn", "fremennik", "anachronia"],
      skills: ["Woodcutting", "Mining"],
      detail: "Lady Ithell upgrades dragon-tier tools with harmonic dust.",
      confidence: "partial",
      modeled: "partial",
      gapAction: "promote per-tool records",
      source: wikiSource,
      sourceUrls: ["https://runescape.wiki/w/Crystal_hatchet"],
    });
    expect(lines).toEqual(["Lady Ithell upgrades dragon-tier tools with harmonic dust."]);
  });

  it("still shows known short fields when detail is empty", () => {
    const lines = researchRowDetails({
      perk: "Biting 4",
      role: "advanced armour damage perk",
      representative_recipe: ["7 Noxious", "1 Direct", "1 Blade"],
      planner_value: "Noxious supply is the dominant gate.",
      confidence: "pvme_current_recipe",
      source_url: "https://pvme.io/pvme-guides/invention-and-perks/perks/",
    });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines.join("\n")).not.toMatch(/confidence/i);
  });

  it("does not dump nested source envelopes as body text", () => {
    const lines = researchRowDetails({
      name: "Test",
      note: "Useful note",
      nested: {
        source: wikiSource,
        confidence: "partial",
        name: "Inner",
        amount: 3,
      },
    });
    expect(lines.join("\n")).not.toContain("runescape-wiki");
    expect(lines.join("\n")).not.toMatch(/confidence/i);
  });

  it("clipProse hard-caps", () => {
    expect(clipProse("x".repeat(300)).length).toBeLessThanOrEqual(121);
  });
});

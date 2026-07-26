import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  abilityCategoryLabel,
  abilityIconPath,
  activityIconPath,
  bossIconPath,
  dataEntityIconPath,
  equipmentIconPath,
  gameIconPath,
  regionCrestPath,
  skillIconPath,
  STYLE_ICON,
  styleIconPath,
  upgradeIconPath,
} from "./gameArt";

const PUBLIC = join(process.cwd(), "public");

describe("gameArt", () => {
  it("builds conventional public paths", () => {
    expect(gameIconPath("combat", "melee-abilities")).toBe("/game/combat/melee-abilities.png");
    expect(regionCrestPath("karamja")).toBe("/game/regions/karamja.png");
    expect(equipmentIconPath("item:seismic-wand")).toBe(
      "/game/combat/equipment/seismic-wand.png",
    );
    expect(equipmentIconPath("seismic-wand")).toBe("/game/combat/equipment/seismic-wand.png");
    expect(abilityIconPath("greater_barge", "melee")).toBe(
      "/game/combat/abilities/melee/greater-barge.png",
    );
    expect(abilityCategoryLabel("enhanced")).toBe("threshold");
    expect(abilityCategoryLabel("basic")).toBe("basic");
    expect(abilityCategoryLabel("ultimate")).toBe("ultimate");
  });

  it("every style icon is published to public/game", () => {
    for (const style of Object.keys(STYLE_ICON) as Array<keyof typeof STYLE_ICON>) {
      const path = styleIconPath(style);
      expect(existsSync(join(PUBLIC, path)), `${path} not published — run npm run sync:assets`).toBe(true);
    }
  });

  it("all 11 region crests are published", () => {
    const regions = [
      "misthalin", "havenhythe", "karamja", "asgarnia", "kandarin", "fremennik",
      "forinthry", "desert", "morytania", "tirannwn", "anachronia",
    ];
    for (const region of regions) {
      expect(existsSync(join(PUBLIC, regionCrestPath(region))), `${region} crest missing`).toBe(true);
    }
  });

  it("resolves data skill / boss / activity / upgrade icons", () => {
    expect(skillIconPath("Archaeology")).toBe("/game/skills/archaeology.png");
    expect(bossIconPath("Kree'arra")).toBe("/game/bosses/kreearra.png");
    expect(bossIconPath("Kerapac, the bound")).toBe("/game/bosses/kerapac.png");
    expect(activityIconPath("Artisans' Workshop")).toMatch(/^\/game\/activities\//);
    expect(upgradeIconPath("Bonecrusher")).toMatch(/bonecrusher\.png$/);
    expect(existsSync(join(PUBLIC, skillIconPath("Archaeology")!))).toBe(true);
    expect(existsSync(join(PUBLIC, bossIconPath("Kree'arra")!))).toBe(true);
    expect(existsSync(join(PUBLIC, upgradeIconPath("Bonecrusher")!))).toBe(true);
  });

  it("returns null for abstract package labels without a safe alias", () => {
    // Boss containment may still resolve on dataEntity; upgrade-only stays empty.
    expect(upgradeIconPath("Kerapac progression")).toBeNull();
    // Multi-word packages without a real item → empty well (not a weak skill/scenery icon).
    expect(dataEntityIconPath({ name: "Random abstract skilling package ladder" })).toBeNull();
    expect(dataEntityIconPath({ name: "Elite package without item", kind: "elite skilling" })).toBeNull();
    expect(dataEntityIconPath({ name: "Generic multi-word progression checklist" })).toBeNull();
  });

  it("prefers Archaeology inventory/skill over scenery for abstract arch rows", () => {
    // Monolith packages → inventory monolith (or skill if unpublished).
    expect(dataEntityIconPath({ name: "Mysterious monolith energy + relic loadout ladder" })).toMatch(
      /\/(upgrades\/permanent-unlocks\/mysterious-monolith|skills\/archaeology)\.png$/,
    );
    expect(dataEntityIconPath({ name: "Hireable research team recruitment ladder" })).toMatch(
      /archaeology-research\.png$/,
    );
    // kind-only archaeology with no name hit → empty well (not forced skill icon).
    expect(dataEntityIconPath({ name: "Abstract package checklist", kind: "archaeology progression" })).toBeNull();
    // Published dig-site map icons resolve via activity; unpublished dig-site aliases fall to skill.
    expect(dataEntityIconPath({ name: "Kharid-et dig site" })).toBe(
      "/game/activities/kharid-et-dig-site.png",
    );
    // varrock-dig-site art may land with expansion-41 publish; until then skill fallback is correct.
    expect(dataEntityIconPath({ name: "Varrock dig site / early archaeology" })).toMatch(
      /\/(activities\/varrock-dig-site|skills\/archaeology)\.png$/,
    );
    expect(dataEntityIconPath({ name: "Archaeology campus and varrock dig site hub" })).toMatch(
      /\/(activities\/varrock-dig-site|skills\/archaeology)\.png$/,
    );
    // Named inventory / unlock art still wins before skill fallback.
    expect(dataEntityIconPath({ name: "Chronotes currency economy (earn + spend sinks)" })).toMatch(
      /chronotes\.png$/,
    );
    expect(dataEntityIconPath({ name: "Dragon mattock" })).toMatch(/dragon-mattock\.png$/);
    // Abstract collector package with no specific inventory art → empty well.
    expect(dataEntityIconPath({ name: "Collectors Assemble unique-collection ladder" })).toBeNull();
    expect(dataEntityIconPath({ name: "Archaeology Guild Shop and qualification upgrades" })).toMatch(
      /archaeology-guild-shop\.png$/,
    );
    expect(dataEntityIconPath({ name: "It Belongs in a Museum! (Velucia meta collection log)" })).toMatch(
      /velucia-museum\.png$/,
    );
    expect(dataEntityIconPath({ name: "The Prodigal Spender (all Guild shop permanents)" })).toMatch(
      /the-prodigal-spender\.png$/,
    );
    expect(dataEntityIconPath({ name: "Professor additional relic loadout (80k chronotes)" })).toMatch(
      /chronotes\.png$/,
    );
    expect(dataEntityIconPath({ name: "Mattock tier ladder (bronze through elder rune + specials)" })).toMatch(
      /dragon-mattock\.png$/,
    );
    expect(dataEntityIconPath({ name: "Spear of Annihilation (base archaeology spear)" })).toMatch(
      /spear-of-annihilation\.png$/,
    );
    expect(dataEntityIconPath({ name: "Mattock precision upgrades (Guild shop permanent)" })).toMatch(
      /mattock-precision\.png$/,
    );
    // hermod.png may not be published yet; alias still targets hermod.
    const hermod = dataEntityIconPath({ name: "Hermod, the Spirit of War" });
    expect(hermod === null || /hermod/.test(hermod)).toBe(true);
  });

  it("resolves high-value package aliases to existing art", () => {
    expect(dataEntityIconPath({ name: "Fairy ring network (Zanaris hub)" })).toBe(
      "/game/activities/zanaris.png",
    );
    expect(dataEntityIconPath({ name: "Sanctum of Rebirth uniques" })).toBe(
      "/game/activities/sanctum-of-rebirth.png",
    );
    expect(dataEntityIconPath({ name: "Zemouregal & Vorkath progression" })).toBe(
      "/game/bosses/zemouregal-vorkath.png",
    );
    expect(dataEntityIconPath({ name: "Imcando tools family (pickaxe, hatchet, related craft pressure)" })).toMatch(
      /imcando-pickaxe\.png$/,
    );
    expect(dataEntityIconPath({ name: "Well of Souls talent infrastructure" })).toBe(
      "/game/activities/well-of-souls.png",
    );
    // Named items / boss packages that must resolve to real published art.
    expect(dataEntityIconPath({ name: "Bow of the Last Guardian (Bolg)" })).toMatch(
      /bow-of-the-last-guardian\.png$/,
    );
    expect(dataEntityIconPath({ name: "Deathdealer robe armour (necro power)" })).toMatch(
      /deathdealer-robe-top\.png$/,
    );
    expect(dataEntityIconPath({ name: "Deathwarden robe armour (necro tank)" })).toMatch(
      /deathwarden-robe-top\.png$/,
    );
    expect(dataEntityIconPath({ name: "Nex: Angel of Death progression" })).toMatch(/nex-aod\.(png|jpg)$/);
    expect(dataEntityIconPath({ name: "Bandos equipment (GWD1 melee power ladder)" })).toMatch(
      /bandos-chestplate\.png$/,
    );
    expect(dataEntityIconPath({ name: "Armadyl equipment (GWD1 ranged power ladder)" })).toMatch(
      /armadyl-chestplate\.png$/,
    );
    expect(dataEntityIconPath({ name: "Robes of subjugation (GWD1 magic power ladder)" })).toMatch(
      /subjugation-robe-top\.png$/,
    );
    expect(dataEntityIconPath({ name: "Staff of limitless family (elemental impetus craft)" })).toMatch(
      /staff-of-limitless-fire\.png$/,
    );
    expect(dataEntityIconPath({ name: "Wood box tier upgrades" })).toMatch(
      /(eternal-magic-)?wood-box\.png$/,
    );
    for (const label of [
      "Bow of the Last Guardian (Bolg)",
      "Nex: Angel of Death progression",
      "Bandos equipment (GWD1 melee power ladder)",
    ]) {
      const path = dataEntityIconPath({ name: label });
      expect(existsSync(join(PUBLIC, path!)), `missing public file for "${label}": ${path}`).toBe(true);
    }
  });

  it("does not pick short/generic containment matches", () => {
    // "tools" must not resolve to a random tools icon via weak containment.
    expect(dataEntityIconPath({ name: "Augmentable gather tools research" })).toBeNull();
    // Exact boss still works.
    expect(bossIconPath("Kerapac")).toBe("/game/bosses/kerapac.png");
  });

  it("uses disk-backed non-png boss extensions and word-ish boss kinds", () => {
    expect(bossIconPath("Zamorak")).toBe("/game/bosses/zamorak.jpg");
    // "elite skilling" must not force bossish routing (no random boss/activity).
    expect(dataEntityIconPath({ name: "Augmentable gather tools research", kind: "elite skilling" })).toBeNull();
    // Kind-only archaeology tag must not dump skill art on an abstract package name.
    expect(
      dataEntityIconPath({ name: "Settlement hub without excavation tokens", kind: "archaeology progression" }),
    ).toBeNull();
    // Hyphenated dig-site names stay whole (not split into "kharid" alone).
    expect(dataEntityIconPath({ name: "Kharid-et dig site" })).toBe(
      "/game/activities/kharid-et-dig-site.png",
    );
  });

  it("dataEntityIconPath prefers item ids and known bosses", () => {
    expect(dataEntityIconPath({ id: "item:seismic-wand" })).toBe(
      "/game/combat/equipment/seismic-wand.png",
    );
    expect(dataEntityIconPath({ name: "Rasial, the First Necromancer", kind: "boss" })).toBe(
      "/game/bosses/rasial.png",
    );
    expect(dataEntityIconPath({ name: "Mining", kind: "skill", skill: "Mining" })).toBe(
      "/game/skills/mining.png",
    );
  });

  it("critical upgrade aliases resolve to published full slugs (not short junk)", () => {
    // Short harvest tokens used to poison alias resolution; targets must be real files.
    const critical: Array<[string, RegExp]> = [
      ["Five-finger discount passive", /five-finger-discount\.png$/],
      ["Pyro-matic", /pyro-matic\.png$/],
      ["Hammer-tron", /hammer-tron\.png$/],
      ["Wand / orb of the Cywir elders", /wand-of-the-cywir-elders\.png$/],
      ["Yak-hide armour", /yak-hide-armour\.png$/],
      ["Trimmed masterwork melee armour (t92)", /trimmed-masterwork-platebody\.png$/],
      ["Refined anima core armour (GWD2)", /refined-anima-core-body-of-zaros\.png$/],
      ["Demon, dragon and undead slayer ability codices", /demon-slayer\.png$/],
      ["First necromancer's equipment", /first-necromancer-robe-top\.png$/],
      ["Puro-Puro Impetuous Impulses (dragon implings)", /dragon-implings\.png$/],
      ["Juju and perfect juju potions", /juju-farming\.png$/],
    ];
    for (const [label, re] of critical) {
      const path = upgradeIconPath(label) ?? dataEntityIconPath({ name: label });
      expect(path, `alias for "${label}"`).toMatch(re);
      expect(existsSync(join(PUBLIC, path!)), `missing public file for "${label}": ${path}`).toBe(
        true,
      );
    }
  });
});

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
      "/game/bosses/nakatra.png",
    );
    expect(dataEntityIconPath({ name: "Sanctum of Rebirth", kind: "boss dungeon" })).toBe(
      "/game/bosses/nakatra.png",
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

  it("resolves Anachronia major unlocks without skill-glyph theft", () => {
    expect(
      dataEntityIconPath({
        name: "Skillcape rack (Player Lodge T3 passive perk)",
        kind: "permanent Anachronia base-camp skillcape passive infrastructure",
      }),
    ).toMatch(/skillcape-rack\.png$/);
    expect(dataEntityIconPath({ name: "Anachronia base camp" })).toMatch(/anachronia-base-camp\.png$/);
    expect(dataEntityIconPath({ name: "Dream of Iaia" })).toMatch(/dream-of-iaia\.png$/);
    expect(dataEntityIconPath({ name: "Orthen Dig Site" })).toMatch(/orthen-dig/);
    expect(dataEntityIconPath({ name: "Ranch Out of Time (Anachronia Dinosaur Farm)" })).toMatch(
      /ranch-out-of-time\.png$/,
    );
    expect(dataEntityIconPath({ name: "Herby Werby herb bag skilling unlock" })).toMatch(/herby-werby\.png$/);
    expect(
      dataEntityIconPath({ name: "Laniakea (Anachronia highest standard Slayer Master)" }),
    ).toMatch(/laniakea\.png$/);
    expect(dataEntityIconPath({ name: "Gemstone armour" })).toMatch(/gemstone-hauberk\.png$/);
    expect(dataEntityIconPath({ name: "Anachronia codex lectern (Double Surge/Escape)" })).toMatch(
      /double-surge\.png$/,
    );
    expect(dataEntityIconPath({ name: "Volcanic trapper outfit" })).toMatch(/volcanic-trapper\.png$/);
    expect(dataEntityIconPath({ name: "Reaver's ring" })).toMatch(/reavers-ring\.png$/);
    expect(dataEntityIconPath({ name: "Anachronia totems (permanent multi-skill buffs)" })).toMatch(
      /totem-of-vitality\.png$/,
    );
    expect(dataEntityIconPath({ name: "Anachronia Agility Course", kind: "Agility course" })).toMatch(
      /anachronia-agility-course\.png$/,
    );
    expect(
      dataEntityIconPath({ name: "Dinosaur and plant Slayer (Laniakea / Anachronia)" }),
    ).toMatch(/laniakea\.png$/);
  });

  it("resolves Havenhythe majors with distinct BGH and fish-farm art", () => {
    expect(dataEntityIconPath({ name: "Havenhythe Big Game Hunter" })).toMatch(
      /havenhythe-big-game-hunter\.png$/,
    );
    expect(dataEntityIconPath({ name: "Anachronia Big Game Hunter" })).toMatch(/big-game-hunter\.png$/);
    // Never reuse Anachronia dinosaur BGH art for Havenhythe
    expect(dataEntityIconPath({ name: "Havenhythe Big Game Hunter" })).not.toMatch(
      /^\/game\/activities\/big-game-hunter\.png$/,
    );
    expect(dataEntityIconPath({ name: "Clockwork box traps" })).toMatch(/clockwork-box-trap\.png$/);
    expect(dataEntityIconPath({ name: "Moonrise Dig Site" })).toMatch(/moonrise-dig-site\.png$/);
    expect(dataEntityIconPath({ name: "Masterwork Ranged Armour materials" })).toMatch(
      /masterwork-ranged-body\.png$/,
    );
    expect(dataEntityIconPath({ name: "Havenhythe birdhouses" })).toMatch(/bird-house\.png$/);
    expect(dataEntityIconPath({ name: "Eternal birdhouse" })).toMatch(/bird-house\.png$/);
    expect(dataEntityIconPath({ name: "Jackalopes (BIS early–mid Hunter method)" })).toMatch(/jackalope\.png$/);
    expect(dataEntityIconPath({ name: "Jackalopes" })).toMatch(/jackalope\.png$/);
    expect(dataEntityIconPath({ name: "Fish farming" })).toMatch(/fish-farm\.png$/);
    expect(dataEntityIconPath({ name: "Wendlewick fish farm" })).toMatch(/fish-farm\.png$/);
    expect(dataEntityIconPath({ name: "Wendlewick fish farm (Havenhythe)" })).toMatch(/fish-farm\.png$/);
    // Fish farm must not resolve to Player-Owned Farm
    expect(dataEntityIconPath({ name: "Wendlewick fish farm" })).not.toMatch(/player-owned-farm/);
    expect(dataEntityIconPath({ name: "Fish farming" })).not.toMatch(/player-owned-farm/);
    // Content boss rows use official plates; "… uniques" packages keep inventory art.
    expect(dataEntityIconPath({ name: "Ivar, King of Bones" })).toMatch(/\/bosses\/ivar\./);
    expect(dataEntityIconPath({ name: "Ivar, King of Bones uniques" })).toMatch(/ivar-uniques/);
    expect(dataEntityIconPath({ name: "Silverquill, the Dreadhog" })).toMatch(
      /\/bosses\/silverquill\./,
    );
    expect(dataEntityIconPath({ name: "Sanguine Crawler" })).toMatch(
      /\/bosses\/sanguine-crawler\./,
    );
    expect(dataEntityIconPath({ name: "Charming moths / Highweald charm training" })).toMatch(
      /charming-moths\.png$/,
    );
    expect(dataEntityIconPath({ name: "Charming moths / Highweald charms" })).toMatch(
      /charming-moths\.png$/,
    );
    expect(dataEntityIconPath({ name: "Shrine of Inanna Summoning" })).toMatch(/altar-of-inanna|inanna/);
    expect(dataEntityIconPath({ name: "Empowered Summoning obelisks" })).toMatch(
      /summoning-obelisk\.png$/,
    );
    expect(dataEntityIconPath({ name: "Apex Hide Armour" })).toMatch(/apex-hide-body\.png$/);
  });

  it("resolves Asgarnia / Karamja / Forinthry majors to published art", () => {
    const must: Array<[string, RegExp]> = [
      ["Invention Guild", /invention-guild\.(png|jpg)$/],
      ["Mining Guild", /mining-guild\.png$/],
      ["Warriors' Guild", /warriors-guild\.png$/],
      ["Artisans' Workshop", /artisans-workshop\.png$/],
      ["Port Sarim docks and skilling hub", /port-sarim\.png$/],
      ["Rimmington Construction supply loop", /rimmington\.png$/],
      ["Falador farm allotment / flower / herb patches", /falador-farm\.png$/],
      ["God Wars Dungeon 1 equipment", /god-wars-dungeon-1/],
      ["Taverley / Burthorpe early–mid skilling hub", /taverley\.png$/],
      ["Herblore Habitat", /herblore-habitat\.png$/],
      ["Nature altar", /nature-altar\.png$/],
      ["Jadinko Favour offering stone", /jadinko-favour\.png$/],
      ["Jadinko Lair curly roots", /curly-root|jadinko-lair/],
      ["Brimhaven Agility Arena", /brimhaven-agility-arena\.png$/],
      ["Shilo Village", /shilo-village\.png$/],
      ["TzHaar City skilling hub", /tzhaar-city\.png$/],
      ["Gemstone cavern (Shilo underground)", /gemstone-cavern\.png$/],
      ["Mage Arena", /mage-arena\.png$/],
      ["Forinthry Dungeon", /forinthry-dungeon\.png$/],
      ["Charming moths", /charming-moths\.png$/],
      ["Mage of Zamorak (Abyss entrance)", /mage-of-zamorak\.(png|gif)$|abyss\.(gif|png)$/],
      ["Daemonheim Rewards shop (Marmaros)", /daemonheim-rewards\.png$/],
      ["Daemonheim Peninsula resource island", /daemonheim-peninsula\.png$/],
      ["Daemonheim Dig Site", /daemonheim-dig-site\.png$/],
      ["Daemonheim Dig Site (Dragonkin mini-site)", /daemonheim-dig-site\.png$/],
      ["Wilderness runite rocks (Lava Maze north)", /wilderness-runite\.png$/],
      ["Spirit shield + holy elixir / sigil densify", /divine-spirit-shield\.png$/],
      ["Dark onyx core source package", /dark-onyx-core\.png$/],
      ["GWD2 anima core and mid-tier melee/ranged weapons", /anima-core-body-of-zaros\.png$/],
    ];
    for (const [label, re] of must) {
      const path = upgradeIconPath(label) ?? dataEntityIconPath({ name: label });
      expect(path, `alias for "${label}"`).toMatch(re);
      expect(existsSync(join(PUBLIC, path!)), `missing public file for "${label}": ${path}`).toBe(
        true,
      );
    }
  });

  it("resolves Fremennik major unlocks to published art", () => {
    expect(dataEntityIconPath({ name: "Dragon pickaxe (Chaos Dwarf Battlefield / Chaos Giants)" })).toMatch(
      /dragon-pickaxe\.png$/,
    );
    expect(dataEntityIconPath({ name: "Imcando pickaxe (Lava Flow Mine / Birthright path)" })).toMatch(
      /imcando-pickaxe\.png$/,
    );
    expect(dataEntityIconPath({ name: "Astral altar (Lunar Isle)" })).toMatch(/astral-altar\.png$/);
    expect(dataEntityIconPath({ name: "Livid Farm Lunar spell unlocks" })).toMatch(/livid-farm\.png$/);
    expect(dataEntityIconPath({ name: "Lunar Isle skilling hub" })).toMatch(/lunar-isle\.png$/);
    expect(dataEntityIconPath({ name: "Managing Miscellania" })).toMatch(/managing-miscellania\.png$/);
    expect(dataEntityIconPath({ name: "Keldagrim dwarven traders and multi-step chests" })).toMatch(
      /keldagrim\.png$/,
    );
    expect(dataEntityIconPath({ name: "Ungael ritual site pressure" })).toMatch(/ungael-ritual\.png$/);
    expect(dataEntityIconPath({ name: "Yak hide and Player-Owned Farm yak babies" })).toMatch(/yak\.png$/);
    expect(dataEntityIconPath({ name: "Yak-hide armour" })).toMatch(/yak-hide/);
  });

  it("dataEntityIconPath prefers item ids and known bosses", () => {
    expect(dataEntityIconPath({ id: "item:seismic-wand" })).toBe(
      "/game/combat/equipment/seismic-wand.png",
    );
    expect(dataEntityIconPath({ name: "Rasial, the First Necromancer", kind: "boss" })).toBe(
      "/game/bosses/rasial.png",
    );
    // Boss plate wins even when kind is a place/dungeon tag (Major unlocks Name column).
    expect(dataEntityIconPath({ name: "Kerapac, the bound", kind: "Elder God Wars Dungeon" })).toMatch(
      /\/bosses\/kerapac\./,
    );
    expect(dataEntityIconPath({ name: "Arch-Glacor", kind: "Elder God Wars Dungeon" })).toMatch(
      /\/bosses\/arch-glacor\./,
    );
    expect(dataEntityIconPath({ name: "Croesus", kind: "skilling boss" })).toMatch(
      /\/bosses\/croesus\./,
    );
    expect(dataEntityIconPath({ name: "TzKal-Zuk", kind: "Elder God Wars Dungeon" })).toMatch(
      /\/bosses\/tzkal-zuk\./,
    );
    expect(dataEntityIconPath({ name: "General Graardor", kind: "God Wars Dungeon 1" })).toMatch(
      /\/bosses\/general-graardor\./,
    );
    expect(dataEntityIconPath({ name: "Mining", kind: "skill", skill: "Mining" })).toBe(
      "/game/skills/mining.png",
    );
  });

  it("content-style boss names resolve to /game/bosses/ plates", () => {
    const cases: Array<[string, string]> = [
      ["Kerapac, the bound", "kerapac"],
      ["TzKal-Zuk", "tzkal-zuk"],
      ["General Graardor", "general-graardor"],
      ["Kree'arra", "kreearra"],
      ["Commander Zilyana", "commander-zilyana"],
      ["K'ril Tsutsaroth", "kril-tsutsaroth"],
      ["Nex", "nex"],
      ["Nex: Angel of Death", "nex-aod"],
      ["Nex: Angel of Death progression", "nex-aod"],
      ["Giant Mole", "giant-mole"],
      ["Queen Black Dragon", "queen-black-dragon"],
      ["Vorago", "vorago"],
      ["Rasial, the First Necromancer", "rasial"],
      ["Hermod, the Spirit of War", "hermod"],
      ["The Gate of Elidinis", "gate-of-elidinis"],
      ["Arch-Glacor", "arch-glacor"],
      ["Croesus", "croesus"],
      ["Zemouregal & Vorkath", "zemouregal-vorkath"],
      ["Raksha, the Shadow Colossus", "raksha"],
      ["Rex Matriarchs", "rex-matriarchs"],
      ["Solak", "solak"],
      ["Telos, the Warden", "telos"],
      ["Kalphite King", "kalphite-king"],
      ["Kalphite Queen", "kalphite-queen"],
      ["Araxxor / Araxxi", "araxxor"],
      ["Corporeal Beast", "corporeal-beast"],
      ["Chaos Elemental", "chaos-elemental"],
      ["Legiones", "legiones"],
      ["Legiones (Monastery of Ascension)", "legiones"],
      ["Dagannoth Kings", "dagannoth-kings"],
      ["Ivar, King of Bones", "ivar"],
      ["Silverquill, the Dreadhog", "silverquill"],
      ["Sanguine Crawler", "sanguine-crawler"],
      ["Abomination", "abomination"],
      ["Vermyx, Brood Mother", "vermyx"],
      ["Kezalam, the Wanderer", "kezalam"],
      ["Nakatra, Devourer Eternal", "nakatra"],
      ["Amascut, the Devourer", "amascut"],
      ["Zamorak, Lord of Chaos (Undercity)", "zamorak"],
      ["The Magister", "magister"],
      ["Ambassador (ED3)", "ambassador"],
      // Elite dungeon content rows → final boss plates (not activity scenery).
      ["Dragonkin Laboratory (ED2)", "black-stone-dragon"],
      ["Dragonkin Laboratory", "black-stone-dragon"],
      ["The Shadow Reef (ED3)", "ambassador"],
      ["The Shadow Reef", "ambassador"],
    ];
    for (const [name, slug] of cases) {
      const path = bossIconPath(name) ?? dataEntityIconPath({ name, kind: "Elite Dungeon" });
      const ext = slug === "zamorak" ? "jpg" : "png";
      expect(path, name).toBe(`/game/bosses/${slug}.${ext}`);
      expect(existsSync(join(PUBLIC, path!)), `missing ${path}`).toBe(true);
    }
    expect(
      dataEntityIconPath({ name: "Dragonkin Laboratory (ED2)", kind: "Elite Dungeon" }),
    ).toBe("/game/bosses/black-stone-dragon.png");
    expect(
      dataEntityIconPath({ name: "The Shadow Reef (ED3)", kind: "Elite Dungeon" }),
    ).toBe("/game/bosses/ambassador.png");
    // Full containment still works for package labels without inventory art.
    expect(bossIconPath("Kerapac progression")).toBe("/game/bosses/kerapac.png");
    // Inventory unique packs keep upgrade art (reward/POI chips), not boss plates.
    expect(dataEntityIconPath({ name: "Ivar, King of Bones uniques" })).toMatch(/ivar-uniques\.png$/);
    expect(dataEntityIconPath({ name: "Scripture of Amascut" })).not.toMatch(/\/bosses\//);
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
      ["Seasinger (Ports / Arc)", /seasingers-robe-top\.png$/],
      ["Tetsu equipment", /tetsu-body\.png$/],
      ["Death lotus equipment", /death-lotus-chestplate\.png$/],
      ["Virtus equipment and Praesulic essence", /virtus-robe-top\.png$/],
      ["Elite tectonic robe armour (T92 magic power)", /elite-tectonic-robe-top\.png$/],
      ["Essence of Finality stored special attack", /essence-of-finality\.png$/],
      ["Blade of Leng", /blade-of-leng\.png$/],
      ["Glacor boots", /steadfast-boots\.png$/],
      ["Praesul codex curses", /praesul-codex\.png$/],
    ];
    for (const [label, re] of critical) {
      const path = upgradeIconPath(label) ?? dataEntityIconPath({ name: label });
      expect(path, `alias for "${label}"`).toMatch(re);
      expect(existsSync(join(PUBLIC, path!)), `missing public file for "${label}": ${path}`).toBe(
        true,
      );
    }
  });

  it("skilling outfit and gather-tool packages resolve to published art", () => {
    const must: Array<[string, RegExp]> = [
      ["Nature's sentinel outfit", /natures-sentinel\.png$/],
      ["Master camouflage outfit", /master-camouflage\.png$/],
      ["Master constructor's outfit", /master-constructors-outfit\.png$/],
      ["Master farmer outfit", /master-farmer\.png$/],
      ["First age outfit", /first-age\.png$/],
      ["Sous chef's outfit", /sous-chefs-outfit\.png$/],
      ["Factory outfit", /factory-outfit\.png$/],
      ["Blacksmith's outfit", /blacksmiths-outfit\.png$/],
      ["Diviner's outfit", /diviners-headwear\.png$/],
      ["Archaeologist's outfit", /archaeologists\.png$/],
      ["Master archaeologist's outfit", /master-archaeologist\.png$/],
      ["Infinity ethereal outfit", /infinity-ethereal-outfit\.png$/],
      ["Prifddinian worker's outfit", /prifddinian-workers-outfit\.png$/],
      ["Witchdoctor camo outfit", /witchdoctor-camo\.png$/],
      ["Shaman's outfit", /shamans-outfit\.png$/],
      ["Botanist's outfit", /botanists-outfit\.png$/],
      ["Magic golem outfit", /magic-golem-outfit\.png$/],
      ["Gemstone golem outfit", /gemstone-golem-outfit\.png$/],
      ["Volcanic trapper outfit", /volcanic-trapper\.png$/],
      ["Pickaxe of earth and song", /pickaxe-of-earth-and-song\.png$/],
      ["Hatchet of ember and glade", /hatchet-of-ember-and-glade\.png$/],
      ["Pickaxe of life and death", /pickaxe-of-life-and-death\.png$/],
      ["Crystal pickaxe", /crystal-pickaxe\.png$/],
      ["Crystal hatchet", /crystal-hatchet\.png$/],
      ["Crystal mattock", /crystal-mattock\.png$/],
      ["Imcando pickaxe", /imcando-pickaxe\.png$/],
      ["Imcando hatchet", /imcando-hatchet\.png$/],
      ["Imcando mattock", /imcando-mattock\.png$/],
      ["Dragon pickaxe", /dragon-pickaxe\.png$/],
      ["Dragon hatchet", /dragon-hatchet\.png$/],
      ["Dragon mattock", /dragon-mattock\.png$/],
      ["Hammer-tron", /hammer-tron\.png$/],
      ["Pyro-matic", /pyro-matic\.png$/],
      ["Rod-o-matic", /fishing-rod-o-matic\.png$/],
      ["Seedicide", /seedicide\.png$/],
      ["Bonecrusher", /bonecrusher\.png$/],
      ["Herbicide", /herbicide\.png$/],
      ["Spring cleaner (invention drop cleaner)", /spring-cleaner\.png$/],
      ["Autoheater", /autoheater\.png$/],
    ];
    for (const [label, re] of must) {
      const path = upgradeIconPath(label) ?? dataEntityIconPath({ name: label });
      expect(path, `alias for "${label}"`).toMatch(re);
      expect(existsSync(join(PUBLIC, path!)), `missing public file for "${label}": ${path}`).toBe(
        true,
      );
    }
  });

  it("multi-region key hubs resolve to existing public paths when art exists", () => {
    // Durable smoke across region hubs — empty well ok only until conventional art lands.
    const hubs = [
      "Prifddinas",
      "Fishing Guild",
      "Barrows",
      "Menaphos",
      "Invention Guild",
      "TzHaar City",
      "Wilderness Agility Course",
    ];
    for (const name of hubs) {
      const path = activityIconPath(name) ?? dataEntityIconPath({ name });
      if (path != null) {
        expect(path.startsWith("/game/"), `${name} -> ${path}`).toBe(true);
        expect(existsSync(join(PUBLIC, path.slice(1))), `${name} missing ${path}`).toBe(true);
        continue;
      }
      const slug = name
        .toLowerCase()
        .replace(/['\u2019]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const conventional = [
        `activities/${slug}.png`,
        `activities/${slug}.jpg`,
        `upgrades/permanent-unlocks/${slug}.png`,
        `upgrades/permanent-unlocks/${slug}.jpg`,
      ];
      const published = conventional.some((rel) => existsSync(join(PUBLIC, "game", rel)));
      expect(published, `${name} has conventional art but resolver returned null`).toBe(false);
    }
  });
});

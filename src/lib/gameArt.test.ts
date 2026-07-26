import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  equipmentIconPath,
  gameIconPath,
  regionCrestPath,
  STYLE_ICON,
  styleIconPath,
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
});

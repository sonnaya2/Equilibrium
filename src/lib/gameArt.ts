/**
 * Conventional paths to web-served game art. Art lands in public/game/<category>/
 * via scripts/publish-assets.mjs from the attributed assets/ manifest — never hotlink
 * the wiki, never invent substitute art.
 */
export function gameIconPath(category: string, name: string): string {
  return `/game/${category}/${name}.png`;
}

export const STYLE_ICON = {
  melee: "melee-abilities",
  ranged: "ranged-abilities",
  magic: "magic-abilities",
  necromancy: "necromancy-abilities",
} as const;

export const styleIconPath = (style: keyof typeof STYLE_ICON) => gameIconPath("combat", STYLE_ICON[style]);

export const regionCrestPath = (regionId: string) => gameIconPath("regions", regionId);

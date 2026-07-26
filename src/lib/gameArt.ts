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

/** Processed wiki hex icons for League relics (transparent PNG). */
export function relicIconPath(slug: string): string {
  return `/game/relics/${slug}.png`;
}

/** Official news splash portraits (JPG) for detail/stage panels. */
export function relicPortraitPath(slug: string): string {
  return `/game/relics/${slug}.jpg`;
}

/**
 * Local equipment inventory icons (synced from the wiki, never hotlinked).
 * Path: public/game/combat/equipment/<id-without-item-prefix>.png
 * Built by scripts/sync-equipment-icons.mjs → data/combat/equipment-icons.json.
 */
export function equipmentIconPath(equipmentId: string): string {
  const slug = equipmentId.replace(/^item:/, "");
  return `/game/combat/equipment/${slug}.png`;
}

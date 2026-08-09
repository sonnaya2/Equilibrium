import { rangedEffectDisplayName } from "@/combat/styles/ranged/ammunitionEffects";
import { blessingById } from "@/league/blessings";
import { blessingIconPath } from "@/lib/gameArt";
import { blessingEffectDisplayName, isBlessingDamageEffectId } from "./blessingPresentation";

const PROCEDURAL_EFFECT_LABEL: Readonly<Record<string, string>> = {
  aftershock: "Aftershock",
  crackling: "Crackling",
  player_weapon_poison: "Weapon poison",
  "song:essence-corruption": "Essence Corruption",
};

const EFFECT_ICON_PATH: Readonly<Record<string, string>> = {
  aftershock: "/game/combat/perks/aftershock.webp",
  crackling: "/game/combat/perks/crackling.webp",
  perfect_equilibrium: "/game/combat/equipment/bow-of-the-last-guardian.webp",
  player_weapon_poison: "/game/upgrades/permanent-unlocks/weapon-poison.webp",
  puncture: "/game/combat/equipment/splintering-arrows.webp",
  "song:essence-corruption": "/game/combat/equipment/roar-of-awakening.webp",
  "ammunition:black-stone": "/game/combat/equipment/black-stone-arrows.webp",
  "ammunition:deathspore": "/game/combat/equipment/deathspore-arrows.webp",
  "ammunition:splintering": "/game/combat/equipment/splintering-arrows.webp",
  "ammunition:bik": "/game/combat/equipment/bik-arrows.webp",
  "ammunition:wen": "/game/combat/equipment/wen-arrows.webp",
  "ammunition:wen-icy-precision": "/game/combat/equipment/wen-arrows.webp",
  "ammunition:ful": "/game/combat/equipment/ful-arrows.webp",
  "ammunition:jas-dragonbane": "/game/combat/equipment/jas-dragonbane-arrows.webp",
  "ammunition:jas-demonbane": "/game/combat/equipment/jas-demonbane-arrows.webp",
  "ammunition:dragonbane": "/game/combat/equipment/dragonbane-arrows.webp",
  "ammunition:opal": "/game/combat/equipment/opal-bakriminel-bolts-e.webp",
  "ammunition:pearl": "/game/combat/equipment/pearl-bakriminel-bolts-e.webp",
  "ammunition:hydrix": "/game/combat/equipment/hydrix-bakriminel-bolts-e.webp",
  "ammunition:ascendri": "/game/combat/equipment/ascendri-bolts-e.webp",
};

const BLESSING_EFFECT_SOURCE: Readonly<Record<string, string>> = {
  "abyssal-cinders": "abyssal-cinders",
  "big-boned": "big-boned",
  "grasp-of-guthix": "tearing-thorns",
  "grasp-of-guthix-big-boned": "big-boned",
  "grasp-of-guthix-max-life": "tearing-thorns",
  "grasp-of-guthix-poison": "tearing-thorns",
  "inferno-of-zamorak": "abyssal-cinders",
  "light-of-saradomin": "striking-light",
};

export function combatEffectDisplayName(id: string): string | null {
  return (
    rangedEffectDisplayName(id) ??
    blessingEffectDisplayName(id) ??
    PROCEDURAL_EFFECT_LABEL[id] ??
    null
  );
}

function blessingEffectIconPath(id: string, blessingId?: string | null): string | null {
  const sourceId = blessingId ?? BLESSING_EFFECT_SOURCE[id];
  if (!sourceId) return null;
  const choice = blessingById(sourceId);
  return choice ? blessingIconPath(choice.name) : null;
}

export function combatEffectIconPath(
  id: string,
  options: { blessingId?: string | null; kind?: string } = {},
): string | null {
  const exact = EFFECT_ICON_PATH[id];
  if (exact) return exact;
  if (options.kind === "league-blessing" || isBlessingDamageEffectId(id)) {
    return blessingEffectIconPath(id, options.blessingId);
  }
  return null;
}

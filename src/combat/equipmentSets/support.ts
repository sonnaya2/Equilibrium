/**
 * Explicit combat set-effect support per catalogue set id (equipment-sets shard).
 * Missing keys resolve to "none" via setEffectSupport - do not infer from item setId tags.
 */

export type SetEffectSupport = "modeled" | "not-modeled" | "outgoing-only" | "none";

export const SET_SUPPORT_BY_ID: Readonly<Record<string, SetEffectSupport>> = {
  tectonic: "modeled",
  "elite-tectonic": "modeled",
  "tumekens-resplendence": "modeled",
  "warpriest-of-tuska": "modeled",
  "first-necromancer": "outgoing-only",
  "vestments-of-havoc": "modeled",
  "song-of-destruction": "modeled",
  dracolich: "modeled",
  "elite-dracolich": "modeled",
  sirenic: "not-modeled",
  "elite-sirenic": "not-modeled",
  "deathdealer-70": "outgoing-only",
  "deathdealer-80": "outgoing-only",
  "deathdealer-90": "outgoing-only",
  "anima-core-sliske": "not-modeled",
  "refined-anima-core-sliske": "not-modeled",
  "trimmed-masterwork": "outgoing-only",
};

/** Lookup support for a catalogue set def. Undefined def => not-modeled (as before). */
export function setEffectSupport(def: { id: string } | undefined): SetEffectSupport {
  if (!def) return "not-modeled";
  return SET_SUPPORT_BY_ID[def.id] ?? "none";
}

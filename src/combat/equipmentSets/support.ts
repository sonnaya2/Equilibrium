/**
 * Explicit combat set-effect support per catalogue set id (equipment-sets shard).
 * Missing keys resolve to "none" via setEffectSupport - do not infer from item setId tags.
 */

export type SetEffectSupport = "modeled" | "not-modeled" | "outgoing-only" | "none";

export const SET_SUPPORT_BY_ID: Readonly<Record<string, SetEffectSupport>> = {
  tectonic: "modeled",
  "elite-tectonic": "modeled",
  "tumekens-resplendence": "modeled",
  "first-necromancer": "modeled",
  "vestments-of-havoc": "modeled",
  sirenic: "not-modeled",
  "elite-sirenic": "not-modeled",
  "deathdealer-90": "not-modeled",
  "anima-core-sliske": "not-modeled",
  "refined-anima-core-sliske": "not-modeled",
  "trimmed-masterwork": "outgoing-only",
};

/** Lookup support for a catalogue set def. Undefined def => not-modeled (as before). */
export function setEffectSupport(def: { id: string } | undefined): SetEffectSupport {
  if (!def) return "not-modeled";
  return SET_SUPPORT_BY_ID[def.id] ?? "none";
}

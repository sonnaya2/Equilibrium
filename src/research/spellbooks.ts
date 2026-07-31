import spellbookSource from "#shard/reference/spellbooks.json";

export type SpellbookRecord = (typeof spellbookSource)["spellbooks"][number];
export type SpecialMagicSystem = (typeof spellbookSource)["special_magic_systems"][number];

export function getSpellbooks(): SpellbookRecord[] {
  return spellbookSource.spellbooks;
}

export function getSpellbook(id: SpellbookRecord["id"]): SpellbookRecord | undefined {
  return spellbookSource.spellbooks.find((book) => book.id === id);
}

export function getSpecialMagicSystems(): SpecialMagicSystem[] {
  return spellbookSource.special_magic_systems;
}

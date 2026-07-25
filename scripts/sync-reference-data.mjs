import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();

function read(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function canonicalize(value) {
  const serialized = JSON.stringify(value)
    .replaceAll("Asgarnia + Troll Country", "Asgarnia")
    .replaceAll("Troll Country", "Asgarnia");
  return JSON.parse(serialized);
}

function write(path, value) {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(canonicalize(value), null, 2)}\n`);
}

function mergeAddition(target, addition) {
  if (typeof addition?.id !== "string" || !addition.id) throw new Error("Progression enrichment addition is missing id");
  const index = target.findIndex((row) => row.id === addition.id);
  if (index < 0) target.push(addition);
  else target[index] = { ...addition, ...target[index] };
}

function applyEnrichment(progressionUnlocks, enrichment, sourceName) {
  progressionUnlocks.account_unlocks ||= [];
  progressionUnlocks.activity_unlocks ||= [];
  progressionUnlocks.equipment_models ||= [];
  progressionUnlocks.consumable_unlocks ||= [];
  progressionUnlocks.ability_unlocks ||= [];
  progressionUnlocks.prayer_unlocks ||= [];

  const excluded = new Set(enrichment.policy?.activity_exclusions ?? []);
  progressionUnlocks.activity_unlocks = progressionUnlocks.activity_unlocks.filter((row) => !excluded.has(row.id));

  for (const patch of enrichment.activity_patches ?? []) {
    const row = progressionUnlocks.activity_unlocks.find((entry) => entry.id === patch.id);
    if (!row) throw new Error(`Progression enrichment patch target not found in ${sourceName}: ${patch.id}`);
    Object.assign(row, patch.set ?? {});
    if (Array.isArray(row.source_urls) && row.source_url) delete row.source_url;
  }

  for (const addition of enrichment.activity_additions ?? []) mergeAddition(progressionUnlocks.activity_unlocks, addition);
  for (const addition of enrichment.account_additions ?? []) mergeAddition(progressionUnlocks.account_unlocks, addition);
  for (const addition of enrichment.equipment_additions ?? []) mergeAddition(progressionUnlocks.equipment_models, addition);
  for (const addition of enrichment.consumable_additions ?? []) mergeAddition(progressionUnlocks.consumable_unlocks, addition);
  for (const addition of enrichment.ability_additions ?? []) mergeAddition(progressionUnlocks.ability_unlocks, addition);
  for (const addition of enrichment.prayer_additions ?? []) mergeAddition(progressionUnlocks.prayer_unlocks, addition);

  progressionUnlocks.snapshot_date = [progressionUnlocks.snapshot_date, enrichment.snapshot_date].filter(Boolean).sort().at(-1);
}

function enrichPrayerCatalogue(prayerSource, details) {
  const enriched = structuredClone(prayerSource);
  enriched.purpose = "Complete current prayer catalogue with effects and normal-game region dependencies for Equilibrium planning.";
  enriched.region_methodology = details.region_methodology;
  enriched.sources = details.sources;
  enriched.unlock_profiles = details.unlock_profiles;

  for (const book of enriched.books) {
    const defaultProfileId = details.default_profile_by_book?.[book.id];
    if (!defaultProfileId) throw new Error(`Prayer details are missing a default unlock profile for ${book.id}`);

    for (const prayer of book.prayers) {
      const overrideKey = `${book.id}:${prayer.name}`;
      const profileId = details.profile_overrides?.[overrideKey] ?? defaultProfileId;
      const profile = details.unlock_profiles?.[profileId];
      const effect = details.effects?.[prayer.name];
      if (!profile) throw new Error(`Prayer details are missing unlock profile ${profileId} for ${overrideKey}`);
      if (typeof effect !== "string" || !effect.trim()) throw new Error(`Prayer details are missing an effect for ${overrideKey}`);

      const baseSourceRef = book.id === "standard-prayers" ? "prayer" : "curses";
      prayer.effect = effect;
      prayer.required_regions = [...profile.required_regions];
      prayer.region_requirement_type = profile.region_requirement_type;
      prayer.unlock_profile_id = profileId;
      prayer.unlock_requirements = [...profile.requirements];
      prayer.source_refs = [...new Set([baseSourceRef, ...(profile.source_refs ?? [])])];
      if (profile.acquisition_location_region) prayer.acquisition_location_region = profile.acquisition_location_region;
    }
  }

  return enriched;
}

const combat = read("scraped-data/combat-2026.json");
const combatAbilityAudit = read("scraped-data/combat-ability-audit-2026-07-24.json");
const catalyst = read("scraped-data/catalyst.json");
const changes = read("scraped-data/2026-changes.json");
const rebalance = read("scraped-data/midgame-rebalance-2026-07-20.json");
const progressionUnlocks = read("scraped-data/progression-unlocks.json");
const prayerBooks = read("scraped-data/prayer-books.json");
const prayerSource = read("scraped-data/prayers.json");
const prayerDetails = read("scraped-data/prayer-effects-regions.json");
const prayers = enrichPrayerCatalogue(prayerSource, prayerDetails);
const spellbooks = read("scraped-data/spellbooks.json");
const regionDependencies = read("scraped-data/region-dependencies.json");
const referenceHarvest = read("scraped-data/reference-site-harvest.json");
const masterworkStaffChain = read("scraped-data/masterwork-staff-chain.json");
const unknowns = read("scraped-data/unknowns.json");

const progressionAuditPath = join(ROOT, "scraped-data/progression-unlocks-audit-2026-07-24.json");
if (existsSync(progressionAuditPath)) {
  const progressionAudit = JSON.parse(readFileSync(progressionAuditPath, "utf8"));
  const knownQuestIds = new Set(progressionUnlocks.quest_unlocks.map((row) => row.id));
  const knownActivityIds = new Set(progressionUnlocks.activity_unlocks.map((row) => row.id));

  for (const addition of progressionAudit.quest_unlock_additions ?? []) {
    if (typeof addition.id !== "string" || !addition.id) throw new Error("Progression quest unlock audit addition is missing id");
    if (!knownQuestIds.has(addition.id)) {
      progressionUnlocks.quest_unlocks.push(addition);
      knownQuestIds.add(addition.id);
    }
  }

  for (const addition of progressionAudit.activity_unlock_additions ?? []) {
    if (typeof addition.id !== "string" || !addition.id) throw new Error("Progression activity unlock audit addition is missing id");
    if (!knownActivityIds.has(addition.id)) {
      progressionUnlocks.activity_unlocks.push(addition);
      knownActivityIds.add(addition.id);
    }
  }
}

const enrichmentFiles = readdirSync(join(ROOT, "scraped-data"))
  .filter((name) => /^progression-enrichment-.*\.json$/.test(name))
  .sort();
for (const file of enrichmentFiles) {
  applyEnrichment(progressionUnlocks, read(`scraped-data/${file}`), file);
}

write("data/combat/modernisation-2026.json", combat);
write("data/combat/ability-audit-2026-07-24.json", combatAbilityAudit);
write("data/league/catalyst.json", catalyst);
write("data/league/region-dependencies.json", regionDependencies);
write("data/reference/changes-2026.json", changes);
write("data/reference/midgame-rebalance-2026-07-20.json", rebalance);
write("data/reference/progression-unlocks.json", progressionUnlocks);
write("data/reference/prayer-books.json", prayerBooks);
write("data/reference/prayers.json", prayers);
write("data/reference/spellbooks.json", spellbooks);
write("data/research/reference-site-harvest.json", referenceHarvest);
write("data/research/masterwork-staff-chain.json", masterworkStaffChain);
write("data/reference/unknowns.json", unknowns);

console.log(`REFERENCE DATA SYNC
Combat system data, audited ability records, Catalyst, region dependencies, 2026 changes, mid-game rebalance, permanent unlocks, prayer books, prayer effects and region dependencies, spellbooks, ${enrichmentFiles.length} progression enrichment overlay(s), reference research, Masterwork staff chain and unknowns updated.`);

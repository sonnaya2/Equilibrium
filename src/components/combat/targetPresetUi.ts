import { combatTargetPresets, targetPresetById } from "@/combat/data";
import type { TargetPresetRecord } from "@/combat/data";
import {
  materializeTargetPreset,
  targetDiffersFromPreset,
} from "@/combat/target/presetAdapter";
import type { CombatStyle } from "@/combat/types";
import { bossIconPath } from "@/lib/gameArt";
import type { LoadoutTarget } from "./loadout/model";

export interface TargetPresetOption {
  id: string;
  name: string;
  encounter: string;
  aliases: string[];
  support: TargetPresetRecord["support"];
  searchText: string;
  /** Published /game/bosses plate when indexed; null means empty well. */
  iconSrc: string | null;
  /** False when materialize refuses (missing Aff profile). */
  applyable: boolean;
}

function searchable(record: TargetPresetRecord): string {
  return [record.name, record.encounter, ...(record.aliases ?? []), record.id]
    .join(" ")
    .toLowerCase();
}

/** Resolve Jagex boss plate from catalogue name (never invent art). */
export function targetPresetIconPath(name: string): string | null {
  return bossIconPath(name);
}

function isApplyable(record: TargetPresetRecord): boolean {
  if (record.support === "unsupported") return false;
  return materializeTargetPreset(record, { style: "melee" }) != null;
}

/** Supported and provisional presets available in the selector. */
export function listTargetPresetOptions(): TargetPresetOption[] {
  return combatTargetPresets.records
    .filter((r) => r.support !== "unsupported")
    .map((r) => ({
      id: r.id,
      name: r.name,
      encounter: r.encounter,
      aliases: r.aliases ?? [],
      support: r.support,
      searchText: searchable(r),
      iconSrc: targetPresetIconPath(r.name),
      applyable: isApplyable(r),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterTargetPresetOptions(
  options: readonly TargetPresetOption[],
  query: string,
): TargetPresetOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter((o) => o.searchText.includes(q));
}

/** Apply a catalogue preset into loadout target fields for the current style. */
export function applyTargetPreset(
  presetId: string,
  style: CombatStyle,
  previous: LoadoutTarget | null,
): LoadoutTarget | null {
  const preset = targetPresetById(presetId);
  if (!preset) return previous;
  // Style affinity only; Mark uses hasApplicableWeakness + weaknessAffinity at DP time.
  const fields = materializeTargetPreset(preset, { style });
  if (!fields) return previous;
  return {
    defenceLevel: fields.defenceLevel,
    armour: fields.armour,
    affinity: fields.affinity,
    additiveHitChance: previous?.additiveHitChance ?? 0,
    targetPresetId: presetId,
    ...(fields.weaknessAffinity != null ? { weaknessAffinity: fields.weaknessAffinity } : {}),
    ...(fields.size != null ? { size: fields.size } : {}),
    ...(fields.maximumLifePoints != null ? { maximumLifePoints: fields.maximumLifePoints } : {}),
    ...(fields.poisonImmune === true ? { poisonImmune: true } : {}),
    ...(fields.undead === true ? { undead: true } : {}),
    ...(fields.demon === true ? { demon: true } : {}),
    ...(fields.dragon === true ? { dragon: true } : {}),
    // Scenario fields stay player-owned (Mark applicability is not baked into Aff)
    ...(previous?.hasApplicableWeakness ? { hasApplicableWeakness: true } : {}),
    ...(previous?.onSlayerTask ? { onSlayerTask: true } : {}),
    ...(previous?.hpPercent != null ? { hpPercent: previous.hpPercent } : {}),
    ...(previous?.occupiedTiles != null ? { occupiedTiles: previous.occupiedTiles } : {}),
    ...(previous?.areaTargets != null ? { areaTargets: previous.areaTargets } : {}),
    ...(previous?.incomingHitIntervalSeconds != null
      ? { incomingHitIntervalSeconds: previous.incomingHitIntervalSeconds }
      : {}),
    ...(previous?.incomingHitDamage != null
      ? { incomingHitDamage: previous.incomingHitDamage }
      : {}),
    ...(previous?.damagePotentialOverride != null
      ? { damagePotentialOverride: previous.damagePotentialOverride }
      : {}),
  };
}

export function isTargetModifiedFromPreset(
  target: LoadoutTarget,
  style: CombatStyle,
): boolean {
  if (!target.targetPresetId) return false;
  const preset = targetPresetById(target.targetPresetId);
  if (!preset) return true;
  const fields = materializeTargetPreset(preset, { style });
  if (!fields) return true;
  return targetDiffersFromPreset(target, fields);
}

export function resetTargetToPreset(
  target: LoadoutTarget,
  style: CombatStyle,
): LoadoutTarget {
  if (!target.targetPresetId) return target;
  return applyTargetPreset(target.targetPresetId, style, target) ?? target;
}

export function presetLabel(presetId: string | undefined): string | null {
  if (!presetId) return null;
  const preset = targetPresetById(presetId);
  if (!preset) return `Unknown preset (${presetId})`;
  return preset.name;
}

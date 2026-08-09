import { combatTargetPresets, targetPresetById } from "@/combat/data";
import type { TargetPresetRecord } from "@/combat/data";
import {
  materializeTargetPreset,
  targetDiffersFromPreset,
} from "@/combat/target/presetAdapter";
import type { CombatStyle } from "@/combat/types";
import type { LoadoutTarget } from "./loadout/model";

export interface TargetPresetOption {
  id: string;
  name: string;
  encounter: string;
  aliases: string[];
  support: TargetPresetRecord["support"];
  searchText: string;
}

function searchable(record: TargetPresetRecord): string {
  return [record.name, record.encounter, ...(record.aliases ?? []), record.id]
    .join(" ")
    .toLowerCase();
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
  const fields = materializeTargetPreset(preset, {
    style,
    useWeaknessAffinity: previous?.hasApplicableWeakness === true,
  });
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
    // Scenario fields stay player-owned
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

/** Restyle affinity from the same preset when style changes and target is unmodified. */
export function restyleTargetFromPreset(
  target: LoadoutTarget,
  style: CombatStyle,
): LoadoutTarget {
  if (!target.targetPresetId) return target;
  const preset = targetPresetById(target.targetPresetId);
  if (!preset) return target;
  const fields = materializeTargetPreset(preset, {
    style,
    useWeaknessAffinity: target.hasApplicableWeakness === true,
  });
  if (!fields) return target;
  if (
    targetDiffersFromPreset(
      {
        defenceLevel: target.defenceLevel,
        armour: target.armour,
        affinity: target.affinity,
        size: target.size,
        maximumLifePoints: target.maximumLifePoints,
        poisonImmune: target.poisonImmune,
        undead: target.undead,
        demon: target.demon,
        dragon: target.dragon,
      },
      // Compare against previous style materialization is wrong; only restyle if
      // current matches the stored style-agnostic fields except affinity.
      {
        ...fields,
        affinity: target.affinity,
      },
    )
  ) {
    // Modified: keep affinity override, still update nothing from style switch
    return target;
  }
  return {
    ...target,
    affinity: fields.affinity,
    ...(fields.weaknessAffinity != null ? { weaknessAffinity: fields.weaknessAffinity } : {}),
  };
}

export function isTargetModifiedFromPreset(
  target: LoadoutTarget,
  style: CombatStyle,
): boolean {
  if (!target.targetPresetId) return false;
  const preset = targetPresetById(target.targetPresetId);
  if (!preset) return true;
  const fields = materializeTargetPreset(preset, {
    style,
    useWeaknessAffinity: target.hasApplicableWeakness === true,
  });
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

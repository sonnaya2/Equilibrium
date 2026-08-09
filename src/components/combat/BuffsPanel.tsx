"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import {
  MAX_FIREMAKING_LEVEL,
  formatRingOfVigourSources,
  isRingOfVigourWorn,
  ringOfVigourActiveSources,
} from "@/combat";
import { EQUIPMENT_ENCHANTMENTS, type EquipmentEnchantmentId } from "@/combat/shared/equipment";
import {
  SLAYER_HELMET_TIERS,
  resolveSlayerHelmet,
  type SlayerHelmetTierId,
} from "@/combat/shared/slayerHelmet";
import { resolveSalve } from "@/combat/shared/salveAmulet";
import {
  BLESSING_PATHS,
  PATH_TIERS,
  activeTierPassives,
  activeBlessings,
  blessingChoice,
  godTierChoice,
  blessingTierRevealed,
  deriveGodTier,
  type BlessingPath,
  type BlessingSupportStatus,
} from "@/league/blessings";
import { isRegionUnlocked, REGION_IDS } from "@/league";
import relicsData from "#shard/league/relics.json";
import { useBuild } from "@/league/useBuild";
import { GameIcon } from "../GameIcon";
import { NumberField } from "./NumberField";
import type { ResolvedStats } from "./ResolvedSummary";
import { ICYENIC_FAITH_RELIC, TOME_OF_THE_ICYENE_ID } from "@/combat/league/icyenicFaith";
import { NARAGI_EDICT_RELIC, SLIVER_OF_EDICTS_ID } from "@/combat/league/naragiEdict";
import { relicIconPath } from "@/lib/gameArt";
import {
  BONFIRE_LOGS,
  activatePowerburstOfVitality,
  equipGrantedItemForRelic,
  equipmentIdList,
  isPowerburstOfVitalityActive,
  isPowerburstOfVitalityReady,
  syncRelicGrantedEquipment,
  syncRelicGrantedEquipmentWithAutoEquip,
  toggleEquipmentEnchantment,
  withLoadoutBuffs,
  type Loadout,
  type OverloadChoice,
  type SetLoadout,
} from "./useLoadout";

const VULNERABILITY_ICON = "/game/upgrades/combat-utility/vulnerability-bomb.webp";
const OVERLOAD_ICON: Record<Exclude<OverloadChoice, "none">, string> = {
  overload: "/game/upgrades/skilling-production/overload.webp",
  supreme: "/game/upgrades/skilling-production/supreme-overload-potion.webp",
  elder: "/game/upgrades/skilling-production/elder-overload-potion.webp",
};
const ENCHANTMENT_ICON = (id: EquipmentEnchantmentId) => `/game/upgrades/enchantments/${id}.webp`;
const LIFE_ICON = {
  fortitude: "/game/combat/prayers/ancient-curses/fortitude.webp",
  protectionPrayer: "/game/combat/prayers/standard/protect-from-necromancy.webp",
  reaperCrew: "/game/upgrades/permanent-unlocks/reaper-crew.webp",
  fontOfLife: "/game/upgrades/permanent-unlocks/font-of-life.webp",
  boonOfHet: "/game/upgrades/permanent-unlocks/blessing-of-het.webp",
  totemOfVitality: "/game/upgrades/permanent-unlocks/totem-of-vitality.webp",
  powerburstOfVitality: "/game/upgrades/skilling-production/powerburst-of-vitality.webp",
} as const;
const RING_OF_VIGOUR_PASSIVE_ICON = "/game/upgrades/permanent-unlocks/ring-of-vigour.webp";
const SPECTRAL_LENS_ICON = "/game/upgrades/permanent-unlocks/slayer-helmet.webp";
const ELITE_SEERS_VILLAGE_ICON = "/game/upgrades/permanent-unlocks/seers-village-achievements.webp";

const T7_RELIC_TIER = 7;
type Tier7RelicChoice = { name: string; effects: readonly string[]; seat: number | null };
const T7_RELIC_CHOICES: readonly Tier7RelicChoice[] = (() => {
  const tier = relicsData.records.find((row) => row.tier === T7_RELIC_TIER);
  if (!tier?.revealed || !Array.isArray(tier.choices)) return [];
  return tier.choices
    .filter((c) => typeof c?.name === "string" && c.name.length > 0)
    .map((c) => ({
      name: c.name,
      effects: Array.isArray(c.effects)
        ? c.effects.filter((e): e is string => typeof e === "string")
        : [],
      seat:
        typeof (c as { seat?: unknown }).seat === "number" ? (c as { seat: number }).seat : null,
    }))
    .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
})();
const SKILLCAPE_ICON = {
  strength: "/game/skills/strength.webp",
  attack: "/game/skills/attack.webp",
  ranged: "/game/skills/ranged.webp",
} as const;
const ENCHANTMENTS: Record<EquipmentEnchantmentId, { label: string; effect: string }> = {
  agony: {
    label: "Agony",
    effect: "Enhances Enduring Ruin while enhanced Gloves of Passage are equipped",
  },
  heroism: {
    label: "Heroism",
    effect: "Champion's ring: 4% crit chance and +1.5% crit damage per active bleed",
  },
  shadows: {
    label: "Shadows",
    effect: "Stalker's ring with a bow: 4% crit chance and +3% crit damage",
  },
  metaphysics: {
    label: "Metaphysics",
    effect: "Channeller's ring: +2.5% crit damage for each successive channel hit",
  },
};

const OVERLOAD_OPTIONS: Array<{
  value: Exclude<OverloadChoice, "none">;
  label: string;
  effect: string;
}> = [
  { value: "overload", label: "Overload", effect: "+15% of level +3 to every combat stat" },
  { value: "supreme", label: "Supreme overload", effect: "+16% of level +4 to every combat stat" },
  { value: "elder", label: "Elder overload", effect: "+17% of level +5 to every combat stat" },
];

const BLESSING_SUPPORT_LABEL: Record<BlessingSupportStatus, string> = {
  modeled: "Active",
  "partially-modeled": "Partial",
  "not-modeled": "Unmodeled",
  "scenario-dependent": "Scenario",
};

/** Icon toggle. Name and effect live in the tooltip; sr-only text carries the a11y name. */
function BuffTile({
  icon,
  label,
  effect,
  pressed,
  onClick,
  fallback = "None",
  disabled = false,
}: {
  icon: string | null;
  label: string;
  effect: string;
  pressed: boolean;
  onClick: () => void;
  fallback?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-pressed={pressed}
      aria-disabled={disabled}
      className={`icon-tile${icon ? "" : " icon-tile--text"}${disabled ? " is-disabled" : ""}`}
    >
      {icon ? (
        <GameIcon src={icon} size={34} className="icon-tile__icon" />
      ) : (
        <span>{fallback}</span>
      )}
      <span className="sr-only">
        {label}: {effect}
      </span>
      <span className="icon-tip" role="tooltip">
        <strong>{label}</strong>
        {effect}
      </span>
    </button>
  );
}

function CombatValueLabel({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="setup-stat-label">
      <GameIcon src={icon} size={20} />
      <span>{children}</span>
    </span>
  );
}

function CombatValues({
  loadout,
  setLoadout,
  stats,
}: {
  loadout: Loadout;
  setLoadout: SetLoadout;
  stats: ResolvedStats;
}) {
  const damagePotential =
    loadout.target?.damagePotentialOverride == null
      ? loadout.accuracy
      : loadout.target.damagePotentialOverride * 100;

  return (
    <section className="buff-combat-values" role="group" aria-label="Combat values">
      <NumberField
        label={
          <CombatValueLabel icon="/game/skills/constitution.webp">
            Current Hitpoints
          </CombatValueLabel>
        }
        value={loadout.currentLife ?? stats.life.currentLife}
        min={0}
        max={stats.life.overhealCeiling}
        onChange={(currentLife) => {
          const maximumLife = stats.life.temporaryMaxLife;
          setLoadout({
            ...loadout,
            currentLife,
            currentHealthPercent:
              maximumLife > 0
                ? Math.min(100, Math.max(0, (currentLife / maximumLife) * 100))
                : loadout.currentHealthPercent,
          });
        }}
      />
      <NumberField
        label={
          <CombatValueLabel icon="/game/skills/attack.webp">Damage Potential</CombatValueLabel>
        }
        value={damagePotential}
        min={0}
        max={100}
        suffix="%"
        onChange={(value) => {
          if (loadout.target) {
            setLoadout({
              ...loadout,
              target: {
                ...loadout.target,
                damagePotentialOverride: Math.min(1, Math.max(0, value / 100)),
              },
            });
            return;
          }
          setLoadout({ ...loadout, accuracy: value });
        }}
      />
      <NumberField
        label={
          <CombatValueLabel icon="/game/combat/critical-strike.webp">Crit chance</CombatValueLabel>
        }
        value={loadout.critChance}
        suffix="%"
        onChange={(value) => setLoadout({ ...loadout, critChance: value })}
      />
      <label className="loadout-check setup-input-check">
        <input
          type="checkbox"
          checked={loadout.hitCapEnabled}
          onChange={(event) => setLoadout({ ...loadout, hitCapEnabled: event.target.checked })}
        />
        Hit cap
      </label>
    </section>
  );
}

/** Player-toggled buffs - wiki numbers only. */
export function BuffsPanel({
  loadout,
  setLoadout,
  stats,
}: {
  loadout: Loadout;
  setLoadout: SetLoadout;
  stats: ResolvedStats;
}) {
  const powerburstActive = isPowerburstOfVitalityActive(loadout);
  const powerburstReady = isPowerburstOfVitalityReady(loadout);
  const { build, loaded: buildLoaded, pickBlessing, toggleRelic } = useBuild();
  const unlockedRegions = useMemo(
    () => REGION_IDS.filter((id) => isRegionUnlocked(build, id)),
    [build],
  );
  const setBuffs = (patch: Partial<Loadout["buffs"]>) =>
    setLoadout((prev) => withLoadoutBuffs(prev, patch, unlockedRegions));
  const revealedBlessingTiers = PATH_TIERS.filter(blessingTierRevealed);
  const godAlignment = deriveGodTier(build.blessingPicks.slice(0, 3));
  const godBlessing = godAlignment ? godTierChoice(1, godAlignment) : undefined;
  const selectedBlessings = activeBlessings(build.blessingPicks);
  const selectedTierPassives = activeTierPassives(build.blessingPicks);
  const t7Picked = build.relics[String(T7_RELIC_TIER)] ?? null;
  const icyenicPicked = t7Picked === ICYENIC_FAITH_RELIC;
  const naragiPicked = t7Picked === NARAGI_EDICT_RELIC;
  const tomeEquipped = loadout.equipmentSlots.pocket === TOME_OF_THE_ICYENE_ID;
  const sliverEquipped = loadout.equipmentSlots.pocket === SLIVER_OF_EDICTS_ID;
  const activeRelicNames = useMemo(
    () =>
      Object.values(build.relics).filter((n): n is string => typeof n === "string" && n.length > 0),
    [build.relics],
  );

  // Drop relic-granted gear when its T7 relic is not selected (import / deselect / swap).
  useEffect(() => {
    setLoadout((prev) => syncRelicGrantedEquipmentWithAutoEquip(prev, activeRelicNames));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRelicNames.join("\0")]);
  const anachroniaUnlocked = isRegionUnlocked(build, "anachronia");
  const desertUnlocked = isRegionUnlocked(build, "desert");
  const assassinInsight = activeRelicNames.includes("Assassin's Insight");
  const automaticSlayerStand = assassinInsight ? "corrupted" : loadout.buffs.slayerHelmetStand;
  // Worn = ring slot only. Unlock pins in equipmentIds must not count as equipped.
  const slottedIds = equipmentIdList(loadout.equipmentSlots);
  const ringEquipped = isRingOfVigourWorn(slottedIds);
  const vigourSources = ringOfVigourActiveSources({
    equipmentIds: slottedIds,
    ringOfVigourPassive: anachroniaUnlocked,
    unlockedRegions: anachroniaUnlocked ? ["anachronia"] : [],
  });

  // Region removed: clear persisted passive so it cannot re-activate without Anachronia.
  useEffect(() => {
    if (!anachroniaUnlocked && loadout.buffs.ringOfVigourPassive) {
      setLoadout((prev) => withLoadoutBuffs(prev, { ringOfVigourPassive: false }, unlockedRegions));
    }
    // Narrow deps: only region unlock + passive flag, not every loadout field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anachroniaUnlocked, loadout.buffs.ringOfVigourPassive]);

  // Helmet stand needs Anachronia (tier-3 Lodge). Equipped helmet is unaffected.
  useEffect(() => {
    if (!anachroniaUnlocked && loadout.buffs.slayerHelmetStand != null) {
      setLoadout((prev) => withLoadoutBuffs(prev, { slayerHelmetStand: null }, unlockedRegions));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anachroniaUnlocked, loadout.buffs.slayerHelmetStand]);

  const helmEquipped =
    typeof loadout.equipmentSlots.helmet === "string" &&
    SLAYER_HELMET_TIERS.some((t) => t.itemId === loadout.equipmentSlots.helmet);
  const slayerResolved = resolveSlayerHelmet({
    equipmentSlots: loadout.equipmentSlots,
    standTier: automaticSlayerStand,
    unlockedRegions: assassinInsight ? undefined : anachroniaUnlocked ? ["anachronia"] : [],
    onSlayerTask: loadout.target?.onSlayerTask === true,
    style: loadout.style,
    ensouledSpectralLens: loadout.buffs.ensouledSpectralLens,
  });
  const salveResolved = resolveSalve({
    equipmentSlots: loadout.equipmentSlots,
    targetUndead: loadout.target?.undead === true,
  });

  /** One pick per tier: replace any other T7; auto-equip that relic's granted pocket item. */
  const toggleTier7Relic = (name: string) => {
    if (!buildLoaded) return;
    const wasActive = t7Picked === name;
    toggleRelic(T7_RELIC_TIER, name);
    if (wasActive) {
      // Deselect: drop T7 key, then strip granted pocket items.
      const nextNames = Object.entries(build.relics)
        .filter(([tier, n]) => tier !== String(T7_RELIC_TIER) && typeof n === "string")
        .map(([, n]) => n as string);
      setLoadout((prev) => syncRelicGrantedEquipment(prev, nextNames));
      return;
    }
    const nextNames = {
      ...Object.fromEntries(
        Object.entries(build.relics).filter(([tier]) => tier !== String(T7_RELIC_TIER)),
      ),
      [String(T7_RELIC_TIER)]: name,
    };
    const active = Object.values(nextNames).filter(
      (n): n is string => typeof n === "string" && n.length > 0,
    );
    setLoadout((prev) => equipGrantedItemForRelic(prev, name, active));
  };

  return (
    <div className="loadout-panel loadout-panel-wide buffs-panel">
      <CombatValues loadout={loadout} setLoadout={setLoadout} stats={stats} />

      <div className="buffs-panel__cols">
        <div className="buffs-panel__col">
          <div className="buff-group buff-target" role="group" aria-label="Target debuff">
            <h3 className="buff-group__title">Debuff</h3>
            <div className="icon-tile-grid">
              <label className={`icon-tile${loadout.buffs.vulnerability ? " is-on" : ""}`}>
                {/* Real checkbox, transparent over the whole tile: keeps the a11y name e2e
                    pins while staying a full-size click target. */}
                <input
                  type="checkbox"
                  className="icon-tile__input"
                  checked={loadout.buffs.vulnerability}
                  onChange={(event) => setBuffs({ vulnerability: event.target.checked })}
                />
                <GameIcon src={VULNERABILITY_ICON} size={34} className="icon-tile__icon" />
                <span className="sr-only">Vulnerability: +10% damage taken</span>
                <span className="icon-tip" role="tooltip">
                  <strong>Vulnerability</strong>+10% damage taken by the target
                </span>
              </label>
            </div>
          </div>

          <div className="buff-group" role="group" aria-label="Player poison">
            <h3 className="buff-group__title">Poison</h3>
            <div className="blessing-settings mt-1.5">
              <label className="loadout-select">
                <span>Weapon poison potion</span>
                <select
                  aria-label="Weapon poison potion"
                  value={loadout.buffs.weaponPoison}
                  onChange={(event) =>
                    setBuffs({
                      weaponPoison: event.target.value as Loadout["buffs"]["weaponPoison"],
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="weapon">Weapon poison</option>
                  <option value="weapon-plus">Weapon poison+</option>
                  <option value="weapon-plus-plus">Weapon poison++</option>
                  <option value="weapon-plus-plus-plus">Weapon poison+++</option>
                </select>
              </label>
              <label className="loadout-select">
                <span>Kwuarm potency</span>
                <select
                  aria-label="Kwuarm potency"
                  value={loadout.buffs.kwuarmPotency}
                  onChange={(event) =>
                    setBuffs({
                      kwuarmPotency: Number(
                        event.target.value,
                      ) as Loadout["buffs"]["kwuarmPotency"],
                    })
                  }
                >
                  {[0, 1, 2, 3, 4].map((potency) => (
                    <option key={potency} value={potency}>
                      {potency === 0 ? "Off" : `${potency} (${potency * 2.5}%)`}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="Herblore level"
                value={loadout.buffs.herbloreLevel}
                min={1}
                max={120}
                onChange={(herbloreLevel) => setBuffs({ herbloreLevel })}
              />
            </div>
          </div>

          <div className="buff-group buff-t7-relics" role="group" aria-label="Tier 7 relics">
            <h3 className="buff-group__title">Tier 7 relics</h3>
            <div className="icon-tile-grid icon-tile-grid--t7">
              {T7_RELIC_CHOICES.length === 0 ? (
                <p className="text-[11px] text-parch-300">No T7 relics revealed yet.</p>
              ) : (
                T7_RELIC_CHOICES.map((relic) => {
                  const active = t7Picked === relic.name;
                  const isIcyenic = relic.name === ICYENIC_FAITH_RELIC;
                  const isNaragi = relic.name === NARAGI_EDICT_RELIC;
                  const effects = Array.isArray(relic.effects) ? relic.effects : [];
                  const effectText =
                    effects.length > 0
                      ? effects.join(" ")
                      : isIcyenic
                        ? "Tome of the Icyene · prayer crit and base AD scaling"
                        : isNaragi
                          ? "Sliver of Edicts · heals, levels 255, one revive"
                          : relic.name;
                  let status = effectText;
                  if (active && isIcyenic) {
                    status = tomeEquipped
                      ? `${effectText} · Tome worn`
                      : `${effectText} · equip Tome for scaling`;
                  } else if (active && isNaragi) {
                    status = sliverEquipped
                      ? `${effectText} · Sliver worn`
                      : `${effectText} · equip Sliver in pocket`;
                  }
                  return (
                    <BuffTile
                      key={relic.name}
                      icon={relicIconPath(relic.name)}
                      label={relic.name}
                      effect={status}
                      pressed={active}
                      disabled={!buildLoaded}
                      onClick={() => toggleTier7Relic(relic.name)}
                    />
                  );
                })
              )}
              {icyenicPicked ? (
                <BuffTile
                  icon={LIFE_ICON.protectionPrayer}
                  label="Protect / deflect"
                  effect="100% block of qualifying incoming hits; Soul Split-on-protect from damage dealt"
                  pressed={loadout.buffs.protectionPrayer}
                  onClick={() => setBuffs({ protectionPrayer: !loadout.buffs.protectionPrayer })}
                />
              ) : null}
              {naragiPicked && sliverEquipped ? (
                <BuffTile
                  icon={LIFE_ICON.powerburstOfVitality}
                  label="Sliver activate"
                  effect="90s CD · 16.8s · four 10,000 Hitpoints heals · levels 255 · one revive"
                  pressed={false}
                  disabled
                  onClick={() => undefined}
                />
              ) : null}
            </div>
          </div>

          <div className="buff-group buff-overload" role="group" aria-label="Overload">
            <h3 className="buff-group__title">Overload</h3>
            <div className="icon-tile-grid">
              <BuffTile
                icon={null}
                label="No overload"
                effect="Unboosted combat stats"
                pressed={loadout.buffs.overload === "none"}
                onClick={() => setBuffs({ overload: "none" })}
              />
              {OVERLOAD_OPTIONS.map((opt) => (
                <BuffTile
                  key={opt.value}
                  icon={OVERLOAD_ICON[opt.value]}
                  label={opt.label}
                  effect={opt.effect}
                  pressed={loadout.buffs.overload === opt.value}
                  onClick={() =>
                    setBuffs({
                      overload: loadout.buffs.overload === opt.value ? "none" : opt.value,
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div className="buff-group buff-skillcapes" role="group" aria-label="Skillcape perks">
            <h3 className="buff-group__title">Skillcape perks</h3>
            <div className="icon-tile-grid">
              <BuffTile
                icon={SKILLCAPE_ICON.strength}
                label="Strength cape (99)"
                effect="Automatic from base Strength 99: Dismember deals three extra bleed hits"
                pressed={loadout.strengthLevel >= 99}
                disabled
                onClick={() => undefined}
              />
              <BuffTile
                icon={SKILLCAPE_ICON.attack}
                label="Attack cape (120)"
                effect="Automatic from base Attack 120: +2% melee hit chance"
                pressed={loadout.attackLevel >= 120}
                disabled
                onClick={() => undefined}
              />
              <BuffTile
                icon={SKILLCAPE_ICON.ranged}
                label="Ranged cape (99)"
                effect="Automatic from base Ranged 99: ×1.2 enchanted-bolt activation chance"
                pressed={loadout.style === "ranged" && loadout.level >= 99}
                disabled
                onClick={() => undefined}
              />
            </div>
          </div>

          <div
            className="buff-group buff-account-unlocks"
            role="group"
            aria-label="Account unlocks"
          >
            <h3 className="buff-group__title">Account unlocks</h3>
            <div className="icon-tile-grid">
              <BuffTile
                icon={RING_OF_VIGOUR_PASSIVE_ICON}
                label="Ring of Vigour Passive"
                effect={
                  !anachroniaUnlocked
                    ? "Requires Anachronia"
                    : ringEquipped
                      ? "Already active from the equipped ring"
                      : "Permanent passive"
                }
                pressed={anachroniaUnlocked}
                disabled
                onClick={() => undefined}
              />
              <BuffTile
                icon={SPECTRAL_LENS_ICON}
                label="Ensouled spectral lens"
                effect="Permanent Full Slayer Helmet upgrade. Enables Necromancy Slayer Spirit on task."
                pressed={loadout.buffs.ensouledSpectralLens}
                onClick={() =>
                  setBuffs({ ensouledSpectralLens: !loadout.buffs.ensouledSpectralLens })
                }
              />
              <BuffTile
                icon={ELITE_SEERS_VILLAGE_ICON}
                label="Elite Seers' Village achievements"
                effect="Adds 2 percentage points to enchanted-bolt activation chance before the Ranged cape multiplier."
                pressed={loadout.buffs.eliteSeersVillage}
                onClick={() => setBuffs({ eliteSeersVillage: !loadout.buffs.eliteSeersVillage })}
              />
            </div>
            {vigourSources.length > 0 ? (
              <p className="mt-1.5 text-[11px] text-parch-300" data-testid="vigour-sources">
                {formatRingOfVigourSources(vigourSources)}
                {vigourSources.length > 1 ? " · Does not stack." : null}
              </p>
            ) : null}
            {anachroniaUnlocked && ringEquipped ? (
              <p className="mt-1.5 text-[11px] text-parch-300" data-testid="vigour-no-stack">
                Anachronia unlock and equipped ring provide the same effect. They do not stack.
              </p>
            ) : null}

            <h3 className="buff-group__title mt-3">Slayer helmet stand</h3>
            <p className="mb-1.5 text-[11px] text-parch-300">
              Tier-3 Anachronia Slayer Lodge. Same on-task combat passive as wearing the helmet;
              does not stack with an equipped Full Slayer Helmet.
            </p>
            <div className="icon-tile-grid" data-testid="slayer-helmet-stand">
              <BuffTile
                icon={null}
                label="None"
                effect={
                  assassinInsight
                    ? "Assassin's Insight automatically supplies the Corrupted Slayer Helmet"
                    : !anachroniaUnlocked
                      ? "Needs Anachronia unlocked"
                      : "No helmet on the stand"
                }
                pressed={automaticSlayerStand == null}
                disabled={!anachroniaUnlocked || assassinInsight}
                onClick={() => anachroniaUnlocked && setBuffs({ slayerHelmetStand: null })}
              />
              {SLAYER_HELMET_TIERS.map((tier) => (
                <BuffTile
                  key={tier.id}
                  icon={tier.iconPath}
                  label={tier.label}
                  effect={
                    assassinInsight && tier.id === "corrupted"
                      ? "Automatic from Assassin's Insight"
                      : !anachroniaUnlocked
                        ? "Needs Anachronia unlocked (tier-3 Slayer Lodge)"
                        : `On-task: +${((tier.damageMult - 1) * 100).toFixed(1).replace(/\.0$/, "")}% damage · +${((tier.hitChanceMult - 1) * 100).toFixed(1).replace(/\.0$/, "")}% hit chance (direct hits). Stand only.`
                  }
                  pressed={automaticSlayerStand === tier.id}
                  disabled={!anachroniaUnlocked || assassinInsight}
                  onClick={() =>
                    anachroniaUnlocked &&
                    setBuffs({
                      slayerHelmetStand:
                        loadout.buffs.slayerHelmetStand === tier.id
                          ? null
                          : (tier.id as Exclude<SlayerHelmetTierId, never>),
                    })
                  }
                />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-parch-300" data-testid="slayer-helmet-status">
              {slayerResolved.status}
              {helmEquipped && loadout.buffs.slayerHelmetStand != null
                ? " · Equipped helm and stand share one effect (stronger tier wins)."
                : ""}
            </p>
            {salveResolved.variant ? (
              <p className="mt-1 text-[11px] text-parch-300" data-testid="salve-status">
                {salveResolved.variant.label}: {salveResolved.status}
              </p>
            ) : null}
          </div>
        </div>

        <div className="buffs-panel__col">
          <div
            className="buff-group buff-enchantments"
            role="group"
            aria-label="Account enchantments"
          >
            <h3 className="buff-group__title">Account enchantments</h3>
            <div className="icon-tile-grid">
              {EQUIPMENT_ENCHANTMENTS.map((id) => (
                <BuffTile
                  key={id}
                  icon={ENCHANTMENT_ICON(id)}
                  label={ENCHANTMENTS[id].label}
                  effect={ENCHANTMENTS[id].effect}
                  pressed={loadout.enchantments.includes(id)}
                  onClick={() => setLoadout((prev) => toggleEquipmentEnchantment(prev, id))}
                />
              ))}
            </div>
          </div>

          <div
            className="buff-group buff-blessings"
            role="group"
            aria-label="Equilibrium blessings"
          >
            <h3 className="buff-group__title">Equilibrium blessings</h3>
            <div className="blessing-settings mt-1.5">
              {revealedBlessingTiers.map((tier) => {
                const pickIndex = PATH_TIERS.indexOf(tier);
                return (
                  <label key={tier} className="loadout-select">
                    <span>Tier {tier}</span>
                    <select
                      aria-label={`Blessing tier ${tier}`}
                      value={build.blessingPicks[pickIndex] ?? ""}
                      disabled={!buildLoaded || pickIndex > build.blessingPicks.length}
                      onChange={(event) => pickBlessing(tier, event.target.value as BlessingPath)}
                    >
                      <option value="">Not selected</option>
                      {BLESSING_PATHS.map((path) => {
                        const choice = blessingChoice(tier, path);
                        return (
                          <option key={path} value={path}>
                            {path} · {choice?.name ?? "Unrevealed"}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                );
              })}
            </div>
            {godBlessing ? (
              <p className="mt-1.5 text-xs text-gem-300">
                God Tier One · {godBlessing.name} ({godAlignment})
              </p>
            ) : null}
            {selectedTierPassives.length > 0 ? (
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-parch-300">
                {selectedTierPassives.map((passive) => (
                  <li key={passive.id}>
                    <span className="text-parch-100">{passive.name}</span> · {passive.description}
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedBlessings.length > 0 ? (
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-parch-300">
                {selectedBlessings.map((choice) => (
                  <li key={choice.id}>
                    <span className="text-parch-100">{choice.name}</span> ·{" "}
                    {BLESSING_SUPPORT_LABEL[choice.support.status]}
                    {choice.support.mechanicsUnverified ? " · unverified" : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-1.5 text-[11px] text-parch-300">
              From Build. Unmodeled stays out of totals.
            </p>
          </div>

          <div className="buff-group buff-life" role="group" aria-label="Defence and Hitpoints">
            <h3 className="buff-group__title">Defence &amp; Hitpoints</h3>
            <div className="icon-tile-grid">
              <BuffTile
                icon={LIFE_ICON.fortitude}
                label="Fortitude"
                effect="+15% Defence; +10 Hitpoints per Constitution level, plus 10. Clears damage prayer."
                pressed={loadout.buffs.fortitude}
                onClick={() => setBuffs({ fortitude: !loadout.buffs.fortitude })}
              />
              <BuffTile
                icon={LIFE_ICON.reaperCrew}
                label="Reaper Crew"
                effect="+200 maximum Hitpoints"
                pressed={loadout.buffs.reaperCrew}
                onClick={() => setBuffs({ reaperCrew: !loadout.buffs.reaperCrew })}
              />
              <BuffTile
                icon={LIFE_ICON.fontOfLife}
                label="Font of Life"
                effect="+500 maximum Hitpoints"
                pressed={loadout.buffs.fontOfLife}
                onClick={() => setBuffs({ fontOfLife: !loadout.buffs.fontOfLife })}
              />
              <BuffTile
                icon={LIFE_ICON.boonOfHet}
                label="Boon of Het"
                effect="Automatic with Desert: +5% Constitution Hitpoints"
                pressed={desertUnlocked}
                disabled
                onClick={() => undefined}
              />
              <BuffTile
                icon={null}
                fallback="Bath"
                label="Thermal bath"
                effect="+3 maximum Hitpoints per Constitution level"
                pressed={loadout.buffs.thermalBath}
                onClick={() => setBuffs({ thermalBath: !loadout.buffs.thermalBath })}
              />
              <BuffTile
                icon={LIFE_ICON.totemOfVitality}
                label="Totem of Vitality"
                effect="Automatic with Anachronia: up to +1,500 maximum Hitpoints; replaces bonfire"
                pressed={anachroniaUnlocked}
                disabled
                onClick={() => undefined}
              />
              <BuffTile
                icon={LIFE_ICON.powerburstOfVitality}
                label="Powerburst of vitality"
                effect="Doubles current and maximum Hitpoints for 6 seconds; 2-minute cooldown"
                pressed={powerburstActive}
                disabled={!powerburstReady}
                onClick={() => setLoadout((prev) => activatePowerburstOfVitality(prev))}
              />
            </div>
            <div className="loadout-fields mt-2">
              <label className="loadout-select">
                <span>Bonfire log type</span>
                <select
                  aria-label="Bonfire log type"
                  value={loadout.buffs.bonfireLogType ?? "none"}
                  onChange={(event) => {
                    const bonfireLogType =
                      event.target.value === "none"
                        ? null
                        : (event.target.value as Loadout["buffs"]["bonfireLogType"]);
                    setBuffs({
                      bonfireLogType,
                      bonfireFiremakingLevel:
                        bonfireLogType == null
                          ? null
                          : (loadout.buffs.bonfireFiremakingLevel ?? MAX_FIREMAKING_LEVEL),
                    });
                  }}
                >
                  <option value="none">None</option>
                  {BONFIRE_LOGS.map((log) => (
                    <option key={log.value} value={log.value}>
                      {log.label} · {log.minutes} min
                    </option>
                  ))}
                </select>
              </label>
              {loadout.buffs.bonfireFiremakingLevel != null ? (
                <NumberField
                  label="Bonfire Firemaking level"
                  value={loadout.buffs.bonfireFiremakingLevel}
                  min={1}
                  max={MAX_FIREMAKING_LEVEL}
                  onChange={(bonfireFiremakingLevel) => setBuffs({ bonfireFiremakingLevel })}
                />
              ) : null}
              <label className="loadout-select">
                <span>Overheal source</span>
                <select
                  aria-label="Overheal source"
                  value={loadout.buffs.overheal}
                  onChange={(event) =>
                    setBuffs({ overheal: event.target.value as Loadout["buffs"]["overheal"] })
                  }
                >
                  <option value="none">None</option>
                  <option value="rocktail-line">Rocktail, tiger shark or sailfish · 110%</option>
                  <option value="soup-line">Rocktail or sailfish soup · 115%</option>
                  <option value="saradomin-brew">Saradomin brew · +1,000</option>
                  <option value="super-saradomin-brew">Super Saradomin brew · +1,300</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

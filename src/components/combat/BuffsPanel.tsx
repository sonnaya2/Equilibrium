"use client";

import { useEffect } from "react";
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
import type { CombatStyle } from "@/combat/types";
import {
  BLESSING_PATHS,
  PATH_TIERS,
  activeBlessings,
  blessingChoice,
  blessingTierRevealed,
  deriveGodTier,
  type BlessingPath,
  type BlessingSupportStatus,
} from "@/league/blessings";
import { isRegionUnlocked } from "@/league";
import relicsData from "#shard/league/relics.json";
import { useBuild } from "@/league/useBuild";
import { GameIcon } from "../GameIcon";
import { NumberField } from "./NumberField";
import { ICYENIC_FAITH_RELIC, TOME_OF_THE_ICYENE_ID } from "@/combat/league/icyenicFaith";
import { relicIconPath } from "@/lib/gameArt";
import {
  BONFIRE_LOGS,
  activatePowerburstOfVitality,
  equipInSlot,
  equipmentIdList,
  isPowerburstOfVitalityActive,
  isPowerburstOfVitalityReady,
  toggleEquipmentEnchantment,
  withLoadoutBuffs,
  type Loadout,
  type OverloadChoice,
  type SetLoadout,
  type StyleCurseChoice,
} from "./useLoadout";

/** Wiki art under public/game - standard book vs ancient curses folders. */
const STANDARD_PRAYER_IDS = new Set(["piety", "rigour", "augury", "sanctity"]);
const PRAYER_ICON = (id: Exclude<StyleCurseChoice, "none">) =>
  STANDARD_PRAYER_IDS.has(id)
    ? `/game/combat/prayers/standard/${id}.webp`
    : `/game/combat/prayers/ancient-curses/${id}.webp`;
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

const PRAYER_OPTIONS: Array<{
  value: Exclude<StyleCurseChoice, "none">;
  label: string;
  effect: string;
  style: CombatStyle;
  book: "standard" | "ancient";
}> = [
  {
    value: "piety",
    label: "Piety",
    effect: "+8% melee damage · +8 Attack/Defence levels",
    style: "melee",
    book: "standard",
  },
  {
    value: "rigour",
    label: "Rigour",
    effect: "+8% ranged damage · +8 Ranged/Defence levels",
    style: "ranged",
    book: "standard",
  },
  {
    value: "augury",
    label: "Augury",
    effect: "+8% magic damage · +8 Magic/Defence levels",
    style: "magic",
    book: "standard",
  },
  {
    value: "sanctity",
    label: "Sanctity",
    effect: "+8% necromancy damage · +8 Necromancy/Defence levels",
    style: "necromancy",
    book: "standard",
  },
  {
    value: "turmoil",
    label: "Turmoil",
    effect: "+10% melee damage · +10 levels",
    style: "melee",
    book: "ancient",
  },
  {
    value: "anguish",
    label: "Anguish",
    effect: "+10% ranged damage · +10 levels",
    style: "ranged",
    book: "ancient",
  },
  {
    value: "torment",
    label: "Torment",
    effect: "+10% magic damage · +10 levels",
    style: "magic",
    book: "ancient",
  },
  {
    value: "sorrow",
    label: "Sorrow",
    effect: "+10% necromancy damage · +10 levels",
    style: "necromancy",
    book: "ancient",
  },
  {
    value: "malevolence",
    label: "Malevolence",
    effect: "+12% melee damage · +12 levels",
    style: "melee",
    book: "ancient",
  },
  {
    value: "desolation",
    label: "Desolation",
    effect: "+12% ranged damage · +12 levels",
    style: "ranged",
    book: "ancient",
  },
  {
    value: "affliction",
    label: "Affliction",
    effect: "+12% magic damage · +12 levels",
    style: "magic",
    book: "ancient",
  },
  {
    value: "ruination",
    label: "Ruination",
    effect: "+12% necromancy damage · +12 levels",
    style: "necromancy",
    book: "ancient",
  },
];

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

/** Player-toggled buffs - wiki numbers only. */
export function BuffsPanel({ loadout, setLoadout }: { loadout: Loadout; setLoadout: SetLoadout }) {
  // Same-style damage prayers; keep an off-style pick visible so it can be cleared.
  const prayerOptions = PRAYER_OPTIONS.filter(
    (opt) => opt.style === loadout.style || opt.value === loadout.buffs.styleCurse,
  );
  const standardPrayers = prayerOptions.filter((opt) => opt.book === "standard");
  const ancientPrayers = prayerOptions.filter((opt) => opt.book === "ancient");

  const setBuffs = (patch: Partial<Loadout["buffs"]>) =>
    setLoadout((prev) => withLoadoutBuffs(prev, patch));
  const powerburstActive = isPowerburstOfVitalityActive(loadout);
  const powerburstReady = isPowerburstOfVitalityReady(loadout);
  const { build, loaded: buildLoaded, pickBlessing, toggleRelic } = useBuild();
  const revealedBlessingTiers = PATH_TIERS.filter(blessingTierRevealed);
  const godAlignment = deriveGodTier(build.blessingPicks.slice(0, 3));
  const godBlessing = godAlignment ? blessingChoice(4, godAlignment) : undefined;
  const selectedBlessings = activeBlessings(build.blessingPicks);
  const t7Picked = build.relics[String(T7_RELIC_TIER)] ?? null;
  const icyenicPicked = t7Picked === ICYENIC_FAITH_RELIC;
  const tomeEquipped = loadout.equipmentSlots.pocket === TOME_OF_THE_ICYENE_ID;
  const anachroniaUnlocked = isRegionUnlocked(build, "anachronia");
  // Worn = ring slot only. Unlock pins in equipmentIds must not count as equipped.
  const slottedIds = equipmentIdList(loadout.equipmentSlots);
  const ringEquipped = isRingOfVigourWorn(slottedIds);
  const vigourSources = ringOfVigourActiveSources({
    equipmentIds: slottedIds,
    ringOfVigourPassive: loadout.buffs.ringOfVigourPassive,
    unlockedRegions: anachroniaUnlocked ? ["anachronia"] : [],
  });

  // Region removed: clear persisted passive so it cannot re-activate without Anachronia.
  useEffect(() => {
    if (!anachroniaUnlocked && loadout.buffs.ringOfVigourPassive) {
      setLoadout((prev) => withLoadoutBuffs(prev, { ringOfVigourPassive: false }));
    }
    // Narrow deps: only region unlock + passive flag, not every loadout field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anachroniaUnlocked, loadout.buffs.ringOfVigourPassive]);

  // Helmet stand needs Anachronia (tier-3 Lodge). Equipped helmet is unaffected.
  useEffect(() => {
    if (!anachroniaUnlocked && loadout.buffs.slayerHelmetStand != null) {
      setLoadout((prev) => withLoadoutBuffs(prev, { slayerHelmetStand: null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anachroniaUnlocked, loadout.buffs.slayerHelmetStand]);

  const helmEquipped =
    typeof loadout.equipmentSlots.helmet === "string" &&
    SLAYER_HELMET_TIERS.some((t) => t.itemId === loadout.equipmentSlots.helmet);
  const slayerResolved = resolveSlayerHelmet({
    equipmentSlots: loadout.equipmentSlots,
    standTier: loadout.buffs.slayerHelmetStand,
    unlockedRegions: anachroniaUnlocked ? ["anachronia"] : [],
    onSlayerTask: loadout.target?.onSlayerTask === true,
    style: loadout.style,
    ensouledSpectralLens: loadout.buffs.ensouledSpectralLens,
  });
  const salveResolved = resolveSalve({
    equipmentSlots: loadout.equipmentSlots,
    targetUndead: loadout.target?.undead === true,
  });

  /** One pick per tier: sets name (replacing any other T7). Icyenic also pockets the Tome. */
  const toggleTier7Relic = (name: string) => {
    if (!buildLoaded) return;
    const wasActive = t7Picked === name;
    toggleRelic(T7_RELIC_TIER, name);
    if (!wasActive && name === ICYENIC_FAITH_RELIC) {
      setLoadout((prev) => equipInSlot(prev, "pocket", TOME_OF_THE_ICYENE_ID));
    }
  };

  return (
    <div className="loadout-panel loadout-panel-wide buffs-panel">
      <h2 className="combat-section-title text-sm font-medium text-parch-50">Buffs</h2>

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

          <div className="buff-group buff-prayers" role="group" aria-label="Prayers">
            <h3 className="buff-group__title">Prayers</h3>
            <div className="icon-tile-grid icon-tile-grid--prayers">
              <BuffTile
                icon={null}
                label="None"
                effect="No damage prayer"
                pressed={loadout.buffs.styleCurse === "none"}
                onClick={() => setBuffs({ styleCurse: "none" })}
              />
              {standardPrayers.map((opt) => (
                <BuffTile
                  key={opt.value}
                  icon={PRAYER_ICON(opt.value)}
                  label={opt.label}
                  effect={opt.effect}
                  pressed={loadout.buffs.styleCurse === opt.value}
                  onClick={() =>
                    setBuffs({
                      styleCurse: loadout.buffs.styleCurse === opt.value ? "none" : opt.value,
                    })
                  }
                />
              ))}
              {ancientPrayers.map((opt) => (
                <BuffTile
                  key={opt.value}
                  icon={PRAYER_ICON(opt.value)}
                  label={opt.label}
                  effect={opt.effect}
                  pressed={loadout.buffs.styleCurse === opt.value}
                  onClick={() =>
                    setBuffs({
                      styleCurse: loadout.buffs.styleCurse === opt.value ? "none" : opt.value,
                    })
                  }
                />
              ))}
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
                  const effects = Array.isArray(relic.effects) ? relic.effects : [];
                  const effectText =
                    effects.length > 0
                      ? effects.join(" ")
                      : isIcyenic
                        ? "Tome of the Icyene · prayer crit and base AD scaling"
                        : relic.name;
                  return (
                    <BuffTile
                      key={relic.name}
                      icon={relicIconPath(relic.name)}
                      label={relic.name}
                      effect={
                        active && isIcyenic
                          ? tomeEquipped
                            ? `${effectText} · Tome worn`
                            : `${effectText} · equip Tome for scaling`
                          : effectText
                      }
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
                effect="Dismember deals three extra bleed hits (wiki Strength cape perk)"
                pressed={loadout.buffs.strengthCape99}
                onClick={() => setBuffs({ strengthCape99: !loadout.buffs.strengthCape99 })}
              />
              <BuffTile
                icon={SKILLCAPE_ICON.attack}
                label="Attack cape (120)"
                effect="+2% melee hit chance (wiki Attack master cape perk)"
                pressed={loadout.buffs.attackCape120}
                onClick={() => setBuffs({ attackCape120: !loadout.buffs.attackCape120 })}
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
                    ? "Needs Anachronia unlocked"
                    : ringEquipped
                      ? "Same effect as the equipped ring, without wearing it. Does not stack."
                      : "Same effect as wearing Ring of Vigour. +10 adren after ultimates; weapon specials cost 90%."
                }
                pressed={loadout.buffs.ringOfVigourPassive}
                disabled={!anachroniaUnlocked}
                onClick={() =>
                  anachroniaUnlocked &&
                  setBuffs({ ringOfVigourPassive: !loadout.buffs.ringOfVigourPassive })
                }
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
            </div>
            {vigourSources.length > 0 ? (
              <p
                className="mt-1.5 text-[11px] text-parch-300"
                data-testid="vigour-sources"
              >
                {formatRingOfVigourSources(vigourSources)}
                {vigourSources.length > 1 ? " · Does not stack." : null}
              </p>
            ) : null}
            {anachroniaUnlocked && ringEquipped ? (
              <p className="mt-1.5 text-[11px] text-parch-300" data-testid="vigour-no-stack">
                {loadout.buffs.ringOfVigourPassive
                  ? "Ring is equipped - keep this on if you swap rings. Effects do not stack."
                  : "Ring is equipped; this is optional for when you unequip it."}
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
                  !anachroniaUnlocked ? "Needs Anachronia unlocked" : "No helmet on the stand"
                }
                pressed={loadout.buffs.slayerHelmetStand == null}
                disabled={!anachroniaUnlocked}
                onClick={() => anachroniaUnlocked && setBuffs({ slayerHelmetStand: null })}
              />
              {SLAYER_HELMET_TIERS.map((tier) => (
                <BuffTile
                  key={tier.id}
                  icon={tier.iconPath}
                  label={tier.label}
                  effect={
                    !anachroniaUnlocked
                      ? "Needs Anachronia unlocked (tier-3 Slayer Lodge)"
                      : `On-task: +${((tier.damageMult - 1) * 100).toFixed(1).replace(/\.0$/, "")}% damage · +${((tier.hitChanceMult - 1) * 100).toFixed(1).replace(/\.0$/, "")}% hit chance (direct hits). Stand only.`
                  }
                  pressed={loadout.buffs.slayerHelmetStand === tier.id}
                  disabled={!anachroniaUnlocked}
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

          <div className="buff-group buff-life" role="group" aria-label="Defence and life">
            <h3 className="buff-group__title">Defence & life</h3>
            <div className="icon-tile-grid">
              <BuffTile
                icon={LIFE_ICON.fortitude}
                label="Fortitude"
                effect="+15% Defence in the block calculation; +10 life points per Constitution level, plus 10 (clears damage prayer)"
                pressed={loadout.buffs.fortitude}
                onClick={() => setBuffs({ fortitude: !loadout.buffs.fortitude })}
              />
              <BuffTile
                icon={LIFE_ICON.reaperCrew}
                label="Reaper Crew"
                effect="+200 maximum life points"
                pressed={loadout.buffs.reaperCrew}
                onClick={() => setBuffs({ reaperCrew: !loadout.buffs.reaperCrew })}
              />
              <BuffTile
                icon={LIFE_ICON.fontOfLife}
                label="Font of Life"
                effect="Persistent +500 maximum life points while Font of Life is active"
                pressed={loadout.buffs.fontOfLife}
                onClick={() => setBuffs({ fontOfLife: !loadout.buffs.fontOfLife })}
              />
              <BuffTile
                icon={LIFE_ICON.boonOfHet}
                label="Boon of Het"
                effect="+5% of Constitution life to maximum life points"
                pressed={loadout.buffs.boonOfHet}
                onClick={() => setBuffs({ boonOfHet: !loadout.buffs.boonOfHet })}
              />
              <BuffTile
                icon={null}
                fallback="Bath"
                label="Thermal bath"
                effect="+3 maximum life points per Constitution level for its active window"
                pressed={loadout.buffs.thermalBath}
                onClick={() => setBuffs({ thermalBath: !loadout.buffs.thermalBath })}
              />
              <BuffTile
                icon={LIFE_ICON.totemOfVitality}
                label="Totem of Vitality"
                effect="Persistent up to +1,500 maximum life points while active; replaces a bonfire boost"
                pressed={loadout.buffs.totemOfVitality}
                onClick={() => setBuffs({ totemOfVitality: !loadout.buffs.totemOfVitality })}
              />
              <BuffTile
                icon={LIFE_ICON.powerburstOfVitality}
                label="Powerburst of vitality"
                effect="Doubles current and maximum life points for 6 seconds; 2-minute powerburst cooldown"
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

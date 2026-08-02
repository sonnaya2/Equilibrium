import type { SourceReference } from "../types";

/**
 * Player life-point model. Ordered composition — never a flat sum:
 *
 *   1. Constitution life      100 × level (max level 99 → 9,900; Constitution
 *                             was not raised to 120 in the 2026 modernisation)
 *   2. + equipment Life        flat per-item bonuses
 *   3. + permanent unlocks     Reaper Crew +200; Boon of Het +5% of Constitution life
 *   4. + temporary flat        Font of Life +500, Fortitude 10+10×level,
 *                              thermal bath 3×level, Elidinis Statuette +500
 *   5. + temporary percent     bonfire ⌈(fm+1)/2⌉×0.1% (cap 750) OR Totem of
 *                              Vitality 25% (cap 1,500) — mutually exclusive,
 *                              basis is Constitution + equipment only
 *   6. food overheal last      +10% / +15% of the buffed max, or flat brew caps
 *
 * Absolute cap 32,000, reachable only transiently via Powerburst of vitality
 * (doubles max and current). Abidor Crank and boosted-Constitution max-LP
 * effects are unverified and deliberately not modelled.
 */
export const LIFE_POINTS_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Life_points",
  title: "Life points",
  verifiedAt: "2026-08-02",
};

export const BONFIRE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Bonfire",
  title: "Bonfire",
  verifiedAt: "2026-08-02",
};

export const OVERHEAL_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Sailfish_soup",
  title: "Sailfish soup",
  verifiedAt: "2026-08-02",
};

export const MAX_CONSTITUTION_LEVEL = 99;
export const ABSOLUTE_LIFE_CAP = 32_000;

/** Documented overheal classes: +10% foods (rocktail line), +15% foods
 *  (soups / giant meats), and the flat brew ceilings. One cap, largest applies. */
export type OverhealKind =
  "rocktail-line" | "soup-line" | "saradomin-brew" | "super-saradomin-brew";

export interface LifePointInput {
  constitutionLevel: number;
  /** Summed equipment Life from the canonical equipment aggregation. */
  equipmentLife?: number;
  reaperCrew?: boolean;
  boonOfHet?: boolean;
  fontOfLife?: boolean;
  fortitude?: boolean;
  thermalBath?: boolean;
  elidinisStatuette?: boolean;
  /** Firemaking level while a bonfire boost is active; exclusive with totem. */
  bonfireFiremakingLevel?: number | null;
  totemOfVitality?: boolean;
  overheal?: OverhealKind | null;
  powerburstOfVitality?: boolean;
  /** Defaults to the (temporary) maximum — a fully healed loadout. */
  currentLife?: number;
}

export interface LifePointStats {
  constitutionLife: number;
  equipmentLife: number;
  /** Reaper Crew and Boon of Het — permanent account unlocks. */
  permanentLife: number;
  /** Font of Life, Fortitude, thermal bath, Elidinis Statuette. */
  temporaryFlatLife: number;
  bonfireLife: number;
  totemOfVitalityLife: number;
  /** Constitution + equipment + permanent — the maximum without temporary buffs. */
  normalMaxLife: number;
  /** normalMaxLife plus temporary flat and the bonfire/totem window. */
  temporaryMaxLife: number;
  /** temporaryMaxLife plus the overheal allowance — the ceiling current life may reach. */
  overhealCeiling: number;
  currentLife: number;
  powerburstActive: boolean;
}

export function lifePointStats(input: LifePointInput): LifePointStats {
  const {
    constitutionLevel,
    equipmentLife = 0,
    bonfireFiremakingLevel = null,
    overheal = null,
    currentLife,
  } = input;
  if (
    !Number.isFinite(constitutionLevel) ||
    constitutionLevel < 1 ||
    constitutionLevel > MAX_CONSTITUTION_LEVEL
  ) {
    throw new RangeError(`lifePointStats: bad Constitution level ${constitutionLevel}`);
  }
  if (!Number.isFinite(equipmentLife) || equipmentLife < 0) {
    throw new RangeError(`lifePointStats: bad equipment life ${equipmentLife}`);
  }
  if (bonfireFiremakingLevel != null && input.totemOfVitality) {
    throw new RangeError("lifePointStats: bonfire and Totem of Vitality do not stack");
  }
  if (
    bonfireFiremakingLevel != null &&
    (!Number.isFinite(bonfireFiremakingLevel) ||
      bonfireFiremakingLevel < 1 ||
      bonfireFiremakingLevel > 99)
  ) {
    throw new RangeError(`lifePointStats: bad Firemaking level ${bonfireFiremakingLevel}`);
  }

  const constitutionLife = 100 * constitutionLevel;
  const permanentLife =
    (input.reaperCrew ? 200 : 0) + (input.boonOfHet ? Math.floor(0.05 * constitutionLife) : 0);
  const temporaryFlatLife =
    (input.fontOfLife ? 500 : 0) +
    (input.fortitude ? 10 + 10 * constitutionLevel : 0) +
    (input.thermalBath ? 3 * constitutionLevel : 0) +
    (input.elidinisStatuette ? 500 : 0);

  // Percent windows share the documented basis: Constitution + equipment only.
  const percentBasis = constitutionLife + equipmentLife;
  const bonfireLife =
    bonfireFiremakingLevel != null
      ? Math.min(
          750,
          Math.floor(Math.ceil((bonfireFiremakingLevel + 1) / 2) * 0.001 * percentBasis),
        )
      : 0;
  // Totem basis is undocumented; Constitution + equipment matches the bonfire
  // pattern and the 1,500 cap binds at any endgame basis regardless.
  const totemOfVitalityLife = input.totemOfVitality
    ? Math.min(1500, Math.floor(0.25 * percentBasis))
    : 0;

  const normalMaxLife = constitutionLife + equipmentLife + permanentLife;
  let temporaryMaxLife = normalMaxLife + temporaryFlatLife + bonfireLife + totemOfVitalityLife;
  let overhealCeiling =
    overheal === "rocktail-line"
      ? temporaryMaxLife + Math.floor(0.1 * temporaryMaxLife)
      : overheal === "soup-line"
        ? temporaryMaxLife + Math.floor(0.15 * temporaryMaxLife)
        : overheal === "saradomin-brew"
          ? temporaryMaxLife + 1000
          : overheal === "super-saradomin-brew"
            ? temporaryMaxLife + 1300
            : temporaryMaxLife;

  const powerburstActive = input.powerburstOfVitality === true;
  if (powerburstActive) {
    temporaryMaxLife = Math.min(ABSOLUTE_LIFE_CAP, 2 * temporaryMaxLife);
    overhealCeiling = Math.min(ABSOLUTE_LIFE_CAP, 2 * overhealCeiling);
  }

  const resolvedCurrent = currentLife ?? temporaryMaxLife;
  if (!Number.isFinite(resolvedCurrent) || resolvedCurrent < 0) {
    throw new RangeError(`lifePointStats: bad current life ${currentLife}`);
  }

  return {
    constitutionLife,
    equipmentLife,
    permanentLife,
    temporaryFlatLife,
    bonfireLife,
    totemOfVitalityLife,
    normalMaxLife,
    temporaryMaxLife,
    overhealCeiling,
    currentLife: Math.min(resolvedCurrent, overhealCeiling),
    powerburstActive,
  };
}

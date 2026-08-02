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
 *   6. League maximum          Big Boned multiplier on the composed maximum
 *   7. food overheal last      +10% / +15% of the buffed max, or flat brew caps
 *
 * Powerburst of vitality doubles max and current after those layers. Abidor
 * Crank and boosted-Constitution max-LP effects are unverified and deliberately
 * not modelled.
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

export const POWERBURST_OF_VITALITY_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Powerburst_of_vitality",
  title: "Powerburst of vitality",
  verifiedAt: "2026-08-02",
};

export const MAX_CONSTITUTION_LEVEL = 99;
export const MAX_FIREMAKING_LEVEL = 110;
export const POWERBURST_DURATION_MS = 6_000;
export const POWERBURST_COOLDOWN_MS = 120_000;

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
  /** Equilibrium maximum-life stage (1 when no blessing is active). */
  maximumLifeMultiplier?: number;
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
  /** Named contributions for presentation; sums exactly to the resolved maxima. */
  breakdown: {
    constitution: number;
    equipment: number;
    reaperCrew: number;
    boonOfHet: number;
    fontOfLife: number;
    fortitude: number;
    thermalBath: number;
    elidinisStatuette: number;
    bonfire: number;
    totemOfVitality: number;
    powerburst: number;
    leagueMaximumNormal: number;
    leagueMaximumTemporary: number;
  };
}

export function lifePointStats(input: LifePointInput): LifePointStats {
  const {
    constitutionLevel,
    equipmentLife = 0,
    bonfireFiremakingLevel = null,
    overheal = null,
    currentLife,
    maximumLifeMultiplier = 1,
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
  if (!Number.isFinite(maximumLifeMultiplier) || maximumLifeMultiplier < 1) {
    throw new RangeError(`lifePointStats: bad maximum-life multiplier ${maximumLifeMultiplier}`);
  }
  if (bonfireFiremakingLevel != null && input.totemOfVitality) {
    throw new RangeError("lifePointStats: bonfire and Totem of Vitality do not stack");
  }
  if (
    bonfireFiremakingLevel != null &&
    (!Number.isFinite(bonfireFiremakingLevel) ||
      bonfireFiremakingLevel < 1 ||
      bonfireFiremakingLevel > MAX_FIREMAKING_LEVEL)
  ) {
    throw new RangeError(`lifePointStats: bad Firemaking level ${bonfireFiremakingLevel}`);
  }

  const constitutionLife = 100 * constitutionLevel;
  const reaperCrewLife = input.reaperCrew ? 200 : 0;
  const boonOfHetLife = input.boonOfHet ? Math.floor(0.05 * constitutionLife) : 0;
  const fontOfLife = input.fontOfLife ? 500 : 0;
  const fortitudeLife = input.fortitude ? 10 + 10 * constitutionLevel : 0;
  const thermalBathLife = input.thermalBath ? 3 * constitutionLevel : 0;
  const elidinisStatuetteLife = input.elidinisStatuette ? 500 : 0;
  const permanentLife = reaperCrewLife + boonOfHetLife;
  const temporaryFlatLife = fontOfLife + fortitudeLife + thermalBathLife + elidinisStatuetteLife;

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

  const baseNormalMaxLife = constitutionLife + equipmentLife + permanentLife;
  const leagueMaximumNormal = Math.floor(baseNormalMaxLife * (maximumLifeMultiplier - 1));
  const normalMaxLife = baseNormalMaxLife + leagueMaximumNormal;
  const baseTemporaryMaxLife =
    baseNormalMaxLife + temporaryFlatLife + bonfireLife + totemOfVitalityLife;
  const leagueMaximumTotal = Math.floor(baseTemporaryMaxLife * (maximumLifeMultiplier - 1));
  const leagueMaximumTemporary = leagueMaximumTotal - leagueMaximumNormal;
  let temporaryMaxLife = baseTemporaryMaxLife + leagueMaximumTotal;
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

  let resolvedCurrent = currentLife ?? temporaryMaxLife;
  if (!Number.isFinite(resolvedCurrent) || resolvedCurrent < 0) {
    throw new RangeError(`lifePointStats: bad current life ${currentLife}`);
  }

  const powerburstActive = input.powerburstOfVitality === true;
  const powerburstLife = powerburstActive ? temporaryMaxLife : 0;
  if (powerburstActive) {
    temporaryMaxLife *= 2;
    overhealCeiling *= 2;
    resolvedCurrent *= 2;
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
    breakdown: {
      constitution: constitutionLife,
      equipment: equipmentLife,
      reaperCrew: reaperCrewLife,
      boonOfHet: boonOfHetLife,
      fontOfLife,
      fortitude: fortitudeLife,
      thermalBath: thermalBathLife,
      elidinisStatuette: elidinisStatuetteLife,
      bonfire: bonfireLife,
      totemOfVitality: totemOfVitalityLife,
      powerburst: powerburstLife,
      leagueMaximumNormal,
      leagueMaximumTemporary,
    },
  };
}

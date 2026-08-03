/**
 * Independently derived combat goldens for tests.

 * Values are worked from the sourced formulas (combat-math skill), not by calling
 * production helpers. Tests compare production output to these constants.

 * DPL(99) = 145 * 2.5 * ln(1 + 0.6*99/145) / ln(1.6) ≈ 264.48…
 * Intermediate floors for naked T99 two-handed style damage:
 *   floor(DPL(99)) + floor(DPL(99)/2) + floor(14.4 * 99)
 *   = 264 + 132 + 1425 = 1821
 */

/** Level 99, T99 two-handed (melee / ranged / magic with full style caps). */
export const GOLDEN_L99_T99_TWO_HAND = 1821;

/** Level 99 dual-wield T99/T99: main 1214 + floor(1214/2) off-hand = 1821. */
export const GOLDEN_L99_T99_DUAL_WIELD = 1821;

/** Level 99 necromancy death guard T99 + conduit T99 (explicit hands). */
export const GOLDEN_L99_T99_NECROMANCY = 1821;

/** Level 110 boosted, T99 2H melee: floor(DPL(110))+floor(DPL(110)/2)+floor(14.4*99)=289+144+1425. */
export const GOLDEN_L110_T99_TWO_HAND = 1858;

/** Level 99 T99 main + T85 off: 1214 + floor(1080/2) = 1754. */
export const GOLDEN_L99_T99_T85_DUAL = 1754;

/** Level 99 T99 2H ranged with ammo tier 80 (weapon term capped). */
export const GOLDEN_L99_T99_RANGED_AMMO80 = 1548;

/** Level 99 T99 2H magic with spell tier 80. */
export const GOLDEN_L99_T99_MAGIC_SPELL80 = 1548;

/**
 * Level 50 damage level, T99 melee 2H with level-capped 9.6 term:
 * floor(DPL(50))+floor(DPL(50)/2)+floor(9.6*50)+floor(4.8*99) = 145+72+480+475 = 1172.
 */
export const GOLDEN_L50_T99_MELEE_LEVEL_CAP = 1172;

/** Level 99 T99 2H melee with styleBonus 12.7 inside weapon floor: 264+132+floor(14.4*99+1.5*12.7)=1840. */
export const GOLDEN_L99_T99_STYLE_BONUS_12_7 = 1840;

/** Standard hit cap metadata. */
export const GOLDEN_STANDARD_HIT_CAP = 30_000;

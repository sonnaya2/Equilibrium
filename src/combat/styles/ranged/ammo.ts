import { MODERNISATION_WIKI, REFINEMENTS_WIKI_2026_03_09 } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Ammunition under the modernisation: abilities require ammo; each shot rolls
 * destruction — 15% since 9 Mar (was 20% at release), rolled per shot, not per
 * hit. Unbroken ammo drops to the ground and Ava's devices return it without a
 * failure roll. Chinchompas always explode.
 */
export const AMMO_DESTROY_CHANCE = 0.15;

export function rollAmmoDestroyed(roll: number): boolean {
  return roll < AMMO_DESTROY_CHANCE;
}

/** Expected ammo spent per shot — consumption is a mean, not a schedule. */
export function expectedAmmoPerShot(): number {
  return AMMO_DESTROY_CHANCE;
}

export const AMMO_SOURCE: SourceReference = MODERNISATION_WIKI;
export const AMMO_REFINEMENT_SOURCE: SourceReference = REFINEMENTS_WIKI_2026_03_09;

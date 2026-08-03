import type { SourceReference } from "../types";

/**
 * Conservation of Energy (Archaeology monolith relic).
 * https://runescape.wiki/w/Conservation_of_Energy
 * After using an ultimate, refund 10 adrenaline once per cast.
 * Stacks additively with Ring of Vigour (+10 each, +20 total).
 * Onslaught is excluded when present in the catalogue.
 */

export const CONSERVATION_OF_ENERGY_ID = "conservation_of_energy";
export const CONSERVATION_OF_ENERGY_NAME = "Conservation of Energy";
export const CONSERVATION_OF_ENERGY_REFUND = 10;

export const CONSERVATION_OF_ENERGY_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Conservation_of_Energy",
  title: "Conservation of Energy",
  verifiedAt: "2026-08-02",
};

const ONSLAUGHT_ABILITY_IDS = new Set(["onslaught"]);

/** Ultimate cast that is not Onslaught (CoE + Ring of Vigour share this gate). */
export function ultimateAdrenalineRefundQualifies(ability: {
  id: string;
  category?: string;
}): boolean {
  if (ability.category !== "ultimate") return false;
  return !ONSLAUGHT_ABILITY_IDS.has(ability.id);
}

/** Alias kept for older call sites / tests. */
export const conservationOfEnergyQualifies = ultimateAdrenalineRefundQualifies;

/**
 * Split CoE vs RoV ultimate grants for one cast.
 * Prefer conservationOfEnergyRefund + ringOfVigour; else legacy ultimateAdrenalineRefund sum.
 * Onslaught and non-ultimates: both 0.
 */
export function resolveUltimateAdrenalineRefunds(
  ability: { id: string; category?: string },
  adrenaline:
    | {
        conservationOfEnergyRefund?: number;
        ultimateAdrenalineRefund?: number;
        ringOfVigour?: boolean;
      }
    | undefined,
  vigourRefundAmount: number,
): { conservationOfEnergyRefund: number; ringOfVigourRefund: number } {
  if (!ultimateAdrenalineRefundQualifies(ability)) {
    return { conservationOfEnergyRefund: 0, ringOfVigourRefund: 0 };
  }
  if (adrenaline?.conservationOfEnergyRefund !== undefined) {
    return {
      conservationOfEnergyRefund: Math.max(0, adrenaline.conservationOfEnergyRefund),
      ringOfVigourRefund: adrenaline.ringOfVigour === true ? Math.max(0, vigourRefundAmount) : 0,
    };
  }
  const total = adrenaline?.ultimateAdrenalineRefund ?? 0;
  if (total <= 0) return { conservationOfEnergyRefund: 0, ringOfVigourRefund: 0 };
  const ringOfVigourRefund =
    adrenaline?.ringOfVigour === true ? Math.min(Math.max(0, vigourRefundAmount), total) : 0;
  return {
    conservationOfEnergyRefund: total - ringOfVigourRefund,
    ringOfVigourRefund,
  };
}

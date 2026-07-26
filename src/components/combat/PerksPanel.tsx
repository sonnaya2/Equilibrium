"use client";

import { NumberField } from "./NumberField";
import type { Loadout } from "./useLoadout";

const PERK_FIELDS = [
  ["equilibrium", "Equilibrium rank (R1 +8% AD, +2%/rank to +14%, no crits)", 4],
  ["eruptive", "Eruptive rank (R1 +0.5% AD, +0.5%/rank to +2%)", 4],
  ["biting", "Biting rank (R1 +2% crit, +2%/rank; +2.2% if lvl20)", 4],
  ["invigorating", "Invigorating rank (basic adren ×1.05 per rank; R4 ×1.20)", 4],
  ["impatient", "Impatient rank (R1 9% for +3 adren on basics; 9.9% if lvl20)", 4],
  ["ultimatums", "Ultimatums rank (R1 +4% ult, +1%/rank to +7%)", 4],
  ["lunging", "Lunging rank (R1 +13% Combust/Dismember, +3%/rank)", 4],
  ["energising", "Energising rank (R1 +75 accuracy, +25/rank)", 4],
  ["tectonicPieces", "Tectonic pieces (+1%/piece crit)", 5],
  ["tumekensPieces", "Tumeken's pieces (+1.5%/piece crit)", 5],
] as const;

/** Sourced perk ranks and set toggles — unsourced perks stay out. */
export function PerksPanel({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: (next: Loadout) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-parch-50">Perks &amp; sets</h2>
      <p className="mt-1 text-xs text-parch-300">
        Only sourced current values — unsourced perks stay out rather than guessed.
      </p>
      <div className="mt-3 border-t border-stone-750">
        {PERK_FIELDS.map(([key, label, max]) => (
          <NumberField
            key={key}
            label={label}
            value={loadout.perks[key]}
            onChange={(value) =>
              setLoadout({
                ...loadout,
                perks: {
                  ...loadout.perks,
                  [key]: Math.min(Math.max(0, Math.floor(value)), max),
                },
              })
            }
          />
        ))}
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.perks.bitingLevel20}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                perks: { ...loadout.perks, bitingLevel20: event.target.checked },
              })
            }
          />
          Biting on level-20 item (+2.2%/rank)
        </label>
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.perks.impatientLevel20}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                perks: { ...loadout.perks, impatientLevel20: event.target.checked },
              })
            }
          />
          Impatient on level-20 item (9.9%/rank)
        </label>
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.perks.eliteTectonic}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                perks: { ...loadout.perks, eliteTectonic: event.target.checked },
              })
            }
          />
          Elite tectonic (+2%/piece instead)
        </label>
        <label className="flex items-center gap-2 border-b border-stone-750/70 py-2 text-xs text-parch-100">
          <input
            type="checkbox"
            checked={loadout.perks.insideSunshine}
            onChange={(event) =>
              setLoadout({
                ...loadout,
                perks: { ...loadout.perks, insideSunshine: event.target.checked },
              })
            }
          />
          Inside Sunshine (Tumeken set(3) active)
        </label>
      </div>
    </div>
  );
}

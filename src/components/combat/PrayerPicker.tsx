"use client";

import { useMemo } from "react";
import type { CombatStyle } from "@/combat/types";
import { isRegionUnlocked, REGION_IDS } from "@/league";
import { useBuild } from "@/league/useBuild";
import { GameIcon } from "../GameIcon";
import {
  withLoadoutBuffs,
  type Loadout,
  type SetLoadout,
  type StyleCurseChoice,
} from "./useLoadout";

const STANDARD_PRAYER_IDS = new Set(["piety", "rigour", "augury", "sanctity"]);
export const prayerIconPath = (id: Exclude<StyleCurseChoice, "none">) =>
  STANDARD_PRAYER_IDS.has(id)
    ? `/game/combat/prayers/standard/${id}.webp`
    : `/game/combat/prayers/ancient-curses/${id}.webp`;

const PRAYER_OPTIONS: readonly {
  value: Exclude<StyleCurseChoice, "none">;
  label: string;
  effect: string;
  style: CombatStyle;
  book: "standard" | "ancient";
}[] = [
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

function PrayerTile({
  icon,
  label,
  effect,
  pressed,
  onClick,
}: {
  icon: string | null;
  label: string;
  effect: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`gear-prayer-option${pressed ? " is-selected" : ""}`}
      aria-pressed={pressed}
      aria-label={`${label}: ${effect}`}
      onClick={onClick}
    >
      {icon ? (
        <GameIcon src={icon} size={28} />
      ) : (
        <span className="gear-prayer-option__none">×</span>
      )}
      <span>
        <strong>{label}</strong>
        <small>{effect}</small>
      </span>
    </button>
  );
}

export function PrayerPicker({
  loadout,
  setLoadout,
}: {
  loadout: Loadout;
  setLoadout: SetLoadout;
}) {
  const { build } = useBuild();
  const unlockedRegions = useMemo(
    () => REGION_IDS.filter((id) => isRegionUnlocked(build, id)),
    [build],
  );
  const options = PRAYER_OPTIONS.filter(
    (option) => option.style === loadout.style || option.value === loadout.buffs.styleCurse,
  );
  const standard = options.filter((option) => option.book === "standard");
  const ancient = options.filter((option) => option.book === "ancient");
  const setPrayer = (styleCurse: StyleCurseChoice) =>
    setLoadout((previous) => withLoadoutBuffs(previous, { styleCurse }, unlockedRegions));

  return (
    <section
      className="gear-prayer-panel"
      aria-labelledby="gear-prayer-title"
      data-testid="prayer-picker"
    >
      <header className="gear-prayer-panel__header">
        <h3 id="gear-prayer-title">Damage prayer</h3>
        <span>{loadout.buffs.styleCurse === "none" ? "Off" : "Active"}</span>
      </header>
      <div className="gear-prayer-options">
        <PrayerTile
          icon={null}
          label="None"
          effect="No damage prayer"
          pressed={loadout.buffs.styleCurse === "none"}
          onClick={() => setPrayer("none")}
        />
        {[...standard, ...ancient].map((option) => (
          <PrayerTile
            key={option.value}
            icon={prayerIconPath(option.value)}
            label={option.label}
            effect={option.effect}
            pressed={loadout.buffs.styleCurse === option.value}
            onClick={() =>
              setPrayer(loadout.buffs.styleCurse === option.value ? "none" : option.value)
            }
          />
        ))}
      </div>
    </section>
  );
}

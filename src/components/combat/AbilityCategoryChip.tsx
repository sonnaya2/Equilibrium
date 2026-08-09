import { abilityCategoryLabel } from "@/lib/gameArt";

/** Compact category chip - basic blue, enhanced and threshold purple, ultimate red, utility green. */
export function AbilityCategoryChip({
  category,
  weaponSpecial = false,
}: {
  category:
    "basic" | "enhanced" | "threshold" | "ultimate" | "utility" | "blessing" | "conjure" | string;
  weaponSpecial?: boolean;
}) {
  if (category === "blessing") {
    return (
      <span className="ability-cat-chip ability-cat-chip--blessing" data-category="blessing">
        Blessing
      </span>
    );
  }
  if (weaponSpecial) {
    return (
      <span className="ability-cat-chip ability-cat-chip--special" data-category="special">
        Special
      </span>
    );
  }
  if (category === "conjure") {
    return (
      <span className="ability-cat-chip ability-cat-chip--conjure" data-category="conjure">
        Conjure
      </span>
    );
  }
  const label = abilityCategoryLabel(category);
  const kind =
    category === "enhanced" || category === "threshold"
      ? "enhanced"
      : category === "threshold"
        ? "threshold"
        : category === "basic"
          ? "basic"
          : category === "ultimate"
            ? "ultimate"
            : category === "utility"
              ? "utility"
              : "utility";

  return (
    <span className={`ability-cat-chip ability-cat-chip--${kind}`} data-category={kind}>
      {label}
    </span>
  );
}

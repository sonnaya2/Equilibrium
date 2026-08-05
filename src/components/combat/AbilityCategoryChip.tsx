import { abilityCategoryLabel } from "@/lib/gameArt";

/** Compact category chip - basics blue, thresholds purple, ultimates red, blessings gold, conjures gem. */
export function AbilityCategoryChip({
  category,
}: {
  category: "basic" | "enhanced" | "ultimate" | "utility" | "blessing" | "conjure" | string;
}) {
  if (category === "blessing") {
    return (
      <span className="ability-cat-chip ability-cat-chip--blessing" data-category="blessing">
        Blessing
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
    category === "enhanced" || label === "threshold"
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

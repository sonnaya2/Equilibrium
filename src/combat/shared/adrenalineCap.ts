export type MaximumAdrenalineSourceKind = "percentage" | "points";

export interface MaximumAdrenalineSource {
  id: string;
  kind: MaximumAdrenalineSourceKind;
  value: number;
}

export interface MaximumAdrenalineResolution {
  cap: number;
  sources: readonly MaximumAdrenalineSource[];
}

export function resolveAdrenalineCap(
  baseCap: number,
  sources: readonly MaximumAdrenalineSource[],
): MaximumAdrenalineResolution {
  const validBase = Number.isFinite(baseCap) ? Math.max(0, baseCap) : 0;
  const validSources = sources.filter(
    (source) =>
      typeof source.id === "string" &&
      source.id.length > 0 &&
      Number.isFinite(source.value) &&
      source.value !== 0,
  );
  const percentage = validSources
    .filter((source) => source.kind === "percentage")
    .reduce((total, source) => total + source.value, 0);
  const points = validSources
    .filter((source) => source.kind === "points")
    .reduce((total, source) => total + source.value, 0);
  return {
    cap: Math.max(0, Math.floor(validBase * (1 + percentage / 100) + points)),
    sources: validSources,
  };
}

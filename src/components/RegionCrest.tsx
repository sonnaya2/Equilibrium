/**
 * Region crest via CSS background so the browser reuses one decoded image per
 * region instead of N independent <img> decode pipelines on long lists.
 */
import { memo } from "react";
import { regionCrestPath } from "@/lib/gameArt";

const PATH_CACHE = new Map<string, string>();

function crestUrl(regionId: string): string {
  let path = PATH_CACHE.get(regionId);
  if (!path) {
    path = regionCrestPath(regionId);
    PATH_CACHE.set(regionId, path);
  }
  return path;
}

export const RegionCrest = memo(function RegionCrest({
  regionId,
  size = 12,
  className = "",
}: {
  regionId: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-contain bg-center bg-no-repeat ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${crestUrl(regionId)})`,
      }}
    />
  );
});

/** Hidden preload strip — call once when a region filter set is known. */
export function RegionCrestPreload({ regionIds }: { regionIds: readonly string[] }) {
  return (
    <div className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden>
      {regionIds.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element -- intentional preload only
        <img key={id} src={crestUrl(id)} alt="" width={1} height={1} decoding="async" />
      ))}
    </div>
  );
}

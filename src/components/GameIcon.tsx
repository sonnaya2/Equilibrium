/**
 * Game art image. Inside a button or link, keep the default alt="" — a named alt
 * changes the element's accessible name, which the e2e suite pins (AGENTS.md).
 * Missing local files hide quietly (equipment icons sync is progressive).
 *
 * Inside `.data-icon-well`, CSS forces 1:1 fill via object-fit (width/height attrs
 * are only fallbacks when the icon sits outside a well).
 */
"use client";

import { useEffect, useState } from "react";

export function GameIcon({
  src,
  alt = "",
  size = 20,
  className,
  onLoadFailed,
}: {
  src: string | null | undefined;
  alt?: string;
  size?: number;
  className?: string;
  /** Optional: parent can flip well chrome to empty when the file 404s. */
  onLoadFailed?: () => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  // Missing verified path or failed load: empty well (no broken-image glyph).
  if (!src || failed) return null;

  // Plain img: game art is small static PNG from public/, next/image buys nothing here.
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={["game-icon", className].filter(Boolean).join(" ")}
      loading="lazy"
      decoding="async"
      onError={() => {
        setFailed(true);
        onLoadFailed?.();
      }}
    />
  );
}

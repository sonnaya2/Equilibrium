import type { ReactNode } from "react";

/** Shared route width and gutters. */
export function Page({
  children,
  className = "",
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  /** Drops the reading cap for full-width routes such as the map. */
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full ${wide ? "max-w-none" : "max-w-[1600px]"} px-4 py-4 ${className}`
        .replace(/\s+/g, " ")
        .trim()}
    >
      {children}
    </div>
  );
}

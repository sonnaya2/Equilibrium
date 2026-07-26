import type { ReactNode } from "react";

/**
 * Workbench shell (Control Surface winner): fluid width, not a blog column.
 * max-w-[1600px] keeps lines readable on ultra-wide while filling 1440p.
 */
export function Page({
  children,
  className = "",
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  /** Drops the reading cap. For routes whose subject *is* the width — the map
   *  board is the product's centrepiece and every pixel of it is information. */
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto w-full ${wide ? "max-w-none" : "max-w-[1600px]"} px-4 py-5 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

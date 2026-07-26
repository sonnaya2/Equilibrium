import type { ReactNode } from "react";

/**
 * Workbench shell (Control Surface winner): fluid width, not a blog column.
 * max-w-[1600px] keeps lines readable on ultra-wide while filling 1440p.
 */
export function Page({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[1600px] px-4 py-4 ${className}`
        .replace(/\s+/g, " ")
        .trim()}
    >
      {children}
    </div>
  );
}

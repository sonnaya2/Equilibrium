"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Overview"],
  ["/map", "Map"],
  ["/tasks", "Tasks"],
  ["/build", "Build"],
  ["/combat", "Combat"],
  ["/data", "Data"],
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    /* Locked to --header-h from md up so `100svh - var(--header-h)` is exact on
       the map route. Below md the links wrap and the header grows instead. */
    <header className="border-b border-stone-750 md:h-[var(--header-h)]">
      <nav className="mx-auto flex h-full w-full max-w-[1600px] items-center gap-6 px-4 py-3 md:py-0">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-sm tracking-[0.2em] text-gold-400"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 1 14 4.5v7L8 15 2 11.5v-7z"
              fill="none"
              stroke="var(--color-gem-400)"
              strokeWidth="1.5"
            />
            <path d="M8 5 10.5 6.5v3L8 11 5.5 9.5v-3z" fill="var(--color-gem-500)" />
          </svg>
          EQUILIBRIUM
        </Link>
        <ul className="flex flex-wrap gap-4 text-sm">
          {LINKS.map(([href, label]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`transition-colors duration-150 ${
                    active
                      ? "font-medium text-gem-400"
                      : "text-parch-100 hover:text-parch-50"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

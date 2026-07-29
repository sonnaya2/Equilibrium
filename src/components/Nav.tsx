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

/** Gold brand and the six primary routes. */
export function Nav() {
  const pathname = usePathname();

  return (
    <header className="site-head">
      <Link href="/" className="site-brand">
        EQUILIBRIUM
      </Link>
      <nav aria-label="Primary">
        <ul className="site-nav">
          {LINKS.map(([href, label]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`site-nav__btn${active ? " is-active" : ""}`}
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

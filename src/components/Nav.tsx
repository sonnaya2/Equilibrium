"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ELECTIVE_CAP } from "@/league";
import { useBuild } from "@/league/useBuild";

const LINKS = [
  ["/", "Overview"],
  ["/map", "Map"],
  ["/tasks", "Tasks"],
  ["/build", "Build"],
  ["/combat", "Combat"],
  ["/data", "Data"],
] as const;

const RELIC_MONO: Record<string, string> = {
  Survivalist: "SV",
  "Endless Harvest": "EH",
  "Golden Touch": "GT",
};

/**
 * Mast instrument — gold brand, gem active tabs, live pick / T1 mono.
 * Frozen: accessible name EQUILIBRIUM; six primary links.
 */
export function Nav() {
  const pathname = usePathname();
  const { build, loaded } = useBuild();
  const picks = loaded ? build.elective.length : null;
  const t1 = loaded ? build.relics["1"] ?? null : null;
  const mono = t1 ? RELIC_MONO[t1] ?? null : null;

  return (
    <header className="comp-mast">
      <Link href="/" className="comp-brand">
        EQUILIBRIUM
      </Link>
      <nav aria-label="Primary">
        <ul className="comp-nav">
          {LINKS.map(([href, label]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`comp-nav__btn${active ? " is-active" : ""}`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="comp-nav__meta" aria-live="polite">
        picks{" "}
        <strong>
          {picks === null ? `…/${ELECTIVE_CAP}` : `${picks}/${ELECTIVE_CAP}`}
        </strong>
        {mono ? (
          <>
            {" "}
            · T1 <strong>{mono}</strong>
          </>
        ) : null}
      </p>
    </header>
  );
}

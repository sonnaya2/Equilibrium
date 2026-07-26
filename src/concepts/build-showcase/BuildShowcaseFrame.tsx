"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BUILD_SHOWCASE_CONCEPTS, type BuildConceptId } from "./teams";
import "./build-showcase.css";

export function BuildShowcaseFrame({
  active,
  children,
}: {
  active: BuildConceptId;
  children: ReactNode;
}) {
  const concept = BUILD_SHOWCASE_CONCEPTS.find((c) => c.id === active)!;

  return (
    <div className="build-showcase min-h-screen bg-stone-950 text-parch-50">
      <header className="border-b border-stone-750 bg-stone-900">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/concepts/build-showcase" className="font-display text-sm tracking-[0.14em] text-gold-400">
            BUILD SHOWCASE
          </Link>
          <span className="text-xs text-parch-300">
            {concept.codename} · concept only · live useBuild
          </span>
          <nav className="ml-auto flex flex-wrap gap-1" aria-label="Build concepts">
            {BUILD_SHOWCASE_CONCEPTS.map((c) => {
              const on = c.id === active;
              return (
                <Link
                  key={c.id}
                  href={`/concepts/build-showcase/${c.id}`}
                  className={`rounded-sm border px-2 py-1 text-xs ${
                    on
                      ? "border-gem-500 bg-stone-raised text-gem-300"
                      : "border-stone-750 text-parch-100 hover:text-parch-50"
                  }`}
                >
                  {c.name}
                </Link>
              );
            })}
          </nav>
          <Link href="/build" className="text-xs text-parch-300 hover:text-gem-300">
            Production Build →
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] px-3 py-3 md:px-4">{children}</main>
    </div>
  );
}

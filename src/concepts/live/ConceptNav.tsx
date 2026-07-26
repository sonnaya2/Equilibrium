"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONCEPT_SECTIONS, getLiveSkin, type LiveSkinId } from "@/concepts/skins/registry";

export function ConceptNav({ skin }: { skin: LiveSkinId }) {
  const pathname = usePathname();
  const meta = getLiveSkin(skin);
  const base = `/concepts/${skin}`;

  return (
    <header className="concept-nav border-b border-stone-750 bg-stone-900">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/concepts" className="font-display text-xs uppercase tracking-[0.16em] text-gold-400">
          Concepts
        </Link>
        <span className="text-parch-400" aria-hidden>
          /
        </span>
        <span className="text-sm font-medium text-parch-50">{meta?.label ?? skin}</span>
        <nav aria-label={`${meta?.label ?? skin} concept`} className="ml-auto">
          <ul className="flex flex-wrap gap-1">
            {CONCEPT_SECTIONS.map((section) => {
              const href = section.slug ? `${base}/${section.slug}` : base;
              const active =
                section.slug === ""
                  ? pathname === base || pathname === `${base}/`
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={section.label}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`block border-b-2 px-2.5 py-1 text-sm ${
                      active
                        ? "border-gem-400 font-medium text-gem-300"
                        : "border-transparent text-parch-100 hover:text-parch-50"
                    }`}
                  >
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}

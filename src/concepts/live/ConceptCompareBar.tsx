"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LIVE_CONCEPTS, type LiveSkinId } from "@/concepts/skins/registry";

export function ConceptCompareBar({ skin }: { skin: LiveSkinId }) {
  const pathname = usePathname();
  const rest = pathname.replace(new RegExp(`^/concepts/${skin}`), "") || "";
  const layouts = LIVE_CONCEPTS.filter((c) => c.kind === "layout");
  const colors = LIVE_CONCEPTS.filter((c) => c.kind === "color");

  return (
    <div className="sticky bottom-0 z-20 border-t border-stone-750 bg-stone-900/95">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 font-medium text-parch-50">Layouts</span>
          <ul className="flex flex-wrap gap-1">
            {layouts.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/concepts/${s.id}${rest}`}
                  className={`block border px-2.5 py-1 ${
                    s.id === skin
                      ? "border-gem-500 bg-stone-850 text-gem-300"
                      : "border-stone-750 text-parch-100 hover:border-stone-carve"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 font-medium text-parch-50">Colors</span>
          <ul className="flex flex-wrap gap-1">
            {colors.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/concepts/${s.id}${rest}`}
                  className={`block border px-2.5 py-1 ${
                    s.id === skin
                      ? "border-gem-500 bg-stone-850 text-gem-300"
                      : "border-stone-750 text-parch-100 hover:border-stone-carve"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/concepts" className="ml-auto text-parch-300 hover:text-parch-50 hover:underline">
            Hub
          </Link>
          <Link href="/concepts/restoration" className="text-parch-300 hover:text-parch-50 hover:underline">
            Restoration
          </Link>
        </div>
      </div>
    </div>
  );
}

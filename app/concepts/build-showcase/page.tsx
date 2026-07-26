import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import {
  BUILD_SHOWCASE_R1,
  BUILD_SHOWCASE_R2,
  BUILD_SHOWCASE_RUBRIC,
} from "@/concepts/build-showcase/teams";

export const metadata: Metadata = {
  title: "Build Showcase tournament",
  description:
    "R2 no-tabs Build surfaces with official League art — War Court, Dossier Board, Herald Stage.",
  robots: { index: false, follow: false },
};

export default function BuildShowcaseArenaPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="Build Showcase"
        note="R2: no section tabs · official plates · wiki hex icons. Live useBuild. Concept lab — production /build ships after CEO crown."
      />

      <p className="mb-4 text-sm text-parch-100">
        R2 active · 3 contestants
        {" · "}
        <Link href="/concepts" className="text-gem-300 hover:underline">
          Concepts hub
        </Link>
        {" · "}
        <Link href="/build" className="text-parch-300 hover:underline">
          Production Build
        </Link>
      </p>

      <section className="panel mb-6">
        <div className="panel-head">Rubric</div>
        <ul className="panel-body flex flex-wrap gap-3 text-sm text-parch-100">
          {BUILD_SHOWCASE_RUBRIC.map((r) => (
            <li key={r.key} className="border border-stone-750 px-2 py-1">
              <span className="text-parch-50">{r.label}</span>
              <span className="ml-1 font-mono text-xs text-gem-300">{r.weight}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">R2 · open full page</div>
        <div className="grid gap-0 sm:grid-cols-3">
          {BUILD_SHOWCASE_R2.map((c) => (
            <Link
              key={c.id}
              href={`/concepts/build-showcase/${c.id}`}
              className="flex flex-col gap-2 border-b border-stone-750 p-4 transition-colors duration-150 hover:bg-stone-raised sm:border-r sm:border-b-0 last:border-r-0"
            >
              <span className="font-display text-sm uppercase tracking-[0.12em] text-gold-400">
                {c.codename}
              </span>
              <span className="text-xs text-parch-300">{c.name}</span>
              <p className="text-sm leading-5 text-parch-100">{c.thesis}</p>
              <p className="text-xs text-parch-300">{c.shareAngle}</p>
              <span className="mt-auto pt-2 font-mono text-xs text-gem-300">
                /concepts/build-showcase/{c.id}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel mb-6">
        <div className="panel-head">R1 · monogram era (comparison)</div>
        <div className="panel-body flex flex-wrap gap-2 text-sm">
          {BUILD_SHOWCASE_R1.map((c) => (
            <Link
              key={c.id}
              href={`/concepts/build-showcase/${c.id}`}
              className="border border-stone-750 px-2 py-1 text-parch-100 hover:border-gem-500 hover:text-gem-300"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <p className="text-sm text-parch-300">
        Art: wiki hex icons (D stone-inset) + Jagex countdown plates under{" "}
        <code className="text-parch-100">public/game/relics/</code> and{" "}
        <code className="text-parch-100">public/game/leagues/</code>.
      </p>
    </div>
  );
}

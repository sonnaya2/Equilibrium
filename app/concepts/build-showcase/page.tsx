import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import {
  BUILD_SHOWCASE_R1,
  BUILD_SHOWCASE_R2,
  BUILD_SHOWCASE_R3,
  BUILD_SHOWCASE_RUBRIC,
} from "@/concepts/build-showcase/teams";

export const metadata: Metadata = {
  title: "Build Showcase tournament",
  description:
    "R3 topology tournament for /build — Court Rail, Twin Desk, Menu Court. R1/R2 failed.",
  robots: { index: false, follow: false },
};

export default function BuildShowcaseArenaPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="Build Showcase"
        note="Showcase craft = Genshin/HSR energy, Equilibrium tokens. R3 Menu Court hybrid lead — see R3-BRIEF."
      />

      <p className="mb-4 text-sm text-parch-100">
        R3 · Menu Court hybrid lead
        {" · "}
        <Link href="/concepts" className="text-gem-300 hover:underline">
          Concepts hub
        </Link>
        {" · "}
        <Link href="/build" className="text-parch-300 hover:underline">
          Production Build
        </Link>
        {" · "}
        <Link
          href="https://github.com/sonnaya2/Equilibrium/blob/master/src/concepts/build-showcase/R3-BRIEF.md"
          className="text-parch-300 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          R3-BRIEF
        </Link>
      </p>

      <section className="panel mb-6">
        <div className="panel-head">Fail ledger (Phase 0)</div>
        <ul className="panel-body list-disc space-y-1 pl-5 text-sm text-parch-100">
          <li>
            R2 War Court / Dossier / Herald share one topology (regions + court + blessings +
            share) — §4.5 clone fail.
          </li>
          <li>Herald share-first plaque is showcase, not workbench (hard fail pressure).</li>
          <li>
            Production menu: gold-as-chrome, parallel tokens, max-w 1100 — not Hybrid Relic Court.
          </li>
          <li>Self-scores ~8.7–9.0 ignored. CEO bar 9.0; none crowned.</li>
        </ul>
      </section>

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
        <div className="panel-head">
          R3 · topology tournament · Menu Court preferred base (optimizing hybrid)
        </div>
        <p className="border-b border-stone-750 px-4 py-2 text-sm text-parch-100">
          Menu Court is the leading hybrid champion candidate: keep menu structure, merge Court
          Rail relic stage, compact blessing chips. Agent swarm optimizing in lab — not yet
          production crown. Full notes:{" "}
          <code className="text-parch-50">src/concepts/build-showcase/R3-BRIEF.md</code>
          {" · "}
          <Link
            href="https://github.com/sonnaya2/Equilibrium/blob/master/src/concepts/build-showcase/R3-BRIEF.md"
            className="text-gem-300 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            R3-BRIEF on GitHub
          </Link>
        </p>
        <div className="grid gap-0 sm:grid-cols-3">
          {BUILD_SHOWCASE_R3.map((c) => (
            <Link
              key={c.id}
              href={`/concepts/build-showcase/${c.id}`}
              className="flex flex-col gap-2 border-b border-stone-750 p-4 transition-colors duration-150 hover:bg-stone-raised sm:border-r sm:border-b-0 last:border-r-0"
            >
              <span className="font-display text-sm uppercase tracking-[0.12em] text-gold-400">
                {c.codename}
                {c.id === "menu-court" ? " · lead" : ""}
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
        <div className="panel-head">R2 · failed (comparison only)</div>
        <div className="panel-body flex flex-wrap gap-2 text-sm">
          {BUILD_SHOWCASE_R2.map((c) => (
            <Link
              key={c.id}
              href={`/concepts/build-showcase/${c.id}`}
              className="border border-stone-750 px-2 py-1 text-parch-300 hover:border-gem-500 hover:text-gem-300"
            >
              {c.name}
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
              className="border border-stone-750 px-2 py-1 text-parch-300 hover:border-gem-500 hover:text-gem-300"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <p className="text-sm text-parch-300">
        Brief: <code className="text-parch-100">src/concepts/build-showcase/R3-BRIEF.md</code>
        {" · "}
        Art: wiki hex under <code className="text-parch-100">public/game/relics/</code>.
      </p>
    </div>
  );
}

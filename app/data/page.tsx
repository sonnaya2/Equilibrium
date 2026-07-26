import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { getResearchCatalog } from "@/research/catalog";
import { DataWorkbenchHost } from "./DataWorkbenchHost";

export const metadata: Metadata = {
  title: "Data",
  description:
    "Browse region content, progression notes, and sourced game data behind the Equilibrium planner.",
};

export default function DataPage() {
  const catalog = getResearchCatalog();

  return (
    <Page>
      <PageHeading
        title="Data"
        note={`Region unlocks, upgrades and training routes checked on ${catalog.snapshotDate}. Planning assumes ironman / self-sufficient play (no trade). Most links go to the Wiki; PvME, RS Analysis and Jagex updates stay attached when they are the actual source.`}
      />

      <DataWorkbenchHost
        catalog={catalog}
        notes={
          <section>
            <h2 className="text-base font-medium text-parch-50">Research notes</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-parch-100">
              Slayer, Invention, Archaeology, prayers and regional unlocks load through typed research
              loaders so corrections apply. Each row links its own source. Policy and credits live on
              the{" "}
              <Link
                href="/sources"
                className="text-parch-50 underline decoration-stone-750 underline-offset-4 hover:decoration-parch-300"
              >
                sources page
              </Link>
              .
            </p>
          </section>
        }
      />
    </Page>
  );
}

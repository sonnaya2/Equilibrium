import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";

export default function BuildPage() {
  return (
    <Page>
      <PageHeading
        title="Build planner"
        note="Regions, relics, blessings and gear in one plan. The picks are the same ones you make on the map."
      />
      <p className="text-sm text-parch-300">
        Relic and blessing effects publish daily from 28 Jul. The planner fills in as they do.
      </p>
    </Page>
  );
}

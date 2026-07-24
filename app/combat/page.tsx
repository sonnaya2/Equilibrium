import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";

export default function CombatPage() {
  return (
    <Page>
      <PageHeading
        title="Combat calculator"
        note="Current-game RS3 combat math with the league's relics and blessings layered on top."
      />
      <p className="text-sm text-parch-300">
        Engine core in progress: the 2026 damage-per-level curve is implemented and tested. Quick,
        Build, Analysis and Rotation modes surface here.
      </p>
    </Page>
  );
}

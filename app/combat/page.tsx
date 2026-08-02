import { Page } from "@/components/Page";
import { CombatTabs } from "@/components/combat/CombatTabs";

export default function CombatPage() {
  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="route-fill">
        <CombatTabs />
      </div>
    </Page>
  );
}

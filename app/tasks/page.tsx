import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";

export default function TasksPage() {
  return (
    <Page>
      <PageHeading
        title="League tasks"
        note="Tasks run Easy to Master, worth 10–400 league points each, gated by unlocked regions."
      />
      <p className="text-sm text-parch-300">
        No task data yet. The tracker ships against Wiki-verified tasks after launch.
      </p>
    </Page>
  );
}

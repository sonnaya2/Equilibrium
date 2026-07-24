import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { MapLoader } from "@/map/MapLoader";
import { RegionPlanner } from "@/map/RegionPlanner";

export default function MapPage() {
  return (
    <Page>
      <PageHeading
        title="Region map"
        note="Misthalin and Havenhythe are fixed; Karamja unlocks at the first milestone. Pick three of the remaining eight. Build, tasks, and combat all read these picks."
      />
      <div className="mb-4">
        <MapLoader />
      </div>
      <RegionPlanner />
    </Page>
  );
}

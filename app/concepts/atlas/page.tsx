import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/Heading";
import { AtlasMap } from "@/concepts/AtlasMap";

export const metadata: Metadata = {
  title: "Atlas concept",
  description:
    "Lab concept: pick regions on the real RuneScape world map instead of the 3D war table.",
  robots: { index: false, follow: false },
};

export default function AtlasConceptPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
      <PageHeading
        title="Atlas concept"
        note="Lab only. The same three elective picks as /map, made on the real world map rather than the war table — shares the build store, so picks follow you back."
      />

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <Link href="/map" className="text-parch-400 underline-offset-2 hover:text-parch-100 hover:underline">
          Compare with the war table
        </Link>
        <Link href="/concepts" className="text-parch-400 underline-offset-2 hover:text-parch-100 hover:underline">
          Back to concepts lab
        </Link>
      </div>

      <AtlasMap />

      <section className="panel mt-6">
        <div className="panel-head">Where this differs from /map</div>
        <div className="panel-body space-y-2 text-sm text-parch-100">
          <p>
            The war table is original geometry: eleven extruded slabs cut along a shared border-node
            graph, so lock state can be height and colour rather than a badge. This is a photograph
            of Gielinor with markers on it — accurate to the metre, and inert.
          </p>
          <p>
            Markers here are points, not outlines. The wiki publishes a tiled HD map, but the RS3
            tile server it uses is not public — <span className="num">maps.runescape.wiki/rs3</span>{" "}
            returns 404 and the development endpoint is gone — so this is the full-resolution world
            map image resampled at build-prep, vendored rather than hotlinked.
          </p>
          <p className="text-parch-300">
            Region positions are hand-placed against the labels the map itself prints. They locate a
            region, they do not trace its boundary — an outline eyeballed at this scale would be a
            guess presented as data.
          </p>
        </div>
      </section>
    </div>
  );
}

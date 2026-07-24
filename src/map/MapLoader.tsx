"use client";

import dynamic from "next/dynamic";

// The 3D bundle (three/webgpu) must never server-render or leak into other routes.
const MapScene = dynamic(() => import("./MapScene"), {
  ssr: false,
  loading: () => (
    <div className="panel flex h-[62vh] items-center justify-center text-sm text-parch-500">
      Loading the map…
    </div>
  ),
});

export function MapLoader() {
  return <MapScene />;
}

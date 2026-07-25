"use client";

import dynamic from "next/dynamic";
import { FlatBoard } from "./FlatBoard";

// The 3D bundle (three/webgpu) must never server-render or leak into other routes.
// The flat board is the skeleton: same data, same picks, zero 3D cost.
const MapScene = dynamic(() => import("./MapScene"), {
  ssr: false,
  loading: () => (
    <div className="panel panel-body">
      <FlatBoard />
    </div>
  ),
});

export function MapLoader() {
  return <MapScene />;
}

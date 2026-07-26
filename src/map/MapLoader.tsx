"use client";

import dynamic from "next/dynamic";
import { FlatBoard } from "./FlatBoard";

// The 3D bundle (three/webgpu) must never server-render or leak into other routes.
// The flat board is the skeleton: same data, same picks, zero 3D cost.
const MapScene = dynamic(() => import("./MapScene"), {
  ssr: false,
  loading: () => (
    // Same min-h-0/flex-1 contract as the real scene, or the board cell jumps
    // height the moment the 3D chunk lands.
    <div className="panel panel-body min-h-0 flex-1 overflow-y-auto">
      <FlatBoard />
    </div>
  ),
});

export function MapLoader() {
  return <MapScene />;
}

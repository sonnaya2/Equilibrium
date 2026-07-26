"use client";

import dynamic from "next/dynamic";
import { FlatBoard } from "./FlatBoard";

// The 3D bundle (three/webgpu) must never server-render or leak into other routes.
// The flat board is the skeleton: same data, same picks, zero 3D cost.
const MapScene = dynamic(() => import("./MapScene"), {
  ssr: false,
  loading: () => (
    // Same board-sky scene contract as MapScene, or the board cell jumps
    // height the moment the 3D chunk lands. No nested .panel — board frames it.
    // Host uses absolute fill (see .board-sky__canvas-host); no overflow-y
    // path that lets SVG intrinsic height fight the under ledger.
    <div className="board-sky__scene">
      <div className="board-sky__canvas-host">
        <FlatBoard />
      </div>
    </div>
  ),
});

export function MapLoader() {
  return <MapScene />;
}

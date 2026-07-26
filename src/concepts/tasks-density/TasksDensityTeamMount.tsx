"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { TasksDensityTeamId } from "./teams";

export type TasksDensityPreviewProps = {
  records: unknown[];
  tiers: Record<string, number>;
  tierConfidence: Record<string, string>;
  tasksWikiUrl: string;
  completionLive: boolean;
};

const PREVIEWS: Record<TasksDensityTeamId, ComponentType<TasksDensityPreviewProps>> = {
  ledger: dynamic(() => import("./r1/LedgerPreview").then((m) => m.LedgerPreview), {
    ssr: false,
  }),
  quarry: dynamic(() => import("./r1/QuarryPreview").then((m) => m.QuarryPreview), {
    ssr: false,
  }),
  spike: dynamic(() => import("./r1/SpikePreview").then((m) => m.SpikePreview), {
    ssr: false,
  }),
  aperture: dynamic(() => import("./r1/AperturePreview").then((m) => m.AperturePreview), {
    ssr: false,
  }),
};

export function TasksDensityTeamMount({
  teamId,
  ...props
}: TasksDensityPreviewProps & { teamId: TasksDensityTeamId }) {
  const Preview = PREVIEWS[teamId];
  return <Preview {...props} />;
}

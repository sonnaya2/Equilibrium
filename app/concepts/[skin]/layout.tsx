import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ConceptCompareBar } from "@/concepts/live/ConceptCompareBar";
import { ConceptNav } from "@/concepts/live/ConceptNav";
import { getLiveSkin, isLiveSkinId, type LiveSkinId } from "@/concepts/skins/registry";
import "@/concepts/skins/skins.css";

export default async function ConceptSkinLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ skin: string }>;
}) {
  const { skin: raw } = await params;
  if (!isLiveSkinId(raw)) notFound();
  const skin = raw as LiveSkinId;
  const meta = getLiveSkin(skin)!;

  return (
    <div
      data-concept={skin}
      data-layout={meta.layout}
      className={`concept-skin concept-skin--${meta.color}`}
    >
      <p className="border-b border-stone-750 bg-stone-900 px-4 py-1.5 text-center text-xs text-parch-100">
        Design lab · <strong className="text-parch-50">{meta.label}</strong> · real data · not
        production until you pick a winner
      </p>
      <ConceptNav skin={skin} />
      <div className="flex-1">{children}</div>
      <ConceptCompareBar skin={skin} />
    </div>
  );
}

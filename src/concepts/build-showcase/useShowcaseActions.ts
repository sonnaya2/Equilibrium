"use client";

import { useState } from "react";
import { buildShareUrl } from "@/league/share";
import { useBuild } from "@/league/useBuild";

/** Clipboard + live build helpers shared by all showcase concepts. */
export function useShowcaseActions() {
  const api = useBuild();
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "ok" | "err">("idle");

  const flash = (next: "ok" | "err") => {
    setCopyFeedback(next);
    setTimeout(() => setCopyFeedback("idle"), 1400);
  };

  const copyShareLink = () => {
    if (!navigator.clipboard?.writeText) {
      flash("err");
      return;
    }
    void navigator.clipboard
      .writeText(buildShareUrl(api.build))
      .then(() => flash("ok"))
      .catch(() => flash("err"));
  };

  const copyLabel =
    copyFeedback === "ok" ? "Copied" : copyFeedback === "err" ? "Failed" : "Copy link";

  return { ...api, copyShareLink, copyLabel, copyFeedback };
}

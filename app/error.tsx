"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <section className="panel max-w-lg">
        <div className="panel-head">Something went wrong</div>
        <div className="panel-body space-y-3">
          <p className="text-sm text-parch-300">
            This page hit an error. Try again, or open Overview or Map.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-parch-500">Ref {error.digest}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={reset}
              className="rounded-sm border border-stone-750 bg-stone-800 px-3 py-1.5 text-sm text-parch-50 transition-colors duration-150 hover:border-gem-500 hover:text-gem-300"
            >
              Try again
            </button>
            <Link
              href="/"
              className="text-sm text-parch-300 transition-colors duration-150 hover:text-parch-50"
            >
              Overview
            </Link>
            <Link
              href="/map"
              className="text-sm text-parch-300 transition-colors duration-150 hover:text-parch-50"
            >
              Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

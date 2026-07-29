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
    <div className="px-3 py-3">
      <section className="surface-panel max-w-sm">
        <div className="surface-panel__header">Page error</div>
        <div className="surface-panel__body space-y-2">
          <p className="text-sm text-parch-300">Try again, or open Overview or Map.</p>
          {error.digest ? (
            <p className="font-mono text-xs text-parch-500">Ref {error.digest}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button type="button" onClick={reset} className="btn btn--gem">
              Try again
            </button>
            <Link href="/" className="text-sm text-parch-300 hover:text-parch-50">
              Overview
            </Link>
            <Link href="/map" className="text-sm text-parch-300 hover:text-parch-50">
              Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

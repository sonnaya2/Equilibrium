import type { ReactNode } from "react";

export function ConceptPage({ children }: { children: ReactNode }) {
  return <div className="concept-page mx-auto w-full max-w-[1600px] px-4 py-5">{children}</div>;
}

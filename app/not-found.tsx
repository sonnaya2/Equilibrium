import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-3 py-3">
      <section className="comp-panel max-w-sm">
        <div className="comp-panel__head">Page not found</div>
        <div className="comp-panel__body space-y-2">
          <p className="text-sm text-parch-300">No page here.</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/" className="text-gem-400 hover:text-gem-300">
              Overview
            </Link>
            <Link href="/map" className="text-parch-300 hover:text-parch-50">
              Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

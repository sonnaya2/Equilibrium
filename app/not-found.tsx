import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <section className="panel max-w-lg">
        <div className="panel-head">Page not found</div>
        <div className="panel-body space-y-3">
          <p className="text-sm text-parch-300">
            No route matches this URL. Open a working surface:
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href="/"
              className="text-gem-400 transition-colors duration-150 hover:text-gem-300"
            >
              Overview
            </Link>
            <Link
              href="/map"
              className="text-parch-300 transition-colors duration-150 hover:text-parch-50"
            >
              Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

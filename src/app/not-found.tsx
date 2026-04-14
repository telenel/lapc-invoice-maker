import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 page-enter page-enter-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/illustrations/404-bull.png"
        alt=""
        aria-hidden="true"
        className="w-56 h-auto opacity-70 dark:opacity-50"
      />
      <p className="text-6xl font-extrabold tracking-tight text-primary">404</p>
      <div className="text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          This page wandered off campus. Let&apos;s get you back on track.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 mt-2"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

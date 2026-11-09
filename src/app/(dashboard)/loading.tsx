/**
 * Loading fallback for every page in the dashboard.
 *
 * This file is why navigation feels instant. Every page here is dynamic
 * (each reads the session cookie), and Next skips prefetching a dynamic
 * route entirely unless it has a `loading` fallback to prefetch instead.
 * Without this file a sidebar click sat waiting on a full server render
 * with no feedback at all, which both felt broken and invited a second
 * click. With it, the shell and sidebar stay interactive, this skeleton
 * appears immediately, and the real page streams in behind it.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-muted/40" />
        ))}
      </div>
      <div className="rounded-lg border border-border">
        <div className="h-11 animate-pulse rounded-t-lg bg-muted/60" />
        <div className="space-y-px p-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-muted/40" />
          ))}
        </div>
      </div>
    </div>
  );
}

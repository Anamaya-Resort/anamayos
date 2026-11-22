/** Label / value list for the detail dialogs. Empty values are skipped. */
export function DetailRows({ rows }: { rows: [string, string | number | null | undefined][] }) {
  const shown = rows.filter(([, v]) => v != null && v !== '');
  if (!shown.length) return null;
  return (
    <dl className="divide-y divide-border text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="whitespace-pre-line break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

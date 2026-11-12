import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  /** Right-aligned and tabular by default for numbers. */
  numeric?: boolean;
  /** Hidden below sm, for columns that are detail rather than headline. */
  secondary?: boolean;
  render: (row: T) => React.ReactNode;
}

/**
 * The shared table.
 *
 * Used for the post list and under every comparison chart, because no
 * figure on this dashboard is allowed to exist only on hover. Scrolls
 * horizontally on a phone rather than wrapping cells into unreadable
 * stacks, and the first column stays put so you never lose which row
 * you are reading.
 */
export function DataTable<T>({
  columns, rows, rowKey, totalRow, caption, emptyMessage,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  /** Rendered as a sticky footer row. Use for sums, not averages. */
  totalRow?: React.ReactNode[];
  caption?: string;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[40rem] text-sm">
        {caption && (
          <caption className="px-3 py-2 text-left text-xs text-muted-foreground">
            {caption}
          </caption>
        )}
        <thead className="bg-muted/60">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                  c.numeric ? 'text-right' : 'text-left',
                  c.secondary && 'hidden md:table-cell',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row)}
              className={cn(
                'border-t border-border',
                i % 2 === 1 && 'bg-muted/25',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3 py-2.5 align-middle',
                    c.numeric && 'text-right tabular-nums',
                    c.secondary && 'hidden md:table-cell',
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totalRow && (
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/60 font-semibold">
              {totalRow.map((cell, i) => (
                <td
                  key={columns[i]?.key ?? i}
                  className={cn(
                    'px-3 py-2.5',
                    columns[i]?.numeric && 'text-right tabular-nums',
                    columns[i]?.secondary && 'hidden md:table-cell',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

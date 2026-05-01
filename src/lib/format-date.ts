const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const s = typeof input === 'string' ? input : input.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(input);
  const [, y, mm, dd] = m;
  const monthIdx = parseInt(mm, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return String(input);
  return `${y}-${MONTHS[monthIdx]}-${dd}`;
}

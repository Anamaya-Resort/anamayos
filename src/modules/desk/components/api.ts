import type { DeskCatalog, DeskCharge, DeskGuest, SpaDay } from '../types';

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error('request failed'), { code: (body as { error?: string }).error });
  return body as T;
}

export const deskApi = {
  guests: (q: string) => fetch(`/api/desk/guests?q=${encodeURIComponent(q)}`).then((r) => json<DeskGuest[]>(r)),
  catalog: (date: string) => fetch(`/api/desk/catalog?date=${date}`).then((r) => json<DeskCatalog>(r)),
  charges: (bookingId: string) => fetch(`/api/desk/charges?bookingId=${bookingId}`).then((r) => json<DeskCharge[]>(r)),
  day: (date: string) => fetch(`/api/desk/day?date=${date}`).then((r) => json<SpaDay>(r)),
  dayEdit: (body: Record<string, unknown>) =>
    fetch('/api/desk/day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => json<{ id?: string }>(r)),
  create: (body: Record<string, unknown>) =>
    fetch('/api/desk/charges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => json<{ id: string }>(r)),
  cancel: (id: string) => fetch(`/api/desk/charges?id=${id}`, { method: 'DELETE' }).then((r) => json<{ success: boolean }>(r)),
};

export const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/** "14:30" -> "2:30 PM" in the viewer's locale. */
export const clock = (t: string, locale: string) => {
  const [h, m] = t.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(Date.UTC(2000, 0, 1, h, m));
};

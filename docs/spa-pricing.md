# Spa pricing and commission

Where it lives: `service_catalog` (one row per treatment + length). The
website spa page (anamaya-website ServiceMenuBlock) reads `price` live.

- `price`: what the guest pays (USD).
- `commission_amount`: what the practitioner earns per treatment (USD).
  Anamaya keeps `price - commission_amount`. For Lomi Lomi 4 Hands it is
  the total for both therapists.

## Scheduled price changes
Add a row to `service_price_changes` (service, new price, new commission,
effective date). `/api/cron/service-prices` runs daily at 00:05 Costa Rica
time and calls `apply_due_service_price_changes()`, which copies due rows
into `service_catalog` and the linked `products.base_price`.

## 2026-Dec-05 rise (migration 00069)
Source: Geoff's Anamaya_Spa_Price_Comps.xlsx. Commission stays at 50% of
the old price (therapists earn the same dollars); prices rise ~25%, so the
house share goes from 50% to ~60%. 37 rows; old total $3,210, new $4,030,
commission $1,605. Open question: whether prices include the 13% IVA.

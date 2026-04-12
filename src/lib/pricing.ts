import type { TaxRate, PricingResult } from '@/types';

/**
 * Calculate line item price with applicable taxes.
 *
 * Tax matching: a tax applies if its `applies_to` array is empty (= all products)
 * or has at least one slug in common with the product's category slugs.
 *
 * Compound taxes are calculated on (subtotal + all prior non-compound taxes).
 */
export function calculateLineItemPrice(params: {
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  discountPercent?: number;
  taxRates: TaxRate[];
  productCategorySlugs: string[];
}): PricingResult {
  const {
    unitPrice,
    quantity,
    discountAmount = 0,
    discountPercent = 0,
    taxRates,
    productCategorySlugs,
  } = params;

  const gross = unitPrice * quantity;
  const percentDiscount = gross * (discountPercent / 100);
  const subtotal = Math.max(0, gross - discountAmount - percentDiscount);

  // Filter to applicable, active tax rates
  const applicable = taxRates
    .filter((t) => t.is_active)
    .filter((t) => {
      if (!t.applies_to || t.applies_to.length === 0) return true;
      return t.applies_to.some((slug) => productCategorySlugs.includes(slug));
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  let runningTaxBase = subtotal;
  const taxes: PricingResult['taxes'] = [];

  for (const rate of applicable) {
    const base = rate.is_compound ? runningTaxBase : subtotal;
    const amount = round2(base * rate.rate);
    taxes.push({
      taxRateId: rate.id,
      name: rate.name,
      rate: rate.rate,
      amount,
    });
    runningTaxBase += amount;
  }

  const totalTax = taxes.reduce((sum, t) => sum + t.amount, 0);

  return {
    subtotal: round2(subtotal),
    taxes,
    totalTax: round2(totalTax),
    total: round2(subtotal + totalTax),
  };
}

/** Format a number as currency */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

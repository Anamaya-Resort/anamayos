import { getSession } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/products/import
 * Imports products from CSV text. Creates categories and products.
 * Body: { csv: string }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessLevel || session.accessLevel < 5) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { csv: string };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.csv?.trim()) return Response.json({ error: 'Empty CSV' }, { status: 400 });

  const supabase = createServiceClient();
  const lines = parseCSV(body.csv);
  if (lines.length < 2) return Response.json({ error: 'CSV must have header + at least one row' }, { status: 400 });

  const headers = lines[0];
  const rows = lines.slice(1).map((cols) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (cols[i] ?? '').trim(); });
    return row;
  }).filter((r) => r.name || r.slug);

  // Fetch existing categories
  const { data: existingCats } = await supabase.from('product_categories').select('id, slug, name, parent_id');
  const catBySlug = new Map((existingCats ?? []).map((c: Record<string, unknown>) => [c.slug as string, c]));
  const catByName = new Map((existingCats ?? []).map((c: Record<string, unknown>) => [c.name as string, c]));

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      // Resolve category
      let categoryId: string | null = null;
      const catName = row.category;
      const subName = row.subcategory;

      if (catName) {
        // Find or create top-level category
        let topCat = catByName.get(catName) as Record<string, unknown> | undefined;
        if (!topCat) {
          const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          topCat = catBySlug.get(slug) as Record<string, unknown> | undefined;
          if (!topCat) {
            const { data: newCat } = await supabase.from('product_categories')
              .insert({ slug, name: catName, sort_order: 99 }).select().single();
            if (newCat) {
              topCat = newCat as Record<string, unknown>;
              catBySlug.set(slug, topCat);
              catByName.set(catName, topCat);
            }
          }
        }

        categoryId = (topCat?.id as string) ?? null;

        // Find or create sub-category
        if (subName && topCat) {
          const subSlug = (topCat.slug as string) + '-' + subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          let subCat = catBySlug.get(subSlug) as Record<string, unknown> | undefined;
          if (!subCat) {
            subCat = catByName.get(subName) as Record<string, unknown> | undefined;
          }
          if (!subCat) {
            const { data: newSub } = await supabase.from('product_categories')
              .insert({ slug: subSlug, name: subName, parent_id: topCat.id, sort_order: 0 }).select().single();
            if (newSub) {
              subCat = newSub as Record<string, unknown>;
              catBySlug.set(subSlug, subCat);
              catByName.set(subName, subCat);
            }
          }
          if (subCat) categoryId = subCat.id as string;
        }
      }

      // Determine product type
      let productType = 'service';
      const cat = row.category?.toLowerCase() ?? '';
      if (cat.includes('retail') || cat.includes('gift shop')) productType = 'item';
      else if (cat.includes('gift cert')) productType = 'gift_certificate';
      else if (cat.includes('rental')) productType = 'rental';
      else if (cat.includes('transfer')) productType = 'transfer';
      else if (cat.includes('package')) productType = 'package';
      else if (cat.includes('meal')) productType = 'service';
      else if (cat.includes('cookbook')) productType = 'item';

      const slug = row.slug || row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Upsert product
      const { data: product, error: prodErr } = await supabase.from('products').upsert({
        slug,
        name: row.name,
        description: row.description || null,
        short_description: row.short_description || null,
        product_type: productType,
        base_price: row.base_price ? parseFloat(row.base_price) : 0,
        currency: row.currency || 'USD',
        duration_minutes: row.duration_minutes ? parseInt(row.duration_minutes) : null,
        max_participants: row.max_participants ? parseInt(row.max_participants) : 1,
        is_addon: row.is_addon === 'true',
        requires_provider: row.requires_provider === 'true',
        contraindications: row.contraindications || null,
        preparation_notes: row.preparation_notes || null,
        sort_order: row.sort_order ? parseInt(row.sort_order) : 0,
        is_active: true,
      }, { onConflict: 'slug' }).select('id').single();

      if (prodErr) { errors.push(`${row.name}: ${prodErr.message}`); skipped++; continue; }

      // Link to category
      if (categoryId && product) {
        await supabase.from('product_category_map').upsert(
          { product_id: product.id, category_id: categoryId, is_primary: true, sort_order: row.sort_order ? parseInt(row.sort_order) : 0 },
          { onConflict: 'product_id,category_id' }
        );
      }

      // Create variants if present
      if (row.variant_names && product) {
        const names = row.variant_names.split('|');
        const prices = (row.variant_prices || '').split('|');
        const durations = (row.variant_durations || '').split('|');

        // Delete existing variants for this product before re-inserting
        await supabase.from('product_variants').delete().eq('product_id', product.id);

        for (let i = 0; i < names.length; i++) {
          const vName = names[i]?.trim();
          if (!vName) continue;
          const vSlug = slug + '-' + vName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          await supabase.from('product_variants').insert({
            product_id: product.id,
            name: vName,
            slug: vSlug,
            price: prices[i] ? parseFloat(prices[i]) : 0,
            duration_minutes: durations[i] ? parseInt(durations[i]) : null,
            sort_order: i,
            is_active: true,
          });
        }
      }

      imported++;
    } catch (err) {
      errors.push(`${row.name}: ${err instanceof Error ? err.message : 'unknown error'}`);
      skipped++;
    }
  }

  return Response.json({ imported, skipped, errors: errors.length > 0 ? errors : undefined });
}

/** Parse CSV handling quoted fields with commas and newlines */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(cell); cell = '';
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else { cell += ch; }
    }
  }
  // Last row
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);

  return rows;
}

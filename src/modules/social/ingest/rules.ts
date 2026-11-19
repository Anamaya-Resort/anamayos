import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_RULES, compileRules, type CompiledRules, type PillarTerms } from './classify';

/**
 * Loads the classifier's vocabulary from the database.
 *
 * The pillars were always rows; their keywords used to be TypeScript,
 * so changing what counts as "Wellness" meant a deploy. Now anyone with
 * database access can add a term and the next sync uses it.
 *
 * Falls back to the shipped list when the table is empty rather than
 * classifying nothing, because an empty table is far more likely to be
 * a fresh install than a deliberate decision to switch the classifier
 * off.
 */
export async function loadPillarRules(sb: SupabaseClient): Promise<CompiledRules> {
  const { data, error } = await sb
    .from('pillar_keywords')
    .select('term, weight, content_pillars!inner(slug, is_active)')
    .eq('content_pillars.is_active', true);

  if (error || !data || data.length === 0) return DEFAULT_RULES;

  const terms: PillarTerms = {};
  for (const row of data as unknown as Array<{
    term: string; weight: number; content_pillars: { slug: string } | { slug: string }[];
  }>) {
    const joined = Array.isArray(row.content_pillars)
      ? row.content_pillars[0]
      : row.content_pillars;
    const slug = joined?.slug;
    if (!slug || !row.term) continue;
    (terms[slug] ??= []).push([row.term, row.weight ?? 5]);
  }

  const compiled = compileRules(terms);
  return compiled.length > 0 ? compiled : DEFAULT_RULES;
}

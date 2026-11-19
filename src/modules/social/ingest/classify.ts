/**
 * Puts a post into content pillars from its own words.
 *
 * This is a first pass, not a verdict. It exists so a freshly connected
 * account has usable pillar charts on day one instead of one enormous
 * "Unclassified" bar, and every row it writes is marked `source: 'auto'`
 * so a human correction overwrites it and is never overwritten back.
 *
 * Two rules keep it honest:
 *
 * 1. THE STRONGEST SIGNAL DECIDES, NOT THE MOST SIGNALS. A teacher
 *    training post is also a yoga post, and it will always contain more
 *    general yoga words than specific training ones. Scoring on the
 *    single best term, with later matches worth a fraction, is what
 *    stops the broad pillar taking the primary slot by sheer volume.
 *
 * 2. A WEAK WINNER IS NO WINNER. Below the confidence floor the post is
 *    left unclassified rather than guessed at, because a wrong pillar
 *    quietly poisons every comparison chart on the page.
 */

/** Weighted terms per pillar slug. Higher weight = more specific. */
const TERMS: Record<string, Array<[string, number]>> = {
  'yoga-teacher-training': [
    ['teacher training', 10], ['yoga teacher', 10], ['ytt', 9],
    ['200 hr', 8], ['200hr', 8], ['300 hr', 8], ['300hr', 8],
    ['500 hr', 8], ['500hr', 8], ['yogateachertraining', 9],
    ['certification', 4], ['graduate', 3], ['trainee', 4],
  ],
  yoga: [
    ['yoga', 5], ['asana', 6], ['vinyasa', 7], ['pranayama', 7],
    ['savasana', 7], ['shavasana', 7], ['namaste', 4], ['meditation', 4],
    ['mindfulness', 3], ['chakra', 5], ['mantra', 5], ['yin yoga', 6],
    ['sun salutation', 7], ['breathwork', 5],
  ],
  'ecolodge-adventure': [
    ['surf', 6], ['hike', 6], ['hiking', 6], ['waterfall', 7],
    ['jungle', 6], ['rainforest', 7], ['monkey', 6], ['sloth', 6],
    ['toucan', 6], ['wildlife', 6], ['zipline', 7], ['adventure', 5],
    ['sunset', 4], ['beach', 5], ['ocean', 4], ['horseback', 7],
    ['snorkel', 7], ['eco lodge', 8], ['ecolodge', 8], ['sustainable', 5],
    ['montezuma', 6], ['nicoya', 6], ['pura vida', 5], ['costa rica', 3],
  ],
  wellness: [
    ['spa', 6], ['massage', 7], ['detox', 6], ['nutrition', 6],
    ['wellness', 6], ['healing', 5], ['self care', 6], ['self-care', 6],
    ['retreat', 3], ['nourish', 5], ['smoothie', 5],
    ['plant based', 6], ['plant-based', 6], ['organic', 4], ['sauna', 6],
  ],
  biohacking: [
    ['biohack', 10], ['biohacking', 10], ['cold plunge', 8], ['ice bath', 8],
    ['red light', 8], ['infrared', 7], ['hyperbaric', 9], ['peptide', 8],
    ['longevity', 7], ['hrv', 7], ['nootropic', 8], ['grounding', 5],
    ['cryotherapy', 9], ['supplement', 5], ['sleep optimization', 8],
  ],
};

/** Below this, the post is left unclassified rather than guessed at. */
const FLOOR = 10;

/** Scores saturate here, so a very long caption can't run away with it. */
const MAX_SCORE = 30;

/** The best term counts double; everything after it counts a little. */
const LEAD_WEIGHT = 2;
const EXTRA_WEIGHT = 0.4;

/**
 * Terms are matched on word boundaries in prose.
 *
 * Without this, short entries quietly match inside longer words -- "om"
 * inside "morning", "rest" inside "rainforest" -- and tag posts with
 * pillars nobody can see in them. Hashtags are matched as plain
 * substrings instead, because "#yogateachertraining" has no boundaries
 * to find.
 */
const PATTERNS = new Map<string, Array<[RegExp, number]>>(
  Object.entries(TERMS).map(([slug, terms]) => [
    slug,
    terms.map(([term, weight]) => [
      new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
      weight,
    ] as [RegExp, number]),
  ]),
);

export interface Classification {
  /** Pillar slugs on the post, primary first. Empty when unclassified. */
  slugs: string[];
  /** 0..1 for the primary slug. Null when nothing cleared the floor. */
  confidence: number | null;
}

/**
 * Scores a caption and its hashtags against every pillar.
 *
 * Hashtags count double: "#biohacking" is a deliberate statement about
 * what a post is, while the same word in a sentence may be incidental.
 */
export function classifyPost(
  caption: string | null, hashtags: string[],
): Classification {
  const body = (caption ?? '').toLowerCase();
  const tags = hashtags.map((h) => h.toLowerCase().replace(/^#/, '')).join(' ');
  if (!body && !tags) return { slugs: [], confidence: null };

  const scores = new Map<string, number>();

  for (const [slug, terms] of Object.entries(TERMS)) {
    const patterns = PATTERNS.get(slug) ?? [];
    const hits: number[] = [];

    terms.forEach(([term, weight], i) => {
      let hit = 0;
      if (patterns[i][0].test(body)) hit = weight;
      // Hashtags state what a post is, so they count double. They arrive
      // with the spaces squeezed out, so both forms are tried.
      if (tags.includes(term) || tags.includes(term.replace(/[\s-]/g, ''))) {
        hit = Math.max(hit, weight * 2);
      }
      if (hit > 0) hits.push(hit);
    });

    if (hits.length === 0) continue;
    hits.sort((a, b) => b - a);
    const score = hits[0] * LEAD_WEIGHT
      + hits.slice(1).reduce((sum, h) => sum + h, 0) * EXTRA_WEIGHT;
    scores.set(slug, Math.min(score, MAX_SCORE));
  }

  const ranked = [...scores.entries()]
    .filter(([, s]) => s >= FLOOR)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) return { slugs: [], confidence: null };

  // Only pillars within reach of the winner are kept, so a single
  // incidental "sunset" doesn't tag a training post as adventure.
  const top = ranked[0][1];
  const slugs = ranked.filter(([, s]) => s >= Math.max(FLOOR, top * 0.6)).map(([slug]) => slug);

  return { slugs, confidence: Math.round((top / MAX_SCORE) * 100) / 100 };
}

/** Every `#tag` in a caption, lowercased and deduplicated. */
export function extractHashtags(caption: string | null): string[] {
  if (!caption) return [];
  const found = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(found.map((t) => t.slice(1).toLowerCase()))];
}

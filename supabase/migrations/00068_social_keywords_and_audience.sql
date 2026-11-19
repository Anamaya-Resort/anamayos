-- ============================================================
-- Social: editable pillar keywords, audience demographics
-- ============================================================
-- Two additions to 00067, in the same spirit: nothing here names a
-- platform, and anything a human might want to change is data rather
-- than code.
--
-- 1. PILLAR KEYWORDS move out of the classifier and into the database.
--    The pillars themselves were already rows; their keywords were not,
--    so changing what counts as "Wellness" meant editing TypeScript and
--    shipping a deploy. Now it is an UPDATE.
--
-- 2. AUDIENCE DEMOGRAPHICS get their own table rather than more columns
--    on the daily account row. They arrive as a set of buckets per
--    dimension (age 25-34, country CR, city San Jose), the bucket list
--    differs per account and changes over time, and a column per bucket
--    would be unmanageable. One row per bucket per day instead.
-- ============================================================

-- ── 1. Pillar keywords ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pillar_keywords (
  pillar_id uuid NOT NULL REFERENCES content_pillars(id) ON DELETE CASCADE,
  -- Matched on word boundaries in prose and as a substring in hashtags,
  -- lowercase. Multi-word terms are allowed and are the most reliable:
  -- "yoga teacher" says far more than "yoga".
  term      text NOT NULL,
  -- How strong a signal this term is, 1 (weak) to 10 (decisive). The
  -- classifier scores on the single strongest matched term rather than
  -- the count of them, so a decisive term beats a pile of vague ones.
  weight    smallint NOT NULL DEFAULT 5 CHECK (weight BETWEEN 1 AND 10),
  PRIMARY KEY (pillar_id, term)
);

ALTER TABLE pillar_keywords ENABLE ROW LEVEL SECURITY;

-- ── 2. Audience demographics ────────────────────────────────
CREATE TABLE IF NOT EXISTS social_audience_demographics (
  account_id  uuid NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  -- age | gender | country | city. A column rather than a type, so a
  -- network that reports a dimension we have not seen before just works.
  dimension   text NOT NULL,
  -- The bucket as the platform names it: "25-34", "F", "CR",
  -- "San Jose, San Jose". Stored verbatim; the UI formats it.
  bucket      text NOT NULL,
  value       integer NOT NULL DEFAULT 0,
  is_sample   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (account_id, metric_date, dimension, bucket)
);
CREATE INDEX IF NOT EXISTS social_audience_dim_idx
  ON social_audience_demographics (account_id, dimension, metric_date DESC);

ALTER TABLE social_audience_demographics ENABLE ROW LEVEL SECURITY;

-- ── 3. Seed the keywords the classifier shipped with ────────
-- Weights are the ones that were tuned in code against real captions.
-- Deliberately NOT a dump of every yoga word: a term earns its place by
-- being more common in its own pillar than in the others.
INSERT INTO pillar_keywords (pillar_id, term, weight)
SELECT p.id, k.term, k.weight
FROM content_pillars p
JOIN (VALUES
  ('yoga-teacher-training', 'teacher training', 10),
  ('yoga-teacher-training', 'yoga teacher', 10),
  ('yoga-teacher-training', 'ytt', 9),
  ('yoga-teacher-training', 'yogateachertraining', 9),
  ('yoga-teacher-training', '200 hr', 8),
  ('yoga-teacher-training', '200hr', 8),
  ('yoga-teacher-training', '300 hr', 8),
  ('yoga-teacher-training', '300hr', 8),
  ('yoga-teacher-training', '500 hr', 8),
  ('yoga-teacher-training', '500hr', 8),
  ('yoga-teacher-training', 'certification', 4),
  ('yoga-teacher-training', 'graduate', 3),
  ('yoga-teacher-training', 'trainee', 4),

  ('yoga', 'yoga', 5),
  ('yoga', 'asana', 6),
  ('yoga', 'vinyasa', 7),
  ('yoga', 'pranayama', 7),
  ('yoga', 'savasana', 7),
  ('yoga', 'shavasana', 7),
  ('yoga', 'namaste', 4),
  ('yoga', 'meditation', 4),
  ('yoga', 'mindfulness', 3),
  ('yoga', 'chakra', 5),
  ('yoga', 'mantra', 5),
  ('yoga', 'yin yoga', 6),
  ('yoga', 'sun salutation', 7),
  ('yoga', 'breathwork', 5),

  ('ecolodge-adventure', 'surf', 6),
  ('ecolodge-adventure', 'hike', 6),
  ('ecolodge-adventure', 'hiking', 6),
  ('ecolodge-adventure', 'waterfall', 7),
  ('ecolodge-adventure', 'jungle', 6),
  ('ecolodge-adventure', 'rainforest', 7),
  ('ecolodge-adventure', 'monkey', 6),
  ('ecolodge-adventure', 'sloth', 6),
  ('ecolodge-adventure', 'toucan', 6),
  ('ecolodge-adventure', 'wildlife', 6),
  ('ecolodge-adventure', 'zipline', 7),
  ('ecolodge-adventure', 'adventure', 5),
  ('ecolodge-adventure', 'sunset', 4),
  ('ecolodge-adventure', 'beach', 5),
  ('ecolodge-adventure', 'ocean', 4),
  ('ecolodge-adventure', 'horseback', 7),
  ('ecolodge-adventure', 'snorkel', 7),
  ('ecolodge-adventure', 'eco lodge', 8),
  ('ecolodge-adventure', 'ecolodge', 8),
  ('ecolodge-adventure', 'sustainable', 5),
  ('ecolodge-adventure', 'montezuma', 6),
  ('ecolodge-adventure', 'nicoya', 6),
  ('ecolodge-adventure', 'pura vida', 5),
  ('ecolodge-adventure', 'costa rica', 3),

  ('wellness', 'spa', 6),
  ('wellness', 'massage', 7),
  ('wellness', 'detox', 6),
  ('wellness', 'nutrition', 6),
  ('wellness', 'wellness', 6),
  ('wellness', 'healing', 5),
  ('wellness', 'self care', 6),
  ('wellness', 'self-care', 6),
  ('wellness', 'retreat', 3),
  ('wellness', 'nourish', 5),
  ('wellness', 'smoothie', 5),
  ('wellness', 'plant based', 6),
  ('wellness', 'plant-based', 6),
  ('wellness', 'organic', 4),
  ('wellness', 'sauna', 6),

  ('biohacking', 'biohack', 10),
  ('biohacking', 'biohacking', 10),
  ('biohacking', 'cold plunge', 8),
  ('biohacking', 'ice bath', 8),
  ('biohacking', 'red light', 8),
  ('biohacking', 'infrared', 7),
  ('biohacking', 'hyperbaric', 9),
  ('biohacking', 'peptide', 8),
  ('biohacking', 'longevity', 7),
  ('biohacking', 'hrv', 7),
  ('biohacking', 'nootropic', 8),
  ('biohacking', 'grounding', 5),
  ('biohacking', 'cryotherapy', 9),
  ('biohacking', 'supplement', 5),
  ('biohacking', 'sleep optimization', 8)
) AS k(slug, term, weight) ON k.slug = p.slug
ON CONFLICT (pillar_id, term) DO NOTHING;

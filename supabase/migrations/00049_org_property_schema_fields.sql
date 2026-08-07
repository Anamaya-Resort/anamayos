-- ══════════════════════════════════════════════════════════════
-- 00049: Schema.org / brand fields on org_properties
--
-- These describe the property (resort/hotel) for the public website's
-- structured data (schema.org), so the brand's canonical facts are entered
-- once here and reused across every page:
--   same_as      -> schema.org `sameAs` (official social + review profiles)
--   rating_*     -> schema.org `aggregateRating`
--   amenities    -> schema.org `amenityFeature`
--   price_range  -> schema.org `priceRange`
--   logo_url     -> schema.org `logo` / `image`
-- ══════════════════════════════════════════════════════════════

ALTER TABLE org_properties
  ADD COLUMN IF NOT EXISTS same_as jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rating_value numeric(2,1),
  ADD COLUMN IF NOT EXISTS rating_count integer,
  ADD COLUMN IF NOT EXISTS rating_source text,
  ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS price_range text,
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN org_properties.same_as IS 'schema.org sameAs — array of official profile/reference URLs (Instagram, Facebook, TripAdvisor, ...)';
COMMENT ON COLUMN org_properties.rating_value IS 'schema.org aggregateRating.ratingValue (e.g. 4.0)';
COMMENT ON COLUMN org_properties.rating_count IS 'schema.org aggregateRating.reviewCount';
COMMENT ON COLUMN org_properties.rating_source IS 'Human label for where the rating comes from, e.g. TripAdvisor';
COMMENT ON COLUMN org_properties.amenities IS 'schema.org amenityFeature — array of amenity name strings';
COMMENT ON COLUMN org_properties.price_range IS 'schema.org priceRange, e.g. "$$$"';
COMMENT ON COLUMN org_properties.logo_url IS 'schema.org logo / image URL for the brand';

ALTER TABLE factions ADD COLUMN IF NOT EXISTS slug varchar(32);
ALTER TABLE factions ADD COLUMN IF NOT EXISTS promo_seats integer NOT NULL DEFAULT 100;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS promo_seats_used integer NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS promo_min_usd_cents integer NOT NULL DEFAULT 100;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS page_hidden boolean NOT NULL DEFAULT false;

UPDATE factions
SET promo_seats_used = sub.granted
FROM (
  SELECT granted_via_promo_faction_id AS faction_id, count(*)::int AS granted
  FROM game_licenses
  WHERE granted_via_promo_faction_id IS NOT NULL
  GROUP BY granted_via_promo_faction_id
) AS sub
WHERE factions.id = sub.faction_id AND factions.promo_seats_used = 0;

UPDATE factions
SET promo_seats = GREATEST(promo_seats, promo_seats_used)
WHERE promo_seats_used > promo_seats;

UPDATE factions
SET slug = left(upper(regexp_replace(coalesce(nullif(symbol, ''), name), '[^A-Za-z0-9]', '', 'g')), 20)
WHERE slug IS NULL;

UPDATE factions
SET slug = 'F' || number::text
WHERE slug IS NULL OR slug = '';

UPDATE factions AS f
SET slug = f.slug || '-' || f.number::text
FROM (
  SELECT game_id, slug, min(number) AS keeper
  FROM factions
  WHERE slug IS NOT NULL
  GROUP BY game_id, slug
  HAVING count(*) > 1
) AS dup
WHERE f.game_id = dup.game_id AND f.slug = dup.slug AND f.number <> dup.keeper;

CREATE UNIQUE INDEX IF NOT EXISTS idx_factions_game_slug ON factions (game_id, slug);

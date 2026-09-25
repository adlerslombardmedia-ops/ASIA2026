-- ============================================================
-- ASIA CUP 2026 — Sponsor roster update
-- Run in Supabase SQL Editor. Safe to re-run.
-- Bloom is the headline sponsor (tier 1, large); everyone else is tier 2.
-- Adipoli is no longer a sponsor — removed. Flymart and Tripodope added
-- (no outbound link on file yet for either — add one later from
-- Admin → Sponsors whenever you have it).
-- ============================================================

DELETE FROM sponsors WHERE id = 'adpoli';

INSERT INTO sponsors (id, name, logo_url, link_url, tier, sort_order) VALUES
  ('bloom',     'Bloom International', '/images/sponsors/bloom.png',     'https://www.bloominternational.org',       1, 1),
  ('diamond',   'Diamond Brescia',     '/images/sponsors/diamond.png',   'https://www.instagram.com/diamondbrescia', 2, 1),
  ('tripodope', 'Tripodope',           '/images/sponsors/tripodope.png', NULL,                                        2, 2),
  ('flymart',   'Flymart',             '/images/sponsors/flymart.png',   NULL,                                        2, 3),
  ('arcon',     'Arcon',               '/images/sponsors/arcon.png',     'https://www.instagram.com/arcon.biz/',     2, 4),
  ('finetrip',  'A Fine Trip',         '/images/sponsors/finetrip.png',  'https://www.instagram.com/afinetrip/',     2, 5),
  ('hiz',       'Hiz Sports',          '/images/sponsors/hiz.png',       'https://www.instagram.com/hizsports',      2, 6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  link_url = EXCLUDED.link_url,
  tier = EXCLUDED.tier,
  sort_order = EXCLUDED.sort_order;

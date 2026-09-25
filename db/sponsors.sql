-- ASIA CUP 2026 — Sponsors table (run once in your database's SQL editor)
CREATE TABLE IF NOT EXISTS public.sponsors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  link_url TEXT,
  tier INTEGER NOT NULL DEFAULT 1,      -- 1 = large / main sponsor, 2 = small
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.sponsors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read sponsors" ON public.sponsors;
CREATE POLICY "Public read sponsors" ON public.sponsors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write sponsors" ON public.sponsors;
CREATE POLICY "Auth write sponsors" ON public.sponsors FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

ALTER PUBLICATION supabase_realtime ADD TABLE public.sponsors;

-- Public bucket for uploaded sponsor logos
INSERT INTO storage.buckets (id, name, public) VALUES ('sponsor-logos', 'sponsor-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read sponsor logos" ON storage.objects;
CREATE POLICY "Public read sponsor logos" ON storage.objects FOR SELECT USING (bucket_id = 'sponsor-logos');
DROP POLICY IF EXISTS "Auth upload sponsor logos" ON storage.objects;
CREATE POLICY "Auth upload sponsor logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sponsor-logos');
DROP POLICY IF EXISTS "Auth update sponsor logos" ON storage.objects;
CREATE POLICY "Auth update sponsor logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'sponsor-logos');

-- Seed the current sponsors
INSERT INTO public.sponsors (id, name, logo_url, link_url, tier, sort_order) VALUES
  ('bloom',    'Bloom International', '/images/sponsors/bloom.png',    'https://www.bloominternational.org',        1, 1),
  ('arcon',    'Arcon',               '/images/sponsors/arcon.png',    'https://www.instagram.com/arcon.biz/',      1, 2),
  ('finetrip', 'A Fine Trip',         '/images/sponsors/finetrip.png', 'https://www.instagram.com/afinetrip/',      1, 3),
  ('diamond',  'Diamond Brescia',     '/images/sponsors/diamond.png',  'https://www.instagram.com/diamondbrescia',  2, 1),
  ('adpoli',   'Adipoli',             '/images/sponsors/adpoli.png',   'https://www.instagram.com/adipoli.zone/',   2, 2),
  ('hiz',      'Hiz Sports',          '/images/sponsors/hiz.png',      'https://www.instagram.com/hizsports',       2, 3)
ON CONFLICT (id) DO NOTHING;

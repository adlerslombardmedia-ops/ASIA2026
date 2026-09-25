-- ASIA CUP 2026 — Redesign migration (run once in Supabase SQL Editor)
-- Adds everything the new app needs on top of the original tournament schema:
-- new columns, new tables (shots, possession, awards, announcements, sponsors,
-- manager_passwords), storage buckets, RLS policies, and the manager-portal
-- RPC functions (password-gated actions performed by team managers who are
-- NOT Supabase Auth users — they authenticate with a per-team password).
--
-- Safe to run multiple times (everything is IF NOT EXISTS / CREATE OR REPLACE).

-- ============================================================
-- COLUMNS
-- ============================================================
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_category TEXT DEFAULT 'Keralite';
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_type TEXT DEFAULT 'player';

ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS x NUMERIC;
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS y NUMERIC;

-- match_lineups needs a natural key for upserts from the admin UI
DO $$ BEGIN
  ALTER TABLE match_lineups ADD CONSTRAINT match_lineups_match_player_key UNIQUE (match_id, player_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- NEW TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS shots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id),
  player_id TEXT REFERENCES players(id),
  shot_x NUMERIC NOT NULL,
  shot_y NUMERIC NOT NULL,
  end_x NUMERIC,
  end_y NUMERIC,
  outcome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS possession (
  match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  home_seconds INTEGER NOT NULL DEFAULT 0,
  away_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS awards (
  category TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id),
  player_id TEXT REFERENCES players(id),
  custom_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message TEXT NOT NULL,
  author_email TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  link_url TEXT,
  tier INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Manager-portal login: one plaintext password per team, set/reset from Admin.
-- (Not a security-sensitive account system — it just gates who can log
-- match events for their own team from the public Manager tab.)
CREATE TABLE IF NOT EXISTS manager_passwords (
  team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  password TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE possession ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_passwords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read shots" ON shots;
CREATE POLICY "Public read shots" ON shots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth write shots" ON shots;
CREATE POLICY "Auth write shots" ON shots FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read possession" ON possession;
CREATE POLICY "Public read possession" ON possession FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth write possession" ON possession;
CREATE POLICY "Auth write possession" ON possession FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read awards" ON awards;
CREATE POLICY "Public read awards" ON awards FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth write awards" ON awards;
CREATE POLICY "Auth write awards" ON awards FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read announcements" ON announcements;
CREATE POLICY "Public read announcements" ON announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth write announcements" ON announcements;
CREATE POLICY "Auth write announcements" ON announcements FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read sponsors" ON sponsors;
CREATE POLICY "Public read sponsors" ON sponsors FOR SELECT USING (true);
DROP POLICY IF EXISTS "Auth write sponsors" ON sponsors;
CREATE POLICY "Auth write sponsors" ON sponsors FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- manager_passwords is never read/written directly by clients — only via the
-- SECURITY DEFINER functions below — so lock it down completely.
DROP POLICY IF EXISTS "No direct access" ON manager_passwords;
CREATE POLICY "No direct access" ON manager_passwords FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('sponsor-logos', 'sponsor-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('announcement-files', 'announcement-files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('team-logos', 'team-logos', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read sponsor logos" ON storage.objects;
CREATE POLICY "Public read sponsor logos" ON storage.objects FOR SELECT USING (bucket_id = 'sponsor-logos');
DROP POLICY IF EXISTS "Auth write sponsor logos" ON storage.objects;
CREATE POLICY "Auth write sponsor logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sponsor-logos');
DROP POLICY IF EXISTS "Auth update sponsor logos" ON storage.objects;
CREATE POLICY "Auth update sponsor logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'sponsor-logos');

DROP POLICY IF EXISTS "Public read announcement files" ON storage.objects;
CREATE POLICY "Public read announcement files" ON storage.objects FOR SELECT USING (bucket_id = 'announcement-files');
DROP POLICY IF EXISTS "Auth write announcement files" ON storage.objects;
CREATE POLICY "Auth write announcement files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'announcement-files');

DROP POLICY IF EXISTS "Public read team logos" ON storage.objects;
CREATE POLICY "Public read team logos" ON storage.objects FOR SELECT USING (bucket_id = 'team-logos');
DROP POLICY IF EXISTS "Auth write team logos" ON storage.objects;
CREATE POLICY "Auth write team logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'team-logos');
DROP POLICY IF EXISTS "Auth update team logos" ON storage.objects;
CREATE POLICY "Auth update team logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'team-logos');

-- ============================================================
-- REALTIME
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE shots; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE possession; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE awards; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE announcements; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE sponsors; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE match_lineups; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE tactics; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- MANAGER PORTAL RPCs
-- Each manager action is password-gated (p_team_id + p_password checked
-- against manager_passwords) rather than using Supabase Auth, since team
-- managers are not app "users". Functions run as SECURITY DEFINER so they
-- can write past RLS once the password check passes.
-- ============================================================

CREATE OR REPLACE FUNCTION verify_manager_password(p_team_id TEXT, p_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM manager_passwords WHERE team_id = p_team_id AND password = p_password
  ) INTO ok;
  RETURN ok;
END; $$;

CREATE OR REPLACE FUNCTION _check_manager(p_team_id TEXT, p_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_passwords WHERE team_id = p_team_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid manager password';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION manager_log_event(
  p_team_id TEXT, p_password TEXT, p_match_id TEXT, p_player_id TEXT,
  p_type TEXT, p_minute INTEGER, p_assist_player_id TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _check_manager(p_team_id, p_password);
  INSERT INTO match_events (id, match_id, type, team_id, player_id, minute)
    VALUES (gen_random_uuid()::text, p_match_id, p_type, p_team_id, p_player_id, p_minute);
  IF p_type = 'goal' AND p_assist_player_id IS NOT NULL THEN
    INSERT INTO match_events (id, match_id, type, team_id, player_id, minute)
      VALUES (gen_random_uuid()::text, p_match_id, 'assist', p_team_id, p_assist_player_id, p_minute);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION manager_delete_event(p_team_id TEXT, p_password TEXT, p_event_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _check_manager(p_team_id, p_password);
  DELETE FROM match_events WHERE id = p_event_id AND team_id = p_team_id;
END; $$;

CREATE OR REPLACE FUNCTION manager_save_lineup(p_team_id TEXT, p_password TEXT, p_match_id TEXT, p_players JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_side TEXT;
  v_item JSONB;
BEGIN
  PERFORM _check_manager(p_team_id, p_password);

  SELECT CASE WHEN home_team_id = p_team_id THEN 'home' WHEN away_team_id = p_team_id THEN 'away' END
    INTO v_side FROM matches WHERE id = p_match_id;
  IF v_side IS NULL THEN
    RAISE EXCEPTION 'Team % is not in match %', p_team_id, p_match_id;
  END IF;

  DELETE FROM match_lineups WHERE match_id = p_match_id AND side = v_side;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_players) LOOP
    INSERT INTO match_lineups (match_id, player_id, side, x, y)
    VALUES (
      p_match_id,
      v_item->>'player_id',
      v_side,
      NULLIF(v_item->>'x', '')::numeric,
      NULLIF(v_item->>'y', '')::numeric
    )
    ON CONFLICT (match_id, player_id) DO UPDATE SET side = EXCLUDED.side, x = EXCLUDED.x, y = EXCLUDED.y;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION manager_log_shot(
  p_team_id TEXT, p_password TEXT, p_match_id TEXT, p_player_id TEXT,
  p_shot_x NUMERIC, p_shot_y NUMERIC, p_end_x NUMERIC, p_end_y NUMERIC, p_outcome TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _check_manager(p_team_id, p_password);
  INSERT INTO shots (id, match_id, team_id, player_id, shot_x, shot_y, end_x, end_y, outcome)
    VALUES (gen_random_uuid()::text, p_match_id, p_team_id, p_player_id, p_shot_x, p_shot_y, p_end_x, p_end_y, p_outcome);
END; $$;

CREATE OR REPLACE FUNCTION manager_add_player(
  p_team_id TEXT, p_password TEXT, p_name TEXT, p_number INTEGER,
  p_position TEXT, p_category TEXT, p_player_type TEXT
) RETURNS players LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row players;
BEGIN
  PERFORM _check_manager(p_team_id, p_password);
  INSERT INTO players (id, team_id, name, number, position, player_category, player_type)
    VALUES (gen_random_uuid()::text, p_team_id, p_name, p_number, p_position, p_category, p_player_type)
    RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION manager_update_player(
  p_team_id TEXT, p_password TEXT, p_player_id TEXT, p_name TEXT, p_number INTEGER,
  p_position TEXT, p_category TEXT, p_player_type TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _check_manager(p_team_id, p_password);
  UPDATE players SET name = p_name, number = p_number, position = p_position,
    player_category = p_category, player_type = p_player_type
    WHERE id = p_player_id AND team_id = p_team_id;
END; $$;

CREATE OR REPLACE FUNCTION manager_delete_player(p_team_id TEXT, p_password TEXT, p_player_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _check_manager(p_team_id, p_password);
  DELETE FROM players WHERE id = p_player_id AND team_id = p_team_id;
END; $$;

-- ─── Admin-only (Supabase Auth) functions to manage manager passwords ──────
CREATE OR REPLACE FUNCTION admin_set_manager_password(p_team_id TEXT, p_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO manager_passwords (team_id, password, updated_at) VALUES (p_team_id, p_password, now())
    ON CONFLICT (team_id) DO UPDATE SET password = EXCLUDED.password, updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION admin_get_manager_passwords()
RETURNS TABLE (team_id TEXT, password TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'authenticated' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT mp.team_id, mp.password FROM manager_passwords mp;
END; $$;

GRANT EXECUTE ON FUNCTION verify_manager_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_log_event(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_delete_event(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_save_lineup(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_log_shot(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_add_player(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_update_player(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_delete_player(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_manager_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_manager_passwords() TO authenticated;

-- ============================================================
-- SEED: default sponsors (skipped if already present)
-- ============================================================
INSERT INTO sponsors (id, name, logo_url, link_url, tier, sort_order) VALUES
  ('bloom',    'Bloom International', '/images/sponsors/bloom.png',    'https://www.bloominternational.org',       1, 1),
  ('arcon',    'Arcon',               '/images/sponsors/arcon.png',    'https://www.instagram.com/arcon.biz/',     1, 2),
  ('finetrip', 'A Fine Trip',         '/images/sponsors/finetrip.png', 'https://www.instagram.com/afinetrip/',     1, 3),
  ('diamond',  'Diamond Brescia',     '/images/sponsors/diamond.png',  'https://www.instagram.com/diamondbrescia', 2, 1),
  ('adpoli',   'Adipoli',             '/images/sponsors/adpoli.png',   'https://www.instagram.com/adipoli.zone/',  2, 2),
  ('hiz',      'Hiz Sports',          '/images/sponsors/hiz.png',      'https://www.instagram.com/hizsports',      2, 3)
ON CONFLICT (id) DO NOTHING;

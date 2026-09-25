-- ============================================================
-- ASIA CUP 2026 — Full database schema (run once in Supabase SQL Editor)
-- ============================================================
-- This is the complete, current schema for the tournament app. It is
-- idempotent (IF NOT EXISTS / CREATE OR REPLACE everywhere) so it is safe
-- to run against a brand-new Supabase project OR one that already has the
-- original tables — it only creates/adds what's missing.
--
-- Scope of match-event tracking: score, who scored, who assisted, and
-- cards (yellow/red) — via the `matches` and `match_events` tables. There
-- is no shot-map or possession tracking in this version.

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  primary_color TEXT DEFAULT '#FFD400',
  secondary_color TEXT DEFAULT '#282828',
  logo_url TEXT,
  insta_page TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS insta_page TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS website_url TEXT;

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER,
  position TEXT,
  is_starter BOOLEAN DEFAULT false,
  player_category TEXT DEFAULT 'Keralite',
  player_type TEXT DEFAULT 'player',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_category TEXT DEFAULT 'Keralite';
ALTER TABLE players ADD COLUMN IF NOT EXISTS player_type TEXT DEFAULT 'player';

-- ============================================================
-- GROUP ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS group_assignments (
  team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  group_letter CHAR(1) NOT NULL CHECK (group_letter IN ('A','B','C','D')),
  sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- MATCHES
-- Group stage: 4 groups (A, B, C, D). Group sizes can differ (e.g. 4/4/4/5
-- for 17 teams) — nothing here assumes equal group sizes. Top 2 of every
-- group advance to the Quarter-Finals (8 teams), then single-elimination
-- through to the Final.
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  stage TEXT NOT NULL DEFAULT 'group',
  group_letter CHAR(1),
  match_number INTEGER,
  home_team_id TEXT REFERENCES teams(id),
  away_team_id TEXT REFERENCES teams(id),
  home_score INTEGER,
  away_score INTEGER,
  home_penalties INTEGER,
  away_penalties INTEGER,
  played BOOLEAN DEFAULT false,
  winner_team_id TEXT REFERENCES teams(id),
  status TEXT DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  match_date DATE,
  match_time TIME,
  ground TEXT,
  home_source TEXT,
  away_source TEXT,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_penalties INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_penalties INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- ============================================================
-- MATCH LINEUPS (starting 7 + pitch position per match)
-- ============================================================
CREATE TABLE IF NOT EXISTS match_lineups (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('home','away')),
  x NUMERIC,
  y NUMERIC,
  PRIMARY KEY (match_id, player_id)
);
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS x NUMERIC;
ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS y NUMERIC;

-- ============================================================
-- MATCH EVENTS — goals, assists, yellow/red cards
-- ============================================================
CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('goal','assist','yellow_card','red_card')),
  team_id TEXT REFERENCES teams(id),
  player_id TEXT REFERENCES players(id),
  player_name TEXT,
  minute INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Widen the type check if it was created by an older version of this schema
DO $$ BEGIN
  ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_type_check;
  ALTER TABLE match_events ADD CONSTRAINT match_events_type_check
    CHECK (type IN ('goal','assist','yellow_card','red_card'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================
-- TACTICS (formation template per match per team)
-- ============================================================
CREATE TABLE IF NOT EXISTS tactics (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id),
  positions JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (match_id, team_id)
);

-- ============================================================
-- TOURNAMENT STATE (draw_done, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_state (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AWARDS (Golden Boot, MVP, etc. — one row per category)
-- ============================================================
CREATE TABLE IF NOT EXISTS awards (
  category TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id),
  player_id TEXT REFERENCES players(id),
  custom_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ANNOUNCEMENTS (admin posts shown to everyone)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message TEXT NOT NULL,
  author_email TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SPONSORS — managed from Admin → Sponsors: name, logo, and an outbound
-- link (Instagram or website) that the public sponsor banner links to.
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  link_url TEXT,
  tier INTEGER NOT NULL DEFAULT 1,      -- 1 = large / main sponsor, 2 = small
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- No seed data: sponsors are entered from Admin → Sponsors as they're confirmed.

-- ============================================================
-- MANAGER PORTAL LOGIN
-- One plaintext password per team, set/reset from Admin → Managers. Team
-- managers are not Supabase Auth users, so every manager action below is
-- gated by checking p_team_id + p_password against this table instead.
-- ============================================================
CREATE TABLE IF NOT EXISTS manager_passwords (
  team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  password TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Public can read everything (it's a public tournament site). Only an
-- authenticated (Supabase Auth) admin can write directly to tables.
-- ============================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_passwords ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['teams','players','group_assignments','matches','match_lineups','match_events','tactics','tournament_state','awards','announcements','sponsors'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public read" ON %I', t);
    EXECUTE format('CREATE POLICY "Public read" ON %I FOR SELECT USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Auth write" ON %I', t);
    EXECUTE format('CREATE POLICY "Auth write" ON %I FOR ALL USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')', t);
  END LOOP;
END $$;

-- manager_passwords is never read/written directly by clients — only via
-- the SECURITY DEFINER functions below — so lock it down completely.
DROP POLICY IF EXISTS "No direct access" ON manager_passwords;
CREATE POLICY "No direct access" ON manager_passwords FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('sponsor-logos', 'sponsor-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('announcement-files', 'announcement-files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('team-logos', 'team-logos', true) ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE b TEXT;
BEGIN
  FOREACH b IN ARRAY ARRAY['sponsor-logos','announcement-files','team-logos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Public read %s" ON storage.objects', b);
    EXECUTE format('CREATE POLICY "Public read %s" ON storage.objects FOR SELECT USING (bucket_id = %L)', b, b);
    EXECUTE format('DROP POLICY IF EXISTS "Auth write %s" ON storage.objects', b);
    EXECUTE format('CREATE POLICY "Auth write %s" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L)', b, b);
    EXECUTE format('DROP POLICY IF EXISTS "Auth update %s" ON storage.objects', b);
    EXECUTE format('CREATE POLICY "Auth update %s" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L)', b, b);
  END LOOP;
END $$;

-- ============================================================
-- REALTIME
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['matches','match_events','teams','group_assignments','players','match_lineups','tactics','awards','announcements','sponsors'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- FIXTURE GENERATION NOTE
-- Match fixtures are generated dynamically from Admin → Draw → "Generate
-- Match Fixtures", which builds a single round-robin per group from
-- whatever teams were actually assigned to it (any group size works).
-- There is no hardcoded fixture list in this schema.
-- ============================================================

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

-- Lets a manager edit their own team's logo/colors/Instagram/website —
-- same fields as Admin → Teams & Logos, scoped to their own team.
-- Any parameter left NULL is left unchanged.
CREATE OR REPLACE FUNCTION manager_update_team(
  p_team_id TEXT, p_password TEXT,
  p_logo_url TEXT DEFAULT NULL,
  p_primary_color TEXT DEFAULT NULL,
  p_secondary_color TEXT DEFAULT NULL,
  p_insta_page TEXT DEFAULT NULL,
  p_website_url TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _check_manager(p_team_id, p_password);
  UPDATE teams SET
    logo_url = COALESCE(p_logo_url, logo_url),
    primary_color = COALESCE(p_primary_color, primary_color),
    secondary_color = COALESCE(p_secondary_color, secondary_color),
    insta_page = COALESCE(p_insta_page, insta_page),
    website_url = COALESCE(p_website_url, website_url)
  WHERE id = p_team_id;
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
GRANT EXECUTE ON FUNCTION manager_add_player(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_update_player(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_delete_player(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION manager_update_team(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_set_manager_password(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_manager_passwords() TO authenticated;

-- ============================================================
-- OPTIONAL: DROP THE OLD SHOT-MAP / POSSESSION FEATURE (no longer used)
-- Safe no-op if these tables were never created in your project.
-- ============================================================
DROP TABLE IF EXISTS shots;
DROP TABLE IF EXISTS possession;
DROP FUNCTION IF EXISTS manager_log_shot(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

-- ============================================================
-- OPTIONAL: CLEAR PLACEHOLDER TEAMS
-- Uncomment and run this block ONLY if you want to wipe every team (and
-- their players/group assignments/matches) to start entering the real
-- roster from a clean slate. The same action is available from
-- Admin → Teams → "Remove All Teams", which is the easier way to do this.
-- ============================================================
-- DELETE FROM matches;
-- DELETE FROM teams;

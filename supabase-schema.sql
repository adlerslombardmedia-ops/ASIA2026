-- KEFF Championship Milano 2026 — Database Schema
-- Run this in the Supabase SQL Editor

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
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  played BOOLEAN DEFAULT false,
  winner_team_id TEXT REFERENCES teams(id),
  match_date DATE,
  match_time TIME,
  ground TEXT,
  home_source TEXT,
  away_source TEXT,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MATCH LINEUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS match_lineups (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT REFERENCES players(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('home','away')),
  PRIMARY KEY (match_id, player_id)
);

-- ============================================================
-- MATCH EVENTS (goals, assists)
-- ============================================================
CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('goal','assist')),
  team_id TEXT REFERENCES teams(id),
  player_id TEXT REFERENCES players(id),
  player_name TEXT,
  minute INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TACTICS (positions per match per team)
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
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tactics ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_state ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (everyone can view the tournament)
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Public read groups" ON group_assignments FOR SELECT USING (true);
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read lineups" ON match_lineups FOR SELECT USING (true);
CREATE POLICY "Public read events" ON match_events FOR SELECT USING (true);
CREATE POLICY "Public read tactics" ON tactics FOR SELECT USING (true);
CREATE POLICY "Public read state" ON tournament_state FOR SELECT USING (true);

-- Authenticated users can write (admin)
CREATE POLICY "Auth write teams" ON teams FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write players" ON players FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write groups" ON group_assignments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write matches" ON matches FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write lineups" ON match_lineups FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write events" ON match_events FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write tactics" ON tactics FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth write state" ON tournament_state FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE match_events;
ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE group_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- ============================================================
-- SEED: Insert all 16 teams
-- ============================================================
INSERT INTO teams (id, name, short_name) VALUES
  ('adlers_lombard_a',   'Adlers Lombard FC A', 'ALA'),
  ('adlers_lombard_b',   'Adlers Lombard FC B', 'ALB'),
  ('jolly_boys_vr',      'Jolly Boys VR',       'JBV'),
  ('fc_mantova',         'FC Mantova',          'MTV'),
  ('fc_bergamo',         'FC Bergamo',          'BER'),
  ('fc_pakistan',        'FC Pakistan',         'PAK'),
  ('real_milanians_fc',  'Real Milanians FC',   'RMF'),
  ('corsico_fc',         'Corsico FC',          'COR'),
  ('fc_red_devils',      'FC Red Devils',       'RED'),
  ('falcons_fc_milan',   'Falcons FC Milan',    'FAL'),
  ('fc_san_felix',       'FC San Felix',        'SFX'),
  ('gordons_fc',         'Gordons FC',          'GOR'),
  ('nilions_fc',         'Nilions FC',          'NIL'),
  ('real_bergamo',       'Real Bergamo',        'RBG'),
  ('atletico_bergamo_b', 'Atletico Bergamo B',  'ATB'),
  ('vazians_fc',         'Vazians FC',          'VAZ')
ON CONFLICT (id) DO NOTHING;

-- Insert initial tournament state
INSERT INTO tournament_state (key, value) VALUES
  ('draw_done', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- MIGRATIONS (run after initial schema)
-- ============================================================

-- Add Instagram page to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS insta_page TEXT;

-- Add penalty shootout scores to matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_penalties INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_penalties INTEGER;

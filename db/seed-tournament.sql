-- ============================================================
-- ASIA CUP 2026 — Real tournament data seed
-- Run AFTER db/migration.sql. Replaces any existing teams/matches
-- with the confirmed 17-team roster, group draw and full schedule.
-- Safe to re-run: it clears matches/teams first, then re-inserts.
-- ============================================================

-- Clear old data (matches first — teams are referenced by them)
DELETE FROM matches;
DELETE FROM teams;

-- ============================================================
-- TEAMS (17)
-- ============================================================
INSERT INTO teams (id, name, short_name) VALUES
  ('adlers_lombard_a', 'Adlers Lombard FC A', 'ALA'),
  ('adlers_lombard_b', 'Adlers Lombard FC B', 'ALB'),
  ('fc_mantova', 'FC Mantova', 'MTV'),
  ('fc_bergamo', 'FC Bergamo', 'BER'),
  ('fc_pak', 'FC Pak', 'PAK'),
  ('corsico_fc', 'Corsico FC', 'COR'),
  ('fc_red_devils', 'FC Red Devils', 'RED'),
  ('fc_san_felix', 'FC San Felix', 'SFX'),
  ('gordons_fc', 'Gordons FC', 'GOR'),
  ('nilions_fc', 'Nilions FC', 'NIL'),
  ('atletico_bergamo_a', 'Atletico Bergamo A', 'ATA'),
  ('atletico_bergamo_b', 'Atletico Bergamo B', 'ATB'),
  ('vazians_fc', 'Vazians FC', 'VAZ'),
  ('eternal_city_rome', 'Eternal City Rome', 'ECR'),
  ('jolly_boys_verona', 'Jolly Boys Verona', 'JBV'),
  ('real_milanians_fc', 'Real Milanians FC', 'RMF'),
  ('real_bergamo', 'Real Bergamo', 'RBG');

-- ============================================================
-- GROUP DRAW
-- Group A: 4 teams | Group B: 5 teams | Group C: 4 teams | Group D: 4 teams
-- ============================================================
INSERT INTO group_assignments (team_id, group_letter, sort_order) VALUES
  ('adlers_lombard_a', 'A', 0),
  ('fc_bergamo', 'A', 1),
  ('atletico_bergamo_b', 'A', 2),
  ('real_bergamo', 'A', 3),
  ('nilions_fc', 'B', 0),
  ('corsico_fc', 'B', 1),
  ('fc_san_felix', 'B', 2),
  ('eternal_city_rome', 'B', 3),
  ('fc_red_devils', 'B', 4),
  ('vazians_fc', 'C', 0),
  ('atletico_bergamo_a', 'C', 1),
  ('jolly_boys_verona', 'C', 2),
  ('gordons_fc', 'C', 3),
  ('fc_mantova', 'D', 0),
  ('real_milanians_fc', 'D', 1),
  ('fc_pak', 'D', 2),
  ('adlers_lombard_b', 'D', 3);

-- ============================================================
-- GROUP STAGE FIXTURES
-- Kickoff 09:30, 25-min slots (20 min play + 1 min half-time + ~4 min
-- changeover), 2 grounds running in parallel. Adlers Lombard FC A's
-- opening game is v Atletico Bergamo B; Nilions FC and Jolly Boys
-- Verona's matches all start at/after 10:45 since they arrive late;
-- no team plays two slots in a row; every team plays on both grounds.
-- ============================================================
INSERT INTO matches (id, stage, group_letter, match_number, home_team_id, away_team_id, match_time, ground, played) VALUES
  ('grp_A_fc_bergamo_real_bergamo', 'group', 'A', 1, 'fc_bergamo', 'real_bergamo', '09:30:00', '1', false),
  ('grp_B_corsico_fc_fc_red_devils', 'group', 'B', 2, 'corsico_fc', 'fc_red_devils', '09:30:00', '2', false),
  ('grp_D_real_milanians_fc_adlers_lombard_b', 'group', 'D', 3, 'real_milanians_fc', 'adlers_lombard_b', '09:55:00', '1', false),
  ('grp_C_atletico_bergamo_a_gordons_fc', 'group', 'C', 4, 'atletico_bergamo_a', 'gordons_fc', '09:55:00', '2', false),
  ('grp_A_adlers_lombard_a_atletico_bergamo_b', 'group', 'A', 5, 'adlers_lombard_a', 'atletico_bergamo_b', '10:20:00', '1', false),
  ('grp_B_corsico_fc_eternal_city_rome', 'group', 'B', 6, 'corsico_fc', 'eternal_city_rome', '10:20:00', '2', false),
  ('grp_C_vazians_fc_jolly_boys_verona', 'group', 'C', 7, 'vazians_fc', 'jolly_boys_verona', '10:45:00', '1', false),
  ('grp_D_fc_mantova_real_milanians_fc', 'group', 'D', 8, 'fc_mantova', 'real_milanians_fc', '10:45:00', '2', false),
  ('grp_B_fc_san_felix_eternal_city_rome', 'group', 'B', 9, 'fc_san_felix', 'eternal_city_rome', '11:10:00', '1', false),
  ('grp_B_nilions_fc_fc_red_devils', 'group', 'B', 10, 'nilions_fc', 'fc_red_devils', '11:10:00', '2', false),
  ('grp_C_atletico_bergamo_a_jolly_boys_verona', 'group', 'C', 11, 'atletico_bergamo_a', 'jolly_boys_verona', '11:35:00', '1', false),
  ('grp_A_fc_bergamo_atletico_bergamo_b', 'group', 'A', 12, 'fc_bergamo', 'atletico_bergamo_b', '11:35:00', '2', false),
  ('grp_B_eternal_city_rome_fc_red_devils', 'group', 'B', 13, 'eternal_city_rome', 'fc_red_devils', '12:00:00', '1', false),
  ('grp_D_fc_pak_adlers_lombard_b', 'group', 'D', 14, 'fc_pak', 'adlers_lombard_b', '12:00:00', '2', false),
  ('grp_C_vazians_fc_gordons_fc', 'group', 'C', 15, 'vazians_fc', 'gordons_fc', '12:25:00', '1', false),
  ('grp_B_nilions_fc_fc_san_felix', 'group', 'B', 16, 'nilions_fc', 'fc_san_felix', '12:25:00', '2', false),
  ('grp_D_real_milanians_fc_fc_pak', 'group', 'D', 17, 'real_milanians_fc', 'fc_pak', '12:50:00', '1', false),
  ('grp_A_adlers_lombard_a_real_bergamo', 'group', 'A', 18, 'adlers_lombard_a', 'real_bergamo', '12:50:00', '2', false),
  ('grp_B_corsico_fc_fc_san_felix', 'group', 'B', 19, 'corsico_fc', 'fc_san_felix', '13:15:00', '1', false),
  ('grp_B_nilions_fc_eternal_city_rome', 'group', 'B', 20, 'nilions_fc', 'eternal_city_rome', '13:15:00', '2', false),
  ('grp_D_fc_mantova_fc_pak', 'group', 'D', 21, 'fc_mantova', 'fc_pak', '13:40:00', '1', false),
  ('grp_C_jolly_boys_verona_gordons_fc', 'group', 'C', 22, 'jolly_boys_verona', 'gordons_fc', '13:40:00', '2', false),
  ('grp_B_nilions_fc_corsico_fc', 'group', 'B', 23, 'nilions_fc', 'corsico_fc', '14:05:00', '1', false),
  ('grp_C_vazians_fc_atletico_bergamo_a', 'group', 'C', 24, 'vazians_fc', 'atletico_bergamo_a', '14:05:00', '2', false),
  ('grp_B_fc_san_felix_fc_red_devils', 'group', 'B', 25, 'fc_san_felix', 'fc_red_devils', '14:30:00', '1', false),
  ('grp_A_adlers_lombard_a_fc_bergamo', 'group', 'A', 26, 'adlers_lombard_a', 'fc_bergamo', '14:30:00', '2', false),
  ('grp_A_atletico_bergamo_b_real_bergamo', 'group', 'A', 27, 'atletico_bergamo_b', 'real_bergamo', '14:55:00', '1', false),
  ('grp_D_fc_mantova_adlers_lombard_b', 'group', 'D', 28, 'fc_mantova', 'adlers_lombard_b', '14:55:00', '2', false);

-- ============================================================
-- KNOCKOUT STAGE TEMPLATE (no 3rd-place play-off)
-- Starts after a buffer once the full group stage is done. QF1: A1 v B2,
-- QF2: B1 v A2, QF3: C1 v D2, QF4: D1 v C2 (per the rulebook).
-- Home/away teams are filled in automatically by the app once group
-- standings (and then QF/SF results) are final — see Admin → "Sync
-- Bracket from Standings".
-- ============================================================
INSERT INTO matches (id, stage, label, match_number, home_source, away_source, match_time, ground, played) VALUES
  ('qf1', 'QF', 'Quarter-Final 1', 29, 'A1', 'B2', '15:30:00', '1', false),
  ('qf2', 'QF', 'Quarter-Final 2', 30, 'B1', 'A2', '15:30:00', '2', false),
  ('qf3', 'QF', 'Quarter-Final 3', 31, 'C1', 'D2', '15:55:00', '1', false),
  ('qf4', 'QF', 'Quarter-Final 4', 32, 'D1', 'C2', '15:55:00', '2', false),
  ('sf1', 'SF', 'Semi-Final 1', 33, 'QF1 Winner', 'QF2 Winner', '16:20:00', '1', false),
  ('sf2', 'SF', 'Semi-Final 2', 34, 'QF3 Winner', 'QF4 Winner', '16:20:00', '2', false),
  ('final', 'F', 'Final', 35, 'SF1 Winner', 'SF2 Winner', '16:45:00', '1', false);

-- Reset the draw flag so the app knows a real draw is in place
INSERT INTO tournament_state (key, value) VALUES ('draw_done', 'true'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now();

-- Group stage: 09:30–15:15 · Knockouts: 15:30–17:05 (~17:05 finish)
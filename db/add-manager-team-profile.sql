-- ============================================================
-- ASIA CUP 2026 — Let team managers edit their own team's profile
-- Run in Supabase SQL Editor (after db/migration.sql). Safe to re-run.
--
-- Adds a password-gated RPC so a team manager (not a Supabase Auth user)
-- can update their own team's logo, colors, Instagram and website —
-- the same fields Admin → Teams & Logos edits, but scoped to their own
-- team and checked against manager_passwords like every other manager
-- action.
--
-- Any parameter left NULL is left unchanged; pass a value to update it
-- (an empty string '' does update the field, e.g. to clear a link).
-- ============================================================

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

GRANT EXECUTE ON FUNCTION manager_update_team(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

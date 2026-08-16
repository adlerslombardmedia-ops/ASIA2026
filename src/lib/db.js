// ─── Database Access Layer ──────────────────────────────────────────────────
// All Supabase queries in one place for the Asia Cup 2026 app

import { supabase } from '../supabase';

// ─── TEAMS ──────────────────────────────────────────────────────────────────

export async function fetchTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

export async function upsertTeam(team) {
  const { data, error } = await supabase
    .from('teams')
    .upsert(team, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTeam(teamId, updates) {
  const { data, error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── PLAYERS ────────────────────────────────────────────────────────────────

export async function fetchPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('number');
  if (error) throw error;
  return data;
}

export async function fetchPlayersByTeam(teamId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .order('number');
  if (error) throw error;
  return data;
}

export async function insertPlayer(player) {
  const { data, error } = await supabase
    .from('players')
    .insert({ id: crypto.randomUUID(), ...player })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(playerId, updates) {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', playerId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlayer(playerId) {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', playerId);
  if (error) throw error;
}

// ─── GROUP ASSIGNMENTS ──────────────────────────────────────────────────────

export async function fetchGroupAssignments() {
  const res1 = await supabase
    .from('group_assignments')
    .select('*')
    .order('position_in_group');
  
  if (!res1.error) {
    return res1.data;
  }

  const res2 = await supabase
    .from('group_assignments')
    .select('*')
    .order('sort_order');
  
  if (res2.error) throw res2.error;
  return res2.data;
}

export async function upsertGroupAssignment(teamId, groupLetter, positionInGroup = 0) {
  const res1 = await supabase
    .from('group_assignments')
    .upsert({ team_id: teamId, group_letter: groupLetter, position_in_group: positionInGroup }, { onConflict: 'team_id' });
  
  if (!res1.error) return;

  const res2 = await supabase
    .from('group_assignments')
    .upsert({ team_id: teamId, group_letter: groupLetter, sort_order: positionInGroup }, { onConflict: 'team_id' });
  
  if (res2.error) throw res2.error;
}

export async function deleteGroupAssignment(teamId) {
  const { error } = await supabase
    .from('group_assignments')
    .delete()
    .eq('team_id', teamId);
  if (error) throw error;
}

export async function clearAllGroupAssignments() {
  const { error } = await supabase
    .from('group_assignments')
    .delete()
    .neq('team_id', '___never___');
  if (error) throw error;
}

// ─── MATCHES ────────────────────────────────────────────────────────────────

export async function fetchMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_number');
  if (error) throw error;
  return data;
}

export async function upsertMatch(match) {
  const { data, error } = await supabase
    .from('matches')
    .upsert(match, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertMatches(matches) {
  const { data, error } = await supabase
    .from('matches')
    .upsert(matches, { onConflict: 'id' })
    .select();
  if (error) throw error;
  return data;
}

export async function deleteAllMatches() {
  const { error } = await supabase
    .from('matches')
    .delete()
    .neq('id', '___never___');
  if (error) throw error;
}

export async function resetDatabase() {
  // Delete in dependency order: child tables first, then parent tables.
  // teams table is intentionally NEVER touched.

  // 1. Leaf tables that reference matches + players
  const r1 = await supabase.from('shots').delete().neq('id', '___never___');
  if (r1.error) throw r1.error;

  const r2 = await supabase.from('possession').delete().neq('match_id', '___never___');
  if (r2.error) throw r2.error;

  const r3 = await supabase.from('match_events').delete().neq('id', '___never___');
  if (r3.error) throw r3.error;

  const r4 = await supabase.from('match_lineups').delete().neq('match_id', '___never___');
  if (r4.error) throw r4.error;

  const r5 = await supabase.from('tactics').delete().neq('match_id', '___never___');
  if (r5.error) throw r5.error;

  // 2. matches (now safe — all child rows gone)
  const r6 = await supabase.from('matches').delete().neq('id', '___never___');
  if (r6.error) throw r6.error;

  // 3. group_assignments + players (reference teams only, which we keep)
  const r7 = await supabase.from('group_assignments').delete().neq('team_id', '___never___');
  if (r7.error) throw r7.error;

  const r8 = await supabase.from('players').delete().neq('id', '___never___');
  if (r8.error) throw r8.error;

  // 4. Reset draw flag
  const r9 = await supabase.from('tournament_state').upsert({ key: 'draw_done', value: false }, { onConflict: 'key' });
  if (r9.error) throw r9.error;
}

// ─── MATCH EVENTS ───────────────────────────────────────────────────────────

export async function fetchEvents() {
  const { data, error } = await supabase
    .from('match_events')
    .select('*')
    .order('minute');
  if (error) throw error;
  return data;
}

export async function insertEvent(event) {
  const { data, error } = await supabase
    .from('match_events')
    .insert(event)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(eventId) {
  const { error } = await supabase
    .from('match_events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
}

// ─── MATCH LINEUPS ──────────────────────────────────────────────────────────

export async function fetchLineups(matchId) {
  const { data, error } = await supabase
    .from('match_lineups')
    .select('*')
    .eq('match_id', matchId);
  if (error) throw error;
  return data;
}

export async function fetchAllLineups() {
  const { data, error } = await supabase
    .from('match_lineups')
    .select('*');
  if (error) throw error;
  return data;
}

export async function upsertLineup(matchId, playerId, side, x = null, y = null) {
  const { error } = await supabase
    .from('match_lineups')
    .upsert({ match_id: matchId, player_id: playerId, side, x, y }, { onConflict: 'match_id,player_id' });
  if (error) throw error;
}

export async function clearMatchLineups(matchId) {
  const { error } = await supabase
    .from('match_lineups')
    .delete()
    .eq('match_id', matchId);
  if (error) throw error;
}

// ─── TACTICS ────────────────────────────────────────────────────────────────

export async function fetchTactics() {
  const { data, error } = await supabase
    .from('tactics')
    .select('*');
  if (error) throw error;
  return data;
}

export async function upsertTactics(matchId, teamId, positions) {
  const { error } = await supabase
    .from('tactics')
    .upsert({ match_id: matchId, team_id: teamId, positions }, { onConflict: 'match_id,team_id' });
  if (error) throw error;
}

// ─── TOURNAMENT STATE ───────────────────────────────────────────────────────

export async function getTournamentState(key) {
  const { data, error } = await supabase
    .from('tournament_state')
    .select('value')
    .eq('key', key)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.value;
}

export async function setTournamentState(key, value) {
  const { error } = await supabase
    .from('tournament_state')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}

// ─── LOGO COMPRESSION HELPER ────────────────────────────────────────────────
async function compressImage(file, maxWidth = 200, maxHeight = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export as WebP for smallest footprint
        const dataUrl = canvas.toDataURL('image/webp', 0.8);
        resolve(dataUrl);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}

// ─── LOGO UPLOAD ────────────────────────────────────────────────────────────

export async function uploadTeamLogo(teamId, file) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${teamId}/logo.${fileExt}`;

  let base64Compressed = null;
  try {
    base64Compressed = await compressImage(file);
  } catch (err) {
    console.error('Image compression failed', err);
  }

  // Upload original file to storage (if bucket exists)
  const { error: uploadError } = await supabase.storage
    .from('team-logos')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.warn('Storage upload failed, using compressed base64 fallback:', uploadError);
    if (!base64Compressed) {
      throw new Error('Storage failed and image compression failed.');
    }
    return base64Compressed; // tiny string, perfectly safe for db
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('team-logos')
    .getPublicUrl(filePath);

  // Update team record
  await updateTeam(teamId, { logo_url: urlData.publicUrl });

  return urlData.publicUrl;
}

// ─── MANAGER PORTAL ─────────────────────────────────────────────────────────

export async function verifyManagerPassword(teamId, password) {
  const { data, error } = await supabase.rpc('verify_manager_password', {
    p_team_id: teamId, p_password: password,
  });
  if (error) throw error;
  return data === true;
}

export async function managerLogEvent(teamId, password, matchId, playerId, type, minute, assistPlayerId = null) {
  const { error } = await supabase.rpc('manager_log_event', {
    p_team_id: teamId, p_password: password,
    p_match_id: matchId, p_player_id: playerId,
    p_type: type, p_minute: minute,
    p_assist_player_id: assistPlayerId || null,
  });
  if (error) throw error;
}

export async function managerDeleteEvent(teamId, password, eventId) {
  const { error } = await supabase.rpc('manager_delete_event', {
    p_team_id: teamId, p_password: password, p_event_id: eventId,
  });
  if (error) throw error;
}

export async function managerSaveLineup(teamId, password, matchId, players) {
  // players: [{ player_id: string, x: number, y: number }]
  const { error } = await supabase.rpc('manager_save_lineup', {
    p_team_id: teamId, p_password: password,
    p_match_id: matchId, p_players: players,
  });
  if (error) throw error;
}

export async function managerLogShot(teamId, password, matchId, playerId, x, y, endX, endY, outcome) {
  const { error } = await supabase.rpc('manager_log_shot', {
    p_team_id: teamId, p_password: password,
    p_match_id: matchId, p_player_id: playerId,
    p_shot_x: x, p_shot_y: y, p_end_x: endX, p_end_y: endY, p_outcome: outcome,
  });
  if (error) throw error;
}

export async function setManagerPassword(teamId, password) {
  const { error } = await supabase.rpc('admin_set_manager_password', {
    p_team_id: teamId, p_password: password,
  });
  if (error) throw error;
}

export async function fetchManagerPasswords() {
  const { data, error } = await supabase.rpc('admin_get_manager_passwords');
  if (error) throw error;
  return data || [];
}

export async function managerAddPlayer(teamId, password, name, number, position, category, playerType) {
  const { data, error } = await supabase.rpc('manager_add_player', {
    p_team_id: teamId, p_password: password, p_name: name,
    p_number: number, p_position: position, p_category: category, p_player_type: playerType,
  });
  if (error) throw error;
  return data;
}

export async function managerUpdatePlayer(teamId, password, playerId, name, number, position, category, playerType) {
  const { error } = await supabase.rpc('manager_update_player', {
    p_team_id: teamId, p_password: password, p_player_id: playerId,
    p_name: name, p_number: number, p_position: position, p_category: category, p_player_type: playerType,
  });
  if (error) throw error;
}

export async function managerDeletePlayer(teamId, password, playerId) {
  const { error } = await supabase.rpc('manager_delete_player', {
    p_team_id: teamId, p_password: password, p_player_id: playerId,
  });
  if (error) throw error;
}

// ─── AWARDS ─────────────────────────────────────────────────────────────────

export async function fetchAwards() {
  const { data, error } = await supabase.from('awards').select('*');
  if (error) throw error;
  return data || [];
}

export async function upsertAward(category, fields) {
  const { error } = await supabase
    .from('awards')
    .upsert({ category, ...fields }, { onConflict: 'category' });
  if (error) throw error;
}

export function subscribeToAwards(callback) {
  return supabase
    .channel('awards-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'awards' }, callback)
    .subscribe();
}

// ─── ANNOUNCEMENTS ──────────────────────────────────────────────────────────

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadAnnouncementFile(file) {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('announcement-files').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('announcement-files').getPublicUrl(path);
  return { url: publicUrl, name: file.name, type: file.type.startsWith('image/') ? 'image' : 'pdf', path };
}

export async function insertAnnouncement(message, attachments = []) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('announcements')
    .insert({ id: crypto.randomUUID(), message, author_email: user.email, attachments })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

export async function updateAnnouncement(id, message, attachments) {
  const updates = { message };
  if (attachments !== undefined) updates.attachments = attachments;
  const { error } = await supabase.from('announcements').update(updates).eq('id', id);
  if (error) throw error;
}

export function subscribeToAnnouncements(callback) {
  return supabase
    .channel('announcements-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, callback)
    .subscribe();
}

// ─── REALTIME SUBSCRIPTIONS ─────────────────────────────────────────────────

export function subscribeToMatches(callback) {
  return supabase
    .channel('matches-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, callback)
    .subscribe();
}

export function subscribeToEvents(callback) {
  return supabase
    .channel('events-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events' }, callback)
    .subscribe();
}

export function subscribeToTeams(callback) {
  return supabase
    .channel('teams-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, callback)
    .subscribe();
}

export function subscribeToPlayers(callback) {
  return supabase
    .channel('players-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, callback)
    .subscribe();
}

export function subscribeToShots(callback) {
  return supabase
    .channel('shots-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shots' }, callback)
    .subscribe();
}

export function subscribeToPossession(callback) {
  return supabase
    .channel('possession-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'possession' }, callback)
    .subscribe();
}

export function subscribeToLineups(callback) {
  return supabase
    .channel('lineups-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_lineups' }, callback)
    .subscribe();
}

// ─── GENERATE GROUP FIXTURES ────────────────────────────────────────────────

export function generateGroupFixtures(groups) {
  const matches = [];
  let matchNum = 1;

  Object.entries(groups).forEach(([letter, teamIds]) => {
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        matches.push({
          id: `grp_${letter}_${teamIds[i]}_${teamIds[j]}`,
          stage: 'group',
          group_letter: letter,
          match_number: matchNum++,
          home_team_id: teamIds[i],
          away_team_id: teamIds[j],
          played: false,
        });
      }
    }
  });

  return matches;
}

// ─── KNOCKOUT TEMPLATE ──────────────────────────────────────────────────────

// ─── AUTO-ADVANCE KNOCKOUT ───────────────────────────────────────────────────
// Called after any match save; promotes group toppers / match winners automatically

async function patchMatch(id, updates) {
  const { error } = await supabase.from('matches').update(updates).eq('id', id);
  if (error) throw error;
}

export async function checkAndAutoAdvance() {
  const [groupAssignments, matches] = await Promise.all([
    fetchGroupAssignments(),
    fetchMatches(),
  ]);

  const groups = { A: [], B: [], C: [], D: [] };
  groupAssignments.forEach(a => { if (groups[a.group_letter]) groups[a.group_letter].push(a.team_id); });

  const computeStandings = (g) => {
    const stats = {};
    (groups[g] || []).forEach(id => { stats[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });
    matches.filter(m => m.stage === 'group' && m.group_letter === g && m.played).forEach(m => {
      const h = stats[m.home_team_id], a = stats[m.away_team_id];
      if (!h || !a) return;
      h.p++; a.p++;
      h.gf += m.home_score || 0; h.ga += m.away_score || 0;
      a.gf += m.away_score || 0; a.ga += m.home_score || 0;
      if ((m.home_score || 0) > (m.away_score || 0)) { h.w++; h.pts += 3; a.l++; }
      else if ((m.home_score || 0) < (m.away_score || 0)) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
      h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;
    });
    return Object.values(stats).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  };

  // Group stage → QF slots
  // QF1 (m41): A1 vs B2  |  QF2 (m43): B1 vs A2  → SF1 is all A/B teams
  // QF3 (m42): C1 vs D2  |  QF4 (m44): D1 vs C2  → SF2 is all C/D teams
  // Final: SF1 W (A or B) vs SF2 W (C or D)
  const groupToQF = {
    A: { homeQF: 'qf1', awayQF: 'qf2' },
    B: { homeQF: 'qf2', awayQF: 'qf1' },
    C: { homeQF: 'qf3', awayQF: 'qf4' },
    D: { homeQF: 'qf4', awayQF: 'qf3' },
  };

  const qfUpdates = {};
  for (const [g, { homeQF, awayQF }] of Object.entries(groupToQF)) {
    const gMatches = matches.filter(m => m.stage === 'group' && m.group_letter === g);
    if (gMatches.length > 0 && gMatches.every(m => m.played)) {
      const st = computeStandings(g);
      if (st[0]) { qfUpdates[homeQF] = { ...(qfUpdates[homeQF] || {}), home_team_id: st[0].id }; }
      if (st[1]) { qfUpdates[awayQF] = { ...(qfUpdates[awayQF] || {}), away_team_id: st[1].id }; }
    }
  }
  for (const [qfId, updates] of Object.entries(qfUpdates)) {
    await patchMatch(qfId, updates);
  }

  // QF results → SF slots
  // SF1: QF1 W (A/B) vs QF2 W (A/B) | SF2: QF3 W (C/D) vs QF4 W (C/D)
  const sfUpdates = {};
  for (const [qfId, sfId, side] of [
    ['qf1', 'sf1', 'home_team_id'], ['qf2', 'sf1', 'away_team_id'],
    ['qf3', 'sf2', 'home_team_id'], ['qf4', 'sf2', 'away_team_id'],
  ]) {
    const qfM = matches.find(m => m.id === qfId);
    if (qfM?.played && qfM?.winner_team_id) {
      sfUpdates[sfId] = { ...(sfUpdates[sfId] || {}), [side]: qfM.winner_team_id };
    }
  }
  for (const [sfId, updates] of Object.entries(sfUpdates)) {
    await patchMatch(sfId, updates);
  }

  // SF results → Final slots + 3rd place slots (losers)
  for (const [sfId, finalSide, thirdSide] of [
    ['sf1', 'home_team_id', 'home_team_id'],
    ['sf2', 'away_team_id', 'away_team_id'],
  ]) {
    const sfM = matches.find(m => m.id === sfId);
    if (sfM?.played && sfM?.winner_team_id) {
      await patchMatch('final', { [finalSide]: sfM.winner_team_id });
      const loserId = sfM.winner_team_id === sfM.home_team_id ? sfM.away_team_id : sfM.home_team_id;
      if (loserId) await patchMatch('third', { [thirdSide]: loserId });
    }
  }
}

// ─── SHOTS ──────────────────────────────────────────────────────────────────

export async function fetchShots() {
  const { data, error } = await supabase.from('shots').select('*').order('created_at');
  if (error) throw error;
  return data;
}

export async function insertShot(shot) {
  const { data, error } = await supabase.from('shots').insert(shot).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShot(shotId) {
  const { error } = await supabase.from('shots').delete().eq('id', shotId);
  if (error) throw error;
}

// ─── POSSESSION ──────────────────────────────────────────────────────────────

export async function fetchPossession() {
  const { data, error } = await supabase.from('possession').select('*');
  if (error) throw error;
  return data;
}

export async function upsertPossession(matchId, homeSeconds, awaySeconds) {
  const { error } = await supabase.from('possession').upsert(
    { match_id: matchId, home_seconds: homeSeconds, away_seconds: awaySeconds, updated_at: new Date().toISOString() },
    { onConflict: 'match_id' }
  );
  if (error) throw error;
}

// ─── MATCH STATUS ────────────────────────────────────────────────────────────

export async function updateMatchStatus(matchId, status) {
  const extra = {};
  if (status === 'live') extra.started_at = new Date().toISOString();
  if (status === 'finished') extra.ended_at = new Date().toISOString();
  const { error } = await supabase.from('matches').update({ status, ...extra }).eq('id', matchId);
  if (error) throw error;
}

export function generateKnockoutTemplate() {
  return [
    { id: 'qf1', stage: 'QF', label: 'Quarter-Final 1', home_source: 'A1', away_source: 'B2', match_number: 41 },
    { id: 'qf2', stage: 'QF', label: 'Quarter-Final 2', home_source: 'B1', away_source: 'A2', match_number: 42 },
    { id: 'qf3', stage: 'QF', label: 'Quarter-Final 3', home_source: 'C1', away_source: 'D2', match_number: 43 },
    { id: 'qf4', stage: 'QF', label: 'Quarter-Final 4', home_source: 'D1', away_source: 'C2', match_number: 44 },
    { id: 'sf1', stage: 'SF', label: 'Semi-Final 1', home_source: 'QF1 Winner', away_source: 'QF2 Winner', match_number: 45 },
    { id: 'sf2', stage: 'SF', label: 'Semi-Final 2', home_source: 'QF3 Winner', away_source: 'QF4 Winner', match_number: 46 },
    { id: 'final', stage: 'F', label: 'Final', home_source: 'SF1 Winner', away_source: 'SF2 Winner', match_number: 47 },
  ].map(m => ({ ...m, played: false }));
}

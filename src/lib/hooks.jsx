// Shared hooks, helpers, and constants for the Asia Cup 2026 app
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import * as db from '../lib/db';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
export const COLORS = {
  gold: '#FFD400', dark: '#0D0D0D', green: '#00C853',
  red: '#FF3D57', orange: '#FF9100', blue: '#448AFF',
  italyGreen: '#009246', italyRed: '#CE2B37',
};

export const LOGO_URL = `${import.meta.env.BASE_URL}images/logo.svg`;

export const SPONSOR_LOGOS = [
  { name: 'Adpoli', url: `${import.meta.env.BASE_URL}images/sponsors/adpoli.png` },
  { name: 'Arcon', url: `${import.meta.env.BASE_URL}images/sponsors/arcon.png` },
  { name: 'A Fine Trip / Arcon Group', url: `${import.meta.env.BASE_URL}images/sponsors/finetrip.png` },
];

export const DEFAULT_TEAMS = [
  { id: 'adlers_lombard_a', name: 'Adlers Lombard FC A', short_name: 'ALA' },
  { id: 'adlers_lombard_b', name: 'Adlers Lombard FC B', short_name: 'ALB' },
  { id: 'jolly_boys_vr', name: 'Jolly Boys VR', short_name: 'JBV' },
  { id: 'fc_mantova', name: 'FC Mantova', short_name: 'MTV' },
  { id: 'fc_bergamo', name: 'FC Bergamo', short_name: 'BER' },
  { id: 'fc_pakistan', name: 'FC Pakistan', short_name: 'PAK' },
  { id: 'real_milanians_fc', name: 'Real Milanians FC', short_name: 'RMF' },
  { id: 'corsico_fc', name: 'Corsico FC', short_name: 'COR' },
  { id: 'fc_red_devils', name: 'FC Red Devils', short_name: 'RED' },
  { id: 'falcons_fc_milan', name: 'Falcons FC Milan', short_name: 'FAL' },
  { id: 'fc_san_felix', name: 'FC San Felix', short_name: 'SFX' },
  { id: 'gordons_fc', name: 'Gordons FC', short_name: 'GOR' },
  { id: 'nilions_fc', name: 'Nilions FC', short_name: 'NIL' },
  { id: 'real_bergamo', name: 'Real Bergamo', short_name: 'RBG' },
  { id: 'atletico_bergamo_b', name: 'Atletico Bergamo B', short_name: 'ATB' },
  { id: 'vazians_fc', name: 'Vazians FC', short_name: 'VAZ' },
];

// ─── TOAST SYSTEM ───────────────────────────────────────────────────────────
let toastId = 0;
let toastSetter = null;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  toastSetter = setToasts;
  return toasts;
}

export function toast(msg, type = 'info') {
  if (!toastSetter) return;
  const id = ++toastId;
  toastSetter(prev => [...prev, { id, msg, type }]);
  setTimeout(() => toastSetter(prev => prev.filter(t => t.id !== id)), 3000);
}

// ─── CONFETTI (easter egg) ──────────────────────────────────────────────────
export function launchConfetti() {
  const colors = ['#FFD400', '#009246', '#CE2B37', '#FF9100', '#448AFF', '#fff'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = Math.random() * 0.8 + 's';
    el.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    el.style.width = (5 + Math.random() * 8) + 'px';
    el.style.height = (5 + Math.random() * 8) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}

// ─── KONAMI CODE (easter egg) ───────────────────────────────────────────────
export function useKonami(callback) {
  const sequence = useRef([]);
  const code = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // ↑↑↓↓←→←→BA

  useEffect(() => {
    const handler = (e) => {
      sequence.current.push(e.keyCode);
      if (sequence.current.length > code.length) sequence.current.shift();
      if (JSON.stringify(sequence.current) === JSON.stringify(code)) {
        callback();
        sequence.current = [];
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [callback]);
}

// ─── MAIN DATA HOOK ─────────────────────────────────────────────────────────
export function useTournamentData() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [groupAssignments, setGroupAssignments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [shots, setShots] = useState([]);
  const [possession, setPossession] = useState([]);
  const [tactics, setTactics] = useState([]);
  const [allLineups, setAllLineups] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Build groups object from assignments
  const groups = { A: [], B: [], C: [], D: [] };
  groupAssignments.forEach(a => {
    if (groups[a.group_letter]) groups[a.group_letter].push(a.team_id);
  });

  // Team map for quick lookup
  const teamMap = {};
  teams.forEach(t => { teamMap[t.id] = t; });

  // Initial fetch
  const loadAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [t, p, ga, m, ev, sh, pos, tac, lu, ann, aw] = await Promise.all([
        db.fetchTeams(),
        db.fetchPlayers(),
        db.fetchGroupAssignments(),
        db.fetchMatches(),
        db.fetchEvents(),
        db.fetchShots().catch(() => []),
        db.fetchPossession().catch(() => []),
        db.fetchTactics().catch(() => []),
        db.fetchAllLineups().catch(() => []),
        db.fetchAnnouncements().catch(() => []),
        db.fetchAwards().catch(() => []),
      ]);

      // If no teams in DB, seed them
      if (!t || t.length === 0) {
        for (const team of DEFAULT_TEAMS) {
          await db.upsertTeam(team);
        }
        const seeded = await db.fetchTeams();
        setTeams(seeded || []);
      } else {
        setTeams(t);
      }

      setPlayers(p || []);
      setGroupAssignments(ga || []);
      setMatches(m || []);
      setEvents(ev || []);
      setShots(sh || []);
      setPossession(pos || []);
      setTactics(tac || []);
      setAllLineups(lu || []);
      setAnnouncements(ann || []);
      setAwards(aw || []);
    } catch (err) {
      console.error('Failed to load data:', err);
      // Fallback: use default teams in memory
      setTeams(DEFAULT_TEAMS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load data on mount
  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime subscriptions
  useEffect(() => {
    const matchSub = db.subscribeToMatches(() => {
      db.fetchMatches().then(m => setMatches(m || []));
    });
    const eventSub = db.subscribeToEvents(() => {
      db.fetchEvents().then(e => setEvents(e || []));
    });
    const teamSub = db.subscribeToTeams(() => {
      db.fetchTeams().then(t => setTeams(t || []));
    });
    const annSub = db.subscribeToAnnouncements(() => {
      db.fetchAnnouncements().catch(() => []).then(a => setAnnouncements(a || []));
    });
    const playerSub = db.subscribeToPlayers(() => {
      db.fetchPlayers().catch(() => []).then(p => setPlayers(p || []));
    });
    const shotSub = db.subscribeToShots(() => {
      db.fetchShots().catch(() => []).then(s => setShots(s || []));
    });
    const possSub = db.subscribeToPossession(() => {
      db.fetchPossession().catch(() => []).then(p => setPossession(p || []));
    });
    const lineupSub = db.subscribeToLineups(() => {
      db.fetchAllLineups().catch(() => []).then(l => setAllLineups(l || []));
    });
    const awardSub = db.subscribeToAwards(() => {
      db.fetchAwards().catch(() => []).then(a => setAwards(a || []));
    });

    return () => {
      supabase.removeChannel(matchSub);
      supabase.removeChannel(eventSub);
      supabase.removeChannel(teamSub);
      supabase.removeChannel(annSub);
      supabase.removeChannel(playerSub);
      supabase.removeChannel(shotSub);
      supabase.removeChannel(possSub);
      supabase.removeChannel(lineupSub);
      supabase.removeChannel(awardSub);
    };
  }, []);

  // Computed: standings
  const standings = {};
  ['A', 'B', 'C', 'D'].forEach(g => {
    const teamIds = groups[g];
    const stats = {};
    teamIds.forEach(id => {
      const t = teamMap[id];
      stats[id] = { id, name: t?.name || id, logo_url: t?.logo_url, short_name: t?.short_name || '?',
        p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
    });

    matches.filter(m => m.stage === 'group' && m.group_letter === g && m.played).forEach(m => {
      const h = stats[m.home_team_id], a = stats[m.away_team_id];
      if (!h || !a) return;
      h.p++; a.p++;
      h.gf += m.home_score; h.ga += m.away_score;
      a.gf += m.away_score; a.ga += m.home_score;
      if (m.home_score > m.away_score) { h.w++; h.pts += 3; a.l++; }
      else if (m.home_score < m.away_score) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
      h.gd = h.gf - h.ga;
      a.gd = a.gf - a.ga;
    });

    standings[g] = Object.values(stats)
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  });

  // Computed: leaderboards
  const goalCounts = {}, assistCounts = {};
  events.forEach(e => {
    if (e.type === 'goal') goalCounts[e.player_id] = (goalCounts[e.player_id] || 0) + 1;
    if (e.type === 'assist') assistCounts[e.player_id] = (assistCounts[e.player_id] || 0) + 1;
  });

  const topScorers = Object.entries(goalCounts)
    .map(([pid, count]) => ({ player: players.find(p => p.id === pid), count }))
    .filter(x => x.player)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topAssists = Object.entries(assistCounts)
    .map(([pid, count]) => ({ player: players.find(p => p.id === pid), count }))
    .filter(x => x.player)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    teams, players, groups, groupAssignments, matches, events, shots, possession, tactics, allLineups,
    announcements, awards,
    standings, topScorers, topAssists, teamMap,
    loading, user, reload: () => loadAll(true),
    setTeams, setPlayers, setGroupAssignments, setMatches, setEvents, setShots, setPossession, setTactics,
    setAnnouncements, setAwards,
  };
}

// ─── AUTH HELPERS ────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// ─── TEAM LOGO COMPONENT ───────────────────────────────────────────────────
export function TeamLogo({ team, size = 32, className = '' }) {
  if (!team) {
    return (
      <div className={`team-logo ${className}`} style={{ width: size, height: size, background: '#333', color: '#666' }}>?</div>
    );
  }

  const logoSrc = team.logo_url || team.logo;

  if (logoSrc) {
    return (
      <div className={`team-logo ${className}`} style={{ width: size, height: size }}>
        <img src={logoSrc} alt={team.short_name || team.name} loading="lazy"
          onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = (team.short_name || '?').slice(0, 3); }} />
      </div>
    );
  }

  return (
    <div className={`team-logo ${className}`}
      style={{ width: size, height: size, background: team.primary_color || COLORS.gold, color: team.secondary_color || COLORS.dark }}>
      {(team.short_name || team.name?.charAt(0) || '?').slice(0, 3)}
    </div>
  );
}

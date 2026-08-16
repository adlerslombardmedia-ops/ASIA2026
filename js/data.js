// Asia Cup 2026 — Data Management Layer

const KEFF_KEY = 'keff2026_data';
const ADMIN_USER = 'keff2026_admin';
const ADMIN_PASS = 'keff2026admin2026';

const DEFAULT_TEAMS = [
  { id: 'adlers_lombard_a',   name: 'Adlers Lombard FC A', shortName: 'ALA' },
  { id: 'adlers_lombard_b',   name: 'Adlers Lombard FC B', shortName: 'ALB' },
  { id: 'jolly_boys_vr',      name: 'Jolly Boys VR',       shortName: 'JBV' },
  { id: 'fc_mantova',         name: 'FC Mantova',          shortName: 'MTV' },
  { id: 'fc_bergamo',         name: 'FC Bergamo',          shortName: 'BER' },
  { id: 'fc_pakistan',        name: 'FC Pakistan',         shortName: 'PAK' },
  { id: 'real_milanians_fc',  name: 'Real Milanians FC',   shortName: 'RMF' },
  { id: 'corsico_fc',         name: 'Corsico FC',          shortName: 'COR' },
  { id: 'fc_red_devils',      name: 'FC Red Devils',       shortName: 'RED' },
  { id: 'falcons_fc_milan',   name: 'Falcons FC Milan',    shortName: 'FAL' },
  { id: 'fc_san_felix',       name: 'FC San Felix',        shortName: 'SFX' },
  { id: 'gordons_fc',         name: 'Gordons FC',          shortName: 'GOR' },
  { id: 'nilions_fc',         name: 'Nilions FC',          shortName: 'NIL' },
  { id: 'real_bergamo',       name: 'Real Bergamo',        shortName: 'RBG' },
  { id: 'atletico_bergamo_b', name: 'Atletico Bergamo B',  shortName: 'ATB' },
  { id: 'vazians_fc',         name: 'Vazians FC',          shortName: 'VAZ' },
];

function makeKOMatch(id, label, homeSource, awaySource) {
  return { id, label, homeSource, awaySource,
    homeTeam: null, awayTeam: null,
    homeScore: null, awayScore: null,
    winner: null, played: false,
    homeLineup: [], awayLineup: [],
    homePositions: [], awayPositions: [],
    events: [], date: null, time: null };
}

function getInitialData() {
  const teams = {};
  DEFAULT_TEAMS.forEach(t => {
    teams[t.id] = { ...t, logo: null, primaryColor: '#FFD400', secondaryColor: '#282828', players: [] };
  });
  return {
    teams,
    groups: { A: [], B: [], C: [], D: [] },
    matches: {},
    knockout: {
      QF: [
        makeKOMatch('qf1', 'Quarter-Final 1', 'A1', 'B2'),
        makeKOMatch('qf2', 'Quarter-Final 2', 'C1', 'D2'),
        makeKOMatch('qf3', 'Quarter-Final 3', 'B1', 'A2'),
        makeKOMatch('qf4', 'Quarter-Final 4', 'D1', 'C2'),
      ],
      SF: [
        makeKOMatch('sf1', 'Semi-Final 1', 'QF1 Winner', 'QF2 Winner'),
        makeKOMatch('sf2', 'Semi-Final 2', 'QF3 Winner', 'QF4 Winner'),
      ],
      F: [
        makeKOMatch('f1', 'Final', 'SF1 Winner', 'SF2 Winner'),
      ]
    },
    drawDone: false
  };
}

function getData() {
  try {
    const stored = localStorage.getItem(KEFF_KEY);
    if (!stored) { const d = getInitialData(); saveData(d); return d; }
    return JSON.parse(stored);
  } catch(e) { return getInitialData(); }
}

function saveData(data) {
  localStorage.setItem(KEFF_KEY, JSON.stringify(data));
}

function resetData() {
  localStorage.removeItem(KEFF_KEY);
  return getData();
}

// Generate round-robin group fixtures
function generateGroupMatches(groupId, teamIds) {
  const matches = {};
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const matchId = `grp_${groupId}_${i}_${j}_${teamIds[i]}_${teamIds[j]}`;
      matches[matchId] = {
        id: matchId, stage: 'group', group: groupId,
        matchNumber: Object.keys(matches).length + 1,
        homeTeam: teamIds[i], awayTeam: teamIds[j],
        date: null, time: null,
        homeScore: null, awayScore: null, played: false,
        homeLineup: [], awayLineup: [],
        homePositions: [], awayPositions: [],
        events: []
      };
    }
  }
  return matches;
}

// Calculate group standings
function calculateStandings(groupId, data) {
  const groupTeams = data.groups[groupId] || [];
  const s = {};
  groupTeams.forEach(id => {
    s[id] = { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
  });

  Object.values(data.matches).forEach(m => {
    if (m.stage !== 'group' || m.group !== groupId || !m.played) return;
    const h = s[m.homeTeam], a = s[m.awayTeam];
    if (!h || !a) return;
    h.played++; a.played++;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    if (m.homeScore > m.awayScore)      { h.won++; h.points += 3; a.lost++; }
    else if (m.homeScore < m.awayScore) { a.won++; a.points += 3; h.lost++; }
    else                                { h.drawn++; a.drawn++; h.points++; a.points++; }
  });

  groupTeams.forEach(id => { if (s[id]) s[id].gd = s[id].gf - s[id].ga; });

  return Object.values(s).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd)         return b.gd - a.gd;
    if (b.gf !== a.gf)         return b.gf - a.gf;
    return 0;
  });
}

// Get all group matches for a given group, sorted by match number
function getGroupMatches(groupId, data) {
  return Object.values(data.matches)
    .filter(m => m.stage === 'group' && m.group === groupId)
    .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
}

// Get all scorers and assists across all matches
function getLeaderboard(data) {
  const players = {};

  const allMatches = [
    ...Object.values(data.matches),
    ...data.knockout.QF,
    ...data.knockout.SF,
    ...data.knockout.F,
  ];

  allMatches.forEach(m => {
    if (!m.played) return;
    (m.events || []).forEach(ev => {
      const key = ev.playerId || ev.playerName;
      if (!players[key]) {
        players[key] = {
          id: key, name: ev.playerName, teamId: ev.teamId,
          goals: 0, assists: 0
        };
      }
      if (ev.type === 'goal')   players[key].goals++;
      if (ev.type === 'assist') players[key].assists++;
    });
  });

  return Object.values(players);
}

// Compute clean sheets: GK of team that conceded 0 in a played match
function getCleanSheets(data) {
  const keepers = {};
  const allMatches = [
    ...Object.values(data.matches),
    ...data.knockout.QF,
    ...data.knockout.SF,
    ...data.knockout.F,
  ];

  allMatches.forEach(m => {
    if (!m.played) return;

    // Find GKs from lineups
    const findGK = (teamId, lineup) => {
      if (!lineup || lineup.length === 0) return null;
      const data2 = getData();
      const team = data2.teams[teamId];
      if (!team) return null;
      for (const pid of lineup) {
        const p = team.players.find(pl => pl.id === pid);
        if (p && p.position && p.position.toUpperCase() === 'GK') return p;
      }
      return null;
    };

    if (m.awayScore === 0) {
      const gk = findGK(m.homeTeam, m.homeLineup);
      if (gk) {
        const key = `${m.homeTeam}_${gk.id}`;
        if (!keepers[key]) keepers[key] = { name: gk.name, teamId: m.homeTeam, cleanSheets: 0 };
        keepers[key].cleanSheets++;
      }
    }
    if (m.homeScore === 0) {
      const gk = findGK(m.awayTeam, m.awayLineup);
      if (gk) {
        const key = `${m.awayTeam}_${gk.id}`;
        if (!keepers[key]) keepers[key] = { name: gk.name, teamId: m.awayTeam, cleanSheets: 0 };
        keepers[key].cleanSheets++;
      }
    }
  });

  return Object.values(keepers).sort((a, b) => b.cleanSheets - a.cleanSheets);
}

// Advance knockout teams based on current results
function advanceKnockout(data) {
  const standings = {};
  ['A','B','C','D'].forEach(g => {
    standings[g] = calculateStandings(g, data);
  });

  // Populate QF from group winners/runners-up
  const qfSources = {
    qf1: { home: standings.A[0], away: standings.B[1] },
    qf2: { home: standings.C[0], away: standings.D[1] },
    qf3: { home: standings.B[0], away: standings.A[1] },
    qf4: { home: standings.D[0], away: standings.C[1] },
  };

  // Check if group stage is complete (all groups have 10 played matches each)
  const groupsComplete = ['A','B','C','D'].every(g => {
    const gm = getGroupMatches(g, data);
    return gm.length === 10 && gm.every(m => m.played);
  });

  if (groupsComplete) {
    data.knockout.QF.forEach(qf => {
      const src = qfSources[qf.id];
      if (src) {
        if (!qf.homeTeam && src.home) qf.homeTeam = src.home.teamId;
        if (!qf.awayTeam && src.away) qf.awayTeam = src.away.teamId;
      }
    });
  }

  // Populate SF from QF winners
  const qfMap = {};
  data.knockout.QF.forEach(qf => { qfMap[qf.id] = qf; });
  if (qfMap.qf1?.winner && !data.knockout.SF[0].homeTeam) data.knockout.SF[0].homeTeam = qfMap.qf1.winner;
  if (qfMap.qf2?.winner && !data.knockout.SF[0].awayTeam) data.knockout.SF[0].awayTeam = qfMap.qf2.winner;
  if (qfMap.qf3?.winner && !data.knockout.SF[1].homeTeam) data.knockout.SF[1].homeTeam = qfMap.qf3.winner;
  if (qfMap.qf4?.winner && !data.knockout.SF[1].awayTeam) data.knockout.SF[1].awayTeam = qfMap.qf4.winner;

  // Populate Final from SF winners
  if (data.knockout.SF[0].winner && !data.knockout.F[0].homeTeam) data.knockout.F[0].homeTeam = data.knockout.SF[0].winner;
  if (data.knockout.SF[1].winner && !data.knockout.F[0].awayTeam) data.knockout.F[0].awayTeam = data.knockout.SF[1].winner;

  return data;
}

// Auth helpers
function isAdminLoggedIn()            { return sessionStorage.getItem('keff_admin') === 'true'; }
function adminLogin(u, p)             { if (u===ADMIN_USER && p===ADMIN_PASS) { sessionStorage.setItem('keff_admin','true'); return true; } return false; }
function adminLogout()                { sessionStorage.removeItem('keff_admin'); }
function requireAdmin(redirectUrl)    { if (!isAdminLoggedIn()) { window.location.href = redirectUrl || 'admin.html'; } }

// Utility: get team name safely
function teamName(id, data) { return data.teams[id]?.name || id; }
function teamShort(id, data) { return data.teams[id]?.shortName || id; }

// Utility: format score display
function scoreStr(m) {
  if (!m.played && m.homeScore === null) return 'vs';
  if (m.played) return `${m.homeScore} - ${m.awayScore}`;
  return 'vs';
}

// Utility: generate unique id
function genId() { return '_' + Math.random().toString(36).substr(2, 9); }

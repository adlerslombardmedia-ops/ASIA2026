import React, { useState } from 'react';
import { TeamLogo, COLORS } from '../lib/hooks';
import { TeamShotMap, OUTCOME_COLORS } from '../components/ShotMap';

export default function TeamView({ data, teamId, navigate }) {
  const { teamMap, players, groups, matches, events, shots, allLineups } = data;
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const team = teamMap[teamId];

  if (!team) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
        <div style={{ fontWeight: 800 }}>Team not found</div>
        <button className="btn btn-gold" style={{ marginTop: 16 }} onClick={() => navigate('home')}>Back</button>
      </div>
    );
  }

  const roster = players.filter(p => p.team_id === teamId).sort((a, b) => (a.number || 99) - (b.number || 99));

  // Compute Starting 7 from match_lineups history
  // Count appearances per player; on ties, prefer the player who started more recently
  const playedMatchIds = new Set(
    matches.filter(m => m.played && (m.home_team_id === teamId || m.away_team_id === teamId)).map(m => m.id)
  );
  // Map matchId → match_date for tie-breaking
  const matchDateMap = {};
  matches.forEach(m => { matchDateMap[m.id] = m.match_date || ''; });

  const starterCount = {}; // playerId → count
  const starterLastDate = {}; // playerId → latest match_date they started
  (allLineups || []).forEach(lu => {
    if (!playedMatchIds.has(lu.match_id)) return;
    const pid = lu.player_id;
    starterCount[pid] = (starterCount[pid] || 0) + 1;
    const d = matchDateMap[lu.match_id] || '';
    if (!starterLastDate[pid] || d > starterLastDate[pid]) starterLastDate[pid] = d;
  });

  const rosterWithScore = roster.map(p => ({
    ...p,
    _count: starterCount[p.id] || 0,
    _lastDate: starterLastDate[p.id] || '',
  }));

  // Sort: most appearances first, then most recent start on tie
  const sortedByAppearances = [...rosterWithScore].sort((a, b) =>
    b._count - a._count || (b._lastDate > a._lastDate ? 1 : b._lastDate < a._lastDate ? -1 : 0)
  );

  const starterSet = new Set(sortedByAppearances.slice(0, 7).filter(p => p._count > 0).map(p => p.id));
  const starters = roster.filter(p => starterSet.has(p.id)).map(p => ({ ...p, _count: starterCount[p.id] || 0 }))
    .sort((a, b) => b._count - a._count || (a.number || 99) - (b.number || 99));
  const bench = roster.filter(p => !starterSet.has(p.id));

  // Formation layout: group starters by position, assign standard coordinates
  // Pitch attacking upward: GK near y=135, DEF y=105, MID y=72, FWD y=38
  const FORMATION_Y = { GK: 135, DEF: 105, MID: 72, FWD: 38 };
  const posGroups = { GK: [], DEF: [], MID: [], FWD: [] };
  starters.forEach(p => {
    const pos = p.position && posGroups[p.position] ? p.position : 'MID';
    posGroups[pos].push(p);
  });
  const formationPos = {};
  Object.entries(posGroups).forEach(([pos, group]) => {
    if (group.length === 0) return;
    const y = FORMATION_Y[pos];
    group.forEach((p, i) => {
      const n = group.length;
      // Keep players within ~20–80 range regardless of group size
      const spread = Math.min(60, n * 20);
      const x = n === 1 ? 50 : (50 - spread / 2) + i * (spread / (n - 1));
      formationPos[p.id] = { x, y };
    });
  });
  const grp = Object.entries(groups).find(([, ids]) => ids.includes(teamId))?.[0];

  // All team matches (played + upcoming), sorted by match number
  const allTeamMatches = matches
    .filter(m => m.home_team_id === teamId || m.away_team_id === teamId)
    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0));

  // Team stats
  const teamMatches = matches.filter(m => m.played && (m.home_team_id === teamId || m.away_team_id === teamId));
  const teamMatchIds = new Set(teamMatches.map(m => m.id));
  const teamShots = (shots || []).filter(s => s.team_id === teamId);
  const hasShotData = teamShots.length > 0 || (shots || []).some(s => teamMatchIds.has(s.match_id) && s.team_id !== teamId);

  // Player stats helper
  const getPlayerStats = (pid) => {
    const goals   = events.filter(e => e.player_id === pid && e.type === 'goal').length;
    const assists = events.filter(e => e.player_id === pid && e.type === 'assist').length;
    const pShots  = (shots || []).filter(s => s.player_id === pid);
    const xg      = pShots.reduce((s, x) => s + (x.xg || 0), 0);
    return { goals, assists, shots: pShots.length, xg };
  };
  const wins = teamMatches.filter(m => m.winner_team_id === teamId || (m.home_team_id === teamId && m.home_score > m.away_score) || (m.away_team_id === teamId && m.away_score > m.home_score)).length;
  const goalsFor = teamMatches.reduce((s, m) => s + (m.home_team_id === teamId ? m.home_score : m.away_score), 0);
  const goalsAgainst = teamMatches.reduce((s, m) => s + (m.home_team_id === teamId ? m.away_score : m.home_score), 0);

  const POS_COLORS = { GK: '#FF9100', DEF: '#448AFF', MID: '#00C853', FWD: '#FF3D57' };

  return (
    <div className="animate-fade">
      {/* Back button */}
      <button className="tappable" onClick={() => navigate('home')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', background: 'transparent', color: '#888', fontWeight: 700, fontSize: '0.82rem' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #0a0a0a, ${COLORS.dark}, #0d1f0d)`,
        padding: '24px 16px',
        display: 'flex', alignItems: 'center', gap: 16,
        borderBottom: `3px solid ${COLORS.gold}`,
      }}>
        <TeamLogo team={team} size={96} className="team-logo-lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', textTransform: 'uppercase' }} className="truncate">{team.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {grp && <span className="pill pill-gold">Group {grp}</span>}
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: COLORS.gold }}>Asia Cup 2026</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#666', marginTop: 4 }}>{roster.length} players registered</div>
          {team.insta_page && (
            <a href={team.insta_page} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: '0.7rem', fontWeight: 700, color: '#C13584', textDecoration: 'none', background: 'rgba(193,53,132,0.1)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(193,53,132,0.3)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              Instagram
            </a>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {teamMatches.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: 16 }}>
          {[
            { label: 'Wins', value: wins, color: COLORS.green },
            { label: 'Goals', value: goalsFor, color: COLORS.gold },
            { label: 'Conceded', value: goalsAgainst, color: COLORS.red },
          ].map(s => (
            <div key={s.label} className="kcard" style={{ padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Fixtures */}
      {allTeamMatches.length > 0 && (
        <div style={{ padding: '0 16px 4px' }}>
          <div className="kcard">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fixtures</span>
              <span style={{ fontSize: '0.6rem', color: '#555', fontWeight: 600 }}>{teamMatches.length}/{allTeamMatches.length} played</span>
            </div>
            {allTeamMatches.map(m => {
              const isHome = m.home_team_id === teamId;
              const oppId = isHome ? m.away_team_id : m.home_team_id;
              const opp = teamMap[oppId];
              const isLive = m.status === 'live';
              const myScore = isHome ? m.home_score : m.away_score;
              const oppScore = isHome ? m.away_score : m.home_score;
              const won = m.played && myScore > oppScore;
              const lost = m.played && myScore < oppScore;
              const drew = m.played && myScore === oppScore;
              const stageLabel = m.stage === 'group'
                ? `M${m.match_number} · Grp ${m.group_letter}`
                : (m.label || m.stage);

              return (
                <div key={m.id} className="tappable"
                  onClick={() => navigate('match', { matchId: m.id })}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    borderLeft: isLive ? '3px solid #00C853' : won ? '3px solid #00C853' : lost ? '3px solid #FF3D57' : drew ? '3px solid #FFD400' : '3px solid transparent',
                    background: isLive ? 'rgba(0,200,83,0.04)' : undefined }}>

                  {/* Result pill */}
                  <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: isLive ? '#00C853' : won ? '#00C853' : lost ? '#FF3D57' : drew ? '#FFD400' : 'var(--card2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.55rem', fontWeight: 900,
                    color: isLive || won || lost || drew ? '#000' : '#666' }}>
                    {isLive ? '●' : won ? 'W' : lost ? 'L' : drew ? 'D' : '—'}
                  </div>

                  {/* Opponent */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                    <TeamLogo team={opp} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem' }} className="truncate">
                        {opp?.name || (m.stage !== 'group' ? (isHome ? m.away_source : m.home_source) : 'TBD')}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: '#666', marginTop: 1 }}>
                        {stageLabel}
                        {m.match_time && ` · ${m.match_time.slice(0,5)}`}
                        {m.ground && ` · G${m.ground}`}
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: 1, flexShrink: 0, minWidth: 38, textAlign: 'right',
                    color: isLive ? '#00C853' : m.played ? '#fff' : '#555' }}>
                    {m.played || isLive ? `${myScore ?? 0}–${oppScore ?? 0}` : 'vs'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shot Maps */}
      {hasShotData && (
        <div style={{ padding: '0 16px 12px' }}>
          <TeamShotMap shots={shots || []} team={team} players={players} matches={matches} teamMap={teamMap} />
        </div>
      )}

      {/* Roster */}
      <div style={{ padding: '0 16px 16px' }}>
        {/* Starters */}
        <div className="kcard" style={{ marginBottom: 12 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Starting Lineup</span>
            <span style={{ fontSize: '0.6rem', color: '#555', fontWeight: 600 }}>by appearances</span>
          </div>
          {/* Formation pitch */}
          {starters.length > 0 && (
            <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid var(--border)' }}>
              <svg viewBox="0 0 100 150" width="100%" style={{ display: 'block', borderRadius: 8, maxHeight: 340 }}>
                <rect width="100" height="150" fill="#0d1f2d" rx="4" />
                {[0,1,2,3,4,5].map(i => (
                  <rect key={i} x="0" y={i*25} width="100" height="12.5" fill="rgba(255,255,255,0.016)" />
                ))}
                <rect x="1" y="1" width="98" height="148" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="0.7" />
                <line x1="1" y1="75" x2="99" y2="75" stroke="rgba(255,255,255,0.32)" strokeWidth="0.5" />
                <circle cx="50" cy="75" r="10" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                <circle cx="50" cy="75" r="0.9" fill="rgba(255,255,255,0.32)" />
                <rect x="17.5" y="1" width="65" height="30" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                <rect x="32.5" y="1" width="35" height="10" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                <circle cx="50" cy="22.5" r="0.9" fill="rgba(255,255,255,0.32)" />
                <path d="M 41.5 31 A 12 12 0 0 0 58.5 31" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                <rect x="43.75" y="-3" width="12.5" height="4" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.32)" strokeWidth="0.7" />
                <rect x="17.5" y="119" width="65" height="30" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                <rect x="32.5" y="139" width="35" height="10" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                <circle cx="50" cy="127.5" r="0.9" fill="rgba(255,255,255,0.32)" />
                <path d="M 41.5 119 A 12 12 0 0 1 58.5 119" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5" />
                <rect x="43.75" y="149" width="12.5" height="4" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.32)" strokeWidth="0.7" />
                {starters.map(p => {
                  const pos = formationPos[p.id];
                  if (!pos) return null;
                  const posColor = POS_COLORS[p.position] || COLORS.gold;
                  return (
                    <g key={p.id} onClick={() => setSelectedPlayer(p)} style={{ cursor: 'pointer' }}>
                      <circle cx={pos.x} cy={pos.y} r="5.5" fill={posColor} stroke="#000" strokeWidth="0.5" opacity="0.92" />
                      <circle cx={pos.x} cy={pos.y} r="6.8" fill="none" stroke={posColor} strokeWidth="0.4" opacity="0.4" />
                      <text x={pos.x} y={pos.y + 0.5} textAnchor="middle" dominantBaseline="middle"
                        fontSize="3.6" fontWeight="800" fill="#000" style={{ pointerEvents: 'none' }}>
                        {String(p.number ?? '?').slice(0, 2)}
                      </text>
                      <text x={pos.x} y={pos.y + 9.5} textAnchor="middle" fontSize="2.8" fill="#fff"
                        fontWeight="600" opacity="0.85" style={{ pointerEvents: 'none' }}>
                        {p.name.split(' ').slice(-1)[0]?.slice(0, 8)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {starters.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: '#555', fontSize: '0.82rem' }}>No lineup data yet</div>
          ) : starters.map(p => {
            const stats = getPlayerStats(p.id);
            return (
              <div key={p.id} onClick={() => setSelectedPlayer(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                className="tappable">
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS.gold, color: COLORS.dark,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', flexShrink: 0 }}>
                  {p.number || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }} className="truncate">{p.name}</div>
                  <div style={{ fontSize: '0.62rem', color: '#666', marginTop: 1, display: 'flex', gap: 6 }}>
                    <span style={{ color: COLORS.gold }}>{p._count} game{p._count !== 1 ? 's' : ''}</span>
                    {stats.goals > 0 && <span style={{ color: '#00C853' }}>G {stats.goals}</span>}
                    {stats.assists > 0 && <span style={{ color: '#aaa' }}>A {stats.assists}</span>}
                  </div>
                </div>
                <span className="pill" style={{ background: (POS_COLORS[p.position] || '#666') + '20', color: POS_COLORS[p.position] || '#888', fontSize: '0.62rem' }}>
                  {p.position || '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bench */}
        {bench.length > 0 && (
          <div className="kcard">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Substitutes ({bench.length})
            </div>
            {bench.map(p => (
              <div key={p.id} onClick={() => setSelectedPlayer(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                  borderBottom: '1px solid var(--border)', opacity: 0.7, cursor: 'pointer' }}
                className="tappable">
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--card2)', color: '#666',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.68rem', flexShrink: 0 }}>
                  {p.number || '?'}
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.82rem', flex: 1 }} className="truncate">{p.name}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#666' }}>{p.position || '—'}</span>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ── Player Profile Modal ── */}
      {selectedPlayer && (() => {
        const p = selectedPlayer;
        const stats = getPlayerStats(p.id);
        const pShots = (shots || []).filter(s => s.player_id === p.id);
        const posColor = POS_COLORS[p.position] || '#888';

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0 0' }}
            onClick={() => setSelectedPlayer(null)}>
            <div className="kcard animate-fade"
              style={{ width: '100%', maxWidth: 480, borderRadius: '18px 18px 0 0',
                padding: 0, overflow: 'hidden', maxHeight: '90dvh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>

              {/* Player header */}
              <div style={{ background: 'linear-gradient(135deg, #0a0a0a, #111)',
                padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%',
                    background: COLORS.gold, color: COLORS.dark,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: '1.4rem', flexShrink: 0 }}>
                    {p.number || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                      <span className="pill" style={{ background: posColor + '25', color: posColor, fontSize: '0.68rem' }}>
                        {p.position || '—'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#666', alignSelf: 'center' }}>
                        {p.is_starter ? '▶ Starting Lineup' : 'Substitute'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPlayer(null)}
                    style={{ background: 'transparent', border: 'none', color: '#666',
                      fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
                borderBottom: '1px solid var(--border)' }}>
                {[
                  { label: 'Goals',   val: stats.goals,           color: '#00C853' },
                  { label: 'Assists', val: stats.assists,          color: '#FFD400' },
                  { label: 'Shots',   val: stats.shots,            color: '#448AFF' },
                  { label: 'xG',      val: stats.xg.toFixed(2),   color: '#FF9100' },
                ].map((s, i) => (
                  <div key={s.label} style={{ padding: '14px 8px', textAlign: 'center',
                    borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#666',
                      textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Shot breakdown */}
              {pShots.length > 0 && (
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666',
                    textTransform: 'uppercase', marginBottom: 8 }}>Shot Breakdown</div>
                  {Object.entries(
                    pShots.reduce((acc, s) => { acc[s.outcome] = (acc[s.outcome] || 0) + 1; return acc; }, {})
                  ).map(([outcome, count]) => (
                    <div key={outcome} style={{ display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 0', fontSize: '0.75rem' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                        background: OUTCOME_COLORS[outcome] || '#666' }} />
                      <span style={{ flex: 1, color: '#aaa' }}>
                        {outcome === 'goal' ? 'Goal' : outcome === 'saved_gripped' ? 'Saved (Gripped)'
                          : outcome === 'saved_pushed' ? 'Saved (Pushed)' : outcome === 'block_on_target'
                          ? 'Block (On Target)' : 'Block'}
                      </span>
                      <span style={{ fontWeight: 800, color: OUTCOME_COLORS[outcome] || '#888' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Match events log */}
              {(stats.goals > 0 || stats.assists > 0) && (() => {
                const evts = events.filter(e => e.player_id === p.id);
                return (
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666',
                      textTransform: 'uppercase', marginBottom: 8 }}>Match Log</div>
                    {evts.map(e => {
                      const m = matches.find(x => x.id === e.match_id);
                      const opp = m ? teamMap[m.home_team_id === teamId ? m.away_team_id : m.home_team_id] : null;
                      return (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.75rem' }}>
                          <span style={{ fontSize: '0.9rem' }}>{e.type === 'goal' ? '⚽' : '🅰'}</span>
                          <span style={{ color: e.type === 'goal' ? '#00C853' : '#FFD400', fontWeight: 700 }}>
                            {e.type === 'goal' ? 'Goal' : 'Assist'}
                          </span>
                          {e.minute && <span style={{ color: '#555' }}>{e.minute}'</span>}
                          {opp && <span style={{ color: '#666', flex: 1, textAlign: 'right' }} className="truncate">vs {opp.short_name}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {stats.goals === 0 && stats.assists === 0 && pShots.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: '0.8rem' }}>
                  No stats recorded yet.
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

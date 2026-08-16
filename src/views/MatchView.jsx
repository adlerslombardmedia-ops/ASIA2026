import React, { useState, useEffect } from 'react';
import * as db from '../lib/db';
import { TeamLogo, COLORS } from '../lib/hooks';
import { ShotMapView } from '../components/ShotMap';

const PITCH_BG   = '#0d1f2d';
const LINE_HI    = 'rgba(255,255,255,0.32)';
const LINE_LO    = 'rgba(255,255,255,0.14)';

function ReadOnlyPitch({ homeLineup, awayLineup, homeTeam, awayTeam, players }) {
  const dots = [];
  homeLineup.forEach(lu => {
    if (lu.x == null || lu.y == null) return;
    const pl = players.find(p => p.id === lu.player_id);
    dots.push({ x: lu.x, y: lu.y, team: 'home', label: pl?.number ?? '?', name: pl?.name || '' });
  });
  awayLineup.forEach(lu => {
    if (lu.x == null || lu.y == null) return;
    const pl = players.find(p => p.id === lu.player_id);
    dots.push({ x: lu.x, y: lu.y, team: 'away', label: pl?.number ?? '?', name: pl?.name || '' });
  });

  if (dots.length === 0) return null;

  // Horizontal pitch — same coordinate space as admin/manager (0 0 100 65)
  const W = 100, H = 65;
  const lo = 'rgba(255,255,255,0.18)', hi = 'rgba(255,255,255,0.55)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', borderRadius: 8 }}>
      {/* Background */}
      <rect width={W} height={H} fill="#1a6b2f" rx="3" />
      {/* Stripes */}
      {[0,1,2,3,4].map(i => <rect key={i} x={i*20} y="0" width="10" height={H} fill="rgba(255,255,255,0.025)" />)}
      {/* Boundary */}
      <rect x="1" y="1" width={W-2} height={H-2} fill="none" stroke={hi} strokeWidth="0.6" />
      {/* Centre line + circle */}
      <line x1={W/2} y1="1" x2={W/2} y2={H-1} stroke={hi} strokeWidth="0.5" />
      <circle cx={W/2} cy={H/2} r="8" fill="none" stroke={lo} strokeWidth="0.5" />
      <circle cx={W/2} cy={H/2} r="0.8" fill={hi} />
      {/* Left penalty area */}
      <rect x="1" y="16.25" width="16" height="32.5" fill="none" stroke={lo} strokeWidth="0.5" />
      <rect x="1" y="25.25" width="5.5" height="14.5" fill="none" stroke={lo} strokeWidth="0.5" />
      <circle cx="12" cy={H/2} r="0.8" fill={hi} />
      {/* Right penalty area */}
      <rect x={W-17} y="16.25" width="16" height="32.5" fill="none" stroke={lo} strokeWidth="0.5" />
      <rect x={W-6.5} y="25.25" width="5.5" height="14.5" fill="none" stroke={lo} strokeWidth="0.5" />
      <circle cx={W-12} cy={H/2} r="0.8" fill={hi} />
      {/* Team labels */}
      <text x="8" y={H/2 + 1} textAnchor="middle" fill="rgba(0,200,83,0.4)" fontSize="3" fontWeight="700">{homeTeam?.short_name || 'HOME'}</text>
      <text x={W-8} y={H/2 + 1} textAnchor="middle" fill="rgba(68,138,255,0.4)" fontSize="3" fontWeight="700">{awayTeam?.short_name || 'AWAY'}</text>
      {/* Player dots */}
      {dots.map((d, i) => {
        const isHome = d.team === 'home';
        const fill = isHome ? '#00C853' : '#448AFF';
        return (
          <g key={i}>
            <circle cx={d.x} cy={d.y} r="4.5" fill={fill} stroke="#000" strokeWidth="0.4" opacity="0.93" />
            <circle cx={d.x} cy={d.y} r="5"   fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
            <text x={d.x} y={d.y + 0.5} textAnchor="middle" dominantBaseline="middle"
              fontSize="3.2" fontWeight="800" fill="#fff" style={{ pointerEvents: 'none' }}>
              {String(d.label).slice(0, 2)}
            </text>
            {d.name && (
              <text x={d.x} y={d.y + 7} textAnchor="middle" fontSize="2.4" fill="#fff"
                fontWeight="600" opacity="0.85" style={{ pointerEvents: 'none' }}>
                {d.name.split(' ')[0]?.slice(0, 8)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function MatchView({ data, matchId, navigate }) {
  const { matches, teamMap, events, players, shots, possession } = data;

  // Fetch match-specific lineups from match_lineups table
  const [lineups, setLineups] = useState([]);
  useEffect(() => {
    if (!matchId) return;
    db.fetchLineups(matchId).then(d => setLineups(d || [])).catch(() => setLineups([]));
  }, [matchId]);
  const match = matches.find(m => m.id === matchId);

  if (!match) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
        <div style={{ fontWeight: 800 }}>Match not found</div>
        <button className="btn btn-gold" style={{ marginTop: 16 }} onClick={() => navigate('home')}>Back</button>
      </div>
    );
  }

  const home = teamMap[match.home_team_id];
  const away = teamMap[match.away_team_id];
  const matchEvents = events.filter(e => e.match_id === match.id);
  const homeEvents = matchEvents.filter(e => e.team_id === match.home_team_id && ['goal','assist'].includes(e.type));
  const awayEvents = matchEvents.filter(e => e.team_id === match.away_team_id && ['goal','assist'].includes(e.type));
  const homeYellow = matchEvents.filter(e => e.team_id === match.home_team_id && e.type === 'yellow_card');
  const awayYellow = matchEvents.filter(e => e.team_id === match.away_team_id && e.type === 'yellow_card');
  const homeRed    = matchEvents.filter(e => e.team_id === match.home_team_id && e.type === 'red_card');
  const awayRed    = matchEvents.filter(e => e.team_id === match.away_team_id && e.type === 'red_card');
  const matchShots = (shots || []).filter(s => s.match_id === match.id);
  const matchPossession = (possession || []).find(p => p.match_id === match.id);
  const hasAnalytics = matchShots.length > 0 || matchPossession;

  // Lineup from match_lineups table (includes x,y positions)
  const homeLineup    = lineups.filter(l => l.side === 'home');
  const awayLineup    = lineups.filter(l => l.side === 'away');
  const homeLineupIds = new Set(homeLineup.map(l => l.player_id));
  const awayLineupIds = new Set(awayLineup.map(l => l.player_id));
  const hasPitchPositions = lineups.some(l => l.x != null && l.y != null);

  // Full squad for each team, starters first, then rest by number
  const homeSquad = players
    .filter(p => p.team_id === match.home_team_id)
    .sort((a, b) => {
      const aS = homeLineupIds.has(a.id) ? 0 : 1;
      const bS = homeLineupIds.has(b.id) ? 0 : 1;
      return aS - bS || (a.number || 99) - (b.number || 99);
    });
  const awaySquad = players
    .filter(p => p.team_id === match.away_team_id)
    .sort((a, b) => {
      const aS = awayLineupIds.has(a.id) ? 0 : 1;
      const bS = awayLineupIds.has(b.id) ? 0 : 1;
      return aS - bS || (a.number || 99) - (b.number || 99);
    });
  const hasLineup = homeSquad.length > 0 || awaySquad.length > 0 || homeLineup.length > 0 || awayLineup.length > 0;

  const stageBadge = match.stage === 'group' ? `Group ${match.group_letter}` : (match.label || match.stage);

  return (
    <div className="animate-fade">
      {/* Back button */}
      <button className="tappable" onClick={() => navigate('home', { subTab: 'fixtures' })}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', background: 'transparent', color: '#888', fontWeight: 700, fontSize: '0.82rem' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      {/* Scoreboard */}
      <div style={{
        background: `linear-gradient(135deg, #0a0a0a, ${COLORS.dark})`,
        padding: '20px 16px 24px',
        textAlign: 'center',
        borderBottom: match.played ? `3px solid ${COLORS.green}` : `3px solid ${COLORS.orange}`,
      }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          {stageBadge}
          {match.match_date && <span> · {match.match_date}</span>}
          {match.match_time && <span> · Time: {match.match_time.slice(0, 5)}</span>}
          {match.ground && <span> · Ground: {match.ground}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px' }}>
          {/* Home */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}
            className="tappable" onClick={() => navigate('team', { teamId: match.home_team_id })}>
            <TeamLogo team={home} size={52} className="team-logo-lg" />
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.name || 'TBD'}</span>
          </div>

          {/* Score */}
          <div style={{ flexShrink: 0, textAlign: 'center', padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: (match.played || match.status === 'live') ? '#fff' : '#555', letterSpacing: 2 }}>
              {(match.played || match.status === 'live') ? `${match.home_score ?? 0}:${match.away_score ?? 0}` : '–:–'}
            </div>
            <div style={{ marginTop: 4 }}>
              {match.status === 'live'
                ? <span className="pill pill-red" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                    Live
                  </span>
                : match.status === 'finished' || match.played
                  ? <span className="pill pill-green">Full Time</span>
                  : <span className="pill pill-muted">Upcoming</span>
              }
            </div>
          </div>

          {/* Away */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', minWidth: 0 }}
            className="tappable" onClick={() => navigate('team', { teamId: match.away_team_id })}>
            <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{away?.name || 'TBD'}</span>
            <TeamLogo team={away} size={52} className="team-logo-lg" />
          </div>
        </div>
      </div>

      {/* Match Events */}
      {matchEvents.length > 0 && (
        <div style={{ padding: '12px 16px 4px' }}>
          <div className="kcard">
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              Match Events
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {/* Home events */}
              <div style={{ borderRight: '1px solid var(--border)', padding: 12 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>
                  {home?.name || 'Home'}
                </div>
                {homeEvents.length === 0 ? (
                  <div style={{ color: '#555', fontSize: '0.75rem' }}>—</div>
                ) : homeEvents.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '4px 0' }}>
                    <span style={{ color: COLORS.gold, fontWeight: 900, fontSize: '0.7rem', width: 14 }}>{e.type === 'goal' ? 'G' : 'A'}</span>
                    <span style={{ fontWeight: 600 }}>{e.player_name || players.find(p => p.id === e.player_id)?.name || '?'}</span>
                    {e.minute && <span style={{ color: '#666', fontSize: '0.68rem' }}>{e.minute}'</span>}
                  </div>
                ))}
                {homeYellow.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '4px 0' }}>
                    <span style={{ fontSize: '0.72rem' }}>🟨</span>
                    <span style={{ fontWeight: 600 }}>{e.player_name || players.find(p => p.id === e.player_id)?.name || '?'}</span>
                    {e.minute && <span style={{ color: '#666', fontSize: '0.68rem' }}>{e.minute}'</span>}
                  </div>
                ))}
                {homeRed.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '4px 0' }}>
                    <span style={{ fontSize: '0.72rem' }}>🟥</span>
                    <span style={{ fontWeight: 600 }}>{e.player_name || players.find(p => p.id === e.player_id)?.name || '?'}</span>
                    {e.minute && <span style={{ color: '#666', fontSize: '0.68rem' }}>{e.minute}'</span>}
                  </div>
                ))}
              </div>
              {/* Away events */}
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', marginBottom: 8 }}>
                  {away?.name || 'Away'}
                </div>
                {awayEvents.length === 0 && awayYellow.length === 0 && awayRed.length === 0 ? (
                  <div style={{ color: '#555', fontSize: '0.75rem' }}>—</div>
                ) : null}
                {awayEvents.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '4px 0' }}>
                    <span style={{ color: COLORS.gold, fontWeight: 900, fontSize: '0.7rem', width: 14 }}>{e.type === 'goal' ? 'G' : 'A'}</span>
                    <span style={{ fontWeight: 600 }}>{e.player_name || players.find(p => p.id === e.player_id)?.name || '?'}</span>
                    {e.minute && <span style={{ color: '#666', fontSize: '0.68rem' }}>{e.minute}'</span>}
                  </div>
                ))}
                {awayYellow.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '4px 0' }}>
                    <span style={{ fontSize: '0.72rem' }}>🟨</span>
                    <span style={{ fontWeight: 600 }}>{e.player_name || players.find(p => p.id === e.player_id)?.name || '?'}</span>
                    {e.minute && <span style={{ color: '#666', fontSize: '0.68rem' }}>{e.minute}'</span>}
                  </div>
                ))}
                {awayRed.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', padding: '4px 0' }}>
                    <span style={{ fontSize: '0.72rem' }}>🟥</span>
                    <span style={{ fontWeight: 600 }}>{e.player_name || players.find(p => p.id === e.player_id)?.name || '?'}</span>
                    {e.minute && <span style={{ color: '#666', fontSize: '0.68rem' }}>{e.minute}'</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No events placeholder */}
      {match.played && matchEvents.length === 0 && (
        <div style={{ padding: '12px 16px 4px' }}>
          <div className="kcard" style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: '0.82rem' }}>
            No match events recorded yet.
          </div>
        </div>
      )}

      {/* Possession bar (if data exists) */}
      {matchPossession && (matchPossession.home_seconds + matchPossession.away_seconds) > 0 && (() => {
        const total = matchPossession.home_seconds + matchPossession.away_seconds;
        const homePct = Math.round((matchPossession.home_seconds / total) * 100);
        const awayPct = 100 - homePct;
        return (
          <div style={{ padding: '4px 16px 4px' }}>
            <div className="kcard" style={{ padding: 14 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>
                Ball Possession
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem', fontWeight: 900 }}>
                <span style={{ color: '#00C853' }}>{homePct}%</span>
                <span style={{ color: '#448AFF' }}>{awayPct}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', background: '#448AFF', position: 'relative' }}>
                <div style={{ height: '100%', width: `${homePct}%`, background: '#00C853',
                  borderRadius: '5px 0 0 5px', transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.65rem', color: '#666' }}>
                <span>{home?.name}</span>
                <span>{away?.name}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Starting Lineup */}
      {hasLineup && (
        <div style={{ padding: '4px 16px 4px' }}>
          <div className="kcard" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 14px 8px', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
              Starting Lineup
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#00C853', display: 'inline-block' }} />
                  {home?.short_name || 'Home'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#448AFF', display: 'inline-block' }} />
                  {away?.short_name || 'Away'}
                </span>
              </span>
            </div>

            {/* Pitch visualization — only shown if position data was saved */}
            {hasPitchPositions && (
              <div style={{ padding: '10px 10px 6px' }}>
                <ReadOnlyPitch homeLineup={homeLineup} awayLineup={awayLineup}
                  homeTeam={home} awayTeam={away} players={players} />
              </div>
            )}

            {/* Full squad — one team per section, starters first and highlighted */}
            {[
              { squad: homeSquad, lineupIds: homeLineupIds, team: home, color: '#00C853', side: 'home' },
              { squad: awaySquad, lineupIds: awayLineupIds, team: away, color: '#448AFF', side: 'away' },
            ].map(({ squad, lineupIds, team, color, side }) => (
              squad.length > 0 && (
                <div key={side} style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
                  {/* Team header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <TeamLogo team={team} size={22} />
                    <span style={{ fontWeight: 800, fontSize: '0.78rem', color }}>{team?.name || side}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, color: '#555' }}>
                      {lineupIds.size > 0 ? `${lineupIds.size} starters · ` : ''}{squad.length} total
                    </span>
                  </div>
                  {/* Player grid — 2 columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                    {squad.map((pl) => {
                      const isStarter = lineupIds.has(pl.id);
                      return (
                        <div key={pl.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 8px', borderRadius: 7, minWidth: 0,
                          background: isStarter ? `${color}12` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isStarter ? color + '44' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: isStarter ? color : 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.62rem', fontWeight: 900,
                            color: isStarter ? '#000' : '#777',
                          }}>{pl.number ?? '?'}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.74rem', fontWeight: isStarter ? 700 : 500, color: isStarter ? 'var(--text)' : 'var(--text-secondary, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pl.name}
                            </div>
                            {pl.position && (
                              <div style={{ fontSize: '0.58rem', color: isStarter ? color + 'cc' : '#555', fontWeight: 600 }}>{pl.position}</div>
                            )}
                          </div>
                          {isStarter && (
                            <span style={{ fontSize: '0.5rem', fontWeight: 800, color, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>ST</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Shot analysis (if data exists) */}
      {matchShots.length > 0 && (
        <div style={{ padding: '4px 16px 16px' }}>
          <div className="kcard" style={{ padding: 14 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 10 }}>
              Shot Analysis
            </div>
            <ShotMapView shots={matchShots} homeTeam={home} awayTeam={away} players={players} />
          </div>
        </div>
      )}
    </div>
  );
}

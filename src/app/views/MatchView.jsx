import React from 'react';
import { TeamLogo, COLORS } from '../lib/hooks';

export default function MatchView({ data, matchId, navigate }) {
  const { matches, teamMap, events, players } = data;

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

  // Squad for each team (registered roster, not a per-match lineup):
  // starters first, then subs, then reserves, by number within each group.
  const roleOrder = { player: 0, sub: 1, reserve: 2 };
  const bySquadOrder = (a, b) => {
    const aO = roleOrder[a.player_type] ?? 3;
    const bO = roleOrder[b.player_type] ?? 3;
    return aO - bO || (a.number || 99) - (b.number || 99);
  };
  const homeSquad = players.filter(p => p.team_id === match.home_team_id && p.player_type !== 'manager').sort(bySquadOrder);
  const awaySquad = players.filter(p => p.team_id === match.away_team_id && p.player_type !== 'manager').sort(bySquadOrder);
  const hasSquad = homeSquad.length > 0 || awaySquad.length > 0;

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

      {/* Squads */}
      {hasSquad && (
        <div style={{ padding: '4px 16px 4px' }}>
          <div className="kcard" style={{ overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 14px 8px', fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
              Squads
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

            {/* Full squad — one team per section, starters highlighted */}
            {[
              { squad: homeSquad, team: home, color: '#00C853', side: 'home' },
              { squad: awaySquad, team: away, color: '#448AFF', side: 'away' },
            ].map(({ squad, team, color, side }) => (
              squad.length > 0 && (
                <div key={side} style={{ borderTop: '1px solid var(--border)', padding: '10px 14px' }}>
                  {/* Team header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <TeamLogo team={team} size={22} />
                    <span style={{ fontWeight: 800, fontSize: '0.78rem', color }}>{team?.name || side}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700, color: '#555' }}>
                      {squad.length} total
                    </span>
                  </div>
                  {/* Player grid — 2 columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
                    {squad.map((pl) => {
                      const isStarter = (pl.player_type || 'player') === 'player';
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
                          {pl.player_type === 'sub' && (
                            <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#888', flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>SUB</span>
                          )}
                          {pl.player_type === 'reserve' && (
                            <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#888', flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>RES</span>
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

    </div>
  );
}

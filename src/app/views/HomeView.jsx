import React, { useState } from 'react';
import { TeamLogo, COLORS, LOGO_URL, ADLERS_CREST_URL, ADLERS_INSTAGRAM_URL, VENUE_NAME, VENUE_MAP_URL, EVENT_DATE_LABEL } from '../lib/hooks';

const PinIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;

const AWARD_CATEGORIES = [
  { key: 'first_place',   label: '1st Place',     type: 'team',   color: '#FFD400', medal: '1ST' },
  { key: 'second_place',  label: '2nd Place',      type: 'team',   color: '#C0C0C0', medal: '2ND' },
  { key: 'third_place',   label: '3rd Place',      type: 'team',   color: '#CD7F32', medal: '3RD' },
  { key: 'best_player',   label: 'Best Player',   type: 'player', color: '#FFD400', medal: 'MVP' },
  { key: 'top_scorer',    label: 'Top Scorer',    type: 'player', color: '#00C853', medal: 'GLS' },
  { key: 'best_defender', label: 'Best Defender', type: 'player', color: '#448AFF', medal: 'DEF' },
  { key: 'best_gk',       label: 'Best GK',       type: 'player', color: '#FF9100', medal: 'GK'  },
  { key: 'best_manager',  label: 'Best Manager',  type: 'custom', color: '#9C27B0', medal: 'MGR' },
];

export default function HomeView({ data, subTab, setSubTab, navigate }) {
  const { teams, matches, standings, groups, teamMap, awards, players } = data;
  const [showTeamsModal, setShowTeamsModal] = useState(false);
  const [matchFilter, setMatchFilter] = useState('all');

  const hasGroups = Object.values(groups).some(g => g.length > 0);

  // All Matches tab: every match (group + knockout), ordered by kickoff time
  const sortByTime = (list) => {
    return [...list].sort((a, b) => {
      const at = a.match_time || '99:99:99';
      const bt = b.match_time || '99:99:99';
      if (at !== bt) return at < bt ? -1 : 1;
      if ((a.ground || '') !== (b.ground || '')) return (a.ground || '').localeCompare(b.ground || '');
      return (a.match_number || 999) - (b.match_number || 999);
    });
  };
  const allMatchesFiltered = sortByTime(matches.filter(m => {
    if (matchFilter === 'all') return true;
    if (matchFilter === 'knockout') return m.stage !== 'group';
    return m.stage === 'group' && m.group_letter === matchFilter;
  }));
  const stageLabel = m => m.stage === 'group' ? `Group ${m.group_letter} · M${m.match_number || '?'}` : (m.label || m.stage);

  return (
    <>
    <div className="animate-fade">
      {/* Hero Banner */}
      <div className="hero speedlines">
        <img src={LOGO_URL} alt="Asia Cup 2026" className="hero-logo" />
        <h1 className="sr-only">Asia Cup 2026 — Adlers Lombard FC</h1>
        <div className="hero-facts">
          <span className="fact-chip"><strong>{EVENT_DATE_LABEL}</strong></span>
          <a href={VENUE_MAP_URL} target="_blank" rel="noreferrer" className="fact-chip"><PinIcon /> {VENUE_NAME}</a>
          <button onClick={() => setShowTeamsModal(true)} className="fact-chip"><strong>{teams.length}</strong> Teams</button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="tabbar">
        {[
          { key: 'groups', label: 'Groups' },
          { key: 'fixtures', label: 'All Matches' },
          { key: 'knockouts', label: 'Knockouts' },
          { key: 'awards', label: 'Awards' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setSubTab(tab.key)} className={`tappable ${subTab === tab.key ? 'active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 16 }} className="stagger">

        {/* GROUPS TAB */}
        {subTab === 'groups' && (
          !hasGroups ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4, color: '#888' }}>Draw Not Done Yet</div>
              <div style={{ fontSize: '0.82rem' }}>Admin must assign teams to groups first.</div>
            </div>
          ) : (
            ['A', 'B', 'C', 'D'].map(g => (
              <div key={g} className="kcard animate-fade" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--gradient-gold-flat)', color: COLORS.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.95rem', fontFamily: 'var(--font-display)', transform: 'skewX(-8deg)' }}>{g}</div>
                  <span className="display" style={{ fontSize: '1.05rem', letterSpacing: '0.06em' }}>Group {g}</span>
                  <span className="pill pill-green" style={{ marginLeft: 'auto', fontSize: '0.6rem' }}>Top 2 qualify</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="standings-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <colgroup>
                      <col style={{ width: 32 }} />
                      <col />
                      <col style={{ width: 36 }} />
                      <col style={{ width: 36 }} />
                      <col style={{ width: 36 }} />
                      <col style={{ width: 36 }} />
                      <col style={{ width: 44 }} />
                      <col style={{ width: 40 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th style={{ textAlign: 'left' }}>Team</th>
                        <th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(standings[g] || []).map((s, idx) => (
                        <tr key={s.id} className={idx < 2 ? 'qualify' : ''} onClick={() => navigate('team', { teamId: s.id })} style={{ cursor: 'pointer' }}>
                          <td>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 900,
                              background: idx < 2 ? COLORS.green : 'var(--card2)', color: idx < 2 ? '#fff' : '#666' }}>
                              {idx + 1}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                              <TeamLogo team={teamMap[s.id]} size={28} />
                              <span style={{ fontWeight: 700, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                            </div>
                          </td>
                          <td>{s.p}</td>
                          <td style={{ color: COLORS.green }}>{s.w}</td>
                          <td style={{ color: '#666' }}>{s.d}</td>
                          <td style={{ color: COLORS.red }}>{s.l}</td>
                          <td>{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                          <td className="pts">{s.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )
        )}

        {/* FIXTURES TAB */}
        {subTab === 'fixtures' && (
          <>
            {/* Group / Knockout filter */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'A', label: 'Group A' },
                { key: 'B', label: 'Group B' },
                { key: 'C', label: 'Group C' },
                { key: 'D', label: 'Group D' },
                { key: 'knockout', label: 'Knockout' },
              ].map(f => (
                <button key={f.key} onClick={() => setMatchFilter(f.key)}
                  className="tappable"
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800,
                    border: `1.5px solid ${matchFilter === f.key ? COLORS.gold : 'var(--border)'}`,
                    background: matchFilter === f.key ? `${COLORS.gold}20` : 'transparent',
                    color: matchFilter === f.key ? COLORS.gold : '#888' }}>
                  {f.label}
                </button>
              ))}
            </div>

            {matches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4, color: '#888' }}>No Fixtures Yet</div>
                <div style={{ fontSize: '0.82rem' }}>Fixtures appear after the group draw is finalised.</div>
              </div>
            ) : allMatchesFiltered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555', fontSize: '0.82rem' }}>No matches in this filter.</div>
            ) : (
              <div className="kcard animate-fade">
                {allMatchesFiltered.map(m => {
                  const home = teamMap[m.home_team_id];
                  const away = teamMap[m.away_team_id];
                  const isLive = m.status === 'live';

                  return (
                    <div key={m.id} className="match-card tappable" onClick={() => navigate('match', { matchId: m.id })}
                      style={{ display: 'flex', flexDirection: 'column', padding: '12px 14px', gap: 6,
                        borderBottom: '1px solid var(--border)',
                        background: isLive ? 'rgba(0,200,83,0.04)' : undefined,
                        borderLeft: isLive ? '3px solid #00C853' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666' }}>{stageLabel(m)}</span>
                        {isLive && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00C853', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#00C853', letterSpacing: 1, textTransform: 'uppercase' }}>Live Now</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div className="match-team-col" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <TeamLogo team={home} size={40} />
                          <span className="match-team-name" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{home?.name || m.home_source || 'TBD'}</span>
                        </div>
                        <div className={`match-score-box ${m.played ? 'played' : isLive ? 'live' : 'upcoming'}`} style={{ margin: '0 12px' }}>
                          {m.played ? `${m.home_score} - ${m.away_score}` : isLive ? `${m.home_score ?? 0} - ${m.away_score ?? 0}` : 'VS'}
                        </div>
                        <div className="match-team-col away" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                          <span className="match-team-name" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{away?.name || m.away_source || 'TBD'}</span>
                          <TeamLogo team={away} size={40} />
                        </div>
                      </div>
                      {(m.match_time || m.ground) && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 2, fontSize: '0.68rem', fontWeight: 700 }}>
                          {m.match_time && <span style={{ color: COLORS.gold }}>Time: {m.match_time.slice(0, 5)}</span>}
                          {m.ground && <span style={{ color: '#888' }}>Ground: {m.ground}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* KNOCKOUTS TAB */}
        {subTab === 'knockouts' && (() => {
          const byId = id => matches.find(m => m.id === id);
          const qf = ['qf1', 'qf2', 'qf3', 'qf4'].map(byId);
          const sf = ['sf1', 'sf2'].map(byId);
          const finalMatch = byId('final');

          const BracketRow = (team, sourceLabel, score, isWinner) => (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px',
              background: isWinner ? 'rgba(255,212,0,0.1)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <TeamLogo team={team} size={22} />
                <span className="truncate" style={{ fontSize: '0.74rem', fontWeight: isWinner ? 800 : 600,
                  color: isWinner ? COLORS.gold : team ? undefined : '#666', fontStyle: team ? 'normal' : 'italic' }}>
                  {team?.short_name || team?.name || sourceLabel || 'TBD'}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 900, color: COLORS.gold, flexShrink: 0 }}>{score}</span>
            </div>
          );

          const BracketCard = ({ match, label, accent }) => {
            const home = match ? teamMap[match.home_team_id] : null;
            const away = match ? teamMap[match.away_team_id] : null;
            const isLive = match?.status === 'live';
            const hasPen = match?.played && match.home_penalties != null && match.away_penalties != null;
            return (
              <div className={`kcard ${match ? 'tappable' : ''}`} style={{ padding: 0, overflow: 'hidden', width: 210, flexShrink: 0,
                  cursor: match ? 'pointer' : 'default', border: isLive ? '2px solid #00C853' : accent ? `2px solid ${accent}` : undefined }}
                onClick={() => match && navigate('match', { matchId: match.id })}>
                <div style={{ padding: '5px 10px', fontSize: '0.6rem', fontWeight: 700, color: isLive ? '#00C853' : '#666',
                  textAlign: 'center', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {isLive ? '● LIVE NOW' : label}
                </div>
                {BracketRow(home, match?.home_source, match ? (match.played || isLive ? (match.home_score ?? 0) : '-') : '', match?.played && match.winner_team_id === match.home_team_id)}
                <div style={{ borderTop: '1px solid var(--border)' }} />
                {BracketRow(away, match?.away_source, match ? (match.played || isLive ? (match.away_score ?? 0) : '-') : '', match?.played && match.winner_team_id === match.away_team_id)}
                {hasPen && (
                  <div style={{ fontSize: '0.58rem', fontWeight: 800, color: COLORS.gold, textAlign: 'center', padding: '3px 0', borderTop: '1px solid var(--border)' }}>
                    Pens: {match.home_penalties}-{match.away_penalties}
                  </div>
                )}
              </div>
            );
          };

          const Connectors = ({ count }) => (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', boxSizing: 'border-box', paddingTop: 28, width: 22, flexShrink: 0, alignSelf: 'stretch' }}>
              {Array.from({ length: count }).map((_, i) => <div key={i} className="bkt-connector" />)}
            </div>
          );

          const ColTitle = ({ children, color }) => (
            <div style={{ textAlign: 'center', fontSize: '0.66rem', fontWeight: 800, color: color || '#888',
              textTransform: 'uppercase', letterSpacing: 1, height: 16, marginBottom: 12 }}>{children}</div>
          );

          return (
            <div className="animate-fade">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>Championship Bracket</div>
                <div style={{ fontSize: '0.72rem', color: '#666', marginTop: 2 }}>Knockout stage — single elimination</div>
              </div>

              <div style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 720 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <ColTitle>Quarter-Finals</ColTitle>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 14 }}>
                      {qf.map((m, i) => <BracketCard key={i} match={m} label={`QF${i + 1}`} />)}
                    </div>
                  </div>

                  <Connectors count={2} />

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <ColTitle>Semi-Finals</ColTitle>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 14 }}>
                      {sf.map((m, i) => <BracketCard key={i} match={m} label={`SF${i + 1}`} />)}
                    </div>
                  </div>

                  <Connectors count={1} />

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <ColTitle color={COLORS.gold}>Grand Final</ColTitle>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <BracketCard match={finalMatch} label="Final" accent={COLORS.gold} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* AWARDS TAB */}
        {subTab === 'awards' && (() => {
          const awardsMap = {};
          (awards || []).forEach(a => { awardsMap[a.category] = a; });
          const anySet = AWARD_CATEGORIES.some(cat => {
            const a = awardsMap[cat.key];
            return a?.team_id || a?.player_id || a?.custom_name;
          });

          return (
            <div className="animate-fade">
              {!anySet ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4, color: '#888' }}>Awards Not Announced Yet</div>
                  <div style={{ fontSize: '0.82rem' }}>Check back after the tournament.</div>
                </div>
              ) : (
                AWARD_CATEGORIES.map(cat => {
                  const award = awardsMap[cat.key];
                  const team = award?.team_id ? teamMap[award.team_id] : null;
                  const player = award?.player_id ? (players || []).find(p => p.id === award.player_id) : null;
                  const playerTeam = player ? teamMap[player.team_id] : null;
                  const isSet = team || player || award?.custom_name;
                  if (!isSet) return null;

                  return (
                    <div key={cat.key} className="kcard tappable" style={{ marginBottom: 10, padding: 14,
                      border: `1px solid ${cat.color}30`,
                      cursor: (team || playerTeam) ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (team) navigate('team', { teamId: team.id });
                        else if (playerTeam) navigate('team', { teamId: playerTeam.id });
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Medal badge */}
                        <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                          background: `${cat.color}20`, border: `2px solid ${cat.color}60`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 900, fontSize: '0.65rem', color: cat.color, letterSpacing: 0.5 }}>
                          {cat.medal}
                        </div>
                        {/* Winner */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: cat.color,
                            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                            {cat.label}
                          </div>
                          {cat.type === 'team' && team && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TeamLogo team={team} size={36} />
                              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{team.name}</span>
                            </div>
                          )}
                          {cat.type === 'player' && player && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <TeamLogo team={playerTeam} size={36} />
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{player.name}</div>
                                <div style={{ fontSize: '0.65rem', color: '#888' }}>
                                  {playerTeam?.name}
                                  {player.position && <span style={{ marginLeft: 6, color: cat.color, fontWeight: 700 }}>{player.position}</span>}
                                </div>
                              </div>
                            </div>
                          )}
                          {cat.type === 'custom' && award?.custom_name && (
                            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{award.custom_name}</div>
                          )}
                        </div>
                        {/* Arrow for tappable cards */}
                        {(team || playerTeam) && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })()}
      </div>
    </div>

      {/* Teams Modal */}
      {showTeamsModal && (
        <div className="modal-overlay" onClick={() => setShowTeamsModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85dvh' }}>
            <div className="modal-handle" />
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>All Teams</div>
              <button onClick={() => setShowTeamsModal(false)} style={{ background: 'transparent', color: '#666', border: 'none', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {teams.map(t => (
                  <div key={t.id} className="kcard tappable" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    onClick={() => { setShowTeamsModal(false); navigate('team', { teamId: t.id }); }}>
                    <TeamLogo team={t} size={40} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.72rem' }} className="truncate">{t.name}</div>
                      <div style={{ fontSize: '0.6rem', color: '#666', marginTop: 2 }}>{t.short_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

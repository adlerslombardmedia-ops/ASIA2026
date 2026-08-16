import React, { useState } from 'react';
import { TeamLogo, COLORS, LOGO_URL } from '../lib/hooks';

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

  const groupMatches = matches.filter(m => m.stage === 'group');
  const hasGroups = Object.values(groups).some(g => g.length > 0);

  // Sort: LIVE first, then by match_number
  const sortMatches = (list) => {
    return [...list].sort((a, b) => {
      const aLive = a.status === 'live' ? 0 : 1;
      const bLive = b.status === 'live' ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return (a.match_number || 999) - (b.match_number || 999);
    });
  };

  return (
    <div className="animate-fade">
      {/* Hero Banner */}
      <div style={{
        background: `linear-gradient(135deg, #0a0a0a 0%, ${COLORS.dark} 40%, #0d1f0d 100%)`,
        padding: '32px 16px 24px',
        textAlign: 'center',
        borderBottom: `3px solid ${COLORS.gold}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position:'absolute', top: -60, right: -60, width: 160, height: 160, borderRadius:'50%', background: `radial-gradient(circle, ${COLORS.italyGreen}15, transparent)` }} />
        <div style={{ position:'absolute', bottom: -40, left: -40, width: 120, height: 120, borderRadius:'50%', background: `radial-gradient(circle, ${COLORS.italyRed}15, transparent)` }} />

        <img src={LOGO_URL} alt="Asia Cup 2026" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'contain', margin: '0 auto 8px', display: 'block', border: `2px solid ${COLORS.gold}` }}
          onError={e => { e.target.style.display = 'none'; }} />
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: COLORS.gold, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>
          Adlers Lombard FC Presents
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', letterSpacing: 1, lineHeight: 1.1, marginBottom: 12 }}>
          ASIA CUP <span style={{ color: COLORS.gold }}>2026</span>
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, fontSize: '0.68rem', fontWeight: 600, color: '#999' }}>
          <button onClick={() => setShowTeamsModal(true)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '3px 10px', borderRadius: 20, color: '#999', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>
            {teams.length} Teams
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
        {[
          { key: 'groups', label: 'Groups' },
          { key: 'fixtures', label: 'Group Stage' },
          { key: 'knockouts', label: 'Knockouts' },
          { key: 'awards', label: 'Awards' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setSubTab(tab.key)}
            className="tappable"
            style={{
              flex: 1, padding: '12px 0', fontSize: '0.75rem', fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: 0.5, background: 'transparent',
              color: subTab === tab.key ? COLORS.gold : '#666',
              borderBottom: subTab === tab.key ? `2px solid ${COLORS.gold}` : '2px solid transparent',
              transition: 'all 0.2s ease',
            }}>
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
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: COLORS.gold, color: COLORS.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.82rem' }}>{g}</div>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Group {g}</span>
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
          groupMatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 4, color: '#888' }}>No Fixtures Yet</div>
              <div style={{ fontSize: '0.82rem' }}>Fixtures appear after the group draw is finalised.</div>
            </div>
          ) : (
            ['A', 'B', 'C', 'D'].map(g => {
              const gm = groupMatches.filter(m => m.group_letter === g);
              const sortedGm = sortMatches(gm);
              if (sortedGm.length === 0) return null;
              return (
                <div key={g} className="kcard animate-fade" style={{ marginBottom: 16 }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: COLORS.gold, color: COLORS.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.72rem' }}>{g}</div>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Group {g}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#666', fontWeight: 600 }}>{gm.filter(m => m.played).length}/{gm.length} played</span>
                  </div>
                  {sortedGm.map(m => {
                    const home = teamMap[m.home_team_id];
                    const away = teamMap[m.away_team_id];
                    const isLive = m.status === 'live';

                    return (
                      <div key={m.id} className="match-card tappable" onClick={() => navigate('match', { matchId: m.id })}
                        style={{ display: 'flex', flexDirection: 'column', padding: '12px 14px', gap: 6,
                          background: isLive ? 'rgba(0,200,83,0.04)' : undefined,
                          borderLeft: isLive ? '3px solid #00C853' : undefined }}>
                        {isLive && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00C853', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#00C853', letterSpacing: 1, textTransform: 'uppercase' }}>Live Now</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <div className="match-team-col" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                            <TeamLogo team={home} size={40} />
                            <span className="match-team-name" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{home?.name || 'TBD'}</span>
                          </div>
                          <div className={`match-score-box ${m.played ? 'played' : isLive ? 'live' : 'upcoming'}`} style={{ margin: '0 12px' }}>
                            {m.played ? `${m.home_score} - ${m.away_score}` : isLive ? `${m.home_score ?? 0} - ${m.away_score ?? 0}` : 'VS'}
                          </div>
                          <div className="match-team-col away" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                            <span className="match-team-name" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{away?.name || 'TBD'}</span>
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
              );
            })
          )
        )}

        {/* KNOCKOUTS TAB */}
        {subTab === 'knockouts' && (
          <div className="animate-fade">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>Championship Bracket</div>
              <div style={{ fontSize: '0.72rem', color: '#666', marginTop: 2 }}>Knockout stage — single elimination</div>
            </div>

            {['QF', 'SF', '3P', 'F'].map(stage => {
              const stageMatches = matches.filter(m => m.stage === stage);
              const sortedStageMatches = sortMatches(stageMatches);
              const stageLabel = stage === 'QF' ? 'Quarter-Finals' : stage === 'SF' ? 'Semi-Finals' : stage === '3P' ? '3rd Place Play-off' : 'Final';
              if (sortedStageMatches.length === 0 && stage !== 'F' && stage !== '3P') return null;

              return (
                <div key={stage} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: stage === 'F' ? COLORS.gold : stage === '3P' ? '#CD7F32' : '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, textAlign: 'center' }}>
                    {stageLabel}
                  </div>
                  {sortedStageMatches.length === 0 ? (
                    <div className="kcard" style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: '0.82rem', border: stage === 'F' ? `2px solid ${COLORS.gold}` : stage === '3P' ? '2px solid #CD7F32' : undefined }}>
                      Waiting for results…
                    </div>
                  ) : (
                    sortedStageMatches.map(m => {
                      const home = teamMap[m.home_team_id];
                      const away = teamMap[m.away_team_id];
                      const isLive = m.status === 'live';
                      const hasPen = m.played && m.home_penalties != null && m.away_penalties != null;

                      return (
                        <div key={m.id} className="kcard tappable" style={{ marginBottom: 8,
                            border: isLive ? '2px solid #00C853' : stage === 'F' ? `2px solid ${COLORS.gold}` : stage === '3P' ? '2px solid #CD7F32' : undefined,
                            background: isLive ? 'rgba(0,200,83,0.04)' : undefined }}
                          onClick={() => navigate('match', { matchId: m.id })}>
                          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: '0.65rem', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
                            color: isLive ? '#00C853' : '#666' }}>
                            {isLive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00C853', display: 'inline-block', animation: 'pulse 1s infinite' }} />}
                            {isLive ? <span style={{ fontWeight: 900, letterSpacing: 1 }}>LIVE NOW</span> : <span>{m.label || stage}</span>}
                            {!isLive && m.ground && <span>· Ground: {m.ground}</span>}
                            {!isLive && m.match_time && <span>· Time: {m.match_time.slice(0, 5)}</span>}
                          </div>
                          <div className="match-card" style={{ display: 'flex', alignItems: 'center', padding: '12px 14px' }}>
                            <div className="match-team-col" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                              <TeamLogo team={home} size={40} />
                              <span className="match-team-name" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{home?.name || m.home_source || 'TBD'}</span>
                            </div>
                            <div style={{ margin: '0 12px', textAlign: 'center' }}>
                              <div className={`match-score-box ${m.played ? 'played' : isLive ? 'live' : 'upcoming'}`}>
                                {m.played ? `${m.home_score} - ${m.away_score}` : isLive ? `${m.home_score ?? 0} - ${m.away_score ?? 0}` : 'VS'}
                              </div>
                              {hasPen && (
                                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: COLORS.gold, marginTop: 3 }}>
                                  ({m.home_penalties}-{m.away_penalties} pen)
                                </div>
                              )}
                            </div>
                            <div className="match-team-col away" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                              <span className="match-team-name" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{away?.name || m.away_source || 'TBD'}</span>
                              <TeamLogo team={away} size={40} />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}

            {/* Show bracket sources if no knockout matches yet */}
            {matches.filter(m => ['QF','SF','3P','F'].includes(m.stage)).length === 0 && (
              <div className="kcard" style={{ padding: 16 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#888', marginBottom: 12 }}>Bracket Seeding</div>
                {[
                  ['QF1', 'A1 vs B2'], ['QF2', 'B1 vs A2'],
                  ['QF3', 'C1 vs D2'], ['QF4', 'D1 vs C2'],
                ].map(([label, desc]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 800, color: COLORS.gold }}>{label}</span>
                    <span style={{ color: '#888' }}>{desc}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, fontSize: '0.72rem', color: '#555', textAlign: 'center' }}>
                  SF1: QF1 W vs QF2 W (A/B) · SF2: QF3 W vs QF4 W (C/D) · 3rd Place: SF1 L vs SF2 L · Final: SF1 W vs SF2 W
                </div>
              </div>
            )}
          </div>
        )}

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
    </div>
  );
}

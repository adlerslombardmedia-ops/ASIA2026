import React, { useState } from 'react';
import { TeamLogo, COLORS, launchConfetti } from '../lib/hooks';
import * as db from '../lib/db';
import { toast } from '../lib/hooks';

const ADMIN_EMAILS = ['precious@keff.com', 'info@keff.com'];

const AWARD_CATEGORIES = [
  { key: 'first_place',   label: '1st Place',      type: 'team',   color: COLORS.gold,   medal: '1ST' },
  { key: 'second_place',  label: '2nd Place',       type: 'team',   color: '#C0C0C0',     medal: '2ND' },
  { key: 'third_place',   label: '3rd Place',       type: 'team',   color: '#CD7F32',     medal: '3RD' },
  { key: 'best_player',   label: 'Best Player',     type: 'player', color: COLORS.gold,   medal: 'MVP' },
  { key: 'top_scorer',    label: 'Top Scorer',      type: 'player', color: '#00C853',     medal: 'GLS' },
  { key: 'best_defender', label: 'Best Defender',   type: 'player', color: '#448AFF',     medal: 'DEF' },
  { key: 'best_gk',       label: 'Best GK',         type: 'player', color: '#FF9100',     medal: 'GK'  },
  { key: 'best_manager',  label: 'Best Manager',    type: 'custom', color: '#9C27B0',     medal: 'MGR' },
];

export default function StatsView({ data, navigate }) {
  const { topScorers, topAssists, teamMap, players, matches, events, awards, user } = data;
  const [activeTab, setActiveTab] = useState('scorers');
  const [editingAward, setEditingAward] = useState(null); // category key
  const [awardDraft, setAwardDraft] = useState({});
  const [busy, setBusy] = useState(false);

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Map awards array → object keyed by category
  const awardsMap = {};
  (awards || []).forEach(a => { awardsMap[a.category] = a; });

  // Clean sheets
  const csCounts = {};
  matches.filter(m => m.played).forEach(m => {
    if (m.away_score === 0) csCounts[m.home_team_id] = (csCounts[m.home_team_id] || 0) + 1;
    if (m.home_score === 0) csCounts[m.away_team_id] = (csCounts[m.away_team_id] || 0) + 1;
  });
  const cleanSheets = Object.entries(csCounts)
    .map(([teamId, count]) => {
      const gk = players.find(p => p.team_id === teamId && p.position === 'GK' && p.is_starter);
      return { player: gk, team: teamMap[teamId], count };
    })
    .filter(x => x.player)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Easter egg
  const [trophyTaps, setTrophyTaps] = useState(0);
  const handleTrophyTap = () => {
    const next = trophyTaps + 1;
    setTrophyTaps(next);
    if (next >= 5) { launchConfetti(); setTrophyTaps(0); }
  };

  const tabs = [
    { key: 'scorers',  label: 'Scorers' },
    { key: 'assists',  label: 'Assists' },
    { key: 'clean',    label: 'Clean Sheets' },
    { key: 'cards',    label: 'Cards' },
  ];

  // Cards leaderboard
  const cardCounts = {};
  (events || []).forEach(e => {
    if (e.type === 'yellow_card' || e.type === 'red_card') {
      if (!cardCounts[e.player_id]) cardCounts[e.player_id] = { yellow: 0, red: 0, team_id: e.team_id };
      if (e.type === 'yellow_card') cardCounts[e.player_id].yellow++;
      if (e.type === 'red_card')    cardCounts[e.player_id].red++;
    }
  });

  const cardsList = Object.entries(cardCounts)
    .map(([pid, c]) => ({ player: players.find(p => p.id === pid), yellow: c.yellow, red: c.red, team_id: c.team_id }))
    .filter(x => x.player)
    .sort((a, b) => (b.red * 3 + b.yellow) - (a.red * 3 + a.yellow));

  // Team card totals
  const teamCardCounts = {};
  (events || []).forEach(e => {
    if (e.type === 'yellow_card' || e.type === 'red_card') {
      if (!teamCardCounts[e.team_id]) teamCardCounts[e.team_id] = { yellow: 0, red: 0 };
      if (e.type === 'yellow_card') teamCardCounts[e.team_id].yellow++;
      if (e.type === 'red_card')    teamCardCounts[e.team_id].red++;
    }
  });

  const teamCardsList = Object.entries(teamCardCounts)
    .map(([tid, c]) => ({ team: teamMap[tid], yellow: c.yellow, red: c.red }))
    .filter(x => x.team)
    .sort((a, b) => (b.red * 3 + b.yellow) - (a.red * 3 + a.yellow));

  const currentData = activeTab === 'scorers' ? topScorers : activeTab === 'assists' ? topAssists : cleanSheets;


  // Award helpers
  const startEditAward = (cat) => {
    const existing = awardsMap[cat.key] || {};
    setAwardDraft({
      team_id: existing.team_id || '',
      player_id: existing.player_id || '',
      custom_name: existing.custom_name || '',
    });
    setEditingAward(cat.key);
  };

  const saveAward = async (key) => {
    setBusy(true);
    try {
      await db.upsertAward(key, {
        team_id: awardDraft.team_id || null,
        player_id: awardDraft.player_id || null,
        custom_name: awardDraft.custom_name || null,
      });
      setEditingAward(null);
      toast('Award saved!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const clearAward = async (key) => {
    if (!window.confirm('Clear this award?')) return;
    try {
      await db.upsertAward(key, { team_id: null, player_id: null, custom_name: null });
      toast('Award cleared', 'info');
    } catch (e) { toast(e.message, 'error'); }
  };

  // Render a single award card
  const AwardCard = ({ cat }) => {
    const award = awardsMap[cat.key];
    const team = award?.team_id ? teamMap[award.team_id] : null;
    const player = award?.player_id ? players.find(p => p.id === award.player_id) : null;
    const playerTeam = player ? teamMap[player.team_id] : null;
    const isSet = team || player || award?.custom_name;
    const isEditing = editingAward === cat.key;

    return (
      <div className="kcard" style={{ padding: 14, marginBottom: 10,
        border: isSet ? `1px solid ${cat.color}30` : '1px solid var(--border)' }}>

        {/* Award header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isEditing ? 12 : (isSet ? 10 : 0) }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `${cat.color}20`, border: `1.5px solid ${cat.color}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: '0.65rem', color: cat.color, letterSpacing: 0.5 }}>
            {cat.medal}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: cat.color }}>{cat.label}</div>
            {!isSet && !isEditing && (
              <div style={{ fontSize: '0.68rem', color: '#555', marginTop: 1 }}>To be announced</div>
            )}
          </div>
          {isAdmin && !isEditing && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => startEditAward(cat)}
                style={{ padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                  background: 'transparent', border: `1px solid ${cat.color}50`, color: cat.color, cursor: 'pointer' }}>
                {isSet ? 'Edit' : 'Set'}
              </button>
              {isSet && (
                <button onClick={() => clearAward(cat.key)}
                  style={{ padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                    background: 'transparent', border: '1px solid rgba(255,61,87,0.3)', color: '#FF3D57', cursor: 'pointer' }}>
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Winner display */}
        {!isEditing && isSet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 0' }}>
            {cat.type === 'team' && team && (
              <>
                <TeamLogo team={team} size={44} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{team.name}</div>
                  <div style={{ fontSize: '0.68rem', color: '#666', marginTop: 1 }}>{cat.label}</div>
                </div>
              </>
            )}
            {cat.type === 'player' && player && (
              <>
                <TeamLogo team={playerTeam} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }} className="truncate">{player.name}</div>
                  <div style={{ fontSize: '0.68rem', color: '#666', marginTop: 1 }} className="truncate">
                    {playerTeam?.name || ''}
                    {player.position && <span style={{ marginLeft: 6, color: cat.color, fontWeight: 700 }}>{player.position}</span>}
                  </div>
                </div>
              </>
            )}
            {cat.type === 'custom' && award?.custom_name && (
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{award.custom_name}</div>
            )}
          </div>
        )}

        {/* Inline edit */}
        {isEditing && (
          <div>
            {cat.type === 'team' && (
              <select value={awardDraft.team_id} onChange={e => setAwardDraft(d => ({ ...d, team_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: '0.82rem',
                  background: 'var(--card2)', color: 'var(--text)', border: '1px solid var(--border)', marginBottom: 8 }}>
                <option value="">Choose team…</option>
                {Object.values(teamMap).sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {cat.type === 'player' && (
              <select value={awardDraft.player_id} onChange={e => setAwardDraft(d => ({ ...d, player_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: '0.82rem',
                  background: 'var(--card2)', color: 'var(--text)', border: '1px solid var(--border)', marginBottom: 8 }}>
                <option value="">Choose player…</option>
                {players
                  .filter(p => cat.key === 'best_gk' ? p.position === 'GK' : cat.key === 'best_defender' ? p.position === 'DEF' : true)
                  .sort((a,b) => (teamMap[a.team_id]?.name || '').localeCompare(teamMap[b.team_id]?.name || '') || a.name.localeCompare(b.name))
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {teamMap[p.team_id]?.short_name || '?'} {p.position ? `(${p.position})` : ''}
                    </option>
                  ))
                }
              </select>
            )}
            {cat.type === 'custom' && (
              <input value={awardDraft.custom_name} onChange={e => setAwardDraft(d => ({ ...d, custom_name: e.target.value }))}
                placeholder="Enter name…"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: '0.82rem',
                  background: 'var(--card2)', color: 'var(--text)', border: '1px solid var(--border)',
                  marginBottom: 8, boxSizing: 'border-box' }} />
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingAward(null)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                  background: 'transparent', color: '#666', border: '1px solid var(--border)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => saveAward(cat.key)} disabled={busy}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                  background: cat.color, color: '#000', border: 'none', cursor: 'pointer' }}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ padding: '24px 16px 16px', textAlign: 'center' }}>
        <div
          style={{ fontSize: '0.72rem', fontWeight: 800, background: COLORS.gold, color: COLORS.dark,
            padding: '6px 12px', borderRadius: 6, display: 'inline-block', marginBottom: 8,
            cursor: 'pointer', letterSpacing: 1 }}
          className={trophyTaps >= 3 ? 'trophy-spin' : ''}
          onClick={handleTrophyTap}>
          TAP FOR CHAMPIONS CELEBRATION
        </div>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: -0.3 }}>Leaderboards</h1>
        <div style={{ fontSize: '0.72rem', color: '#666', marginTop: 2 }}>Asia Cup 2026</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="tappable"
            style={{ flex: 1, padding: '10px 0', fontSize: '0.72rem', fontWeight: 800, background: 'transparent',
              color: activeTab === tab.key ? COLORS.gold : '#666',
              borderBottom: activeTab === tab.key ? `2px solid ${COLORS.gold}` : '2px solid transparent' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leaderboard tabs */}
      {(
        <>
          <div style={{ padding: 16 }}>
            <div className="kcard">
              {currentData.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>No data yet</div>
                  <div style={{ fontSize: '0.75rem', marginTop: 4, color: '#444' }}>Stats will appear as matches are played.</div>
                </div>
              ) : (
                currentData.map((item, idx) => {
                  const player = item.player;
                  const team = activeTab === 'clean' ? item.team : teamMap[player?.team_id];
                  const count = item.count || item.cs;
                  return (
                    <div key={idx} className="leaderboard-item tappable animate-fade"
                      style={{ animationDelay: `${idx * 0.04}s` }}
                      onClick={() => team && navigate('team', { teamId: team.id })}>
                      <div className={`leaderboard-rank ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other'}`}>
                        {idx + 1}
                      </div>
                      <TeamLogo team={team} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }} className="truncate">{player?.name || '?'}</div>
                        <div style={{ fontSize: '0.68rem', color: '#666' }} className="truncate">{team?.name || '?'}</div>
                      </div>
                      <div className="leaderboard-count">{count}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cards tab */}
          {activeTab === 'cards' && (
            <div style={{ padding: '0 16px 16px' }}>
              {/* Players */}
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#888', marginBottom: 8, marginTop: 4 }}>Players</div>
              <div className="kcard" style={{ marginBottom: 14 }}>
                {cardsList.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#555', fontSize: '0.82rem' }}>No cards recorded yet.</div>
                ) : cardsList.map((item, idx) => {
                  const team = teamMap[item.player?.team_id];
                  return (
                    <div key={idx} className="leaderboard-item tappable" onClick={() => team && navigate('team', { teamId: team.id })}>
                      <div className={`leaderboard-rank ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other'}`}>{idx + 1}</div>
                      <TeamLogo team={team} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }} className="truncate">{item.player?.name || '?'}</div>
                        <div style={{ fontSize: '0.68rem', color: '#666' }} className="truncate">{team?.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        {item.yellow > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: '1rem' }}>🟨</span>
                            <span style={{ fontWeight: 900, fontSize: '0.85rem' }}>{item.yellow}</span>
                          </div>
                        )}
                        {item.red > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: '1rem' }}>🟥</span>
                            <span style={{ fontWeight: 900, fontSize: '0.85rem' }}>{item.red}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Teams */}
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#888', marginBottom: 8 }}>Teams</div>
              <div className="kcard">
                {teamCardsList.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#555', fontSize: '0.82rem' }}>No cards recorded yet.</div>
                ) : teamCardsList.map((item, idx) => (
                  <div key={idx} className="leaderboard-item tappable" onClick={() => item.team && navigate('team', { teamId: item.team.id })}>
                    <div className={`leaderboard-rank ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other'}`}>{idx + 1}</div>
                    <TeamLogo team={item.team} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }} className="truncate">{item.team?.name}</div>
                      <div style={{ fontSize: '0.68rem', color: '#666' }}>{item.team?.short_name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      {item.yellow > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: '1rem' }}>🟨</span>
                          <span style={{ fontWeight: 900, fontSize: '0.85rem' }}>{item.yellow}</span>
                        </div>
                      )}
                      {item.red > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: '1rem' }}>🟥</span>
                          <span style={{ fontWeight: 900, fontSize: '0.85rem' }}>{item.red}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick tournament stats */}
          {activeTab !== 'cards' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div className="kcard" style={{ padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', marginBottom: 12, color: '#888' }}>Tournament Stats</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { label: 'Matches Played', value: matches.filter(m => m.played).length },
                  { label: 'Total Goals', value: matches.filter(m => m.played).reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0) },
                  { label: 'Goals/Match', value: matches.filter(m => m.played).length ? (matches.filter(m => m.played).reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0) / matches.filter(m => m.played).length).toFixed(1) : '0' },
                  { label: 'Goal Scorers', value: topScorers.length },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: 8 }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: COLORS.gold }}>{s.value}</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}


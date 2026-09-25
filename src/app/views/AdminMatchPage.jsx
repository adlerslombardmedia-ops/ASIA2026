// ─── Admin Match Page ────────────────────────────────────────────────────────
// Dedicated match management page: Score
import React, { useState, useEffect } from 'react';
import * as db from '../lib/db';
import { TeamLogo, COLORS, toast } from '../lib/hooks';

function EventLogger({ players, teamMap, events, onAdd, onDelete }) {
  const [type, setType]  = useState('goal');
  const [pid,  setPid]   = useState('');
  const [min,  setMin]   = useState('');

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ width: 80, padding: '7px 4px', fontSize: '0.72rem' }}>
          <option value="goal">Goal</option>
          <option value="assist">Assist</option>
        </select>
        <select value={pid} onChange={e => setPid(e.target.value)}
          style={{ flex: 1, minWidth: 100, padding: '7px 4px', fontSize: '0.72rem' }}>
          <option value="">Player…</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>#{p.number} {p.name} ({teamMap[p.team_id]?.short_name})</option>
          ))}
        </select>
        <input type="number" min="1" max="90" placeholder="min" value={min}
          onChange={e => setMin(e.target.value)}
          style={{ width: 44, padding: '7px 4px', fontSize: '0.72rem', textAlign: 'center' }} />
        <button className="btn btn-success btn-sm"
          onClick={() => { onAdd(type, pid, min); setPid(''); setMin(''); }}>
          +
        </button>
      </div>
      {events.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
          borderBottom: '1px solid var(--border)', fontSize: '0.72rem' }}>
          <span style={{ color: COLORS.gold, fontWeight: 800, width: 14 }}>{e.type === 'goal' ? 'G' : 'A'}</span>
          <span style={{ color: '#888', flexShrink: 0 }}>{teamMap[e.team_id]?.short_name}</span>
          <span style={{ flex: 1 }}>{e.player_name || '?'}</span>
          {e.minute && <span style={{ color: '#666' }}>{e.minute}'</span>}
          <button onClick={() => onDelete(e.id)}
            style={{ background: 'transparent', border: 'none', color: '#FF3D57', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px' }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── MATCH SHEET COMPONENT ───────────────────────────────────────────────────
function MatchSheet({ home, away, players, matchEvents, teamMap, onAdd, onDelete, isKnockout }) {
  const [cardPid,  setCardPid]  = React.useState('');
  const [cardSide, setCardSide] = React.useState('home');
  const [penSide,  setPenSide]  = React.useState('home');

  const homePlayers = players.filter(p => p.team_id === home?.id);
  const awayPlayers = players.filter(p => p.team_id === away?.id);

  const homeSquad = homePlayers.filter(p => p.player_type !== 'manager');
  const awaySquad = awayPlayers.filter(p => p.player_type !== 'manager');
  const homeManagers = homePlayers.filter(p => p.player_type === 'manager');
  const awayManagers = awayPlayers.filter(p => p.player_type === 'manager');

  // Events by type
  const homeGoals   = matchEvents.filter(e => e.type === 'goal'        && e.team_id === home?.id);
  const awayGoals   = matchEvents.filter(e => e.type === 'goal'        && e.team_id === away?.id);
  const homeAssists = matchEvents.filter(e => e.type === 'assist'      && e.team_id === home?.id);
  const awayAssists = matchEvents.filter(e => e.type === 'assist'      && e.team_id === away?.id);
  const yellowCards = matchEvents.filter(e => e.type === 'yellow_card');
  const redCards    = matchEvents.filter(e => e.type === 'red_card');
  const penScored   = matchEvents.filter(e => e.type === 'penalty_scored');
  const penMissed   = matchEvents.filter(e => e.type === 'penalty_missed');
  const penSaved    = matchEvents.filter(e => e.type === 'penalty_saved');

  const allPlayers = [...homePlayers, ...awayPlayers];
  const maxSquad = Math.max(homeSquad.length, awaySquad.length, 7);

  const cell = (content, w = 'auto', center = false) => ({
    padding: '4px 6px', fontSize: '0.72rem', borderBottom: '1px solid var(--border)',
    width: w, textAlign: center ? 'center' : 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  });

  const sectionHead = (label) => (
    <div style={{ fontWeight: 900, fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: 1, margin: '14px 0 6px', padding: '4px 0', borderBottom: `2px solid ${COLORS.gold}` }}>
      {label}
    </div>
  );

  const EventRow = ({ label, events, teamId }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)', minHeight: 28 }}>
      <span style={{ fontWeight: 900, fontSize: '0.72rem', color: COLORS.gold, width: 14, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 4 }}>
        {events.filter(e => e.team_id === teamId).map(e => (
          <span key={e.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            {e.minute ? `${e.minute}'` : ''} {e.player_name || '?'}
            <button onClick={() => onDelete(e.id)} style={{ background: 'none', border: 'none', color: '#FF3D57', cursor: 'pointer', fontSize: '0.7rem', padding: 0, lineHeight: 1 }}>✕</button>
          </span>
        ))}
      </div>
    </div>
  );

  const CardRow = ({ type, label, color }) => {
    const cards = matchEvents.filter(e => e.type === type);
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 900, fontSize: '0.68rem', color, width: 70, flexShrink: 0, paddingTop: 3 }}>{label}</span>
        <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 4 }}>
          {cards.map(e => {
            const pl = allPlayers.find(p => p.id === e.player_id);
            const t = teamMap[e.team_id];
            return (
              <span key={e.id} style={{ background: color + '22', border: `1px solid ${color}55`, borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                #{pl?.number || '?'} {pl?.name || e.player_name || '?'} <span style={{ color: '#666', fontSize: '0.62rem' }}>({t?.short_name})</span>
                <button onClick={() => onDelete(e.id)} style={{ background: 'none', border: 'none', color: '#FF3D57', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>✕</button>
              </span>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <select value={cardSide} onChange={e => setCardSide(e.target.value)} style={{ padding: '4px 6px', fontSize: '0.68rem', borderRadius: 6 }}>
            <option value="home">{home?.short_name}</option>
            <option value="away">{away?.short_name}</option>
          </select>
          <select value={cardPid} onChange={e => setCardPid(e.target.value)} style={{ padding: '4px 6px', fontSize: '0.68rem', borderRadius: 6 }}>
            <option value="">Player</option>
            {(cardSide === 'home' ? homePlayers : awayPlayers).map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
          </select>
          <button onClick={() => { if (cardPid) { onAdd(type, cardPid, null); setCardPid(''); } }}
            style={{ padding: '4px 8px', background: color, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 800, fontSize: '0.68rem', cursor: 'pointer' }}>+</button>
        </div>
      </div>
    );
  };

  const penCount = (type, teamId) => matchEvents.filter(e => e.type === type && e.team_id === teamId).length;

  return (
    <div>
      {/* ── SQUAD ── */}
      {sectionHead('Squad')}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
          <thead>
            <tr style={{ background: 'var(--card)' }}>
              <th style={{ ...cell('60px', '60px', true), fontWeight: 900, color: '#888' }}>#</th>
              <th style={{ ...cell('auto'), fontWeight: 900, color: COLORS.gold }}>{home?.short_name || 'HOME'}</th>
              <th style={{ ...cell('60px', '60px', true), fontWeight: 900, color: '#888' }}>#</th>
              <th style={{ ...cell('auto'), fontWeight: 900, color: COLORS.gold }}>{away?.short_name || 'AWAY'}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxSquad }).map((_, i) => {
              const hp = homeSquad[i], ap = awaySquad[i];
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--card)' }}>
                  <td style={{ ...cell('60px', '60px', true), color: '#888' }}>{hp?.number ?? ''}</td>
                  <td style={cell('auto')}>{hp?.name ?? ''}</td>
                  <td style={{ ...cell('60px', '60px', true), color: '#888' }}>{ap?.number ?? ''}</td>
                  <td style={cell('auto')}>{ap?.name ?? ''}</td>
                </tr>
              );
            })}
            {/* Manager rows */}
            {(homeManagers.length > 0 || awayManagers.length > 0) && (
              <tr style={{ background: 'var(--card)', borderTop: `2px solid ${COLORS.gold}33` }}>
                <td style={{ ...cell('60px', '60px', true), color: '#888', fontSize: '0.62rem' }}>MGR</td>
                <td style={{ ...cell('auto'), fontStyle: 'italic', color: '#888' }}>{homeManagers.map(m => m.name).join(', ') || ''}</td>
                <td style={{ ...cell('60px', '60px', true), color: '#888', fontSize: '0.62rem' }}>MGR</td>
                <td style={{ ...cell('auto'), fontStyle: 'italic', color: '#888' }}>{awayManagers.map(m => m.name).join(', ') || ''}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── GOALS ── */}
      {sectionHead('Goals')}
      <div style={{ marginBottom: 8 }}>
        <EventRow label="G" events={matchEvents.filter(e => e.type === 'goal')}   teamId={home?.id} />
        <EventRow label="A" events={matchEvents.filter(e => e.type === 'assist')} teamId={home?.id} />
        <div style={{ fontSize: '0.62rem', color: '#888', padding: '2px 0 6px 20px' }}>{home?.short_name}</div>
        <EventRow label="G" events={matchEvents.filter(e => e.type === 'goal')}   teamId={away?.id} />
        <EventRow label="A" events={matchEvents.filter(e => e.type === 'assist')} teamId={away?.id} />
        <div style={{ fontSize: '0.62rem', color: '#888', padding: '2px 0 0 20px' }}>{away?.short_name}</div>
      </div>
      <GoalAssistLogger players={[...homePlayers, ...awayPlayers]} teamMap={teamMap} home={home} away={away} events={matchEvents} onAdd={onAdd} onDelete={onDelete} />

      {/* ── YELLOW CARDS ── */}
      {sectionHead('Yellow Cards')}
      <CardRow type="yellow_card" label="YELLOW" color="#FFD400" />

      {/* ── RED CARDS ── */}
      {sectionHead('Red Cards')}
      <CardRow type="red_card" label="RED" color="#FF3D57" />

      {/* ── PENALTY GOALS ── */}
      {isKnockout && sectionHead('Penalty Shootout')}
      {isKnockout && <PenaltyTable home={home} away={away} homePlayers={homePlayers} awayPlayers={awayPlayers} matchEvents={matchEvents} onAdd={onAdd} onDelete={onDelete} />}
    </div>
  );
}

// ─── PENALTY TABLE ───────────────────────────────────────────────────────────
function PenaltyTable({ home, away, homePlayers, awayPlayers, matchEvents, onAdd, onDelete }) {
  const [penPid,    setPenPid]    = React.useState({ home: '', away: '' });
  const [penResult, setPenResult] = React.useState({ home: 'penalty_scored', away: 'penalty_scored' });

  const penEvents = matchEvents.filter(e => ['penalty_scored','penalty_missed','penalty_saved'].includes(e.type));
  const homePens  = penEvents.filter(e => e.team_id === home?.id);
  const awayPens  = penEvents.filter(e => e.team_id === away?.id);

  const resultStyle = (type) => {
    if (type === 'penalty_scored') return { bg: '#00C85322', border: '#00C853', text: '#00C853', label: 'GOAL' };
    if (type === 'penalty_missed') return { bg: '#FF3D5722', border: '#FF3D57', text: '#FF3D57', label: 'MISS' };
    return { bg: '#448AFF22', border: '#448AFF', text: '#448AFF', label: 'SAVED' };
  };

  const addPen = async (side) => {
    const pid = penPid[side];
    const type = penResult[side];
    const team = side === 'home' ? home : away;
    if (!pid) return;
    await onAdd(type, pid, null, team?.id);
    setPenPid(prev => ({ ...prev, [side]: '' }));
  };

  const PenCol = ({ side, team, teamPlayers, pens }) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 900, fontSize: '0.78rem', color: COLORS.gold, marginBottom: 8, textAlign: 'center' }}>
        {team?.short_name || side}
      </div>

      {/* Table of penalties taken */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead>
          <tr style={{ background: 'var(--card)' }}>
            <th style={{ padding: '4px 6px', fontSize: '0.65rem', fontWeight: 800, color: '#888', textAlign: 'center', borderBottom: '1px solid var(--border)', width: 32 }}>#</th>
            <th style={{ padding: '4px 6px', fontSize: '0.65rem', fontWeight: 800, color: '#888', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Player</th>
            <th style={{ padding: '4px 6px', fontSize: '0.65rem', fontWeight: 800, color: '#888', textAlign: 'center', borderBottom: '1px solid var(--border)', width: 52 }}>Result</th>
            <th style={{ padding: '4px 6px', width: 20, borderBottom: '1px solid var(--border)' }}></th>
          </tr>
        </thead>
        <tbody>
          {pens.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '8px 6px', fontSize: '0.68rem', color: '#666', textAlign: 'center', fontStyle: 'italic' }}>No penalties yet</td></tr>
          )}
          {pens.map((e, i) => {
            const pl = teamPlayers.find(p => p.id === e.player_id);
            const rs = resultStyle(e.type);
            return (
              <tr key={e.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--card)' }}>
                <td style={{ padding: '5px 6px', fontSize: '0.72rem', color: '#aaa', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                  {pl?.number ?? '?'}
                </td>
                <td style={{ padding: '5px 6px', fontSize: '0.72rem', borderBottom: '1px solid var(--border)' }}>
                  {pl?.name || e.player_name || '?'}
                </td>
                <td style={{ padding: '5px 6px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ background: rs.bg, border: `1px solid ${rs.border}`, color: rs.text, borderRadius: 6, padding: '2px 6px', fontSize: '0.62rem', fontWeight: 900 }}>
                    {rs.label}
                  </span>
                </td>
                <td style={{ padding: '5px 4px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                  <button onClick={() => onDelete(e.id)} style={{ background: 'none', border: 'none', color: '#FF3D57', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1, padding: 0 }}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Add penalty row */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <select value={penPid[side]} onChange={e => setPenPid(prev => ({ ...prev, [side]: e.target.value }))}
          style={{ flex: 1, padding: '5px 6px', fontSize: '0.68rem', borderRadius: 7, minWidth: 0 }}>
          <option value="">Player</option>
          {teamPlayers.filter(p => p.player_type !== 'manager').map(p => (
            <option key={p.id} value={p.id}>#{p.number} {p.name}</option>
          ))}
        </select>
        <select value={penResult[side]} onChange={e => setPenResult(prev => ({ ...prev, [side]: e.target.value }))}
          style={{ padding: '5px 6px', fontSize: '0.68rem', borderRadius: 7 }}>
          <option value="penalty_scored">Goal</option>
          <option value="penalty_missed">Miss</option>
          <option value="penalty_saved">Saved</option>
        </select>
        <button onClick={() => addPen(side)} disabled={!penPid[side]}
          style={{ padding: '5px 10px', background: COLORS.gold, color: '#000', border: 'none', borderRadius: 7, fontWeight: 900, fontSize: '0.75rem', cursor: penPid[side] ? 'pointer' : 'not-allowed', opacity: penPid[side] ? 1 : 0.5 }}>
          +
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <PenCol side="home" team={home} teamPlayers={homePlayers} pens={homePens} />
      <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
      <PenCol side="away" team={away} teamPlayers={awayPlayers} pens={awayPens} />
    </div>
  );
}

function GoalAssistLogger({ players, teamMap, home, away, events, onAdd, onDelete }) {
  const [type, setType]   = React.useState('goal');
  const [pid,  setPid]    = React.useState('');
  const [min,  setMin]    = React.useState('');

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 6 }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#888', marginBottom: 8 }}>LOG EVENT</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={type} onChange={e => setType(e.target.value)} style={{ padding: '6px 8px', fontSize: '0.72rem', borderRadius: 8 }}>
          <option value="goal">Goal (G)</option>
          <option value="assist">Assist (A)</option>
        </select>
        <select value={pid} onChange={e => setPid(e.target.value)} style={{ flex: 1, padding: '6px 8px', fontSize: '0.72rem', borderRadius: 8, minWidth: 100 }}>
          <option value="">— Player —</option>
          <optgroup label={home?.short_name || 'Home'}>
            {players.filter(p => p.team_id === home?.id).map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
          </optgroup>
          <optgroup label={away?.short_name || 'Away'}>
            {players.filter(p => p.team_id === away?.id).map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
          </optgroup>
        </select>
        <input type="number" min="1" max="90" placeholder="min" value={min} onChange={e => setMin(e.target.value)}
          style={{ width: 52, padding: '6px 4px', fontSize: '0.72rem', textAlign: 'center', borderRadius: 8 }} />
        <button style={{ padding: '6px 14px', background: COLORS.gold, color: '#000', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
          onClick={() => { if (pid) { onAdd(type, pid, min); setPid(''); setMin(''); } }}>
          + Add
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AdminMatchPage({ data, matchId, navigate }) {
  const { matches, teamMap, players, events, reload, setMatches, setEvents } = data;
  const match = matches.find(m => m.id === matchId);

  const [section,   setSection]   = useState('score');
  const [busy,      setBusy]      = useState(false);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [homePen,   setHomePen]   = useState('');
  const [awayPen,   setAwayPen]   = useState('');
  const [ground,    setGround]    = useState('');
  const [matchTime, setMatchTime] = useState('');

  useEffect(() => {
    if (match) {
      // Default to 0 if match is live or played so admin only needs to change the scoring team
      const defaultScore = (match.status === 'live' || match.played) ? 0 : '';
      setHomeScore(match.home_score ?? defaultScore);
      setAwayScore(match.away_score ?? defaultScore);
      setHomePen(match.home_penalties ?? '');
      setAwayPen(match.away_penalties ?? '');
      setGround(match.ground || '');
      setMatchTime(match.match_time || '');
    }
  }, [matchId]);

  if (!match) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>Match not found</div>
        <button className="btn btn-gold" onClick={() => navigate('admin')}>Back to Admin</button>
      </div>
    );
  }

  const home       = teamMap[match.home_team_id];
  const away       = teamMap[match.away_team_id];
  const isKnockout = match.stage !== 'group';
  const mPlayers   = players.filter(p => p.team_id === match.home_team_id || p.team_id === match.away_team_id);
  const matchEvents = (events || []).filter(e => e.match_id === matchId);

  const stageBadge = match.stage === 'group'
    ? `Group ${match.group_letter} · Match ${match.match_number}`
    : (match.label || match.stage);

  // ── handlers ──────────────────────────────────────────────────────────────
  const saveScore = async () => {
    setBusy(true);
    try {
      const updates = { id: matchId, ground: ground || null, match_time: matchTime || null };
      if (homeScore !== '' || awayScore !== '') {
        const hs = parseInt(homeScore || '0');
        const as = parseInt(awayScore || '0');
        updates.home_score = hs; updates.away_score = as; updates.played = true;
        if (isKnockout && homePen !== '' && awayPen !== '') {
          const hp = parseInt(homePen), ap = parseInt(awayPen);
          updates.home_penalties = hp; updates.away_penalties = ap;
          updates.winner_team_id = hp > ap ? match.home_team_id : ap > hp ? match.away_team_id : null;
        } else {
          updates.winner_team_id = hs > as ? match.home_team_id : as > hs ? match.away_team_id : null;
        }
      } else {
        updates.played = false; updates.home_score = null; updates.away_score = null;
        updates.home_penalties = null; updates.away_penalties = null; updates.winner_team_id = null;
      }
      const saved = await db.upsertMatch(updates);
      // Immediately update local state so all views reflect the change
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, ...updates, ...(saved || {}) } : m));
      await db.checkAndAutoAdvance().catch(() => {});
      await reload();
      toast('Match updated!', 'success');
    } catch (e) {
      console.error('saveScore error:', e);
      toast(e?.message || JSON.stringify(e) || 'Save failed', 'error');
    }
    setBusy(false);
  };

  const handleStart = async () => {
    try {
      await db.updateMatchStatus(matchId, 'live');
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'live', started_at: new Date().toISOString() } : m));
      await reload(); toast('Match started!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleEnd = async () => {
    try {
      await db.updateMatchStatus(matchId, 'finished');
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'finished' } : m));
      await reload(); toast('Match ended!', 'info');
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset this match? This will clear the score, status and all match events.')) return;
    try {
      const resetData = {
        id: matchId, home_score: null, away_score: null,
        home_penalties: null, away_penalties: null,
        played: false, winner_team_id: null, status: 'pending',
        started_at: null, ended_at: null,
      };
      await db.upsertMatch(resetData);
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, ...resetData } : m));
      const matchEvts = (events || []).filter(e => e.match_id === matchId);
      await Promise.all(matchEvts.map(e => db.deleteEvent(e.id)));
      setEvents(prev => prev.filter(e => e.match_id !== matchId));
      setHomeScore(''); setAwayScore(''); setHomePen(''); setAwayPen('');
      await reload();
      toast('Match reset', 'info');
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleAddEvent = async (type, pid, min, overrideTeamId = null) => {
    const player = pid ? players.find(p => p.id === pid) : null;
    const teamId = overrideTeamId || player?.team_id;
    if (!pid && !overrideTeamId) { toast('Select a player', 'error'); return; }
    try {
      const newEvent = await db.insertEvent({ match_id: matchId, type, player_id: pid || null, team_id: teamId, player_name: player?.name || null, minute: min ? parseInt(min) : null });
      if (newEvent) setEvents(prev => [...prev, newEvent]);
      await reload(); toast('Event logged!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await db.deleteEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
      await reload(); toast('Event removed', 'info');
    } catch (e) { toast(e.message, 'error'); }
  };

  const sections = [
    { key: 'score',      label: 'Score' },
  ];

  return (
    <div className="animate-fade">
      {/* Back */}
      <button className="tappable" onClick={() => navigate('admin')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
          background: 'transparent', color: '#888', fontWeight: 700, fontSize: '0.82rem' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Admin Panel
      </button>

      {/* Match header */}
      <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          {stageBadge}
          {match.status === 'live' && (
            <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3, color: '#00C853' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00C853', display: 'inline-block', animation: 'pulse 1s infinite' }} />
              LIVE
            </span>
          )}
          {match.status === 'finished' && (
            <span style={{ marginLeft: 8, color: '#555' }}>· Finished</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <TeamLogo team={home} size={44} />
            <span style={{ fontWeight: 800, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {home?.name || 'TBD'}
            </span>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'center', padding: '8px 14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: match.played ? '#fff' : '#555', letterSpacing: 2 }}>
              {match.played ? `${match.home_score}:${match.away_score}` : '–:–'}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
              {away?.name || 'TBD'}
            </span>
            <TeamLogo team={away} size={44} />
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', background: 'var(--card)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {sections.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} className="tappable"
            style={{ flex: '1 0 auto', padding: '11px 8px', fontSize: '0.68rem', fontWeight: 800,
              background: 'transparent', color: section === s.key ? COLORS.gold : '#666',
              borderBottom: section === s.key ? `2px solid ${COLORS.gold}` : '2px solid transparent',
              whiteSpace: 'nowrap' }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>

        {/* ── SCORE ─────────────────────────────────────────────────────────── */}
        {section === 'score' && (
          <div>
            <div className="kcard" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>Match Score</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#666', marginBottom: 4 }}>
                    {home?.short_name || 'HOME'}
                  </div>
                  <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)}
                    style={{ width: '100%', textAlign: 'center', padding: '12px 4px', fontWeight: 900, fontSize: '1.5rem', borderRadius: 10 }} />
                </div>
                <span style={{ color: '#555', fontWeight: 900, fontSize: '1.3rem', flexShrink: 0 }}>–</span>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#666', marginBottom: 4 }}>
                    {away?.short_name || 'AWAY'}
                  </div>
                  <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)}
                    style={{ width: '100%', textAlign: 'center', padding: '12px 4px', fontWeight: 900, fontSize: '1.5rem', borderRadius: 10 }} />
                </div>
              </div>

              {isKnockout && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#666', marginBottom: 6 }}>PENALTY SHOOTOUT (if needed)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min="0" value={homePen} onChange={e => setHomePen(e.target.value)}
                      placeholder="–" style={{ flex: 1, textAlign: 'center', padding: '8px', fontWeight: 700 }} />
                    <span style={{ color: '#555' }}>–</span>
                    <input type="number" min="0" value={awayPen} onChange={e => setAwayPen(e.target.value)}
                      placeholder="–" style={{ flex: 1, textAlign: 'center', padding: '8px', fontWeight: 700 }} />
                  </div>
                  <div style={{ fontSize: '0.58rem', color: '#555', marginTop: 4 }}>Leave blank if no penalty shootout</div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', display: 'block', marginBottom: 3 }}>Ground</label>
                  <select value={ground} onChange={e => setGround(e.target.value)} style={{ padding: '8px', fontSize: '0.72rem' }}>
                    <option value="">None</option>
                    <option value="1">Ground 1</option>
                    <option value="2">Ground 2</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', display: 'block', marginBottom: 3 }}>Match Time</label>
                  <input type="text" placeholder="18:30" value={matchTime} onChange={e => setMatchTime(e.target.value)}
                    style={{ padding: '8px', fontSize: '0.72rem' }} />
                </div>
              </div>

              <button onClick={saveScore} disabled={busy}
                style={{ width: '100%', padding: '12px', fontWeight: 900, fontSize: '0.85rem', borderRadius: 10,
                  background: COLORS.gold, color: COLORS.dark, border: 'none', cursor: 'pointer' }}>
                {busy ? 'Saving…' : 'Save Score & Details'}
              </button>

              <button onClick={handleReset}
                style={{ width: '100%', marginTop: 8, padding: '10px', fontWeight: 800, fontSize: '0.78rem', borderRadius: 10,
                  background: 'transparent', color: '#FF3D57', border: '1px solid #FF3D5755', cursor: 'pointer' }}>
                Reset Match
              </button>
            </div>

            {/* Match Status — only shown while match is not yet finished */}
            {match.status !== 'finished' && (
              <div className="kcard" style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 12 }}>Match Status</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {match.status !== 'live' && (
                    <button onClick={handleStart}
                      style={{ flex: 1, padding: '11px', fontWeight: 800, fontSize: '0.8rem', borderRadius: 10,
                        background: 'rgba(0,200,83,0.12)', color: '#00C853', border: '1px solid #00C85355', cursor: 'pointer' }}>
                      Start Match
                    </button>
                  )}
                  {match.status === 'live' && (<>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 800, color: '#00C853' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00C853', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                      LIVE NOW
                    </div>
                    <button onClick={handleEnd}
                      style={{ padding: '11px 18px', fontWeight: 800, fontSize: '0.8rem', borderRadius: 10,
                        background: 'rgba(255,61,87,0.12)', color: '#FF3D57', border: '1px solid #FF3D5755', cursor: 'pointer' }}>
                      End Match
                    </button>
                  </>)}
                </div>
              </div>
            )}

            {/* Match Sheet — Squad, Goals, Cards, Penalties */}
            <div className="kcard" style={{ padding: 16, marginTop: 12 }}>
              <MatchSheet
                home={home}
                away={away}
                players={mPlayers}
                matchEvents={matchEvents}
                teamMap={teamMap}
                onAdd={handleAddEvent}
                onDelete={handleDeleteEvent}
                isKnockout={isKnockout}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

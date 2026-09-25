// ─── Shot Map Component ──────────────────────────────────────────────────────
// Handles both recording (admin) and viewing (public) of shot data.
// Coordinates: x 0-100 (width), y 0-150 (height) → 1 unit = 0.4m (40m × 60m pitch)
import React, { useState, useRef, useCallback } from 'react';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
export const OUTCOME_COLORS = {
  goal:             '#00C853',
  saved_gripped:    '#448AFF',
  saved_pushed:     '#00B0FF',
  block_on_target:  '#FF9100',
  block:            '#FF6D00',
};

export const OUTCOME_LABELS = {
  goal:             'Goal',
  saved_gripped:    'Saved (Gripped)',
  saved_pushed:     'Saved (Pushed Out)',
  block_on_target:  'Block (On Target)',
  block:            'Block',
};

// ─── xG MODEL (7-a-side) ─────────────────────────────────────────────────────
// Pitch: 40m wide × 60m long → 1 unit = 0.4m
// Goal: 5m wide (12.5 units) centred at x=50, at y=0 or y=150
export function calcXG(shotX, shotY, attackingUp) {
  const U = 0.4; // units → metres
  const GOAL_HALF = 6.25; // half goal width in units (2.5m / 0.4)
  const goalY = attackingUp ? 0 : 150;

  const dy = Math.abs(shotY - goalY) * U;
  const dx = (shotX - 50) * U;

  if (dy <= 0) return 0.96;

  const leftPost  = (shotX - 50 - GOAL_HALF) * U;
  const rightPost = (shotX - 50 + GOAL_HALF) * U;
  const angle = Math.abs(Math.atan2(dy, leftPost) - Math.atan2(dy, rightPost));

  const dist = Math.sqrt(dx * dx + dy * dy);
  const raw  = Math.exp(-dist / 12) * (angle / Math.PI) * 3.0;
  return Math.round(Math.min(0.96, Math.max(0.01, raw)) * 100) / 100;
}

// ─── PITCH SVG MARKINGS (dark theme) ─────────────────────────────────────────
// viewBox="0 0 100 150" — goal at TOP (y=0) and BOTTOM (y=150)
const DARK_PITCH_BG = '#0d1f2d';
const DARK_LINE_HI  = 'rgba(255,255,255,0.30)';
const DARK_LINE_LO  = 'rgba(255,255,255,0.14)';

function PitchMarkings({ halfPitchOnly = false }) {
  const h = halfPitchOnly ? 75 : 150;
  return (
    <g>
      {/* Dark background */}
      <rect width="100" height={h} fill={DARK_PITCH_BG} />
      {/* Subtle alternating stripes */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x="0" y={i * h / 5} width="100" height={h / 10}
          fill="rgba(255,255,255,0.018)" />
      ))}

      {/* Outer boundary */}
      <rect x="1" y="1" width="98" height={h - 2}
        fill="none" stroke={DARK_LINE_HI} strokeWidth="0.7" />

      {/* ── TOP HALF ── */}
      <rect x="17.5" y="1" width="65" height="30"
        fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
      <rect x="32.5" y="1" width="35" height="10"
        fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
      <circle cx="50" cy="22.5" r="0.9" fill={DARK_LINE_HI} />
      <path d="M 41.5 31 A 12 12 0 0 0 58.5 31"
        fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
      <rect x="43.75" y="-3" width="12.5" height="4"
        fill="rgba(255,255,255,0.07)" stroke={DARK_LINE_HI} strokeWidth="0.7" />

      {!halfPitchOnly && (<>
        <line x1="1" y1="75" x2="99" y2="75" stroke={DARK_LINE_HI} strokeWidth="0.5" />
        <circle cx="50" cy="75" r="10" fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
        <circle cx="50" cy="75" r="0.9" fill={DARK_LINE_HI} />

        {/* ── BOTTOM HALF ── */}
        <rect x="17.5" y="119" width="65" height="30"
          fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
        <rect x="32.5" y="139" width="35" height="10"
          fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
        <circle cx="50" cy="127.5" r="0.9" fill={DARK_LINE_HI} />
        <path d="M 41.5 119 A 12 12 0 0 1 58.5 119"
          fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
        <rect x="43.75" y="149" width="12.5" height="4"
          fill="rgba(255,255,255,0.07)" stroke={DARK_LINE_HI} strokeWidth="0.7" />
      </>)}
    </g>
  );
}

// ─── SINGLE SHOT ARROW ───────────────────────────────────────────────────────
function ShotArrow({ s, transform, onClick, showXG, players = [], homeTeam, awayTeam, teamMap = {} }) {
  const [hovered, setHovered] = useState(false);

  const color  = OUTCOME_COLORS[s.outcome] || '#aaa';
  const ex     = s.end_x ?? s.shot_x;
  const ey     = s.end_y ?? s.shot_y;
  const isGoal = s.outcome === 'goal';

  const ax = ex - s.shot_x, ay = ey - s.shot_y;
  const len = Math.sqrt(ax * ax + ay * ay);
  const cr  = isGoal ? 2.5 : 2.0;
  const lx1 = len > 0 ? s.shot_x + (ax / len) * (cr + 0.5) : s.shot_x;
  const ly1 = len > 0 ? s.shot_y + (ay / len) * (cr + 0.5) : s.shot_y;

  // Tooltip data
  const pl   = players.find(p => p.id === s.player_id);
  const team = teamMap[s.team_id] || (s.team_id === homeTeam?.id ? homeTeam : awayTeam);
  const tipLines = [
    pl?.name || null,
    [team?.short_name, pl ? `#${pl.number}` : null].filter(Boolean).join('  '),
    s.minute ? `${s.minute} min` : null,
    s.xg     ? `xG: ${s.xg}`    : null,
  ].filter(Boolean);
  const tipW = 36, tipLineH = 5.5;
  const tipH = tipLines.length * tipLineH + 5;
  const tipX = s.shot_x + 4 > 66 ? s.shot_x - tipW - 4 : s.shot_x + 4;
  const topOfArrow = Math.min(s.shot_y, ey);
  const tipY = Math.max(1, topOfArrow - tipH - 5);

  return (
    <g transform={transform} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Trail — rendered first, sits below everything */}
      {len > 1 && (
        <line x1={lx1} y1={ly1} x2={ex} y2={ey}
          stroke={color} strokeWidth={isGoal ? 1.6 : 1.0}
          strokeDasharray={isGoal ? 'none' : '2.5,1.5'}
          opacity={0.85} />
      )}
      {/* Open arrow chevron at end point */}
      {len > 1 && (() => {
        const angle = Math.atan2(ay, ax);
        const ahl = 5, ang = 0.46;
        const x1 = ex - ahl * Math.cos(angle - ang);
        const y1 = ey - ahl * Math.sin(angle - ang);
        const x2 = ex - ahl * Math.cos(angle + ang);
        const y2 = ey - ahl * Math.sin(angle + ang);
        return (
          <polyline points={`${x1},${y1} ${ex},${ey} ${x2},${y2}`}
            fill="none" stroke={color}
            strokeWidth={isGoal ? 1.8 : 1.2}
            strokeLinejoin="round" strokeLinecap="round" opacity={0.92} />
        );
      })()}
      {/* Origin dot — on top, with hover detection */}
      <circle cx={s.shot_x} cy={s.shot_y} r={cr + 2} fill="transparent"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />
      <circle cx={s.shot_x} cy={s.shot_y} r={cr} fill={color} opacity={0.9}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />
      {isGoal && <circle cx={s.shot_x} cy={s.shot_y} r={cr + 1.5} fill="none" stroke={color} strokeWidth="0.8" opacity={0.5} />}
      {/* xG label (hidden while tooltip is showing) */}
      {showXG && s.xg && !hovered && (
        <text x={s.shot_x + cr + 1} y={s.shot_y - 1} fill={color} fontSize="3.5" fontWeight="bold" opacity={0.9}>
          {s.xg}
        </text>
      )}
      {/* Hover tooltip */}
      {hovered && tipLines.length > 0 && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="1.5"
            fill="rgba(10,10,10,0.94)" stroke="rgba(255,212,0,0.55)" strokeWidth="0.6" />
          {tipLines.map((line, i) => (
            <text key={i} x={tipX + 2.5} y={tipY + i * tipLineH + 5} fontSize="3.5"
              fill={i === 0 ? '#fff' : i === tipLines.length - 1 ? '#FFD400' : '#aaa'}
              fontWeight={i === 0 ? '700' : '400'}>
              {line}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}

// ─── RECORDER (ADMIN) ────────────────────────────────────────────────────────
export function ShotMapRecorder({ matchId, homeTeam, awayTeam, players, existingShots = [], onSave, onDelete }) {
  const [side, setSide]         = useState('home');
  const [step, setStep]         = useState('idle'); // idle | place_shot | place_end | outcome
  const [shotStart, setShotStart] = useState(null);
  const [shotEnd,   setShotEnd]   = useState(null);
  const [outcome,   setOutcome]   = useState('goal');
  const [playerId,  setPlayerId]  = useState('');
  const [minute,    setMinute]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [showXG,    setShowXG]    = useState(true);
  const svgRef = useRef(null);

  const attackingUp = side === 'home';
  const team = side === 'home' ? homeTeam : awayTeam;
  const teamPlayers = players.filter(p => p.team_id === team?.id);
  const matchShots = existingShots.filter(s => s.match_id === matchId);

  const svgCoords = useCallback((e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 150;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(150, y)) };
  }, []);

  const handlePitchClick = useCallback((e) => {
    const c = svgCoords(e);
    if (!c) return;
    if (step === 'place_shot') { setShotStart(c); setStep('place_end'); }
    else if (step === 'place_end') { setShotEnd(c); setStep('outcome'); }
  }, [step, svgCoords]);

  const reset = () => { setShotStart(null); setShotEnd(null); setStep('idle'); setPlayerId(''); setMinute(''); };

  const handleSave = async () => {
    if (!shotStart) return;
    setSaving(true);
    await onSave({
      match_id:     matchId,
      team_id:      team?.id,
      player_id:    playerId || null,
      shot_x:       shotStart.x,
      shot_y:       shotStart.y,
      end_x:        shotEnd?.x ?? null,
      end_y:        shotEnd?.y ?? null,
      outcome,
      xg:           calcXG(shotStart.x, shotStart.y, attackingUp),
      minute:       minute ? parseInt(minute) : null,
      attacking_up: attackingUp,
    });
    reset();
    setSaving(false);
  };


  const xgInfo = calcXG(shotStart?.x ?? 50, shotStart?.y ?? 75, attackingUp);

  return (
    <div>
      {/* Team toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[{ v: 'home', t: homeTeam }, { v: 'away', t: awayTeam }].map(({ v, t }) => (
          <button key={v} onClick={() => { setSide(v); reset(); }}
            style={{ flex: 1, padding: '7px 6px', fontSize: '0.72rem', fontWeight: 800, borderRadius: 8,
              border: `2px solid ${side === v ? '#FFD400' : 'var(--border)'}`,
              background: side === v ? 'rgba(255,212,0,0.12)' : 'transparent',
              color: side === v ? '#FFD400' : '#666', cursor: 'pointer' }}>
            {t?.short_name || v.toUpperCase()}
          </button>
        ))}
        <button onClick={() => setShowXG(x => !x)}
          style={{ padding: '7px 10px', fontSize: '0.68rem', fontWeight: 700, borderRadius: 8,
            border: '1px solid var(--border)', background: showXG ? 'rgba(255,212,0,0.08)' : 'transparent',
            color: showXG ? '#FFD400' : '#555', cursor: 'pointer' }}>
          xG
        </button>
      </div>

      {/* Instruction */}
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#666', marginBottom: 6, textAlign: 'center' }}>
        {step === 'idle'      && 'Click "Record Shot" then click pitch'}
        {step === 'place_shot' && '👆 Click shoot location on pitch'}
        {step === 'place_end'  && `📍 Shot placed — click end location`}
        {step === 'outcome'    && '✅ Select outcome then save'}
      </div>

      {/* SVG Pitch */}
      <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.08)',
        cursor: (step === 'place_shot' || step === 'place_end') ? 'crosshair' : 'default' }}>
        <svg ref={svgRef} viewBox="0 0 100 150" style={{ display: 'block', width: '100%' }}
          onClick={(step === 'place_shot' || step === 'place_end') ? handlePitchClick : undefined}>
          <PitchMarkings halfPitchOnly={false} />

          {/* Attacking-direction label */}
          <text x="50" y="10" textAnchor="middle" fill="rgba(255,255,255,0.35)"
            fontSize="3.5" fontWeight="bold">
            ↑ {side === 'home' ? (homeTeam?.short_name || 'HOME') : (awayTeam?.short_name || 'AWAY')} attacks this way
          </text>

          {/* Existing shots */}
          {matchShots.map(s => (
            <ShotArrow key={s.id} s={s} showXG={showXG}
              onClick={onDelete ? () => { if (confirm('Remove this shot?')) onDelete(s.id); } : undefined} />
          ))}

          {/* Live preview: shot start */}
          {shotStart && (
            <g>
              <circle cx={shotStart.x} cy={shotStart.y} r="3" fill="#FFD400" opacity={0.95} />
              <circle cx={shotStart.x} cy={shotStart.y} r="5.5" fill="none" stroke="#FFD400" strokeWidth="0.8" opacity={0.5} />
            </g>
          )}
          {/* Live preview: end + arrow */}
          {shotStart && shotEnd && (
            <ShotArrow s={{ ...shotStart, shot_x: shotStart.x, shot_y: shotStart.y,
              end_x: shotEnd.x, end_y: shotEnd.y, outcome, xg: null }}
              showXG={false} />
          )}
        </svg>
      </div>

      {/* Outcome panel */}
      {step === 'outcome' && (
        <div style={{ marginTop: 10, padding: 12, background: 'var(--card2)', borderRadius: 10,
          border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#888', marginBottom: 6 }}>OUTCOME</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
              <button key={key} onClick={() => setOutcome(key)}
                style={{ padding: '5px 9px', fontSize: '0.67rem', fontWeight: 700, borderRadius: 6,
                  border: `1.5px solid ${outcome === key ? OUTCOME_COLORS[key] : 'var(--border)'}`,
                  background: outcome === key ? OUTCOME_COLORS[key] + '22' : 'transparent',
                  color: outcome === key ? OUTCOME_COLORS[key] : '#777', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <select value={playerId} onChange={e => setPlayerId(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.72rem' }}>
              <option value="">Shooter (optional)</option>
              {teamPlayers.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
            </select>
            <input type="number" min="1" max="90" placeholder="min" value={minute}
              onChange={e => setMinute(e.target.value)}
              style={{ width: 52, padding: '6px 4px', fontSize: '0.72rem', textAlign: 'center' }} />
          </div>

          <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: 10 }}>
            Auto xG: <strong style={{ color: '#FFD400', fontSize: '0.82rem' }}>{xgInfo}</strong>
            <span style={{ marginLeft: 6, color: '#555' }}>based on shot location &amp; angle</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 1, padding: '9px', fontWeight: 800, fontSize: '0.78rem', borderRadius: 8,
                background: '#FFD400', color: '#0D0D0D', border: 'none', cursor: 'pointer' }}>
              {saving ? 'Saving…' : '💾 Save Shot'}
            </button>
            <button onClick={reset}
              style={{ padding: '9px 14px', fontWeight: 700, fontSize: '0.75rem', borderRadius: 8,
                background: 'transparent', color: '#777', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'idle' && (
        <button onClick={() => setStep('place_shot')}
          style={{ width: '100%', marginTop: 8, padding: '9px', fontWeight: 800, fontSize: '0.78rem',
            borderRadius: 8, background: 'rgba(255,212,0,0.08)', color: '#FFD400',
            border: '1.5px dashed #FFD400', cursor: 'pointer' }}>
          + Record New Shot
        </button>
      )}

      {/* Shot log */}
      {matchShots.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', marginBottom: 6 }}>
            SHOTS LOGGED ({matchShots.length})
          </div>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            {matchShots.map(s => {
              const p = players.find(x => x.id === s.player_id);
              const t = s.team_id === homeTeam?.id ? homeTeam : awayTeam;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0',
                  borderBottom: '1px solid var(--border)', fontSize: '0.72rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: OUTCOME_COLORS[s.outcome] || '#666' }} />
                  <span style={{ color: '#888', flexShrink: 0 }}>{t?.short_name}</span>
                  <span style={{ flex: 1, color: '#bbb' }}>{p?.name || '—'}</span>
                  {s.minute && <span style={{ color: '#666' }}>{s.minute}'</span>}
                  <span style={{ color: '#FFD400', fontWeight: 800 }}>xG {s.xg}</span>
                  {onDelete && (
                    <button onClick={() => { if (confirm('Remove shot?')) onDelete(s.id); }}
                      style={{ background: 'transparent', border: 'none', color: '#FF3D57', cursor: 'pointer', padding: '0 2px' }}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VIEWER (PUBLIC) ─────────────────────────────────────────────────────────
export function ShotMapView({ shots, homeTeam, awayTeam, players = [] }) {
  const [filter, setFilter] = useState('all');
  const [showXG, setShowXG] = useState(true);

  if (!shots || shots.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: '0.78rem' }}>
        No shot data recorded for this match.
      </div>
    );
  }

  const homeShots = shots.filter(s => s.team_id === homeTeam?.id);
  const awayShots = shots.filter(s => s.team_id === awayTeam?.id);
  const homeXG = homeShots.reduce((sum, s) => sum + (s.xg || 0), 0);
  const awayXG = awayShots.reduce((sum, s) => sum + (s.xg || 0), 0);

  const filtered = shots.filter(s => {
    if (filter === 'home') return s.team_id === homeTeam?.id;
    if (filter === 'away') return s.team_id === awayTeam?.id;
    if (filter === 'goal') return s.outcome === 'goal';
    return true;
  });

  const display = filtered;

  return (
    <div>
      {/* xG summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#00C853' }}>{homeXG.toFixed(2)}</div>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#888', textTransform: 'uppercase' }}>
            {homeTeam?.short_name} xG
          </div>
          <div style={{ fontSize: '0.6rem', color: '#555' }}>{homeShots.length} shots</div>
        </div>
        <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#555' }}>vs</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#448AFF' }}>{awayXG.toFixed(2)}</div>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#888', textTransform: 'uppercase' }}>
            {awayTeam?.short_name} xG
          </div>
          <div style={{ fontSize: '0.6rem', color: '#555' }}>{awayShots.length} shots</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {[
          { k: 'all',  l: 'All Shots' },
          { k: 'home', l: homeTeam?.short_name || 'Home' },
          { k: 'away', l: awayTeam?.short_name || 'Away' },
          { k: 'goal', l: 'Goals' },
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            style={{ padding: '4px 9px', fontSize: '0.65rem', fontWeight: 700, borderRadius: 6,
              border: `1px solid ${filter === f.k ? '#FFD400' : 'var(--border)'}`,
              background: filter === f.k ? 'rgba(255,212,0,0.1)' : 'transparent',
              color: filter === f.k ? '#FFD400' : '#777', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {f.l}
          </button>
        ))}
        <button onClick={() => setShowXG(x => !x)}
          style={{ padding: '4px 9px', fontSize: '0.65rem', fontWeight: 700, borderRadius: 6,
            border: `1px solid ${showXG ? '#FFD400' : 'var(--border)'}`,
            background: showXG ? 'rgba(255,212,0,0.08)' : 'transparent',
            color: showXG ? '#FFD400' : '#777', cursor: 'pointer' }}>
          xG labels
        </button>
      </div>

      {/* Pitch */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <svg viewBox="0 0 100 150" style={{ display: 'block', width: '100%' }}>
          <PitchMarkings />
          {display.map(s => <ShotArrow key={s.id} s={s} showXG={showXG} players={players} homeTeam={homeTeam} awayTeam={awayTeam} />)}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {Object.entries(OUTCOME_LABELS).map(([k, l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', color: '#666' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: OUTCOME_COLORS[k], flexShrink: 0 }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TEAM SHOT MAP (for TeamView) ────────────────────────────────────────────
// Single pitch: top half = shots taken (attacking toward y=0),
//               bottom half = shots conceded (opponents attacking toward y=150).
// Shots are mirrored if they were recorded attacking the wrong direction.

function flipShot(s) {
  return {
    ...s,
    shot_x: 100 - s.shot_x,
    shot_y: 150 - s.shot_y,
    end_x:  s.end_x  != null ? 100 - s.end_x  : s.end_x,
    end_y:  s.end_y  != null ? 150 - s.end_y  : s.end_y,
  };
}

// Normalize team's own shots to attack UP (shot_y < 75 means top half = attacking up)
function normalizeAttackingUp(s) {
  return s.shot_y > 75 ? flipShot(s) : s;
}

// Normalize conceded shots so opponents attack DOWN (shot_y > 75 means bottom half)
function normalizeAttackingDown(s) {
  return s.shot_y < 75 ? flipShot(s) : s;
}

export function TeamShotMap({ shots, team, players = [], matches = [], teamMap = {} }) {
  const teamShots    = shots.filter(s => s.team_id === team?.id);
  const teamMatchIds = new Set(
    matches.filter(m => m.home_team_id === team?.id || m.away_team_id === team?.id).map(m => m.id)
  );
  const concededShots = shots.filter(s => teamMatchIds.has(s.match_id) && s.team_id !== team?.id);

  if (teamShots.length === 0 && concededShots.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#555', fontSize: '0.78rem' }}>
        No shot data for {team?.name} yet.
      </div>
    );
  }

  const xgFor     = teamShots.reduce((s, x) => s + (x.xg || 0), 0);
  const goalsFor  = teamShots.filter(s => s.outcome === 'goal').length;
  const xgAgainst = concededShots.reduce((s, x) => s + (x.xg || 0), 0);
  const goalsCon  = concededShots.filter(s => s.outcome === 'goal').length;

  const normTaken    = teamShots.map(normalizeAttackingUp);
  const normConceded = concededShots.map(normalizeAttackingDown);

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Shots Taken',    shots: teamShots.length,     goals: goalsFor, xg: xgFor,     color: '#00C853', xgLabel: 'xG' },
          { label: 'Shots Conceded', shots: concededShots.length, goals: goalsCon, xg: xgAgainst, color: '#FF3D57', xgLabel: 'xGA' },
        ].map(r => (
          <div key={r.label} style={{ background: 'var(--card2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: r.color, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>{r.label}</div>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div><div style={{ fontSize: '1.2rem', fontWeight: 900, color: r.color }}>{r.goals}</div><div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Goals</div></div>
              <div><div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#FFD400' }}>{r.xg.toFixed(2)}</div><div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>{r.xgLabel}</div></div>
              <div><div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#888' }}>{r.shots}</div><div style={{ fontSize: '0.55rem', color: '#555', fontWeight: 700, textTransform: 'uppercase' }}>Shots</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* Single unified pitch */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
        <svg viewBox="0 0 100 150" style={{ display: 'block', width: '100%' }}>
          {/* Background */}
          <rect width="100" height="150" fill={DARK_PITCH_BG} />
          {[0,1,2,3,4,5].map(i => (
            <rect key={i} x="0" y={i*25} width="100" height="12.5" fill="rgba(255,255,255,0.018)" />
          ))}

          {/* Bottom half tint — defend zone */}
          <rect x="0" y="75" width="100" height="75" fill="rgba(255,61,87,0.09)" />

          {/* Outer boundary */}
          <rect x="1" y="1" width="98" height="148" fill="none" stroke={DARK_LINE_HI} strokeWidth="0.7" />

          {/* Top penalty area */}
          <rect x="17.5" y="1" width="65" height="30" fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
          <rect x="32.5" y="1" width="35" height="10" fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
          <circle cx="50" cy="22.5" r="0.9" fill={DARK_LINE_HI} />
          <path d="M 41.5 31 A 12 12 0 0 0 58.5 31" fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
          <rect x="43.75" y="-3" width="12.5" height="4" fill="rgba(255,255,255,0.07)" stroke={DARK_LINE_HI} strokeWidth="0.7" />

          {/* Centre line + circle */}
          <line x1="1" y1="75" x2="99" y2="75" stroke={DARK_LINE_HI} strokeWidth="0.5" />
          <circle cx="50" cy="75" r="10" fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
          <circle cx="50" cy="75" r="0.9" fill={DARK_LINE_HI} />

          {/* Bottom penalty area */}
          <rect x="17.5" y="119" width="65" height="30" fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
          <rect x="32.5" y="139" width="35" height="10" fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
          <circle cx="50" cy="127.5" r="0.9" fill={DARK_LINE_HI} />
          <path d="M 41.5 119 A 12 12 0 0 1 58.5 119" fill="none" stroke={DARK_LINE_LO} strokeWidth="0.5" />
          <rect x="43.75" y="149" width="12.5" height="4" fill="rgba(255,255,255,0.07)" stroke={DARK_LINE_HI} strokeWidth="0.7" />


          {/* Shots TAKEN (top half, attacking up) */}
          {normTaken.map(s => (
            <ShotArrow key={`t-${s.id}`} s={s} showXG={false}
              players={players} homeTeam={team} awayTeam={team} teamMap={teamMap} />
          ))}

          {/* Shots CONCEDED (bottom half, opponents attacking down) */}
          {normConceded.map(s => (
            <ShotArrow key={`c-${s.id}`} s={s} showXG={false}
              players={players} homeTeam={null} awayTeam={null} teamMap={teamMap} />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {Object.entries(OUTCOME_LABELS).map(([k, l]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem', color: '#666' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: OUTCOME_COLORS[k], flexShrink: 0 }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

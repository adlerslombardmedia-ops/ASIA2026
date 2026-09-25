// ─── Admin Match Page ────────────────────────────────────────────────────────
// Dedicated match management page: Score · Lineup · Possession · Shots
import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as db from '../lib/db';
import { TeamLogo, COLORS, toast } from '../lib/hooks';
import { calcXG, OUTCOME_LABELS, OUTCOME_COLORS } from '../components/ShotMap';
import { PossessionTracker } from '../components/PossessionTracker';

// ─── Dark pitch constants (used by ShotRecorder) ─────────────────────────────
const LINE_LO    = 'rgba(255,255,255,0.14)';
const LINE_HI    = 'rgba(255,255,255,0.32)';
const PITCH_BG   = '#0d1f2d';

// Dark vertical pitch kept for ShotRecorder (viewBox 0 0 100 150)
function DarkPitch({ children }) {
  return (
    <g>
      <rect width="100" height="150" fill={PITCH_BG} />
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x="0" y={i * 25} width="100" height="12.5" fill="rgba(255,255,255,0.018)" />
      ))}
      <rect x="1" y="1" width="98" height="148" fill="none" stroke={LINE_HI} strokeWidth="0.7" />
      <rect x="17.5" y="1" width="65" height="30" fill="none" stroke={LINE_LO} strokeWidth="0.5" />
      <rect x="32.5" y="1" width="35" height="10" fill="none" stroke={LINE_LO} strokeWidth="0.5" />
      <circle cx="50" cy="22.5" r="0.9" fill={LINE_HI} />
      <path d="M 41.5 31 A 12 12 0 0 0 58.5 31" fill="none" stroke={LINE_LO} strokeWidth="0.5" />
      <rect x="43.75" y="-3" width="12.5" height="4" fill="rgba(255,255,255,0.07)" stroke={LINE_HI} strokeWidth="0.7" />
      <line x1="1" y1="75" x2="99" y2="75" stroke={LINE_HI} strokeWidth="0.5" />
      <circle cx="50" cy="75" r="10" fill="none" stroke={LINE_LO} strokeWidth="0.5" />
      <circle cx="50" cy="75" r="0.9" fill={LINE_HI} />
      <rect x="17.5" y="119" width="65" height="30" fill="none" stroke={LINE_LO} strokeWidth="0.5" />
      <rect x="32.5" y="139" width="35" height="10" fill="none" stroke={LINE_LO} strokeWidth="0.5" />
      <circle cx="50" cy="127.5" r="0.9" fill={LINE_HI} />
      <path d="M 41.5 119 A 12 12 0 0 1 58.5 119" fill="none" stroke={LINE_LO} strokeWidth="0.5" />
      <rect x="43.75" y="149" width="12.5" height="4" fill="rgba(255,255,255,0.07)" stroke={LINE_HI} strokeWidth="0.7" />
      {children}
    </g>
  );
}

// ─── Horizontal SVG Pitch (viewBox 0 0 100 65) — matches Manager Portal ───────
function PitchSVG({ children }) {
  return (
    <g>
      {/* Green stripes */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x={2 + i * 16} y={2} width={16} height={61} fill={i % 2 ? '#276b2c' : '#2d7532'} />
      ))}
      {/* Outline */}
      <rect x="2" y="2" width="96" height="61" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.6"/>
      {/* Centre line + circle */}
      <line x1="50" y1="2" x2="50" y2="63" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      <circle cx="50" cy="32.5" r="8" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      <circle cx="50" cy="32.5" r="0.8" fill="rgba(255,255,255,0.6)"/>
      {/* Penalty areas */}
      <rect x="2"  y="16" width="16" height="33" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      <rect x="82" y="16" width="16" height="33" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      {/* 6-yard boxes */}
      <rect x="2"    y="23" width="5.5" height="19" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4"/>
      <rect x="92.5" y="23" width="5.5" height="19" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4"/>
      {/* Goals */}
      <rect x="0"  y="27" width="2"  height="11" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.4"/>
      <rect x="98" y="27" width="2"  height="11" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.4"/>
      {/* Penalty spots */}
      <circle cx="12" cy="32.5" r="0.6" fill="rgba(255,255,255,0.5)"/>
      <circle cx="88" cy="32.5" r="0.6" fill="rgba(255,255,255,0.5)"/>
      {children}
    </g>
  );
}

// ─── LINEUP BUILDER ───────────────────────────────────────────────────────────
// Horizontal pitch (100×65): Home attacks → right, Away attacks ← left
function LineupBuilder({ matchId, homeTeam, awayTeam, players }) {
  const [homePl, setHomePl] = useState({});
  const [awayPl, setAwayPl] = useState({});
  const [dragging, setDragging] = useState(null);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef(null);

  const homePlayers = players.filter(p => p.team_id === homeTeam?.id);
  const awayPlayers = players.filter(p => p.team_id === awayTeam?.id);
  const homePlaced  = Object.keys(homePl);
  const awayPlaced  = Object.keys(awayPl);

  // Load saved lineup
  useEffect(() => {
    db.fetchLineups(matchId).then(rows => {
      const hm = {}, am = {};
      rows.forEach(r => {
        const pos = { x: r.x ?? 25, y: r.y ?? 32.5 };
        if (r.side === 'home') hm[r.player_id] = pos;
        else if (r.side === 'away') am[r.player_id] = pos;
      });
      if (Object.keys(hm).length) setHomePl(hm);
      if (Object.keys(am).length) setAwayPl(am);
    }).catch(() => {});
  }, [matchId]);

  const svgCoords = useCallback((e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 65;
    return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(63, y)) };
  }, []);

  // Default spread positions — home on left half, away on right half
  const defaultPos = (idx, side) => {
    const isHome = side === 'home';
    const pos = [
      { x: isHome ?  6 : 94, y: 32.5 }, // GK
      { x: isHome ? 20 : 80, y: 13   }, // DEF top
      { x: isHome ? 20 : 80, y: 32.5 }, // DEF mid
      { x: isHome ? 20 : 80, y: 52   }, // DEF bot
      { x: isHome ? 34 : 66, y: 21   }, // MID top
      { x: isHome ? 34 : 66, y: 44   }, // MID bot
      { x: isHome ? 46 : 54, y: 32.5 }, // FWD
    ];
    return pos[idx] || { x: isHome ? 25 : 75, y: 32.5 };
  };

  const togglePlayer = (pid, side) => {
    if (side === 'home') {
      if (homePl[pid]) { setHomePl(prev => { const n = { ...prev }; delete n[pid]; return n; }); }
      else if (homePlaced.length < 7) { setHomePl(prev => ({ ...prev, [pid]: defaultPos(homePlaced.length, 'home') })); }
    } else {
      if (awayPl[pid]) { setAwayPl(prev => { const n = { ...prev }; delete n[pid]; return n; }); }
      else if (awayPlaced.length < 7) { setAwayPl(prev => ({ ...prev, [pid]: defaultPos(awayPlaced.length, 'away') })); }
    }
  };

  const handlePointerDown = (e, pid, side) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ pid, side });
  };

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    const c = svgCoords(e);
    if (!c) return;
    (dragging.side === 'home' ? setHomePl : setAwayPl)(prev => ({ ...prev, [dragging.pid]: c }));
  }, [dragging, svgCoords]);

  const handlePointerUp = useCallback(() => setDragging(null), []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.clearMatchLineups(matchId);
      for (const [pid, pos] of Object.entries(homePl)) await db.upsertLineup(matchId, pid, 'home', pos.x, pos.y);
      for (const [pid, pos] of Object.entries(awayPl)) await db.upsertLineup(matchId, pid, 'away', pos.x, pos.y);
      toast('Lineup saved!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setSaving(false);
  };

  const renderDot = (pid, pos, side, allPlayers) => {
    const color = side === 'home' ? '#FFD400' : '#448AFF';
    const player = allPlayers.find(p => p.id === pid);
    return (
      <g key={pid} style={{ cursor: 'grab', touchAction: 'none', userSelect: 'none' }}
        onPointerDown={(e) => handlePointerDown(e, pid, side)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}>
        <circle cx={pos.x} cy={pos.y} r="5.2" fill={color} opacity={0.95} />
        <circle cx={pos.x} cy={pos.y} r="5.7" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
        <text x={pos.x} y={pos.y + 1.5} textAnchor="middle" dominantBaseline="middle"
          fill="#000" fontSize="3.5" fontWeight="bold" style={{ pointerEvents: 'none' }}>
          {player?.number || '?'}
        </text>
        <text x={pos.x} y={pos.y + 8} textAnchor="middle"
          fill="white" fontSize="2.5" fontWeight="bold" style={{ pointerEvents: 'none' }}>
          {(player?.name || '').split(' ')[0]?.slice(0, 7)}
        </text>
      </g>
    );
  };

  return (
    <div>
      {/* Team labels above pitch */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.68rem', fontWeight: 800 }}>
        <span style={{ color: '#FFD400' }}>← {homeTeam?.short_name || 'HOME'} ({homePlaced.length}/7)</span>
        <span style={{ color: '#448AFF' }}>{awayTeam?.short_name || 'AWAY'} ({awayPlaced.length}/7) →</span>
      </div>

      {/* Pitch */}
      <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
        <svg ref={svgRef} viewBox="0 0 100 65" style={{ display: 'block', width: '100%', touchAction: 'none' }}>
          <PitchSVG>
            {Object.entries(homePl).map(([pid, pos]) => renderDot(pid, pos, 'home', homePlayers))}
            {Object.entries(awayPl).map(([pid, pos]) => renderDot(pid, pos, 'away', awayPlayers))}
          </PitchSVG>
        </svg>
      </div>

      {/* Player lists */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { side: 'home', team: homeTeam, pl: homePlayers, placed: homePlaced, color: '#FFD400', placements: homePl },
          { side: 'away', team: awayTeam, pl: awayPlayers, placed: awayPlaced, color: '#448AFF', placements: awayPl },
        ].map(({ side, team, pl, placed, color, placements }) => (
          <div key={side}>
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color, textTransform: 'uppercase', marginBottom: 5 }}>
              {team?.short_name || side.toUpperCase()} ({placed.length}/7)
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {pl.map(p => {
                const isPlaced = !!placements[p.id];
                const full = !isPlaced && placed.length >= 7;
                return (
                  <div key={p.id} onClick={() => !full && togglePlayer(p.id, side)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px', borderRadius: 6, marginBottom: 3, cursor: full ? 'not-allowed' : 'pointer', background: isPlaced ? `${color}18` : 'var(--card2)', border: `1px solid ${isPlaced ? color + '55' : 'var(--border)'}`, opacity: full ? 0.38 : 1, transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color, minWidth: 16 }}>#{p.number ?? '?'}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isPlaced ? color : '#bbb', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    {isPlaced && <span style={{ fontSize: '0.55rem', color }}>✓</span>}
                  </div>
                );
              })}
              {pl.length === 0 && <div style={{ fontSize: '0.62rem', color: '#555', padding: 4 }}>No players</div>}
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: '11px', fontWeight: 900, fontSize: '0.82rem', borderRadius: 10, background: COLORS.gold, color: COLORS.dark, border: 'none', cursor: 'pointer' }}>
        {saving ? 'Saving…' : 'Save Starting Lineup'}
      </button>
      <div style={{ fontSize: '0.6rem', color: '#555', textAlign: 'center', marginTop: 5 }}>
        Click a player to place · Drag on pitch to reposition · Max 7 per team
      </div>
    </div>
  );
}

// ─── SHOT RECORDER with popup modal ──────────────────────────────────────────
function ShotRecorder({ matchId, homeTeam, awayTeam, players, existingShots = [], onSave, onDelete }) {
  const [step, setStep]       = useState('idle'); // idle | place_shot | place_end | modal
  const [shotStart, setShotStart] = useState(null);
  const [shotEnd,   setShotEnd]   = useState(null);
  // Modal state
  const [side,      setSide]     = useState('home');
  const [outcome,   setOutcome]  = useState('goal');
  const [playerId,  setPlayerId] = useState('');
  const [minute,    setMinute]   = useState('');
  const [isPenalty, setIsPenalty] = useState(false);
  const [saving,    setSaving]   = useState(false);
  const [hoveredShot, setHoveredShot] = useState(null);
  const svgRef = useRef(null);

  const team        = side === 'home' ? homeTeam : awayTeam;
  // Determine attacking direction from where the shot was taken (< 75 = top half = attacking up)
  const attackingUp = shotStart ? shotStart.y < 75 : true;
  const teamPlayers = players.filter(p => p.team_id === team?.id);
  const matchShots  = existingShots.filter(s => s.match_id === matchId);

  const svgCoords = useCallback((e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(150, ((e.clientY - rect.top) / rect.height) * 150)),
    };
  }, []);

  const handlePitchClick = useCallback((e) => {
    const c = svgCoords(e);
    if (!c) return;
    if (step === 'place_shot') { setShotStart(c); setStep('place_end'); }
    else if (step === 'place_end') { setShotEnd(c); setStep('modal'); }
  }, [step, svgCoords]);

  const reset = () => {
    setShotStart(null); setShotEnd(null); setStep('idle');
    setPlayerId(''); setMinute(''); setOutcome('goal'); setIsPenalty(false);
  };

  const handleSave = async () => {
    if (!shotStart) return;
    setSaving(true);
    try {
      await onSave({
        match_id:     matchId,
        team_id:      team?.id,
        player_id:    playerId || null,
        shot_x:       shotStart.x, shot_y: shotStart.y,
        end_x:        shotEnd?.x ?? null, end_y: shotEnd?.y ?? null,
        outcome,
        xg:           isPenalty ? 0.79 : calcXG(shotStart.x, shotStart.y, attackingUp),
        minute:       minute ? parseInt(minute) : null,
        attacking_up: attackingUp,
        is_penalty:   isPenalty,
      });
      reset();
    } finally { setSaving(false); }
  };


  const renderArrow = (s, key, onClick) => {
    const color  = OUTCOME_COLORS[s.outcome] || '#aaa';
    const ex = s.end_x ?? s.shot_x, ey = s.end_y ?? s.shot_y;
    const isGoal = s.outcome === 'goal';
    const ax = ex - s.shot_x, ay = ey - s.shot_y;
    const len = Math.sqrt(ax * ax + ay * ay);
    const cr = isGoal ? 2.8 : 2.2;
    // Offset line start past the start circle edge
    const lx1 = len > 0 ? s.shot_x + (ax / len) * (cr + 0.5) : s.shot_x;
    const ly1 = len > 0 ? s.shot_y + (ay / len) * (cr + 0.5) : s.shot_y;
    const isHov = hoveredShot === s.id;
    const pl  = players.find(p => p.id === s.player_id);
    const tm  = s.team_id === homeTeam?.id ? homeTeam : awayTeam;

    // Tooltip lines
    const tipLines = [
      pl ? pl.name : 'Unknown player',
      [tm?.short_name, pl ? `#${pl.number}` : null].filter(Boolean).join(' '),
      s.minute ? `${s.minute} min` : null,
      s.xg ? `xG: ${s.xg}` : null,
    ].filter(Boolean);
    const tipW = 34, tipLineH = 5.5;
    const tipH = tipLines.length * tipLineH + 4;
    const tipX = s.shot_x + 4 > 66 ? s.shot_x - tipW - 4 : s.shot_x + 4;
    const topOfArrow = Math.min(s.shot_y, ey);
    const tipY = Math.max(1, topOfArrow - tipH - 5);

    return (
      <g key={key} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
        {/* Line drawn first — sits underneath circles and arrowhead */}
        {len > 1 && (
          <line x1={lx1} y1={ly1} x2={ex} y2={ey}
            stroke={color} strokeWidth={isGoal ? 1.6 : 1}
            strokeDasharray={isGoal ? 'none' : '2.5,1.5'} opacity={0.85} />
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
        {/* Start circle on top of line */}
        <circle cx={s.shot_x} cy={s.shot_y} r={cr} fill={color} opacity={0.92}
          onMouseEnter={() => setHoveredShot(s.id)}
          onMouseLeave={() => setHoveredShot(null)} />
        {isGoal && <circle cx={s.shot_x} cy={s.shot_y} r={cr + 1.8} fill="none" stroke={color} strokeWidth="0.7" opacity={0.45} />}
        {s.xg && !isHov && (
          <text x={s.shot_x + cr + 1} y={s.shot_y - 1} fill={color} fontSize="3.2" fontWeight="bold" opacity={0.85}>{s.xg}</text>
        )}
        {/* Hover tooltip */}
        {isHov && (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="1.5"
              fill="rgba(10,10,10,0.94)" stroke="rgba(255,212,0,0.55)" strokeWidth="0.6" />
            {tipLines.map((line, i) => (
              <text key={i} x={tipX + 2.5} y={tipY + i * tipLineH + 4.5} fontSize="3.5"
                fill={i === 0 ? '#fff' : i === tipLines.length - 1 ? '#FFD400' : '#aaa'}
                fontWeight={i === 0 ? '700' : '400'}>
                {line}
              </text>
            ))}
          </g>
        )}
      </g>
    );
  };

  const xgPreview = shotStart ? calcXG(shotStart.x, shotStart.y, attackingUp) : null;

  return (
    <div>
      {/* Top action bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {step === 'idle' ? (
          <button onClick={() => setStep('place_shot')}
            style={{ flex: 1, padding: '9px', fontWeight: 800, fontSize: '0.78rem',
              borderRadius: 8, background: 'rgba(255,212,0,0.08)', color: '#FFD400',
              border: '1.5px dashed #FFD400', cursor: 'pointer' }}>
            + Record New Shot
          </button>
        ) : (step === 'place_shot' || step === 'place_end') ? (
          <button onClick={reset}
            style={{ flex: 1, padding: '9px', fontWeight: 700, fontSize: '0.75rem',
              borderRadius: 8, background: 'transparent', color: '#777',
              border: '1px solid var(--border)', cursor: 'pointer' }}>
            Cancel
          </button>
        ) : (
          <div style={{ flex: 1, fontSize: '0.65rem', fontWeight: 700, color: '#FFD400', textAlign: 'center' }}>
            Popup open — fill in details below
          </div>
        )}
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: step === 'idle' ? '#555' : '#FFD400', textAlign: 'right', flexShrink: 0 }}>
          {step === 'place_shot' && 'Click start point'}
          {step === 'place_end'  && 'Click end point'}
        </div>
      </div>

      {/* Pitch */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: `2px solid ${LINE_LO}`,
        cursor: (step === 'place_shot' || step === 'place_end') ? 'crosshair' : 'default' }}>
        <svg ref={svgRef} viewBox="0 0 100 150" style={{ display: 'block', width: '100%' }}
          onClick={(step === 'place_shot' || step === 'place_end') ? handlePitchClick : undefined}>
          <DarkPitch>
            {/* Existing shots */}
            {matchShots.map(s =>
              renderArrow(s, s.id, onDelete ? () => { if (confirm('Remove this shot?')) onDelete(s.id); } : undefined)
            )}

            {/* Live preview: line + arrowhead BELOW, then start circle ON TOP */}
            {shotStart && shotEnd && (() => {
              const ax = shotEnd.x - shotStart.x, ay = shotEnd.y - shotStart.y;
              const len = Math.sqrt(ax*ax + ay*ay), pcr = 3.2;
              const ux = len ? ax/len : 0, uy = len ? ay/len : 0;
              const lx1 = len > 0 ? shotStart.x + ux * (pcr + 0.5) : shotStart.x;
              const ly1 = len > 0 ? shotStart.y + uy * (pcr + 0.5) : shotStart.y;
              return (
                <g>
                  <line x1={lx1} y1={ly1} x2={shotEnd.x} y2={shotEnd.y}
                    stroke="#FFD400" strokeWidth="1.2" strokeDasharray="3,2" opacity={0.8} />
                  {len > 1 && (() => {
                    const angle = Math.atan2(ay, ax);
                    const ahl = 5, ang = 0.46;
                    const px1 = shotEnd.x - ahl * Math.cos(angle - ang);
                    const py1 = shotEnd.y - ahl * Math.sin(angle - ang);
                    const px2 = shotEnd.x - ahl * Math.cos(angle + ang);
                    const py2 = shotEnd.y - ahl * Math.sin(angle + ang);
                    return (
                      <polyline points={`${px1},${py1} ${shotEnd.x},${shotEnd.y} ${px2},${py2}`}
                        fill="none" stroke="#FFD400" strokeWidth="1.4"
                        strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
                    );
                  })()}
                </g>
              );
            })()}
            {/* Start circle always on top */}
            {shotStart && <>
              <circle cx={shotStart.x} cy={shotStart.y} r="3.2" fill="#FFD400" opacity={0.95} />
              <circle cx={shotStart.x} cy={shotStart.y} r="5.5" fill="none" stroke="#FFD400" strokeWidth="0.8" opacity={0.5} />
            </>}
          </DarkPitch>
        </svg>
      </div>


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
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: OUTCOME_COLORS[s.outcome] || '#666' }} />
                  <span style={{ color: '#888', flexShrink: 0 }}>{t?.short_name}</span>
                  <span style={{ flex: 1, color: '#bbb' }}>{p?.name || '—'}</span>
                  {s.is_penalty && <span style={{ background: 'rgba(255,212,0,0.15)', color: '#FFD400', borderRadius: 4, padding: '1px 5px', fontSize: '0.62rem', fontWeight: 800 }}>PEN</span>}
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

      {/* POPUP MODAL */}
      {step === 'modal' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={(e) => { if (e.target === e.currentTarget) reset(); }}>
          <div style={{
            background: 'var(--card)', borderRadius: '20px 20px 0 0',
            padding: '20px 16px 32px', width: '100%', maxWidth: 500,
            border: '1px solid var(--border)', borderBottom: 'none',
            animation: 'slideUp 0.22s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text)' }}>Shot Details</div>
                {xgPreview && (
                  <div style={{ fontSize: '0.68rem', color: '#888', marginTop: 2 }}>
                    Auto xG: <strong style={{ color: '#FFD400' }}>{xgPreview}</strong>
                  </div>
                )}
              </div>
              <button onClick={reset} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: '1.2rem', cursor: 'pointer', padding: 4 }}>✕</button>
            </div>

            {/* Team */}
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 5 }}>
              Attacking Team
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {[{ v: 'home', t: homeTeam, c: '#FFD400' }, { v: 'away', t: awayTeam, c: '#448AFF' }].map(({ v, t, c }) => (
                <button key={v} onClick={() => { setSide(v); setPlayerId(''); }}
                  style={{ flex: 1, padding: '9px', fontSize: '0.78rem', fontWeight: 800, borderRadius: 9,
                    border: `2px solid ${side === v ? c : 'var(--border)'}`,
                    background: side === v ? `${c}22` : 'transparent', color: side === v ? c : '#666', cursor: 'pointer' }}>
                  {t?.short_name || v.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Outcome */}
            <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 5 }}>
              Outcome
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
              {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                <button key={key} onClick={() => setOutcome(key)}
                  style={{ padding: '7px 11px', fontSize: '0.7rem', fontWeight: 700, borderRadius: 8,
                    border: `1.5px solid ${outcome === key ? OUTCOME_COLORS[key] : 'var(--border)'}`,
                    background: outcome === key ? `${OUTCOME_COLORS[key]}22` : 'transparent',
                    color: outcome === key ? OUTCOME_COLORS[key] : '#777', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Penalty toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, background: isPenalty ? 'rgba(255,212,0,0.08)' : 'var(--bg)', border: `1px solid ${isPenalty ? COLORS.gold : 'var(--border)'}`, borderRadius: 10, padding: '10px 14px' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>Penalty</div>
                <div style={{ fontSize: '0.65rem', color: '#888', marginTop: 1 }}>xG set to 0.79 · standard spot kick</div>
              </div>
              <button onClick={() => setIsPenalty(p => !p)}
                style={{ width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: isPenalty ? COLORS.gold : '#444', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: isPenalty ? 22 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
              </button>
            </div>

            {/* Player + Minute */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <select value={playerId} onChange={e => setPlayerId(e.target.value)}
                style={{ flex: 1, padding: '9px', fontSize: '0.78rem', borderRadius: 8 }}>
                <option value="">Shooter (optional)</option>
                {teamPlayers.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
              </select>
              <input type="number" min="1" max="90" placeholder="min" value={minute}
                onChange={e => setMinute(e.target.value)}
                style={{ width: 64, padding: '9px', fontSize: '0.78rem', textAlign: 'center', borderRadius: 8 }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, padding: '13px', fontWeight: 900, fontSize: '0.88rem', borderRadius: 11,
                  background: COLORS.gold, color: COLORS.dark, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save Shot'}
              </button>
              <button onClick={reset}
                style={{ padding: '13px 18px', fontWeight: 700, fontSize: '0.78rem', borderRadius: 11,
                  background: 'transparent', color: '#777', border: '1px solid var(--border)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EVENT LOGGER ─────────────────────────────────────────────────────────────
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
function MatchSheet({ home, away, players, matchLineups, matchEvents, teamMap, onAdd, onDelete, isKnockout }) {
  const [cardPid,  setCardPid]  = React.useState('');
  const [cardSide, setCardSide] = React.useState('home');
  const [penSide,  setPenSide]  = React.useState('home');

  const homePlayers = players.filter(p => p.team_id === home?.id);
  const awayPlayers = players.filter(p => p.team_id === away?.id);

  // Squad from lineups if submitted, else full squad
  const homeLineupIds = matchLineups.filter(l => l.side === 'home').map(l => l.player_id);
  const awayLineupIds = matchLineups.filter(l => l.side === 'away').map(l => l.player_id);
  const homeSquad = homeLineupIds.length
    ? homeLineupIds.map(id => homePlayers.find(p => p.id === id)).filter(Boolean)
    : homePlayers.filter(p => p.player_type !== 'manager');
  const awaySquad = awayLineupIds.length
    ? awayLineupIds.map(id => awayPlayers.find(p => p.id === id)).filter(Boolean)
    : awayPlayers.filter(p => p.player_type !== 'manager');
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
        {homeLineupIds.length === 0 && awayLineupIds.length === 0 && (
          <div style={{ fontSize: '0.65rem', color: '#666', marginTop: 4, fontStyle: 'italic' }}>Showing full squad — manager lineup not yet submitted</div>
        )}
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
  const { matches, teamMap, players, shots, possession, events, allLineups, reload, setMatches, setEvents } = data;
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
  const matchShots  = (shots  || []).filter(s => s.match_id === matchId);
  const matchPoss   = (possession || []).find(p => p.match_id === matchId);

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

  const handleSaveShot = async (shotData) => {
    try { await db.insertShot(shotData); await reload(); toast('Shot recorded!', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const handleDeleteShot = async (id) => {
    try { await db.deleteShot(id); await reload(); toast('Shot removed', 'info'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const handleSavePossession = async (homeS, awayS) => {
    try { await db.upsertPossession(matchId, homeS, awayS); await reload(); toast('Possession saved!', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const sections = [
    { key: 'score',      label: 'Score' },
    { key: 'lineup',     label: 'Lineup' },
    { key: 'possession', label: 'Possession' },
    { key: 'shots',      label: 'Shots' },
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
                matchLineups={(allLineups || []).filter(l => l.match_id === matchId)}
                matchEvents={matchEvents}
                teamMap={teamMap}
                onAdd={handleAddEvent}
                onDelete={handleDeleteEvent}
                isKnockout={isKnockout}
              />
            </div>
          </div>
        )}

        {/* ── LINEUP ────────────────────────────────────────────────────────── */}
        {section === 'lineup' && (
          <div>
            <div style={{ fontSize: '0.68rem', color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
              Click a player to place them on the pitch (max 7 per team). Drag their dot to reposition.
            </div>
            <LineupBuilder
              matchId={matchId}
              homeTeam={home}
              awayTeam={away}
              players={mPlayers}
            />
          </div>
        )}

        {/* ── POSSESSION ────────────────────────────────────────────────────── */}
        {section === 'possession' && (
          <div>
            {/* Match status badge */}
            {match.status === 'finished' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                borderRadius: 10, background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)', marginBottom: 14 }}>
                <span style={{ color: '#555', fontSize: '1rem' }}>✓</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#555' }}>Match Finished — cannot restart</span>
              </div>
            )}
            {match.status === 'live' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                borderRadius: 10, background: 'rgba(0,200,83,0.07)',
                border: '1px solid rgba(0,200,83,0.25)', marginBottom: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00C853',
                  display: 'inline-block', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#00C853' }}>Match is LIVE — tracking possession</span>
              </div>
            )}
            <div style={{ fontSize: '0.68rem', color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
              Press a team button to track possession. Switch teams to transfer the ball. Press same button to pause.
            </div>
            <PossessionTracker
              homeTeam={home}
              awayTeam={away}
              onSave={handleSavePossession}
              initialHome={matchPoss?.home_seconds || 0}
              initialAway={matchPoss?.away_seconds || 0}
            />
          </div>
        )}

        {/* ── SHOTS ─────────────────────────────────────────────────────────── */}
        {section === 'shots' && (
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ccc',
              background: 'rgba(255,212,0,0.07)', border: '1px solid rgba(255,212,0,0.2)',
              borderRadius: 8, padding: '9px 12px', marginBottom: 12, lineHeight: 1.5 }}>
              Click <strong style={{ color: '#FFD400' }}>once</strong> on the pitch = shot origin &nbsp;·&nbsp;
              Click <strong style={{ color: '#FFD400' }}>again</strong> = end location &nbsp;&rarr;&nbsp; popup asks player &amp; outcome
            </div>
            <ShotRecorder
              matchId={matchId}
              homeTeam={home}
              awayTeam={away}
              players={mPlayers}
              existingShots={shots || []}
              onSave={handleSaveShot}
              onDelete={handleDeleteShot}
            />
          </div>
        )}

      </div>
    </div>
  );
}

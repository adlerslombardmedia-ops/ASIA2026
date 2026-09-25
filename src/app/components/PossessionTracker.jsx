// ─── Possession Tracker ──────────────────────────────────────────────────────
// Press a team button → timer runs for that team.
// Switch possession → click the other team.
// Press same button again → pause.
// onSave(homeSeconds, awaySeconds) called on manual save.
import React, { useState, useEffect, useRef } from 'react';

export function PossessionTracker({ homeTeam, awayTeam, onSave, initialHome = 0, initialAway = 0 }) {
  const [homeS, setHomeS] = useState(initialHome);
  const [awayS, setAwayS] = useState(initialAway);
  const [active, setActive] = useState(null); // 'home' | 'away' | null
  const intervalRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => () => clearInterval(intervalRef.current), []);

  // When initialHome/Away change from outside (re-load), sync
  useEffect(() => { setHomeS(initialHome); }, [initialHome]);
  useEffect(() => { setAwayS(initialAway); }, [initialAway]);

  const startTimer = (side) => {
    clearInterval(intervalRef.current);
    setActive(side);
    intervalRef.current = setInterval(() => {
      if (side === 'home') setHomeS(s => s + 1);
      else setAwayS(s => s + 1);
    }, 1000);
  };

  const pauseTimer = () => {
    clearInterval(intervalRef.current);
    setActive(null);
  };

  const handlePress = (side) => {
    if (active === side) pauseTimer();
    else startTimer(side);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const total  = homeS + awayS || 1;
  const homePct = Math.round((homeS / total) * 100);
  const awayPct = 100 - homePct;

  return (
    <div>
      {/* Two big press buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[
          { side: 'home', team: homeTeam, color: '#00C853' },
          { side: 'away', team: awayTeam, color: '#448AFF' },
        ].map(({ side, team, color }) => {
          const isActive = active === side;
          return (
            <button key={side} onClick={() => handlePress(side)}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 12,
                border: `2px solid ${isActive ? color : 'var(--border)'}`,
                background: isActive ? `${color}20` : 'var(--card2)',
                color: isActive ? color : '#777',
                fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                boxShadow: isActive ? `0 0 16px ${color}40` : 'none',
                transition: 'all 0.18s ease',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {team?.short_name || (side === 'home' ? 'HOME' : 'AWAY')}
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: 1 }}>
                {fmt(side === 'home' ? homeS : awayS)}
              </span>
              <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>
                {isActive ? '🔴 TRACKING' : active ? '⏸ Paused' : '▶ Press to start'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Possession bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--card2)', position: 'relative' }}>
          <div style={{ height: '100%', width: `${homePct}%`,
            background: 'linear-gradient(90deg, #00C853, #1aaa5a)',
            borderRadius: '4px 0 0 4px', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4,
          fontSize: '0.72rem', fontWeight: 900 }}>
          <span style={{ color: '#00C853' }}>{homePct}%</span>
          <span style={{ color: '#555', fontSize: '0.6rem', fontWeight: 700 }}>POSSESSION</span>
          <span style={{ color: '#448AFF' }}>{awayPct}%</span>
        </div>
      </div>

      {/* Save button */}
      <button onClick={() => { pauseTimer(); onSave(homeS, awayS); }}
        style={{ width: '100%', padding: '9px', fontWeight: 800, fontSize: '0.78rem',
          borderRadius: 8, background: '#FFD400', color: '#0D0D0D', border: 'none', cursor: 'pointer', marginTop: 4 }}>
        Save Possession to Database
      </button>
      <div style={{ fontSize: '0.6rem', color: '#555', textAlign: 'center', marginTop: 4 }}>
        Saves automatically on End Match too
      </div>
    </div>
  );
}

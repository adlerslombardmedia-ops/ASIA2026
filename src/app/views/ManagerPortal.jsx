import React, { useState, useEffect } from 'react';
import * as db from '../lib/db';
import { toast, TeamLogo, COLORS } from '../lib/hooks';

// ─── Constants ────────────────────────────────────────────────────────────────
const GOLD = COLORS.gold;
const RED  = '#FF3D57';
const GREEN = '#00C853';
const SESSION_KEY = 'keff_mgr_session';

const labelSt = { fontSize: '0.72rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 5 };
const btnGold = { width: '100%', padding: '13px 0', borderRadius: 12, background: GOLD, color: '#111', fontWeight: 900, fontSize: '0.95rem', border: 'none', cursor: 'pointer' };
const btnRed  = { background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.25)', color: RED, padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' };

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const CATEGORIES = ['Keralite', 'Non-Keralite'];

// ─── 7-a-side formations (SVG coords, viewBox 0 0 100 65) ────────────────────
const FORMATIONS = {
  '3-2-1': [
    { role: 'GK',  x: 8,  y: 32.5 },
    { role: 'DEF', x: 24, y: 11   },
    { role: 'DEF', x: 24, y: 32.5 },
    { role: 'DEF', x: 24, y: 54   },
    { role: 'MID', x: 39, y: 21   },
    { role: 'MID', x: 39, y: 44   },
    { role: 'FWD', x: 52, y: 32.5 },
  ],
  '2-3-1': [
    { role: 'GK',  x: 8,  y: 32.5 },
    { role: 'DEF', x: 24, y: 20   },
    { role: 'DEF', x: 24, y: 45   },
    { role: 'MID', x: 38, y: 9    },
    { role: 'MID', x: 38, y: 32.5 },
    { role: 'MID', x: 38, y: 56   },
    { role: 'FWD', x: 52, y: 32.5 },
  ],
  '2-2-2': [
    { role: 'GK',  x: 8,  y: 32.5 },
    { role: 'DEF', x: 24, y: 20   },
    { role: 'DEF', x: 24, y: 45   },
    { role: 'MID', x: 38, y: 20   },
    { role: 'MID', x: 38, y: 45   },
    { role: 'FWD', x: 52, y: 20   },
    { role: 'FWD', x: 52, y: 45   },
  ],
  '1-3-2': [
    { role: 'GK',  x: 8,  y: 32.5 },
    { role: 'DEF', x: 24, y: 32.5 },
    { role: 'MID', x: 37, y: 11   },
    { role: 'MID', x: 37, y: 32.5 },
    { role: 'MID', x: 37, y: 54   },
    { role: 'FWD', x: 51, y: 21   },
    { role: 'FWD', x: 51, y: 44   },
  ],
  '3-1-2': [
    { role: 'GK',  x: 8,  y: 32.5 },
    { role: 'DEF', x: 22, y: 11   },
    { role: 'DEF', x: 22, y: 32.5 },
    { role: 'DEF', x: 22, y: 54   },
    { role: 'MID', x: 37, y: 32.5 },
    { role: 'FWD', x: 51, y: 20   },
    { role: 'FWD', x: 51, y: 45   },
  ],
};

// ─── Pitch SVG ────────────────────────────────────────────────────────────────
function Pitch({ children, style }) {
  return (
    <svg viewBox="0 0 100 65"
      style={{ width: '100%', background: '#2d7532', borderRadius: 10, display: 'block', userSelect: 'none', ...style }}>
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x={2 + i * 16} y={2} width={16} height={61} fill={i % 2 ? '#276b2c' : '#2d7532'} />
      ))}
      <rect x="2" y="2" width="96" height="61" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.6"/>
      <line x1="50" y1="2" x2="50" y2="63" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      <circle cx="50" cy="32.5" r="8" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      <circle cx="50" cy="32.5" r="0.8" fill="rgba(255,255,255,0.6)"/>
      <rect x="2"  y="16" width="16" height="33" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      <rect x="82" y="16" width="16" height="33" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
      <rect x="2"    y="23" width="5.5" height="19" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4"/>
      <rect x="92.5" y="23" width="5.5" height="19" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4"/>
      <rect x="0"  y="27" width="2"  height="11" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.4"/>
      <rect x="98" y="27" width="2"  height="11" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.4"/>
      <circle cx="12" cy="32.5" r="0.6" fill="rgba(255,255,255,0.5)"/>
      <circle cx="88" cy="32.5" r="0.6" fill="rgba(255,255,255,0.5)"/>
      {children}
    </svg>
  );
}

const PLAYER_TYPES = [
  { value: 'player',  label: 'Player',  limit: 12 },
  { value: 'reserve', label: 'Reserve', limit: 3  },
  { value: 'manager', label: 'Manager', limit: 2  },
];
const stageLabel = s => ({ group: 'Group', QF: 'QF', SF: 'SF', F: 'Final', '3P': '3rd Place' }[s] || s);

// ─── SQUAD TAB ────────────────────────────────────────────────────────────────
function SquadTab({ session, myPlayers }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', number: '', position: 'GK', category: 'Keralite', player_type: 'player' });
  const [busy, setBusy] = useState(false);
  const [regOpen, setRegOpen] = useState(true);

  useEffect(() => {
    db.getTournamentState('squad_registration').then(val => {
      setRegOpen(val?.open !== false); // default = open
    }).catch(() => {});
  }, []);

  const counts = {
    player:  myPlayers.filter(p => (p.player_type || 'player') === 'player').length,
    reserve: myPlayers.filter(p => p.player_type === 'reserve').length,
    manager: myPlayers.filter(p => p.player_type === 'manager').length,
  };

  const isDeadlinePast = new Date() > new Date('2026-05-31T23:59:59');

  const openAdd = () => {
    setForm({ name: '', number: '', position: 'GK', category: 'Keralite', player_type: 'player' });
    setEditId(null);
    setAdding(true);
  };

  const openEdit = p => {
    setForm({
      name: p.name,
      number: String(p.number ?? ''),
      position: p.position || 'GK',
      category: p.player_category || 'Keralite',
      player_type: p.player_type || 'player',
    });
    setEditId(p.id);
    setAdding(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    setBusy(true);
    try {
      const num = form.number ? parseInt(form.number) : null;
      if (editId) {
        await db.managerUpdatePlayer(session.teamId, session.password, editId,
          form.name.trim(), num, form.position, form.category, form.player_type);
        toast('Player updated', 'success');
      } else {
        await db.managerAddPlayer(session.teamId, session.password,
          form.name.trim(), num, form.position, form.category, form.player_type);
        toast('Player added!', 'success');
      }
      setAdding(false);
      setEditId(null);
    } catch (err) { toast(err.message || 'Failed', 'error'); }
    setBusy(false);
  };

  const handleDelete = async p => {
    if (!window.confirm(`Remove ${p.name} from squad?`)) return;
    try {
      await db.managerDeletePlayer(session.teamId, session.password, p.id);
      toast('Removed', 'info');
    } catch (err) { toast(err.message || 'Failed', 'error'); }
  };

  // ── Add / Edit form ──
  if (adding) {
    return (
      <div style={{ padding: '0 16px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <button onClick={() => setAdding(false)}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
            Back
          </button>
          <h3 style={{ fontWeight: 900, fontSize: '1rem', margin: 0 }}>
            {editId ? 'Edit Entry' : 'Add to Squad'}
          </h3>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Full Name *</label>
            <input type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required style={{ width: '100%' }} autoFocus />
          </div>

          {/* Jersey + Position row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>Jersey No.</label>
              <input type="number" value={form.number}
                onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                placeholder="10" min="1" max="99" style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelSt}>Position</label>
              <select value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                style={{ width: '100%' }}>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Category toggle */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Player Category</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, category: c }))}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', border: `1.5px solid ${form.category === c ? GOLD : 'var(--border)'}`, background: form.category === c ? `${GOLD}20` : 'var(--card)', color: form.category === c ? GOLD : '#888' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Role toggle */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelSt}>Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PLAYER_TYPES.map(pt => {
                const currentCount = counts[pt.value];
                const existingType = editId ? (myPlayers.find(p => p.id === editId)?.player_type || 'player') : null;
                const sameAsExisting = existingType === pt.value;
                const atLimit = currentCount >= pt.limit && !sameAsExisting;
                return (
                  <button key={pt.value} type="button"
                    onClick={() => !atLimit && setForm(f => ({ ...f, player_type: pt.value }))}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: '0.75rem', cursor: atLimit ? 'default' : 'pointer', border: `1.5px solid ${form.player_type === pt.value ? GOLD : 'var(--border)'}`, background: form.player_type === pt.value ? `${GOLD}20` : 'var(--card)', color: form.player_type === pt.value ? GOLD : atLimit ? '#555' : '#888', opacity: atLimit ? 0.5 : 1 }}>
                    {pt.label}<br />
                    <span style={{ fontSize: '0.62rem', fontWeight: 600 }}>{currentCount}/{pt.limit}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={busy} style={{ ...btnGold, opacity: busy ? 0.65 : 1 }}>
            {busy ? 'Saving…' : editId ? 'Update' : 'Add to Squad'}
          </button>
        </form>
      </div>
    );
  }

  // ── Squad list ──
  return (
    <div style={{ padding: '0 16px 40px' }}>
      {/* Registration closed banner */}
      {!regOpen && (
        <div style={{ background: 'rgba(255,61,87,0.1)', border: '1px solid rgba(255,61,87,0.35)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: '0.85rem', color: RED }}>🔒 Squad Registration Closed</div>
          <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 3 }}>
            The registration window has been closed by the admin. You can no longer add or edit squad members.
          </div>
        </div>
      )}

      {/* Deadline notice */}
      {regOpen && (
        <div style={{ background: isDeadlinePast ? 'rgba(255,61,87,0.08)' : 'rgba(255,212,0,0.06)', border: `1px solid ${isDeadlinePast ? 'rgba(255,61,87,0.3)' : `${GOLD}35`}`, borderRadius: 10, padding: '11px 14px', marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: '0.78rem', color: isDeadlinePast ? RED : GOLD }}>
            {isDeadlinePast ? '⚠️ Submission deadline has passed' : '📅 Deadline: 31st May 2026'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 2 }}>
            Please complete your squad list accurately before the deadline.
            Allowed: <strong style={{ color: 'var(--text)' }}>12 Players · 3 Reserves · 2 Managers</strong>
          </div>
        </div>
      )}

      {/* Counts */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {PLAYER_TYPES.map(pt => (
          <div key={pt.value} style={{ flex: 1, background: 'var(--card)', border: `1px solid ${counts[pt.value] >= pt.limit ? `${GREEN}60` : 'var(--border)'}`, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: '1.15rem', color: counts[pt.value] >= pt.limit ? GREEN : GOLD }}>
              {counts[pt.value]}<span style={{ fontSize: '0.68rem', color: '#888', fontWeight: 600 }}>/{pt.limit}</span>
            </div>
            <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>{pt.label}s</div>
          </div>
        ))}
      </div>

      {regOpen && (
        <button onClick={openAdd} style={{ ...btnGold, marginBottom: 22, fontSize: '0.88rem' }}>
          + Add Player / Manager
        </button>
      )}

      {myPlayers.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '30px 0', fontSize: '0.85rem' }}>
          No squad members yet. Tap the button above to start.
        </p>
      ) : (
        PLAYER_TYPES.map(pt => {
          const group = myPlayers
            .filter(p => (p.player_type || 'player') === pt.value)
            .sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
          if (group.length === 0) return null;
          return (
            <div key={pt.value} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                {pt.label}s — {group.length}/{pt.limit}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {group.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.78rem', color: '#111', flexShrink: 0 }}>
                      {p.number ?? '—'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: '0.62rem', color: '#888' }}>
                        {p.position || '—'} ·{' '}
                        <span style={{ color: (p.player_category || 'Keralite') === 'Keralite' ? '#4CAF50' : '#FF9800' }}>
                          {p.player_category || 'Keralite'}
                        </span>
                      </div>
                    </div>
                    {regOpen && <>
                      <button onClick={() => openEdit(p)}
                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 10px', borderRadius: 7, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(p)} style={{ ...btnRed, padding: '5px 10px', flexShrink: 0 }}>
                        Del
                      </button>
                    </>}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── LINEUP TAB (visual pitch + formation) ────────────────────────────────────
function LineupTab({ session, match, myPlayers, lineups }) {
  const myIdSet  = new Set(myPlayers.map(p => p.id));
  const saved    = lineups.filter(l => l.match_id === match.id && myIdSet.has(l.player_id));
  const isEditing = saved.length === 0;

  const [editing,      setEditing]      = useState(isEditing);
  const [formation,    setFormation]    = useState('3-2-1');
  const [assignments,  setAssignments]  = useState({}); // { slotIdx: playerId }
  const [activeSlot,   setActiveSlot]   = useState(null);
  const [busy,         setBusy]         = useState(false);

  const eligible      = myPlayers.filter(p => p.player_type !== 'manager');
  const slots         = FORMATIONS[formation];
  const assignedIds   = new Set(Object.values(assignments));
  const assignedCount = Object.keys(assignments).length;

  const handleSave = async () => {
    if (assignedCount === 0) { toast('Assign at least 1 player', 'error'); return; }
    setBusy(true);
    try {
      const players = Object.entries(assignments).map(([idx, pid]) => ({
        player_id: pid,
        x: slots[parseInt(idx)].x,
        y: slots[parseInt(idx)].y,
      }));
      await db.managerSaveLineup(session.teamId, session.password, match.id, players);
      toast(`Lineup saved — ${assignedCount} players`, 'success');
      setEditing(false);
      setActiveSlot(null);
    } catch (err) { toast(err.message || 'Failed to save', 'error'); }
    setBusy(false);
  };

  // ── Saved view ──
  if (!editing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontWeight: 900, fontSize: '1rem', margin: 0 }}>Starting Lineup</h3>
          <button onClick={() => { setAssignments({}); setActiveSlot(null); setEditing(true); }}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>
            Edit Lineup
          </button>
        </div>

        {saved.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#aaa', padding: '30px 0', fontSize: '0.85rem' }}>No lineup set yet</p>
        ) : (
          <>
            <Pitch style={{ marginBottom: 14 }}>
              {saved.map(row => {
                const p  = eligible.find(pl => pl.id === row.player_id);
                const cx = row.x || 25;
                const cy = row.y || 32.5;
                return (
                  <g key={row.player_id}>
                    <circle cx={cx} cy={cy} r="5" fill={GOLD} stroke="#111" strokeWidth="0.5"/>
                    <text x={cx} y={cy + 1.5} textAnchor="middle" dominantBaseline="middle" fontSize="3.5" fontWeight="bold" fill="#111">
                      {p?.number || '?'}
                    </text>
                    <text x={cx} y={cy + 7.5} textAnchor="middle" fontSize="2.5" fill="white" fontWeight="600">
                      {p?.name?.split(' ')[0]?.slice(0, 8) || '?'}
                    </text>
                  </g>
                );
              })}
            </Pitch>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {saved.map(row => {
                const p = eligible.find(pl => pl.id === row.player_id);
                return (
                  <div key={row.player_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.78rem', color: '#111', flexShrink: 0 }}>
                      {p?.number || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p?.name || '?'}</div>
                      <div style={{ fontSize: '0.62rem', color: '#888' }}>{p?.position || '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Edit / formation builder ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontWeight: 900, fontSize: '1rem', margin: 0 }}>Set Formation</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {assignedCount > 0 && (
            <button onClick={() => { setAssignments({}); setActiveSlot(null); }}
              style={{ background: 'none', border: 'none', color: RED, fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}>
              Remove All
            </button>
          )}
          <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>{assignedCount} / 7</span>
        </div>
      </div>

      {eligible.length === 0 && (
        <div style={{ background: 'rgba(255,212,0,0.08)', border: `1px solid ${GOLD}30`, borderRadius: 10, padding: '12px 14px', marginBottom: 12, fontSize: '0.78rem', color: '#aaa' }}>
          ⚠️ No players in squad yet. Go to the <strong style={{ color: GOLD }}>Squad</strong> tab to add players first.
        </div>
      )}

      {/* Formation presets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {Object.keys(FORMATIONS).map(f => (
          <button key={f} onClick={() => { setFormation(f); setAssignments({}); setActiveSlot(null); }}
            style={{ padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', border: `1.5px solid ${formation === f ? GOLD : 'var(--border)'}`, background: formation === f ? `${GOLD}20` : 'var(--card)', color: formation === f ? GOLD : '#888' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Pitch */}
      <Pitch style={{ marginBottom: 0 }}>
        {slots.map((slot, i) => {
          const pid    = assignments[i];
          const player = pid ? eligible.find(p => p.id === pid) : null;
          const active = activeSlot === i;
          return (
            <g key={i} onClick={e => { e.stopPropagation(); setActiveSlot(active ? null : i); }} style={{ cursor: 'pointer' }}>
              {active && <circle cx={slot.x} cy={slot.y} r="7" fill="rgba(255,212,0,0.2)" stroke={GOLD} strokeWidth="0.8"/>}
              <circle cx={slot.x} cy={slot.y} r="5.2"
                fill={player ? GOLD : 'rgba(255,255,255,0.18)'}
                stroke={active ? '#fff' : player ? '#111' : 'rgba(255,255,255,0.5)'}
                strokeWidth={active ? 1 : 0.6}/>
              {player ? (
                <>
                  <text x={slot.x} y={slot.y + 1.5} textAnchor="middle" dominantBaseline="middle" fontSize="3.5" fontWeight="bold" fill="#111">
                    {player.number || '?'}
                  </text>
                  <text x={slot.x} y={slot.y + 7.5} textAnchor="middle" fontSize="2.4" fill="white" fontWeight="600">
                    {player.name?.split(' ')[0]?.slice(0, 7)}
                  </text>
                </>
              ) : (
                <>
                  <text x={slot.x} y={slot.y + 1.5} textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="rgba(255,255,255,0.6)">+</text>
                  <text x={slot.x} y={slot.y + 8} textAnchor="middle" fontSize="2.3" fill="rgba(255,255,255,0.5)">{slot.role}</text>
                </>
              )}
            </g>
          );
        })}
      </Pitch>

      {/* Player picker — shows when a slot is tapped */}
      {activeSlot !== null && (
        <div style={{ marginTop: 10, background: 'var(--card)', border: `1px solid ${GOLD}50`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>
              Assign to <span style={{ color: GOLD }}>{slots[activeSlot].role}</span>
            </span>
            {assignments[activeSlot] && (
              <button onClick={() => setAssignments(p => { const n = { ...p }; delete n[activeSlot]; return n; })}
                style={{ background: 'none', border: 'none', color: RED, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                Remove
              </button>
            )}
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {eligible.map(p => {
              const taken    = Object.entries(assignments).some(([idx, id]) => id === p.id && parseInt(idx) !== activeSlot);
              const selected = assignments[activeSlot] === p.id;
              return (
                <div key={p.id}
                  onClick={() => { if (!taken) { setAssignments(prev => ({ ...prev, [activeSlot]: p.id })); setActiveSlot(null); } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)', cursor: taken ? 'not-allowed' : 'pointer', opacity: taken ? 0.4 : 1, background: selected ? `${GOLD}15` : 'transparent' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: selected ? GOLD : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.75rem', color: selected ? '#111' : 'var(--text)', flexShrink: 0 }}>
                    {p.number || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.62rem', color: '#888' }}>{p.position || '—'} · {p.player_type === 'reserve' ? 'Reserve' : 'Player'}</div>
                  </div>
                  {taken    && <span style={{ fontSize: '0.65rem', color: '#888' }}>Placed</span>}
                  {selected && <span style={{ fontSize: '0.8rem', color: GOLD }}>✓</span>}
                </div>
              );
            })}
            {eligible.length === 0 && (
              <p style={{ padding: 16, textAlign: 'center', color: '#aaa', fontSize: '0.8rem' }}>No players registered</p>
            )}
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={busy || assignedCount === 0}
        style={{ ...btnGold, marginTop: 16, opacity: busy || assignedCount === 0 ? 0.55 : 1 }}>
        {busy ? 'Saving…' : `Save Lineup (${assignedCount} placed)`}
      </button>
    </div>
  );
}

// ─── MATCH VIEW (lineup + goals) ──────────────────────────────────────────────
function GoalsMatchView({ session, match, myPlayers, events, teamMap, playerMap, lineups, onBack }) {
  const [matchTab, setMatchTab] = useState('lineup');
  const [scorer, setScorer] = useState('');
  const [assist, setAssist] = useState('');
  const [minute, setMinute] = useState('');
  const [busy, setBusy]     = useState(false);

  const home = teamMap[match.home_team_id];
  const away = teamMap[match.away_team_id];

  // Eligible for goals = players + reserves (not manager staff)
  const eligiblePlayers = myPlayers.filter(p => p.player_type !== 'manager');

  const matchGoals = events
    .filter(e => e.match_id === match.id && e.type === 'goal')
    .sort((a, b) => (a.minute || 0) - (b.minute || 0));

  const handleLog = async e => {
    e.preventDefault();
    if (!scorer) { toast('Select a goal scorer', 'error'); return; }
    setBusy(true);
    try {
      await db.managerLogEvent(
        session.teamId, session.password, match.id,
        scorer, 'goal',
        minute ? parseInt(minute) : null,
        assist || null
      );
      toast('Goal logged!', 'success');
      setScorer(''); setAssist(''); setMinute('');
    } catch (err) { toast(err.message || 'Failed to log goal', 'error'); }
    setBusy(false);
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await db.managerDeleteEvent(session.teamId, session.password, id);
      toast('Goal removed', 'info');
    } catch (err) { toast(err.message || 'Failed', 'error'); }
  };

  const tabStyle = active => ({
    padding: '8px 18px', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
    border: `1px solid ${active ? GOLD : 'var(--border)'}`,
    borderBottom: active ? '1px solid var(--bg)' : '1px solid var(--border)',
    background: active ? GOLD : 'var(--card)', color: active ? '#111' : '#888',
    marginBottom: -1, position: 'relative', zIndex: active ? 1 : 0, marginRight: 4,
  });

  return (
    <div className="animate-fade">
      {/* Match header */}
      <div style={{ padding: '12px 16px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={onBack}
            style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            Back
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', minWidth: 0 }}>
            <TeamLogo team={home} size={20} />
            <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{home?.short_name}</span>
            <span style={{ fontWeight: 900, fontSize: '0.88rem', color: GOLD, padding: '0 4px' }}>
              {match.played ? `${match.home_score} – ${match.away_score}` : 'vs'}
            </span>
            <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>{away?.short_name}</span>
            <TeamLogo team={away} size={20} />
          </div>
        </div>
        {/* Sub-tabs */}
        <div style={{ display: 'flex' }}>
          <button style={tabStyle(matchTab === 'lineup')} onClick={() => setMatchTab('lineup')}>📋 Lineup</button>
        </div>
      </div>

      <div style={{ padding: '18px 16px 40px' }}>
        {matchTab === 'lineup' && (
          <LineupTab session={session} match={match} myPlayers={myPlayers} lineups={lineups} />
        )}

      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ManagerPortal({ data, navigate }) {
  const { teams = [], players = [], matches = [], events = [], allLineups: lineups = [], loading } = data || {};

  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
  });

  const [loginTeamId, setLoginTeamId] = useState('');
  const [loginPass,   setLoginPass]   = useState('');
  const [loginBusy,   setLoginBusy]   = useState(false);
  const [loginErr,    setLoginErr]    = useState('');

  const [topTab, setTopTab]             = useState('squad');
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  const handleLogin = async e => {
    e.preventDefault(); setLoginErr(''); setLoginBusy(true);
    try {
      const ok = await db.verifyManagerPassword(loginTeamId, loginPass);
      if (!ok) { setLoginErr('Incorrect password. Please try again.'); setLoginBusy(false); return; }
      const team = teams.find(t => t.id === loginTeamId);
      const sess = { teamId: loginTeamId, teamName: team?.name || loginTeamId, password: loginPass };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      setSession(sess);
    } catch (err) { setLoginErr(err.message || 'Login failed'); }
    setLoginBusy(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setSelectedMatchId(null);
    setTopTab('squad');
  };

  // ── Loading ──
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: `3px solid ${GOLD}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        <p style={{ color: '#888', fontSize: '0.82rem' }}>Loading…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  // ── Login screen ──
  if (!session) return (
    <div className="animate-fade" style={{ padding: '20px 20px 40px', maxWidth: 420, margin: '0 auto' }}>
      <button onClick={() => navigate?.('home')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontWeight: 700, fontSize: '0.82rem', padding: 0, marginBottom: 24 }}>
        Back
      </button>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🏟️</div>
        <h2 style={{ fontWeight: 900, fontSize: '1.3rem', letterSpacing: -0.5, margin: '0 0 4px' }}>Manager Portal</h2>
        <p style={{ color: '#888', fontSize: '0.78rem', margin: 0 }}>Sign in to manage your team</p>
      </div>
      {loginErr && (
        <div style={{ background: 'rgba(255,61,87,0.1)', color: RED, padding: '10px 14px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, marginBottom: 14, border: '1px solid rgba(255,61,87,0.2)' }}>
          {loginErr}
        </div>
      )}
      <form onSubmit={handleLogin}>
        <label style={labelSt}>Your Team</label>
        <select value={loginTeamId} onChange={e => setLoginTeamId(e.target.value)} required style={{ width: '100%', marginBottom: 14 }}>
          <option value="">— Select your team —</option>
          {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label style={labelSt}>Password</label>
        <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
          placeholder="••••••••" required style={{ width: '100%', marginBottom: 20 }} />
        <button type="submit" disabled={loginBusy} style={{ ...btnGold, opacity: loginBusy ? 0.65 : 1 }}>
          {loginBusy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );

  const teamMap   = Object.fromEntries(teams.map(t => [t.id, t]));
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const myTeam    = teamMap[session.teamId];
  const myPlayers = players
    .filter(p => p.team_id === session.teamId)
    .sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
  const myMatches = matches
    .filter(m => m.home_team_id === session.teamId || m.away_team_id === session.teamId)
    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0));

  // ── Match detail (within Matches tab) ──
  if (topTab === 'matches' && selectedMatchId) {
    const match = matches.find(m => m.id === selectedMatchId);
    if (!match) return null; // don't setState during render
    return (
      <GoalsMatchView
        session={session}
        match={match}
        myPlayers={myPlayers}
        events={events}
        teamMap={teamMap}
        playerMap={playerMap}
        lineups={lineups}
        onBack={() => setSelectedMatchId(null)}
      />
    );
  }

  return (
    <div className="animate-fade">
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TeamLogo team={myTeam} size={36} />
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>{session.teamName}</div>
            <div style={{ fontSize: '0.65rem', color: GOLD, fontWeight: 700 }}>Manager Portal</div>
          </div>
        </div>
        <button onClick={handleLogout} style={btnRed}>Logout</button>
      </div>

      {/* ── Top-level tabs ── */}
      <div style={{ display: 'flex', padding: '14px 16px 0', borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'squad', label: '📋 Squad' }, { key: 'matches', label: '⚽ Matches' }].map(t => (
          <button key={t.key} onClick={() => { setTopTab(t.key); setSelectedMatchId(null); }}
            style={{ padding: '9px 20px', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', border: `1px solid ${topTab === t.key ? GOLD : 'var(--border)'}`, borderBottom: topTab === t.key ? '1px solid var(--bg)' : '1px solid var(--border)', background: topTab === t.key ? GOLD : 'var(--card)', color: topTab === t.key ? '#111' : '#888', marginBottom: -1, position: 'relative', zIndex: topTab === t.key ? 1 : 0, marginRight: 4 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Squad tab ── */}
      {topTab === 'squad' && (
        <div style={{ marginTop: 16 }}>
          <SquadTab session={session} myPlayers={myPlayers} />
        </div>
      )}

      {/* ── Matches tab ── */}
      {topTab === 'matches' && (
        <div style={{ padding: '16px 16px 40px' }}>
          {myMatches.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '40px 0', color: '#aaa', fontSize: '0.85rem' }}>No matches scheduled yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myMatches.map(m => {
                const home   = teamMap[m.home_team_id];
                const away   = teamMap[m.away_team_id];
                const isHome = m.home_team_id === session.teamId;
                const status = m.status || (m.played ? 'finished' : 'upcoming');
                const statusColor = { live: RED, finished: '#888', upcoming: GREEN }[status] || '#888';
                return (
                  <div key={m.id} onClick={() => setSelectedMatchId(m.id)}
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.63rem', fontWeight: 800, color: '#888', textTransform: 'uppercase' }}>
                        {stageLabel(m.stage)}{m.group_letter ? ` · Group ${m.group_letter}` : ''} · #{m.match_number}
                        {m.match_time ? ` · ${m.match_time}` : ''}
                        {m.ground ? ` · ${m.ground}` : ''}
                      </span>
                      <span style={{ fontSize: '0.63rem', fontWeight: 800, color: statusColor, background: `${statusColor}15`, padding: '2px 8px', borderRadius: 6 }}>
                        {status === 'live' ? '🔴 LIVE' : status === 'finished' ? 'Finished' : 'Upcoming'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <TeamLogo team={home} size={30} />
                        <span style={{ fontWeight: isHome ? 900 : 600, fontSize: '0.82rem' }}>{home?.short_name || '?'}</span>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', padding: '0 8px', color: m.played ? 'var(--text)' : '#aaa' }}>
                        {m.played ? `${m.home_score} – ${m.away_score}` : 'vs'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                        <span style={{ fontWeight: !isHome ? 900 : 600, fontSize: '0.82rem' }}>{away?.short_name || '?'}</span>
                        <TeamLogo team={away} size={30} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

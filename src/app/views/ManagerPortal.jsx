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

const PLAYER_TYPES = [
  { value: 'player',  label: 'Starter', limit: 7 },
  { value: 'sub',     label: 'Sub',     limit: 5 },
  { value: 'reserve', label: 'Reserve', limit: 3 },
  { value: 'manager', label: 'Manager', limit: 1 },
];
const stageLabel = s => ({ group: 'Group', QF: 'QF', SF: 'SF', F: 'Final' }[s] || s);

// ─── SQUAD TAB ────────────────────────────────────────────────────────────────
function SquadTab({ session, myPlayers }) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', number: '', position: 'GK', player_type: 'player' });
  const [busy, setBusy] = useState(false);
  const [regOpen, setRegOpen] = useState(true);

  useEffect(() => {
    db.getTournamentState('squad_registration').then(val => {
      setRegOpen(val?.open !== false); // default = open
    }).catch(() => {});
  }, []);

  const counts = {
    player:  myPlayers.filter(p => (p.player_type || 'player') === 'player').length,
    sub:     myPlayers.filter(p => p.player_type === 'sub').length,
    reserve: myPlayers.filter(p => p.player_type === 'reserve').length,
    manager: myPlayers.filter(p => p.player_type === 'manager').length,
  };

  const isDeadlinePast = new Date() > new Date('2026-09-27T09:00:00');

  const openAdd = () => {
    setForm({ name: '', number: '', position: 'GK', player_type: 'player' });
    setEditId(null);
    setAdding(true);
  };

  const openEdit = p => {
    setForm({
      name: p.name,
      number: String(p.number ?? ''),
      position: p.position || 'GK',
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
          form.name.trim(), num, form.position, null, form.player_type);
        toast('Player updated', 'success');
      } else {
        await db.managerAddPlayer(session.teamId, session.password,
          form.name.trim(), num, form.position, null, form.player_type);
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
            {isDeadlinePast ? '⚠️ Submission deadline has passed' : '📅 Deadline: 27th September 2026, 9:00 AM'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 2 }}>
            Please complete your squad list accurately before the deadline.
            Allowed: <strong style={{ color: 'var(--text)' }}>7 Players · 5 Subs · 3 Reserves · 1 Manager</strong>
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
                      <div style={{ fontSize: '0.62rem', color: '#888' }}>{p.position || '—'}</div>
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

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ManagerPortal({ data, navigate }) {
  const { teams = [], players = [], matches = [], loading } = data || {};

  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
  });

  const [loginTeamId, setLoginTeamId] = useState('');
  const [loginPass,   setLoginPass]   = useState('');
  const [loginBusy,   setLoginBusy]   = useState(false);
  const [loginErr,    setLoginErr]    = useState('');

  const [topTab, setTopTab] = useState('squad');

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
  const myTeam    = teamMap[session.teamId];
  const myPlayers = players
    .filter(p => p.team_id === session.teamId)
    .sort((a, b) => (a.number ?? 99) - (b.number ?? 99));
  const myMatches = matches
    .filter(m => m.home_team_id === session.teamId || m.away_team_id === session.teamId)
    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0));

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
          <button key={t.key} onClick={() => setTopTab(t.key)}
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
                  <div key={m.id}
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
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

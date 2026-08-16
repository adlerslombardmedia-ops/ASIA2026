import React, { useState, useCallback } from 'react';
import { useTournamentData, useToast, useKonami, launchConfetti, COLORS, LOGO_URL } from './lib/hooks';
import HomeView from './views/HomeView';
import MatchView from './views/MatchView';
import TeamView from './views/TeamView';
import StatsView from './views/StatsView';
import AdminView from './views/AdminView';
import AdminMatchPage from './views/AdminMatchPage';
import InfoView from './views/InfoView';
import ManagerPortal from './views/ManagerPortal';
import LiveView from './views/LiveView';

// ─── SVG Icons (inline for zero deps) ──────────────────────────────────────
const Icons = {
  home: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  trophy: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 1012 0V2z"/></svg>,
  stats: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  shield: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  ball: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20"/><path d="M2 12h20"/></svg>,
  info: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8.01"/><line x1="12" y1="12" x2="12" y2="16"/></svg>,
};

// ─── APP ────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('home');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [subTab, setSubTab] = useState('groups'); // groups | fixtures | knockouts

  // Theme: persist in localStorage, default dark
  const [theme, setTheme] = useState(() => localStorage.getItem('keff-theme') || 'light');
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('keff-theme', theme);
  }, [theme]);

  const data = useTournamentData();
  const toasts = useToast();

  // Easter egg: Konami code triggers confetti
  useKonami(useCallback(() => {
    launchConfetti();
  }, []));

  const navigate = useCallback((v, opts = {}) => {
    setView(v);
    if (opts.matchId) setSelectedMatchId(opts.matchId);
    if (opts.teamId) setSelectedTeamId(opts.teamId);
    if (opts.subTab) setSubTab(opts.subTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const tabs = [
    { key: 'home',    label: 'Home',    icon: Icons.home },
    { key: 'stats',   label: 'Stats',   icon: Icons.stats },
    { key: 'info',    label: 'Info',    icon: Icons.info },
    { key: 'manager', label: 'Manager', icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
    { key: 'live',    label: 'Live',    icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg> },
    { key: 'admin',   label: 'Admin',   icon: Icons.shield },
  ];

  // Loading screen
  if (data.loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: COLORS.dark }}>
        <img src={LOGO_URL} alt="Asia Cup 2026" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }} />
        <div style={{ color: COLORS.gold, fontWeight: 900, fontSize: '1.1rem', letterSpacing: 1 }}>ASIA CUP 2026</div>
        <div style={{ width: 120, height: 3, borderRadius: 2 }} className="skeleton" />
        <div style={{ color: '#555', fontSize: '0.75rem', marginTop: 8 }}>Loading tournament data…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* ─── THEME TOGGLE ─── */}
      <button
        className="theme-toggle tappable"
        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Switch to Day Mode' : 'Switch to Night Mode'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* ─── MAIN CONTENT ─── */}
      <main className="page-content">
        {view === 'home' && (
          <HomeView data={data} subTab={subTab} setSubTab={setSubTab} navigate={navigate} />
        )}
        {view === 'fixtures' && (
          <HomeView data={data} subTab="fixtures" setSubTab={setSubTab} navigate={navigate} />
        )}
        {view === 'match' && (
          <MatchView data={data} matchId={selectedMatchId} navigate={navigate} />
        )}
        {view === 'team' && (
          <TeamView data={data} teamId={selectedTeamId} navigate={navigate} />
        )}
        {view === 'stats' && (
          <StatsView data={data} navigate={navigate} />
        )}
        {view === 'admin' && (
          <AdminView data={data} navigate={navigate} />
        )}
        {view === 'adminMatch' && (
          <AdminMatchPage data={data} matchId={selectedMatchId} navigate={navigate} />
        )}
        {view === 'info' && (
          <InfoView data={data} navigate={navigate} />
        )}
        {view === 'manager' && (
          <ManagerPortal data={data} navigate={navigate} />
        )}
        {view === 'live' && (
          <LiveView />
        )}

        {/* Sponsors Banner */}
        {view !== 'admin' && view !== 'adminMatch' && (
          <div className="sponsors-banner animate-fade">
            <div className="sponsors-title">OUR SPONSORS</div>
            {/* Tier 1 — primary sponsors (larger) */}
            <div className="sponsors-grid sponsors-tier1">
              <a href="https://www.bloominternational.org" target="_blank" rel="noreferrer" style={{ display: 'contents' }}>
                <img src={`${import.meta.env.BASE_URL}images/sponsors/bloom.png`} alt="Bloom" className="sponsor-logo sponsor-logo-t1" style={{ cursor: 'pointer' }} />
              </a>
              <a href="https://www.instagram.com/arcon.biz/" target="_blank" rel="noreferrer" style={{ display: 'contents' }}>
                <img src={`${import.meta.env.BASE_URL}images/sponsors/arcon.png`} alt="Arcon" className="sponsor-logo sponsor-logo-t1" style={{ cursor: 'pointer' }} />
              </a>
              <a href="https://www.instagram.com/afinetrip/" target="_blank" rel="noreferrer" style={{ display: 'contents' }}>
                <img src={`${import.meta.env.BASE_URL}images/sponsors/finetrip.png`} alt="A Fine Trip" className="sponsor-logo sponsor-logo-t1" style={{ cursor: 'pointer' }} />
              </a>
            </div>
            {/* Divider */}
            <div className="sponsors-tier-divider" />
            {/* Tier 2 — secondary sponsors (smaller) */}
            <div className="sponsors-grid sponsors-tier2">
              <a href="https://www.instagram.com/diamondbrescia?igsh=bzM5MGw3aW90aTlv" target="_blank" rel="noreferrer" style={{ display: 'contents' }}>
                <img src={`${import.meta.env.BASE_URL}images/sponsors/diamond.png`} alt="Diamond Brescia" className="sponsor-logo sponsor-logo-t2" style={{ cursor: 'pointer' }} />
              </a>
              <a href="https://www.instagram.com/adipoli.zone/" target="_blank" rel="noreferrer" style={{ display: 'contents' }}>
                <img src={`${import.meta.env.BASE_URL}images/sponsors/adpoli.png`} alt="Adipoli" className="sponsor-logo sponsor-logo-t2" style={{ cursor: 'pointer' }} />
              </a>
              <a href="https://www.instagram.com/hizsports?igsh=MXM4ZGh2YWt1dzh0cA%3D%3D" target="_blank" rel="noreferrer" style={{ display: 'contents' }}>
                <img src={`${import.meta.env.BASE_URL}images/sponsors/hiz.png`} alt="Hiz Sports" className="sponsor-logo sponsor-logo-t2" style={{ cursor: 'pointer' }} />
              </a>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 10 }}>
              <span style={{ fontSize: '0.68rem', color: '#666', fontWeight: 700, letterSpacing: 0.5 }}>TECH SUPPORT</span>
              <a href="https://calcioac.com" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                <img src={`${import.meta.env.BASE_URL}images/sponsors/calcioac.svg`} alt="calcioac" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, opacity: 0.8 }} />
                <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700 }}>calcioac.com</span>
              </a>
            </div>
          </div>
        )}
      </main>

      {/* ─── BOTTOM NAV ─── */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`nav-item ${(view === tab.key || (tab.key === 'home' && (view === 'team' || view === 'match' || view === 'fixtures')) || (tab.key === 'admin' && view === 'adminMatch')) ? 'active' : ''}`}
              onClick={() => navigate(tab.key)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ─── TOASTS ─── */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}

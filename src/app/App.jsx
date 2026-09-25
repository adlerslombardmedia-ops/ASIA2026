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
import SponsorsBanner from './components/SponsorsBanner';
import { isConfigured } from './supabase';

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
      <div className="splash">
        <img src={LOGO_URL} alt="Asia Cup 2026" className="splash-logo" />
        <div className="splash-bar" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* ─── MAIN CONTENT ─── */}
      <main className="page-content">
        {!isConfigured && (
          <div className="db-notice"><strong>Database not connected.</strong> Showing the default team list until your database is linked in Project Settings.</div>
        )}
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
        {view !== 'admin' && view !== 'adminMatch' && <SponsorsBanner />}
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

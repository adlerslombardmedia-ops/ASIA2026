import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { supabase } from '../supabase';
import * as db from '../lib/db';
import { toast, signIn, signOut, TeamLogo, COLORS, DEFAULT_TEAMS } from '../lib/hooks';
// ShotMapRecorder and PossessionTracker now live in AdminMatchPage

// ─── CROP HELPER ────────────────────────────────────────────────────────────
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (!file) {
        reject(new Error('Canvas is empty'));
        return;
      }
      file.name = 'cropped.jpeg';
      resolve(file);
    }, 'image/jpeg');
  });
}

const AWARD_CATEGORIES = [
  { key: 'first_place',   label: '1st Place',     type: 'team',   color: '#FFD400', medal: '1ST' },
  { key: 'second_place',  label: '2nd Place',     type: 'team',   color: '#C0C0C0', medal: '2ND' },
  { key: 'third_place',   label: '3rd Place',     type: 'team',   color: '#CD7F32', medal: '3RD' },
  { key: 'best_player',   label: 'Best Player',   type: 'player', color: '#FFD400', medal: 'MVP' },
  { key: 'top_scorer',    label: 'Top Scorer',    type: 'player', color: '#00C853', medal: 'GLS' },
  { key: 'best_defender', label: 'Best Defender', type: 'player', color: '#448AFF', medal: 'DEF' },
  { key: 'best_gk',       label: 'Best GK',       type: 'player', color: '#FF9100', medal: 'GK'  },
  { key: 'best_manager',  label: 'Best Manager',  type: 'custom', color: '#9C27B0', medal: 'MGR' },
];

export default function AdminView({ data, navigate }) {
  const { user, teams, players, groups, groupAssignments, matches, events, shots, possession, teamMap, awards, reload } = data;
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [tab, setTab] = useState(user?.email === 'beta@keff.com' ? 'matches' : 'dash');
  
  // Players tab states
  const [selTeam, setSelTeam] = useState('');
  const [pName, setPName] = useState('');
  const [pNum, setPNum] = useState('');
  const [pPos, setPPos] = useState('MID');
  const [pStarter, setPStarter] = useState(false);
  
  const [busy, setBusy] = useState(false);
  const [drawActiveTeamId, setDrawActiveTeamId] = useState(null);
  // match analytics now handled in AdminMatchPage (navigate per-match)
  const [importReport, setImportReport] = useState(null); // null | { imported, errors[], warnings[] }
  const [pasteText, setPasteText] = useState('');

  // Logo Cropper States
  const [cropData, setCropData] = useState(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // ── Login ──
  if (!user) {
    return (
      <div className="animate-fade" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80dvh' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontWeight: 900, fontSize: '1.3rem', letterSpacing: -0.5 }}>Admin Portal</h2>
            <p style={{ color: '#666', fontSize: '0.78rem', marginTop: 4 }}>Sign in with your Supabase account</p>
          </div>
          {loginErr && <div style={{ background: 'var(--red-bg)', color: COLORS.red, padding: 10, borderRadius: 10, fontSize: '0.78rem', fontWeight: 700, marginBottom: 12, border: '1px solid rgba(255,61,87,0.2)' }}>{loginErr}</div>}
          <form onSubmit={async e => { e.preventDefault(); setLoginErr(''); try { await signIn(email, pass); toast('Signed in successfully!', 'success'); } catch (err) { setLoginErr(err.message); } }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@keff.com" required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Password</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-gold btn-block" style={{ padding: 14 }}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Helpers ──
  const played = matches.filter(m => m.played).length;
  const totalGoals = matches.filter(m => m.played).reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0);
  const hasGroups = Object.values(groups).some(g => g.length > 0);

  const seedTeams = async () => {
    setBusy(true);
    try {
      for (const t of DEFAULT_TEAMS) await db.upsertTeam(t);
      await reload();
      toast(`${DEFAULT_TEAMS.length} teams seeded successfully!`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const autoDraw = async () => {
    setBusy(true);
    try {
      await db.clearAllGroupAssignments();
      const shuffled = [...teams].sort(() => 0.5 - Math.random());
      const letters = ['A', 'B', 'C', 'D'];
      const perGroup = Math.ceil(shuffled.length / letters.length);
      const gs = Object.fromEntries(letters.map((l, i) => [l, shuffled.slice(i * perGroup, (i + 1) * perGroup)]));
      for (const [letter, gTeams] of Object.entries(gs)) {
        for (let i = 0; i < gTeams.length; i++) {
          await db.upsertGroupAssignment(gTeams[i].id, letter, i);
        }
      }
      await reload();
      toast('Randomized group draw complete!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const genFixtures = async () => {
    setBusy(true);
    try {
      const fixtures = db.generateGroupFixtures(groups);
      const ko = db.generateKnockoutTemplate();
      await db.deleteAllMatches();
      await db.upsertMatches([...fixtures, ...ko]);
      await reload();
      toast(`${fixtures.length} group matches and ${ko.length} tournament bracket matches generated!`, 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const importSchedule = async () => {
    if (!window.confirm('This will replace ALL existing matches with the official schedule (47 matches with time & ground). Continue?')) return;
    setBusy(true);
    try {
      const GROUP_MATCHES = [
        { id:'grp_a_m1',  stage:'group', group_letter:'A', match_number:1,  home_team_id:'botafogo_fc_malta',     away_team_id:'minnal_bayern_titans',  played:false, match_time:'08:00', ground:'1' },
        { id:'grp_b_m2',  stage:'group', group_letter:'B', match_number:2,  home_team_id:'kombans_fc',            away_team_id:'hamburg_blasters_hawks',              played:false, match_time:'08:00', ground:'2' },
        { id:'grp_c_m3',  stage:'group', group_letter:'C', match_number:3,  home_team_id:'edex_kings_kerala',     away_team_id:'inter_freiburg_fc',     played:false, match_time:'08:20', ground:'1' },
        { id:'grp_d_m4',  stage:'group', group_letter:'D', match_number:4,  home_team_id:'hamburg_blasters',      away_team_id:'minnal_bayern_knights', played:false, match_time:'08:20', ground:'2' },
        { id:'grp_a_m5',  stage:'group', group_letter:'A', match_number:5,  home_team_id:'monsoon_fc',            away_team_id:'kta_paris',             played:false, match_time:'08:40', ground:'1' },
        { id:'grp_b_m6',  stage:'group', group_letter:'B', match_number:6,  home_team_id:'frankfurter_fc_kerala', away_team_id:'northern_knights_fc',  played:false, match_time:'08:40', ground:'2' },
        { id:'grp_c_m7',  stage:'group', group_letter:'C', match_number:7,  home_team_id:'club_de_swat_malta',    away_team_id:'sporting_mallus',      played:false, match_time:'09:00', ground:'1' },
        { id:'grp_d_m8',  stage:'group', group_letter:'D', match_number:8,  home_team_id:'adlers_lombard_b',      away_team_id:'dresden_drifters_fc',  played:false, match_time:'09:00', ground:'2' },
        { id:'grp_a_m9',  stage:'group', group_letter:'A', match_number:9,  home_team_id:'adlers_lombard_a',      away_team_id:'botafogo_fc_malta',     played:false, match_time:'09:20', ground:'1' },
        { id:'grp_b_m10', stage:'group', group_letter:'B', match_number:10, home_team_id:'kombans_fc',            away_team_id:'bogey_fc',played:false, match_time:'09:20', ground:'2' },
        { id:'grp_c_m11', stage:'group', group_letter:'C', match_number:11, home_team_id:'edex_kings_kerala',     away_team_id:'marburg_fc_kerala',     played:false, match_time:'09:40', ground:'1' },
        { id:'grp_d_m12', stage:'group', group_letter:'D', match_number:12, home_team_id:'hamburg_blasters',      away_team_id:'slovak_titans_fc',      played:false, match_time:'09:40', ground:'2' },
        { id:'grp_a_m13', stage:'group', group_letter:'A', match_number:13, home_team_id:'monsoon_fc',            away_team_id:'minnal_bayern_titans',  played:false, match_time:'10:00', ground:'1' },
        { id:'grp_b_m14', stage:'group', group_letter:'B', match_number:14, home_team_id:'frankfurter_fc_kerala', away_team_id:'hamburg_blasters_hawks',             played:false, match_time:'10:00', ground:'2' },
        { id:'grp_c_m15', stage:'group', group_letter:'C', match_number:15, home_team_id:'sporting_mallus',       away_team_id:'inter_freiburg_fc',    played:false, match_time:'10:20', ground:'1' },
        { id:'grp_d_m16', stage:'group', group_letter:'D', match_number:16, home_team_id:'adlers_lombard_b',      away_team_id:'minnal_bayern_knights',played:false, match_time:'10:20', ground:'2' },
        { id:'grp_a_m17', stage:'group', group_letter:'A', match_number:17, home_team_id:'adlers_lombard_a',      away_team_id:'kta_paris',            played:false, match_time:'10:40', ground:'1' },
        { id:'grp_b_m18', stage:'group', group_letter:'B', match_number:18, home_team_id:'northern_knights_fc',   away_team_id:'bogey_fc',played:false, match_time:'10:40', ground:'2' },
        { id:'grp_c_m19', stage:'group', group_letter:'C', match_number:19, home_team_id:'club_de_swat_malta',    away_team_id:'marburg_fc_kerala',    played:false, match_time:'11:00', ground:'1' },
        { id:'grp_d_m20', stage:'group', group_letter:'D', match_number:20, home_team_id:'dresden_drifters_fc',   away_team_id:'slovak_titans_fc',     played:false, match_time:'11:00', ground:'2' },
        { id:'grp_a_m21', stage:'group', group_letter:'A', match_number:21, home_team_id:'monsoon_fc',            away_team_id:'botafogo_fc_malta',     played:false, match_time:'11:20', ground:'1' },
        { id:'grp_b_m22', stage:'group', group_letter:'B', match_number:22, home_team_id:'kombans_fc',            away_team_id:'frankfurter_fc_kerala', played:false, match_time:'11:20', ground:'2' },
        { id:'grp_c_m23', stage:'group', group_letter:'C', match_number:23, home_team_id:'sporting_mallus',       away_team_id:'edex_kings_kerala',    played:false, match_time:'11:40', ground:'1' },
        { id:'grp_d_m24', stage:'group', group_letter:'D', match_number:24, home_team_id:'adlers_lombard_b',      away_team_id:'hamburg_blasters',     played:false, match_time:'11:40', ground:'2' },
        { id:'grp_a_m25', stage:'group', group_letter:'A', match_number:25, home_team_id:'adlers_lombard_a',      away_team_id:'minnal_bayern_titans', played:false, match_time:'12:00', ground:'1' },
        { id:'grp_b_m26', stage:'group', group_letter:'B', match_number:26, home_team_id:'hamburg_blasters_hawks',              away_team_id:'northern_knights_fc',  played:false, match_time:'12:00', ground:'2' },
        { id:'grp_c_m27', stage:'group', group_letter:'C', match_number:27, home_team_id:'club_de_swat_malta',    away_team_id:'inter_freiburg_fc',    played:false, match_time:'12:20', ground:'1' },
        { id:'grp_d_m28', stage:'group', group_letter:'D', match_number:28, home_team_id:'minnal_bayern_knights', away_team_id:'dresden_drifters_fc',  played:false, match_time:'12:20', ground:'2' },
        { id:'grp_a_m29', stage:'group', group_letter:'A', match_number:29, home_team_id:'kta_paris',             away_team_id:'botafogo_fc_malta',    played:false, match_time:'12:40', ground:'1' },
        { id:'grp_b_m30', stage:'group', group_letter:'B', match_number:30, home_team_id:'frankfurter_fc_kerala', away_team_id:'bogey_fc',played:false, match_time:'12:40', ground:'2' },
        { id:'grp_c_m31', stage:'group', group_letter:'C', match_number:31, home_team_id:'sporting_mallus',       away_team_id:'marburg_fc_kerala',    played:false, match_time:'13:00', ground:'1' },
        { id:'grp_d_m32', stage:'group', group_letter:'D', match_number:32, home_team_id:'adlers_lombard_b',      away_team_id:'slovak_titans_fc',     played:false, match_time:'13:00', ground:'2' },
        { id:'grp_a_m33', stage:'group', group_letter:'A', match_number:33, home_team_id:'adlers_lombard_a',      away_team_id:'monsoon_fc',           played:false, match_time:'13:20', ground:'1' },
        { id:'grp_b_m34', stage:'group', group_letter:'B', match_number:34, home_team_id:'kombans_fc',            away_team_id:'northern_knights_fc',  played:false, match_time:'13:20', ground:'2' },
        { id:'grp_c_m35', stage:'group', group_letter:'C', match_number:35, home_team_id:'club_de_swat_malta',    away_team_id:'edex_kings_kerala',    played:false, match_time:'13:40', ground:'1' },
        { id:'grp_d_m36', stage:'group', group_letter:'D', match_number:36, home_team_id:'hamburg_blasters',      away_team_id:'dresden_drifters_fc',  played:false, match_time:'13:40', ground:'2' },
        { id:'grp_a_m37', stage:'group', group_letter:'A', match_number:37, home_team_id:'kta_paris',             away_team_id:'minnal_bayern_titans', played:false, match_time:'14:00', ground:'1' },
        { id:'grp_b_m38', stage:'group', group_letter:'B', match_number:38, home_team_id:'hamburg_blasters_hawks',              away_team_id:'bogey_fc',played:false, match_time:'14:00', ground:'2' },
        { id:'grp_c_m39', stage:'group', group_letter:'C', match_number:39, home_team_id:'marburg_fc_kerala',     away_team_id:'inter_freiburg_fc',    played:false, match_time:'14:20', ground:'1' },
        { id:'grp_d_m40', stage:'group', group_letter:'D', match_number:40, home_team_id:'minnal_bayern_knights', away_team_id:'slovak_titans_fc',     played:false, match_time:'14:20', ground:'2' },
      ];
      const KO_MATCHES = [
        { id:'qf1',   stage:'QF', label:'Quarter-Final 1', home_source:'A1',       away_source:'B2',       match_number:41, played:false, match_time:'15:00', ground:'1' },
        { id:'qf2',   stage:'QF', label:'Quarter-Final 2', home_source:'B1',       away_source:'A2',       match_number:42, played:false, match_time:'15:00', ground:'2' },
        { id:'qf3',   stage:'QF', label:'Quarter-Final 3', home_source:'C1',       away_source:'D2',       match_number:43, played:false, match_time:'15:30', ground:'1' },
        { id:'qf4',   stage:'QF', label:'Quarter-Final 4', home_source:'D1',       away_source:'C2',       match_number:44, played:false, match_time:'15:30', ground:'2' },
        { id:'sf1',   stage:'SF', label:'Semi-Final 1',    home_source:'QF1 Winner',away_source:'QF2 Winner',match_number:45,played:false, match_time:'16:00', ground:'1' },
        { id:'sf2',   stage:'SF', label:'Semi-Final 2',    home_source:'QF3 Winner',away_source:'QF4 Winner',match_number:46,played:false, match_time:'16:00', ground:'2' },
        { id:'third', stage:'3P', label:'3rd Place Play-off', home_source:'SF1 Loser', away_source:'SF2 Loser', match_number:47, played:false, match_time:'17:00', ground:'2' },
        { id:'final', stage:'F',  label:'Final',              home_source:'SF1 Winner',away_source:'SF2 Winner',match_number:48, played:false, match_time:'17:20', ground:'1' },
      ];
      await db.deleteAllMatches();
      await db.upsertMatches(GROUP_MATCHES);
      await db.upsertMatches(KO_MATCHES);
      await reload();
      toast('48 matches imported from official schedule!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const handleGroupMove = async (teamId, groupLetter) => {
    if (!teamId) return;
    setBusy(true);
    try {
      if (groupLetter === 'pool') {
        await db.deleteGroupAssignment(teamId);
        toast('Team returned to pool', 'info');
      } else {
        const currentCount = groups[groupLetter]?.length || 0;
        const maxPerGroup = Math.ceil(teams.length / 4);
        if (currentCount >= maxPerGroup) {
          toast(`Group ${groupLetter} is already full (maximum ${maxPerGroup} teams)`, 'error');
        } else {
          await db.upsertGroupAssignment(teamId, groupLetter, currentCount);
          toast(`Assigned to Group ${groupLetter}`, 'success');
        }
      }
      await reload();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
    setDrawActiveTeamId(null);
  };

  const handleDragStart = (e, teamId) => {
    e.dataTransfer.setData('text/plain', teamId);
    e.target.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = async (e, targetGroup) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const teamId = e.dataTransfer.getData('text/plain');
    if (teamId) {
      await handleGroupMove(teamId, targetGroup);
    }
  };

  const handleTapSelection = (teamId) => {
    if (drawActiveTeamId === teamId) {
      setDrawActiveTeamId(null);
    } else {
      setDrawActiveTeamId(teamId);
      toast('Tapped! Now tap any Group header or Pool to place team.', 'info');
    }
  };

  const saveMatchDetails = async (matchId) => {
    const hs = document.getElementById(`hs_${matchId}`)?.value;
    const as = document.getElementById(`as_${matchId}`)?.value;
    const gr = document.getElementById(`gr_${matchId}`)?.value;
    const ti = document.getElementById(`ti_${matchId}`)?.value;
    const hp = document.getElementById(`hp_${matchId}`)?.value;
    const ap = document.getElementById(`ap_${matchId}`)?.value;

    setBusy(true);
    try {
      const m = matches.find(x => x.id === matchId);
      const updates = {
        id: matchId,
        ground: gr || null,
        match_time: ti || null,
      };

      if (hs !== '' && as !== '') {
        const homeScore = parseInt(hs), awayScore = parseInt(as);
        updates.home_score = homeScore;
        updates.away_score = awayScore;
        updates.played = true;

        // Penalty shootout (only for knockout matches)
        if (m.stage !== 'group' && hp !== undefined && hp !== '' && ap !== undefined && ap !== '') {
          const homePen = parseInt(hp), awayPen = parseInt(ap);
          updates.home_penalties = homePen;
          updates.away_penalties = awayPen;
          updates.winner_team_id = homePen > awayPen ? m.home_team_id : awayPen > homePen ? m.away_team_id : null;
        } else {
          updates.home_penalties = null;
          updates.away_penalties = null;
          updates.winner_team_id = homeScore > awayScore ? m.home_team_id : awayScore > homeScore ? m.away_team_id : null;
        }
      } else {
        updates.home_score = null;
        updates.away_score = null;
        updates.home_penalties = null;
        updates.away_penalties = null;
        updates.played = false;
        updates.winner_team_id = null;
      }

      await db.upsertMatch(updates);
      // Auto-advance knockout bracket based on current results
      await db.checkAndAutoAdvance();
      await reload();
      toast('Match updated successfully!', 'success');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const addEvent = async (matchId) => {
    const type = document.getElementById(`et_${matchId}`)?.value;
    const pid = document.getElementById(`ep_${matchId}`)?.value;
    const min = document.getElementById(`em_${matchId}`)?.value;
    if (!pid) { toast('Select a player', 'error'); return; }
    const player = players.find(p => p.id === pid);
    try {
      await db.insertEvent({ match_id: matchId, type, player_id: pid, team_id: player?.team_id, player_name: player?.name, minute: min ? parseInt(min) : null });
      await reload();
      toast('Match event logged!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleColorUpdate = async (teamId, field, colorVal) => {
    try {
      await db.updateTeam(teamId, { [field]: colorVal });
      await reload();
      toast('Colors updated!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const addPlayer = async () => {
    if (!selTeam || !pName.trim()) { toast('Select a team and enter name', 'error'); return; }
    try {
      await db.insertPlayer({ team_id: selTeam, name: pName.trim(), number: pNum ? parseInt(pNum) : null, position: pPos, is_starter: pStarter });
      setPName(''); setPNum('');
      await reload();
      toast('Player created!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleLogoSelect = (teamId, file) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setCropData({ teamId, imageSrc: reader.result?.toString() || '' });
      setZoom(1);
      setCropPos({ x: 0, y: 0 });
    });
    reader.readAsDataURL(file);
  };

  const handleApplyCrop = async () => {
    if (!cropData || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const croppedBlob = await getCroppedImg(cropData.imageSrc, croppedAreaPixels);
      const url = await db.uploadTeamLogo(cropData.teamId, croppedBlob);
      await db.updateTeam(cropData.teamId, { logo_url: url });
      await reload();
      toast('Logo cropped and assigned successfully!', 'success');
      setCropData(null);
    } catch (e) {
      toast(e.message, 'error');
    }
    setBusy(false);
  };

  // ── Copy Template to Clipboard ───────────────────────────────────────────
  const copyTemplate = () => {
    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    const header = 'Team Name\tPlayer Name\tJersey Number\tPosition';
    const rows = sortedTeams.flatMap(t =>
      Array(11).fill(null).map(() => `${t.name}\t\t\t`)
    );
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast(`Template copied! Paste into Google Sheets, fill in the players, then copy all rows and paste back here.`, 'success');
    }).catch(() => {
      toast('Copy failed — try manually selecting the text area', 'error');
    });
  };

  // ── Detect separator and parse lines (shared by preview + import) ──────────
  const parseLines = (text) => {
    const lines = text.split(/\r?\n|\r/).map(l => l.trimEnd()).filter(l => l.trim() !== '');
    if (lines.length === 0) return { sep: '\t', parsed: [], hasHeader: false, dataRows: [] };

    // Try separators in order; pick the one that gives ≥4 columns on first line
    let sep = '\t';
    for (const candidate of ['\t', ',', ';', '|']) {
      if (lines[0].includes(candidate) && lines[0].split(candidate).length >= 4) {
        sep = candidate;
        break;
      }
    }

    const parsed = lines.map(l => l.split(sep).map(c => c.trim()));

    // Detect header row
    const firstCell = parsed[0]?.[0]?.toLowerCase().replace(/\s+/g, '') || '';
    const hasHeader = firstCell === 'teamname' || firstCell === 'team';
    const dataRows  = hasHeader ? parsed.slice(1) : parsed;

    return { sep, parsed, hasHeader, dataRows };
  };

  // ── Parse + Import pasted data ────────────────────────────────────────────
  const handlePasteImport = async () => {
    const text = pasteText.trim();
    if (!text) { toast('Nothing to import — paste your data first', 'error'); return; }

    setBusy(true);
    setImportReport(null);
    try {
      const { sep, dataRows, hasHeader } = parseLines(text);

      if (dataRows.length === 0) {
        toast('No data rows found — check the format', 'error');
        setBusy(false);
        return;
      }

      // Check if we're getting 4 columns — if not, separator failed
      const firstDataCols = dataRows[0]?.length || 0;
      if (firstDataCols < 2) {
        toast(`Could not detect columns (found ${firstDataCols}). Make sure columns are separated by Tab, comma, semicolon, or pipe.`, 'error');
        setBusy(false);
        return;
      }

      // Build name→id cache
      const teamCache = {};
      teams.forEach(t => { teamCache[t.name.toLowerCase()] = t.id; });

      let imported = 0;
      const errors   = [];
      const warnings = [];

      for (let i = 0; i < dataRows.length; i++) {
        const cols    = dataRows[i];
        const lineNum = i + (hasHeader ? 2 : 1);

        const rawTeam = cols[0] || '';
        const rawName = cols[1] || '';
        const rawNum  = cols[2] || '';
        const rawPos  = (cols[3] || '').toUpperCase();

        // Skip blank lines silently
        if (!rawTeam && !rawName) continue;

        let rowHasError = false;

        // ── Team Name ──
        if (!rawTeam) {
          errors.push({ row: lineNum, field: 'Team Name', value: '(empty)', reason: 'Team Name is required' });
          rowHasError = true;
        } else {
          const teamId = teamCache[rawTeam.toLowerCase()];
          if (!teamId) {
            const closeMatch = teams.find(t =>
              t.name.toLowerCase().includes(rawTeam.toLowerCase().slice(0, 5)) ||
              rawTeam.toLowerCase().includes(t.name.toLowerCase().slice(0, 5))
            );
            errors.push({
              row: lineNum, field: 'Team Name', value: rawTeam,
              reason: closeMatch
                ? `Not found — did you mean "${closeMatch.name}"?`
                : `Not found — copy the exact name from the template`,
            });
            rowHasError = true;
          }
        }

        // ── Player Name ──
        if (!rawName) {
          errors.push({ row: lineNum, field: 'Player Name', value: '(empty)', reason: 'Player Name is required' });
          rowHasError = true;
        }

        if (rowHasError) continue;

        // ── Jersey Number (warning only) ──
        const jNum = parseInt(rawNum) || null;
        if (rawNum && isNaN(parseInt(rawNum))) {
          warnings.push({ row: lineNum, field: 'Jersey Number', value: rawNum, reason: `"${rawNum}" is not a number — left blank` });
        } else if (jNum !== null && (jNum < 1 || jNum > 99)) {
          warnings.push({ row: lineNum, field: 'Jersey Number', value: rawNum, reason: `${jNum} is outside 1–99 — saved anyway` });
        }

        // ── Position (warning only, defaults to MID) ──
        const validPos = ['GK', 'DEF', 'MID', 'FWD'];
        const pos = validPos.includes(rawPos) ? rawPos : 'MID';
        if (rawPos && !validPos.includes(rawPos)) {
          warnings.push({ row: lineNum, field: 'Position', value: rawPos, reason: `"${rawPos}" not valid (use GK / DEF / MID / FWD) — defaulted to MID` });
        }

        const teamId = teamCache[rawTeam.toLowerCase()];
        await db.insertPlayer({ team_id: teamId, name: rawName, number: jNum, position: pos, is_starter: false });
        imported++;
      }

      await reload();
      setImportReport({ imported, errors, warnings });

      if (errors.length === 0 && warnings.length === 0) {
        toast(`✅ ${imported} players imported!`, 'success');
        setPasteText('');
      } else if (errors.length > 0) {
        toast(`Imported ${imported}. ${errors.length} row${errors.length !== 1 ? 's' : ''} had errors — see report below.`, 'error');
      } else {
        toast(`✅ ${imported} players imported with ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}.`, 'info');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to parse pasted data — check the format', 'error');
    }
    setBusy(false);
  };

  // ── Shot handlers ─────────────────────────────────────────────────────────
  const handleSaveShot = async (shotData) => {
    try {
      await db.insertShot(shotData);
      await reload();
      toast('Shot recorded!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleDeleteShot = async (shotId) => {
    try {
      await db.deleteShot(shotId);
      await reload();
      toast('Shot removed', 'info');
    } catch (e) { toast(e.message, 'error'); }
  };

  // ── Possession handler ────────────────────────────────────────────────────
  const handleSavePossession = async (matchId, homeSeconds, awaySeconds) => {
    try {
      await db.upsertPossession(matchId, homeSeconds, awaySeconds);
      await reload();
      toast('Possession saved!', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  // ── Match status handlers ─────────────────────────────────────────────────
  const handleStartMatch = async (matchId) => {
    try {
      await db.updateMatchStatus(matchId, 'live');
      await reload();
      toast('Match started! 🟢', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const handleEndMatch = async (matchId) => {
    try {
      await db.updateMatchStatus(matchId, 'finished');
      await reload();
      toast('Match ended!', 'info');
    } catch (e) { toast(e.message, 'error'); }
  };

  // Find unassigned teams for draw
  const assignedTeamIds = groupAssignments.map(ga => ga.team_id);
  const unassignedTeams = teams.filter(t => !assignedTeamIds.includes(t.id));

  const isBeta = user.email === 'beta@keff.com';

  const tabs = isBeta
    ? [{ key: 'matches', label: 'Matches' }]
    : [
        { key: 'dash', label: 'Dashboard' },
        { key: 'draw', label: 'Group Draw' },
        { key: 'matches', label: 'Matches' },
        { key: 'teams', label: 'Teams & Logos' },
        { key: 'players', label: 'Rosters' },
        { key: 'awards', label: 'Awards' },
        { key: 'squads', label: 'Squads' },
        { key: 'managers', label: 'Manager Passwords' },
        { key: 'graphics', label: 'Live Graphics' },
        { key: 'downloads', label: 'Downloads' },
      ];

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1rem' }}>Admin Panel</div>
          <div style={{ fontSize: '0.68rem', color: '#666' }}>{user.email}</div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={async () => { await signOut(); toast('Logged out successfully', 'info'); }}>Logout</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'var(--card)', borderBottom: '1px solid var(--border)', overflowX: 'auto', position: 'sticky', top: 0, zIndex: 30 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className="tappable"
            style={{ 
              flex: '1 0 auto', 
              padding: '12px 16px', 
              fontSize: '0.72rem', 
              fontWeight: 800,
              textTransform: 'uppercase',
              background: 'transparent', 
              color: tab === t.key ? COLORS.gold : '#666',
              borderBottom: tab === t.key ? `2px solid ${COLORS.gold}` : '2px solid transparent' 
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* DASHBOARD */}
        {tab === 'dash' && (
          <div className="stagger">
            <div className="admin-grid">
              {[{ v: teams.length, l: 'Teams' }, { v: played, l: 'Played' }, { v: totalGoals, l: 'Goals' }, { v: players.length, l: 'Players' }].map(s => (
                <div key={s.l} className="admin-stat animate-fade"><div className="admin-stat-value">{s.v}</div><div className="admin-stat-label">{s.l}</div></div>
              ))}
            </div>

            <div className="kcard" style={{ padding: 16, marginTop: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 12, fontSize: '0.85rem' }}>Setup Checklist</div>
              {[
                { done: teams.length >= 20, label: 'Teams seeded (20)' },
                { done: hasGroups, label: 'Group draw done' },
                { done: matches.length > 0, label: 'Fixtures generated' },
                { done: played > 0, label: 'First match played' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: '0.82rem' }}>
                  <span style={{ color: s.done ? COLORS.green : '#555', fontWeight: 'bold' }}>{s.done ? '[Done]' : '[Pending]'}</span>
                  <span style={{ color: s.done ? COLORS.green : '#888' }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Bulk Player Import */}
            <div className="kcard" style={{ padding: 16, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>📋 Bulk Player Import</div>
                <button onClick={copyTemplate} disabled={teams.length === 0}
                  style={{ padding: '5px 10px', fontWeight: 700, fontSize: '0.65rem',
                    borderRadius: 6, background: 'rgba(0,200,83,0.1)', color: '#00C853',
                    border: '1px solid rgba(0,200,83,0.3)', cursor: 'pointer' }}>
                  Copy Template
                </button>
              </div>

              <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: 8 }}>
                Columns: <strong style={{ color: '#aaa' }}>Team Name · Player Name · Jersey Number · Position</strong> — paste from any spreadsheet, tab or comma separated.
              </div>

              <textarea
                value={pasteText}
                onChange={e => { setPasteText(e.target.value); setImportReport(null); }}
                placeholder={'Paste your data here…\n\nTeam Name\tPlayer Name\tJersey Number\tPosition\nAdlers Lombard A FC\tJohn Smith\t10\tFWD'}
                rows={10}
                style={{
                  width: '100%', padding: '10px', fontSize: '0.72rem',
                  fontFamily: 'monospace', lineHeight: 1.6,
                  borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--card2)', color: 'var(--text)',
                  resize: 'vertical', boxSizing: 'border-box', marginBottom: 8,
                }}
              />

              {/* Live parse preview */}
              {pasteText.trim() && (() => {
                const { sep, dataRows } = parseLines(pasteText);
                const colCount = dataRows[0]?.length || 0;
                const validRows = dataRows.filter(r => r[0]?.trim() || r[1]?.trim());
                const uniqueTeams = [...new Set(validRows.map(r => r[0]).filter(Boolean))];
                const ok = colCount >= 4;
                const sepLabel = { '\t': 'Tab', ',': 'Comma', ';': 'Semicolon', '|': 'Pipe' }[sep] || 'Unknown';
                return (
                  <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, fontSize: '0.68rem',
                    background: ok ? 'rgba(0,200,83,0.07)' : 'rgba(255,61,87,0.07)',
                    border: `1px solid ${ok ? 'rgba(0,200,83,0.2)' : 'rgba(255,61,87,0.25)'}` }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginBottom: ok && validRows.length ? 6 : 0 }}>
                      <span style={{ fontWeight: 800, color: ok ? '#00C853' : '#FF3D57' }}>
                        {ok ? '✓' : '✗'} {colCount} column{colCount !== 1 ? 's' : ''} · {sepLabel} separator
                      </span>
                      <span style={{ color: '#888' }}>{validRows.length} player row{validRows.length !== 1 ? 's' : ''}</span>
                      {uniqueTeams.length > 0 && <span style={{ color: '#888' }}>{uniqueTeams.length} team{uniqueTeams.length !== 1 ? 's' : ''}</span>}
                    </div>
                    {!ok && <div style={{ color: '#FF7070', marginTop: 2 }}>Could not detect 4 columns — use Tab or comma between columns.</div>}
                    {ok && validRows.slice(0, 2).map((row, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 6,
                        padding: '3px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
                        color: '#aaa', fontFamily: 'monospace', fontSize: '0.62rem' }}>
                        {[row[0], row[1], row[2], row[3]].map((v, j) => (
                          <span key={j} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v || '—'}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}

              <button onClick={handlePasteImport} disabled={busy || !pasteText.trim()}
                style={{ width: '100%', padding: '12px', fontWeight: 900, fontSize: '0.88rem',
                  borderRadius: 8, background: pasteText.trim() ? COLORS.gold : 'var(--card2)',
                  color: pasteText.trim() ? COLORS.dark : '#555',
                  border: `1px solid ${pasteText.trim() ? COLORS.gold : 'var(--border)'}`,
                  cursor: pasteText.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
                {busy ? 'Importing…' : '⬆ Import Players'}
              </button>

              {/* ── Import Report ── */}
              {importReport && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: 'Imported', val: importReport.imported, color: '#00C853', bg: 'rgba(0,200,83,0.1)', border: 'rgba(0,200,83,0.25)' },
                      { label: 'Errors',   val: importReport.errors.length,   color: importReport.errors.length   ? '#FF3D57' : '#555', bg: importReport.errors.length   ? 'rgba(255,61,87,0.1)'  : 'rgba(255,255,255,0.04)', border: importReport.errors.length   ? 'rgba(255,61,87,0.25)'  : 'var(--border)' },
                      { label: 'Warnings', val: importReport.warnings.length, color: importReport.warnings.length ? '#FF9100' : '#555', bg: importReport.warnings.length ? 'rgba(255,145,0,0.1)' : 'rgba(255,255,255,0.04)', border: importReport.warnings.length ? 'rgba(255,145,0,0.25)' : 'var(--border)' },
                    ].map(s => (
                      <div key={s.label} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}` }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#888', textTransform: 'uppercase' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {importReport.errors.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#FF3D57', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        Errors — these rows were SKIPPED
                      </div>
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,61,87,0.25)' }}>
                        {importReport.errors.map((err, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 88px 1fr', padding: '7px 10px', fontSize: '0.7rem', alignItems: 'center', borderBottom: i < importReport.errors.length - 1 ? '1px solid rgba(255,61,87,0.12)' : 'none', background: i % 2 === 0 ? 'rgba(255,61,87,0.06)' : 'rgba(255,61,87,0.03)' }}>
                            <span style={{ fontWeight: 900, color: '#FF3D57', fontFamily: 'monospace' }}>Row {err.row}</span>
                            <span style={{ fontWeight: 800, color: '#FF7090' }}>{err.field}</span>
                            <span style={{ color: '#ddd', lineHeight: 1.35 }}>
                              <span style={{ color: '#FF9999', fontFamily: 'monospace', marginRight: 4 }}>{err.value !== '(empty)' ? `"${err.value}"` : err.value}</span>
                              — {err.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importReport.warnings.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#FF9100', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        Warnings — imported but check these
                      </div>
                      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,145,0,0.25)' }}>
                        {importReport.warnings.map((w, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 88px 1fr', padding: '7px 10px', fontSize: '0.7rem', alignItems: 'center', borderBottom: i < importReport.warnings.length - 1 ? '1px solid rgba(255,145,0,0.12)' : 'none', background: i % 2 === 0 ? 'rgba(255,145,0,0.06)' : 'rgba(255,145,0,0.03)' }}>
                            <span style={{ fontWeight: 900, color: '#FF9100', fontFamily: 'monospace' }}>Row {w.row}</span>
                            <span style={{ fontWeight: 800, color: '#FFA940' }}>{w.field}</span>
                            <span style={{ color: '#ddd', lineHeight: 1.35 }}>
                              <span style={{ color: '#FFD080', fontFamily: 'monospace', marginRight: 4 }}>"{w.value}"</span>
                              — {w.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {importReport.errors.length === 0 && importReport.warnings.length === 0 && (
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00C853', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,200,83,0.08)', border: '1px solid rgba(0,200,83,0.2)' }}>
                      All rows imported with no issues!
                    </div>
                  )}

                  <button onClick={() => setImportReport(null)} style={{ marginTop: 8, background: 'transparent', border: 'none', color: '#555', fontSize: '0.62rem', cursor: 'pointer', padding: '2px 0' }}>
                    Dismiss report
                  </button>
                </div>
              )}
            </div>

            {/* Sync Bracket button — forces bracket advancement from current group standings */}
            <button className="btn btn-gold btn-block" style={{ marginTop: 12 }} disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                await db.checkAndAutoAdvance();
                await reload();
                toast('Bracket synced from current standings!', 'success');
              } catch (e) { toast(e.message, 'error'); }
              setBusy(false);
            }}>
              {busy ? 'Syncing…' : '⚡ Sync Bracket from Standings'}
            </button>

            {teams.length < 20 && (
              <button className="btn btn-gold btn-block" style={{ marginTop: 12 }} onClick={seedTeams} disabled={busy}>
                {busy ? 'Seeding…' : 'Seed 20 Default Teams'}
              </button>
            )}

            {/* Super Admin Database Reset Option */}
            {user?.email === 'precious@keff.com' && (
              <div className="kcard animate-fade" style={{ padding: 16, marginTop: 12, border: `2px solid ${COLORS.red}` }}>
                <div style={{ fontWeight: 800, marginBottom: 4, fontSize: '0.85rem', color: COLORS.red }}>Reset Database (Super Admin)</div>
                <p style={{ fontSize: '0.68rem', color: '#666', marginBottom: 12 }}>Warning: This will delete all players, group assignments, matches, tactics, and logged match events. The 20 default teams will remain.</p>
                <button className="btn btn-danger btn-block" onClick={async () => {
                  const typed = prompt('Type RESET to confirm. This deletes all matches, players, groups, shots and events. Teams are kept.');
                  if (typed?.trim().toUpperCase() !== 'RESET') return;
                  setBusy(true);
                  try {
                    await db.resetDatabase();
                    await reload();
                    toast('Database reset — teams preserved!', 'success');
                  } catch (e) {
                    toast(e.message, 'error');
                  }
                  setBusy(false);
                }} disabled={busy}>
                  {busy ? 'Resetting…' : 'Reset All Database Records'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* INTERACTIVE GROUP DRAW */}
        {tab === 'draw' && (
          <div>
          {user?.email !== 'precious@keff.com' ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 6 }}>Access Restricted</div>
              <div style={{ fontSize: '0.78rem', color: '#666' }}>Group Draw is only available to the tournament director.</div>
            </div>
          ) : (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-gold" onClick={autoDraw} disabled={busy || teams.length < 20}>
                {busy ? 'Processing…' : 'Shuffle Auto Draw'}
              </button>
              <button className="btn btn-success" onClick={genFixtures} disabled={busy || !hasGroups}>
                Generate Match Fixtures
              </button>
              <button className="btn btn-gold" onClick={importSchedule} disabled={busy}>
                Import Official Schedule
              </button>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 12, lineHeight: 1.4 }}>
              * Drag teams and drop them inside group areas (Desktop) or tap a team in the pool below and then tap a Group Box to place them (Mobile).
            </div>

            <div className="drag-container">
              {/* Unassigned Pool */}
              <div>
                <div 
                  onClick={() => drawActiveTeamId && handleGroupMove(drawActiveTeamId, 'pool')}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'pool')}
                  className={`group-dropzone ${drawActiveTeamId ? 'drag-over' : ''}`}
                  style={{ marginBottom: 16 }}
                >
                  <div className="group-dropzone-header">
                    <span className="group-dropzone-title">Unassigned Teams ({unassignedTeams.length})</span>
                  </div>
                  <div className="unassigned-pool">
                    {unassignedTeams.map(t => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleTapSelection(t.id)}
                        className={`drag-team ${drawActiveTeamId === t.id ? 'active' : ''}`}
                        style={{
                          border: drawActiveTeamId === t.id ? `2px solid ${COLORS.gold}` : undefined,
                          background: drawActiveTeamId === t.id ? 'rgba(255,212,0,0.1)' : undefined
                        }}
                      >
                        <TeamLogo team={t} size={28} />
                        <span>{t.name}</span>
                      </div>
                    ))}
                    {unassignedTeams.length === 0 && (
                      <div style={{ color: '#555', fontSize: '0.72rem', padding: 8 }}>All teams assigned</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Group Targets */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                {['A', 'B', 'C', 'D'].map(g => (
                  <div
                    key={g}
                    className="group-dropzone"
                    onClick={() => drawActiveTeamId && handleGroupMove(drawActiveTeamId, g)}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, g)}
                  >
                    <div className="group-dropzone-header">
                      <span className="group-dropzone-title">Group {g}</span>
                      <span className="group-dropzone-count">{groups[g]?.length || 0}/5 teams</span>
                    </div>
                    <div className="group-dropzone-list">
                      {(groups[g] || []).map(tid => (
                        <div key={tid} className="drag-team" style={{ cursor: 'default' }}>
                          <TeamLogo team={teamMap[tid]} size={28} />
                          <span style={{ flex: 1 }}>{teamMap[tid]?.name || tid}</span>
                          <button 
                            className="tappable"
                            style={{ background: 'transparent', color: COLORS.red, border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); handleGroupMove(tid, 'pool'); }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {(groups[g] || []).length === 0 && (
                        <div style={{ color: '#444', fontSize: '0.72rem', padding: '16px 0', textAlign: 'center' }}>
                          Drag or tap team here
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
          </div>
        )}

        {/* MATCHES */}
        {tab === 'matches' && (
          <div>
            {matches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>
                <div style={{ fontWeight: 700 }}>No match fixtures yet</div>
                <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Complete the group draw to generate fixtures first.</div>
              </div>
            ) : (
              (() => {
                const sorted = [...matches].sort((a, b) => (a.match_number || 0) - (b.match_number || 0));

                return sorted.map(m => {
                  const home = teamMap[m.home_team_id];
                  const away = teamMap[m.away_team_id];

                  return (
                    <React.Fragment key={m.id}>
                      {/* Clickable match card → navigates to AdminMatchPage */}
                      <div className="kcard tappable" style={{ marginBottom: 10, padding: '12px 14px',
                        border: m.stage === 'F' ? `2px solid ${COLORS.gold}40` : undefined,
                        cursor: 'pointer' }}
                        onClick={() => navigate('adminMatch', { matchId: m.id })}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666' }}>
                            {m.stage === 'group' ? `Match ${m.match_number} · Group ${m.group_letter}` : (m.label || m.stage)}
                            {m.match_time && <span style={{ marginLeft: 6 }}>· {m.match_time.slice(0,5)}</span>}
                            {m.ground && <span style={{ marginLeft: 6 }}>· Ground {m.ground}</span>}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {m.status === 'live' && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', fontWeight: 800, color: '#00C853' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00C853', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                                LIVE
                              </span>
                            )}
                            <span className={`pill ${m.played ? 'pill-green' : 'pill-muted'}`}>
                              {m.status === 'finished' ? 'Finished' : m.played ? 'Played' : 'Upcoming'}
                            </span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                            <TeamLogo team={home} size={26} />
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.name || m.home_source || '?'}</span>
                          </div>
                          <div style={{ flexShrink: 0, fontWeight: 900, fontSize: '1rem', color: m.played ? '#fff' : '#555', minWidth: 44, textAlign: 'center', letterSpacing: 1 }}>
                            {m.played ? `${m.home_score}:${m.away_score}` : '–:–'}
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end', minWidth: 0 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{away?.name || m.away_source || '?'}</span>
                            <TeamLogo team={away} size={26} />
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                });
              })()
            )}
          </div>
        )}

        {/* TEAMS & LOGOS */}
        {tab === 'teams' && (
          <div>
            {teams.map(t => (
              <div key={t.id} className="kcard" style={{ marginBottom: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <TeamLogo team={t} size={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem' }} className="truncate">{t.name}</div>
                    <div style={{ fontSize: '0.68rem', color: '#666' }}>{t.short_name}</div>
                  </div>
                </div>

                {/* Logo Upload & Color Picker in one line */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Set Team Logo (URL or Upload File)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="text" id={`url_${t.id}`} placeholder="Paste image URL..." defaultValue={t.logo_url || ''} style={{ flex: 1, minWidth: 120, padding: '6px 8px', fontSize: '0.72rem' }} />
                      <button className="btn btn-gold btn-sm" onClick={() => {
                        const url = document.getElementById(`url_${t.id}`)?.value;
                        if (url) {
                          db.updateTeam(t.id, { logo_url: url }).then(() => { reload(); toast('Logo URL applied!', 'success'); }).catch(e => toast(e.message, 'error'));
                        }
                      }}>Set URL</button>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#555' }}>OR</span>
                      <label className="btn btn-success btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                        Upload File
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                          if (e.target.files[0]) {
                            handleLogoSelect(t.id, e.target.files[0]);
                            e.target.value = null;
                          }
                        }} />
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Primary Color</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="color" defaultValue={t.primary_color || '#FFD400'} onChange={e => handleColorUpdate(t.id, 'primary_color', e.target.value)} style={{ padding: 0, width: 28, height: 24, border: 'none' }} />
                        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>{t.primary_color || '#FFD400'}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Secondary Color</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="color" defaultValue={t.secondary_color || '#282828'} onChange={e => handleColorUpdate(t.id, 'secondary_color', e.target.value)} style={{ padding: 0, width: 28, height: 24, border: 'none' }} />
                        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace' }}>{t.secondary_color || '#282828'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Instagram Page */}
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Instagram Page URL</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="text" id={`insta_${t.id}`} placeholder="https://www.instagram.com/teamname/" defaultValue={t.insta_page || ''} style={{ flex: 1, padding: '6px 8px', fontSize: '0.72rem' }} />
                      <button className="btn btn-gold btn-sm" onClick={() => {
                        const url = document.getElementById(`insta_${t.id}`)?.value;
                        db.updateTeam(t.id, { insta_page: url || null }).then(() => { reload(); toast('Instagram page saved!', 'success'); }).catch(e => toast(e.message, 'error'));
                      }}>Save</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ROSTERS */}
        {tab === 'players' && (
          <div>
            <div className="kcard" style={{ padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 10 }}>Create Player Profile</div>
              
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Select Team</label>
                <select value={selTeam} onChange={e => setSelTeam(e.target.value)}>
                  <option value="">Choose team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <div style={{ width: 64 }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Jersey #</label>
                  <input type="number" placeholder="10" value={pNum} onChange={e => setPNum(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Full Name</label>
                  <input placeholder="Lionel Messi" value={pName} onChange={e => setPName(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Position</label>
                  <select value={pPos} onChange={e => setPPos(e.target.value)}>
                    {['GK', 'DEF', 'MID', 'FWD'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Starting Status</label>
                  <select value={String(pStarter)} onChange={e => setPStarter(e.target.value === 'true')}>
                    <option value="false">Bench Player</option>
                    <option value="true">Starting 7</option>
                  </select>
                </div>
              </div>

              <button className="btn btn-gold btn-block" onClick={addPlayer}>Add Player to Roster</button>
            </div>

            {/* List teams and their rosters */}
            {selTeam && (
              <div className="kcard">
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TeamLogo team={teamMap[selTeam]} size={36} />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', flex: 1 }}>{teamMap[selTeam]?.name} Roster</span>
                  <span style={{ fontSize: '0.68rem', color: '#666' }}>{players.filter(p => p.team_id === selTeam).length} Players</span>
                </div>
                {players.filter(p => p.team_id === selTeam).sort((a, b) => (a.number || 99) - (b.number || 99)).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 900, color: COLORS.gold, width: 24 }}>#{p.number || '?'}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: '#666', fontSize: '0.68rem' }}>{p.position}</span>
                    <span style={{ fontSize: '0.62rem', color: p.is_starter ? COLORS.green : '#666', fontWeight: 700 }}>
                      {p.is_starter ? 'ST' : 'BN'}
                    </span>
                    <button 
                      style={{ background: 'transparent', color: COLORS.red, border: 'none', fontSize: '0.78rem', cursor: 'pointer', marginLeft: 4 }}
                      onClick={async () => { if(confirm(`Remove ${p.name}?`)) { await db.deletePlayer(p.id); await reload(); toast('Removed player successfully', 'info'); } }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {players.filter(p => p.team_id === selTeam).length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: '0.75rem' }}>No players registered for this team yet.</div>
                )}
              </div>
            )}

            {!selTeam && (
              <div style={{ textAlign: 'center', padding: 24, color: '#555', fontSize: '0.75rem' }}>
                Select a team above to view and manage its active roster.
              </div>
            )}
          </div>
        )}
      </div>

      {/* CROPPER MODAL */}
      {cropData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div className="kcard animate-fade" style={{ width: '90%', maxWidth: 460, height: '80vh', maxHeight: 600, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900 }}>Frame & Crop Logo</div>
              <button onClick={() => setCropData(null)} style={{ background: 'transparent', color: COLORS.red, fontWeight: 900, cursor: 'pointer', border: 'none', fontSize: '1rem' }}>✕</button>
            </div>
            
            <div style={{ position: 'relative', flex: 1, width: '100%', background: '#111' }}>
              <Cropper
                image={cropData.imageSrc}
                crop={cropPos}
                zoom={zoom}
                aspect={1}
                onCropChange={setCropPos}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
                onZoomChange={setZoom}
              />
            </div>
            
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>Zoom</span>
                <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
              </div>
              <button className="btn btn-gold btn-block" onClick={handleApplyCrop} disabled={busy}>
                {busy ? 'Applying Crop…' : 'Apply Crop & Save Logo'}
              </button>
            </div>
          </div>
        </div>
      )}
        {/* AWARDS */}
        {tab === 'awards' && (() => {
          const awardsMap = {};
          (awards || []).forEach(a => { awardsMap[a.category] = a; });

          return (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: '0.72rem', color: '#666', marginBottom: 16, textAlign: 'center' }}>
                Set the tournament award winners. Visible to all users on the Stats → Awards tab.
              </div>
              {AWARD_CATEGORIES.map(cat => {
                const award = awardsMap[cat.key];
                const isSet = award?.team_id || award?.player_id || award?.custom_name;

                return (
                  <div key={cat.key} className="kcard" style={{ padding: 14, marginBottom: 10,
                    border: isSet ? `1px solid ${cat.color}40` : '1px solid var(--border)' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: `${cat.color}20`, border: `1.5px solid ${cat.color}50`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, fontSize: '0.65rem', color: cat.color, letterSpacing: 0.5 }}>
                        {cat.medal}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: cat.color, flex: 1 }}>{cat.label}</div>
                      {isSet && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#00C853',
                          background: 'rgba(0,200,83,0.1)', padding: '2px 8px', borderRadius: 6 }}>Set</span>
                      )}
                    </div>

                    {/* Current winner preview */}
                    {isSet && (() => {
                      const team = award.team_id ? teamMap[award.team_id] : null;
                      const player = award.player_id ? players.find(p => p.id === award.player_id) : null;
                      const playerTeam = player ? teamMap[player.team_id] : null;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 8, background: `${cat.color}10`,
                          marginBottom: 10 }}>
                          {team && <><TeamLogo team={team} size={32} /><span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{team.name}</span></>}
                          {player && <><TeamLogo team={playerTeam} size={32} /><div><div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{player.name}</div><div style={{ fontSize: '0.62rem', color: '#888' }}>{playerTeam?.short_name} · {player.position}</div></div></>}
                          {award.custom_name && <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{award.custom_name}</span>}
                        </div>
                      );
                    })()}

                    {/* Picker */}
                    {cat.type === 'team' && (
                      <select defaultValue={award?.team_id || ''}
                        onChange={async e => {
                          try {
                            await db.upsertAward(cat.key, { team_id: e.target.value || null, player_id: null, custom_name: null });
                            reload(); toast(`${cat.label} saved!`, 'success');
                          } catch (err) { toast(err.message, 'error'); }
                        }}
                        style={{ width: '100%' }}>
                        <option value="">— Choose team —</option>
                        {Object.values(teamMap).sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    {cat.type === 'player' && (
                      <select defaultValue={award?.player_id || ''}
                        onChange={async e => {
                          try {
                            await db.upsertAward(cat.key, { player_id: e.target.value || null, team_id: null, custom_name: null });
                            reload(); toast(`${cat.label} saved!`, 'success');
                          } catch (err) { toast(err.message, 'error'); }
                        }}
                        style={{ width: '100%' }}>
                        <option value="">— Choose player —</option>
                        {players
                          .filter(p => cat.key === 'best_gk' ? p.position === 'GK' : cat.key === 'best_defender' ? p.position === 'DEF' : true)
                          .sort((a,b) => (teamMap[a.team_id]?.name || '').localeCompare(teamMap[b.team_id]?.name || '') || a.name.localeCompare(b.name))
                          .map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {teamMap[p.team_id]?.short_name || '?'} ({p.position || '?'})
                            </option>
                          ))
                        }
                      </select>
                    )}
                    {cat.type === 'custom' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input id={`award_custom_${cat.key}`} defaultValue={award?.custom_name || ''}
                          placeholder="Enter name…"
                          style={{ flex: 1 }} />
                        <button className="btn btn-gold btn-sm"
                          onClick={async () => {
                            const val = document.getElementById(`award_custom_${cat.key}`)?.value;
                            try {
                              await db.upsertAward(cat.key, { custom_name: val || null, team_id: null, player_id: null });
                              reload(); toast(`${cat.label} saved!`, 'success');
                            } catch (err) { toast(err.message, 'error'); }
                          }}>
                          Save
                        </button>
                      </div>
                    )}
                    {isSet && (
                      <button onClick={async () => {
                        try {
                          await db.upsertAward(cat.key, { team_id: null, player_id: null, custom_name: null });
                          reload(); toast('Award cleared', 'info');
                        } catch (err) { toast(err.message, 'error'); }
                      }}
                        style={{ marginTop: 8, width: '100%', padding: '6px', borderRadius: 8,
                          background: 'transparent', border: '1px solid rgba(255,61,87,0.3)',
                          color: '#FF3D57', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                        Clear Award
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── SQUADS ── */}
        {tab === 'squads' && <SquadsPanel teams={teams} players={players} />}

        {/* ── MANAGER PASSWORDS ── */}
        {tab === 'managers' && <ManagerPasswordsPanel teams={teams} />}

        {/* ── LIVE GRAPHICS ── */}
        {tab === 'graphics' && <LiveGraphicsPanel teams={teams} matches={matches} teamMap={teamMap} />}

        {/* ── DOWNLOADS ── */}
        {tab === 'downloads' && <DownloadsPanel teams={teams} matches={matches} teamMap={teamMap} groupAssignments={groupAssignments} groups={groups} players={players} />}

    </div>
  );
}

// ─── SQUADS PANEL ────────────────────────────────────────────────────────────
const SQUAD_TYPES = [
  { value: 'player',  label: 'Players',  limit: 12 },
  { value: 'reserve', label: 'Reserves', limit: 3  },
  { value: 'manager', label: 'Managers', limit: 2  },
];

function SquadsPanel({ teams, players }) {
  const [selTeam, setSelTeam] = React.useState('');
  const [regOpen, setRegOpen] = React.useState(true);
  const [loadingReg, setLoadingReg] = React.useState(true);
  const [toggling, setToggling] = React.useState(false);

  React.useEffect(() => {
    db.getTournamentState('squad_registration').then(val => {
      setRegOpen(val?.open !== false);
      setLoadingReg(false);
    }).catch(() => setLoadingReg(false));
  }, []);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const next = !regOpen;
      await db.setTournamentState('squad_registration', { open: next });
      setRegOpen(next);
      toast(next ? '✅ Squad registration opened' : '🔒 Squad registration closed', 'success');
    } catch (err) { toast(err.message || 'Failed', 'error'); }
    setToggling(false);
  };

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const teamPlayers = selTeam
    ? players.filter(p => p.team_id === selTeam).sort((a, b) => (a.number ?? 99) - (b.number ?? 99))
    : [];

  const counts = selTeam ? {
    player:  teamPlayers.filter(p => (p.player_type || 'player') === 'player').length,
    reserve: teamPlayers.filter(p => p.player_type === 'reserve').length,
    manager: teamPlayers.filter(p => p.player_type === 'manager').length,
  } : null;

  const keralite    = teamPlayers.filter(p => p.player_type !== 'manager' && (p.player_category || 'Keralite') === 'Keralite').length;
  const nonKeralite = teamPlayers.filter(p => p.player_type !== 'manager' && p.player_category === 'Non-Keralite').length;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontWeight: 900, fontSize: '1rem', marginBottom: 4 }}>Squad Submissions</h3>
        <p style={{ color: '#888', fontSize: '0.78rem', margin: 0 }}>
          View the squad registered by each team's manager. Deadline: 31st May 2026.
        </p>
      </div>

      {/* Registration status + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1px solid ${regOpen ? 'rgba(0,200,83,0.35)' : 'rgba(255,61,87,0.35)'}`, background: regOpen ? 'rgba(0,200,83,0.06)' : 'rgba(255,61,87,0.06)', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: regOpen ? '#00C853' : '#FF3D57' }}>
            {loadingReg ? '…' : regOpen ? '🟢 Registration Open' : '🔴 Registration Closed'}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 2 }}>
            {regOpen ? 'Managers can add and edit their squad members.' : 'Managers cannot add or edit squad members.'}
          </div>
        </div>
        <button onClick={handleToggle} disabled={toggling || loadingReg}
          style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 10, fontWeight: 800, fontSize: '0.78rem', cursor: toggling || loadingReg ? 'not-allowed' : 'pointer', border: 'none', background: regOpen ? '#FF3D57' : '#00C853', color: '#fff', opacity: toggling || loadingReg ? 0.6 : 1, whiteSpace: 'nowrap' }}>
          {toggling ? '…' : regOpen ? '🔒 Close Registration' : '🔓 Open Registration'}
        </button>
      </div>

      {/* All-teams summary table */}
      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Team', 'Players', 'Reserves', 'Managers', 'Keralite', 'Non-K', 'Total'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Team' ? 'left' : 'center', fontWeight: 800, color: '#888', textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: 0.4 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map(team => {
              const tp = players.filter(p => p.team_id === team.id);
              const pl = tp.filter(p => (p.player_type || 'player') === 'player').length;
              const re = tp.filter(p => p.player_type === 'reserve').length;
              const mg = tp.filter(p => p.player_type === 'manager').length;
              const ker = tp.filter(p => p.player_type !== 'manager' && (p.player_category || 'Keralite') === 'Keralite').length;
              const nonK = tp.filter(p => p.player_type !== 'manager' && p.player_category === 'Non-Keralite').length;
              const total = pl + re + mg;
              const isSelected = selTeam === team.id;
              return (
                <tr key={team.id}
                  onClick={() => setSelTeam(isSelected ? '' : team.id)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'rgba(255,212,0,0.06)' : 'transparent' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 700 }}>{team.short_name}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: pl >= 12 ? '#00C853' : pl > 0 ? '#FFD400' : '#555' }}>{pl}/12</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: re >= 3 ? '#00C853' : re > 0 ? '#FFD400' : '#555' }}>{re}/3</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: mg >= 2 ? '#00C853' : mg > 0 ? '#FFD400' : '#555' }}>{mg}/2</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: '#4CAF50' }}>{ker}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', color: '#FF9800' }}>{nonK}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 800 }}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detailed squad view */}
      {selTeam && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h4 style={{ fontWeight: 900, fontSize: '0.9rem', margin: 0 }}>
              {teams.find(t => t.id === selTeam)?.name} — Full Squad
            </h4>
            <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: '#888' }}>
              <span style={{ color: '#4CAF50' }}>● Keralite: {keralite}</span>
              <span style={{ color: '#FF9800' }}>● Non-K: {nonKeralite}</span>
            </div>
          </div>

          {teamPlayers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: 20, fontSize: '0.82rem' }}>No squad submitted yet</p>
          ) : (
            SQUAD_TYPES.map(pt => {
              const group = teamPlayers.filter(p => (p.player_type || 'player') === pt.value);
              if (group.length === 0) return null;
              return (
                <div key={pt.value} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingBottom: 5, borderBottom: '1px solid var(--border)' }}>
                    {pt.label} ({group.length}/{pt.limit})
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['#', 'Full Name', 'Position', 'Category'].map(h => (
                            <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Full Name' ? 'left' : 'center', fontWeight: 700, color: '#888', fontSize: '0.65rem', textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700, color: '#FFD400' }}>{p.number ?? '—'}</td>
                            <td style={{ padding: '7px 8px', fontWeight: 600 }}>{p.name}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center', color: '#aaa' }}>{p.position || '—'}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                              <span style={{ color: (p.player_category || 'Keralite') === 'Keralite' ? '#4CAF50' : '#FF9800', fontWeight: 700, fontSize: '0.72rem' }}>
                                {p.player_category || 'Keralite'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── MANAGER PASSWORDS PANEL ─────────────────────────────────────────────────
function ManagerPasswordsPanel({ teams }) {
  const [passwords, setPasswords] = useState({});
  const [loadingPw, setLoadingPw] = useState(true);

  const reload = async () => {
    setLoadingPw(true);
    try {
      const rows = await db.fetchManagerPasswords();
      const map = {};
      rows.forEach(r => { map[r.team_id] = r.password; });
      setPasswords(map);
    } catch (err) {
      toast('Could not load passwords: ' + (err.message || err), 'error');
    }
    setLoadingPw(false);
  };

  React.useEffect(() => { reload(); }, []);

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontWeight: 900, fontSize: '1rem', marginBottom: 4 }}>Manager Portal Passwords</h3>
        <p style={{ color: '#888', fontSize: '0.78rem', margin: 0 }}>
          Set a password for each team's manager to log in to the Manager tab.
        </p>
      </div>
      {loadingPw ? (
        <div style={{ color: '#888', fontSize: '0.85rem', padding: '20px 0' }}>Loading passwords…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedTeams.map(team => (
            <ManagerPasswordRow key={team.id} team={team} currentPassword={passwords[team.id] || ''} onUpdated={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MANAGER PASSWORD ROW ────────────────────────────────────────────────────
function ManagerPasswordRow({ team, currentPassword, onUpdated }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);

  const handleSet = async e => {
    e.preventDefault();
    if (!pass.trim()) return;
    setBusy(true);
    try {
      await db.setManagerPassword(team.id, pass.trim());
      toast(`Password set for ${team.name}`, 'success');
      setPass('');
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      if (onUpdated) onUpdated();
    } catch (err) {
      toast(err.message || 'Failed to set password', 'error');
    }
    setBusy(false);
  };

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 8 }}>{team.name}</div>
      {/* Current password display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 22 }}>
        <span style={{ fontSize: '0.72rem', color: '#888', fontWeight: 700, flexShrink: 0 }}>CURRENT:</span>
        {currentPassword ? (
          <>
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', letterSpacing: 1, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {showCurrent ? currentPassword : '•'.repeat(Math.min(currentPassword.length, 12))}
            </span>
            <button
              type="button"
              onClick={() => setShowCurrent(s => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: '0.78rem', color: '#888', flexShrink: 0 }}
              title={showCurrent ? 'Hide' : 'Show'}
            >
              {showCurrent ? '🙈' : '👁️'}
            </button>
          </>
        ) : (
          <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#666', fontStyle: 'italic' }}>not set</span>
        )}
      </div>
      {/* Set new password */}
      <form onSubmit={handleSet} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={pass}
          onChange={e => setPass(e.target.value)}
          placeholder="New password…"
          style={{ flex: 1, fontFamily: 'monospace' }}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !pass.trim()}
          className="btn btn-gold btn-sm"
          style={{ flexShrink: 0, opacity: busy || !pass.trim() ? 0.6 : 1 }}>
          {busy ? '…' : done ? '✓' : 'Set'}
        </button>
      </form>
    </div>
  );
}

// ─── DOWNLOADS PANEL ─────────────────────────────────────────────────────────
function DownloadsPanel({ teams, matches, teamMap, groupAssignments, groups, players }) {

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const fmtTime = (t) => {
    if (!t) return '—';
    return String(t).slice(0, 5);
  };

  const stageLabel = s => ({
    group: 'Group Stage', 'round-of-16': 'Round of 16', r16: 'Round of 16',
    quarterfinal: 'Quarter Final', qf: 'Quarter Final',
    semifinal: 'Semi Final', sf: 'Semi Final',
    final: 'Final', third_place: '3rd Place Play-off',
  }[s] || s || '—');

  const getJsPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    return { jsPDF, autoTable };
  };

  const addHeader = (doc, title, subtitle = '') => {
    doc.setFillColor(13, 13, 13);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 212, 0);
    doc.text('ASIA CUP 2026', 14, 12);
    doc.setFontSize(10);
    doc.setTextColor(180, 180, 180);
    doc.text(title, 14, 20);
    if (subtitle) doc.text(subtitle, 14, 26);
    doc.setTextColor(0, 0, 0);
  };

  const addFooter = (doc) => {
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Asia Cup 2026  •  Page ${i} of ${pages}`, 14, 290);
      doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, 196, 290, { align: 'right' });
    }
  };

  // ── PDF 1: All Fixtures ──
  const downloadAllFixtures = async () => {
    const { jsPDF, autoTable } = await getJsPDF();
    const doc = new jsPDF();
    addHeader(doc, 'ALL FIXTURES');

    const sorted = [...matches].sort((a, b) => {
      if (a.match_date && b.match_date) return new Date(a.match_date) - new Date(b.match_date);
      return (a.match_number || 0) - (b.match_number || 0);
    });

    const rows = sorted.map(m => [
      m.match_number ? `#${m.match_number}` : '—',
      stageLabel(m.stage) + (m.group_letter ? ` ${m.group_letter}` : ''),
      teamMap[m.home_team_id]?.name || m.home_team_id || '—',
      teamMap[m.away_team_id]?.name || m.away_team_id || '—',
      fmtDate(m.match_date),
      fmtTime(m.match_time),
      m.ground || '—',
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['#', 'Stage', 'Home', 'Away', 'Date', 'Time', 'Ground']],
      body: rows,
      headStyles: { fillColor: [13, 13, 13], textColor: [255, 212, 0], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { cellWidth: 10 }, 4: { cellWidth: 26 }, 5: { cellWidth: 16, halign: 'center' }, 6: { cellWidth: 22 } },
      styles: { overflow: 'linebreak' },
    });

    addFooter(doc);
    doc.save('AsiaCup_All_Fixtures.pdf');
  };

  // ── PDF 2: Per Group Matches ──
  const downloadGroupFixtures = async () => {
    const { jsPDF, autoTable } = await getJsPDF();
    const doc = new jsPDF();
    let first = true;

    ['A', 'B', 'C', 'D'].forEach(g => {
      const gMatches = matches.filter(m => m.stage === 'group' && m.group_letter === g)
        .sort((a, b) => (a.match_number || 0) - (b.match_number || 0));
      if (!gMatches.length) return;

      if (!first) doc.addPage();
      first = false;

      addHeader(doc, `GROUP ${g} FIXTURES`);

      const rows = gMatches.map(m => [
        m.match_number ? `#${m.match_number}` : '—',
        teamMap[m.home_team_id]?.name || m.home_team_id || '—',
        teamMap[m.away_team_id]?.name || m.away_team_id || '—',
        fmtDate(m.match_date),
        fmtTime(m.match_time),
        m.ground || '—',
      ]);

      autoTable(doc, {
        startY: 32,
        head: [['#', 'Home', 'Away', 'Date', 'Time', 'Ground']],
        body: rows,
        headStyles: { fillColor: [13, 13, 13], textColor: [255, 212, 0], fontStyle: 'bold' },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: { 3: { cellWidth: 26 }, 4: { cellWidth: 16, halign: 'center' } },
      });

      // Group standings table — blank (teams listed, stats empty)
      const teamIds = groups[g] || [];
      const blankRows = teamIds.map((id, i) => [i + 1, teamMap[id]?.name || id, '', '', '', '', '', '', '', '']);

      const afterY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50);
      doc.text('STANDINGS', 14, afterY);

      autoTable(doc, {
        startY: afterY + 4,
        head: [['Pos', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']],
        body: blankRows,
        headStyles: { fillColor: [255, 212, 0], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' }, 9: { halign: 'center', fontStyle: 'bold' } },
      });
    });

    addFooter(doc);
    doc.save('AsiaCup_Group_Fixtures.pdf');
  };

  // ── PDF 3: Team List with Group Matches ──
  const downloadTeamList = async () => {
    const { jsPDF, autoTable } = await getJsPDF();
    const doc = new jsPDF();
    addHeader(doc, 'TEAM LIST');

    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

    // ── Page 1: All teams summary ──
    const teamRows = sortedTeams.map((t, i) => {
      const ga = (groupAssignments || []).find(g => g.team_id === t.id);
      const grp = ga?.group_letter || '—';
      return [i + 1, t.name, t.short_name, grp];
    });

    autoTable(doc, {
      startY: 32,
      head: [['No.', 'Team Name', 'Short Name', 'Group']],
      body: teamRows,
      headStyles: { fillColor: [13, 13, 13], textColor: [255, 212, 0], fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 28, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
      },
    });

    // ── Per-team match schedule pages ──
    sortedTeams.forEach(t => {
      const teamMatches = matches
        .filter(m => m.home_team_id === t.id || m.away_team_id === t.id)
        .sort((a, b) => (a.match_date && b.match_date ? new Date(a.match_date) - new Date(b.match_date) : (a.match_number || 0) - (b.match_number || 0)));

      doc.addPage();
      addHeader(doc, 'MATCH SCHEDULE', t.name.toUpperCase());

      if (!teamMatches.length) {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text('No matches scheduled yet.', 14, 40);
        return;
      }

      const rows = teamMatches.map(m => {
        const isHome = m.home_team_id === t.id;
        const opp = teamMap[isHome ? m.away_team_id : m.home_team_id]?.name || '—';
        return [
          stageLabel(m.stage) + (m.group_letter ? ` ${m.group_letter}` : ''),
          isHome ? 'Home' : 'Away',
          opp,
          fmtDate(m.match_date),
          fmtTime(m.match_time),
          m.ground || '—',
        ];
      });

      autoTable(doc, {
        startY: 32,
        head: [['Stage', 'H/A', 'Opponent', 'Date', 'Time', 'Ground']],
        body: rows,
        headStyles: { fillColor: [13, 13, 13], textColor: [255, 212, 0], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: { 1: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 26 }, 4: { cellWidth: 16, halign: 'center' } },
      });
    });

    addFooter(doc);
    doc.save('AsiaCup_Team_List.pdf');
  };

  // ── PDF 4: Team Squads ──
  const downloadSquads = async () => {
    const { jsPDF, autoTable } = await getJsPDF();
    const doc = new jsPDF();
    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    let first = true;

    sortedTeams.forEach(t => {
      const teamPlayers = (players || []).filter(p => p.team_id === t.id);
      if (!first) doc.addPage();
      first = false;

      const ga = (groupAssignments || []).find(g => g.team_id === t.id);
      const grp = ga ? `Group ${ga.group_letter}` : '';
      addHeader(doc, t.name.toUpperCase(), grp);

      const TYPES = [
        { key: 'player',  label: 'Players' },
        { key: 'reserve', label: 'Reserves' },
        { key: 'manager', label: 'Managers' },
      ];

      let startY = 34;

      TYPES.forEach(({ key, label }) => {
        const group = teamPlayers
          .filter(p => p.player_type === key)
          .sort((a, b) => (a.number || 999) - (b.number || 999));
        if (!group.length) return;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80);
        doc.text(label.toUpperCase(), 14, startY + 2);

        const rows = group.map(p => [
          p.number ?? '—',
          p.name,
          p.position || '—',
          p.player_category || '—',
        ]);

        autoTable(doc, {
          startY: startY + 5,
          head: [['#', 'Name', 'Position', 'Category']],
          body: rows,
          headStyles: {
            fillColor: key === 'player' ? [13, 13, 13] : key === 'reserve' ? [60, 60, 60] : [100, 100, 100],
            textColor: [255, 212, 0],
            fontStyle: 'bold',
            fontSize: 8,
          },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            2: { cellWidth: 24, halign: 'center' },
            3: { cellWidth: 30, halign: 'center' },
          },
          margin: { left: 14, right: 14 },
        });

        startY = doc.lastAutoTable.finalY + 8;
      });

      // Summary count
      const pCount = teamPlayers.filter(p => p.player_type === 'player').length;
      const rCount = teamPlayers.filter(p => p.player_type === 'reserve').length;
      const mCount = teamPlayers.filter(p => p.player_type === 'manager').length;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(130);
      doc.text(`Players: ${pCount}  |  Reserves: ${rCount}  |  Managers: ${mCount}`, 14, startY + 2);
      startY += 10;

      // ── Fixtures section ──
      const teamMatches = matches
        .filter(m => m.home_team_id === t.id || m.away_team_id === t.id)
        .sort((a, b) => (a.match_date && b.match_date ? new Date(a.match_date) - new Date(b.match_date) : (a.match_number || 0) - (b.match_number || 0)));

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80);
      doc.text('FIXTURES', 14, startY + 2);

      if (!teamMatches.length) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150);
        doc.text('No matches scheduled yet.', 14, startY + 8);
      } else {
        const fixtureRows = teamMatches.map(m => {
          const isHome = m.home_team_id === t.id;
          const opp = teamMap[isHome ? m.away_team_id : m.home_team_id]?.name || '—';
          return [
            stageLabel(m.stage) + (m.group_letter ? ` ${m.group_letter}` : ''),
            isHome ? 'Home' : 'Away',
            opp,
            fmtDate(m.match_date),
            fmtTime(m.match_time),
            m.ground || '—',
          ];
        });

        autoTable(doc, {
          startY: startY + 5,
          head: [['Stage', 'H/A', 'Opponent', 'Date', 'Time', 'Ground']],
          body: fixtureRows,
          headStyles: { fillColor: [255, 212, 0], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          columnStyles: {
            1: { cellWidth: 14, halign: 'center' },
            3: { cellWidth: 26 },
            4: { cellWidth: 16, halign: 'center' },
          },
          margin: { left: 14, right: 14 },
        });
      }
    });

    addFooter(doc);
    doc.save('AsiaCup_Team_Squads.pdf');
  };

  const cards = [
    {
      icon: null,
      title: 'All Fixtures',
      desc: 'Complete list of all matches across all stages — with date, time, ground and scores.',
      action: downloadAllFixtures,
      label: 'Download PDF',
    },
    {
      icon: null,
      title: 'Group Fixtures + Standings',
      desc: 'Matches and standings table for each group (A, B, C, D) — one group per page.',
      action: downloadGroupFixtures,
      label: 'Download PDF',
    },
    {
      icon: null,
      title: 'Team List + Match Schedule',
      desc: 'All teams with their full match schedule, results, and W/D/L per match.',
      action: downloadTeamList,
      label: 'Download PDF',
    },
    {
      icon: null,
      title: 'Team Squads',
      desc: 'Full squad list for all teams — players, reserves and managers with jersey numbers and positions.',
      action: downloadSquads,
      label: 'Download PDF',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 4 }}>
        Generate and download tournament PDFs. Data pulls from live database.
      </div>
      {cards.map(c => (
        <div key={c.title} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: 3 }}>{c.title}</div>
            <div style={{ fontSize: '0.72rem', color: '#888', lineHeight: 1.5 }}>{c.desc}</div>
          </div>
          <button onClick={c.action}
            style={{ flexShrink: 0, padding: '10px 18px', background: COLORS.gold, color: '#000', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {c.label}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── LIVE GRAPHICS PANEL ─────────────────────────────────────────────────────
const GROUNDS_CFG = [
  { key: 'ground1', label: 'Ground 1', channel: 'cac_live' },
  { key: 'ground2', label: 'Ground 2', channel: 'cac_live2' },
];

const DEFAULT_OVERLAY = {
  home: '', away: '', home_score: 0, away_score: 0, label: '',
  timer: { running: false, started_at: null, offset: 0 },
  visible: true,
};

function LiveGraphicsPanel({ teams, matches, teamMap }) {
  const [activeGround, setActiveGround] = React.useState('ground1');
  const [overlays, setOverlays] = React.useState({ ground1: { ...DEFAULT_OVERLAY }, ground2: { ...DEFAULT_OVERLAY } });
  const [saving, setSaving] = React.useState({ ground1: false, ground2: false });
  const [timerDisplay, setTimerDisplay] = React.useState({ ground1: '00:00', ground2: '00:00' });

  // Load saved state on mount
  React.useEffect(() => {
    GROUNDS_CFG.forEach(async g => {
      const val = await db.getTournamentState(`overlay_${g.key}`);
      if (val) setOverlays(prev => ({ ...prev, [g.key]: { ...DEFAULT_OVERLAY, ...val } }));
    });
  }, []);

  // Timer display tick
  React.useEffect(() => {
    const tick = () => {
      const displays = {};
      GROUNDS_CFG.forEach(g => {
        const t = overlays[g.key]?.timer || DEFAULT_OVERLAY.timer;
        let secs = t.offset || 0;
        if (t.running && t.started_at) secs += (Date.now() - new Date(t.started_at).getTime()) / 1000;
        secs = Math.max(0, Math.floor(secs));
        const m = String(Math.floor(secs / 60)).padStart(2, '0');
        const s = String(secs % 60).padStart(2, '0');
        displays[g.key] = `${m}:${s}`;
      });
      setTimerDisplay(displays);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [overlays]);

  const save = async (groundKey, newData) => {
    setSaving(prev => ({ ...prev, [groundKey]: true }));
    try {
      await db.setTournamentState(`overlay_${groundKey}`, newData);
      setOverlays(prev => ({ ...prev, [groundKey]: newData }));
      toast('Overlay updated', 'success');
    } catch (e) {
      toast('Save failed: ' + e.message, 'error');
    }
    setSaving(prev => ({ ...prev, [groundKey]: false }));
  };

  const update = (groundKey, field, value) => {
    setOverlays(prev => ({ ...prev, [groundKey]: { ...prev[groundKey], [field]: value } }));
  };

  const handleScoreChange = async (groundKey, side, delta) => {
    const o = overlays[groundKey];
    const field = side === 'home' ? 'home_score' : 'away_score';
    const newVal = Math.max(0, (o[field] || 0) + delta);
    const newData = { ...o, [field]: newVal };
    await save(groundKey, newData);
  };

  const handleTimerAction = async (groundKey, action) => {
    const o = overlays[groundKey];
    let t = { ...o.timer };
    if (action === 'start') {
      const elapsed = t.running && t.started_at ? (Date.now() - new Date(t.started_at).getTime()) / 1000 : 0;
      t = { running: true, started_at: new Date().toISOString(), offset: (t.offset || 0) + elapsed };
    } else if (action === 'stop') {
      const elapsed = t.running && t.started_at ? (Date.now() - new Date(t.started_at).getTime()) / 1000 : 0;
      t = { running: false, started_at: null, offset: (t.offset || 0) + elapsed };
    } else if (action === 'reset') {
      t = { running: false, started_at: null, offset: 0 };
    }
    await save(groundKey, { ...o, timer: t });
  };

  const handleSaveAll = async (groundKey) => {
    await save(groundKey, overlays[groundKey]);
  };

  const overlayUrl = (groundKey) => `${window.location.origin}${import.meta.env.BASE_URL}overlay-${groundKey}.html`;

  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      {/* Ground tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {GROUNDS_CFG.map(g => (
          <button key={g.key} onClick={() => setActiveGround(g.key)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: activeGround === g.key ? `2px solid ${COLORS.gold}` : '2px solid var(--border)', background: activeGround === g.key ? COLORS.gold : 'var(--card)', color: activeGround === g.key ? '#000' : 'var(--text)', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
            {g.label}
          </button>
        ))}
      </div>

      {GROUNDS_CFG.filter(g => g.key === activeGround).map(g => {
        const o = overlays[g.key] || DEFAULT_OVERLAY;
        const isSaving = saving[g.key];
        return (
          <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* OBS URL */}
            <div style={{ background: '#1a1a2e', border: '1px solid #9147ff', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#9147ff', marginBottom: 6, letterSpacing: 0.5 }}>OBS BROWSER SOURCE URL</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, fontSize: '0.68rem', color: '#ccc', wordBreak: 'break-all', lineHeight: 1.5 }}>{overlayUrl(g.key)}</code>
                <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(overlayUrl(g.key)); toast('Copied!', 'success'); }}
                  style={{ flexShrink: 0, background: '#9147ff', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: '0.72rem', fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                  Copy
                </button>
              </div>
              <div style={{ fontSize: '0.65rem', color: '#666', marginTop: 6 }}>In OBS: Add Source → Browser → paste URL above. Set width 1920, height 1080.</div>
            </div>

            {/* Teams preview — auto-filled from match selection */}
            {(o.home || o.away) && (
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: COLORS.gold }}>{o.home || '—'}</span>
                <span style={{ color: '#555', fontWeight: 700 }}>vs</span>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: COLORS.gold }}>{o.away || '—'}</span>
              </div>
            )}

            {/* Score */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: 10 }}>Score</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                {/* Home score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => handleScoreChange(g.key, 'home', -1)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text)', fontWeight: 900 }}>−</button>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, minWidth: 40, textAlign: 'center', color: COLORS.gold }}>{o.home_score ?? 0}</div>
                  <button onClick={() => handleScoreChange(g.key, 'home', +1)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text)', fontWeight: 900 }}>+</button>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#666' }}>—</div>
                {/* Away score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => handleScoreChange(g.key, 'away', -1)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text)', fontWeight: 900 }}>−</button>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, minWidth: 40, textAlign: 'center', color: COLORS.gold }}>{o.away_score ?? 0}</div>
                  <button onClick={() => handleScoreChange(g.key, 'away', +1)} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text)', fontWeight: 900 }}>+</button>
                </div>
              </div>
            </div>

            {/* Match label — also auto-fills home/away teams */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: 8 }}>Match</div>
              <select value={o._match_id || ''} onChange={e => {
                const matchId = e.target.value;
                if (!matchId) { update(g.key, '_match_id', ''); update(g.key, 'label', ''); return; }
                const m = matches.find(x => x.id === matchId);
                if (!m) return;
                const stageLabel = { group: 'Group Stage', 'round-of-16': 'Round of 16', r16: 'Round of 16', quarterfinal: 'Quarter Final', qf: 'Quarter Final', semifinal: 'Semi Final', sf: 'Semi Final', final: 'Final', third_place: '3rd Place Play-off' };
                const homeShort = teamMap[m.home_team_id]?.short_name || m.home_team_id || '?';
                const awayShort = teamMap[m.away_team_id]?.short_name || m.away_team_id || '?';
                let prefix = m.stage === 'group' && m.group_letter ? `Group ${m.group_letter}` : (stageLabel[m.stage] || m.stage || '');
                if (m.match_number) prefix += ` · Match ${m.match_number}`;
                const labelText = `${prefix} — ${homeShort} vs ${awayShort}`;
                setOverlays(prev => ({ ...prev, [g.key]: { ...prev[g.key], _match_id: matchId, label: labelText, home: homeShort, away: awayShort } }));
              }}
                style={{ width: '100%', fontSize: '0.82rem', padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', boxSizing: 'border-box' }}>
                <option value="">— Select match —</option>
                {(() => {
                  const stageOrder = { group: 0, 'round-of-16': 1, r16: 1, quarterfinal: 2, qf: 2, semifinal: 3, sf: 3, final: 4, third_place: 4 };
                  const stageLabel = { group: 'Group Stage', 'round-of-16': 'Round of 16', r16: 'Round of 16', quarterfinal: 'Quarter Final', qf: 'Quarter Final', semifinal: 'Semi Final', sf: 'Semi Final', final: 'Final', third_place: '3rd Place Play-off' };
                  return [...matches].sort((a, b) => {
                    const so = (stageOrder[a.stage] ?? 0) - (stageOrder[b.stage] ?? 0);
                    if (so !== 0) return so;
                    const ga = a.group_letter || '', gb = b.group_letter || '';
                    if (ga !== gb) return ga.localeCompare(gb);
                    return (a.match_number || 0) - (b.match_number || 0);
                  }).map(m => {
                    const home = teamMap[m.home_team_id]?.short_name || m.home_team_id || '?';
                    const away = teamMap[m.away_team_id]?.short_name || m.away_team_id || '?';
                    let prefix = m.stage === 'group' && m.group_letter ? `Group ${m.group_letter}` : (stageLabel[m.stage] || m.stage || '');
                    if (m.match_number) prefix += ` · Match ${m.match_number}`;
                    return <option key={m.id} value={m.id}>{prefix} — {home} vs {away}</option>;
                  });
                })()}
              </select>
            </div>

            {/* Timer */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: 10 }}>Match Timer</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, fontFamily: 'monospace', color: o.timer?.running ? COLORS.gold : 'var(--text)', minWidth: 90 }}>
                  {timerDisplay[g.key]}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {!o.timer?.running ? (
                    <button onClick={() => handleTimerAction(g.key, 'start')}
                      style={{ padding: '8px 16px', background: COLORS.green, color: '#fff', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                      ▶ Start
                    </button>
                  ) : (
                    <button onClick={() => handleTimerAction(g.key, 'stop')}
                      style={{ padding: '8px 16px', background: COLORS.red, color: '#fff', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                      ⏸ Stop
                    </button>
                  )}
                  <button onClick={() => handleTimerAction(g.key, 'reset')}
                    style={{ padding: '8px 16px', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8, border: '1px solid var(--border)', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}>
                    ↺ Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Sponsors toggle */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>Show Sponsors</div>
                <div style={{ fontSize: '0.68rem', color: '#888', marginTop: 2 }}>Slides sponsor logos onto the stream</div>
              </div>
              <button onClick={async () => {
                const newData = { ...o, show_sponsors: !o.show_sponsors };
                await save(g.key, newData);
              }}
                style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: o.show_sponsors ? COLORS.gold : '#444', transition: 'background 0.2s', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: o.show_sponsors ? 26 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
              </button>
            </div>

            {/* Save button */}
            <button onClick={() => handleSaveAll(g.key)} disabled={isSaving}
              style={{ width: '100%', padding: '12px 0', background: COLORS.gold, color: '#000', borderRadius: 10, border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}>
              {isSaving ? 'Saving…' : 'Push to Overlay'}
            </button>

          </div>
        );
      })}
    </div>
  );
}

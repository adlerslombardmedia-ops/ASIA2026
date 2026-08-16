// Shared UI helpers used across all pages

// Inject nav
function renderNav(active) {
  const el = document.getElementById('main-nav');
  if (!el) return;

  const links = [
    { href: 'index.html',       label: 'Home',        key: 'home'        },
    { href: 'groups.html',      label: 'Groups',      key: 'groups'      },
    { href: 'knockout.html',    label: 'Knockout',    key: 'knockout'    },
    { href: 'teams.html',       label: 'Teams',       key: 'teams'       },
    { href: 'leaderboard.html', label: 'Leaderboard', key: 'leaderboard' },
    { href: 'admin.html',       label: '⚙ Admin',     key: 'admin'       },
  ];

  el.innerHTML = `
    <div class="nav-container">
      <a href="index.html" class="nav-logo" style="display:flex;align-items:center;gap:0.8rem;">
        <img id="nav-logo-img" src="images/logo.svg" alt="Asia Cup 2026" onerror="this.style.display='none'">
        <div class="nav-logo-text">Asia Cup 2026</div>
      </a>
      <ul class="nav-links" id="nav-menu">
        ${links.map(l => `<li><a href="${l.href}" class="${active===l.key?'active':''}">${l.label}</a></li>`).join('')}
      </ul>
      <button class="hamburger" id="hamburger">☰</button>
    </div>`;

  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('nav-menu').classList.toggle('open');
  });
}

// Toast notifications
function toast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// Render a team logo element (img or initials fallback)
function teamLogoEl(team, size = 'sm') {
  const cls = size === 'lg' ? 'team-logo-lg' : size === 'xs' ? 'logo-xs' : 'team-logo-sm';
  if (team?.logo) {
    return `<div class="${cls}"><img src="${team.logo}" alt="${team.shortName}"></div>`;
  }
  const initials = (team?.shortName || '??').substring(0, 3);
  return `<div class="${cls}" style="background:${team?.primaryColor||'#333'};color:${team?.secondaryColor||'#fff'}">${initials}</div>`;
}

// Render a match card
function renderMatchCard(match, data, clickFn) {
  const home = data.teams[match.homeTeam];
  const away = data.teams[match.awayTeam];
  const played = match.played;
  const dateStr = match.date ? `${match.date}${match.time ? ' '+match.time : ''}` : '';

  return `
    <div class="match-card ${played?'played':'upcoming'}" onclick="${clickFn}('${match.id}')">
      <div class="match-team">
        ${teamLogoEl(home)}
        <span class="team-name-sm">${home?.shortName||'TBD'}</span>
      </div>
      <div class="match-score">
        ${played
          ? `<div class="score-num">${match.homeScore} - ${match.awayScore}</div>`
          : `<div class="score-vs">VS</div>`
        }
        <div class="match-meta">${dateStr}</div>
      </div>
      <div class="match-team away">
        ${teamLogoEl(away)}
        <span class="team-name-sm">${away?.shortName||'TBD'}</span>
      </div>
    </div>`;
}

// Pitch SVG: render 7 players on a half-pitch
// positions: [{x:0-100, y:0-100, number, name, color}]
// side: 'home' (bottom) | 'away' (top)
function renderPitchSVG(positions, teamColor, side, containerEl) {
  const W = 220, H = 320;

  const defaultPositions7 = side === 'home'
    ? [ // bottom→top (GK at bottom)
        { x: 50, y: 90, label: 'GK' },
        { x: 25, y: 70, label: 'LB' }, { x: 75, y: 70, label: 'RB' },
        { x: 20, y: 45, label: 'LM' }, { x: 50, y: 45, label: 'CM' }, { x: 80, y: 45, label: 'RM' },
        { x: 50, y: 15, label: 'ST' },
      ]
    : [ // top→bottom (GK at top)
        { x: 50, y: 10, label: 'GK' },
        { x: 25, y: 30, label: 'LB' }, { x: 75, y: 30, label: 'RB' },
        { x: 20, y: 55, label: 'LM' }, { x: 50, y: 55, label: 'CM' }, { x: 80, y: 55, label: 'RM' },
        { x: 50, y: 85, label: 'ST' },
      ];

  const players = positions && positions.length === 7 ? positions : defaultPositions7.map((p, i) => ({
    ...p, number: i + 1, name: p.label
  }));

  let circles = '';
  players.forEach((p, i) => {
    const cx = (p.x / 100) * W;
    const cy = (p.y / 100) * H;
    const color = teamColor || '#FFD400';
    const txt = p.number || (i + 1);
    const nm  = (p.name || p.label || '').substring(0, 8);
    circles += `
      <g class="player-circle" title="${p.name||''}">
        <circle cx="${cx}" cy="${cy}" r="15" fill="${color}" stroke="white" stroke-width="1.5"/>
        <text class="player-number" x="${cx}" y="${cy}">${txt}</text>
        <text class="player-name" x="${cx}" y="${cy + 22}">${nm}</text>
      </g>`;
  });

  const svg = `
    <svg class="pitch-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <!-- Grass -->
      <rect width="${W}" height="${H}" rx="4" fill="#2d5a1b"/>
      <!-- Stripes -->
      ${Array.from({length:8}, (_,i) => `<rect x="0" y="${i*40}" width="${W}" height="20" fill="rgba(0,0,0,0.06)"/>`).join('')}
      <!-- Outline -->
      <rect x="5" y="5" width="${W-10}" height="${H-10}" rx="3" class="pitch-line"/>
      <!-- Halfway -->
      <line x1="5" y1="${H/2}" x2="${W-5}" y2="${H/2}" class="pitch-line"/>
      <!-- Goal areas -->
      <rect x="${W/2-30}" y="5" width="60" height="30" class="pitch-penalty"/>
      <rect x="${W/2-30}" y="${H-35}" width="60" height="30" class="pitch-penalty"/>
      <!-- Centre circle -->
      <circle cx="${W/2}" cy="${H/2}" r="25" class="pitch-line"/>
      <circle cx="${W/2}" cy="${H/2}" r="2" fill="rgba(255,255,255,0.5)"/>
      <!-- Players -->
      ${circles}
    </svg>`;

  if (containerEl) containerEl.innerHTML = svg;
  return svg;
}

// Open match detail page
function goToMatch(matchId) {
  window.location.href = `match.html?id=${matchId}`;
}

// Open team detail page
function goToTeam(teamId) {
  window.location.href = `team.html?id=${teamId}`;
}

// URL query param helper
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// Format date
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}); }
  catch(e) { return d; }
}

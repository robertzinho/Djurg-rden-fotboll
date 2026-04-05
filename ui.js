// ============================================================
// components/ui.js – All render functions
// ============================================================

import { state, toggleFavorite } from '../services/state.js';

// ── HELPERS ──────────────────────────────────────────────────

export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Idag';
  if (days === 1) return 'Imorgon';
  return `Om ${days} dagar`;
}

function teamLogo(url, name, size = 32) {
  if (url) return `<img src="${url}" alt="${name}" width="${size}" height="${size}" loading="lazy" onerror="this.style.display='none'">`;
  const ini = (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<span class="team-ini" style="width:${size}px;height:${size}px;font-size:${size * 0.35}px">${ini}</span>`;
}

// ── SKELETON LOADERS ──────────────────────────────────────────

export function skeletonMatch() {
  return `<div class="skeleton-card">
    <div class="sk sk-line w40"></div>
    <div class="sk-match-row">
      <div class="sk sk-circle"></div><div class="sk sk-line w50"></div>
      <div class="sk sk-score"></div>
      <div class="sk sk-line w50"></div><div class="sk sk-circle"></div>
    </div>
  </div>`;
}

export function skeletonPlayer() {
  return `<div class="skeleton-player">
    <div class="sk sk-avatar"></div>
    <div class="sk sk-line w70" style="margin-top:8px"></div>
    <div class="sk sk-line w40" style="margin-top:6px"></div>
  </div>`;
}

// ── MATCH CARD ────────────────────────────────────────────────

export function renderMatchCard(match, variant = 'normal') {
  const isNext = variant === 'hero';
  const statusBadge = {
    'FT':   `<span class="badge badge-ft">FT</span>`,
    'LIVE': `<span class="badge badge-live"><span class="live-blink"></span>LIVE</span>`,
    'NS':   `<span class="badge badge-ns">${match.time || ''}</span>`,
  }[match.status] || '';

  const scoreOrTime = match.status === 'FT' || match.status === 'LIVE'
    ? `<div class="match-score">
        <span class="${match.result === 'win' ? 'score-win' : match.result === 'loss' ? 'score-loss' : 'score-draw'}">${match.homeScore}</span>
        <span class="score-sep">–</span>
        <span class="${match.result === 'win' ? 'score-win' : match.result === 'loss' ? 'score-loss' : 'score-draw'}">${match.awayScore}</span>
       </div>`
    : `<div class="match-time">
        <div class="match-time-hour">${match.time || '–'}</div>
        <div class="match-time-until">${daysUntil(match.date)}</div>
       </div>`;

  const resultStrip = match.status === 'FT'
    ? `<div class="result-strip result-${match.result}"></div>`
    : '';

  if (isNext) {
    return `
    <div class="hero-match-card">
      <div class="hero-label">
        <span>NÄSTA MATCH</span>
        <span class="hero-comp">${match.competition}</span>
      </div>
      <div class="hero-teams">
        <div class="hero-team">
          ${teamLogo(match.homeLogo, match.homeTeam, 48)}
          <span>${match.homeTeam}</span>
        </div>
        <div class="hero-vs">VS</div>
        <div class="hero-team">
          ${teamLogo(match.awayLogo, match.awayTeam, 48)}
          <span>${match.awayTeam}</span>
        </div>
      </div>
      <div class="hero-meta">
        <span>📅 ${fmtDate(match.date)}</span>
        <span>🕐 ${match.time || 'TBD'}</span>
        ${match.venue ? `<span>📍 ${match.venue}</span>` : ''}
      </div>
    </div>`;
  }

  return `
  <div class="match-card ${match.result !== 'upcoming' ? 'match-card--played' : ''}">
    ${resultStrip}
    <div class="match-card-inner">
      <div class="match-meta-top">
        <span class="match-comp">${match.competition}</span>
        ${statusBadge}
        <span class="match-date-str">${fmtDateShort(match.date)}</span>
      </div>
      <div class="match-teams-row">
        <div class="match-team ${match.isHome ? 'match-team--dif' : ''}">
          ${teamLogo(match.homeLogo, match.homeTeam, 28)}
          <span class="team-name">${match.homeTeam}</span>
        </div>
        ${scoreOrTime}
        <div class="match-team match-team--right ${!match.isHome ? 'match-team--dif' : ''}">
          <span class="team-name">${match.awayTeam}</span>
          ${teamLogo(match.awayLogo, match.awayTeam, 28)}
        </div>
      </div>
    </div>
  </div>`;
}

// ── STANDINGS TABLE ───────────────────────────────────────────

export function renderStandingsTable(table) {
  if (!table || !table.length) return '<div class="empty-state">Tabell ej tillgänglig</div>';

  const rows = table.map((t, i) => {
    const isDif = /djurgård/i.test(t.strTeam || '');
    const pos   = parseInt(t.intRank) || i + 1;
    const posClass = pos <= 3 ? 'pos-top' : pos >= 15 ? 'pos-danger' : '';
    return `
    <tr class="${isDif ? 'row-dif' : ''}">
      <td><span class="pos-badge ${posClass}">${pos}</span></td>
      <td class="team-cell">
        ${t.strTeamBadge ? `<img src="${t.strTeamBadge}" width="18" height="18" loading="lazy" onerror="this.style.display='none'">` : ''}
        <span>${isDif ? `<strong>${t.strTeam}</strong>` : t.strTeam}</span>
      </td>
      <td>${t.intPlayed || 0}</td>
      <td class="hide-xs">${t.intWin || 0}</td>
      <td class="hide-xs">${t.intDraw || 0}</td>
      <td class="hide-xs">${t.intLoss || 0}</td>
      <td class="hide-sm">${(t.intGoalsFor||0)}–${(t.intGoalsAgainst||0)}</td>
      <td><strong>${t.intPoints || 0}</strong></td>
    </tr>`;
  }).join('');

  return `
  <div class="table-scroll">
    <table class="standings-table">
      <thead>
        <tr>
          <th>#</th><th>Lag</th><th>M</th>
          <th class="hide-xs">V</th>
          <th class="hide-xs">O</th>
          <th class="hide-xs">F</th>
          <th class="hide-sm">Mål</th>
          <th>P</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="table-legend">
    <span class="legend-top">Europaplats</span>
    <span class="legend-danger">Nedflyttning</span>
  </div>`;
}

// ── PLAYER CARD ───────────────────────────────────────────────

export function renderPlayerCard(player) {
  const isFav = state.favorites.includes(player.id);
  const posColor = { Goalkeeper: '#E8A020', Defender: '#005B9A', Midfielder: '#534AB7', Forward: '#C8102E' };
  const color = posColor[player.position] || '#005B9A';
  const ini = player.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return `
  <div class="player-card" data-id="${player.id}">
    <button class="fav-btn ${isFav ? 'fav-btn--active' : ''}" onclick="window.__toggleFav('${player.id}')" aria-label="Favorit">
      ${isFav ? '★' : '☆'}
    </button>
    <div class="player-img-wrap" style="--pos-color:${color}">
      ${player.img
        ? `<img src="${player.img}" alt="${player.name}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'player-ini\\'>${ini}</span>'">`
        : `<span class="player-ini">${ini}</span>`}
    </div>
    <div class="player-number">#${player.number}</div>
    <div class="player-name">${player.name}</div>
    <div class="player-pos" style="color:${color}">${translatePosition(player.position)}</div>
    <div class="player-nat">${player.flag || ''} ${player.nationality}</div>
  </div>`;
}

function translatePosition(pos) {
  const map = { Goalkeeper: 'Målvakt', Defender: 'Back', Midfielder: 'Mittfältare', Forward: 'Forward' };
  return map[pos] || pos;
}

// ── NEWS CARD ─────────────────────────────────────────────────

export function renderNewsItem(item, featured = false) {
  const d = new Date(item.date);
  const ago = timeAgo(d);
  const favicon = item.fav
    ? `<img src="${item.fav}" width="14" height="14" onerror="this.style.display='none'" alt="">`
    : '';

  if (featured) {
    return `
    <a class="news-featured" href="${item.link}" target="_blank" rel="noopener">
      <div class="news-accent" style="background:${item.scolor || '#005B9A'}"></div>
      <div class="news-featured-body">
        <div class="news-source-row">${favicon}<span>${item.sname}</span><span class="news-ago">${ago}</span></div>
        <h3>${item.title}</h3>
        ${item.summary ? `<p>${item.summary.slice(0,120)}…</p>` : ''}
      </div>
    </a>`;
  }

  return `
  <a class="news-item" href="${item.link}" target="_blank" rel="noopener">
    <div class="news-item-body">
      <div class="news-source-row">${favicon}<span>${item.sname}</span><span class="news-ago">${ago}</span></div>
      <h4>${item.title}</h4>
    </div>
    <span class="news-chevron">›</span>
  </a>`;
}

function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'Nu';
  if (mins < 60)  return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h`;
  return Math.floor(hrs / 24) + 'd';
}

// ── PULL TO REFRESH ───────────────────────────────────────────

export function initPullToRefresh(onRefresh) {
  let startY = 0, pulling = false;
  const indicator = document.getElementById('ptr-indicator');

  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && dy < 80 && indicator) {
      indicator.style.transform = `translateY(${Math.min(dy, 60)}px)`;
      indicator.classList.add('ptr-visible');
    }
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!pulling) return;
    const dy = e.changedTouches[0].clientY - startY;
    if (indicator) { indicator.style.transform = ''; indicator.classList.remove('ptr-visible'); }
    if (dy > 60) onRefresh();
    pulling = false;
  });
}

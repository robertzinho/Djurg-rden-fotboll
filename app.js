// ============================================================
// app.js – Main entry point, SPA routing, page controllers
// ============================================================

import { state, setState, toggleFavorite, toggleDarkMode } from './services/state.js';
import { fetchLastMatches, fetchNextMatches, fetchStandings, fetchSquad, fetchNews } from './services/api.js';
import {
  renderMatchCard, renderStandingsTable, renderPlayerCard,
  renderNewsItem, skeletonMatch, skeletonPlayer,
  fmtDate, initPullToRefresh
} from './components/ui.js';

// ── ROUTER ───────────────────────────────────────────────────

const PAGES = ['home', 'matches', 'squad', 'standings'];

function showPage(id) {
  PAGES.forEach(p => {
    document.getElementById('page-' + p)?.classList.toggle('active', p === id);
    document.querySelectorAll(`[data-tab="${p}"]`).forEach(el =>
      el.classList.toggle('active', p === id)
    );
  });
  setState({ activeTab: id });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Lazy-load page data
  if (id === 'home')      loadHome();
  if (id === 'matches')   loadMatches();
  if (id === 'squad')     loadSquad();
  if (id === 'standings') loadStandings();
}

// Expose for onclick handlers
window.__showPage = showPage;
window.__toggleFav = (id) => {
  toggleFavorite(id);
  // Re-render squad page if active
  if (state.activeTab === 'squad') renderSquadGrid(state.squad, state.squadFilter || 'all');
};

// ── HOME PAGE ─────────────────────────────────────────────────

async function loadHome() {
  if (state.loading.home === false) return; // already loaded

  // Show skeletons
  setHTML('home-next',    '<div style="margin:1rem">' + skeletonMatch() + '</div>');
  setHTML('home-results', '<div style="display:flex;gap:10px;padding:0 1rem">' + Array(4).fill('<div class="result-mini"><div class="sk sk-line w70" style="margin:4px auto"></div><div class="sk sk-score" style="margin:8px auto"></div></div>').join('') + '</div>');
  setHTML('home-news',    Array(3).fill('<div style="padding:.875rem 1rem;border-bottom:1px solid var(--border)"><div class="sk sk-line w70" style="margin-bottom:6px"></div><div class="sk sk-line w50"></div></div>').join(''));

  try {
    const [last, next, news] = await Promise.all([
      fetchLastMatches(),
      fetchNextMatches(),
      fetchNews(),
    ]);

    setState({ lastMatches: last, nextMatches: next, news, loading: { ...state.loading, home: false } });

    // Next match hero
    const nextMatch = next[0];
    setHTML('home-next', nextMatch
      ? renderMatchCard(nextMatch, 'hero')
      : '<div class="empty-state">Inga kommande matcher</div>');

    // Last results scroll
    const results = last.slice(0, 5);
    setHTML('home-results', results.map(m => `
      <div class="result-mini ${m.result}">
        <div class="rm-opp">${m.opponent}</div>
        <div class="rm-score">${m.difScore}–${m.oppScore}</div>
        <div class="rm-date">${fmtDate(m.date).split(' ').slice(-2).join(' ')}</div>
      </div>`).join(''));

    // News
    const featNews = news.slice(0, 2);
    const moreNews = news.slice(2, 8);
    setHTML('home-news',
      featNews.map((n, i) => renderNewsItem(n, i === 0)).join('') +
      moreNews.map(n => renderNewsItem(n)).join('')
    );

  } catch (e) {
    console.error('[Home]', e);
    setHTML('home-next', '<div class="error-state">Kunde inte ladda data</div>');
  }
}

// ── MATCHES PAGE ──────────────────────────────────────────────

let matchTab = 'upcoming';

async function loadMatches() {
  if (state.loading.matches === false && state.lastMatches.length) {
    renderMatchesView();
    return;
  }

  setHTML('matches-list', Array(4).fill(skeletonMatch()).join(''));

  try {
    const [last, next] = await Promise.all([fetchLastMatches(), fetchNextMatches()]);
    setState({ lastMatches: last, nextMatches: next, loading: { ...state.loading, matches: false } });
    renderMatchesView();
  } catch(e) {
    setHTML('matches-list', '<div class="error-state">Kunde inte ladda matcher</div>');
  }
}

function renderMatchesView() {
  const list = matchTab === 'upcoming' ? state.nextMatches : state.lastMatches;
  setHTML('matches-list',
    list.length
      ? list.map(m => renderMatchCard(m)).join('')
      : `<div class="empty-state">Inga ${matchTab === 'upcoming' ? 'kommande' : 'spelade'} matcher</div>`
  );
}

window.__setMatchTab = (tab, el) => {
  matchTab = tab;
  document.querySelectorAll('.match-tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderMatchesView();
};

// ── SQUAD PAGE ────────────────────────────────────────────────

let squadFilter = 'all';

async function loadSquad() {
  if (state.squad.length) { renderSquadGrid(state.squad, squadFilter); return; }

  const grid = document.getElementById('squad-grid');
  if (grid) grid.innerHTML = Array(8).fill(skeletonPlayer()).join('');

  try {
    const players = await fetchSquad();
    setState({ squad: players });
    renderSquadGrid(players, squadFilter);
  } catch(e) {
    setHTML('squad-grid', '<div class="error-state">Kunde inte ladda truppen</div>');
  }
}

function renderSquadGrid(players, filter) {
  squadFilter = filter;
  state.squadFilter = filter;

  // Update chip states
  document.querySelectorAll('.filter-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.filter === filter)
  );

  const filtered = filter === 'all' ? players :
    players.filter(p => p.position?.toLowerCase().includes(filter.toLowerCase()));

  // Group by position
  const groups = { Goalkeeper: [], Defender: [], Midfielder: [], Forward: [] };
  filtered.forEach(p => {
    const pos = p.position || 'Unknown';
    if (pos.includes('Goalkeeper') || pos === 'GK') groups.Goalkeeper.push(p);
    else if (pos.includes('Defender') || pos === 'D') groups.Defender.push(p);
    else if (pos.includes('Midfielder') || pos === 'M') groups.Midfielder.push(p);
    else groups.Forward.push(p);
  });

  const posLabels = { Goalkeeper: 'Målvakter', Defender: 'Backar', Midfielder: 'Mittfältare', Forward: 'Forwards' };

  let html = '';
  if (filter !== 'all') {
    html = `<div class="player-grid">${filtered.map(renderPlayerCard).join('')}</div>`;
  } else {
    Object.entries(groups).forEach(([pos, group]) => {
      if (!group.length) return;
      html += `
        <div class="position-group">
          <div class="position-label">${posLabels[pos] || pos} (${group.length})</div>
          <div class="player-grid">${group.map(renderPlayerCard).join('')}</div>
        </div>`;
    });
  }

  setHTML('squad-grid', html || '<div class="empty-state">Inga spelare</div>');
}

window.__filterSquad = (filter, el) => {
  renderSquadGrid(state.squad, filter);
};

// ── STANDINGS PAGE ────────────────────────────────────────────

async function loadStandings() {
  if (state.standings.length) {
    setHTML('standings-table', renderStandingsTable(state.standings));
    return;
  }

  setHTML('standings-table', '<div class="empty-state"><div class="sk sk-line w70" style="margin:1rem auto"></div></div>');

  try {
    const table = await fetchStandings();
    setState({ standings: table });
    setHTML('standings-table', renderStandingsTable(table));
  } catch(e) {
    setHTML('standings-table', '<div class="error-state">Kunde inte ladda tabell</div>');
  }
}

// ── DARK MODE ─────────────────────────────────────────────────
window.__toggleDark = () => {
  toggleDarkMode();
  const btn = document.getElementById('dark-btn');
  if (btn) btn.textContent = state.darkMode ? '☀️' : '🌙';
};

// ── REFRESH ───────────────────────────────────────────────────
async function refreshAll() {
  setState({ loading: { matches: true, squad: true, standings: true, home: true } });
  // Clear memory cache
  const tab = state.activeTab;
  setState({ lastMatches: [], nextMatches: [], news: [], standings: [], squad: [] });
  showPage(tab);
}

// ── UTILS ─────────────────────────────────────────────────────
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
  const darkBtn = document.getElementById('dark-btn');
  if (darkBtn) darkBtn.textContent = state.darkMode ? '☀️' : '🌙';

  // Nav clicks
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => showPage(el.dataset.tab));
  });

  // Pull to refresh
  initPullToRefresh(refreshAll);

  // Initial page
  showPage('home');

  // Auto-refresh every 5 min
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      setState({ loading: { matches: true, home: true } });
      loadHome();
    }
  }, 5 * 60 * 1000);
});

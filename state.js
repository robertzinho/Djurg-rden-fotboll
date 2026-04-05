// ============================================================
// services/state.js – Centralized app state
// ============================================================

export const state = {
  activeTab:    'home',
  darkMode:     localStorage.getItem('dif_darkmode') !== 'false',
  favorites:    JSON.parse(localStorage.getItem('dif_favorites') || '[]'),
  lastMatches:  [],
  nextMatches:  [],
  standings:    [],
  squad:        [],
  news:         [],
  loading:      { matches: true, squad: true, standings: true, news: true },
  errors:       {},
};

const listeners = [];

export function subscribe(fn) {
  listeners.push(fn);
  return () => listeners.splice(listeners.indexOf(fn), 1);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function toggleFavorite(playerId) {
  const idx = state.favorites.indexOf(playerId);
  if (idx === -1) state.favorites.push(playerId);
  else            state.favorites.splice(idx, 1);
  localStorage.setItem('dif_favorites', JSON.stringify(state.favorites));
  setState({ favorites: [...state.favorites] });
}

export function toggleDarkMode() {
  const next = !state.darkMode;
  localStorage.setItem('dif_darkmode', next);
  setState({ darkMode: next });
  document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
}

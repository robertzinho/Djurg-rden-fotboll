// ============================================================
// services/api.js – All API calls in one place
// TheSportsDB Team ID for Djurgårdens IF: 133739
// ============================================================

const TSDB_BASE   = 'https://www.thesportsdb.com/api/v1/json/3';
const TEAM_ID     = '133739';
const WORKER_URL  = 'https://dif-proxy.r-robertjohansson.workers.dev';
const CACHE_TTL   = 10 * 60 * 1000; // 10 min in ms

// Simple in-memory cache
const _cache = new Map();

async function cachedFetch(key, fetchFn) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) {
    return entry.data;
  }
  try {
    const data = await fetchFn();
    _cache.set(key, { data, ts: Date.now() });
    // Also persist to localStorage
    try { localStorage.setItem('dif_cache_' + key, JSON.stringify({ data, ts: Date.now() })); } catch(e) {}
    return data;
  } catch (err) {
    // Try localStorage fallback
    try {
      const stored = localStorage.getItem('dif_cache_' + key);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.warn(`[API] Using stale cache for ${key}`);
        return parsed.data;
      }
    } catch(e) {}
    throw err;
  }
}

// ── MATCHES ──────────────────────────────────────────────────

export async function fetchLastMatches() {
  return cachedFetch('last5', async () => {
    const r = await fetch(`${TSDB_BASE}/eventslast.php?id=${TEAM_ID}`);
    const j = await r.json();
    return (j.results || []).map(normalizeEvent);
  });
}

export async function fetchNextMatches() {
  return cachedFetch('next5', async () => {
    const r = await fetch(`${TSDB_BASE}/eventsnext.php?id=${TEAM_ID}`);
    const j = await r.json();
    return (j.events || []).map(normalizeEvent);
  });
}

export async function fetchStandings() {
  return cachedFetch('standings', async () => {
    const r = await fetch(`${WORKER_URL}/standings`);
    const j = await r.json();
    return j.table || [];
  });
}

export async function fetchNews() {
  return cachedFetch('news', async () => {
    const r = await fetch(`${WORKER_URL}/news`);
    const j = await r.json();
    return j.items || [];
  });
}

// ── SQUAD ─────────────────────────────────────────────────────

export async function fetchSquad() {
  return cachedFetch('squad', async () => {
    const r = await fetch(`${TSDB_BASE}/lookup_all_players.php?id=${TEAM_ID}`);
    const j = await r.json();
    if (j.player && j.player.length > 0) {
      return j.player.map(p => ({
        id:          p.idPlayer,
        name:        p.strPlayer,
        position:    p.strPosition || 'Unknown',
        nationality: p.strNationality || '',
        number:      p.strNumber || '–',
        img:         p.strThumb || p.strCutout || '',
        flag:        '',
        description: p.strDescriptionEN || '',
      }));
    }
    // Fallback to local JSON
    const fb = await fetch('./data/squad.json');
    const fd = await fb.json();
    return fd.players;
  });
}

// ── NORMALIZE EVENT ───────────────────────────────────────────

function normalizeEvent(e) {
  const isHome     = e.idHomeTeam === TEAM_ID;
  const opponent   = isHome ? e.strAwayTeam : e.strHomeTeam;
  const oppLogo    = isHome ? e.strAwayTeamBadge : e.strHomeTeamBadge;
  const homeScore  = e.intHomeScore !== null ? parseInt(e.intHomeScore) : null;
  const awayScore  = e.intAwayScore !== null ? parseInt(e.intAwayScore) : null;
  const difScore   = isHome ? homeScore : awayScore;
  const oppScore   = isHome ? awayScore : homeScore;

  let result = 'upcoming';
  if (difScore !== null && oppScore !== null) {
    if (difScore > oppScore)      result = 'win';
    else if (difScore < oppScore) result = 'loss';
    else                          result = 'draw';
  }

  // Status
  const now = new Date();
  const matchDate = new Date(e.dateEvent + 'T' + (e.strTime || '00:00:00'));
  let status = 'NS'; // Not started
  if (e.strStatus === 'Match Finished' || e.intHomeScore !== null) status = 'FT';
  else if (matchDate <= now) status = 'LIVE';

  return {
    id:         e.idEvent,
    date:       e.dateEvent,
    time:       e.strTime ? e.strTime.slice(0,5) : '',
    homeTeam:   e.strHomeTeam,
    awayTeam:   e.strAwayTeam,
    homeScore:  homeScore,
    awayScore:  awayScore,
    homeLogo:   e.strHomeTeamBadge || '',
    awayLogo:   e.strAwayTeamBadge || '',
    competition: e.strLeague || '',
    venue:      e.strVenue || '',
    status,
    result,
    isHome,
    opponent,
    oppLogo,
    difScore,
    oppScore,
    thumb:      e.strThumb || '',
  };
}

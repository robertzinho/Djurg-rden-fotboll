// DIF News & Standings Proxy Worker
// Deploy på Cloudflare Workers – gratis upp till 100 000 anrop/dag

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const DIF_KEYWORDS = [
  'djurgård', 'djurgarden', ' dif ', 'dif.', 'blåränderna',
  'jacob rinne', 'matias siltanen', 'mikael anderson', 'jeppe okkels',
  'adam ståhl', 'bo hegland', 'keita kosugi', 'zakaria sawo',
  'kristian lien', 'jacob une larsson', 'nino žugelj', 'nino zugelj',
  'ahmed saeed', 'jonathan augustinsson', 'oscar jonsson'
];

const SOURCES = [
  { id: 'dif',  name: 'DIF.se',          url: 'https://www.dif.se/feed/',                             color: '#005B9A', fav: 'https://www.dif.se/favicon.ico',                 filterDIF: false },
  { id: 'fd',   name: 'Fotbolldirekt',   url: 'https://fotbolldirekt.se/feed/',                       color: '#1a6e2a', fav: 'https://fotbolldirekt.se/favicon.ico',           filterDIF: true  },
  { id: 'fk',   name: 'Fotbollskanalen', url: 'https://www.fotbollskanalen.se/rss/allsvenskan/',      color: '#e8320a', fav: 'https://www.fotbollskanalen.se/favicon.ico',     filterDIF: true  },
  { id: 'sf',   name: 'SvenskaFans',     url: 'https://www.svenskafans.com/fotboll/lag/dif/rss.aspx', color: '#1a4f8a', fav: 'https://www.svenskafans.com/favicon.ico',        filterDIF: false },
  { id: 'ab',   name: 'Aftonbladet',     url: 'https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt/', color: '#DDAA00', fav: 'https://www.aftonbladet.se/favicon.ico', filterDIF: true },
  { id: 'exp',  name: 'Expressen',       url: 'https://feeds.expressen.se/sport/',                    color: '#e30613', fav: 'https://www.expressen.se/favicon.ico',           filterDIF: true  },
];

function isDIF(text) {
  const t = text.toLowerCase();
  return DIF_KEYWORDS.some(k => t.includes(k));
}

function stripHTML(s) {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function getTextContent(el, tag) {
  const match = el.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? stripHTML(match[1]) : '';
}

function getLinkFromItem(xml) {
  // Try <link> tag – tricky in RSS as it's often self-closing or CDATA
  const linkMatch = xml.match(/<link>([^<]+)<\/link>/i) ||
                    xml.match(/<link\s+[^>]*href="([^"]+)"/i);
  if (linkMatch) return linkMatch[1].trim();
  // Fallback to guid
  const guidMatch = xml.match(/<guid[^>]*>([^<]+)<\/guid>/i);
  if (guidMatch) {
    const g = guidMatch[1].trim();
    if (g.startsWith('http')) return g;
  }
  return '';
}

async function fetchRSS(src) {
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (DIF-Proxy/1.0)' },
      cf: { cacheTtl: 300 } // cache 5 min in Cloudflare edge
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    // Extract <item> blocks
    const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
    const items = [];
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const title   = getTextContent(itemXml, 'title');
      const desc    = getTextContent(itemXml, 'description');
      const link    = getLinkFromItem(itemXml);
      const date    = getTextContent(itemXml, 'pubDate');

      if (!title) continue;
      if (src.filterDIF && !isDIF(title + ' ' + desc)) continue;

      items.push({
        title:   title.slice(0, 200),
        summary: desc.slice(0, 300),
        link,
        date:    date ? new Date(date).toISOString() : new Date().toISOString(),
        sid:     src.id,
        sname:   src.name,
        scolor:  src.color,
        fav:     src.fav,
      });
    }
    return items.slice(0, 20);
  } catch (e) {
    console.error(`[${src.id}] RSS error:`, e.message);
    return [];
  }
}

async function handleNews() {
  const results = await Promise.allSettled(SOURCES.map(fetchRSS));
  let items = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Deduplicate by title prefix
  const seen = new Set();
  items = items.filter(i => {
    const k = i.title.slice(0, 50).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return new Response(JSON.stringify({ ok: true, items, ts: new Date().toISOString() }), {
    headers: { ...CORS, 'Cache-Control': 'public, max-age=300' }
  });
}

async function handleStandings() {
  try {
    const res = await fetch('https://www.thesportsdb.com/api/v1/json/3/lookuptable.php?l=4347&s=2026', {
      cf: { cacheTtl: 300 }
    });
    const json = await res.json();
    return new Response(JSON.stringify({ ok: true, table: json.table || [], ts: new Date().toISOString() }), {
      headers: { ...CORS, 'Cache-Control': 'public, max-age=300' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { headers: CORS });
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === '/news') return handleNews();
    if (url.pathname === '/standings') return handleStandings();

    return new Response(JSON.stringify({
      ok: true,
      endpoints: ['/news', '/standings'],
      info: 'DIF Proxy Worker'
    }), { headers: CORS });
  }
};

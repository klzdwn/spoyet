/* app.js
 - Set BASE_URL to your backend URL (no trailing slash) to enable live Spotify preview.
 - Example: const BASE_URL = 'https://abcd1234.ngrok.io'
 - If BASE_URL is empty string, demo uses mock tracks and YouTube fallback.
*/
const BASE_URL = '' // <<-- SET YOUR BACKEND URL HERE (ngrok/Render) OR LEAVE EMPTY FOR MOCK

const MOCK_TRACKS = [
  {
    id: 'm1',
    name: 'SoundHelix Example',
    artists: ['SoundHelix'],
    albumImage: 'https://via.placeholder.com/160',
    preview: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    external_url: ''
  },
  {
    id: 'm2',
    name: 'Acoustic Loop',
    artists: ['Demo Artist'],
    albumImage: 'https://via.placeholder.com/160/FFB6C1',
    preview: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    external_url: ''
  }
];

const el = {
  q: document.getElementById('q'),
  searchBtn: document.getElementById('searchBtn'),
  grid: document.getElementById('grid'),
  notice: document.getElementById('notice'),
  player: document.getElementById('player'),
  darkToggle: document.getElementById('darkToggle'),
  showFav: document.getElementById('showFav'),
  showAll: document.getElementById('showAll')
};

let currentTracks = [];
let playingId = null;
let favorites = loadFavorites();
let showingFav = false;

// Init notices
if (!BASE_URL) {
  el.notice.textContent = 'Tidak terhubung ke backend — menggunakan mock data. Set BASE_URL di app.js untuk live Spotify preview.';
} else {
  el.notice.textContent = 'Terhubung ke backend: ' + BASE_URL;
}

// Event listeners
el.searchBtn.addEventListener('click', search);
el.q.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
el.darkToggle.addEventListener('click', toggleDark);
el.showFav.addEventListener('click', showFavorites);
el.showAll.addEventListener('click', showAll);

// Audio end cleanup
el.player.addEventListener('ended', () => { playingId = null; renderTracks(currentTracks); });

renderTracks(MOCK_TRACKS); // initial

// FUNCTIONS
function renderTracks(tracks) {
  el.grid.innerHTML = '';
  if (!tracks || tracks.length === 0) {
    el.grid.innerHTML = `<div class="notice">No results</div>`;
    return;
  }
  tracks.forEach(t => {
    const div = document.createElement('div');
    div.className = 'card';
    const cover = (t.album && t.album.images && t.album.images[0] && t.album.images[0].url) || t.albumImage || 'https://via.placeholder.com/160';
    const hasPreview = !!(t.preview);
    const fav = favorites.includes(t.id);
    div.innerHTML = `
      <img class="cover" src="${cover}" alt="cover" />
      <div class="meta">
        <div class="title">${escapeHtml(t.name)}</div>
        <div class="artists">${escapeHtml((t.artists||[]).join(', '))}</div>
        <div class="controls-row">
          <button class="icon-btn" data-action="play" ${!hasPreview ? 'disabled' : ''}>${playingId===t.id ? 'Pause' : 'Play'}</button>
          <button class="icon-btn" data-action="spotify">Open</button>
          <a class="small-link" target="_blank" href="${youtubeSearchUrl(t.name, t.artists)}">YouTube</a>
          <button class="icon-btn" data-action="fav">${fav ? '★' : '☆'}</button>
        </div>
      </div>
    `;
    // attach handlers
    div.querySelector('[data-action="play"]')?.addEventListener('click', () => onPlay(t));
    div.querySelector('[data-action="spotify"]')?.addEventListener('click', () => openSpotify(t));
    div.querySelector('[data-action="fav"]')?.addEventListener('click', (ev) => toggleFavorite(t, ev));
    el.grid.appendChild(div);
  });
}

async function search() {
  const q = el.q.value.trim();
  if (!q) { el.notice.textContent = 'Masukkan kata kunci pencarian.'; return; }
  el.notice.textContent = 'Searching...';
  if (!BASE_URL) {
    currentTracks = MOCK_TRACKS.filter(t => (t.name + t.artists.join(' ')).toLowerCase().includes(q.toLowerCase()));
    el.notice.textContent = 'Mock mode (set BASE_URL to enable live Spotify).';
    renderTracks(currentTracks);
    return;
  }
  try {
    const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(txt || 'Search failed');
    }
    const j = await res.json();
    // map to uniform schema: id, name, artists[], album, preview, external_url
    currentTracks = (j.tracks || []).map(t => ({
      id: t.id,
      name: t.name,
      artists: t.artists || [],
      album: t.album || {},
      preview: t.preview_url || null,
      external_url: t.external_url || ''
    }));
    if (currentTracks.length === 0) el.notice.textContent = 'No tracks found.';
    else el.notice.textContent = '';
    renderTracks(currentTracks);
  } catch (e) {
    console.error(e);
    el.notice.textContent = 'Error: ' + (e.message || e);
    // fallback to mock
    currentTracks = MOCK_TRACKS;
    renderTracks(currentTracks);
  }
}

function onPlay(t) {
  if (!t.preview) {
    el.notice.textContent = 'Preview tidak tersedia untuk track ini — coba YouTube.';
    return;
  }
  if (playingId === t.id) {
    el.player.pause();
    playingId = null;
    renderTracks(currentTracks);
    return;
  }
  el.player.src = t.preview;
  el.player.play().catch(err => { el.notice.textContent = 'Playback blocked — klik play lagi.'; console.warn(err); });
  playingId = t.id;
  renderTracks(currentTracks);
}

function openSpotify(t) {
  if (t.external_url) window.open(t.external_url, '_blank');
  else {
    const q = encodeURIComponent(`${t.name} ${t.artists?.[0] || ''}`);
    window.open(`https://open.spotify.com/search/${q}`, '_blank');
  }
}

function youtubeSearchUrl(name, artists) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' ' + (artists||[]).join(' '))}`;
}

function escapeHtml(s) { return (s||'').toString().replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// Favorites (localStorage)
function loadFavorites() {
  try {
    const raw = localStorage.getItem('mp_favs');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveFavorites() {
  localStorage.setItem('mp_favs', JSON.stringify(favorites));
}
function toggleFavorite(t, ev) {
  ev.stopPropagation();
  if (favorites.includes(t.id)) favorites = favorites.filter(x => x !== t.id);
  else favorites.push(t.id);
  saveFavorites();
  renderTracks(currentTracks);
}
function showFavorites() {
  showingFav = true;
  const favTracks = currentTracks.filter(t => favorites.includes(t.id));
  el.notice.textContent = 'Favorites';
  renderTracks(favTracks.length ? favTracks : (favorites.length ? fetchFavsFromStored() : []));
}
function showAll() {
  showingFav = false;
  el.notice.textContent = '';
  renderTracks(currentTracks);
}
// if favorites persisted but currentTracks empty, attempt to fetch minimal info by doing searches (cheap)
function fetchFavsFromStored(){
  // try to build minimal objects from stored ids (no metadata) -> show placeholder
  return favorites.map(id => ({ id, name: 'Favorit (id:'+id+')', artists: [], album: {}, preview: null, external_url: '' }));
}

// Dark mode
function toggleDark(){
  const cur = document.documentElement.getAttribute('data-theme');
  if (cur === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('mp_theme');
    el.darkToggle.textContent = 'Dark';
  } else {
    document.documentElement.setAttribute('data-theme','dark');
    localStorage.setItem('mp_theme','dark');
    el.darkToggle.textContent = 'Light';
  }
}
// load theme preference
if (localStorage.getItem('mp_theme') === 'dark') {
  document.documentElement.setAttribute('data-theme','dark');
  el.darkToggle.textContent = 'Light';
}

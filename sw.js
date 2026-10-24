/* ==========================================================================
   IVTV PROGRESSIVE WEB APP (PWA) SERVICE WORKER
   Enables 100% Offline Capability, Local Shell Caching & Instant Standalone Launch
   ========================================================================== */

const CACHE_NAME = 'ivtv-cache-v39';
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/variables.css",
  "./css/fonts.css",
  "./css/main.css",
  "./css/components.css",
  "./css/player.css",
  "./css/epg.css",
  "./js/hls.min.js",
  "./js/data.js",
  "./js/us-channels.js",
  "./js/favorites.js",
  "./js/epg.js",
  "./js/player.js",
  "./js/ui.js",
  "./js/app.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/fonts/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2",
  "./assets/fonts/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko40yyygA.woff2",
  "./assets/fonts/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko50yyygA.woff2",
  "./assets/fonts/LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko70yyygA.woff2",
  "./assets/fonts/QGYvz_MVcBeNP4NJtEtq.woff2",
  "./assets/fonts/QGYvz_MVcBeNP4NJuktqQ4E.woff2",
  "./assets/images/hero-cinema-neon.jpg",
  "./assets/images/sky-hero.jpeg",
  "./assets/images/UK TV.jpeg",
  "./assets/images/hero-sports-neon.jpg",
  "./assets/images/hero-news-neon.jpg",
  "./assets/images/hero-drama-neon.jpg",
  "./assets/images/hero-entertainment.jpg",
  "./assets/images/genre-action.jpg",
  "./assets/images/genre-scifi.jpg",
  "./assets/images/hero-action.jpg",
  "./assets/images/hero-drama.jpg",
  "./assets/images/hero-sports.jpg",
  "./assets/images/hero-streaming.jpg",
  "./assets/images/cards/card-action.jpg",
  "./assets/images/cards/card-cinema.jpg",
  "./assets/images/cards/card-drama.jpg",
  "./assets/images/cards/card-f1.jpg",
  "./assets/images/cards/card-finance.jpg",
  "./assets/images/cards/card-nature.jpg",
  "./assets/images/cards/card-newsroom.jpg",
  "./assets/images/cards/card-scifi.jpg",
  "./assets/images/cards/card-sports.jpg",
  "./assets/images/cards/card-stadium.jpg",
  "./assets/logos/abc-news-live.svg",
  "./assets/logos/al-jazeera.png",
  "./assets/logos/bbc-news-uk.png",
  "./assets/logos/bbc-one-uk.png",
  "./assets/logos/bbc-three-uk.png",
  "./assets/logos/bbc-two-uk.png",
  "./assets/logos/big-bang-theory.JPG",
  "./assets/logos/bloomberg-us.png",
  "./assets/logos/cbn-news.svg",
  "./assets/logos/channel4.jpg",
  "./assets/logos/channel5.svg",
  "./assets/logos/chc.jpg",
  "./assets/logos/cnn-international.png",
  "./assets/logos/cnn-live-news.jpg",
  "./assets/logos/emusic.gif",
  "./assets/logos/film4-uk.png",
  "./assets/logos/fox-news-live.svg",
  "./assets/logos/fox-sport.gif",
  "./assets/logos/game-time.jpg",
  "./assets/logos/gb-news.png",
  "./assets/logos/gold-uk.png",
  "./assets/logos/hbo.gif",
  "./assets/logos/itv1-uk.png",
  "./assets/logos/itv2-uk.png",
  "./assets/logos/itv3-uk.png",
  "./assets/logos/itv4-uk.png",
  "./assets/logos/mgm.jpg",
  "./assets/logos/moovee.JPG",
  "./assets/logos/movies-for-you.svg",
  "./assets/logos/movies4men.JPG",
  "./assets/logos/msnbc-live.svg",
  "./assets/logos/nbc-live.jpg",
  "./assets/logos/new-movies.jpg",
  "./assets/logos/rally-tv.png",
  "./assets/logos/reuters.png",
  "./assets/logos/russia-today.png",
  "./assets/logos/s4c-uk.png",
  "./assets/logos/sky-arts-uk.png",
  "./assets/logos/sky-atlantic-uk.png",
  "./assets/logos/sky-cinema-action-uk.png",
  "./assets/logos/sky-cinema-comedy-uk.png",
  "./assets/logos/sky-cinema-drama-uk.png",
  "./assets/logos/sky-cinema-family-uk.png",
  "./assets/logos/sky-cinema-greats-uk.png",
  "./assets/logos/sky-cinema-hits-uk.png",
  "./assets/logos/sky-cinema-premiere-uk.png",
  "./assets/logos/sky-cinema-sci-fi-horror-uk.png",
  "./assets/logos/sky-cinema-select-uk.png",
  "./assets/logos/sky-cinema-thriller-uk.png",
  "./assets/logos/sky-comedy-uk.png",
  "./assets/logos/sky-crime-uk.png",
  "./assets/logos/sky-history-uk.png",
  "./assets/logos/sky-news.png",
  "./assets/logos/sky-showcase.png",
  "./assets/logos/sky-sports-action-uk.png",
  "./assets/logos/sky-sports-cricket-uk.png",
  "./assets/logos/sky-sports-f1-uk.png",
  "./assets/logos/sky-sports-football-uk.png",
  "./assets/logos/sky-sports-golf-uk.png",
  "./assets/logos/sky-sports-laliga-uk.png",
  "./assets/logos/sky-sports-main-event-live-uk.png",
  "./assets/logos/sky-sports-mix-uk.png",
  "./assets/logos/sky-sports-news-uk.png",
  "./assets/logos/sky-sports-plus-uk.png",
  "./assets/logos/sky-sports-premier-league-uk.png",
  "./assets/logos/sky-sports-racing-uk.png",
  "./assets/logos/sky-sports-tennis-uk.png",
  "./assets/logos/the-vault.svg",
  "./assets/logos/the-vintage-movie-channel.svg",
  "./assets/logos/trace-sports.png"
];

// Install: Pre-cache all static assets for instant offline availability
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache assets safely (ignore individual 404s if any)
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[IVTV SW] Precache warning for', url, err);
          })
        )
      );
    })
  );
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart offline fallback strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests
  if (req.method !== 'GET') return;

  // 1. Navigation / HTML Document requests: Network-First with Cache fallback
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('./index.html') || caches.match('/');
      })
    );
    return;
  }

  // 2. /api/epg: Network-First with Stale Cache Fallback
  if (url.pathname === '/api/epg') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const cloned = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          }
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ status: 'offline', message: 'Operating in offline mode with cached seed' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // 3. /api/stream: When offline, provide clean structured offline notification
  if (url.pathname === '/api/stream') {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            error: 'Live streams require an active internet connection. EPG guide and directory are available offline.'
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 4. Static assets (CSS, JS, Fonts, Images, Logos): Network-First with Cache Fallback
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.destination === 'image') {
          return caches.match('./assets/logos/sky-news.png');
        }
        return new Response('', { status: 408, statusText: 'Offline' });
      })
  );
});

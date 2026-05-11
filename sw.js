// 가정 자산 관리 — Service Worker
// ⚠️ CACHE_NAME 버전을 올리면 모든 캐시가 갱신됩니다
const CACHE_NAME = 'fam-asset-v5';

// 오프라인 캐시할 정적 리소스 (index.html 제외)
const PRECACHE = [
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap'
];

// ── 설치 ─────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(e => console.warn('Pre-cache skip:', url, e.message))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ── 활성화: 구버전 캐시 전부 삭제 ────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch 전략 ────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1) 항상 네트워크 전용 (금융·구글 API)
  const networkOnlyHosts = [
    'apis.google.com','accounts.google.com','googleapis.com',
    'query1.finance.yahoo.com','api.allorigins.win',
    'api.krx.co.kr','data.krx.co.kr','www.kofia.or.kr'
  ];
  if (networkOnlyHosts.some(d => url.hostname.includes(d))) return;

  // 2) index.html — 네트워크 우선 (항상 최신 버전)
  const isIndexHtml =
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isIndexHtml) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3) 나머지 — Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (event.request.method === 'GET' && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      }).catch(() => {
        if (event.request.destination === 'document') return caches.match('./index.html');
      });
    })
  );
});

// ── 메시지 수신 ──────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

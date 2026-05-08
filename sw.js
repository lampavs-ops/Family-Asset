// 가정 자산 관리 — Service Worker
// 캐시 버전을 올리면 다음 방문 시 전체 갱신됩니다.
const CACHE_NAME = 'fam-asset-v1';

// 오프라인에서도 동작할 핵심 파일
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=DM+Mono:wght@400;500&family=Pretendard:wght@300;400;500;600;700&display=swap'
];

// ── 설치: 핵심 파일 캐싱 ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 외부 리소스는 실패해도 설치 계속 진행
      return Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(e => console.warn('Pre-cache skip:', url, e.message))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── 활성화: 구버전 캐시 정리 ─────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch 전략 ────────────────────────────────
// Google API / 금융 데이터 → Network Only (캐시 금지)
// 그 외 → Cache First, 실패 시 Network
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 항상 네트워크로 보낼 도메인
  const networkOnly = [
    'apis.google.com',
    'accounts.google.com',
    'googleapis.com',
    'query1.finance.yahoo.com',
    'api.stock.naver.com',
    'api.allorigins.win',
    'api.krx.co.kr',
    'data.krx.co.kr',
    'www.kofia.or.kr'
  ];

  if (networkOnly.some(d => url.hostname.includes(d))) {
    // Network Only — 오프라인이면 그냥 실패 (금융 데이터는 캐시 부적합)
    return;
  }

  // Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // GET 요청이고 정상 응답이면 캐시에 저장
        if (
          event.request.method === 'GET' &&
          response.status === 200 &&
          response.type !== 'opaque'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // 오프라인 + 캐시 미스: index.html로 폴백
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── 백그라운드 메시지 수신 (미래 확장용) ─────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

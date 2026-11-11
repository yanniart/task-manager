// 서비스 워커: 오프라인에서도 앱이 열리게 앱 파일을 캐시해요 (TRD 5.8, TL-018).
// - 설치할 때 앱 파일 전체를 저장하고, 요청이 오면 캐시 먼저 응답해요.
// - ★ 앱 파일(HTML·CSS·JS·아이콘)을 고치면 CACHE_VERSION을 꼭 올려요. 안 올리면 휴대폰에 옛 버전이 계속 보여요.
// - 모든 경로는 이 파일 위치 기준 상대 경로예요 (GitHub Pages 하위 경로 /task-manager/ 대응).

const CACHE_PREFIX = "tm-cache-";
const CACHE_VERSION = "v6"; // v2: 화면 모드(F12) · v3: + 버튼 흑백 · v4: 검색·정렬·내보내기·휴지통 등(F13~F17) · v5: 정렬 아이콘 · v6: 키워드 자동 분류(F18)
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./js/main.js",
  "./js/store.js",
  "./js/storage.js",
  "./js/constants.js",
  "./js/core/date.js",
  "./js/core/id.js",
  "./js/core/order.js",
  "./js/core/progress.js",
  "./js/core/recurrence.js",
  "./js/core/rollover.js",
  "./js/core/text.js",
  "./js/core/sort.js",
  "./js/core/debounce.js",
  "./js/core/trash.js",
  "./js/core/classify.js",
  "./js/features/pwa.js",
  "./js/ui/render.js",
  "./js/ui/todo-item.js",
  "./js/ui/sheet.js",
  "./js/ui/rules-view.js",
  "./js/ui/banner.js",
  "./js/ui/drag.js",
  "./js/ui/theme.js",
  "./js/ui/toast.js",
  "./js/ui/search-bar.js",
  "./js/ui/more-view.js",
  "./js/ui/sort-menu.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // 새로고침 캐시를 건너뛰고 서버에서 새로 받아요 (옛 파일이 섞이지 않게).
      .then((cache) => cache.addAll(APP_FILES.map((url) => new Request(url, { cache: "reload" }))))
      // 새 버전을 바로 쓰도록. 다음에 앱을 열 때 새 파일로 보여요.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // 이 앱의 옛 캐시만 지워요. (github.io 같은 주소는 다른 앱과 캐시 공간을 같이 쓸 수 있어서 이름으로 골라요)
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/tests/")) return; // 테스트 페이지는 캐시하지 않고 항상 서버에서

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // ?today=… 같은 주소 뒤 값은 무시하고 찾아요.
      const cached =
        (await cache.match(request, { ignoreSearch: true })) ??
        (request.mode === "navigate" ? await cache.match("./index.html") : undefined);
      return cached ?? fetch(request);
    })(),
  );
});

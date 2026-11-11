// 배포 확인: 실제 HTTPS 주소(GitHub Pages)에서 PWA가 제대로 동작하는지 (TRD 5.8, TL-008)
// ※ 단독 실행 파일이 아니에요. 기본 실행에는 빠지고, 배포 주소를 주고 따로 돌려요:
//   BASE_URL=https://yanniart.github.io/task-manager/ node tests/e2e/run.mjs deployed
// 배포 주소에서는 개발용 ?today가 꺼져 있어서 날짜를 바꾸는 확인(02~08단계)은 하지 않아요.

check("배포 주소가 HTTPS", BASE.startsWith("https://"), BASE);

await go(BASE);
await evaluate("localStorage.clear()");
await reload();
const basic = await evaluate(`({ title: document.querySelector('.app-header__title')?.textContent, secure: window.isSecureContext, bg: getComputedStyle(document.body).backgroundColor })`);
check("앱이 열리고 CSS가 적용됨, 보안 컨텍스트(서비스 워커 가능)", basic.title === "오늘의 할 일" && basic.secure && basic.bg !== "rgba(0, 0, 0, 0)", JSON.stringify(basic));

// sw.js의 APP_FILES가 하위 경로(/task-manager/)에서 모두 열리는지
const files = await evaluate(`(async () => {
  const sw = await (await fetch('./sw.js', { cache: 'no-store' })).text();
  // sw.js 안의 "./…" 글자를 모아요. 요청 처리 부분에도 "./index.html"이 한 번 더 나와서 중복은 빼요.
  const list = [...new Set([...sw.matchAll(/"(\\.\\/[^"]*)"/g)].map(m => m[1]))];
  const results = await Promise.all(list.map(async (f) => [f, (await fetch(f, { cache: 'no-store' })).status]));
  return { count: list.length, bad: results.filter(([, s]) => s !== 200), version: sw.match(/CACHE_VERSION = "(v\\d+)"/)?.[1] };
})()`);
check(`앱 파일 ${files.count}개가 모두 하위 경로에서 열림 (상대 경로 확인)`, files.count > 0 && files.bad.length === 0, JSON.stringify(files.bad));

const sw = await evaluate(`(async () => {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 15000))]);
  if (!reg) return { ok: false };
  for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
  const keys = await caches.keys();
  const name = keys.find(k => k.startsWith('tm-cache-'));
  const cached = name ? (await (await caches.open(name)).keys()).length : 0;
  return { ok: true, scope: reg.scope, controller: !!navigator.serviceWorker.controller, name, cached };
})()`);
check("서비스 워커 등록·제어, 범위는 /task-manager/, 캐시에 앱 파일 전부",
  sw.ok && sw.controller && sw.scope === BASE && sw.name === `tm-cache-${files.version}` && sw.cached === files.count, JSON.stringify(sw));

const install = await send("Page.getInstallabilityErrors");
check("Chrome 설치 가능 검사 통과 (홈 화면 추가 가능)", install.installabilityErrors.length === 0, JSON.stringify(install.installabilityErrors));

const icons = await evaluate(`(async () => {
  const m = await (await fetch('./manifest.webmanifest')).json();
  const out = [];
  for (const ic of m.icons) { const img = new Image(); img.src = ic.src; await img.decode().catch(() => {}); out.push(ic.src.split('/').pop() + ':' + img.naturalWidth); }
  return { start: m.start_url, scope: m.scope, out };
})()`);
check("manifest 아이콘 모두 열림", icons.out.every((s) => !s.endsWith(":0")), JSON.stringify(icons));

// 개발용 날짜는 배포 주소에서 꺼져 있어야 해요 (TL-014)
await go(BASE + "?today=2026-01-01");
check("배포 주소에서는 ?today가 꺼져 있음", !(await evaluate(`document.getElementById('today-date').textContent`)).includes("테스트"));

// 할 일 추가 → 오프라인에서 새로고침
await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '배포 확인용'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
await send("Network.enable");
await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const problemsBefore = problems.length;
await reload();
const offline = await evaluate(`({ title: document.querySelector('.app-header__title')?.textContent, items: [...document.querySelectorAll('.todo__text')].map(e => e.textContent), online: navigator.onLine })`);
problems.splice(problemsBefore); // 오프라인 동안 브라우저가 남기는 네트워크 오류는 의도된 것
await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
check("오프라인(네트워크 끊김)에서 새로고침해도 앱과 저장된 할 일이 그대로", offline.title === "오늘의 할 일" && offline.items.includes("배포 확인용") && offline.online === false, JSON.stringify(offline));

await evaluate("localStorage.clear()");
check("콘솔 오류 없음", problems.length === 0, problems.join("\n"));
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok && !c.detail ? "" : "  — " + c.detail}`);
ws.close();
chrome.kill();
process.exit(checks.every((c) => c.ok) ? 0 : 1);

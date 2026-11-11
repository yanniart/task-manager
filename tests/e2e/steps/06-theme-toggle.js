// 화면 모드 전환 버튼·반복 일정 버튼·+ 버튼 흑백 확인 (PRD F12, TL-019, TL-020)
// ※ 단독으로 실행하는 파일이 아니에요. tests/e2e/run.mjs가 harness.js(+ audit.js) 뒤에 이어 붙여서 실행해요.
//   그래서 send·evaluate·go·reload·shot·check·sleep·problems·dialogs·BASE·OUT 같은 이름을 그냥 써요.
// ===================== 화면 모드 전환(F12) + 반복 일정 버튼 =====================
const media = (v) => send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: v }] });
const st = () => evaluate(`({
  theme: document.documentElement.dataset.theme,
  bg: getComputedStyle(document.body).backgroundColor,
  saved: JSON.parse(localStorage.getItem('task-manager') || '{}').settings?.theme ?? null,
  label: document.getElementById('theme-button').getAttribute('aria-label'),
  icon: document.getElementById('theme-button').dataset.theme,
  meta: [...document.querySelectorAll('meta[name=theme-color]')].map(m => m.content).join(','),
  live: document.getElementById('live-status').textContent,
})`);
const LIGHT_BG = "rgb(246, 245, 244)", DARK_BG = "rgb(25, 25, 25)";

await media("light");
await go(BASE);
await evaluate("localStorage.clear()");
await reload();
let s = await st();
check("처음: 시스템 설정(라이트) 따름, 반쪽 원 아이콘, 버튼 이름에 다음 모드 안내",
  s.theme === "light" && s.bg === LIGHT_BG && s.icon === "system" && s.label === "화면 모드: 시스템 설정 (누르면 라이트)" && s.meta === "#f6f5f4,#191919", JSON.stringify(s));
await media("dark");
await sleep(200);
s = await st();
check("시스템 설정이 다크로 바뀌면 새로고침 없이 바로 따라감", s.theme === "dark" && s.bg === DARK_BG && s.icon === "system", JSON.stringify(s));

// 시스템(다크) → 라이트 → 다크 → 시스템
await evaluate(`document.getElementById('theme-button').click()`);
await sleep(150);
s = await st();
check("한 번 누르면 라이트: 시스템이 다크여도 라이트, 해 아이콘, 저장, 주소창 색도 라이트, 결과 안내",
  s.theme === "light" && s.bg === LIGHT_BG && s.icon === "light" && s.saved === "light" && s.meta === "#f6f5f4,#f6f5f4" &&
  s.label === "화면 모드: 라이트 (누르면 다크)" && s.live === "화면 모드: 라이트로 바꿨어요", JSON.stringify(s));
await media("light");
await evaluate(`document.getElementById('theme-button').click()`);
await sleep(150);
s = await st();
check("두 번 누르면 다크: 시스템이 라이트여도 다크, 달 아이콘, 주소창 색 다크",
  s.theme === "dark" && s.bg === DARK_BG && s.icon === "dark" && s.saved === "dark" && s.meta === "#191919,#191919" && s.live === "화면 모드: 다크로 바꿨어요", JSON.stringify(s));
await shot("s6-dark-chosen.png");
await reload();
s = await st();
check("새로고침해도 다크 유지", s.theme === "dark" && s.bg === DARK_BG && s.icon === "dark", JSON.stringify(s));

// 깜빡임 방지: 앱 JS 없이 머리의 인라인 스크립트만으로 첫 화면이 다크인지
const problemsBeforeBlock = problems.length;
await send("Network.enable");
await send("Network.setBypassServiceWorker", { bypass: true });
await send("Network.setBlockedURLs", { urls: ["*main.js"] });
await reload();
const early = await evaluate(`({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, appRan: !!document.getElementById('theme-button').dataset.theme })`);
check("앱 JS가 실행되기 전(인라인 스크립트만)에도 저장된 다크가 적용됨 → 깜빡임 없음", early.theme === "dark" && early.bg === DARK_BG && !early.appRan, JSON.stringify(early));
await send("Network.setBlockedURLs", { urls: [] });
// 앱 JS를 막아서 생긴 오류 기록은 의도된 것
problems.splice(problemsBeforeBlock);
await send("Network.setBypassServiceWorker", { bypass: false });
await reload();

await evaluate(`document.getElementById('theme-button').click()`);
await sleep(150);
s = await st();
check("세 번 누르면 시스템 설정으로 돌아감 (시스템=라이트), 주소창 색 원래대로",
  s.theme === "light" && s.icon === "system" && s.saved === "system" && s.meta === "#f6f5f4,#191919" && s.live === "화면 모드: 시스템 설정을 따라가요", JSON.stringify(s));

// 예전 데이터(theme 없음)는 시스템으로
await evaluate(`localStorage.setItem('task-manager', JSON.stringify({ version: 1, todos: [], rules: [], settings: { filter: 'all', lastCategory: 'work', lastOpenedDate: null } }))`);
await reload();
s = await st();
check("theme이 없는 예전 데이터는 '시스템 설정'으로", s.icon === "system" && s.theme === "light", JSON.stringify(s));

// 키보드로도
await evaluate(`document.getElementById('theme-button').focus()`);
await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await send("Input.dispatchKeyEvent", { type: "char", key: "Enter", text: "\r" });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await sleep(150);
check("키보드(Enter)로도 바뀌고 포커스 유지", (await st()).icon === "light" && (await evaluate(`document.activeElement.id`)) === "theme-button");

// 반복 일정 관리 버튼
const rb = await evaluate(`(() => { const b = document.getElementById('rules-button'); return { label: b.getAttribute('aria-label'), title: b.title, paths: b.querySelectorAll('path').length, oldMenu: !!document.getElementById('menu-button') }; })()`);
check("반복 일정 버튼: 🔁 모양(화살표 4획) 아이콘, 이름 '반복 일정 관리', 옛 ☰ 없음", rb.label === "반복 일정 관리" && rb.title === "반복 일정 관리" && rb.paths === 4 && !rb.oldMenu, JSON.stringify(rb));
await evaluate(`document.getElementById('rules-button').click()`);
await sleep(150);
const opened = await evaluate(`!document.getElementById('rules-view').hidden`);
await evaluate(`document.getElementById('rules-close').click()`);
check("누르면 반복 일정 관리가 열리고, 닫으면 이 버튼으로 포커스", opened && (await evaluate(`document.activeElement.id`)) === "rules-button");

// + 버튼 흑백: 라이트는 검은 원·흰 +, 다크는 흰 원·검은 +, 대비 3:1 이상
const fabCheck = () => evaluate(`(() => {
  const toRgb = (s) => s.match(/[0-9.]+/g).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (c, bg) => { const a = c[3] ?? 1; return [0, 1, 2].map((i) => c[i] * a + bg[i] * (1 - a)); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  const fab = document.getElementById('add-button');
  const canvas = toRgb(getComputedStyle(document.body).backgroundColor);
  const fill = blend(toRgb(getComputedStyle(fab).backgroundColor), canvas);
  const icon = blend(toRgb(getComputedStyle(fab).color), fill);
  return { fillLum: +lum(fill).toFixed(2), iconVsFill: ratio(icon, fill), fabVsCanvas: ratio(fill, canvas), stroke: fab.querySelector('path').getAttribute('stroke-width') };
})()`);
await go(BASE);
await evaluate(`localStorage.setItem('task-manager', JSON.stringify({ version: 1, todos: [], rules: [], settings: { filter: 'all', lastCategory: 'work', lastOpenedDate: null, theme: 'light' } }))`);
await reload();
const fabL = await fabCheck();
await shot("s7-fab-light.png");
await evaluate(`document.getElementById('theme-button').click()`); // 라이트 → 다크
await sleep(200);
const fabD = await fabCheck();
await shot("s7-fab-dark.png");
check("+ 버튼 흑백: 라이트=검은 원, 다크=흰 원, + 와 원 대비·원과 바탕 대비 3:1 이상, 선 굵기 2(헤더 아이콘과 같음)",
  fabL.fillLum < 0.05 && fabD.fillLum > 0.7 && fabL.iconVsFill >= 3 && fabD.iconVsFill >= 3 && fabL.fabVsCanvas >= 3 && fabD.fabVsCanvas >= 3 && fabL.stroke === "2",
  JSON.stringify({ light: fabL, dark: fabD }));
await evaluate(`localStorage.clear()`);

// 헤더 배치: 가장 긴 날짜(개발용 테스트 날짜)에서도 버튼 두 개가 화면 안에, 44px
for (const width of [375, 360]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 2, mobile: true });
  await go(BASE + "?today=2026-11-16");
  const h = await evaluate(`(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const t = r('theme-button'), m = r('rules-button');
    const title = document.querySelector('.app-header__title'); const lh = parseFloat(getComputedStyle(title).lineHeight);
    return { titleOneLine: title.getBoundingClientRect().height < lh * 1.5, scroll: document.documentElement.scrollWidth, tw: Math.round(t.width), th: Math.round(t.height), mw: Math.round(m.width), right: Math.round(m.right), sameRow: Math.abs(t.top - m.top) < 1 };
  })()`);
  check(`${width}px 헤더: 제목 한 줄, 버튼 두 개 44px·한 줄·화면 안, 가로 스크롤 없음`, h.titleOneLine && h.scroll <= width && h.tw >= 44 && h.th >= 44 && h.mw >= 44 && h.right <= width && h.sameRow, JSON.stringify(h));
  await shot(`s6-header-${width}.png`);
}
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await evaluate("localStorage.clear()");

check("콘솔 오류 없음", problems.length === 0, problems.join("\n"));
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok && !c.detail ? "" : "  — " + c.detail}`);
ws.close();
chrome.kill();
process.exit(checks.every((c) => c.ok) ? 0 : 1);

// 5단계 확인: PWA(서버를 끈 뒤 새로고침)·다크 모드 대비·PC IP 접속 (TRD 5.8, 6장)
// ※ 단독으로 실행하는 파일이 아니에요. tests/e2e/run.mjs가 harness.js(+ audit.js) 뒤에 이어 붙여서 실행해요.
//   그래서 send·evaluate·go·reload·shot·check·sleep·problems·dialogs·BASE·OUT 같은 이름을 그냥 써요.
// ===================== 5단계 확인: PWA·다크 모드·마무리 =====================
import { networkInterfaces } from "node:os";
const PORT2 = Number(process.env.SECOND_PORT || 8001); // 서버를 껐다 켤 수 있게 따로 띄우는 서버
const ROOT = process.env.APP_ROOT;
const B2 = `http://localhost:${PORT2}/`;
const DAY = "2026-11-16";
const startServer = async () => {
  const srv = spawn(process.env.PYTHON || "python", ["-m", "http.server", String(PORT2), "--directory", ROOT], { stdio: "ignore" });
  process.on("exit", () => { try { srv.kill(); } catch {} });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(B2)).ok) return srv; } catch {} await sleep(200); }
  throw new Error("server did not start");
};
let server = await startServer();

const T = (id, i, extra = {}) => ({ id, text: extra.text ?? id, category: "work", date: DAY, done: false, order: i, ruleId: null,
  carriedFrom: null, createdAt: "2026-11-16T00:00:00.000Z", completedAt: null, ...extra });
const RICH = {
  todos: [
    T("c", 0, { text: "보고서 마무리", carriedFrom: "2026-11-14" }),
    T("r", 1, { text: "영단어 30개", category: "study", ruleId: "R1" }),
    T("n", 2, { text: "장보기", category: "personal" }),
    T("d", 0, { text: "운동", done: true, completedAt: "2026-11-16T01:00:00.000Z" }),
    T("pv", 0, { text: "지난주 정리", date: "2026-11-15", done: true, completedAt: "2026-11-15T01:00:00.000Z" }),
  ],
  rules: [
    { id: "R1", text: "영단어 30개", category: "study", repeat: { type: "weekly", days: [1, 3] }, paused: false, createdAt: "", lastGeneratedDate: DAY },
    { id: "R2", text: "물 마시기", category: "personal", repeat: { type: "daily", days: [] }, paused: true, createdAt: "", lastGeneratedDate: DAY },
  ],
};
const ALLDONE = { todos: [T("a", 0, { text: "운동", done: true, completedAt: "2026-11-16T01:00:00.000Z" })], rules: [] };
async function seed2(data, filter = "all") {
  await go(B2 + "?today=" + DAY);
  await evaluate(`localStorage.setItem('task-manager', JSON.stringify(${JSON.stringify({ version: 1, ...data, settings: { filter, lastCategory: "work", lastOpenedDate: DAY } })}))`);
  await reload();
}

// 글자 대비 계산 audit()은 audit.js에 있어요 (run.mjs가 앞에 이어 붙여요).
const auditScreens = async (label) => {
  const results = [];
  await seed2(RICH);
  await evaluate(`document.querySelector('#prev-section').open = true`);
  results.push(["본 화면(이월·반복·완료·이전 완료)", await audit()]);
  await shot(`s5-${label}-main.png`);
  await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '헬스'; i.dispatchEvent(new Event('input')); document.querySelector('#repeat-types input[value=weekly]').click(); })()`);
  await sleep(350);
  results.push(["추가 시트(매주·요일)", await audit()]);
  await shot(`s5-${label}-sheet.png`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await evaluate(`document.querySelector('[data-id="r"] [data-action=edit]').click()`);
  await sleep(350);
  results.push(["수정 시트(반복 안내)", await audit()]);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await evaluate(`document.getElementById('rules-button').click()`);
  await sleep(200);
  results.push(["반복 일정 관리(일시정지 포함)", await audit()]);
  await shot(`s5-${label}-rules.png`);
  await evaluate(`document.getElementById('rules-close').click()`);
  await evaluate(`document.querySelector('#filters [data-filter=study]').click()`);
  await evaluate(`document.querySelector('[data-id="r"] .todo__check').click()`);
  await sleep(100);
  await evaluate(`document.querySelector('#filters [data-filter=personal]').click(); document.querySelector('[data-id="n"] .todo__check').click(); document.querySelector('#filters [data-filter=work]').click();`);
  await sleep(100);
  await seed2({ todos: [T("x", 0, { category: "personal" })], rules: [] }, "work");
  results.push(["필터로 빈 목록 안내", await audit()]);
  await seed2(ALLDONE);
  results.push(["100% 축하 문구", await audit()]);
  await seed2({ todos: [], rules: [] });
  results.push(["할 일 0개", await audit()]);
  return results;
};

// ---- 1) 라이트·다크 대비 ----
for (const scheme of ["light", "dark"]) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  const bg = await (async () => { await go(B2); return evaluate(`getComputedStyle(document.body).backgroundColor`); })();
  const res = await auditScreens(scheme);
  const worst = res.map(([n, r]) => `${n}: 글자 ${r.count}개, 최저 ${r.min}`).join(" / ");
  const bad = res.flatMap(([n, r]) => r.bad.map((b) => `${n} "${b.text}" ${b.ratio} < ${b.need}`));
  check(`${scheme === "dark" ? "다크" : "라이트"} 모드: 모든 화면 글자 대비 기준 이상 (바탕 ${bg})`, bad.length === 0, bad.length ? bad.join("; ") : worst);
}
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
const themeMeta = await evaluate(`[...document.querySelectorAll('meta[name=theme-color]')].map(m => m.media + '=' + m.content).join(', ')`);
check("theme-color가 라이트·다크 바탕색과 같음", themeMeta.includes("light) =#f6f5f4".replace(" ", "")) || themeMeta === "(prefers-color-scheme: light)=#f6f5f4, (prefers-color-scheme: dark)=#191919", themeMeta);

// ---- 2) manifest·아이콘·설치 가능 ----
await go(B2);
const mf = await evaluate(`(async () => {
  const m = await (await fetch('./manifest.webmanifest')).json();
  const icons = [];
  for (const ic of m.icons) {
    const ok = (await fetch(ic.src)).ok;
    const img = new Image(); img.src = ic.src; await img.decode().catch(() => {});
    icons.push(ic.src.split('/').pop() + ':' + ok + ':' + img.naturalWidth + ':' + ic.purpose);
  }
  return { name: m.name, short: m.short_name, start: m.start_url, display: m.display, icons };
})()`);
check("manifest: 이름·짧은 이름·start_url ./·standalone·아이콘 192/512/maskable 모두 열림",
  mf.name === "오늘의 할 일" && mf.short === "할 일" && mf.start === "./" && mf.display === "standalone" &&
  mf.icons.includes("icon-192.png:true:192:any") && mf.icons.includes("icon-512.png:true:512:any") && mf.icons.includes("icon-maskable-512.png:true:512:maskable"), JSON.stringify(mf));

// ---- 3) 서비스 워커 ----
const sw = await evaluate(`(async () => {
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 8000))]);
  if (!reg) return { ok: false };
  for (let i = 0; i < 40 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
  const keys = await caches.keys();
  const cached = await (await caches.open('tm-cache-v6')).keys();
  return { ok: true, scope: reg.scope, controller: !!navigator.serviceWorker.controller, keys, count: cached.length };
})()`);
check("localhost: 서비스 워커 등록·제어, 캐시 tm-cache-v6에 앱 파일 38개", sw.ok && sw.controller && JSON.stringify(sw.keys) === '["tm-cache-v6"]' && sw.count === 38, JSON.stringify(sw));
const install = await send("Page.getInstallabilityErrors");
check("Chrome 설치 가능 검사 통과 (홈 화면 추가 가능)", install.installabilityErrors.length === 0, JSON.stringify(install.installabilityErrors));

// 데이터 하나 넣어 두기
await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '오프라인 확인'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
await sleep(200);

// ---- 4) 서버를 끄고 새로고침 ----
server.kill();
await sleep(800);
let serverDown = false; try { await fetch(B2); } catch { serverDown = true; }
const problemsBeforeOffline = problems.length;
await reload();
const off = await evaluate(`({ title: document.querySelector('.app-header__title')?.textContent, items: [...document.querySelectorAll('.todo__text')].map(e => e.textContent), css: getComputedStyle(document.body).backgroundColor, ctrl: !!navigator.serviceWorker.controller })`);
check("서버를 끈 뒤 새로고침해도 앱이 열림 (화면·CSS·저장된 할 일 그대로)", serverDown && off.title === "오늘의 할 일" && off.items.includes("오프라인 확인") && off.css === "rgb(246, 245, 244)" && off.ctrl, JSON.stringify({ serverDown, ...off }));
await go(B2 + "?today=" + DAY);
check("오프라인에서 ?today 붙은 주소도 열림 (주소 뒤 값 무시하고 캐시에서)", (await evaluate(`document.getElementById('today-date').textContent`)).startsWith("11.16(월)"));
await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '오프라인에서 추가'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
check("오프라인에서도 할 일 추가 동작", (await evaluate(`[...document.querySelectorAll('.todo__text')].map(e => e.textContent)`)).includes("오프라인에서 추가"));
// 서버가 꺼져 있는 동안 브라우저가 남기는 네트워크 오류(아이콘 갱신 확인 등)는 의도된 것
problems.splice(problemsBeforeOffline);

// ---- 5) PC IP 주소(http://)로 접속: 서비스 워커 건너뛰고, 할 일 기능은 그대로 ----
server = await startServer();
const lan = Object.values(networkInterfaces()).flat().find((n) => n.family === "IPv4" && !n.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(n.address))?.address;
if (lan) {
  await go(`http://${lan}:${PORT2}/?today=${DAY}`);
  await sleep(500);
  const ip = await evaluate(`(async () => {
    const r = { secure: window.isSecureContext, hasUUID: typeof crypto.randomUUID === 'function', regs: (await navigator.serviceWorker?.getRegistrations?.() ?? []).length, date: document.getElementById('today-date').textContent };
    document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = 'IP로 추가'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click();
    r.added = [...document.querySelectorAll('.todo__text')].map(e => e.textContent).includes('IP로 추가');
    r.id = JSON.parse(localStorage.getItem('task-manager')).todos[0].id;
    return r;
  })()`);
  check(`PC IP(http://${lan})로 접속: 서비스 워커 건너뜀, randomUUID 없이도 할 일 추가, ?today 동작`,
    !ip.secure && ip.regs === 0 && !ip.hasUUID && ip.added && /^[0-9a-z]+-[0-9a-z]+$/.test(ip.id) && ip.date.includes("테스트 날짜"), JSON.stringify(ip));
} else {
  check("PC IP(http://사설 IP)로 접속 — 건너뜀: 이 컴퓨터에 사설 IP가 없어요", true, "skipped");
}
server.kill();

// ---- 6) 사용자 데이터가 innerHTML로 들어가는 곳 없음 ----
await go(BASE + "?today=" + DAY);
await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '<img src=x onerror=alert(1)><b>굵게</b>'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
await sleep(150);
check("HTML 같은 입력은 글자 그대로 표시 (img·b 요소 안 생김, 경고창 없음)", (await evaluate(`document.querySelectorAll('.todo img, .todo b').length`)) === 0 && dialogs.length === 0);
await evaluate("localStorage.clear()");

await go(BASE + "tests/core.test.html");
await sleep(300);
const summary = await evaluate(`globalThis.__testSummary`);
check("tests/core.test.html 모두 통과", summary && summary.failed === 0, JSON.stringify(summary));
check("콘솔 오류 없음", problems.length === 0, problems.join("\n"));

for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok && !c.detail ? "" : "  — " + c.detail}`);
ws.close();
chrome.kill();
process.exit(checks.every((c) => c.ok) ? 0 : 1);

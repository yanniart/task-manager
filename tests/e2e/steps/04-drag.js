// 4단계 확인: 드래그 정렬 — 실제 터치·마우스 입력 (PRD F10)
// ※ 단독으로 실행하는 파일이 아니에요. tests/e2e/run.mjs가 harness.js(+ audit.js) 뒤에 이어 붙여서 실행해요.
//   그래서 send·evaluate·go·reload·shot·check·sleep·problems·dialogs·BASE·OUT 같은 이름을 그냥 써요.
// ===================== 4단계 확인: 드래그 정렬 =====================
const DAY = "2026-11-16";
const T = (id, i, extra = {}) => ({ id, text: id, category: "work", date: DAY, done: false, order: i, ruleId: null,
  carriedFrom: null, createdAt: "2026-11-16T00:00:00.000Z", completedAt: null, ...extra });
async function seed(todos, filter = "all") {
  await go(BASE + "?today=" + DAY);
  await evaluate(`localStorage.setItem('task-manager', JSON.stringify(${JSON.stringify({ version: 1, todos, rules: [],
    settings: { filter, lastCategory: "work", lastOpenedDate: DAY } })}))`);
  await reload();
}
const order = () => evaluate(`[...document.querySelectorAll('#active-list .todo')].map(li => li.dataset.id)`);
const savedOrder = () => evaluate(`JSON.parse(localStorage.getItem('task-manager')).todos.filter(t => !t.done && t.date === '${DAY}').sort((a,b) => a.order - b.order).map(t => t.id + ':' + t.order)`);
const handlePos = (id) => evaluate(`(() => { const r = document.querySelector('[data-id="${id}"] .todo__handle').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
const centerY = (id) => evaluate(`(() => { const r = document.querySelector('[data-id="${id}"]').getBoundingClientRect(); return r.top + r.height / 2; })()`);
const touch = (type, x, y) => send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
const key = async (k, code) => {
  await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code: k, windowsVirtualKeyCode: code });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code });
};
async function touchDrag(id, toY, { steps = 10, midCheck = null, hold = 0 } = {}) {
  const p = await handlePos(id);
  await touch("touchStart", p.x, p.y);
  let mid = null;
  for (let i = 1; i <= steps; i++) {
    await touch("touchMove", p.x, p.y + ((toY - p.y) * i) / steps);
    await sleep(16);
    if (i === Math.ceil(steps / 2) && midCheck) mid = await evaluate(midCheck);
  }
  if (hold) await sleep(hold);
  await touch("touchEnd", p.x, toY);
  await sleep(250);
  return mid;
}

// ---- 1) 터치로 아래로 끌기 ----
await seed(["A", "B", "C", "D", "E", "F"].map((id, i) => T(id, i)));
check("미완료 항목마다 손잡이, 손잡이에 touch-action: none",
  (await evaluate(`document.querySelectorAll('#active-list .todo__handle').length`)) === 6 &&
  (await evaluate(`getComputedStyle(document.querySelector('.todo__handle')).touchAction`)) === "none");
await evaluate(`window.__scroll0 = window.scrollY; window.__node = document.querySelector('[data-id="A"]')`);
const mid = await touchDrag("A", (await centerY("C")) + 6, {
  midCheck: `({
    sameNode: document.querySelector('.todo--dragging') === window.__node && window.__node.isConnected,
    transform: window.__node.style.transform,
    savedUnchanged: JSON.parse(localStorage.getItem('task-manager')).todos.find(t => t.id === 'A').order === 0,
    scroll: window.scrollY - window.__scroll0,
    siblingMoved: [...document.querySelectorAll('#active-list .todo')].some(li => li !== window.__node && li.style.transform.includes('-')),
  })` });
check("끄는 동안: 같은 요소가 transform으로 움직이고 다시 그리지·저장하지 않음, 다른 항목이 비켜 줌",
  mid.sameNode && mid.transform.startsWith("translateY(") && mid.savedUnchanged && mid.siblingMoved, JSON.stringify(mid));
check("끄는 동안 화면이 같이 스크롤되지 않음", mid.scroll === 0, "scroll Δ=" + mid.scroll);
check("손을 떼면 순서 반영 (A를 C 아래로)", JSON.stringify(await order()) === '["B","C","A","D","E","F"]', JSON.stringify(await order()));
check("저장된 order는 0부터 빈틈없이", JSON.stringify(await savedOrder()) === '["B:0","C:1","A:2","D:3","E:4","F:5"]', JSON.stringify(await savedOrder()));
check("끝나면 남은 transform·드래그 표시 없음", await evaluate(`!document.querySelector('.todo--dragging, .todo-list--dragging') && [...document.querySelectorAll('.todo')].every(li => !li.style.transform)`));
await reload();
check("새로고침 후 순서 유지", JSON.stringify(await order()) === '["B","C","A","D","E","F"]');
await shot("s4-0-after.png");

// ---- 2) 마우스로 위로 끌기 ----
{
  const p = await handlePos("E");
  const to = (await centerY("C")) - 6;
  await mouse("mousePressed", p.x, p.y);
  for (let i = 1; i <= 8; i++) { await mouse("mouseMoved", p.x, p.y + ((to - p.y) * i) / 8); await sleep(16); }
  await shot("s4-1-dragging.png");
  await mouse("mouseReleased", p.x, to);
  await sleep(250);
}
check("마우스로도 동작 (E를 C 위로)", JSON.stringify(await order()) === '["B","E","C","A","D","F"]', JSON.stringify(await order()));

// ---- 3) Esc로 취소 ----
{
  const before = JSON.stringify(await order());
  const p = await handlePos("B");
  await mouse("mousePressed", p.x, p.y);
  for (let i = 1; i <= 6; i++) { await mouse("mouseMoved", p.x, p.y + 30 * i); await sleep(16); }
  await key("Escape", 27);
  await mouse("mouseReleased", p.x, p.y + 180);
  await sleep(250);
  check("끄는 중 Esc → 취소, 순서 그대로", JSON.stringify(await order()) === before && await evaluate(`[...document.querySelectorAll('.todo')].every(li => !li.style.transform)`), JSON.stringify(await order()));
}

// ---- 4) 제자리에 놓으면 저장 안 함 ----
{
  const before = await evaluate(`localStorage.getItem('task-manager')`);
  const p = await handlePos("C");
  await touchDrag("C", p.y + 10, { steps: 3 });
  check("거의 안 움직이고 놓으면 그대로 (저장 안 함)", (await evaluate(`localStorage.getItem('task-manager')`)) === before);
}

// ---- 5) 키보드 ↑/↓ ----
await evaluate(`document.querySelector('[data-id="C"] .todo__handle').focus()`);
await key("ArrowDown", 40);
await sleep(150);
const kb1 = { order: await order(), focus: await evaluate(`document.activeElement.closest('[data-id]')?.dataset.id + ':' + document.activeElement.className`), status: await evaluate(`document.getElementById('live-status').textContent`) };
check("↓ 키로 한 칸 아래, 같은 손잡이에 포커스 유지, 결과 안내", JSON.stringify(kb1.order) === '["B","E","A","C","D","F"]' && kb1.focus === "C:todo__handle" && kb1.status === '"C" 6개 중 4번째로 옮겼어요', JSON.stringify(kb1));
await key("ArrowUp", 38); await sleep(100);
await key("ArrowUp", 38); await sleep(100);
check("↑ 키로 두 칸 위", JSON.stringify(await order()) === '["B","C","E","A","D","F"]', JSON.stringify(await order()));
await evaluate(`document.querySelector('[data-id="B"] .todo__handle').focus()`);
const scrollBeforeKey = await evaluate(`window.scrollY`);
await key("ArrowUp", 38); await sleep(100);
check("맨 위에서 ↑는 아무 일 없음 (화면도 안 움직임)", JSON.stringify(await order()) === '["B","C","E","A","D","F"]' && (await evaluate(`window.scrollY`)) === scrollBeforeKey);

// ---- 6) 완료 항목은 끌 수 없음 ----
await evaluate(`document.querySelector('[data-id="F"] .todo__check').click()`);
await sleep(150);
check("완료 구역 항목에는 손잡이 없음", (await evaluate(`document.querySelectorAll('#done-list .todo__handle').length`)) === 0 && (await evaluate(`document.querySelectorAll('#done-list .todo').length`)) === 1);

// ---- 7) 필터 켠 상태에서 끌기 ----
await seed([T("w1", 0), T("p1", 1, { category: "personal" }), T("w2", 2), T("p2", 3, { category: "personal" }), T("w3", 4), T("p3", 5, { category: "personal" })], "work");
check("필터(업무): 업무만 보임", JSON.stringify(await order()) === '["w1","w2","w3"]');
await touchDrag("w3", (await centerY("w1")) - 6);
check("필터 상태에서 w3를 맨 위로", JSON.stringify(await order()) === '["w3","w1","w2"]', JSON.stringify(await order()));
await evaluate(`document.querySelector('#filters [data-filter=all]').click()`);
await sleep(150);
check("'전체'로 돌아가면: 업무끼리만 섞이고 개인 항목은 제자리 (p1·p2·p3 자리·순서 유지)",
  JSON.stringify(await order()) === '["w3","p1","w1","p2","w2","p3"]', JSON.stringify(await order()));

// ---- 8) 이월 항목을 아래로 옮긴 뒤 새 할 일은 맨 위 ----
await seed([T("c1", 0, { carriedFrom: "2026-11-14" }), T("x", 1), T("y", 2)]);
await touchDrag("c1", (await centerY("y")) + 6);
check("이월 항목을 맨 아래로", JSON.stringify(await order()) === '["x","y","c1"]', JSON.stringify(await order()));
await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '새 할 일'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
await sleep(200);
check("그 뒤 새 할 일은 맨 위 (드래그 결과 존중)", (await evaluate(`document.querySelector('#active-list .todo .todo__text').textContent`)) === "새 할 일");

// ---- 9) 자동 스크롤 ----
await seed(Array.from({ length: 16 }, (_, i) => T("n" + String(i + 1).padStart(2, "0"), i)));
await evaluate(`window.scrollTo(0, 0)`);
const vh = await evaluate(`window.innerHeight`);
await evaluate(`window.__scroll0 = window.scrollY`);
await touchDrag("n01", vh - 8, { steps: 6, hold: 1200 });
const auto = { scrolled: await evaluate(`window.scrollY - window.__scroll0`), order: await order() };
check("화면 아래 끝에 대고 있으면 자동 스크롤, 놓은 자리로 이동", auto.scrolled > 100 && auto.order.indexOf("n01") === 15, JSON.stringify({ scrolled: auto.scrolled, idx: auto.order.indexOf("n01") }));
const ord16 = await savedOrder();
check("자동 스크롤 후에도 order 0~15 빈틈없음", ord16.every((s, i) => s.endsWith(":" + i)) && ord16.length === 16);

// ---- 10) 레이아웃 ----
for (const width of [375, 360]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(200);
  const l = await evaluate(`(() => {
    const small = [...document.querySelectorAll('.todo__check, .todo__body, .todo__handle')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length;
    return { scroll: document.documentElement.scrollWidth, small };
  })()`);
  check(`${width}px: 손잡이 포함 44px 이상, 가로 스크롤 없음`, l.scroll <= width && l.small === 0, JSON.stringify(l));
}
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await evaluate("localStorage.clear()");

// 테스트 페이지
await go(BASE + "tests/core.test.html");
await sleep(300);
const summary = await evaluate(`globalThis.__testSummary`);
check("tests/core.test.html 모두 통과", summary && summary.failed === 0, JSON.stringify(summary));
check("콘솔 오류 없음", problems.length === 0, problems.join("\n"));

for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok && !c.detail ? "" : "  — " + c.detail}`);
ws.close();
chrome.kill();
process.exit(checks.every((c) => c.ok) ? 0 : 1);

// 성능 측정 (TRD 5.14): CPU 4배 느리게, 할 일 PERF_N개(기본 300). 확인이 아니라 측정값만 출력해요
// ※ 단독으로 실행하는 파일이 아니에요. tests/e2e/run.mjs가 harness.js(+ audit.js) 뒤에 이어 붙여서 실행해요.
//   그래서 send·evaluate·go·reload·shot·check·sleep·problems·dialogs·BASE·OUT 같은 이름을 그냥 써요.
// ===================== 성능 측정 (CPU 4배 느리게 = 휴대폰 흉내) =====================
const DAY = "2026-11-16";
const N = Number(process.env.PERF_N || 300);
const cats = ["work", "personal", "study"];
const todos = Array.from({ length: N }, (_, i) => ({
  id: "t" + i, text: `할 일 ${i} 보고서 정리와 메일 답장`, category: cats[i % 3], date: DAY, done: i % 4 === 0, order: i,
  ruleId: null, carriedFrom: i % 10 === 0 ? "2026-11-14" : null, createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString(),
  completedAt: i % 4 === 0 ? new Date(Date.UTC(2026, 10, 16, 0, i)).toISOString() : null,
}));
await go(BASE + "?today=" + DAY);
await evaluate(`localStorage.setItem('task-manager', JSON.stringify(${JSON.stringify({ version: 1, todos, rules: [], settings: { filter: "all", lastCategory: "work", lastOpenedDate: DAY } })}))`);
await send("Emulation.setCPUThrottlingRate", { rate: 4 });
const t0 = Date.now();
await reload();
const loadMs = Date.now() - t0;
const measure = (expr, times = 5) => evaluate(`(async () => {
  const runs = [];
  for (let k = 0; k < ${times}; k++) {
    const t = performance.now();
    ${expr};
    runs.push(performance.now() - t);
    await new Promise(r => setTimeout(r, 30));
  }
  runs.sort((a, b) => a - b);
  return { median: +runs[Math.floor(runs.length / 2)].toFixed(1), max: +runs[runs.length - 1].toFixed(1) };
})()`);
const result = {
  N,
  load: loadMs,
  toggle: await measure(`document.querySelector('#active-list .todo__check').click()`),
  filter: await measure(`document.querySelector('#filters [data-filter=' + ['work','all'][k % 2] + ']').click()`),
  keyboardMove: await measure(`(() => { const h = document.querySelector('#active-list .todo__handle'); h.focus(); h.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); })()`),
  nodes: await evaluate(`document.querySelectorAll('*').length`),
};
// 빠르게 5글자 입력 → 목록이 실제로 다시 그려진 횟수 (디바운스 확인)
result.typingRedraws = await evaluate(`(async () => {
  document.getElementById('search-button').click();
  let batches = 0;
  const mo = new MutationObserver(() => batches++);
  mo.observe(document.getElementById('active-list'), { childList: true });
  const i = document.getElementById('search-input');
  for (const v of ['보', '보고', '보고서', '보고서 1', '보고서 12']) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 40)); }
  await new Promise(r => setTimeout(r, 400));
  mo.disconnect();
  document.getElementById('search-close').click();
  return batches;
})()`);
if (process.env.PERF_SEARCH) {
  result.searchEnter = await measure(`(() => { document.getElementById('search-button')?.click(); const i = document.getElementById('search-input'); i.value = ['보고서 1', '메일'][k % 2]; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`);
  result.keystroke = await measure(`(() => { const i = document.getElementById('search-input'); i.value += 'a'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
}
await send("Emulation.setCPUThrottlingRate", { rate: 1 });
console.log("PERF " + JSON.stringify(result));
await evaluate("localStorage.clear()");
ws.close();
chrome.kill();
process.exit(0);

// 3단계 확인: 날짜·이월·반복 일정·반복 일정 관리 (PRD F7, F8)
// ※ 단독으로 실행하는 파일이 아니에요. tests/e2e/run.mjs가 harness.js(+ audit.js) 뒤에 이어 붙여서 실행해요.
//   그래서 send·evaluate·go·reload·shot·check·sleep·problems·dialogs·BASE·OUT 같은 이름을 그냥 써요.
// ===================== 3단계 확인 =====================
const FRI = "2026-11-13", SAT = "2026-11-14", MON = "2026-11-16";
const $text = (sel) => evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.textContent.trim())`);
const openDay = (day) => go(`${BASE}?today=${day}`);
const items = (listSel) => evaluate(`[...document.querySelectorAll('${listSel} .todo')].map(li => ({
  text: li.querySelector('.todo__text').textContent,
  repeat: !!li.querySelector('.tag--repeat'),
  carried: li.querySelector('.tag--carried')?.textContent ?? null,
}))`);
const addVia = (text, category, repeat, days = null) => evaluate(`(() => {
  document.getElementById('add-button').click();
  const i = document.getElementById('todo-text');
  i.value = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input'));
  document.querySelector('#sheet-categories input[value=${category}]').click();
  document.querySelector('#repeat-types input[value=${repeat}]').click();
  ${days ? `document.querySelectorAll('#repeat-days input').forEach(c => { if (c.checked !== ${JSON.stringify(days)}.includes(Number(c.value))) c.click(); });` : ""}
  const disabled = document.getElementById('sheet-save').disabled;
  document.getElementById('sheet-save').click();
  return disabled;
})()`);
const progressText = () => evaluate(`document.getElementById('progress-text').textContent`);
const storeState = () => evaluate(`JSON.parse(localStorage.getItem('task-manager'))`);
const clickItem = (text, action) => evaluate(`[...document.querySelectorAll('.todo')].find(li => li.querySelector('.todo__text').textContent === ${JSON.stringify(text)}).querySelector('[data-action=${action}]').click()`);
const esc = () => evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);

// ---- 금요일 ----
await go(BASE);
await evaluate("localStorage.clear()");
await openDay(FRI);
check("?today로 날짜 바꿈 + 테스트 날짜 표시", (await evaluate(`document.getElementById('today-date').textContent`)) === "11.13(금) · 테스트 날짜");

const repeatUI = await evaluate(`(() => {
  document.getElementById('add-button').click();
  const r = {
    types: [...document.querySelectorAll('#repeat-types .chip')].filter(c => !c.hidden).map(c => c.textContent),
    checked: document.querySelector('#repeat-types input:checked').value,
    daysHidden: document.getElementById('repeat-days').hidden,
    noteHidden: document.getElementById('repeat-note').hidden,
  };
  document.querySelector('#repeat-types input[value=weekly]').click();
  r.daysShown = !document.getElementById('repeat-days').hidden;
  r.preChecked = [...document.querySelectorAll('#repeat-days input:checked')].map(c => c.value);
  r.dayLabels = [...document.querySelectorAll('#repeat-days .chip')].map(c => c.textContent).join('');
  document.querySelector('#repeat-days input:checked').click();
  const i = document.getElementById('todo-text'); i.value = '요일 없음'; i.dispatchEvent(new Event('input'));
  r.disabledNoDays = document.getElementById('sheet-save').disabled;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  return r;
})()`);
check("추가 시트 반복 줄: 안 함/매일/평일/매주, 기본 안 함", JSON.stringify(repeatUI.types) === '["안 함","매일","평일","매주"]' && repeatUI.checked === "none" && repeatUI.daysHidden && repeatUI.noteHidden, JSON.stringify(repeatUI));
check("매주를 고르면 요일 줄(월~일) 보이고 오늘 요일(금=5) 미리 선택", repeatUI.daysShown && JSON.stringify(repeatUI.preChecked) === '["5"]' && repeatUI.dayLabels === "월화수목금토일");
check("매주인데 요일이 없으면 저장 비활성화", repeatUI.disabledNoDays);

await addVia("보고서", "work", "none");
await addVia("장보기", "personal", "none");
await addVia("영단어 30개", "study", "daily");
await addVia("출근 체크", "work", "weekdays");
await addVia("헬스", "personal", "weekly", [1, 3]);
await sleep(300);
const friItems = await items("#active-list");
check("금: 반복 규칙 저장 시 오늘 맞는 것만 오늘 할 일 생성 (🔁 표시)",
  JSON.stringify(friItems.map(i => i.text + (i.repeat ? "🔁" : ""))) === '["출근 체크🔁","영단어 30개🔁","장보기","보고서"]', JSON.stringify(friItems));
const s1 = await storeState();
check("규칙 3개 저장, lastGeneratedDate (헬스는 오늘 안 맞아서 없음)",
  s1.rules.length === 3 && JSON.stringify(s1.rules.map(r => r.lastGeneratedDate)) === `["${FRI}","${FRI}",null]`, JSON.stringify(s1.rules.map(r => [r.text, r.repeat, r.lastGeneratedDate])));
await clickItem("장보기", "toggle");
await sleep(200);
await shot("s3-1-fri.png");

// ---- 토요일 ----
await openDay(SAT);
const satActive = await items("#active-list");
check("토: 미완료 일반 할 일은 이월 (맨 위, '이월 11/13')",
  satActive[0]?.text === "보고서" && satActive[0]?.carried === "이월 11/13", JSON.stringify(satActive));
check("토: 매일 반복은 새로 하나, 평일 반복은 안 생기고 지난 것은 정리됨",
  JSON.stringify(satActive.map(i => i.text)) === '["보고서","영단어 30개"]', JSON.stringify(satActive.map(i => i.text)));
const prev = await evaluate(`({ hidden: document.getElementById('prev-section').hidden, open: document.getElementById('prev-section').open, count: document.getElementById('prev-count').textContent })`);
check("토: 완료 항목은 '이전에 완료한 항목 (1)' 접힘 구역", !prev.hidden && !prev.open && prev.count === "1", JSON.stringify(prev));
check("토: 진행률은 오늘 것만 (0 / 2)", (await progressText()) === "0 / 2 완료 · 0%", await progressText());
await reload();
check("토: 새로고침(같은 날 다시 실행)해도 반복 할 일은 하나",
  (await $text("#active-list .todo__text")).filter(t => t === "영단어 30개").length === 1 && (await storeState()).todos.length === 3, JSON.stringify(await $text(".todo__text")));
await evaluate(`document.querySelector('#prev-section summary').click()`);
await sleep(200);
check("이전에 완료한 항목 펼치기", JSON.stringify(await $text("#prev-list .todo__text")) === '["장보기"]');
await shot("s3-2-sat.png");
// 이전 완료 항목 완료 취소 → 오늘로
await clickItem("장보기", "toggle");
await sleep(200);
const undonePrev = await items("#active-list");
check("이전 완료 항목을 취소하면 오늘 미완료 맨 아래로 (이월 표시)", undonePrev.at(-1)?.text === "장보기" && undonePrev.at(-1)?.carried === "이월 11/13" && (await evaluate(`document.getElementById('prev-section').hidden`)), JSON.stringify(undonePrev));
await clickItem("장보기", "toggle"); // 다시 완료 (오늘 완료)

// ---- 월요일 ----
await openDay(MON);
const monActive = await items("#active-list");
check("월: 이월 2번째에도 carriedFrom은 처음 날짜, 매일·평일·매주(월) 생성",
  monActive[0]?.text === "보고서" && monActive[0]?.carried === "이월 11/13" &&
  JSON.stringify(monActive.slice(1).map(i => i.text).sort()) === JSON.stringify(["영단어 30개", "출근 체크", "헬스"].sort()) &&
  monActive.slice(1).every(i => i.repeat), JSON.stringify(monActive));
check("월: 반복 생성분은 규칙 목록 순서대로 이월 바로 아래", JSON.stringify(monActive.map(i => i.text)) === '["보고서","영단어 30개","출근 체크","헬스"]', JSON.stringify(monActive.map(i => i.text)));

// 반복 할 일 수정 시트 안내
await clickItem("헬스", "edit");
await sleep(300);
const note = await evaluate(`({ repeatHidden: document.getElementById('repeat-field').hidden, note: document.getElementById('repeat-note').textContent, hidden: document.getElementById('repeat-note').hidden })`);
check("반복 할 일 수정: 반복 줄 숨김 + '🔁 매주 월·수 반복 · 반복 일정 관리에서 수정'", note.repeatHidden && !note.hidden && note.note === "🔁 매주 월·수 반복 · 반복 일정 관리에서 수정", JSON.stringify(note));
await shot("s3-3-edit-note.png");
await evaluate(`document.querySelector('.repeat-note__link').click()`);
await sleep(300);
const rv = await evaluate(`(() => {
  const hl = document.querySelector('.rule--highlight');
  return { open: !document.getElementById('rules-view').hidden, sheetClosed: !document.getElementById('todo-sheet').classList.contains('is-open'),
    highlighted: hl?.querySelector('.rule__text').textContent, focusInHl: !!hl && hl.contains(document.activeElement), appInert: document.getElementById('app').inert };
})()`);
check("안내를 누르면 시트 닫고 관리 화면에서 그 규칙 강조", rv.open && rv.sheetClosed && rv.highlighted === "헬스" && rv.focusInHl && rv.appInert, JSON.stringify(rv));
await shot("s3-4-rules.png");
const rulesList = await $text("#rule-list .rule__summary");
check("관리 화면 목록: 규칙 요약", JSON.stringify(rulesList) === '["🔁 매일","🔁 평일","🔁 매주 월·수"]', JSON.stringify(rulesList));

// 규칙 수정 (시트 rule-edit, 관리 화면 위에)
await evaluate(`[...document.querySelectorAll('.rule')].find(r => r.querySelector('.rule__text').textContent === '헬스').querySelector('[data-action=edit-rule]').click()`);
await sleep(300);
const ruleSheet = await evaluate(`({
  title: document.getElementById('sheet-title').textContent,
  types: [...document.querySelectorAll('#repeat-types .chip')].filter(c => !c.hidden).map(c => c.textContent),
  checked: document.querySelector('#repeat-types input:checked').value,
  days: [...document.querySelectorAll('#repeat-days input:checked')].map(c => c.value),
  rulesInert: document.getElementById('rules-view').inert,
})`);
check("규칙 수정 시트: '안 함' 없음, 기존 값, 관리 화면은 뒤에서 막힘", ruleSheet.title === "반복 일정 수정" && JSON.stringify(ruleSheet.types) === '["매일","평일","매주"]' && ruleSheet.checked === "weekly" && JSON.stringify(ruleSheet.days) === '["1","3"]' && ruleSheet.rulesInert, JSON.stringify(ruleSheet));
await evaluate(`(() => { const i = document.getElementById('todo-text'); i.value = '헬스 1시간'; i.dispatchEvent(new Event('input')); document.querySelector('#repeat-days input[value="5"]').click(); document.getElementById('sheet-save').click(); })()`);
await sleep(300);
const afterRuleEdit = await evaluate(`({
  rulesOpen: !document.getElementById('rules-view').hidden, rulesInert: document.getElementById('rules-view').inert, appInert: document.getElementById('app').inert,
  summary: [...document.querySelectorAll('.rule')].find(r => r.querySelector('.rule__text').textContent === '헬스 1시간')?.querySelector('.rule__summary').textContent,
  todayTodo: [...document.querySelectorAll('#active-list .todo__text')].map(e => e.textContent).includes('헬스'),
})`);
check("규칙 수정 저장: 관리 화면 그대로, 요약 바뀜, 오늘 이미 생긴 할 일은 그대로", afterRuleEdit.rulesOpen && !afterRuleEdit.rulesInert && afterRuleEdit.appInert && afterRuleEdit.summary === "🔁 매주 월·수·금" && afterRuleEdit.todayTodo, JSON.stringify(afterRuleEdit));

// 일시정지
await evaluate(`[...document.querySelectorAll('.rule')].find(r => r.querySelector('.rule__text').textContent === '영단어 30개').querySelector('[data-action=pause-rule]').click()`);
await sleep(200);
const paused = await evaluate(`(() => { const r = [...document.querySelectorAll('.rule')].find(r => r.querySelector('.rule__text').textContent === '영단어 30개'); return { tag: r.querySelector('.tag--paused')?.textContent, button: r.querySelector('[data-action=pause-rule]').textContent, focus: r.querySelector('[data-action=pause-rule]') === document.activeElement }; })()`);
check("일시정지: 표시 바뀜, 버튼에 포커스 유지", paused.tag === "일시정지됨" && paused.button === "다시 시작" && paused.focus, JSON.stringify(paused));

// 삭제
const dlgBefore = dialogs.length;
await evaluate(`[...document.querySelectorAll('.rule')].find(r => r.querySelector('.rule__text').textContent === '출근 체크').querySelector('[data-action=delete-rule]').click()`);
await sleep(200);
check("규칙 삭제 (확인 창), 이미 생긴 할 일은 남음", dialogs.length === dlgBefore + 1 && (await $text("#rule-list .rule__text")).length === 2 && (await $text("#active-list .todo__text")).includes("출근 체크"), dialogs.at(-1));

// + 새 반복 일정
await evaluate(`document.getElementById('rules-add').click()`);
await sleep(200);
const newRule = await evaluate(`({ title: document.getElementById('sheet-title').textContent, types: [...document.querySelectorAll('#repeat-types .chip')].filter(c => !c.hidden).map(c => c.textContent), checked: document.querySelector('#repeat-types input:checked').value, deleteHidden: document.getElementById('sheet-delete').hidden })`);
check("+ 새 반복 일정: '안 함' 없음, 기본 매일", newRule.title === "새 반복 일정" && newRule.types.length === 3 && newRule.checked === "daily" && newRule.deleteHidden, JSON.stringify(newRule));
await evaluate(`(() => { const i = document.getElementById('todo-text'); i.value = '물 마시기'; i.dispatchEvent(new Event('input')); document.querySelector('#sheet-categories input[value=personal]').click(); document.getElementById('sheet-save').click(); })()`);
await sleep(300);
check("새 반복 일정 저장 → 목록에 추가 + 오늘 할 일 생성", (await $text("#rule-list .rule__text")).includes("물 마시기") && (await $text("#active-list .todo__text")).includes("물 마시기"));

// Esc: 시트 → 관리 화면 순서로 하나씩
await evaluate(`document.getElementById('rules-add').click()`);
await sleep(200);
await esc();
await sleep(100);
const esc1 = await evaluate(`({ sheet: document.getElementById('todo-sheet').classList.contains('is-open'), rules: !document.getElementById('rules-view').hidden })`);
await esc();
await sleep(100);
const esc2 = await evaluate(`({ rules: !document.getElementById('rules-view').hidden, focusMenu: document.activeElement === document.getElementById('rules-button'), appInert: document.getElementById('app').inert, locked: document.body.className })`);
check("Esc는 맨 위 화면만 닫음 (시트 → 관리 화면), 닫으면 ☰로 포커스", !esc1.sheet && esc1.rules && !esc2.rules && esc2.focusMenu && !esc2.appInert && esc2.locked === "", JSON.stringify([esc1, esc2]));

// 삭제된 규칙의 할 일
await clickItem("출근 체크", "edit");
await sleep(200);
check("규칙이 삭제된 반복 할 일: '🔁 삭제된 반복 일정에서 생긴 할 일'", (await evaluate(`document.getElementById('repeat-note').textContent`)) === "🔁 삭제된 반복 일정에서 생긴 할 일");
await esc();

// 일시정지 규칙은 다음 날 안 생김, 다시 시작하면 생성
await openDay("2026-11-17");
const tue = await $text("#active-list .todo__text");
check("화: 일시정지한 매일 규칙은 안 생김, 삭제한 평일 규칙도 안 생김", !tue.includes("영단어 30개") && !tue.includes("출근 체크") && tue.includes("물 마시기"), JSON.stringify(tue));
await evaluate(`document.getElementById('rules-button').click()`);
await evaluate(`[...document.querySelectorAll('.rule')].find(r => r.querySelector('.rule__text').textContent === '영단어 30개').querySelector('[data-action=pause-rule]').click()`);
await sleep(200);
check("다시 시작하면 오늘 몫이 바로 생김", (await $text("#active-list .todo__text")).includes("영단어 30개"));
await evaluate(`document.getElementById('rules-close').click()`);

// 잘못된 ?today는 무시
const problemsBefore = problems.length;
await go(`${BASE}?today=2026-02-30`);
check("잘못된 ?today는 무시하고 실제 날짜", !(await evaluate(`document.getElementById('today-date').textContent`)).includes("테스트"));
problems.splice(problemsBefore); // 의도된 경고

// 레이아웃
await openDay(MON);
for (const width of [375, 360]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(200);
  const main = await evaluate(`(() => {
    const vis = (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    const small = (sel) => [...document.querySelectorAll(sel)].filter(vis).map(e => e.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length;
    const names = (sel) => [...document.querySelectorAll(sel)].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(e => e.className + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) + ' ' + e.textContent.trim().slice(0,10));
    const r = { scroll: document.documentElement.scrollWidth, small: small('.todo__check, .todo__body, .fab, .btn, .filter, .icon-btn, .prev-section__summary'), mainNames: names('.todo__check, .todo__body, .fab, .btn, .filter, .icon-btn, .prev-section__summary') };
    document.getElementById('add-button').click();
    document.querySelector('#repeat-types input[value=weekly]').click();
    r.sheetSmall = small('.chip, #sheet-save');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.getElementById('rules-button').click();
    r.rulesSmall = small('#rules-view .btn, #rules-view .icon-btn, .rule__body');
    r.rulesScroll = document.getElementById('rules-view').scrollWidth; r.rulesNames = names('#rules-view .btn, #rules-view .icon-btn, .rule__body');
    document.getElementById('rules-close').click();
    return r;
  })()`);
  check(`${width}px: 가로 스크롤 없음, 본 화면·시트(요일 7개)·관리 화면 모두 44px 이상`, main.scroll <= width && main.rulesScroll <= width && main.small + main.sheetSmall + main.rulesSmall === 0, JSON.stringify(main));
}
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await evaluate(`(() => { document.getElementById('add-button').click(); document.querySelector('#repeat-types input[value=weekly]').click(); })()`);
await sleep(400);
await shot("s3-5-sheet-weekly.png");
await esc();
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

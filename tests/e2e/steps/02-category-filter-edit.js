// 2단계 확인: 카테고리·필터·진행률·수정 시트 (PRD F2, F5, F6)
// ※ 단독으로 실행하는 파일이 아니에요. tests/e2e/run.mjs가 harness.js(+ audit.js) 뒤에 이어 붙여서 실행해요.
//   그래서 send·evaluate·go·reload·shot·check·sleep·problems·dialogs·BASE·OUT 같은 이름을 그냥 써요.
// ===================== 2단계 확인 =====================
const $text = (sel) => evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.textContent.trim())`);
const addTodo = (text, category) => evaluate(`(() => {
  document.getElementById('add-button').click();
  const i = document.getElementById('todo-text');
  i.value = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input'));
  ${category ? `document.querySelector('#sheet-categories input[value=${category}]').click();` : ""}
  document.getElementById('sheet-save').click();
})()`);
const progressText = () => evaluate(`document.getElementById('progress-text').textContent`);
const stats = () => evaluate(`[...document.querySelectorAll('#category-stats .stat')].map(s => s.dataset.category + ' ' + s.querySelector('.stat__value').textContent).join(', ')`);
const clickFilter = (id) => evaluate(`document.querySelector('#filters [data-filter=${id}]').click()`);
const editItem = (text) => evaluate(`[...document.querySelectorAll('.todo')].find(li => li.querySelector('.todo__text').textContent === ${JSON.stringify(text)}).querySelector('[data-action=edit]').click()`);

await go(BASE);
await evaluate("localStorage.clear()");
await reload();
check("0개일 때 안내와 0%", (await progressText()) === "할 일을 추가해 보세요 · 0%" &&
  (await evaluate(`document.getElementById('progress-bar').getAttribute('aria-valuenow')`)) === "0", await progressText());

// 추가 시트의 카테고리
const sheetInfo = await evaluate(`(() => {
  document.getElementById('add-button').click();
  const r = {
    chips: [...document.querySelectorAll('#sheet-categories .chip')].map(c => c.textContent),
    checked: document.querySelector('#sheet-categories input:checked')?.value,
    title: document.getElementById('sheet-title').textContent,
    deleteHidden: document.getElementById('sheet-delete').hidden,
    bgInert: document.getElementById('app').inert,
    locked: document.body.classList.contains('is-sheet-open'),
  };
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  r.bgInertAfter = document.getElementById('app').inert;
  return r;
})()`);
check("추가 시트: 카테고리 3개, 기본값 업무, 삭제 버튼 숨김", JSON.stringify(sheetInfo.chips) === '["업무","개인","공부"]' && sheetInfo.checked === "work" && sheetInfo.deleteHidden && sheetInfo.title === "할 일 추가", JSON.stringify(sheetInfo));
check("시트가 열린 동안 뒤 화면 막힘·스크롤 잠금", sheetInfo.bgInert && sheetInfo.locked && !sheetInfo.bgInertAfter);

await addTodo("보고서", "work");
await addTodo("운동", "personal");
await addTodo("영단어 30개", "study");
const defaultCat = await evaluate(`(() => { document.getElementById('add-button').click(); const v = document.querySelector('#sheet-categories input:checked')?.value; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return v; })()`);
check("카테고리 기본값은 마지막으로 고른 값", defaultCat === "study", defaultCat);
await addTodo("논문 읽기"); // 기본값(공부)으로 저장
await sleep(300);
check("배지에 카테고리 글자", JSON.stringify(await $text("#active-list .badge")) === '["공부","공부","개인","업무"]', (await $text("#active-list .badge")).join(","));
check("진행률 0 / 4, 카테고리별 0/1·0/1·0/2", (await progressText()) === "0 / 4 완료 · 0%" && (await stats()) === "work 0/1, personal 0/1, study 0/2", (await progressText()) + " | " + (await stats()));

await evaluate(`document.querySelector('#active-list .todo__check').click()`); // 논문 읽기 완료
await sleep(400);
const bar = await evaluate(`({ now: document.getElementById('progress-bar').getAttribute('aria-valuenow'), width: document.getElementById('progress-fill').style.width })`);
check("체크하면 진행률이 바로 바뀜 (1 / 4 · 25%)", (await progressText()) === "1 / 4 완료 · 25%" && bar.now === "25" && bar.width === "25%" && (await stats()) === "work 0/1, personal 0/1, study 1/2", (await progressText()) + " " + JSON.stringify(bar));
await shot("s2-1-list.png");

// 필터
await clickFilter("study");
await sleep(200);
const studyView = { active: await $text("#active-list .todo__text"), done: await $text("#done-list .todo__text") };
check("공부 필터: 공부만 보임 (미완료·완료 모두)", JSON.stringify(studyView) === '{"active":["영단어 30개"],"done":["논문 읽기"]}', JSON.stringify(studyView));
check("필터를 바꿔도 진행률은 오늘 전체 기준", (await progressText()) === "1 / 4 완료 · 25%");
await reload();
const afterReload = { pressed: await evaluate(`document.querySelector('#filters [aria-pressed=true]').dataset.filter`), active: await $text("#active-list .todo__text") };
check("새로고침 후 필터 유지", afterReload.pressed === "study" && afterReload.active.length === 1, JSON.stringify(afterReload));
await shot("s2-2-filter.png");
await clickFilter("all");
await sleep(200);

// 수정 시트
await editItem("보고서");
await sleep(400);
const editInfo = await evaluate(`({
  title: document.getElementById('sheet-title').textContent,
  value: document.getElementById('todo-text').value,
  checked: document.querySelector('#sheet-categories input:checked')?.value,
  deleteVisible: !document.getElementById('sheet-delete').hidden,
  focused: document.activeElement === document.getElementById('todo-text'),
})`);
check("내용을 탭하면 수정 시트 (기존 내용·카테고리, 삭제 버튼, 입력창 포커스)", editInfo.title === "할 일 수정" && editInfo.value === "보고서" && editInfo.checked === "work" && editInfo.deleteVisible && editInfo.focused, JSON.stringify(editInfo));
await evaluate(`(() => { const i = document.getElementById('todo-text'); i.value = '보고서 마무리'; i.dispatchEvent(new Event('input')); document.querySelector('#sheet-categories input[value=personal]').click(); })()`);
await shot("s2-3-edit.png");
await evaluate(`document.getElementById('sheet-save').click()`);
await sleep(300);
const edited = await evaluate(`(() => {
  const li = [...document.querySelectorAll('.todo')].find(li => li.querySelector('.todo__text').textContent === '보고서 마무리');
  return { found: !!li, badge: li?.querySelector('.badge').textContent, focusOnIt: !!li && li.contains(document.activeElement),
    sheetOpen: document.getElementById('todo-sheet').classList.contains('is-open') };
})()`);
check("수정 저장: 내용·카테고리 바뀜, 시트 닫힘, 그 항목으로 포커스 복귀", edited.found && edited.badge === "개인" && !edited.sheetOpen && edited.focusOnIt, JSON.stringify(edited));
check("수정 후 카테고리별 진행률 반영", (await stats()) === "work 0/0, personal 0/2, study 1/2", await stats());
const lastCatAfterEdit = await evaluate(`JSON.parse(localStorage.getItem('task-manager')).settings.lastCategory`);
check("수정에서 고른 카테고리는 추가 기본값을 바꾸지 않음", lastCatAfterEdit === "study", lastCatAfterEdit);

await editItem("운동");
await evaluate(`(() => { const i = document.getElementById('todo-text'); i.value = '바뀌면 안 됨'; i.dispatchEvent(new Event('input')); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); })()`);
await sleep(300);
check("수정 중 Esc → 바뀌지 않음", (await $text(".todo__text")).includes("운동") && !(await $text(".todo__text")).includes("바뀌면 안 됨"));

await editItem("운동");
await evaluate(`(() => { const i = document.getElementById('todo-text'); i.value = '   '; i.dispatchEvent(new Event('input')); })()`);
check("수정에서도 공백만 있으면 저장 비활성화", await evaluate(`document.getElementById('sheet-save').disabled`));
const dialogsBefore = dialogs.length;
await evaluate(`document.getElementById('sheet-delete').click()`);
await sleep(300);
check("수정 시트의 삭제 → 확인 창 → 삭제, 포커스는 + 버튼", dialogs.length === dialogsBefore + 1 && !(await $text(".todo__text")).includes("운동") &&
  (await evaluate(`document.activeElement === document.getElementById('add-button')`)), dialogs.at(-1));
check("1단계 임시 삭제 버튼은 없어짐", (await evaluate(`document.querySelectorAll('.todo__delete').length`)) === 0);

// 필터 때문에 빈 목록
await clickFilter("work");
await sleep(200);
const workEmpty = await evaluate(`({ hidden: document.getElementById('empty-message').hidden, text: document.getElementById('empty-message').textContent })`);
check("필터 결과가 비면 안내", !workEmpty.hidden && workEmpty.text === "업무 할 일이 없어요", JSON.stringify(workEmpty));
await clickFilter("all");

// 모두 완료 → 축하 문구
await evaluate(`(() => { let b; while ((b = document.querySelector('#active-list .todo__check'))) b.click(); })()`);
await sleep(500);
const done = await evaluate(`({ banner: !document.getElementById('celebration').hidden, pop: document.getElementById('celebration').classList.contains('banner--pop'), text: document.getElementById('progress-text').textContent })`);
check("모두 완료하면 100%와 축하 문구", done.banner && done.pop && done.text === "3 / 3 완료 · 100%", JSON.stringify(done));
await shot("s2-4-complete.png");
await evaluate(`document.querySelector('#done-list .todo__check').click()`);
await sleep(200);
check("하나를 취소하면 축하 문구 사라짐", await evaluate(`document.getElementById('celebration').hidden`));

// 레이아웃: 375px, 360px
for (const width of [375, 360]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(200);
  const layout = await evaluate(`(() => {
    const visible = (el) => el.offsetParent !== null;
    const small = [...document.querySelectorAll('.todo__check, .todo__body, .fab, .btn, .filter')]
      .filter(visible).map(el => el.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length;
    const tops = new Set([...document.querySelectorAll('.filter')].map(b => Math.round(b.getBoundingClientRect().top)));
    return { scrollWidth: document.documentElement.scrollWidth, small, filterRows: tops.size };
  })()`);
  check(`${width}px: 가로 스크롤 없음, 44px 이상, 필터 한 줄`, layout.scrollWidth <= width && layout.small === 0 && layout.filterRows === 1, JSON.stringify(layout));
}
const chipSizes = await evaluate(`(() => { document.getElementById('add-button').click(); const r = [...document.querySelectorAll('.chip, #sheet-save')].filter(e => e.offsetParent !== null).map(e => e.getBoundingClientRect()).filter(r => r.height < 44).length; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return r; })()`);
check("시트의 카테고리 칩·버튼 44px 이상", chipSizes === 0);
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });

// 저장 형식: 1단계 데이터와 호환 (version 1 그대로)
const saved = await evaluate(`JSON.parse(localStorage.getItem('task-manager'))`);
check("저장 형식 version 1 유지, settings.filter·lastCategory 저장", saved.version === 1 && saved.settings.filter === "all" && saved.settings.lastCategory === "study");
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

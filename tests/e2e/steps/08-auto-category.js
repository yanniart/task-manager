// v0.8 확인: 키워드 기반 카테고리 자동 분류 (PRD F18)
// ※ 단독으로 실행하는 파일이 아니에요. tests/e2e/run.mjs가 harness.js(+ audit.js) 뒤에 이어 붙여서 실행해요.
//   그래서 send·evaluate·go·reload·shot·check·sleep·problems·dialogs·BASE·OUT 같은 이름을 그냥 써요.
// ===================== 키워드 자동 분류 (F18) =====================
const DAY = "2026-11-16";
async function seed(data = {}, settings = {}) {
  await go(BASE + "?today=" + DAY);
  await evaluate(`localStorage.clear(); localStorage.setItem('task-manager', JSON.stringify(${JSON.stringify({ version: 1, todos: [], rules: [], trash: [], ...data,
    settings: { filter: "all", lastCategory: "study", lastOpenedDate: DAY, sort: "manual", ...settings } })}))`);
  await reload();
}
const saved = () => evaluate(`JSON.parse(localStorage.getItem('task-manager'))`);
const typeText = (value) => evaluate(`(() => { const i = document.getElementById('todo-text'); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const sheet = () => evaluate(`({ cat: document.querySelector('#sheet-categories input:checked')?.value, hint: document.getElementById('auto-category-hint').hidden ? null : document.getElementById('auto-category-hint').textContent })`);
const openAdd = () => evaluate(`document.getElementById('add-button').click()`);
const esc = () => evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

await seed();
await openAdd();
check("열 때는 마지막으로 고른 카테고리(공부), 안내 없음", JSON.stringify(await sheet()) === '{"cat":"study","hint":null}', JSON.stringify(await sheet()));
await typeText("팀 회의 준비");
const before = await sheet();
await sleep(220);
const afterAuto = await sheet();
check("입력이 멈추면 키워드로 업무 선택 + 안내 (조사도 자연스럽게)", before.cat === "study" && afterAuto.cat === "work" &&
  afterAuto.hint === "'회의' 키워드로 업무를 골랐어요. 바꾸려면 칩을 누르세요.", JSON.stringify({ before, afterAuto }));
await shot("s10-auto.png");
await typeText("엄마 생일 선물"); await sleep(220);
check("내용을 바꾸면 다시 분류 (생일 → 개인, '개인을')", JSON.stringify(await sheet()) === `{"cat":"personal","hint":"'생일' 키워드로 개인을 골랐어요. 바꾸려면 칩을 누르세요."}`, JSON.stringify(await sheet()));
await typeText("물 마시기"); await sleep(220);
check("키워드가 없어지면 열 때의 카테고리로 돌아가고 안내 사라짐", JSON.stringify(await sheet()) === '{"cat":"study","hint":null}', JSON.stringify(await sheet()));
// 기다리지 않고 바로 저장해도 자동 분류가 적용됨
await typeText("주간 보고서 쓰기");
await evaluate(`document.getElementById('sheet-save').click()`);
await sleep(100);
const s1 = await saved();
check("입력하자마자 저장해도 자동 분류 적용 (업무), 다음 기본값은 그대로(공부)", s1.todos[0].category === "work" && s1.settings.lastCategory === "study", JSON.stringify({ cat: s1.todos[0].category, last: s1.settings.lastCategory }));

// 직접 고르면 우선
await openAdd();
await evaluate(`document.querySelector('#sheet-categories input[value=personal]').click()`);
await typeText("회의 자료"); await sleep(220);
check("칩을 먼저 직접 고르면 키워드가 있어도 안 바꿈", JSON.stringify(await sheet()) === '{"cat":"personal","hint":null}', JSON.stringify(await sheet()));
await esc();
await openAdd();
await typeText("회의 자료"); await sleep(220);
await evaluate(`document.querySelector('#sheet-categories input[value=study]').click()`);
const touched = await sheet();
await typeText("회의 자료 영어"); await sleep(220);
check("자동으로 고른 뒤 칩을 누르면 그게 우선, 안내 사라지고 이후 입력에도 안 바뀜", touched.cat === "study" && touched.hint === null && (await sheet()).cat === "study", JSON.stringify([touched, await sheet()]));
await evaluate(`document.getElementById('sheet-save').click()`);
await sleep(100);
check("직접 고른 카테고리로 저장하면 다음 기본값이 됨", (await saved()).settings.lastCategory === "study");

// 수정 시트는 자동으로 안 바꿈
await evaluate(`document.querySelector('#active-list .todo [data-action=edit]').click()`);
const editBefore = await sheet();
await typeText("운동 가기"); await sleep(220);
check("수정할 때는 자동 분류 안 함 (이미 있는 할 일을 함부로 바꾸지 않게)", (await sheet()).cat === editBefore.cat && (await sheet()).hint === null, JSON.stringify([editBefore, await sheet()]));
await esc();

// 반복 일정 추가에서도
await evaluate(`document.getElementById('rules-button').click()`);
await evaluate(`document.getElementById('rules-add').click()`);
await typeText("영단어 복습"); await sleep(220);
check("새 반복 일정에서도 자동 분류 (공부)", (await sheet()).cat === "study" && (await sheet()).hint?.startsWith("'영단어' 키워드로 공부를"), JSON.stringify(await sheet()));
await esc(); await evaluate(`document.getElementById('rules-close').click()`);

// 더보기: 켜기·끄기, 키워드 고치기, 겹침 안내, 되돌리기
await evaluate(`document.getElementById('more-button').click()`);
const more0 = await evaluate(`({ on: document.getElementById('auto-enabled').checked, work: document.getElementById('keywords-work').value, reset: !document.getElementById('keywords-reset').hidden, first: document.querySelector('#more-view .more-section h3').textContent })`);
check("더보기 맨 위 '자동 분류': 켜짐, 기본 키워드 표시, 되돌리기 버튼은 숨김", more0.on && more0.work.startsWith("회의, 미팅, 보고서") && !more0.reset && more0.first === "자동 분류", JSON.stringify(more0));
await shot("s10-more.png");
await evaluate(`(() => { const i = document.getElementById('keywords-work'); i.focus(); i.value = ' 스크럼 ,회의,, 회의 , 영어 '; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
const more1 = await evaluate(`({ work: document.getElementById('keywords-work').value, conflict: document.getElementById('keyword-conflicts').hidden ? null : document.getElementById('keyword-conflicts').textContent, reset: !document.getElementById('keywords-reset').hidden })`);
const s2 = await saved();
check("업무 키워드 고치기: 정리해서 저장(공백·빈 것·중복), 다른 카테고리는 기본값 그대로", more1.work === "스크럼, 회의, 영어" &&
  JSON.stringify(s2.settings.autoCategory.keywords.work) === '["스크럼","회의","영어"]' && s2.settings.autoCategory.keywords.personal.includes("운동") && more1.reset, JSON.stringify({ more1, kw: s2.settings.autoCategory.keywords.work }));
check("여러 카테고리에 같은 키워드 → 어느 쪽이 우선인지 안내", more1.conflict === "'영어'는 업무·공부에 모두 있어요. 업무가 우선이에요.", more1.conflict);
await evaluate(`document.getElementById('more-close').click()`);
await openAdd();
await typeText("데일리 스크럼"); await sleep(220);
check("고친 키워드가 바로 쓰임 (스크럼 → 업무)", (await sheet()).cat === "work");
await typeText("영어 공부"); await sleep(220);
check("'영어 공부': 같은 두 글자면 앞에 나온 '영어'(업무로 고친 키워드)가 우선", (await sheet()).cat === "work", JSON.stringify(await sheet()));
await esc();
await evaluate(`document.getElementById('more-button').click()`);
await evaluate(`document.getElementById('auto-enabled').click()`);
const off = await evaluate(`({ on: document.getElementById('auto-enabled').checked, fieldsDisabled: document.getElementById('keyword-fields').disabled })`);
await evaluate(`document.getElementById('more-close').click()`);
await reload();
await openAdd();
await typeText("회의"); await sleep(220);
check("끄면 자동 분류 안 함, 새로고침해도 꺼진 채, 키워드 칸은 비활성", !off.on && off.fieldsDisabled && (await saved()).settings.autoCategory.enabled === false && JSON.stringify(await sheet()) === '{"cat":"study","hint":null}', JSON.stringify({ off, sheet: await sheet() }));
await esc();
await evaluate(`document.getElementById('more-button').click()`);
await evaluate(`document.getElementById('auto-enabled').click()`);
await evaluate(`document.getElementById('keywords-reset').click()`);
await sleep(80);
const reset = await evaluate(`({ work: document.getElementById('keywords-work').value, conflict: document.getElementById('keyword-conflicts').hidden, reset: document.getElementById('keywords-reset').hidden })`);
check("기본 키워드로 되돌리기 (확인 창) → 저장값 null, 겹침 안내·되돌리기 버튼 사라짐", reset.work.startsWith("회의, 미팅") && reset.conflict && reset.reset &&
  (await saved()).settings.autoCategory.keywords === null && dialogs.at(-1).startsWith("자동 분류 키워드를 기본값으로 되돌릴까요?"), JSON.stringify(reset));
await evaluate(`document.getElementById('more-close').click()`);

// 예전 데이터(autoCategory 없음) → 켜짐 + 기본 키워드
await seed({}, {});
await evaluate(`(() => { const s = JSON.parse(localStorage.getItem('task-manager')); delete s.settings.autoCategory; localStorage.setItem('task-manager', JSON.stringify(s)); })()`);
await reload();
await openAdd();
await typeText("운동하기"); await sleep(220);
check("autoCategory가 없는 예전 데이터도 켜짐 + 기본 키워드로 동작", (await sheet()).cat === "personal");
await esc();

// 360px 레이아웃 + 대비
await send("Emulation.setDeviceMetricsOverride", { width: 360, height: 812, deviceScaleFactor: 2, mobile: true });
await evaluate(`document.getElementById('more-button').click()`);
const lay = await evaluate(`({ scroll: document.getElementById('more-view').scrollWidth, rowH: Math.round(document.querySelector('.switch-row').getBoundingClientRect().height), inputs: [...document.querySelectorAll('#keyword-fields textarea')].every(i => i.getBoundingClientRect().height >= 44 && parseFloat(getComputedStyle(i).fontSize) >= 16) })`);
check("360px: 더보기 가로 스크롤 없음, 스위치 줄 44px 이상, 키워드 칸 44px·16px", lay.scroll <= 360 && lay.rowH >= 44 && lay.inputs, JSON.stringify(lay));
await evaluate(`document.getElementById('more-close').click()`);
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
for (const scheme of ["light", "dark"]) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  await seed({}, { autoCategory: { enabled: true, keywords: { work: ["회의", "영어"], personal: [], study: ["영어"] } } });
  const res = [];
  await openAdd(); await typeText("팀 회의"); await sleep(220);
  res.push(["시트 안내", await audit()]);
  await esc();
  await evaluate(`document.getElementById('more-button').click()`);
  res.push(["더보기 자동 분류", await audit()]);
  if (scheme === "dark") await shot("s10-more-dark.png");
  const bad = res.flatMap(([n, r]) => r.bad.map((b) => `${n} "${b.text}" ${b.ratio} < ${b.need}`));
  check(`${scheme === "dark" ? "다크" : "라이트"}: 자동 분류 화면 글자 대비`, bad.length === 0, bad.length ? bad.join("; ") : res.map(([n, r]) => `${n} 최저 ${r.min}`).join(" / "));
}
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
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

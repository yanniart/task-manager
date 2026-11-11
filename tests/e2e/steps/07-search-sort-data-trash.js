// v0.6~v0.7 확인: 검색·정렬 아이콘 메뉴·중복 경고·휴지통·내보내기/가져오기·두 탭·저장 실패 (PRD F13~F17)
// ※ 단독으로 실행하는 파일이 아니에요. tests/e2e/run.mjs가 harness.js(+ audit.js) 뒤에 이어 붙여서 실행해요.
//   그래서 send·evaluate·go·reload·shot·check·sleep·problems·dialogs·BASE·OUT 같은 이름을 그냥 써요.
// ===================== 추가 기능: 검색·정렬·내보내기/가져오기·중복 경고·휴지통·성능 =====================
import { readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
const DAY = "2026-11-16";
const T = (id, i, extra = {}) => ({ id, text: extra.text ?? id, category: "work", date: DAY, done: false, order: i, ruleId: null,
  carriedFrom: null, createdAt: new Date(Date.UTC(2026, 10, 1, 0, extra.minute ?? i)).toISOString(), completedAt: null, ...extra });
async function seed(data, settings = {}) {
  await go(BASE + "?today=" + DAY);
  await evaluate(`localStorage.clear(); localStorage.setItem('task-manager', JSON.stringify(${JSON.stringify({ version: 1, rules: [], trash: [], ...data,
    settings: { filter: "all", lastCategory: "work", lastOpenedDate: DAY, sort: "manual", ...settings } })}))`);
  await reload();
}
const texts = (sel = "#active-list") => evaluate(`[...document.querySelectorAll('${sel} .todo__text')].map(e => e.textContent)`);
const saved = () => evaluate(`JSON.parse(localStorage.getItem('task-manager'))`);
const type = (sel, value) => evaluate(`(() => { const i = document.querySelector('${sel}'); i.value = ${JSON.stringify(value)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const pressKey = (sel, key) => evaluate(`document.querySelector('${sel}').dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true }))`);
const toast = () => evaluate(`({ visible: document.getElementById('toast').classList.contains('is-visible'), text: document.getElementById('toast-message').textContent, action: document.getElementById('toast-action').hidden ? null : document.getElementById('toast-action').textContent })`);
const clickToastAction = () => evaluate(`document.getElementById('toast-action').click()`);

// ============ 1) 검색 (F13) ============
await seed({ todos: [
  T("a", 0, { text: "보고서 마무리" }), T("b", 1, { text: "메일 답장" }), T("c", 2, { text: "장보기", category: "personal" }),
  T("d", 0, { text: "보고서 초안", done: true, completedAt: "2026-11-16T01:00:00.000Z" }),
  T("p", 0, { text: "주간 보고서", date: "2026-11-15", done: true, completedAt: "2026-11-15T01:00:00.000Z" }),
] });
await evaluate(`document.getElementById('search-button').click()`);
const opened = await evaluate(`({ shown: !document.getElementById('search-bar').hidden, focus: document.activeElement.id, expanded: document.getElementById('search-button').getAttribute('aria-expanded') })`);
check("🔍 누르면 검색창이 열리고 입력창에 포커스", opened.shown && opened.focus === "search-input" && opened.expanded === "true", JSON.stringify(opened));
const progressBefore = await evaluate(`document.getElementById('progress-text').textContent`);
await type("#search-input", "보고서");
const immediate = await texts();
await sleep(220);
const after = { active: await texts(), done: await texts("#done-list"), prev: await texts("#prev-list"), info: await evaluate(`document.getElementById('search-info').textContent`),
  marks: await evaluate(`[...document.querySelectorAll('.todo__match')].map(m => m.textContent)`), prevOpen: await evaluate(`document.getElementById('prev-section').open`) };
check("입력 직후엔 그대로, 150ms 뒤 한 번 검색 (디바운스)", immediate.length === 3 && JSON.stringify(after.active) === '["보고서 마무리"]', JSON.stringify({ immediate, active: after.active }));
check("검색: 미완료·완료·이전 완료 모두에서 찾고, 개수 표시, 맞는 부분 강조, 이전 완료 구역 펼침",
  JSON.stringify(after.done) === '["보고서 초안"]' && JSON.stringify(after.prev) === '["주간 보고서"]' && after.info === "검색 결과 3개" &&
  after.marks.length === 3 && after.marks.every((m) => m === "보고서") && after.prevOpen, JSON.stringify(after));
check("검색해도 진행률은 그대로 (오늘 전체 기준)", (await evaluate(`document.getElementById('progress-text').textContent`)) === progressBefore);
await type("#search-input", "보고서".normalize("NFD"));
await pressKey("#search-input", "Enter");
check("한글 자모가 풀린(NFD) 검색어도 찾음, Enter는 기다리지 않고 바로", JSON.stringify(await texts()) === '["보고서 마무리"]');
await type("#search-input", "마무 보고");
await pressKey("#search-input", "Enter");
check("여러 낱말은 모두 들어간 것만 (순서 무관)", JSON.stringify(await texts()) === '["보고서 마무리"]' && (await evaluate(`document.getElementById('search-info').textContent`)) === "검색 결과 1개");
await type("#search-input", "없는말");
await pressKey("#search-input", "Enter");
const none = await evaluate(`({ empty: document.getElementById('empty-message').textContent, hidden: document.getElementById('empty-message').hidden, info: document.getElementById('search-info').textContent })`);
check("결과 없음 안내", !none.hidden && none.empty === '"없는말"에 맞는 할 일이 없어요' && none.info === "검색 결과가 없어요", JSON.stringify(none));
await evaluate(`document.querySelector('#filters [data-filter=personal]').click()`);
await type("#search-input", "보고서");
await pressKey("#search-input", "Enter");
check("필터와 함께: 개인 + '보고서' → 없음, 어느 필터에서인지 안내", (await evaluate(`document.getElementById('empty-message').textContent`)) === '"보고서"에 맞는 할 일이 없어요 (개인에서)');
await evaluate(`document.querySelector('#filters [data-filter=all]').click()`);
await pressKey("#search-input", "Escape");
const esc1 = { value: await evaluate(`document.getElementById('search-input').value`), open: !(await evaluate(`document.getElementById('search-bar').hidden`)), count: (await texts()).length };
await pressKey("#search-input", "Escape");
const esc2 = { open: !(await evaluate(`document.getElementById('search-bar').hidden`)), focus: await evaluate(`document.activeElement.id`), count: (await texts()).length };
check("Esc: 글자가 있으면 지우기만, 비었으면 닫기 → 전체 목록, 🔍로 포커스", esc1.value === "" && esc1.open && esc1.count === 3 && !esc2.open && esc2.focus === "search-button" && esc2.count === 3, JSON.stringify([esc1, esc2]));

// 검색 중 순서 바꾸기: 보이는 항목끼리만
await seed({ todos: [T("A", 0, { text: "보고서 1" }), T("X", 1, { text: "장보기" }), T("B", 2, { text: "보고서 2" }), T("Y", 3, { text: "운동" }), T("C", 4, { text: "보고서 3" })] });
await evaluate(`document.getElementById('search-button').click()`);
await type("#search-input", "보고서");
await pressKey("#search-input", "Enter");
await evaluate(`document.querySelector('[data-id="C"] .todo__handle').focus()`);
await pressKey('[data-id="C"] .todo__handle', "ArrowUp");
await pressKey('[data-id="C"] .todo__handle', "ArrowUp");
const searchOrder = await texts();
await pressKey("#search-input", "Escape");
await sleep(50);
check("검색 중 순서 바꾸기는 검색 결과끼리만, 나머지는 제자리", JSON.stringify(searchOrder) === '["보고서 3","보고서 1","보고서 2"]' &&
  JSON.stringify(await texts()) === '["보고서 3","장보기","보고서 1","운동","보고서 2"]', JSON.stringify({ searchOrder, all: await texts() }));

// ============ 2) 정렬 (F14) ============
await seed({ todos: [
  T("s1", 0, { text: "공부1", category: "study", minute: 30 }), T("w1", 1, { text: "업무1", minute: 10 }), T("p1", 2, { text: "개인1", category: "personal", minute: 20 }),
  T("w2", 3, { text: "업무2", minute: 5 }), T("dn", 0, { text: "끝낸일", done: true, completedAt: "2026-11-16T02:00:00.000Z" }),
] });
const savedOrderBefore = JSON.stringify((await saved()).todos.map((t) => t.id + t.order));
const sortState = () => evaluate(`({ expanded: document.getElementById('sort-button').getAttribute('aria-expanded'), menuOpen: !document.getElementById('sort-menu').hidden,
  label: document.getElementById('sort-label').hidden ? null : document.getElementById('sort-label').textContent, active: document.getElementById('sort-button').classList.contains('is-active'),
  focus: document.activeElement.dataset.sort ?? document.activeElement.id, checked: document.querySelector('#sort-menu [aria-checked=true]')?.dataset.sort,
  items: [...document.querySelectorAll('#sort-menu .sort-menu__label')].map(e => e.textContent), moreHasSort: !!document.getElementById('sort-options') })`);
// 위치: 필터 탭 바로 아래, 오른쪽 끝 (스크린샷의 빨간 상자 자리)
const pos = await evaluate(`(() => { const b = document.getElementById('sort-button').getBoundingClientRect(), f = document.getElementById('filters').getBoundingClientRect(), first = document.querySelector('#active-list .todo').getBoundingClientRect();
  return { belowFilters: b.top >= f.bottom - 1, aboveList: b.bottom <= first.top + 1, rightAligned: Math.abs(b.right - f.right) <= 8, size: [Math.round(b.width), Math.round(b.height)] }; })()`);
const s0 = await sortState();
check("정렬 아이콘: 필터 탭 아래·목록 위 오른쪽, 44px, 직접 정렬일 땐 아이콘만, 더보기에서는 빠짐",
  pos.belowFilters && pos.aboveList && pos.rightAligned && pos.size[0] >= 44 && pos.size[1] >= 44 && s0.label === null && !s0.active && !s0.moreHasSort, JSON.stringify({ pos, s0 }));
await shot("s9-sort-icon.png");
await evaluate(`document.getElementById('sort-button').click()`);
const s1 = await sortState();
check("누르면 메뉴(4가지), 지금 정렬에 체크·포커스",
  s1.menuOpen && s1.expanded === "true" && JSON.stringify(s1.items) === '["직접 정렬","생성일순","카테고리순","완료 상태순"]' && s1.checked === "manual" && s1.focus === "manual", JSON.stringify(s1));
await shot("s9-sort-menu.png");
await pressKey("#sort-menu", "ArrowDown");
check("↓로 다음 항목", (await sortState()).focus === "created");
await pressKey("#sort-menu", "Escape");
const s2 = await sortState();
check("Esc로 닫히고 아이콘으로 포커스, 정렬은 그대로", !s2.menuOpen && s2.focus === "sort-button" && s2.checked === "manual", JSON.stringify(s2));
await evaluate(`document.getElementById('sort-button').click()`);
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 60, y: 40, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 60, y: 40, button: "left", clickCount: 1 });
check("메뉴 밖(제목 자리)을 누르면 닫힘", !(await sortState()).menuOpen);
const pickSort = async (id) => { await evaluate(`document.getElementById('sort-button').click()`); await evaluate(`document.querySelector('#sort-menu [data-sort=${id}]').click()`); await sleep(80); };
await pickSort("created");
const created = { order: await texts(), handles: await evaluate(`document.querySelectorAll('#active-list .todo__handle').length`), st: await sortState(), aria: await evaluate(`document.getElementById('sort-button').getAttribute('aria-label')`) };
check("생성일순: 먼저 만든 것부터, 손잡이 숨김, 아이콘 파랑 + '생성일순', 메뉴 닫히고 아이콘으로 포커스",
  JSON.stringify(created.order) === '["업무2","업무1","개인1","공부1"]' && created.handles === 0 && created.st.label === "생성일순" && created.st.active && !created.st.menuOpen &&
  created.st.focus === "sort-button" && created.aria === "정렬: 생성일순. 이 정렬에서는 순서를 옮길 수 없어요", JSON.stringify(created));
await shot("s9-sort-created.png");
await reload();
check("정렬은 새로고침 후에도 유지", JSON.stringify(await texts()) === '["업무2","업무1","개인1","공부1"]' && (await sortState()).label === "생성일순");
await pickSort("category");
check("카테고리순: 업무 → 개인 → 공부, 같은 카테고리는 직접 정렬 순서", JSON.stringify(await texts()) === '["업무1","업무2","개인1","공부1"]', JSON.stringify(await texts()));
await pickSort("status");
const status = { order: await texts(), doneHidden: await evaluate(`document.getElementById('done-section').hidden`), lastDone: await evaluate(`document.querySelector('#active-list .todo:last-child').classList.contains('todo--done')`) };
check("완료 상태순: 한 목록으로 합쳐 미완료 먼저, 완료 구역 숨김", JSON.stringify(status.order) === '["공부1","업무1","개인1","업무2","끝낸일"]' && status.doneHidden && status.lastDone, JSON.stringify(status));
await evaluate(`document.querySelector('#active-list .todo:last-child .todo__check').click()`); // 합친 목록에서도 체크 취소 동작
check("합친 목록에서도 체크·취소 동작", (await evaluate(`document.querySelectorAll('#active-list .todo--done').length`)) === 0);
await evaluate(`document.querySelector('[data-id="dn"] .todo__check').click()`);
await pickSort("manual");
check("메뉴에서 '직접 정렬' → 원래 드래그 순서 그대로, 손잡이 다시, 아이콘만", JSON.stringify(await texts()) === '["공부1","업무1","개인1","업무2"]' &&
  (await evaluate(`document.querySelectorAll('#active-list .todo__handle').length`)) === 4 && (await sortState()).label === null &&
  JSON.stringify((await saved()).todos.filter(t => !t.done).map((t) => t.id + t.order)) === JSON.stringify(JSON.parse(savedOrderBefore).filter((x) => x !== "dn0")),
  JSON.stringify(await texts()));
await evaluate(`document.getElementById('more-button').click()`);
const moreInfo = await evaluate(`({ open: !document.getElementById('more-view').hidden, appInert: document.getElementById('app').inert, sections: [...document.querySelectorAll('#more-view .more-section h3')].map(h => h.textContent.replace(/\\s*\\(.*$/, '')) })`);
check("⋯ 더보기: 자동 분류·데이터·휴지통 (정렬 없음), 뒤 화면 막힘", moreInfo.open && moreInfo.appInert && JSON.stringify(moreInfo.sections) === '["자동 분류","데이터","휴지통"]', JSON.stringify(moreInfo));
await shot("s8-more.png");
await evaluate(`document.getElementById('more-close').click()`);

// ============ 3) 중복 경고 (F16) ============
await seed({ todos: [T("a", 0, { text: "장보기" }), T("b", 1, { text: "운동", done: true, completedAt: "2026-11-16T01:00:00.000Z" })],
  rules: [{ id: "R1", text: "영단어 30개", category: "study", repeat: { type: "daily", days: [] }, paused: false, createdAt: "", lastGeneratedDate: DAY }] });
const dup = () => evaluate(`({ hidden: document.getElementById('dup-warning').hidden, text: document.getElementById('dup-warning').textContent, save: !document.getElementById('sheet-save').disabled })`);
await evaluate(`document.getElementById('add-button').click()`);
await type("#todo-text", "  장보기 ");
const dupImmediate = await dup();
await sleep(220);
const dup1 = await dup();
check("오늘 미완료와 같은 내용 → 입력이 멈추면 경고, 저장은 막지 않음", dupImmediate.hidden && !dup1.hidden && dup1.text === "오늘 목록에 같은 할 일이 이미 있어요. 그래도 저장할 수 있어요." && dup1.save, JSON.stringify([dupImmediate, dup1]));
await shot("s8-dup.png");
await type("#todo-text", "장보기 2"); await sleep(220);
check("내용이 다르면 경고 사라짐", (await dup()).hidden);
await type("#todo-text", "운동"); await sleep(220);
check("완료한 것과 같은 내용은 경고 안 함 (다시 하는 일일 수 있어서)", (await dup()).hidden);
await type("#todo-text", "장보기".normalize("NFD")); await sleep(220);
check("자모가 풀린(NFD) 입력도 같은 것으로 봄", !(await dup()).hidden);
await type("#todo-text", "영단어  30개"); await evaluate(`document.querySelector('#repeat-types input[value=daily]').click()`); await sleep(50);
check("반복을 고르면 같은 이름의 반복 일정과 비교", (await dup()).text === "같은 이름의 반복 일정이 이미 있어요. 그래도 저장할 수 있어요.");
await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
await evaluate(`document.querySelector('[data-id="a"] [data-action=edit]').click()`);
await sleep(50);
check("수정할 때 자기 자신은 중복으로 안 봄", (await dup()).hidden);
await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

// ============ 4) 삭제 복구 (F17) ============
await seed({ todos: [T("a", 0, { text: "첫째" }), T("b", 1, { text: "둘째" }), T("c", 2, { text: "셋째" }),
  T("d1", 0, { text: "완료1", done: true, completedAt: "2026-11-16T01:00:00.000Z" }), T("d2", 0, { text: "완료2", done: true, completedAt: "2026-11-16T02:00:00.000Z" })],
  rules: [{ id: "R1", text: "물 마시기", category: "personal", repeat: { type: "daily", days: [] }, paused: false, createdAt: "", lastGeneratedDate: DAY }] });
await evaluate(`document.querySelector('[data-id="b"] [data-action=edit]').click()`);
await evaluate(`document.getElementById('sheet-delete').click()`);
await sleep(80);
const t1 = await toast();
check("삭제하면 알림 + 되돌리기", t1.visible && t1.text === '"둘째"을(를) 지웠어요' && t1.action === "되돌리기" && JSON.stringify(await texts()) === '["첫째","셋째"]', JSON.stringify({ t1, list: await texts() }));
await shot("s8-toast.png");
await clickToastAction(); await sleep(80);
check("되돌리기 → 원래 자리로 (가운데)", JSON.stringify(await texts()) === '["첫째","둘째","셋째"]' && (await saved()).trash.length === 0, JSON.stringify(await texts()));
await evaluate(`document.getElementById('clear-completed').click()`); await sleep(80);
const t2 = await toast();
check("완료한 항목 모두 지우기 → 한 묶음 알림", t2.text === "완료한 항목 2개를 지웠어요" && (await texts("#done-list")).length === 0, JSON.stringify(t2));
await clickToastAction(); await sleep(80);
check("한 번에 되돌리기 → 완료 2개 모두", (await texts("#done-list")).length === 2);
// 휴지통 화면에서 복구
await evaluate(`document.querySelector('[data-id="c"] [data-action=edit]').click()`);
await evaluate(`document.getElementById('sheet-delete').click()`);
await evaluate(`document.getElementById('rules-button').click()`);
await evaluate(`document.querySelector('#rule-list [data-action=delete-rule]').click()`);
await evaluate(`document.getElementById('rules-close').click()`);
await evaluate(`document.getElementById('more-button').click()`);
const trash = await evaluate(`({ count: document.getElementById('trash-count').textContent, items: [...document.querySelectorAll('#trash-list .rule__text')].map(e => e.textContent), kinds: [...document.querySelectorAll('#trash-list .tag')].map(e => e.textContent) })`);
check("휴지통: 지운 할 일·반복 일정 목록 (최근 것 먼저, 종류 표시)", trash.count === "2" && JSON.stringify(trash.items) === '["물 마시기","셋째"]' && JSON.stringify(trash.kinds) === '["반복 일정","할 일"]', JSON.stringify(trash));
await evaluate(`document.querySelector('#trash-list button[data-entry-id]').click()`); await sleep(80);
// 이 규칙은 오늘 몫을 이미 만들었던 것(lastGeneratedDate=오늘)이라, 되살려도 오늘 할 일을 또 만들면 안 돼요.
check("휴지통에서 반복 일정 복구 → 규칙 목록에 다시, 오늘 몫을 또 만들지 않음", (await saved()).rules.length === 1 && (await saved()).todos.filter((t) => t.ruleId === "R1").length === 0);
await evaluate(`document.getElementById('trash-empty-button').click()`); await sleep(80);
check("휴지통 비우기 (확인 창)", (await evaluate(`document.getElementById('trash-count').textContent`)) === "0" && (await saved()).trash.length === 0 && dialogs.at(-1).startsWith("휴지통의 1개를 완전히 지울까요?"), dialogs.at(-1));
await evaluate(`document.getElementById('more-close').click()`);
await sleep(6500);
check("알림은 잠시 뒤 저절로 사라짐", !(await toast()).visible);

// ============ 5) 내보내기·가져오기 (F15) ============
const DL = join(OUT, "downloads");
rmSync(DL, { recursive: true, force: true });
mkdirSync(DL, { recursive: true });
await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: DL });
await seed({ todos: [T("e1", 0, { text: "내보낼 할 일" })], rules: [{ id: "R9", text: "반복", category: "study", repeat: { type: "weekly", days: [1] }, paused: false, createdAt: "", lastGeneratedDate: DAY }] });
await evaluate(`document.getElementById('more-button').click()`);
await evaluate(`document.getElementById('export-button').click()`);
let file = null;
for (let i = 0; i < 30 && !file; i++) { await sleep(200); file = readdirSync(DL).find((f) => f.endsWith(".json")); }
const exported = file ? JSON.parse(readFileSync(join(DL, file), "utf8")) : null;
check("JSON 내보내기: MyTask-날짜.json, 앱 표시·내보낸 시각·할 일·반복 일정 포함", file === `MyTask-${DAY}.json` && exported?.app === "task-manager" && exported.version === 1 &&
  exported.todos.length >= 1 && exported.rules.length === 1 && !!exported.exportedAt, JSON.stringify({ file, keys: exported && Object.keys(exported) }));

const setFile = async (path) => {
  const { root } = await send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "#import-file" });
  await send("DOM.setFileInputFiles", { nodeId, files: [path] });
  await sleep(400);
};
// 다른 데이터로 바꾼 뒤, 내보낸 파일 가져오기
await evaluate(`document.getElementById('more-close').click()`);
await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '가져오기 전에 추가'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
const beforeImport = JSON.stringify(await saved());
await evaluate(`document.getElementById('more-button').click()`);
const dlg = dialogs.length;
await setFile(join(DL, file));
const imp = { confirm: dialogs[dlg] ?? null, toast: await toast(), texts: await texts(), backups: await evaluate(`Object.keys(localStorage).filter(k => k.startsWith('task-manager.backup.import.')).length`) };
check("가져오기: 확인 창(개수 비교) → 파일 내용으로 바뀜, 이전 데이터 백업, 되돌리기 알림",
  imp.confirm?.startsWith("지금 데이터(할 일 2개, 반복 일정 1개)를\n가져온 파일(할 일 1개, 반복 일정 1개)로 바꿀까요?") && JSON.stringify(imp.texts) === '["내보낼 할 일"]' &&
  imp.backups === 1 && imp.toast.text === "가져왔어요" && imp.toast.action === "되돌리기", JSON.stringify(imp));
await clickToastAction(); await sleep(100);
check("가져오기 되돌리기 → 가져오기 전과 같음", JSON.stringify(await saved()) === beforeImport);
const badPath = join(OUT, "bad.json");
writeFileSync(badPath, JSON.stringify({ version: 1, todos: [{ id: "x", text: "날짜 이상", category: "work", date: "2026-13-40", done: false, order: 0 }] }));
await setFile(badPath);
check("잘못된 파일 → 이유를 알려주고 데이터는 그대로", (await toast()).text === "파일 내용이 깨져 있어요. (할 일 1번째: 날짜가 이상해요)" && JSON.stringify(await saved()) === beforeImport, (await toast()).text);
writeFileSync(badPath, "<html>not json</html>");
await setFile(badPath);
check("JSON이 아닌 파일 → 안내", (await toast()).text === "JSON 파일이 아니에요.");
await evaluate(`document.getElementById('more-close').click()`);

// ============ 6) 저장 실패 알림, 다른 탭 ============
await evaluate(`window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }`);
const problemsBefore = problems.length;
await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '저장 실패'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
check("저장 공간이 부족하면 사용자에게 알림", (await toast()).text.startsWith("저장 공간이 부족해서 저장하지 못했어요"));
await evaluate(`Storage.prototype.setItem = window.__realSet`);
problems.splice(problemsBefore); // 의도한 저장 실패 경고

// 다른 탭: 두 번째 페이지를 열어 거기서 추가 → 이 탭에 바로 보이고, 이 탭에서 추가해도 덮어쓰지 않음
await seed({ todos: [T("m", 0, { text: "처음 것" })] });
const created2 = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + "?today=" + DAY)}`, { method: "PUT" })).json();
const ws2 = new WebSocket(created2.webSocketDebuggerUrl);
await new Promise((r) => ws2.addEventListener("open", r, { once: true }));
let seq2 = 0; const pend2 = new Map();
ws2.addEventListener("message", ({ data }) => { const m = JSON.parse(data); if (m.id && pend2.has(m.id)) { pend2.get(m.id)(m.result); pend2.delete(m.id); } });
const eval2 = (expression) => new Promise((r) => { const id = ++seq2; pend2.set(id, (res) => r(res.result?.value)); ws2.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true } })); });
await sleep(1500);
await eval2(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '다른 탭에서 추가'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
await sleep(300);
const tab1 = await texts();
await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '이 탭에서 추가'; i.dispatchEvent(new Event('input')); document.getElementById('sheet-save').click(); })()`);
await sleep(300);
const finalTexts = (await saved()).todos.map((t) => t.text).sort();
check("다른 탭 변경이 새로고침 없이 반영되고, 이 탭에서 저장해도 덮어쓰지 않음", tab1.includes("다른 탭에서 추가") &&
  JSON.stringify(finalTexts) === JSON.stringify(["다른 탭에서 추가", "이 탭에서 추가", "처음 것"].sort()), JSON.stringify({ tab1, finalTexts }));
ws2.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${created2.id}`);

// ============ 7) 헤더 배치 (버튼 4개) ============
for (const width of [375, 360]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 812, deviceScaleFactor: 2, mobile: true });
  await go(BASE + "?today=" + DAY);
  const h = await evaluate(`(() => {
    const ids = ['search-button', 'theme-button', 'rules-button', 'more-button'];
    const rects = ids.map(id => document.getElementById(id).getBoundingClientRect());
    const title = document.querySelector('.app-header__title');
    return { allTouch: rects.every(r => r.width >= 44 && r.height >= 44), sameRow: rects.every(r => Math.abs(r.top - rects[0].top) < 1), right: Math.round(rects[3].right),
      titleOneLine: title.getBoundingClientRect().height < parseFloat(getComputedStyle(title).lineHeight) * 1.5, dateBelow: document.getElementById('today-date').getBoundingClientRect().top > title.getBoundingClientRect().top + 10,
      scroll: document.documentElement.scrollWidth };
  })()`);
  check(`${width}px 헤더: 버튼 4개 44px·한 줄·화면 안, 제목 한 줄, 날짜는 제목 아래`, h.allTouch && h.sameRow && h.right <= width && h.titleOneLine && h.dateBelow && h.scroll <= width, JSON.stringify(h));
  await shot(`s8-header-${width}.png`);
}
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });

// ============ 8) 새 화면들의 글자 대비 (라이트·다크) ============
for (const scheme of ["light", "dark"]) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  await seed({ todos: [T("a", 0, { text: "보고서 마무리" }), T("b", 1, { text: "메일" })], trash: [{ id: "e", kind: "todo", item: T("z", 0, { text: "지운 것" }), deletedAt: new Date().toISOString(), batchId: "b" }] }, { sort: "created" });
  const res = [];
  await evaluate(`document.getElementById('search-button').click()`); await type("#search-input", "보고서"); await pressKey("#search-input", "Enter");
  res.push(["검색 결과·정렬 아이콘", await audit()]);
  await evaluate(`document.getElementById('sort-button').click()`);
  res.push(["정렬 메뉴", await audit()]);
  await evaluate(`document.getElementById('sort-button').click()`);
  await evaluate(`(() => { document.getElementById('add-button').click(); const i = document.getElementById('todo-text'); i.value = '메일'; i.dispatchEvent(new Event('input')); })()`); await sleep(250);
  res.push(["중복 경고", await audit()]);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await evaluate(`document.getElementById('more-button').click()`);
  res.push(["더보기", await audit()]);
  await shot(`s8-more-${scheme}.png`);
  await evaluate(`document.getElementById('more-close').click()`);
  await evaluate(`document.getElementById('search-close').click()`);
  await evaluate(`document.querySelector('[data-id="b"] [data-action=edit]').click()`); await evaluate(`document.getElementById('sheet-delete').click()`); await sleep(250);
  res.push(["알림(토스트)", await audit()]);
  const bad = res.flatMap(([n, r]) => r.bad.map((b) => `${n} "${b.text}" ${b.ratio} < ${b.need}`));
  check(`${scheme === "dark" ? "다크" : "라이트"}: 새 화면 글자 대비 기준 이상`, bad.length === 0, bad.length ? bad.join("; ") : res.map(([n, r]) => `${n} 최저 ${r.min}`).join(" / "));
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

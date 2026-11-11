// store·storage 확인 (Node에서 바로): 휴지통·복구 자리·가져오기 검사·백업·되돌리기·저장 실패 알림 등.
// 실행: node tests/store.test.mjs   (Node 18 이상, 브라우저 없이 가짜 localStorage로 돌려요)
const root = new URL("../", import.meta.url).href.replace(/\/$/, "");
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k),
  key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; },
};
const { load, parseImport, ImportError } = await import(root + "/js/storage.js");
const store = await import(root + "/js/store.js");
const { setTodayOverride } = await import(root + "/js/core/date.js");
let fails = 0;
const ok = (c, m, d = "") => { if (!c) fails++; console.log(c ? "ok  " : "FAIL", m, c ? "" : d); };
setTodayOverride("2026-11-16");

store.initStore(load());
["A", "B", "C", "D"].forEach((t) => store.addTodo(t, "work"));
const ids = () => store.activeTodos().map((t) => t.text);
ok(ids().join() === "D,C,B,A", "추가 순서", ids());

// 삭제 → 휴지통 → 되돌리기: 원래 자리
const bid = store.deleteTodo(store.activeTodos()[1].id); // C
ok(ids().join() === "D,B,A" && store.getState().trash.length === 1, "삭제 → 휴지통");
ok(store.restoreFromTrash({ batchId: bid }) === 1 && ids().join() === "D,C,B,A" && store.getState().trash.length === 0, "되돌리기 → 원래 자리", ids());
ok(store.activeTodos().every((t, i) => t.order === i), "order 빈틈 없음");

// 완료 모두 지우기 → 한 묶음
store.toggleTodo(store.activeTodos()[0].id); store.toggleTodo(store.activeTodos()[0].id); // D, C 완료
const { count, batchId } = store.clearCompleted();
ok(count === 2 && store.getState().trash.length === 2, "완료 모두 지우기 = 2개 한 묶음");
ok(store.restoreFromTrash({ batchId }) === 2 && store.doneTodos().length === 2, "묶음 되돌리기 → 완료 2개 다시");

// 지난 날짜 미완료(반복 할 일)를 휴지통에서 되살리면 오늘로 + 이월 표시, 날짜 처리에서 안 사라짐
store.addRule("영단어", "study", { type: "daily", days: [] });
const ruleTodo = store.activeTodos().find((t) => t.ruleId);
const rb = store.deleteTodo(ruleTodo.id);
setTodayOverride("2026-11-17");
store.rollover();
const restoredCount = store.restoreFromTrash({ batchId: rb });
const back = store.getState().todos.find((t) => t.id === ruleTodo.id);
ok(restoredCount === 1 && back.date === "2026-11-17" && back.carriedFrom === "2026-11-16", "지난 날짜 반복 할 일 복구 → 오늘·이월 표시", JSON.stringify(back));
store.rollover();
ok(!!store.getState().todos.find((t) => t.id === ruleTodo.id), "복구한 것이 날짜 처리에서 다시 사라지지 않음");

// 규칙 삭제·복구
const rule = store.getState().rules[0];
const ruleTodosBefore = store.activeTodos().filter((t) => t.ruleId === rule.id).length;
const rbid = store.deleteRule(rule.id);
ok(store.getState().rules.length === 0, "규칙 삭제 → 휴지통");
store.restoreFromTrash({ batchId: rbid });
ok(store.getState().rules.length === 1 && store.activeTodos().filter((t) => t.ruleId === rule.id).length === ruleTodosBefore, "규칙 복구해도 오늘 몫을 또 만들지 않음 (삭제 전과 개수 같음)",
  store.activeTodos().filter((t) => t.ruleId === rule.id).length);

// 내보내기 → 가져오기 왕복
const json = store.exportJson();
const parsed = parseImport(json);
ok(parsed.todos.length === store.getState().todos.length && parsed.rules.length === 1 && !("app" in parsed), "내보내기 → 가져오기 왕복");

// 가져오기 오류들
const err = (text) => { try { parseImport(text); return "no error"; } catch (e) { return e instanceof ImportError ? e.message : "OTHER " + e; } };
ok(err("not json") === "JSON 파일이 아니에요.", "JSON 아님");
ok(err('{"hello":1}') === "MyTask에서 내보낸 파일이 아니에요.", "다른 앱 파일");
ok(err('{"version":2,"todos":[]}').startsWith("더 새로운 버전"), "더 새 버전");
const bad = JSON.parse(json); bad.todos[0].date = "2026-02-30";
ok(err(JSON.stringify(bad)).includes("날짜가 이상해요"), "없는 날짜", err(JSON.stringify(bad)));
const dup = JSON.parse(json); dup.todos.push({ ...dup.todos[0] });
ok(err(JSON.stringify(dup)).includes("id가 겹쳐요"), "id 중복");
const badCat = JSON.parse(json); badCat.todos[0].category = "hack";
ok(err(JSON.stringify(badCat)).includes("카테고리"), "이상한 카테고리");
ok(err("x".repeat(2 * 1024 * 1024 + 1)).includes("너무 커요"), "너무 큰 파일");

// 가져오기 → 백업·되돌리기
const before = JSON.stringify(store.getState());
const other = parseImport(JSON.stringify({ version: 1, todos: [{ id: "z", text: "가져온 할 일", category: "personal", date: "2026-11-10", done: false, order: 0, ruleId: null, carriedFrom: null, createdAt: "", completedAt: null }], rules: [] }));
const { snapshot, backedUp } = store.importState(other);
const imported = store.getState().todos[0];
ok(backedUp && [...mem.keys()].some((k) => k.startsWith("task-manager.backup.import.")), "가져오기 전 백업 키");
ok(store.getState().todos.length === 1 && imported.date === "2026-11-17" && imported.carriedFrom === "2026-11-10", "가져온 지난 미완료는 오늘로 이월", JSON.stringify(imported));
store.restoreSnapshot(snapshot);
ok(JSON.stringify(store.getState()) === before, "되돌리기 → 가져오기 전과 똑같음");
for (let i = 0; i < 4; i++) store.importState(other);
ok([...mem.keys()].filter((k) => k.startsWith("task-manager.backup.import.")).length <= 3, "가져오기 백업은 최근 3개만");

// 저장 실패 알림
let saveErrors = 0; store.onSaveError(() => saveErrors++);
const realSet = localStorage.setItem; localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
store.addTodo("저장 실패 테스트", "work");
localStorage.setItem = realSet;
ok(saveErrors === 1, "저장 공간 부족 → 알림");

console.log(fails === 0 ? "ALL OK" : `${fails} FAILED`);
process.exit(fails ? 1 : 0);

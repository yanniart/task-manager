// 앱 상태와 변경 함수 (TRD 4장 저장 규칙, 5.5).
// 상태를 바꾸는 함수는 이 파일에만 있어요. 바꾼 뒤에는 항상 저장 → 구독자(render) 호출 순서예요.
// 이 파일은 DOM을 건드리지 않아요.

import { MAX_TEXT_LENGTH, CATEGORY_IDS, FILTER_IDS, THEME_IDS, SORT_IDS } from "./constants.js";
import { save, serializeForExport, backupBeforeImport, parseImport } from "./storage.js";
import { createId } from "./core/id.js";
import { todayKey, compareKeys } from "./core/date.js";
import { insertNew, insertAt, appendLast, moveVisible, renumber } from "./core/order.js";
import { normalizeRepeat } from "./core/recurrence.js";
import { runRollover } from "./core/rollover.js";
import { addToTrash, purgeTrash, takeFromTrash } from "./core/trash.js";
import { parseKeywordInput, effectiveKeywords } from "./core/classify.js";

let state = null;
const listeners = new Set();
const saveErrorListeners = new Set();

export function initStore(initialState) {
  state = initialState;
}

export function getState() {
  return state;
}

/** 상태가 바뀔 때마다 fn(state)를 불러요. 구독을 끊는 함수를 돌려줘요. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 저장에 실패했을 때(저장 공간 부족 등) fn()을 불러요. 화면이 사용자에게 알려요. */
export function onSaveError(fn) {
  saveErrorListeners.add(fn);
}

/**
 * 다른 탭에서 데이터가 바뀌었을 때 그 데이터로 갈아 끼워요 (저장은 하지 않음).
 * 안 하면 이 탭의 옛 데이터가 다음 저장 때 다른 탭의 변경(가져오기·복구 등)을 덮어써요.
 */
export function replaceState(nextState) {
  state = nextState;
  listeners.forEach((fn) => fn(state));
}

function commit() {
  if (!save(state)) saveErrorListeners.forEach((fn) => fn());
  listeners.forEach((fn) => fn(state));
}

/** 오늘의 미완료 항목을 order 순으로 (TRD 5.4) */
export function activeTodos(s = state, today = todayKey()) {
  return s.todos
    .filter((todo) => todo.date === today && !todo.done)
    .sort((a, b) => a.order - b.order);
}

/** 오늘의 완료 항목을 완료 시각 최신순으로 (TRD 5.4) */
export function doneTodos(s = state, today = todayKey()) {
  return s.todos
    .filter((todo) => todo.date === today && todo.done)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

/**
 * 할 일 추가 (PRD F1). 고른 카테고리는 다음 추가의 기본값이 돼요.
 * 키워드로 자동으로 고른 카테고리(PRD F18)는 기본값을 바꾸지 않아요: { remember: false }
 * 내용이 비었거나 너무 길거나 카테고리가 이상하면 추가하지 않고 false를 돌려줘요.
 */
export function addTodo(text, category = state.settings.lastCategory, { remember = true } = {}) {
  const clean = cleanText(text);
  if (!clean || !CATEGORY_IDS.includes(category)) return false;

  if (remember) state.settings.lastCategory = category;
  const today = todayKey();
  const todo = {
    id: createId(),
    text: clean,
    category,
    date: today,
    done: false,
    order: 0,
    ruleId: null,
    carriedFrom: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  state.todos.push(todo);
  renumber(insertNew(activeTodos(state, today).filter((t) => t !== todo), todo));
  commit();
  return true;
}

/**
 * 내용·카테고리 수정 (PRD F2). 반복 규칙이 있어도 이 할 일만 바뀌어요.
 * 수정할 때 고른 카테고리는 '마지막으로 고른 값'(추가 기본값)을 바꾸지 않아요.
 */
export function updateTodo(id, { text, category }) {
  const todo = findTodo(id);
  const clean = cleanText(text);
  if (!todo || !clean || !CATEGORY_IDS.includes(category)) return false;
  todo.text = clean;
  todo.category = category;
  commit();
  return true;
}

/** 필터 바꾸기 (PRD F5). 새로고침해도 유지돼요. */
export function setFilter(filter) {
  if (!FILTER_IDS.includes(filter) || state.settings.filter === filter) return;
  state.settings.filter = filter;
  commit();
}

/** 보기 정렬 바꾸기 (PRD F14). 보는 순서만 바뀌고 저장된 드래그 순서는 그대로예요. */
export function setSort(sort) {
  if (!SORT_IDS.includes(sort) || state.settings.sort === sort) return;
  state.settings.sort = sort;
  commit();
}

// ---------- 키워드 자동 분류 (PRD F18, TL-023) ----------

/** 자동 분류 켜기·끄기 */
export function setAutoCategoryEnabled(enabled) {
  if (state.settings.autoCategory.enabled === enabled) return;
  state.settings.autoCategory.enabled = enabled;
  commit();
}

/**
 * 한 카테고리의 키워드를 바꿔요. input은 쉼표로 구분한 글자.
 * 처음 고칠 때 기본 키워드를 복사해서 시작해요(다른 카테고리는 기본값 그대로 남게).
 * @returns {string[]} 정리된 키워드 목록
 */
export function setCategoryKeywords(category, input) {
  if (!CATEGORY_IDS.includes(category)) return [];
  const list = parseKeywordInput(input);
  const auto = state.settings.autoCategory;
  const current = structuredClone(effectiveKeywords(auto));
  if (JSON.stringify(current[category]) === JSON.stringify(list) && auto.keywords) return list;
  auto.keywords = { ...current, [category]: list };
  commit();
  return list;
}

/** 기본 키워드로 되돌리기 (저장값을 null로 = 앞으로 기본값을 따라감) */
export function resetCategoryKeywords() {
  if (state.settings.autoCategory.keywords === null) return;
  state.settings.autoCategory.keywords = null;
  commit();
}

/** 화면 모드 바꾸기 (PRD F12): "system" | "light" | "dark". 새로고침해도 유지돼요. */
export function setTheme(theme) {
  if (!THEME_IDS.includes(theme) || state.settings.theme === theme) return;
  state.settings.theme = theme;
  commit();
}

/** 완료 ↔ 미완료 (PRD F4). 완료를 취소하면 미완료 맨 아래로 가요. */
export function toggleTodo(id) {
  const todo = findTodo(id);
  if (!todo) return;
  const today = todayKey();

  if (todo.done) {
    todo.done = false;
    todo.completedAt = null;
    // '이전에 완료한 항목'을 취소하면 오늘 목록으로 데려와요. 이월처럼 처음 날짜를 남겨요 (TL-015).
    if (compareKeys(todo.date, today) < 0) {
      todo.carriedFrom ??= todo.date;
      todo.date = today;
    }
    const rest = activeTodos(state, today).filter((t) => t !== todo);
    renumber(appendLast(rest, todo));
  } else {
    todo.done = true;
    todo.completedAt = new Date().toISOString();
    // 완료한 항목의 order는 그대로 두고 쓰지 않아요. 남은 미완료 항목만 빈틈없이 다시 매겨요.
    renumber(activeTodos(state, today));
  }
  commit();
}

/**
 * 순서 바꾸기 (PRD F10, TRD 5.6). 드래그와 키보드(↑/↓)가 함께 써요.
 * toIndex는 '지금 화면에 보이는 미완료 항목' 안에서의 위치예요. 필터·검색이 켜져 있으면 보이는 항목끼리만 섞여요.
 * isVisible: 화면에 보이는지 (카테고리 필터 + 검색어). 안 넘기면 카테고리 필터만 봐요.
 * 바뀐 게 있으면 저장하고 한 번 다시 그려요. 옮긴 뒤의 위치(보이는 항목 안)를 돌려주고, 못 옮기면 -1.
 */
export function reorderTodo(id, toIndex, isVisible = categoryFilter()) {
  const today = todayKey();
  const list = activeTodos(state, today);
  const visible = list.filter(isVisible);
  const from = visible.findIndex((todo) => todo.id === id);
  if (from === -1) return -1;
  const to = Math.max(0, Math.min(toIndex, visible.length - 1));
  if (to === from) return from;
  renumber(moveVisible(list, isVisible, from, to));
  commit();
  return to;
}

/** 할 일 하나 삭제 (PRD F3). 휴지통으로 가요(F17). 되돌리기용 묶음 id를 돌려주고, 없으면 null. */
export function deleteTodo(id) {
  const todo = findTodo(id);
  if (!todo) return null;
  state.todos = state.todos.filter((t) => t !== todo);
  const batchId = moveToTrash("todo", [todo]);
  renumber(activeTodos());
  commit();
  return batchId;
}

/** 완료한 항목 모두 지우기 (PRD F3). 한 묶음으로 휴지통에 가요. { count, batchId } */
export function clearCompleted() {
  const removed = state.todos.filter((todo) => todo.done);
  if (removed.length === 0) return { count: 0, batchId: null };
  state.todos = state.todos.filter((todo) => !todo.done);
  const batchId = moveToTrash("todo", removed);
  commit();
  return { count: removed.length, batchId };
}

/** 지난 날짜의 완료 항목 = '이전에 완료한 항목' 구역 (TRD 5.4) */
export function previousDoneTodos(s = state, today = todayKey()) {
  return s.todos
    .filter((todo) => todo.done && compareKeys(todo.date, today) < 0)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
}

// ---------- 날짜 변경 (TRD 5.2) ----------

/** 이월·반복 생성 + 오래된 휴지통 정리. 바뀐 게 있으면 저장하고 다시 그려요. 같은 날 여러 번 불러도 괜찮아요. */
export function rollover() {
  const trashBefore = state.trash.length;
  state.trash = purgeTrash(state.trash, new Date().toISOString());
  if (applyRollover() || state.trash.length !== trashBefore) commit();
}

function applyRollover() {
  const result = runRollover(state, todayKey());
  state = result.state;
  return result.changed;
}

// ---------- 반복 규칙 (PRD F8, TRD 5.9) ----------

export function getRule(id) {
  return state.rules.find((rule) => rule.id === id) ?? null;
}

/**
 * 반복 규칙 만들기. 오늘이 규칙에 맞으면 오늘 할 일도 바로 생겨요(이월 항목 바로 아래).
 * 오늘 몫은 runRollover가 만들어서, 앱을 다시 열었을 때와 결과가 똑같아요.
 */
export function addRule(text, category, repeat, { remember = true } = {}) {
  const clean = cleanText(text);
  const cleanRepeat = normalizeRepeat(repeat);
  if (!clean || !CATEGORY_IDS.includes(category) || !cleanRepeat) return false;

  if (remember) state.settings.lastCategory = category;
  state.rules.push({
    id: createId(),
    text: clean,
    category,
    repeat: cleanRepeat,
    paused: false,
    createdAt: new Date().toISOString(),
    lastGeneratedDate: null,
  });
  applyRollover();
  commit();
  return true;
}

/** 규칙 수정. 오늘 이미 생긴 할 일은 그대로이고 다음 생성분부터 반영돼요. */
export function updateRule(id, { text, category, repeat }) {
  const rule = getRule(id);
  const clean = cleanText(text);
  const cleanRepeat = normalizeRepeat(repeat);
  if (!rule || !clean || !CATEGORY_IDS.includes(category) || !cleanRepeat) return false;
  rule.text = clean;
  rule.category = category;
  rule.repeat = cleanRepeat;
  // 아직 오늘 몫을 만들지 않았고 바뀐 규칙이 오늘에 맞으면, 다시 열었을 때처럼 오늘 몫이 생겨요.
  applyRollover();
  commit();
  return true;
}

export function setRulePaused(id, paused) {
  const rule = getRule(id);
  if (!rule || rule.paused === paused) return;
  rule.paused = paused;
  applyRollover();
  commit();
}

/** 규칙 삭제. 휴지통으로 가요(F17). 이미 생긴 할 일은 남아요. 묶음 id를 돌려주고, 없으면 null. */
export function deleteRule(id) {
  const rule = getRule(id);
  if (!rule) return null;
  state.rules = state.rules.filter((r) => r !== rule);
  const batchId = moveToTrash("rule", [rule]);
  commit();
  return batchId;
}

// ---------- 휴지통 (PRD F17, TL-021) ----------

function moveToTrash(kind, items) {
  const batchId = createId();
  state.trash = addToTrash(state.trash, kind, items, { batchId, now: new Date().toISOString(), createId });
  return batchId;
}

/**
 * 휴지통에서 되살려요. { entryId } 하나 또는 { batchId } 한 묶음(되돌리기).
 * - 미완료 할 일은 원래 순서 자리로. 지난 날짜면 오늘로 데려오고 이월 표시를 남겨요(안 그러면 날짜 처리에서 다시 사라져요).
 * - 같은 id가 이미 있으면(예: 그 사이 가져오기) 건너뛰어요.
 * @returns {number} 되살린 개수
 */
export function restoreFromTrash({ entryId = null, batchId = null }) {
  const { picked, rest } = takeFromTrash(state.trash, (e) => (entryId ? e.id === entryId : e.batchId === batchId));
  if (picked.length === 0) return 0;
  state.trash = rest;
  const today = todayKey();
  let restored = 0;
  // 원래 순서대로 끼워 넣어야 자리가 맞아요.
  const todos = picked.filter((e) => e.kind === "todo").map((e) => e.item).sort((a, b) => a.order - b.order);
  for (const todo of todos) {
    if (findTodo(todo.id)) continue;
    if (!todo.done && compareKeys(todo.date, today) < 0) {
      todo.carriedFrom ??= todo.date;
      todo.date = today;
    }
    state.todos.push(todo);
    if (!todo.done && todo.date === today) {
      renumber(insertAt(activeTodos(state, today).filter((t) => t !== todo), todo, todo.order));
    }
    restored += 1;
  }
  for (const { item: rule } of picked.filter((e) => e.kind === "rule")) {
    if (getRule(rule.id)) continue;
    state.rules.push(rule);
    restored += 1;
  }
  applyRollover(); // 되살린 규칙의 오늘 몫 등, 다시 열었을 때와 같은 결과가 되게
  commit();
  return restored;
}

export function emptyTrash() {
  if (state.trash.length === 0) return;
  state.trash = [];
  commit();
}

// ---------- 내보내기·가져오기 (PRD F15, TL-021) ----------

export function exportJson() {
  return serializeForExport(state);
}

/**
 * 가져올 파일 글자를 검사해서 상태로 바꿔요(아직 적용 안 함). 화면은 storage를 직접 부르지 않고 이걸 써요.
 * 잘못된 파일이면 name이 "ImportError"인 오류를 던지고, message를 그대로 보여주면 돼요.
 */
export function parseImportText(text) {
  return parseImport(text);
}

/** 할 일·반복 일정 개수 (가져오기 확인 창용) */
export function summarize(s = state) {
  return { todos: s.todos.length, rules: s.rules.length };
}

/**
 * 가져온 상태로 통째로 바꿔요. 바꾸기 전 데이터는 백업 키에 남기고, 되돌리기용 사본을 돌려줘요.
 * @returns {{ snapshot: object, backedUp: boolean }}
 */
export function importState(nextState) {
  const snapshot = structuredClone(state);
  const backedUp = backupBeforeImport(state);
  state = nextState;
  state.trash = purgeTrash(state.trash, new Date().toISOString());
  applyRollover(); // 가져온 파일의 날짜가 지났으면 이월·반복을 오늘 기준으로 맞춰요
  commit();
  return { snapshot, backedUp };
}

/** importState가 돌려준 사본으로 되돌려요. */
export function restoreSnapshot(snapshot) {
  state = structuredClone(snapshot);
  applyRollover();
  commit();
}

export function countCompleted() {
  return state.todos.filter((todo) => todo.done).length;
}

export function getTodo(id) {
  return findTodo(id) ?? null;
}

/** 앞뒤 공백을 지운 내용(한글은 NFC로 맞춤). 비었거나 너무 길면 null. */
function cleanText(text) {
  const clean = String(text ?? "").normalize("NFC").trim();
  return clean && clean.length <= MAX_TEXT_LENGTH ? clean : null;
}

function categoryFilter() {
  const { filter } = state.settings;
  return (todo) => filter === "all" || todo.category === filter;
}

function findTodo(id) {
  return state.todos.find((todo) => todo.id === id);
}

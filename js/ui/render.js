// 전체 화면 그리기와 사용자 입력 연결 (TRD 5.5, TL-007, TL-021).
// 상태가 바뀌면 화면 전체를 다시 계산해요. 다만 할 일 한 줄 요소는 내용이 같으면 다시 만들지 않고 그대로 써요
// (100개 이상에서도 부드럽게, TL-021). 이벤트는 부모 하나에 걸고 data-id로 항목을 찾아요.
// ui 모듈끼리는 서로 직접 부르지 않고, 여기서 서로 필요한 함수를 넘겨 줘요.

import { CATEGORIES, CATEGORY_LABELS, FILTERS } from "../constants.js";
import { todayKey, formatHeaderDate, isTodayOverridden } from "../core/date.js";
import { calcProgress } from "../core/progress.js";
import { parseQuery, matchesQuery } from "../core/text.js";
import { sortForView } from "../core/sort.js";
import {
  getState,
  activeTodos,
  doneTodos,
  previousDoneTodos,
  countCompleted,
  getTodo,
  toggleTodo,
  clearCompleted,
  setFilter,
  setSort,
  setTheme,
  reorderTodo,
  restoreFromTrash,
  onSaveError,
} from "../store.js";
import { createTodoItem } from "./todo-item.js";
import { initSheet, openSheet } from "./sheet.js";
import { initRulesView, openRulesView, renderRules } from "./rules-view.js";
import { initMoreView, openMoreView, renderMore } from "./more-view.js";
import { initSearchBar } from "./search-bar.js";
import { initSortMenu, renderSortMenu } from "./sort-menu.js";
import { initToast, showToast } from "./toast.js";
import { updateBanner } from "./banner.js";
import { initDrag, isDragging } from "./drag.js";
import { initTheme, applyTheme, themeMessage } from "./theme.js";

let els = null;
let pendingState = null; // 드래그 중에 들어온 다시 그리기 요청 (끝난 뒤 한 번 그려요)
let searchQuery = ""; // 검색어는 저장하지 않는 화면 상태예요 (PRD F13)
let currentVisible = () => true; // 지금 화면에 보이는 조건 (필터 + 검색어). 드래그가 같은 조건으로 섞어요.

// 할 일 한 줄 요소 재사용: id → { key, el }. key는 화면에 보이는 값들로 만들어요.
const itemCache = new Map();

/** 한 번만 불러요: 요소를 찾고 이벤트를 연결해요. */
export function initUI() {
  els = {
    app: document.getElementById("app"),
    rulesView: document.getElementById("rules-view"),
    date: document.getElementById("today-date"),
    rulesButton: document.getElementById("rules-button"),
    themeButton: document.getElementById("theme-button"),
    moreButton: document.getElementById("more-button"),
    progressText: document.getElementById("progress-text"),
    progressBar: document.getElementById("progress-bar"),
    progressFill: document.getElementById("progress-fill"),
    categoryStats: document.getElementById("category-stats"),
    banner: document.getElementById("celebration"),
    filters: document.getElementById("filters"),
    lists: document.getElementById("lists"),
    searchInfo: document.getElementById("search-info"),
    activeList: document.getElementById("active-list"),
    empty: document.getElementById("empty-message"),
    doneSection: document.getElementById("done-section"),
    doneCount: document.getElementById("done-count"),
    doneList: document.getElementById("done-list"),
    prevSection: document.getElementById("prev-section"),
    prevCount: document.getElementById("prev-count"),
    prevList: document.getElementById("prev-list"),
    clearButton: document.getElementById("clear-completed"),
    addButton: document.getElementById("add-button"),
    header: document.querySelector(".app-header"),
    liveStatus: document.getElementById("live-status"),
  };

  initToast();
  // 저장 공간이 부족하면 콘솔에만 남기지 않고 사용자에게 알려요 (TL-021)
  onSaveError(() =>
    showToast("저장 공간이 부족해서 저장하지 못했어요. 휴지통을 비우거나 데이터를 내보내 주세요.", { duration: 8000 }),
  );
  initDrag({
    list: els.activeList,
    getTopEdge: () => els.header.getBoundingClientRect().bottom,
    onDrop: onReorder,
    onEnd: () => {
      if (pendingState) render(pendingState);
    },
  });

  buildFilterTabs();
  buildCategoryStats();
  initTheme({
    button: els.themeButton,
    onChange: (theme) => {
      setTheme(theme);
      els.liveStatus.textContent = themeMessage(theme); // 화면 읽기 프로그램에 결과 알림
    },
  });
  initSearchBar({
    onQuery: (query) => {
      searchQuery = query;
      render(getState());
    },
  });
  initSheet({
    backgrounds: [els.app, els.rulesView],
    fallbackFocus: els.addButton,
    onOpenRule: (ruleId) => openRulesView({ highlightId: ruleId, opener: els.rulesButton }),
    onDeleted: notifyDeleted,
  });
  initRulesView({
    background: els.app,
    fallbackFocus: els.rulesButton,
    onEditRule: (rule, opener) => openSheet({ mode: "rule-edit", rule, opener }),
    onNewRule: (opener) => openSheet({ mode: "rule-add", opener }),
    onDeleted: notifyDeleted,
  });
  initMoreView({ background: els.app, fallbackFocus: els.moreButton, notify: showToast });
  initSortMenu({ onSelect: setSort });

  els.addButton.addEventListener("click", () => openSheet({ mode: "add", opener: els.addButton }));
  els.rulesButton.addEventListener("click", () => openRulesView({ opener: els.rulesButton }));
  els.moreButton.addEventListener("click", () => openMoreView({ opener: els.moreButton }));

  els.filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (button) setFilter(button.dataset.filter);
  });

  els.lists.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.closest("[data-id]")?.dataset.id;
    if (!id) return;

    if (button.dataset.action === "toggle") {
      // 지원하는 기기에서만 짧게 진동 (PRD F4). 사용자가 직접 누른 경우에만 브라우저가 허용해요.
      if (navigator.userActivation?.isActive ?? true) navigator.vibrate?.(10);
      toggleTodo(id);
    } else if (button.dataset.action === "edit") {
      const todo = getTodo(id);
      if (todo) openSheet({ mode: "edit", todo, opener: button });
    }
  });

  els.clearButton.addEventListener("click", () => {
    const count = countCompleted();
    if (count > 0 && confirm(`완료한 항목 ${count}개를 모두 지울까요?\n휴지통에서 되살릴 수 있어요.`)) {
      const result = clearCompleted();
      notifyDeleted(result.batchId, `완료한 항목 ${result.count}개를`);
      els.addButton.focus();
    }
  });
}

/**
 * 지웠다고 알리고 '되돌리기'를 보여줘요 (PRD F17).
 * @param {string|null} batchId store가 돌려준 휴지통 묶음 id
 * @param {string} what 예: '"보고서"을(를)', '완료한 항목 3개를'
 */
function notifyDeleted(batchId, what) {
  if (!batchId) return;
  showToast(`${what} 지웠어요`, {
    actionLabel: "되돌리기",
    onAction: () => {
      const count = restoreFromTrash({ batchId });
      showToast(count > 0 ? "되살렸어요" : "이미 있는 항목이라 되살리지 않았어요");
    },
  });
}

export function render(state) {
  // 끄는 동안 목록을 다시 그리면 끌던 항목이 사라져요. 끝날 때까지 미뤄요 (예: 자정 이월이 겹칠 때).
  if (isDragging()) {
    pendingState = state;
    return;
  }
  pendingState = null;
  applyTheme(state.settings.theme);
  const today = todayKey();
  const { filter, sort } = state.settings;
  const terms = parseQuery(searchQuery);
  const visible = (todo) => (filter === "all" || todo.category === filter) && matchesQuery(todo.text, terms);
  currentVisible = visible;

  els.date.textContent = formatHeaderDate(today) + (isTodayOverridden() ? " · 테스트 날짜" : "");
  els.date.dateTime = today;
  els.date.classList.toggle("app-header__date--dev", isTodayOverridden());

  renderProgress(calcProgress(state.todos, today));
  renderFilterTabs(filter);

  // 보기 정렬 (PRD F14): 직접 정렬일 때만 끌어서 옮길 수 있어요.
  const view = sortForView(activeTodos(state, today).filter(visible), doneTodos(state, today).filter(visible), sort);
  const draggable = sort === "manual";
  const previous = previousDoneTodos(state, today).filter(visible);
  const used = new Set();
  const item = (todo, options) => {
    used.add(todo.id);
    return itemFor(todo, { ...options, terms });
  };

  syncChildren(els.activeList, view.active.map((todo) => item(todo, { draggable: draggable && !todo.done })));
  els.doneSection.hidden = view.merged || view.done.length === 0;
  els.doneCount.textContent = String(view.done.length);
  syncChildren(els.doneList, view.done.map((todo) => item(todo)));

  // 이전에 완료한 항목: 접힘 구역, 진행률에는 안 들어가요 (PRD F7). 검색 결과가 있으면 펼쳐서 보여줘요.
  els.prevSection.hidden = previous.length === 0;
  els.prevCount.textContent = String(previous.length);
  syncChildren(els.prevList, previous.map((todo) => item(todo)));
  if (terms.length > 0 && previous.length > 0) els.prevSection.open = true;

  // 안 쓰게 된 요소는 버려요 (지운 할 일 등)
  for (const id of itemCache.keys()) if (!used.has(id)) itemCache.delete(id);

  renderNotices({ state, today, filter, terms, count: view.active.length + view.done.length + previous.length });
  renderSortMenu(sort);
  els.clearButton.hidden = countCompleted() === 0;

  renderRules(state.rules);
  renderMore(state);
}

function renderNotices({ state, today, filter, terms, count }) {
  // 검색 결과 (PRD F13)
  els.searchInfo.hidden = terms.length === 0;
  if (terms.length > 0) {
    els.searchInfo.textContent = count > 0 ? `검색 결과 ${count}개` : "검색 결과가 없어요";
  }

  // 빈 목록 안내: 오늘 할 일이 0개면 진행률 자리의 안내가 대신해요.
  let message = null;
  if (terms.length > 0 && count === 0) {
    message = `"${searchQuery.trim()}"에 맞는 할 일이 없어요` + (filter !== "all" ? ` (${CATEGORY_LABELS[filter]}에서)` : "");
  } else if (terms.length === 0 && count === 0 && filter !== "all" && hasTodayTodos(state, today)) {
    message = `${CATEGORY_LABELS[filter]} 할 일이 없어요`;
  }
  els.empty.hidden = message === null;
  if (message !== null) els.empty.textContent = message;
}

/** 내용이 같으면 전에 만든 요소를 그대로 써요. */
function itemFor(todo, options) {
  const key = [
    todo.text,
    todo.category,
    todo.done,
    todo.ruleId ?? "",
    todo.carriedFrom ?? "",
    options.draggable ? 1 : 0,
    options.terms.join(" "),
  ].join("\u0000");
  const hit = itemCache.get(todo.id);
  if (hit && hit.key === key) return hit.el;
  const el = createTodoItem(todo, options);
  itemCache.set(todo.id, { key, el });
  return el;
}

/**
 * 목록을 원하는 순서로 맞추되, 자리가 다른 요소만 옮겨요 (TL-021).
 * 한 칸 옮기기·체크 하나처럼 조금 바뀌면 DOM 작업도 몇 번뿐이라 100개 이상에서도 빨라요.
 */
function syncChildren(parent, nodes) {
  const current = parent.children;
  for (let i = 0; i < nodes.length; i++) {
    if (current[i] !== nodes[i]) parent.insertBefore(nodes[i], current[i] ?? null);
  }
  while (current.length > nodes.length) current[current.length - 1].remove();
}

/** 드래그·키보드로 순서를 바꿨을 때 (TRD 5.6) */
function onReorder(id, toIndex, how) {
  const text = getTodo(id)?.text ?? "";
  const placed = reorderTodo(id, toIndex, currentVisible);
  if (placed < 0) return;
  const total = els.activeList.querySelectorAll(":scope > .todo").length;
  // 화면 읽기 프로그램에 결과를 알려요.
  els.liveStatus.textContent = `"${text}" ${total}개 중 ${placed + 1}번째로 옮겼어요`;
  // 키보드로 옮겼으면 같은 손잡이에 포커스를 돌려줘요 (계속 ↑/↓ 누를 수 있게).
  if (how === "keyboard") {
    els.activeList.querySelector(`[data-id="${CSS.escape(id)}"] .todo__handle`)?.focus();
  }
}

function renderProgress(progress) {
  els.progressText.textContent =
    progress.total === 0
      ? "할 일을 추가해 보세요 · 0%"
      : `${progress.done} / ${progress.total} 완료 · ${progress.percent}%`;
  els.progressFill.style.width = `${progress.percent}%`;
  els.progressBar.setAttribute("aria-valuenow", String(progress.percent));
  els.progressBar.classList.toggle("progress--complete", progress.isComplete);

  for (const { id } of CATEGORIES) {
    const { done, total } = progress.byCategory[id];
    const item = els.categoryStats.querySelector(`[data-category="${id}"]`);
    item.querySelector(".stat__value").textContent = `${done}/${total}`;
    item.classList.toggle("stat--empty", total === 0);
  }

  updateBanner(els.banner, progress.isComplete);
}

function renderFilterTabs(filter) {
  els.filters.querySelectorAll("button[data-filter]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
  });
}

function buildFilterTabs() {
  const buttons = FILTERS.map(({ id, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter filter--${id}`;
    button.dataset.filter = id;
    button.setAttribute("aria-pressed", "false");
    button.textContent = label;
    return button;
  });
  els.filters.replaceChildren(...buttons);
}

function buildCategoryStats() {
  const items = CATEGORIES.map(({ id, label }) => {
    const li = document.createElement("li");
    li.className = `stat stat--${id}`;
    li.dataset.category = id;
    const name = document.createElement("span");
    name.className = "stat__label";
    name.textContent = label;
    const value = document.createElement("span");
    value.className = "stat__value";
    li.append(name, " ", value);
    return li;
  });
  els.categoryStats.replaceChildren(...items);
}

function hasTodayTodos(state, today) {
  return state.todos.some((todo) => todo.date === today);
}

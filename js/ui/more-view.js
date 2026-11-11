// 더보기 화면 (PRD F18 자동 분류 키워드, F15 내보내기·가져오기, F17 휴지통). 헤더의 ⋯로 열어요.
// 정렬(F14)은 목록 위 아이콘(ui/sort-menu.js)으로 옮겼어요 (TL-022).
// 반복 일정 관리 화면처럼 화면 전체를 덮는 대화 상자예요. 알림(토스트)은 render.js가 넘겨준 notify로 보여요.

import { CATEGORIES, CATEGORY_LABELS } from "../constants.js";
import { effectiveKeywords, findKeywordConflicts } from "../core/classify.js";
import { withParticle } from "../core/text.js";
import { toKey, todayKey, formatMonthDay } from "../core/date.js";
import {
  setAutoCategoryEnabled,
  setCategoryKeywords,
  resetCategoryKeywords,
  exportJson,
  parseImportText,
  importState,
  restoreSnapshot,
  restoreFromTrash,
  emptyTrash,
  summarize,
} from "../store.js";

let els = null;
let notify = () => {};
let returnFocusTo = null;
let fallbackFocus = null;

/**
 * @param {{ background: HTMLElement, fallbackFocus: HTMLElement,
 *           notify: (message: string, options?: object) => void }} options
 */
export function initMoreView(options) {
  notify = options.notify;
  fallbackFocus = options.fallbackFocus;
  els = {
    background: options.background,
    view: document.getElementById("more-view"),
    close: document.getElementById("more-close"),
    exportButton: document.getElementById("export-button"),
    importButton: document.getElementById("import-button"),
    importFile: document.getElementById("import-file"),
    trashCount: document.getElementById("trash-count"),
    trashList: document.getElementById("trash-list"),
    trashEmpty: document.getElementById("trash-empty"),
    trashEmptyButton: document.getElementById("trash-empty-button"),
    autoEnabled: document.getElementById("auto-enabled"),
    keywordFields: document.getElementById("keyword-fields"),
    keywordConflicts: document.getElementById("keyword-conflicts"),
    keywordsReset: document.getElementById("keywords-reset"),
  };
  buildKeywordFields();
  els.autoEnabled.addEventListener("change", () => setAutoCategoryEnabled(els.autoEnabled.checked));
  // 다른 곳을 누르거나 Enter를 치면(change) 저장하고, 정리된 키워드로 다시 보여줘요.
  els.keywordFields.addEventListener("change", (event) => {
    const input = event.target.closest("[data-category]");
    if (!input) return;
    const list = setCategoryKeywords(input.dataset.category, input.value);
    input.value = list.join(", ");
  });
  els.keywordFields.addEventListener("keydown", (event) => {
    // 키워드 칸에서 Enter는 줄바꿈 대신 저장 (쉼표로 구분하니까)
    if (event.key === "Enter" && !event.isComposing && event.target.matches("[data-category]")) {
      event.preventDefault();
      event.target.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  els.keywordsReset.addEventListener("click", () => {
    if (confirm("자동 분류 키워드를 기본값으로 되돌릴까요?\n고친 키워드는 사라져요.")) {
      resetCategoryKeywords();
      notify("기본 키워드로 되돌렸어요");
    }
  });

  els.close.addEventListener("click", closeMoreView);
  els.view.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMoreView();
    }
  });
  els.exportButton.addEventListener("click", exportData);
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importData);
  els.trashList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-entry-id]");
    if (!button) return;
    const count = restoreFromTrash({ entryId: button.dataset.entryId });
    notify(count > 0 ? "되살렸어요" : "이미 있는 항목이라 되살리지 않았어요");
    (els.trashList.querySelector("button[data-entry-id]") ?? els.close).focus();
  });
  els.trashEmptyButton.addEventListener("click", () => {
    const count = Number(els.trashCount.textContent);
    if (count > 0 && confirm(`휴지통의 ${count}개를 완전히 지울까요?\n지우면 되살릴 수 없어요.`)) {
      emptyTrash();
      notify("휴지통을 비웠어요");
      els.close.focus();
    }
  });
}

/** @param {{ opener?: Element }} options */
export function openMoreView({ opener = null } = {}) {
  returnFocusTo = opener;
  els.view.hidden = false;
  els.background.inert = true;
  document.body.classList.add("is-rules-open"); // 뒤 화면 스크롤 잠금 (반복 일정 화면과 같은 방식)
  els.view.scrollTop = 0;
  els.close.focus();
}

export function closeMoreView() {
  if (els.view.hidden) return;
  els.view.hidden = true;
  els.background.inert = false;
  document.body.classList.remove("is-rules-open");
  (returnFocusTo?.isConnected ? returnFocusTo : fallbackFocus)?.focus();
  returnFocusTo = null;
}

let lastTrashKey = null;

/** render.js가 상태가 바뀔 때마다 불러요. 휴지통 목록은 바뀌었을 때만 다시 만들어요. */
export function renderMore(state) {
  renderAutoCategory(state.settings.autoCategory);
  els.trashCount.textContent = String(state.trash.length);
  els.trashEmpty.hidden = state.trash.length > 0;
  els.trashEmptyButton.hidden = state.trash.length === 0;
  const key = state.trash.map((e) => e.id).join(",");
  if (key === lastTrashKey) return;
  lastTrashKey = key;
  els.trashList.replaceChildren(...state.trash.map(createTrashItem));
}

// ---------- 자동 분류 키워드 (PRD F18) ----------

function buildKeywordFields() {
  const rows = CATEGORIES.map(({ id, label }) => {
    const row = document.createElement("div");
    row.className = `field keyword-field chip--${id}`;
    const name = document.createElement("label");
    name.className = "field__label keyword-field__label";
    name.htmlFor = `keywords-${id}`;
    name.textContent = `${label} 키워드`;
    // 키워드가 많아도 다 보이게 여러 줄 칸 (TL-023)
    const input = document.createElement("textarea");
    input.className = "field__input keyword-field__input";
    input.id = `keywords-${id}`;
    input.rows = 3;
    input.dataset.category = id;
    input.autocomplete = "off";
    input.enterKeyHint = "done";
    input.placeholder = "쉼표로 구분 (예: 회의, 보고서)";
    row.append(name, input);
    return row;
  });
  els.keywordFields.append(...rows);
}

function renderAutoCategory(auto) {
  els.autoEnabled.checked = auto.enabled;
  els.keywordFields.disabled = !auto.enabled;
  const keywords = effectiveKeywords(auto);
  els.keywordFields.querySelectorAll("[data-category]").forEach((input) => {
    // 입력 중인 칸은 덮어쓰지 않아요.
    if (document.activeElement !== input) input.value = (keywords[input.dataset.category] ?? []).join(", ");
  });
  els.keywordsReset.hidden = auto.keywords === null;

  // 여러 카테고리에 같은 키워드가 있으면 어느 쪽이 쓰이는지 알려줘요.
  const conflicts = findKeywordConflicts(keywords);
  els.keywordConflicts.hidden = conflicts.length === 0;
  els.keywordConflicts.textContent = conflicts
    .map(({ keyword, categories }) => {
      const names = categories.map((c) => CATEGORY_LABELS[c]);
      return `'${keyword}'${withParticle(keyword, "은", "는").slice(keyword.length)} ${names.join("·")}에 모두 있어요. ${withParticle(names[0], "이", "가")} 우선이에요.`;
    })
    .join(" ");
}

// ---------- 내보내기·가져오기 ----------

function exportData() {
  const blob = new Blob([exportJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `task-manager-${todayKey()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  // 바로 해제하면 일부 브라우저(iOS Safari)에서 내려받기가 끊겨서 잠깐 뒤에 해제해요.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  notify("JSON 파일로 내보냈어요");
}

async function importData() {
  const file = els.importFile.files?.[0];
  els.importFile.value = ""; // 같은 파일을 다시 골라도 change가 일어나게
  if (!file) return;

  let next;
  try {
    next = parseImportText(await file.text());
  } catch (error) {
    notify(error.name === "ImportError" ? error.message : "파일을 읽지 못했어요.");
    return;
  }
  const now = summarize();
  const incoming = summarize(next);
  const ok = confirm(
    `지금 데이터(할 일 ${now.todos}개, 반복 일정 ${now.rules}개)를\n` +
      `가져온 파일(할 일 ${incoming.todos}개, 반복 일정 ${incoming.rules}개)로 바꿀까요?\n\n` +
      "지금 데이터는 백업해 두고, 바로 되돌릴 수 있어요.",
  );
  if (!ok) return;

  const { snapshot, backedUp } = importState(next);
  notify(backedUp ? "가져왔어요" : "가져왔어요 (백업할 공간이 부족해서 되돌리기만 가능해요)", {
    actionLabel: "되돌리기",
    onAction: () => {
      restoreSnapshot(snapshot);
      notify("가져오기 전으로 되돌렸어요");
    },
  });
}

// ---------- 휴지통 ----------

function createTrashItem(entry) {
  const li = document.createElement("li");
  li.className = "rule trash-item";

  const body = document.createElement("div");
  body.className = "rule__body";
  const text = document.createElement("span");
  text.className = "rule__text";
  text.textContent = entry.item.text;
  const meta = document.createElement("span");
  meta.className = "todo__meta";
  const kind = document.createElement("span");
  kind.className = "tag tag--paused";
  kind.textContent = entry.kind === "rule" ? "반복 일정" : "할 일";
  const badge = document.createElement("span");
  badge.className = `badge badge--${entry.item.category}`;
  badge.textContent = CATEGORY_LABELS[entry.item.category] ?? entry.item.category;
  const when = document.createElement("span");
  when.className = "rule__summary";
  when.textContent = `${formatMonthDay(toKey(new Date(entry.deletedAt)))} 삭제`;
  meta.append(kind, badge, when);
  body.append(text, meta);

  const restore = document.createElement("button");
  restore.type = "button";
  restore.className = "btn btn--small";
  restore.dataset.entryId = entry.id;
  restore.textContent = "복구";
  restore.setAttribute("aria-label", `복구: ${entry.item.text}`);

  li.append(body, restore);
  return li;
}

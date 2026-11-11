// 추가/수정 바텀 시트 (PRD F1·F2·F8, TRD 5.9).
// 시트 하나를 네 가지 모드로 열어요 (TL-015).
//   add        할 일 추가. 반복 줄 보임(기본: 안 함). 반복을 고르면 규칙이 만들어져요.
//   edit       할 일 수정. 반복 줄 숨김. 반복 할 일이면 안내 문구.
//   rule-add   반복 일정 관리의 '+ 새 반복 일정'. 반복 줄에서 '안 함'을 뺌.
//   rule-edit  반복 일정 수정. '안 함' 없음.

import {
  MAX_TEXT_LENGTH,
  CATEGORIES,
  REPEAT_CHOICES,
  WEEKDAY_LABELS,
  WEEKDAY_DISPLAY_ORDER,
  INPUT_DEBOUNCE_MS,
  CATEGORY_LABELS,
} from "../constants.js";
import { todayKey, weekdayOf } from "../core/date.js";
import { describeRepeat } from "../core/recurrence.js";
import { findDuplicateTodo, findDuplicateRule, withParticle } from "../core/text.js";
import { classify, effectiveKeywords } from "../core/classify.js";
import { debounce } from "../core/debounce.js";
import {
  getState,
  getTodo,
  getRule,
  addTodo,
  updateTodo,
  deleteTodo,
  addRule,
  updateRule,
  deleteRule,
} from "../store.js";

const TITLES = {
  add: "할 일 추가",
  edit: "할 일 수정",
  "rule-add": "새 반복 일정",
  "rule-edit": "반복 일정 수정",
};

let els = null;
let mode = "add";
let targetId = null; // 수정 중인 할 일 또는 규칙 id
let returnFocusTo = null;
let fallbackFocus = null;
let backgrounds = [];
let savedInert = [];
let onOpenRule = () => {};
let onDeleted = () => {};
let textSettledSoon = null; // 입력이 멈추면: 자동 분류 + 중복 확인 (디바운스)

// 키워드 자동 분류 (PRD F18, TL-023): 시트를 열 때마다 처음으로
let categoryTouched = false; // 이번에 카테고리 칩을 직접 눌렀는지 (누르면 자동 선택을 멈춰요)
let autoPick = null; // 자동으로 고른 결과 { category, keyword } 또는 null
let baseCategory = null; // 자동 선택이 풀릴 때 돌아갈 카테고리 (열 때의 기본값)

/**
 * @param {{ backgrounds: HTMLElement[], fallbackFocus: HTMLElement, onOpenRule: (ruleId: string) => void,
 *           onDeleted: (batchId: string, what: string) => void }} options
 *   backgrounds: 시트가 열린 동안 inert로 막을 뒤 화면들 (닫으면 원래 상태로 되돌려요)
 *   fallbackFocus: 닫을 때 원래 요소가 사라졌으면(삭제 등) 대신 포커스할 요소
 *   onOpenRule: 반복 안내 문구를 눌렀을 때 반복 일정 관리 화면을 여는 함수
 *   onDeleted: 지운 뒤 '되돌리기' 알림을 보여주는 함수 (PRD F17)
 */
export function initSheet(options) {
  backgrounds = options.backgrounds;
  fallbackFocus = options.fallbackFocus;
  onOpenRule = options.onOpenRule;
  onDeleted = options.onDeleted;
  textSettledSoon = debounce(() => {
    autoClassify();
    checkDuplicate();
  }, INPUT_DEBOUNCE_MS);
  els = {
    sheet: document.getElementById("todo-sheet"),
    backdrop: document.getElementById("sheet-backdrop"),
    form: document.getElementById("todo-form"),
    title: document.getElementById("sheet-title"),
    input: document.getElementById("todo-text"),
    count: document.getElementById("todo-count"),
    categories: document.getElementById("sheet-categories"),
    repeatField: document.getElementById("repeat-field"),
    repeatTypes: document.getElementById("repeat-types"),
    repeatDays: document.getElementById("repeat-days"),
    repeatNote: document.getElementById("repeat-note"),
    save: document.getElementById("sheet-save"),
    remove: document.getElementById("sheet-delete"),
    dupWarning: document.getElementById("dup-warning"),
    autoHint: document.getElementById("auto-category-hint"),
  };
  els.input.maxLength = MAX_TEXT_LENGTH;
  els.categories.replaceChildren(...CATEGORIES.map((c) => createChip("category", "radio", c.id, c.label, `chip--${c.id}`)));
  // 칩을 직접 누르면 그 선택이 우선이에요. 이번 시트에서는 더 이상 자동으로 바꾸지 않아요.
  els.categories.addEventListener("change", () => {
    categoryTouched = true;
    autoPick = null;
    els.autoHint.hidden = true;
  });
  els.repeatTypes.replaceChildren(...REPEAT_CHOICES.map((c) => createChip("repeat", "radio", c.id, c.label)));
  els.repeatDays.replaceChildren(
    ...WEEKDAY_DISPLAY_ORDER.map((d) => createChip("day", "checkbox", String(d), WEEKDAY_LABELS[d], "chip--day")),
  );

  els.input.addEventListener("input", () => {
    updateSaveState();
    textSettledSoon(); // 글자마다 하지 않고 입력이 멈추면 한 번 (디바운스)
  });
  els.input.addEventListener("keydown", (event) => {
    // 한글 조합 중 Enter는 글자 확정용이에요. 그때 저장되지 않게 막아요.
    if (event.key === "Enter" && event.isComposing) event.preventDefault();
  });
  els.repeatTypes.addEventListener("change", () => {
    onRepeatTypeChange();
    checkDuplicate(); // 반복을 고르면 비교 대상(할 일 / 반복 일정)이 달라져요
  });
  els.repeatDays.addEventListener("change", updateSaveState);
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!els.save.disabled && submit()) closeSheet();
  });
  els.remove.addEventListener("click", onDelete);
  els.repeatNote.addEventListener("click", (event) => {
    const link = event.target.closest("button[data-rule-id]");
    if (!link) return;
    const ruleId = link.dataset.ruleId;
    closeSheet({ restoreFocus: false });
    onOpenRule(ruleId);
  });
  els.backdrop.addEventListener("click", () => closeSheet());
  els.sheet.querySelectorAll("[data-sheet-close]").forEach((button) => {
    button.addEventListener("click", () => closeSheet());
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      closeSheet();
    }
  });
}

/**
 * @param {{ mode?: keyof TITLES, todo?: object, rule?: object, opener?: Element }} options
 *   opener: 닫은 뒤 포커스를 돌려줄 요소. 휴대폰에서는 탭해도 버튼에 포커스가 가지 않아서 직접 받아요.
 */
export function openSheet({ mode: nextMode = "add", todo = null, rule = null, opener = document.activeElement } = {}) {
  if (!TITLES[nextMode]) throw new Error(`알 수 없는 시트 모드예요: ${nextMode}`);
  if (nextMode === "edit" && !todo) throw new Error("수정할 할 일이 없어요");
  if (nextMode === "rule-edit" && !rule) throw new Error("수정할 반복 일정이 없어요");
  mode = nextMode;
  targetId = todo?.id ?? rule?.id ?? null;
  returnFocusTo = opener;

  els.form.reset();
  els.title.textContent = TITLES[mode];
  const source = todo ?? rule;
  els.input.value = source?.text ?? "";
  setRadio("category", source?.category ?? getState().settings.lastCategory);
  categoryTouched = false;
  autoPick = null;
  baseCategory = radioValue("category");
  els.autoHint.hidden = true;

  const isRuleMode = mode === "rule-add" || mode === "rule-edit";
  els.repeatField.hidden = mode === "edit";
  els.repeatTypes.querySelector('input[value="none"]').closest(".chip").hidden = isRuleMode;
  setRadio("repeat", rule?.repeat.type ?? (isRuleMode ? "daily" : "none"));
  setDays(rule?.repeat.days ?? []);
  updateDaysVisibility();
  renderRepeatNote(mode === "edit" ? todo : null);

  els.remove.hidden = !(mode === "edit" || mode === "rule-edit");
  updateSaveState();
  textSettledSoon.cancel();
  checkDuplicate();

  savedInert = backgrounds.map((el) => el.inert);
  backgrounds.forEach((el) => (el.inert = true));
  els.sheet.inert = false;
  els.sheet.classList.add("is-open");
  els.backdrop.classList.add("is-open");
  document.body.classList.add("is-sheet-open");
  // 휴대폰에서 키보드가 바로 올라오도록, 누른 이벤트 안에서 바로 포커스해요.
  els.input.focus();
  if (source) els.input.setSelectionRange(els.input.value.length, els.input.value.length);
}

export function closeSheet({ restoreFocus: shouldRestore = true } = {}) {
  if (!isOpen()) return;
  els.sheet.classList.remove("is-open");
  els.backdrop.classList.remove("is-open");
  els.sheet.inert = true;
  backgrounds.forEach((el, i) => (el.inert = savedInert[i] ?? false));
  document.body.classList.remove("is-sheet-open");
  textSettledSoon.cancel();
  if (shouldRestore) restoreFocus();
  returnFocusTo = null;
  targetId = null;
}

export function isSheetOpen() {
  return Boolean(els) && isOpen();
}

function submit() {
  // 입력하자마자 저장하면 자동 분류가 아직 안 돌았을 수 있어요. 기다리지 말고 지금 해요.
  textSettledSoon.flush();
  const text = els.input.value;
  const category = radioValue("category");
  // 자동으로 고른 카테고리는 다음 추가의 기본값을 바꾸지 않아요 (직접 고른 값만 기억)
  const remember = !autoPick;
  const repeatType = radioValue("repeat");
  const repeat = { type: repeatType, days: checkedDays() };

  switch (mode) {
    case "add":
      return repeatType === "none"
        ? addTodo(text, category, { remember })
        : addRule(text, category, repeat, { remember });
    case "edit":
      return updateTodo(targetId, { text, category });
    case "rule-add":
      return addRule(text, category, repeat, { remember });
    case "rule-edit":
      return updateRule(targetId, { text, category, repeat });
    default:
      return false;
  }
}

function onDelete() {
  if (mode === "edit") {
    const todo = getTodo(targetId);
    if (!todo) return closeSheet();
    if (confirm(`"${todo.text}"을(를) 삭제할까요?\n휴지통에서 되살릴 수 있어요.`)) {
      const batchId = deleteTodo(todo.id);
      closeSheet();
      onDeleted(batchId, `"${todo.text}"을(를)`);
    }
  } else if (mode === "rule-edit") {
    const rule = getRule(targetId);
    if (!rule) return closeSheet();
    if (confirm(`"${rule.text}" 반복 일정을 삭제할까요?\n이미 생긴 할 일은 남고, 휴지통에서 되살릴 수 있어요.`)) {
      const batchId = deleteRule(rule.id);
      closeSheet();
      onDeleted(batchId, `"${rule.text}" 반복 일정을`);
    }
  }
}

// 반복으로 생긴 할 일을 수정할 때의 안내 (TRD 5.9)
function renderRepeatNote(todo) {
  els.repeatNote.replaceChildren();
  els.repeatNote.hidden = !todo?.ruleId;
  if (!todo?.ruleId) return;

  const rule = getRule(todo.ruleId);
  if (!rule) {
    els.repeatNote.textContent = "🔁 삭제된 반복 일정에서 생긴 할 일";
    return;
  }
  const link = document.createElement("button");
  link.type = "button";
  link.className = "repeat-note__link";
  link.dataset.ruleId = rule.id;
  const summary = document.createElement("span");
  summary.textContent = `🔁 ${describeRepeat(rule.repeat)} 반복 · `;
  const action = document.createElement("strong");
  action.textContent = "반복 일정 관리에서 수정";
  link.append(summary, action);
  els.repeatNote.append(link);
}

/**
 * 키워드 자동 분류 (PRD F18, TL-023).
 * 추가할 때만(할 일 추가, 새 반복 일정) 하고, 칩을 직접 눌렀으면 하지 않아요.
 * 키워드가 없어지면(지우거나 고침) 열 때의 카테고리로 돌아가요.
 */
function autoClassify() {
  if (categoryTouched || !(mode === "add" || mode === "rule-add")) return;
  const auto = getState().settings.autoCategory;
  const result = auto.enabled ? classify(els.input.value, effectiveKeywords(auto)) : null;
  if (result) {
    setRadio("category", result.category);
    autoPick = result;
    els.autoHint.textContent = `'${result.keyword}' 키워드로 ${withParticle(CATEGORY_LABELS[result.category], "을", "를")} 골랐어요. 바꾸려면 칩을 누르세요.`;
    els.autoHint.hidden = false;
  } else if (autoPick) {
    setRadio("category", baseCategory);
    autoPick = null;
    els.autoHint.hidden = true;
  }
}

/**
 * 중복 확인 (PRD F16). 막지 않고 알려만 줘요(같은 일을 두 번 하는 경우도 있어서).
 * - 할 일: 오늘 미완료 목록에 같은 내용이 있으면
 * - 반복 일정(추가에서 반복을 고름, 반복 일정 화면): 같은 이름의 반복 일정이 있으면
 */
function checkDuplicate() {
  const text = els.input.value;
  const state = getState();
  const makesRule = mode === "rule-add" || mode === "rule-edit" || (mode === "add" && radioValue("repeat") !== "none");
  let message = null;
  if (makesRule) {
    const ruleExclude = mode === "rule-edit" ? targetId : null;
    if (findDuplicateRule(state.rules, text, { excludeId: ruleExclude })) {
      message = "같은 이름의 반복 일정이 이미 있어요. 그래도 저장할 수 있어요.";
    }
  }
  if (!message && mode !== "rule-edit") {
    const todoExclude = mode === "edit" ? targetId : null;
    if (findDuplicateTodo(state.todos, text, { date: todayKey(), excludeId: todoExclude })) {
      message = "오늘 목록에 같은 할 일이 이미 있어요. 그래도 저장할 수 있어요.";
    }
  }
  els.dupWarning.hidden = message === null;
  els.dupWarning.textContent = message ?? "";
}

function onRepeatTypeChange() {
  // 매주를 처음 고르면 오늘 요일을 미리 골라 둬요.
  if (radioValue("repeat") === "weekly" && checkedDays().length === 0) setDays([weekdayOf(todayKey())]);
  updateDaysVisibility();
  updateSaveState();
}

function updateDaysVisibility() {
  els.repeatDays.hidden = radioValue("repeat") !== "weekly";
}

// 저장하면 목록을 통째로 다시 그려서 원래 버튼이 새 요소로 바뀌어요. 같은 항목의 버튼을 다시 찾아요.
function restoreFocus() {
  if (returnFocusTo?.isConnected) return returnFocusTo.focus();
  const id = returnFocusTo?.closest?.("[data-id]")?.dataset.id ?? targetId;
  const action = returnFocusTo?.dataset?.action ?? "edit";
  const same = id && document.querySelector(`[data-id="${CSS.escape(id)}"] [data-action="${action}"]`);
  (same ?? fallbackFocus)?.focus();
}

function isOpen() {
  return els.sheet.classList.contains("is-open");
}

function createChip(name, type, value, label, modifier = "") {
  const wrapper = document.createElement("label");
  wrapper.className = `chip ${modifier}`.trim();
  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.value = value;
  input.className = "chip__input";
  const text = document.createElement("span");
  text.className = "chip__label";
  text.textContent = label;
  wrapper.append(input, text);
  return wrapper;
}

function setRadio(name, value) {
  const group = els.form.elements[name];
  group.value = value;
  if (!group.value) els.form.querySelector(`input[name="${name}"]:not([hidden])`).checked = true;
}

function radioValue(name) {
  return els.form.elements[name].value;
}

function setDays(days) {
  els.repeatDays.querySelectorAll("input").forEach((input) => {
    input.checked = days.includes(Number(input.value));
  });
}

function checkedDays() {
  return [...els.repeatDays.querySelectorAll("input:checked")].map((input) => Number(input.value));
}

function updateSaveState() {
  const length = els.input.value.length;
  els.count.textContent = String(length);
  const emptyText = els.input.value.trim() === "" || length > MAX_TEXT_LENGTH;
  const weeklyWithoutDays = !els.repeatField.hidden && radioValue("repeat") === "weekly" && checkedDays().length === 0;
  els.save.disabled = emptyText || weeklyWithoutDays;
}

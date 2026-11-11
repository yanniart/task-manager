// 반복 일정 관리 화면 (PRD F8). 헤더의 ☰로 열어요.
// 규칙 목록, 수정(탭)·일시정지·삭제, '+ 새 반복 일정'.
// 다른 ui 모듈(시트)은 직접 부르지 않고 render.js가 넘겨준 함수로 열어요.

import { CATEGORY_LABELS } from "../constants.js";
import { describeRepeat } from "../core/recurrence.js";
import { getRule, setRulePaused, deleteRule } from "../store.js";

let els = null;
let callbacks = null;
let returnFocusTo = null;

/**
 * @param {{ background: HTMLElement, fallbackFocus: HTMLElement,
 *           onEditRule: (rule, opener) => void, onNewRule: (opener) => void,
 *           onDeleted: (batchId: string, what: string) => void }} options
 *   onDeleted: 지운 뒤 '되돌리기' 알림을 보여주는 함수 (PRD F17)
 *   fallbackFocus: 닫을 때 연 버튼을 모르면 포커스할 요소 (헤더의 ☰)
 */
export function initRulesView(options) {
  callbacks = options;
  els = {
    background: options.background,
    view: document.getElementById("rules-view"),
    close: document.getElementById("rules-close"),
    list: document.getElementById("rule-list"),
    empty: document.getElementById("rules-empty"),
    add: document.getElementById("rules-add"),
  };

  els.close.addEventListener("click", closeRulesView);
  els.add.addEventListener("click", () => callbacks.onNewRule(els.add));
  // 시트가 열려 있으면 포커스가 시트에 있어서 여기까지 오지 않아요. 그래서 Esc는 맨 위 화면만 닫아요.
  els.view.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRulesView();
    }
  });

  els.list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const rule = getRule(button.closest("[data-id]")?.dataset.id);
    if (!rule) return;

    if (button.dataset.action === "edit-rule") {
      callbacks.onEditRule(rule, button);
    } else if (button.dataset.action === "pause-rule") {
      setRulePaused(rule.id, !rule.paused);
      focusInRule(rule.id, "pause-rule"); // 다시 그려져도 같은 버튼에 포커스
    } else if (button.dataset.action === "delete-rule") {
      if (confirm(`"${rule.text}" 반복 일정을 삭제할까요?\n이미 생긴 할 일은 남고, 휴지통에서 되살릴 수 있어요.`)) {
        const batchId = deleteRule(rule.id);
        els.add.focus();
        callbacks.onDeleted?.(batchId, `"${rule.text}" 반복 일정을`);
      }
    }
  });
}

/** @param {{ highlightId?: string, opener?: Element }} options */
export function openRulesView({ highlightId = null, opener = null } = {}) {
  returnFocusTo = opener;
  els.view.hidden = false;
  els.background.inert = true;
  document.body.classList.add("is-rules-open");
  els.view.scrollTop = 0;

  const target = highlightId && els.list.querySelector(`[data-id="${CSS.escape(highlightId)}"]`);
  if (target) {
    target.classList.remove("rule--highlight");
    void target.offsetWidth; // 애니메이션 다시 시작
    target.classList.add("rule--highlight");
    target.scrollIntoView({ block: "center" });
    target.querySelector('[data-action="edit-rule"]').focus();
  } else {
    els.close.focus();
  }
}

export function closeRulesView() {
  if (els.view.hidden) return;
  els.view.hidden = true;
  els.background.inert = false;
  document.body.classList.remove("is-rules-open");
  els.list.querySelectorAll(".rule--highlight").forEach((el) => el.classList.remove("rule--highlight"));
  (returnFocusTo?.isConnected ? returnFocusTo : callbacks.fallbackFocus)?.focus();
  returnFocusTo = null;
}

let lastRulesKey = null;

/** 규칙이 바뀌었을 때만 목록을 다시 만들어요 (할 일만 바뀔 때는 그대로, TL-021). */
export function renderRules(rules) {
  const key = JSON.stringify(rules);
  if (key === lastRulesKey) return;
  lastRulesKey = key;
  // 다시 만들어도 보던 버튼에 포커스가 남게 (예: 일시정지 버튼)
  const focused = document.activeElement?.closest?.("#rule-list [data-id]");
  const focusedId = focused?.dataset.id ?? null;
  const focusedAction = focusedId ? document.activeElement.dataset.action : null;
  els.list.replaceChildren(...rules.map(createRuleItem));
  els.empty.hidden = rules.length > 0;
  if (focusedId && focusedAction) focusInRule(focusedId, focusedAction);
}

function createRuleItem(rule) {
  const li = document.createElement("li");
  li.className = "rule" + (rule.paused ? " rule--paused" : "");
  li.dataset.id = rule.id;

  const body = document.createElement("button");
  body.type = "button";
  body.className = "rule__body";
  body.dataset.action = "edit-rule";
  const text = document.createElement("span");
  text.className = "rule__text";
  text.textContent = rule.text;
  const meta = document.createElement("span");
  meta.className = "todo__meta";
  const summary = document.createElement("span");
  summary.className = "rule__summary";
  summary.textContent = `🔁 ${describeRepeat(rule.repeat)}`;
  meta.append(createCategoryBadge(rule.category), summary);
  if (rule.paused) {
    const paused = document.createElement("span");
    paused.className = "tag tag--paused";
    paused.textContent = "일시정지됨";
    meta.append(paused);
  }
  body.append(text, meta);

  const pause = document.createElement("button");
  pause.type = "button";
  pause.className = "btn btn--small";
  pause.dataset.action = "pause-rule";
  pause.textContent = rule.paused ? "다시 시작" : "일시정지";
  pause.setAttribute("aria-label", `${pause.textContent}: ${rule.text}`);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn--small btn--danger";
  remove.dataset.action = "delete-rule";
  remove.textContent = "삭제";
  remove.setAttribute("aria-label", `삭제: ${rule.text}`);

  li.append(body, pause, remove);
  return li;
}

// todo-item.js의 배지와 같은 모양 (ui 모듈끼리 직접 부르지 않으려고 따로 둬요)
function createCategoryBadge(category) {
  const badge = document.createElement("span");
  badge.className = `badge badge--${category}`;
  badge.textContent = CATEGORY_LABELS[category] ?? category;
  return badge;
}

function focusInRule(id, action) {
  els.list.querySelector(`[data-id="${CSS.escape(id)}"] [data-action="${action}"]`)?.focus();
}

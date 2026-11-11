// 할 일 한 줄(<li>) 만들기. 사용자 글은 textContent / setAttribute로만 넣어요 (TRD 7장).
// 클릭 처리는 여기서 하지 않고, render.js가 목록 부모에서 data-action으로 받아요 (이벤트 위임).

import { CATEGORY_LABELS } from "../constants.js";
import { formatMonthDay } from "../core/date.js";
import { findMatchRanges } from "../core/text.js";

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
  '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ⠿ 손잡이: 글꼴마다 점자 문자가 다르게 보여서 점 6개를 직접 그려요.
const HANDLE_ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor">' +
  '<circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/>' +
  '<circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/>' +
  '<circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>';

/**
 * @param {object} todo
 * @param {{ draggable?: boolean, terms?: string[] }} options
 *   draggable: 순서를 바꿀 수 있는 미완료 항목이면 손잡이를 달아요 (PRD F10).
 *   terms: 검색 낱말. 맞는 부분을 <mark>로 강조해요 (PRD F13).
 */
export function createTodoItem(todo, { draggable = false, terms = [] } = {}) {
  const li = document.createElement("li");
  li.className = "todo" + (todo.done ? " todo--done" : "");
  li.dataset.id = todo.id;

  const check = document.createElement("button");
  check.type = "button";
  check.className = "todo__check";
  check.dataset.action = "toggle";
  check.setAttribute("aria-pressed", String(todo.done));
  check.setAttribute("aria-label", `완료: ${todo.text}`);
  check.innerHTML = CHECK_ICON; // 고정된 아이콘만. 사용자 데이터 아님.

  // 내용을 탭하면 수정 시트가 열려요 (PRD F2).
  const body = document.createElement("button");
  body.type = "button";
  body.className = "todo__body";
  body.dataset.action = "edit";

  const text = document.createElement("span");
  text.className = "todo__text";
  appendHighlighted(text, todo.text, terms);

  const meta = document.createElement("span");
  meta.className = "todo__meta";
  meta.append(createCategoryBadge(todo.category));
  if (todo.ruleId) meta.append(createTag("tag--repeat", "🔁", "반복"));
  if (todo.carriedFrom) meta.append(createTag("tag--carried", `이월 ${formatMonthDay(todo.carriedFrom)}`));

  body.append(text, meta);
  li.append(check, body);

  if (draggable) {
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "todo__handle";
    handle.dataset.action = "drag";
    handle.setAttribute("aria-label", `순서 바꾸기: ${todo.text}`);
    handle.setAttribute("aria-describedby", "drag-hint");
    handle.innerHTML = HANDLE_ICON; // 고정된 아이콘만. 사용자 데이터 아님.
    li.append(handle);
  }
  return li;
}

function createCategoryBadge(category) {
  const badge = document.createElement("span");
  badge.className = `badge badge--${category}`;
  badge.textContent = CATEGORY_LABELS[category] ?? category;
  return badge;
}

/** 작은 표시. srText가 있으면 visible은 화면용(읽지 않음), srText는 화면 읽기 프로그램용이에요. */
function createTag(modifier, visible, srText) {
  const tag = document.createElement("span");
  tag.className = `tag ${modifier}`;
  if (!srText) {
    tag.textContent = visible;
    return tag;
  }
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = visible;
  const label = document.createElement("span");
  label.className = "sr-only";
  label.textContent = srText;
  tag.append(icon, label);
  return tag;
}

/** 검색어와 맞는 부분만 <mark>로 감싸요. 모두 글자 노드로 넣어서 사용자 글이 HTML로 해석되지 않아요. */
function appendHighlighted(parent, text, terms) {
  const ranges = findMatchRanges(text, terms);
  if (ranges.length === 0) {
    parent.textContent = text;
    return;
  }
  const source = text.normalize("NFC");
  let cursor = 0;
  for (const { start, end } of ranges) {
    if (start > cursor) parent.append(source.slice(cursor, start));
    const mark = document.createElement("mark");
    mark.className = "todo__match";
    mark.textContent = source.slice(start, end);
    parent.append(mark);
    cursor = end;
  }
  if (cursor < source.length) parent.append(source.slice(cursor));
}

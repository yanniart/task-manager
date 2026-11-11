// 정렬 아이콘과 메뉴 (PRD F14, TL-022). 필터 탭 아래 목록 오른쪽 위에 있어요.
// - 직접 정렬(기본)일 때는 아이콘만, 다른 정렬이면 아이콘을 파랑으로 바꾸고 정렬 이름을 옆에 붙여요.
// - 누르면 작은 메뉴(4가지). ↑/↓·Home·End로 고르고 Enter, Esc·바깥 누르기·Tab으로 닫혀요.

import { SORT_OPTIONS } from "../constants.js";

const CHECK =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" ' +
  'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let els = null;
let onSelect = () => {};
let current = "manual";

/** @param {{ onSelect: (sortId: string) => void }} options */
export function initSortMenu(options) {
  onSelect = options.onSelect;
  els = {
    button: document.getElementById("sort-button"),
    label: document.getElementById("sort-label"),
    menu: document.getElementById("sort-menu"),
  };
  els.menu.replaceChildren(...SORT_OPTIONS.map(createItem));

  els.button.addEventListener("click", () => (isOpen() ? close() : open()));
  els.button.addEventListener("keydown", (event) => {
    // 메뉴 버튼 관례: ↓/↑로도 열고 첫·마지막 항목으로
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open(event.key === "ArrowDown" ? "first" : "last");
    }
  });
  els.menu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-sort]");
    if (item) choose(item.dataset.sort);
  });
  els.menu.addEventListener("keydown", onMenuKey);
  // 메뉴 밖을 누르면 닫혀요.
  document.addEventListener("pointerdown", (event) => {
    if (isOpen() && !event.target.closest(".sort-control")) close({ focusButton: false });
  });
}

/** render.js가 상태가 바뀔 때마다 불러요. */
export function renderSortMenu(sort) {
  current = sort;
  const option = SORT_OPTIONS.find((o) => o.id === sort) ?? SORT_OPTIONS[0];
  const manual = sort === "manual";
  els.button.classList.toggle("is-active", !manual);
  els.label.hidden = manual;
  els.label.textContent = manual ? "" : option.label;
  els.button.setAttribute(
    "aria-label",
    manual ? "정렬: 직접 정렬" : `정렬: ${option.label}. 이 정렬에서는 순서를 옮길 수 없어요`,
  );
  els.menu.querySelectorAll("[data-sort]").forEach((item) => {
    item.setAttribute("aria-checked", String(item.dataset.sort === sort));
  });
}

function createItem({ id, label, hint }) {
  const li = document.createElement("li");
  li.setAttribute("role", "none");
  const item = document.createElement("button");
  item.type = "button";
  item.className = "sort-menu__item";
  item.dataset.sort = id;
  item.setAttribute("role", "menuitemradio");
  item.setAttribute("aria-checked", "false");
  item.tabIndex = -1;
  const check = document.createElement("span");
  check.className = "sort-menu__check";
  check.innerHTML = CHECK; // 고정된 아이콘만
  const text = document.createElement("span");
  text.className = "sort-menu__text";
  const name = document.createElement("span");
  name.className = "sort-menu__label";
  name.textContent = label;
  const desc = document.createElement("span");
  desc.className = "sort-menu__hint";
  desc.textContent = hint;
  text.append(name, desc);
  item.append(check, text);
  li.append(item);
  return li;
}

function items() {
  return [...els.menu.querySelectorAll("[data-sort]")];
}

function isOpen() {
  return !els.menu.hidden;
}

/** @param {"current" | "first" | "last"} focusTarget 열고 나서 포커스할 항목 */
function open(focusTarget = "current") {
  els.menu.hidden = false;
  els.button.setAttribute("aria-expanded", "true");
  const list = items();
  const target =
    focusTarget === "first" ? list[0] : focusTarget === "last" ? list.at(-1) : list.find((i) => i.dataset.sort === current);
  (target ?? list[0]).focus();
}

function close({ focusButton = true } = {}) {
  if (!isOpen()) return;
  els.menu.hidden = true;
  els.button.setAttribute("aria-expanded", "false");
  if (focusButton) els.button.focus();
}

function choose(sortId) {
  close();
  if (sortId !== current) onSelect(sortId);
}

function onMenuKey(event) {
  const list = items();
  const index = list.indexOf(document.activeElement);
  const focusAt = (i) => list[(i + list.length) % list.length].focus();
  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      focusAt(index + 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      focusAt(index - 1);
      break;
    case "Home":
      event.preventDefault();
      focusAt(0);
      break;
    case "End":
      event.preventDefault();
      focusAt(list.length - 1);
      break;
    case "Escape":
      event.preventDefault();
      event.stopPropagation();
      close();
      break;
    case "Tab":
      close({ focusButton: false });
      break;
    default:
  }
}

// 검색창 (PRD F13, TL-021). 헤더의 🔍로 열고 닫아요.
// 입력은 디바운스(150ms)해서 글자마다 목록을 다시 그리지 않아요. Enter는 기다리지 않고 바로 찾아요.
// 검색어는 저장하지 않아요(새로고침하면 사라짐).

import { INPUT_DEBOUNCE_MS } from "../constants.js";
import { debounce } from "../core/debounce.js";

let els = null;
let onQuery = () => {};
let emit = null;

/** @param {{ onQuery: (query: string) => void }} options */
export function initSearchBar(options) {
  onQuery = options.onQuery;
  els = {
    toggle: document.getElementById("search-button"),
    bar: document.getElementById("search-bar"),
    input: document.getElementById("search-input"),
    close: document.getElementById("search-close"),
  };
  emit = debounce((value) => onQuery(value), INPUT_DEBOUNCE_MS);

  els.toggle.addEventListener("click", () => (els.bar.hidden ? openSearch() : closeSearch()));
  els.close.addEventListener("click", closeSearch);
  els.input.addEventListener("input", () => emit(els.input.value));
  els.input.addEventListener("keydown", (event) => {
    if (event.isComposing) return; // 한글 조합 중 Enter·Esc는 글자 확정용
    if (event.key === "Enter") {
      event.preventDefault();
      emit(els.input.value);
      emit.flush();
    } else if (event.key === "Escape") {
      event.preventDefault();
      // 글자가 있으면 지우기만, 비어 있으면 닫기
      if (els.input.value) {
        els.input.value = "";
        emit.cancel();
        onQuery("");
      } else {
        closeSearch();
      }
    }
  });
}

export function openSearch() {
  els.bar.hidden = false;
  els.toggle.setAttribute("aria-expanded", "true");
  els.toggle.classList.add("is-active");
  els.input.focus();
}

/** 닫으면 검색어도 지워서 전체 목록으로 돌아가요. */
export function closeSearch() {
  emit.cancel();
  els.input.value = "";
  els.bar.hidden = true;
  els.toggle.setAttribute("aria-expanded", "false");
  els.toggle.classList.remove("is-active");
  onQuery("");
  els.toggle.focus();
}

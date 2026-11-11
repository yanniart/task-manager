// 화면 모드 (PRD F12, TL-019).
// 저장하는 값(theme)은 "system" | "light" | "dark"이고, 화면에 적용하는 값은 <html data-theme="light|dark"> 둘 중 하나예요.
// "system"이면 시스템 설정(prefers-color-scheme)을 보고 정하고, 시스템 설정이 바뀌면 바로 따라가요.
// index.html 머리의 인라인 스크립트가 같은 규칙으로 첫 화면을 미리 맞춰 둬요(깜빡임 방지).

import { THEME_IDS } from "../constants.js";

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

// 버튼에는 '지금 모드'를 아이콘으로 보여줘요. 고정된 SVG만 innerHTML로 넣어요(사용자 데이터 아님).
const ICONS = {
  // 반쪽 원: 시스템 설정을 따름
  system:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  // 해: 라이트
  light:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  // 달: 다크
  dark:
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linejoin="round"/></svg>',
};

const NAMES = { system: "시스템 설정", light: "라이트", dark: "다크" };
const DONE_MESSAGES = {
  system: "화면 모드: 시스템 설정을 따라가요",
  light: "화면 모드: 라이트로 바꿨어요",
  dark: "화면 모드: 다크로 바꿨어요",
};

let current = "system";
let button = null;

/** 다음 모드: 시스템 → 라이트 → 다크 → 시스템 */
export function nextTheme(theme) {
  const index = THEME_IDS.indexOf(theme);
  return THEME_IDS[(index + 1) % THEME_IDS.length];
}

/** @param {{ button: HTMLButtonElement, onChange: (theme: string) => void }} options */
export function initTheme(options) {
  button = options.button;
  // theme-color(주소창 색)의 원래 값을 기억해 둬요. "시스템"으로 돌아올 때 되돌려요.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.dataset.original = meta.content;
  });
  button.addEventListener("click", () => options.onChange(nextTheme(current)));
  // 시스템 설정이 바뀌면 "시스템" 모드일 때만 바로 따라가요.
  darkQuery.addEventListener("change", () => {
    if (current === "system") apply();
  });
}

/** render가 매번 불러요. 바뀐 게 없으면 아무 일도 하지 않아요. */
export function applyTheme(theme) {
  const changed = theme !== current;
  current = theme;
  apply();
  updateButton();
  return changed;
}

export function themeMessage(theme) {
  return DONE_MESSAGES[theme];
}

function apply() {
  const dark = current === "dark" || (current === "system" && darkQuery.matches);
  const resolved = dark ? "dark" : "light";
  if (document.documentElement.dataset.theme !== resolved) document.documentElement.dataset.theme = resolved;

  // 직접 고른 모드면 주소창 색도 그 바탕색으로, 시스템이면 원래 두 값(라이트·다크)으로
  const canvas = getComputedStyle(document.documentElement).getPropertyValue("--color-canvas").trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.content = current === "system" ? meta.dataset.original : canvas;
  });
}

function updateButton() {
  if (!button || button.dataset.theme === current) return;
  button.dataset.theme = current;
  button.innerHTML = ICONS[current];
  const label = `화면 모드: ${NAMES[current]} (누르면 ${NAMES[nextTheme(current)]})`;
  button.setAttribute("aria-label", label);
  button.title = label;
}

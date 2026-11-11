// 날짜는 로컬 시간 기준 'YYYY-MM-DD' 문자열로 다뤄요 (TRD 5.1, TL-005).
// toISOString()은 UTC라서 한국 시간 오전 9시 전에는 어제 날짜가 나오므로 날짜 키에 쓰지 않아요.

import { WEEKDAY_LABELS } from "../constants.js";

const pad2 = (n) => String(n).padStart(2, "0");
const KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 개발용 ?today=YYYY-MM-DD (TL-014). main.js가 개발 주소에서만 켜요.
let todayOverride = null;

/** Date → 로컬 'YYYY-MM-DD' */
export function toKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 오늘 날짜 키. now를 넘기면 그 시각 기준(테스트용), 안 넘기면 지금(개발용 날짜가 켜져 있으면 그 날짜). */
export function todayKey(now) {
  if (now === undefined && todayOverride) return todayOverride;
  return toKey(now ?? new Date());
}

/** 'YYYY-MM-DD' → 그날 로컬 자정의 Date */
export function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 형식도 맞고 실제로 있는 날짜인지 (2026-02-30 같은 건 false) */
export function isValidKey(key) {
  return typeof key === "string" && KEY_PATTERN.test(key) && toKey(fromKey(key)) === key;
}

/** 0(일) ~ 6(토) */
export function weekdayOf(key) {
  return fromKey(key).getDay();
}

/** a < b 이면 음수, 같으면 0, a > b 이면 양수. 'YYYY-MM-DD'는 문자열 비교가 곧 날짜 비교예요. */
export function compareKeys(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** 헤더용 짧은 표시: '11.11(수)' */
export function formatHeaderDate(key) {
  const date = fromKey(key);
  return `${date.getMonth() + 1}.${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`;
}

/** 이월 표시용: '11/10' */
export function formatMonthDay(key) {
  const date = fromKey(key);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** 다음 로컬 자정까지 남은 밀리초 (자정 이월 예약용) */
export function msUntilNextMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** 개발용 날짜 고정. null이면 해제. 잘못된 날짜면 false. */
export function setTodayOverride(key) {
  if (key !== null && !isValidKey(key)) return false;
  todayOverride = key;
  return true;
}

export function isTodayOverridden() {
  return todayOverride !== null;
}

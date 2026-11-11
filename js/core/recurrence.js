// 반복 규칙 판단 (TRD 5.3, TL-006).

import { REPEAT_TYPE_IDS, WEEKDAY_LABELS, WEEKDAY_DISPLAY_ORDER } from "../constants.js";
import { weekdayOf } from "./date.js";

/** 규칙이 그 날짜에 해당하는지. 일시정지 여부는 보지 않아요 (rollover가 따로 봐요). */
export function matches(rule, dateKey) {
  const day = weekdayOf(dateKey);
  switch (rule.repeat?.type) {
    case "daily":
      return true;
    case "weekdays":
      return day >= 1 && day <= 5;
    case "weekly":
      return Array.isArray(rule.repeat.days) && rule.repeat.days.includes(day);
    default:
      return false;
  }
}

/**
 * 입력받은 반복 설정을 저장 형식으로 정리해요. 잘못됐으면 null.
 * weekly는 요일이 하나 이상 있어야 하고, 요일은 0~6 정수를 중복 없이 0(일)부터 정렬해 둬요.
 */
export function normalizeRepeat(repeat) {
  if (!repeat || !REPEAT_TYPE_IDS.includes(repeat.type)) return null;
  if (repeat.type !== "weekly") return { type: repeat.type, days: [] };
  const days = [...new Set((repeat.days ?? []).map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  return days.length > 0 ? { type: "weekly", days } : null;
}

/** 사람이 읽는 요약: '매일', '평일', '매주 월·수' (월요일부터) */
export function describeRepeat(repeat) {
  switch (repeat?.type) {
    case "daily":
      return "매일";
    case "weekdays":
      return "평일";
    case "weekly": {
      const days = WEEKDAY_DISPLAY_ORDER.filter((d) => repeat.days?.includes(d));
      return `매주 ${days.map((d) => WEEKDAY_LABELS[d]).join("·")}`;
    }
    default:
      return "";
  }
}

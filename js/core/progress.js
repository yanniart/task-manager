// 진행률 계산 (PRD F6). 오늘 날짜의 할 일만 세요. 필터와는 상관없어요.

import { CATEGORY_IDS } from "../constants.js";

/**
 * @returns {{ total: number, done: number, percent: number, isComplete: boolean,
 *             byCategory: Record<string, { total: number, done: number }> }}
 */
export function calcProgress(todos, today) {
  const byCategory = Object.fromEntries(CATEGORY_IDS.map((id) => [id, { total: 0, done: 0 }]));
  let total = 0;
  let done = 0;

  for (const todo of todos) {
    if (todo.date !== today) continue;
    total += 1;
    if (todo.done) done += 1;
    const bucket = byCategory[todo.category];
    if (bucket) {
      bucket.total += 1;
      if (todo.done) bucket.done += 1;
    }
  }

  return { total, done, percent: toPercent(done, total), isComplete: total > 0 && done === total, byCategory };
}

/** 반올림하되, 다 끝내지 않았으면 100%로 보이지 않게 99%에서 멈춰요 (예: 199/200). */
export function toPercent(done, total) {
  if (total === 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.round((done / total) * 100));
}

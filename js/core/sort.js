// 보기 정렬 (PRD F14, TL-021).
// 정렬은 '보는 순서'만 바꿔요. 저장된 order(드래그 순서)는 건드리지 않아서 '직접 정렬'로 돌아오면 그대로예요.

import { CATEGORY_IDS } from "../constants.js";

/**
 * @param {object[]} active 오늘의 미완료 (order 순으로 넘겨 주세요)
 * @param {object[]} done   오늘의 완료 (완료 시각 최신순으로 넘겨 주세요)
 * @param {"manual" | "created" | "category" | "status"} mode
 * @returns {{ merged: boolean, active: object[], done: object[] }}
 *   merged가 true면(완료 상태순) active에 미완료 → 완료를 합친 한 목록이 들어 있고 done은 비어 있어요.
 */
export function sortForView(active, done, mode) {
  switch (mode) {
    case "created":
      return { merged: false, active: byCreated(active), done: byCreated(done) };
    case "category":
      return { merged: false, active: byCategory(active), done: byCategory(done) };
    case "status":
      return { merged: true, active: [...active, ...done], done: [] };
    default:
      return { merged: false, active: [...active], done: [...done] };
  }
}

/** 만든 순서(오래된 것부터). 시각이 같으면 원래 순서 유지 */
function byCreated(list) {
  return list
    .map((todo, index) => ({ todo, index }))
    .sort((a, b) => (a.todo.createdAt ?? "").localeCompare(b.todo.createdAt ?? "") || a.index - b.index)
    .map(({ todo }) => todo);
}

/** 업무 → 개인 → 공부. 같은 카테고리 안에서는 원래 순서 유지 */
function byCategory(list) {
  const rank = (todo) => {
    const i = CATEGORY_IDS.indexOf(todo.category);
    return i === -1 ? CATEGORY_IDS.length : i;
  };
  return list
    .map((todo, index) => ({ todo, index }))
    .sort((a, b) => rank(a.todo) - rank(b.todo) || a.index - b.index)
    .map(({ todo }) => todo);
}

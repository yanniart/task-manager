// 휴지통 (PRD F17, TL-021). 지운 할 일·반복 일정을 잠시 보관했다가 되살릴 수 있게 해요.
// 항목: { id, kind: "todo" | "rule", item, deletedAt(ISO), batchId }
//   batchId: 한 번에 지운 묶음(예: 완료한 항목 모두 지우기). '되돌리기'는 묶음 단위로 되살려요.

import { TRASH_KEEP_DAYS, TRASH_MAX } from "../constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 지운 것들을 휴지통 맨 앞(최근)에 넣은 새 배열 */
export function addToTrash(trash, kind, items, { batchId, now, createId }) {
  const entries = items.map((item) => ({ id: createId(), kind, item, deletedAt: now, batchId }));
  return purgeTrash([...entries, ...trash], now);
}

/** 오래된 것(보관 기간 지남)과 너무 많은 것(최대 개수 넘음)을 뺀 새 배열. 최근 것이 앞이에요. */
export function purgeTrash(trash, now) {
  const limit = new Date(now).getTime() - TRASH_KEEP_DAYS * DAY_MS;
  return trash
    .filter((entry) => new Date(entry.deletedAt).getTime() >= limit)
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
    .slice(0, TRASH_MAX);
}

/** 휴지통 항목을 꺼내요: { picked, rest } */
export function takeFromTrash(trash, predicate) {
  const picked = [];
  const rest = [];
  for (const entry of trash) (predicate(entry) ? picked : rest).push(entry);
  return { picked, rest };
}

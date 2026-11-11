// 오늘의 미완료 목록 순서 정하기 (TRD 5.4, TL-011).
// 배열 순서를 먼저 정한 뒤 renumber()로 order를 0, 1, 2…로 다시 매겨요.
// insertNew / appendLast / move 는 새 배열을 돌려주고 받은 배열은 바꾸지 않아요.

/** 맨 위에서부터 '연속으로' 이어진 이월 항목 수 = 새 할 일이 들어갈 자리 */
export function insertIndex(list) {
  let i = 0;
  while (i < list.length && list[i].carriedFrom != null) i += 1;
  return i;
}

/** 새 할 일·반복 생성분을 이월 항목 바로 아래에 끼워 넣어요. */
export function insertNew(list, todo) {
  const at = insertIndex(list);
  return [...list.slice(0, at), todo, ...list.slice(at)];
}

/** index 자리에 끼워 넣어요(범위를 벗어나면 끝으로). 휴지통에서 되살릴 때 원래 자리로 돌려놓는 데 써요. */
export function insertAt(list, todo, index) {
  const at = Math.max(0, Math.min(Number.isFinite(index) ? index : list.length, list.length));
  return [...list.slice(0, at), todo, ...list.slice(at)];
}

/** 맨 아래에 붙여요. 완료를 취소했을 때 써요. */
export function appendLast(list, todo) {
  return [...list, todo];
}

/** from 자리의 항목을 to 자리로 옮겨요 (드래그 결과 반영). 범위를 벗어나면 끝으로 맞춰요. */
export function move(list, from, to) {
  if (from < 0 || from >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  const target = Math.max(0, Math.min(to, next.length));
  next.splice(target, 0, item);
  return next;
}

/**
 * 필터가 켜져 있을 때의 이동 (TRD 5.6).
 * 보이는 항목들이 원래 차지하던 자리 안에서만 섞고, 안 보이는 항목은 제자리에 그대로 둬요.
 * from, to는 '보이는 항목들' 안에서의 위치예요. 필터가 꺼져 있으면(모두 보임) move와 같아요.
 */
export function moveVisible(list, isVisible, from, to) {
  const slots = [];
  list.forEach((todo, index) => {
    if (isVisible(todo)) slots.push(index);
  });
  const visible = slots.map((index) => list[index]);
  const reordered = move(visible, from, to);
  const next = [...list];
  slots.forEach((slot, i) => {
    next[slot] = reordered[i];
  });
  return next;
}

/** 배열 순서대로 order = 0, 1, 2… 로 매겨요. 항목 객체의 order를 직접 바꾸고 같은 배열을 돌려줘요. */
export function renumber(list) {
  list.forEach((todo, index) => {
    todo.order = index;
  });
  return list;
}

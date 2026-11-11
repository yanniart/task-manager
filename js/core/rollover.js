// 날짜가 바뀔 때 이월·반복 생성 (TRD 5.2, TL-006, TL-011).
// 받은 state는 바꾸지 않고 새 state를 돌려줘요. 같은 날 여러 번 불러도 결과가 같아요 (멱등성).

import { compareKeys } from "./date.js";
import { matches } from "./recurrence.js";
import { insertNew, renumber } from "./order.js";
import { createId as defaultCreateId } from "./id.js";

/**
 * @param {object} state  { todos, rules, settings }
 * @param {string} today  'YYYY-MM-DD'
 * @param {{ createId?: () => string, now?: () => string }} deps 테스트에서 id·시각을 고정할 때만 넘겨요.
 * @returns {{ state: object, changed: boolean }}
 */
export function runRollover(state, today, deps = {}) {
  const createId = deps.createId ?? defaultCreateId;
  const now = deps.now ?? (() => new Date().toISOString());

  const next = structuredClone(state);
  const isPast = (todo) => compareKeys(todo.date, today) < 0;

  // 2) 지난 날짜의 미완료 반복 할 일은 지워요. 오늘 몫이 새로 생기기 때문이에요.
  next.todos = next.todos.filter((todo) => !(isPast(todo) && !todo.done && todo.ruleId != null));

  // 1) 지난 날짜의 미완료 일반 할 일은 오늘로 옮겨서 맨 위에 둬요 (원래 날짜 오래된 순, 같으면 기존 순서).
  const todayActive = next.todos
    .filter((todo) => todo.date === today && !todo.done)
    .sort((a, b) => a.order - b.order);
  const carried = next.todos
    .filter((todo) => isPast(todo) && !todo.done)
    .sort(
      (a, b) =>
        compareKeys(a.carriedFrom ?? a.date, b.carriedFrom ?? b.date) ||
        compareKeys(a.date, b.date) ||
        a.order - b.order,
    );
  for (const todo of carried) {
    todo.carriedFrom ??= todo.date;
    todo.date = today;
  }
  let list = [...carried, ...todayActive];

  // 3) 오늘에 맞는 규칙마다 할 일을 하나씩 만들어요. 거꾸로 넣어야 규칙 목록 순서대로 보여요.
  const due = next.rules.filter(
    (rule) => !rule.paused && compareKeys(rule.lastGeneratedDate ?? "", today) < 0 && matches(rule, today),
  );
  for (const rule of due.reverse()) {
    const todo = {
      id: createId(),
      text: rule.text,
      category: rule.category,
      date: today,
      done: false,
      order: 0,
      ruleId: rule.id,
      carriedFrom: null,
      createdAt: now(),
      completedAt: null,
    };
    next.todos.push(todo);
    list = insertNew(list, todo);
    rule.lastGeneratedDate = today;
  }

  // 4) 오늘 미완료 항목의 order를 0부터 다시 매겨요.
  renumber(list);

  // 5) 마지막으로 연 날짜
  next.settings.lastOpenedDate = today;

  return { state: next, changed: JSON.stringify(next) !== JSON.stringify(state) };
}

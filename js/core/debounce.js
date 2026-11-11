// 디바운스: 연달아 불러도 마지막 호출 뒤 wait ms 동안 조용하면 한 번만 실행해요 (TL-021).
// 검색어 입력·중복 확인에 써요. DOM은 모르고 타이머만 써요. 테스트에서는 timers를 바꿔 끼울 수 있어요.

/**
 * @returns {Function & { flush: () => void, cancel: () => void }}
 *   flush: 기다리는 호출이 있으면 지금 바로 실행 (Enter 등)
 *   cancel: 기다리는 호출을 취소
 */
// setTimeout을 객체 속성으로 그대로 꺼내 부르면 브라우저에서 "Illegal invocation" 오류가 나요. 함수로 감싸요.
const realTimers = {
  set: (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (id) => globalThis.clearTimeout(id),
};

export function debounce(fn, wait, timers = realTimers) {
  let timer = null;
  let lastArgs = null;

  const run = () => {
    timer = null;
    const args = lastArgs;
    lastArgs = null;
    fn(...args);
  };

  const debounced = (...args) => {
    lastArgs = args;
    if (timer !== null) timers.clear(timer);
    timer = timers.set(run, wait);
  };
  debounced.flush = () => {
    if (timer === null) return;
    timers.clear(timer);
    run();
  };
  debounced.cancel = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
    lastArgs = null;
  };
  return debounced;
}

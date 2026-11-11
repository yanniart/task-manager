// 짧은 알림 (TL-021): "삭제했어요 · 되돌리기", "가져왔어요 · 되돌리기", 저장 실패 등.
// 한 번에 하나만 보여요. 새 알림이 오면 앞의 것을 바꿔요. 화면 읽기 프로그램에도 읽혀요(role="status").

let els = null;
let timer = null;
let handler = null;

export function initToast() {
  els = {
    root: document.getElementById("toast"),
    message: document.getElementById("toast-message"),
    action: document.getElementById("toast-action"),
  };
  els.action.addEventListener("click", () => {
    const fn = handler;
    hideToast();
    fn?.();
  });
}

/**
 * @param {string} message
 * @param {{ actionLabel?: string, onAction?: () => void, duration?: number }} options
 *   되돌리기 같은 버튼이 있으면 읽고 누를 시간을 넉넉히(기본 6초) 줘요.
 */
export function showToast(message, { actionLabel = null, onAction = null, duration } = {}) {
  clearTimeout(timer);
  handler = onAction;
  els.message.textContent = message;
  els.action.hidden = !actionLabel;
  els.action.textContent = actionLabel ?? "";
  els.root.classList.add("is-visible");
  timer = setTimeout(hideToast, duration ?? (actionLabel ? 6000 : 4000));
}

export function hideToast() {
  clearTimeout(timer);
  handler = null;
  els.root.classList.remove("is-visible");
}

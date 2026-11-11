// 드래그 정렬 (PRD F10, TRD 5.6, TL-004).
// HTML5 Drag and Drop은 휴대폰 터치에서 동작하지 않아서 Pointer Events로 직접 만들어요.
// - 손잡이(⠿)에서만 시작해요. 손잡이에 touch-action: none이 있어서 끄는 동안 화면이 스크롤되지 않아요.
// - 끄는 동안에는 상태를 바꾸지 않고 transform으로만 움직여요(다시 그리기 없음). 손을 떼면 onDrop 한 번.
// - 화면 위·아래 끝에 가까우면 자동 스크롤해요.
// - 키보드: 손잡이에 포커스한 채 ↑/↓로 한 칸씩 옮겨요.

const EDGE = 72; // 자동 스크롤이 시작되는 가장자리 폭(px)
const MAX_SPEED = 16; // 한 프레임에 스크롤하는 최대 거리(px)

let options = null;
let session = null;

/**
 * @param {{
 *   list: HTMLElement,                 미완료 목록 <ul>
 *   getTopEdge: () => number,          위쪽 자동 스크롤 기준선(붙어 있는 헤더의 아래 끝, 화면 좌표)
 *   onDrop: (id: string, toIndex: number, how: "pointer" | "keyboard") => void,
 *   onEnd: () => void,                 드래그가 끝날 때마다(옮기지 않았어도) 불러요
 * }} opts
 */
export function initDrag(opts) {
  options = opts;
  options.list.addEventListener("pointerdown", onPointerDown);
  options.list.addEventListener("keydown", onKeyDown);
}

export function isDragging() {
  return session !== null;
}

// ---------- 포인터(터치·마우스) ----------

function onPointerDown(event) {
  const handle = event.target.closest(".todo__handle");
  if (!handle || session) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const item = handle.closest(".todo");
  if (!item) return;

  event.preventDefault(); // 글자 선택·길게 누르기 메뉴 막기
  handle.setPointerCapture(event.pointerId);

  const items = [...options.list.querySelectorAll(":scope > .todo")];
  const index = items.indexOf(item);
  const rects = items.map((el) => el.getBoundingClientRect());
  const scrollY = window.scrollY;
  const gap = items.length > 1 ? rects[1].top - rects[0].bottom : 0;

  session = {
    id: item.dataset.id,
    item,
    handle,
    pointerId: event.pointerId,
    items,
    index,
    target: index,
    startY: event.clientY,
    lastY: event.clientY,
    scrollY0: scrollY,
    // 문서 기준 세로 가운데 위치 (스크롤해도 변하지 않게)
    centers: rects.map((r) => r.top + scrollY + r.height / 2),
    shift: rects[index].height + gap,
    offsets: items.map(() => 0), // 항목마다 지금 비켜 준 거리
    raf: 0,
  };

  options.list.classList.add("todo-list--dragging");
  item.classList.add("todo--dragging");
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);
  handle.addEventListener("pointercancel", onPointerCancel);
  handle.addEventListener("lostpointercapture", onPointerCancel);
  document.addEventListener("keydown", onEscape);
  session.raf = requestAnimationFrame(autoScroll);
}

function onPointerMove(event) {
  if (!session || event.pointerId !== session.pointerId) return;
  session.lastY = event.clientY;
  update();
}

function onPointerUp(event) {
  if (!session || event.pointerId !== session.pointerId) return;
  session.lastY = event.clientY;
  update();
  finish(true);
}

function onPointerCancel() {
  if (session) finish(false);
}

function onEscape(event) {
  if (event.key === "Escape" && session) {
    event.preventDefault();
    finish(false);
  }
}

/** 끄는 위치에 맞춰 끄는 항목과 비켜 줄 항목들을 transform으로만 움직여요. */
function update() {
  const s = session;
  const last = s.centers.length - 1;
  let dy = s.lastY - s.startY + (window.scrollY - s.scrollY0);
  // 목록 밖으로 멀리 가지 않게 막되, 맨 위·맨 아래 항목의 가운데는 넘을 수 있게 반 칸 여유를 둬요.
  // (가운데까지만 허용하면 맨 아래 자리로 옮길 수 없어요.)
  const half = s.shift / 2;
  dy = Math.max(s.centers[0] - s.centers[s.index] - half, Math.min(dy, s.centers[last] - s.centers[s.index] + half));
  s.item.style.transform = `translateY(${dy}px) scale(1.02)`;

  // 다른 항목의 가운데를 지나면 자리를 바꿔요.
  const center = s.centers[s.index] + dy;
  let target = 0;
  s.centers.forEach((c, i) => {
    if (i !== s.index && c < center) target += 1;
  });
  s.target = target;

  // 자리를 바꾼 항목만 스타일을 고쳐요 (100개 이상에서도 끄는 동안 부드럽게, TL-021).
  s.items.forEach((el, i) => {
    if (i === s.index) return;
    let offset = 0;
    if (s.index < target && i > s.index && i <= target) offset = -s.shift;
    else if (s.index > target && i >= target && i < s.index) offset = s.shift;
    if (s.offsets[i] === offset) return;
    s.offsets[i] = offset;
    el.style.transform = offset ? `translateY(${offset}px)` : "";
  });
}

/** 손가락이 화면 위·아래 끝 가까이에 있으면 목록을 스크롤해요. 가장자리에 가까울수록 빨라요. */
function autoScroll() {
  if (!session) return;
  const top = options.getTopEdge();
  const bottom = window.innerHeight;
  let speed = 0;
  if (session.lastY < top + EDGE) {
    speed = -MAX_SPEED * Math.min(1, (top + EDGE - session.lastY) / EDGE);
  } else if (session.lastY > bottom - EDGE) {
    speed = MAX_SPEED * Math.min(1, (session.lastY - (bottom - EDGE)) / EDGE);
  }
  if (speed !== 0) {
    const before = window.scrollY;
    window.scrollBy(0, speed);
    if (window.scrollY !== before) update();
  }
  session.raf = requestAnimationFrame(autoScroll);
}

function finish(commit) {
  const s = session;
  session = null;
  cancelAnimationFrame(s.raf);
  s.handle.removeEventListener("pointermove", onPointerMove);
  s.handle.removeEventListener("pointerup", onPointerUp);
  s.handle.removeEventListener("pointercancel", onPointerCancel);
  s.handle.removeEventListener("lostpointercapture", onPointerCancel);
  document.removeEventListener("keydown", onEscape);
  if (s.handle.hasPointerCapture?.(s.pointerId)) s.handle.releasePointerCapture(s.pointerId);

  s.items.forEach((el) => (el.style.transform = ""));
  s.item.classList.remove("todo--dragging");
  options.list.classList.remove("todo-list--dragging");

  // 손을 뗀 뒤에 한 번만 저장·다시 그리기 (TL-007)
  if (commit && s.target !== s.index) options.onDrop(s.id, s.target, "pointer");
  options.onEnd();
}

// ---------- 키보드 ----------

function onKeyDown(event) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  const handle = event.target.closest(".todo__handle");
  if (!handle || session) return;
  event.preventDefault(); // 화면 스크롤 막기
  const item = handle.closest(".todo");
  const items = [...options.list.querySelectorAll(":scope > .todo")];
  const index = items.indexOf(item);
  const to = index + (event.key === "ArrowUp" ? -1 : 1);
  if (to < 0 || to >= items.length) return;
  options.onDrop(item.dataset.id, to, "keyboard");
}

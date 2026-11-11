// 축하 배너 (PRD F6): 오늘 할 일을 모두 끝내면 보여줘요.
// 방금 100%가 됐을 때만 살짝 튀어나오는 애니메이션을 줘요. 처음 열 때 이미 100%면 그냥 보여줘요.

let wasComplete = null;

export function updateBanner(element, isComplete) {
  element.hidden = !isComplete;
  if (isComplete && wasComplete === false) {
    element.classList.remove("banner--pop");
    void element.offsetWidth; // 애니메이션을 다시 시작하려고 레이아웃을 한 번 읽어요.
    element.classList.add("banner--pop");
  }
  wasComplete = isComplete;
}

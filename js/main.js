// 진입점: 데이터 불러오기 → 날짜 처리(이월·반복) → 화면 연결

import { load } from "./storage.js";
import { STORAGE_KEY } from "./constants.js";
import { initStore, subscribe, getState, rollover, replaceState } from "./store.js";
import { msUntilNextMidnight, setTodayOverride, isTodayOverridden } from "./core/date.js";
import { initUI, render } from "./ui/render.js";
import { registerServiceWorker } from "./features/pwa.js";

applyDevToday();
initStore(load());
rollover(); // 1) 앱을 열 때
initUI();
subscribe(render);
render(getState());
registerServiceWorker(); // 오프라인·홈 화면 추가 (HTTPS·localhost에서만)

// 2) 앱이 다시 화면에 보일 때 (휴대폰에서 다른 앱을 쓰다 돌아왔을 때 등)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") rollover();
});

// 다른 탭(또는 홈 화면 앱)에서 데이터를 바꾸면 이 탭도 그 데이터로 바꿔요.
// 안 그러면 이 탭의 옛 데이터가 다음 저장 때 다른 탭의 변경(가져오기·복구 등)을 덮어써요 (TL-021).
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) replaceState(load());
});

// 3) 켜 둔 채로 자정이 될 때. 자는 동안 타이머가 밀려도 2)가 보완해요.
function scheduleMidnight() {
  if (isTodayOverridden()) return; // 개발용 날짜에서는 날짜가 바뀌지 않아요.
  setTimeout(() => {
    rollover();
    scheduleMidnight();
  }, msUntilNextMidnight() + 1000);
}
scheduleMidnight();

/**
 * 개발용: URL에 ?today=2026-11-12 를 붙이면 그 날짜를 오늘로 보고 동작해요 (TL-014).
 * localhost와 사설 IP(휴대폰 테스트)에서만 켜지고, 배포 주소(HTTPS 공개 주소)에서는 무시돼요.
 */
function applyDevToday() {
  const value = new URLSearchParams(location.search).get("today");
  if (!value) return;
  if (!isDevHost(location.hostname)) return;
  if (setTodayOverride(value)) {
    console.info(`[dev] 오늘 날짜를 ${value}(으)로 바꿔서 실행해요.`);
  } else {
    console.warn(`[dev] ?today=${value} 는 올바른 날짜가 아니라서 무시해요. 예: ?today=2026-11-12`);
  }
}

function isDevHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

// 서비스 워커 등록 (TRD 5.8, TL-018).
// 서비스 워커는 HTTPS나 localhost(= 보안 컨텍스트)에서만 동작해요.
// 휴대폰에서 PC의 IP 주소(http://192.168…)로 열면 조용히 건너뛰고, 할 일 기능은 그대로 동작해요.

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  // 첫 화면을 그리는 데 방해되지 않게 페이지를 다 불러온 뒤에 등록해요.
  const register = () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("[pwa] 서비스 워커를 등록하지 못했어요. 오프라인 사용만 안 되고 앱은 그대로 동작해요.", error);
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

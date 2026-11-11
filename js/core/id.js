// 고유 id 만들기 (TRD 5.7, TL-010).
// crypto.randomUUID()는 HTTPS나 localhost에서만 있어요. PC IP 주소(http://)로 휴대폰 테스트를 해도
// 오류가 나지 않도록, 다른 파일에서는 반드시 createId()만 써요.

/**
 * @param {Crypto | undefined} cryptoImpl 테스트에서 randomUUID가 없는 환경을 흉내 낼 때만 넘겨요.
 */
export function createId(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl?.randomUUID === "function") return cryptoImpl.randomUUID();
  // 대체: 시각(36진수) + 난수(36진수). 개인용 앱의 할 일 수에서는 겹칠 일이 사실상 없어요.
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

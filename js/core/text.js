// 글자 비교: 검색(PRD F13)과 중복 확인(F16)이 함께 써요.
// - 한글은 Mac 등에서 자모가 풀린 형태(NFD)로 들어올 수 있어서 NFC로 맞춰요.
// - 대소문자, 앞뒤 공백, 연속 공백은 무시해요.

/** 비교용으로 정리한 글자 */
export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** 검색어를 낱말로 나눠요. 빈 검색어면 빈 배열. ("보고서  메일" → ["보고서", "메일"]) */
export function parseQuery(query) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  return [...new Set(normalized.split(" "))];
}

/** 모든 낱말이 들어 있으면 true (AND 검색). 낱말이 없으면 항상 true. */
export function matchesQuery(text, terms) {
  if (terms.length === 0) return true;
  const target = normalizeText(text);
  return terms.every((term) => target.includes(term));
}

/**
 * 강조할 구간들 [{ start, end }] (원래 글자 기준, 겹치면 합침).
 * 소문자로 바꿀 때 길이가 달라지는 특수 문자가 있으면 강조하지 않아요(빈 배열).
 */
export function findMatchRanges(text, terms) {
  const source = String(text ?? "").normalize("NFC");
  const lower = source.toLowerCase();
  if (lower.length !== source.length || terms.length === 0) return [];
  const ranges = [];
  for (const term of terms) {
    let from = 0;
    while (term && (from = lower.indexOf(term, from)) !== -1) {
      ranges.push({ start: from, end: from + term.length });
      from += term.length;
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/**
 * 중복 할 일 찾기 (PRD F16): 같은 날짜의 '미완료' 할 일 중 내용이 같은 것.
 * 완료한 일을 다시 적는 건 일부러일 수 있어서 미완료만 봐요.
 */
export function findDuplicateTodo(todos, text, { date, excludeId = null }) {
  const target = normalizeText(text);
  if (!target) return null;
  return todos.find((t) => t.id !== excludeId && t.date === date && !t.done && normalizeText(t.text) === target) ?? null;
}

/** 같은 이름의 반복 규칙 찾기 */
export function findDuplicateRule(rules, text, { excludeId = null } = {}) {
  const target = normalizeText(text);
  if (!target) return null;
  return rules.find((r) => r.id !== excludeId && normalizeText(r.text) === target) ?? null;
}

/**
 * 받침에 맞는 조사를 붙여요: withParticle("업무", "을", "를") → "업무를", withParticle("개인", "을", "를") → "개인을".
 * 한글이 아니면(영어·숫자 등) 받침을 알 수 없어서 "을(를)"처럼 둘 다 써요.
 */
export function withParticle(word, afterConsonant, afterVowel) {
  const last = String(word ?? "").normalize("NFC").trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return `${word}${afterConsonant}(${afterVowel})`;
  return word + (code % 28 === 0 ? afterVowel : afterConsonant);
}

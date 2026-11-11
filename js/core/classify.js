// 키워드로 카테고리 자동 분류 (PRD F18, TL-023).
// 할 일 내용에 카테고리 키워드가 들어 있으면 그 카테고리를 골라요.
// 비교는 core/text.js의 normalizeText와 같은 규칙(NFC·대소문자·공백 정리)이라, "회의를"처럼 조사가 붙어도 "회의"로 찾아요.

import { CATEGORY_IDS, DEFAULT_CATEGORY_KEYWORDS, KEYWORD_MAX_LENGTH, KEYWORDS_PER_CATEGORY_MAX } from "../constants.js";
import { normalizeText } from "./text.js";

/**
 * 저장된 설정에서 실제로 쓸 키워드. 한 번도 고치지 않았으면(null) 기본 키워드를 써요.
 * (기본 키워드를 나중에 고쳐도, 고친 적 없는 사람은 새 기본값을 받게)
 */
export function effectiveKeywords(autoCategory) {
  return autoCategory?.keywords ?? DEFAULT_CATEGORY_KEYWORDS;
}

/**
 * 내용에 맞는 카테고리 찾기. 없으면 null.
 * 여러 카테고리 키워드가 함께 들어 있으면: ① 긴 키워드 ② 앞에 나온 키워드 ③ 카테고리 순서(업무→개인→공부)로 골라요.
 * @returns {{ category: string, keyword: string } | null}
 */
export function classify(text, keywordsByCategory) {
  const target = normalizeText(text);
  if (!target) return null;
  let best = null;
  CATEGORY_IDS.forEach((category, rank) => {
    for (const keyword of keywordsByCategory?.[category] ?? []) {
      const key = normalizeText(keyword);
      if (!key) continue;
      const at = target.indexOf(key);
      if (at === -1) continue;
      const candidate = { category, keyword, length: key.length, at, rank };
      if (
        !best ||
        candidate.length > best.length ||
        (candidate.length === best.length && candidate.at < best.at) ||
        (candidate.length === best.length && candidate.at === best.at && candidate.rank < best.rank)
      ) {
        best = candidate;
      }
    }
  });
  return best ? { category: best.category, keyword: best.keyword } : null;
}

/**
 * 키워드 입력("회의, 미팅 ,, 보고서")을 목록으로 정리해요.
 * 쉼표로 나누고, 앞뒤 공백을 지우고, 빈 것·너무 긴 것을 빼고, 같은 것(대소문자·자모 형태 무시)은 하나만, 최대 개수까지.
 */
export function parseKeywordInput(input) {
  const seen = new Set();
  const result = [];
  for (const raw of String(input ?? "").split(/[,，、\n]/)) {
    const keyword = raw.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!keyword || keyword.length > KEYWORD_MAX_LENGTH) continue;
    const key = normalizeText(keyword);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
    if (result.length >= KEYWORDS_PER_CATEGORY_MAX) break;
  }
  return result;
}

/** 저장된 키워드 묶음 검사·정리. 이상하면 null(= 기본 키워드 사용). */
export function normalizeKeywordMap(value) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const map = {};
  for (const category of CATEGORY_IDS) {
    const list = Array.isArray(value[category]) ? value[category] : [];
    map[category] = parseKeywordInput(list.filter((k) => typeof k === "string").join(","));
  }
  return map;
}

/**
 * 여러 카테고리에 같이 들어 있는 키워드 (더보기 화면 안내용).
 * @returns {{ keyword: string, categories: string[] }[]} categories는 우선순위(카테고리 순서)대로
 */
export function findKeywordConflicts(keywordsByCategory) {
  const owners = new Map();
  for (const category of CATEGORY_IDS) {
    for (const keyword of keywordsByCategory?.[category] ?? []) {
      const key = normalizeText(keyword);
      if (!owners.has(key)) owners.set(key, { keyword, categories: [] });
      const entry = owners.get(key);
      if (!entry.categories.includes(category)) entry.categories.push(category);
    }
  }
  return [...owners.values()].filter((e) => e.categories.length > 1);
}

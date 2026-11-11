// localStorage 읽기/쓰기 (TRD 4장, TL-001), JSON 내보내기·가져오기 (PRD F15, TL-021).
// 키 하나(task-manager)에 { version, todos, rules, trash, settings } 전체를 JSON으로 저장해요.

import {
  STORAGE_KEY,
  BACKUP_KEY_PREFIX,
  SCHEMA_VERSION,
  CATEGORY_IDS,
  DEFAULT_CATEGORY,
  FILTER_IDS,
  DEFAULT_FILTER,
  THEME_IDS,
  DEFAULT_THEME,
  SORT_IDS,
  DEFAULT_SORT,
  MAX_TEXT_LENGTH,
  IMPORT_MAX_BYTES,
  IMPORT_BACKUP_PREFIX,
  IMPORT_BACKUP_KEEP,
} from "./constants.js";
import { isValidKey } from "./core/date.js";
import { normalizeRepeat } from "./core/recurrence.js";
import { normalizeKeywordMap } from "./core/classify.js";

/** 가져오기 파일이 잘못됐을 때. message는 사용자에게 그대로 보여줘요. */
export class ImportError extends Error {
  name = "ImportError";
}

// 구조가 바뀌면 SCHEMA_VERSION을 올리고 여기에 { [옛 버전]: (data) => 새 버전 data } 를 추가해요.
const migrations = {};

export function createEmptyState() {
  return {
    version: SCHEMA_VERSION,
    todos: [],
    rules: [],
    trash: [],
    settings: {
      filter: DEFAULT_FILTER,
      lastCategory: DEFAULT_CATEGORY,
      lastOpenedDate: null,
      theme: DEFAULT_THEME,
      sort: DEFAULT_SORT,
      // 키워드 자동 분류 (PRD F18). keywords가 null이면 기본 키워드를 써요.
      autoCategory: { enabled: true, keywords: null },
    },
  };
}

/** 저장된 상태를 불러와요. 없으면 빈 상태, 깨져 있으면 원본을 백업 키에 남기고 빈 상태로 시작해요. */
export function load(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("[storage] localStorage를 읽을 수 없어요. 이번에는 저장 없이 동작해요.", error);
    return createEmptyState();
  }
  if (raw == null) return createEmptyState();

  let data;
  try {
    data = migrate(JSON.parse(raw));
  } catch (error) {
    console.warn("[storage] 저장된 데이터가 깨져 있어서 백업하고 새로 시작해요.", error);
    backup(storage, raw);
    return createEmptyState();
  }
  return normalize(data);
}

/** 상태 전체를 저장해요. 실패하면(저장 공간 부족 등) false. */
export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("[storage] 저장하지 못했어요.", error);
    return false;
  }
}

function migrate(data) {
  if (!isPlainObject(data) || !Number.isInteger(data.version)) {
    throw new Error("형식이 맞지 않아요");
  }
  let current = data;
  while (current.version < SCHEMA_VERSION) {
    const step = migrations[current.version];
    if (!step) throw new Error(`버전 ${current.version} → ${SCHEMA_VERSION} 변환 방법이 없어요`);
    current = step(current);
  }
  if (current.version !== SCHEMA_VERSION) {
    throw new Error(`알 수 없는 버전이에요: ${current.version}`);
  }
  if (!Array.isArray(current.todos) || !current.todos.every(isValidTodo)) {
    throw new Error("할 일 목록이 깨져 있어요");
  }
  if (current.rules != null && (!Array.isArray(current.rules) || !current.rules.every(isValidRule))) {
    throw new Error("반복 규칙 목록이 깨져 있어요");
  }
  return current;
}

// 빠진 설정값은 기본값으로 채워요. (필드를 더해도 버전을 올릴 필요가 없게)
function normalize(data) {
  const empty = createEmptyState();
  const settings = isPlainObject(data.settings) ? data.settings : {};
  return {
    version: SCHEMA_VERSION,
    todos: data.todos,
    rules: data.rules ?? [],
    // 휴지통은 v0.6(F17)에서 생겼어요. 깨진 항목은 조용히 빼요(할 일 목록만큼 중요하지 않아서).
    trash: Array.isArray(data.trash) ? data.trash.filter(isValidTrashEntry) : [],
    settings: {
      filter: FILTER_IDS.includes(settings.filter) ? settings.filter : empty.settings.filter,
      lastCategory: CATEGORY_IDS.includes(settings.lastCategory)
        ? settings.lastCategory
        : empty.settings.lastCategory,
      lastOpenedDate: typeof settings.lastOpenedDate === "string" ? settings.lastOpenedDate : null,
      // 화면 모드는 v0.5(F12)에서 생겼어요. 예전 데이터에는 없어서 기본값(시스템)으로 채워요.
      theme: THEME_IDS.includes(settings.theme) ? settings.theme : empty.settings.theme,
      sort: SORT_IDS.includes(settings.sort) ? settings.sort : empty.settings.sort,
      // v0.8(F18)에서 생겼어요. 없거나 이상하면 켜짐 + 기본 키워드
      autoCategory: {
        enabled: typeof settings.autoCategory?.enabled === "boolean" ? settings.autoCategory.enabled : true,
        keywords: normalizeKeywordMap(settings.autoCategory?.keywords),
      },
    },
  };
}

function isValidTodo(todo) {
  return (
    isPlainObject(todo) &&
    typeof todo.id === "string" &&
    typeof todo.text === "string" &&
    typeof todo.date === "string" &&
    typeof todo.done === "boolean"
  );
}

function isValidRule(rule) {
  return (
    isPlainObject(rule) &&
    typeof rule.id === "string" &&
    typeof rule.text === "string" &&
    isPlainObject(rule.repeat) &&
    typeof rule.repeat.type === "string"
  );
}

function isValidTrashEntry(entry) {
  return (
    isPlainObject(entry) &&
    typeof entry.id === "string" &&
    typeof entry.deletedAt === "string" &&
    ((entry.kind === "todo" && isValidTodo(entry.item)) || (entry.kind === "rule" && isValidRule(entry.item)))
  );
}

// ---------- 내보내기·가져오기 (PRD F15) ----------

/** 내보낼 JSON 글자. 앱 이름·내보낸 시각을 붙여요(가져올 때 확인용). */
// app 값 "task-manager"는 앱 이름(MyTask)이 바뀌어도 그대로 둬요. 예전에 내보낸 파일과 같은 표시라야 해요 (TL-025).
export function serializeForExport(state, now = new Date().toISOString()) {
  return JSON.stringify({ app: "task-manager", exportedAt: now, ...state }, null, 2);
}

/**
 * 가져올 파일 글자 → 상태. 밖에서 온 파일이라 앱 데이터를 불러올 때보다 꼼꼼히 검사해요.
 * 잘못됐으면 사용자에게 보여줄 문장으로 ImportError를 던져요.
 */
export function parseImport(text) {
  if (text.length > IMPORT_MAX_BYTES) throw new ImportError("파일이 너무 커요 (최대 2MB).");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("JSON 파일이 아니에요.");
  }
  if (!isPlainObject(data) || !Array.isArray(data.todos) || !Number.isInteger(data.version)) {
    throw new ImportError("MyTask에서 내보낸 파일이 아니에요.");
  }
  if (data.version > SCHEMA_VERSION) {
    throw new ImportError("더 새로운 버전의 앱에서 내보낸 파일이라 가져올 수 없어요.");
  }
  try {
    data = migrate(data);
  } catch (error) {
    throw new ImportError(`파일 내용이 깨져 있어요. (${error.message})`);
  }
  const problem = findImportProblem(data);
  if (problem) throw new ImportError(`파일 내용이 깨져 있어요. (${problem})`);
  return normalize(data);
}

function findImportProblem(data) {
  const ids = new Set();
  for (const [index, todo] of data.todos.entries()) {
    const where = `할 일 ${index + 1}번째`;
    if (ids.has(todo.id)) return `${where}: id가 겹쳐요`;
    ids.add(todo.id);
    const text = todo.text.trim();
    if (!text || text.length > MAX_TEXT_LENGTH) return `${where}: 내용이 비었거나 ${MAX_TEXT_LENGTH}자를 넘어요`;
    if (!CATEGORY_IDS.includes(todo.category)) return `${where}: 카테고리가 이상해요`;
    if (!isValidKey(todo.date)) return `${where}: 날짜가 이상해요`;
    if (todo.carriedFrom != null && !isValidKey(todo.carriedFrom)) return `${where}: 이월 날짜가 이상해요`;
    if (!Number.isFinite(todo.order)) return `${where}: 순서 값이 이상해요`;
  }
  const ruleIds = new Set();
  for (const [index, rule] of (data.rules ?? []).entries()) {
    const where = `반복 일정 ${index + 1}번째`;
    if (ruleIds.has(rule.id)) return `${where}: id가 겹쳐요`;
    ruleIds.add(rule.id);
    if (!rule.text.trim() || rule.text.length > MAX_TEXT_LENGTH) return `${where}: 이름이 비었거나 너무 길어요`;
    if (!CATEGORY_IDS.includes(rule.category)) return `${where}: 카테고리가 이상해요`;
    if (!normalizeRepeat(rule.repeat)) return `${where}: 반복 설정이 이상해요`;
  }
  return null;
}

/**
 * 가져오기 직전의 데이터를 백업 키에 남겨요. 가장 최근 IMPORT_BACKUP_KEEP개만 두고 오래된 건 지워요.
 * @returns {boolean} 백업했으면 true
 */
export function backupBeforeImport(state, storage = globalThis.localStorage, now = new Date().toISOString()) {
  try {
    storage.setItem(IMPORT_BACKUP_PREFIX + now, JSON.stringify(state));
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(IMPORT_BACKUP_PREFIX)) keys.push(key);
    }
    keys.sort().reverse().slice(IMPORT_BACKUP_KEEP).forEach((key) => storage.removeItem(key));
    return true;
  } catch (error) {
    console.warn("[storage] 가져오기 전 백업을 하지 못했어요.", error);
    return false;
  }
}

function backup(storage, raw) {
  try {
    storage.setItem(BACKUP_KEY_PREFIX + new Date().toISOString(), raw);
  } catch (error) {
    console.warn("[storage] 깨진 데이터를 백업하지 못했어요.", error);
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

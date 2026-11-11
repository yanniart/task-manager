// 앱 전체에서 쓰는 고정값. 다른 파일은 숫자·문자열을 직접 쓰지 말고 여기서 가져와요.

// 앱 이름은 MyTask지만 저장 키는 그대로 "task-manager"예요. 바꾸면 이미 저장된 할 일을 못 읽어요 (TL-025).
export const STORAGE_KEY = "task-manager";
export const BACKUP_KEY_PREFIX = "task-manager.backup.";
export const SCHEMA_VERSION = 1;

export const MAX_TEXT_LENGTH = 100;

// 카테고리는 세 가지로 고정 (PRD F5). 색은 css/base.css의 --cat-<id> 변수예요.
export const CATEGORIES = [
  { id: "work", label: "업무" },
  { id: "personal", label: "개인" },
  { id: "study", label: "공부" },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
export const DEFAULT_CATEGORY = "work";

export const FILTERS = [{ id: "all", label: "전체" }, ...CATEGORIES];
export const FILTER_IDS = FILTERS.map((f) => f.id);
export const DEFAULT_FILTER = "all";

// 키워드 자동 분류 (PRD F18). 사용자가 더보기에서 고치면 settings.autoCategory.keywords에 저장되고,
// 고친 적이 없으면(null) 이 기본값을 써요. 한 글자 키워드는 엉뚱하게 걸리기 쉬워서(예: "책" → "책상 정리") 넣지 않았어요.
export const DEFAULT_CATEGORY_KEYWORDS = {
  work: ["회의", "미팅", "보고서", "메일", "업무", "프로젝트", "기획", "발표", "결재", "계약", "고객", "거래처", "출장", "마감", "견적", "회사"],
  personal: ["장보기", "마트", "운동", "헬스", "산책", "병원", "약속", "청소", "빨래", "요리", "은행", "택배", "생일", "가족", "친구", "여행"],
  study: ["공부", "강의", "수업", "과제", "숙제", "시험", "복습", "예습", "영단어", "단어", "영어", "독서", "논문", "자격증", "인강", "코딩"],
};
export const KEYWORD_MAX_LENGTH = 20;
export const KEYWORDS_PER_CATEGORY_MAX = 50;

// 보기 정렬 (PRD F14). manual = 드래그로 정한 순서
export const SORT_OPTIONS = [
  { id: "manual", label: "직접 정렬", hint: "드래그로 정한 순서" },
  { id: "created", label: "생성일순", hint: "먼저 만든 할 일부터" },
  { id: "category", label: "카테고리순", hint: "업무 → 개인 → 공부" },
  { id: "status", label: "완료 상태순", hint: "미완료·완료를 한 목록으로, 미완료 먼저" },
];
export const SORT_IDS = SORT_OPTIONS.map((s) => s.id);
export const DEFAULT_SORT = "manual";

// 휴지통 (PRD F17): 이 기간·개수를 넘으면 오래된 것부터 지워져요.
export const TRASH_KEEP_DAYS = 30;
export const TRASH_MAX = 100;

// 가져오기 (PRD F15)
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_BACKUP_PREFIX = "task-manager.backup.import.";
export const IMPORT_BACKUP_KEEP = 3;

// 검색·중복 확인 입력을 기다리는 시간 (디바운스)
export const INPUT_DEBOUNCE_MS = 150;

// 화면 모드 (PRD F12). 버튼을 누를 때마다 이 순서로 돌아가요.
export const THEME_IDS = ["system", "light", "dark"];
export const DEFAULT_THEME = "system";

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
// 화면에 요일을 늘어놓는 순서: 월 화 수 목 금 토 일 (PRD 6장)
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// 반복 (PRD F8). "none"은 추가 시트에서만 쓰는 선택지이고 규칙에는 저장되지 않아요.
export const REPEAT_CHOICES = [
  { id: "none", label: "안 함" },
  { id: "daily", label: "매일" },
  { id: "weekdays", label: "평일" },
  { id: "weekly", label: "매주" },
];
export const REPEAT_TYPE_IDS = ["daily", "weekdays", "weekly"];

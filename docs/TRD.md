# 할 일 관리 앱 TRD (기술 요구사항 문서)

- 문서 버전: v0.5 (v0.2: 알림 설계 제거, id 대체 생성 방법 추가 · v0.3: 순서 규칙 5.4, 시트 설계 5.9 추가 · v0.4: 화면 모드 `settings.theme`, 6장 · v0.5: 검색·정렬·내보내기/가져오기·중복 확인·휴지통·성능 5.10~5.15, `trash`, `settings.sort` · v0.6: 정렬 아이콘 메뉴 `ui/sort-menu.js` · v0.7: 키워드 자동 분류 `core/classify.js`, `settings.autoCategory`, 5.16 · v0.8: 확인 스크립트를 `tests/`에, 8장)
- 최종 수정: 2026-11-11
- 관련 문서: [PRD](PRD.md) · [개발로그](dev-log.md) · [기술로그](tech-log.md)

이 문서는 PRD의 기능을 **어떻게** 만들지 정해요. 설계를 바꾸면 이 문서를 고치고, 바꾼 이유는 [기술로그](tech-log.md)에 남겨요.

## 1. 기술 원칙

1. **순수 웹 기술만**: HTML, CSS, 자바스크립트(ES2020+). 프레임워크·라이브러리·빌드 도구·npm 패키지를 쓰지 않아요.
2. **파일 하나는 한 가지 일만**: 기능별로 파일을 나눠서 나중에 찾고 고치기 쉽게 해요.
3. **화면과 로직 분리**: 날짜·반복·이월 계산은 DOM을 모르는 순수 함수로 만들어요. 화면 코드는 `js/ui/`에만 둬요.
4. **모바일 우선**: CSS는 휴대폰 화면을 기본으로 쓰고, 넓은 화면은 미디어 쿼리로 보완해요.

## 2. 실행 환경

| 항목 | 내용 |
|---|---|
| 대상 브라우저 | Android Chrome 최신, iOS Safari 16.4+, PC Chrome/Edge 최신 |
| 개발 시 실행 | 로컬 서버 필요 (예: VS Code **Live Server** 확장, 또는 `python -m http.server 8000`) |
| 배포 | HTTPS 정적 호스팅 (GitHub Pages 예정) |
| 왜 더블클릭으로 안 되나 | ES 모듈과 서비스 워커는 `file://`에서 동작하지 않아요 ([TL-002](tech-log.md#tl-002)) |

> 휴대폰에서 테스트하려면: PC와 같은 Wi‑Fi에서 PC의 IP 주소(예: `http://192.168.0.10:8000`)로 접속해요. 할 일 기능은 모두 동작하지만, HTTPS가 아니라서 서비스 워커(오프라인·홈 화면 추가)는 동작하지 않아요. 이 부분은 GitHub Pages에 올린 뒤에 확인해요.
> HTTPS가 아닌 주소에서도 앱이 멈추지 않도록, HTTPS 전용 기능을 쓸 때는 항상 대체 방법을 둬요 (5.7).

## 3. 폴더 구조

```
task-manager/
├── index.html               # 화면 뼈대 (하나뿐인 HTML)
├── manifest.webmanifest     # PWA 설정 (앱 이름, 아이콘, 색)
├── sw.js                    # 서비스 워커 (오프라인 캐시) - 범위 때문에 루트에 둠
├── README.md                # 프로젝트 소개, 실행 방법, 문서 안내
│
├── css/
│   ├── base.css             # 색·간격 변수, 리셋, 다크 모드, 글꼴
│   ├── layout.css           # 헤더, 목록, 떠 있는 버튼 등 화면 배치
│   └── components.css       # 체크 버튼, 배지, 시트, 배너 등 부품
│
├── js/
│   ├── main.js              # 진입점: 데이터 불러오기 → 날짜 처리 → 화면 연결
│   ├── store.js             # 앱 상태와 변경 함수, 변경 시 저장·다시 그리기
│   ├── storage.js           # localStorage 읽기/쓰기, 스키마 버전, 마이그레이션
│   ├── constants.js         # 카테고리 목록, 저장 키, 제한값(100자 등)
│   │
│   ├── core/                # DOM을 모르는 순수 로직 (테스트 쉬움)
│   │   ├── date.js          # 로컬 날짜 'YYYY-MM-DD' 다루기
│   │   ├── id.js            # 고유 id 만들기 (대체 방법 포함)
│   │   ├── order.js         # 미완료 목록 순서 정하기 (5.4)
│   │   ├── recurrence.js    # 규칙이 어떤 날짜에 해당하는지
│   │   ├── rollover.js      # 날짜가 바뀔 때 이월·반복 생성
│   │   ├── progress.js      # 진행률 계산
│   │   ├── text.js          # 글자 비교: 검색·강조·중복 확인 (5.10, 5.15)
│   │   ├── sort.js          # 보기 정렬 (5.11)
│   │   ├── trash.js         # 휴지통 넣기·정리·꺼내기 (5.13)
│   │   ├── classify.js      # 키워드로 카테고리 자동 분류 (5.16)
│   │   └── debounce.js      # 디바운스 (타이머만 씀, DOM 모름) (5.14)
│   │
│   ├── features/            # 브라우저 API를 쓰는 기능
│   │   └── pwa.js           # 서비스 워커 등록
│   │
│   └── ui/                  # 화면 그리기와 사용자 입력
│       ├── render.js        # 전체 화면 다시 그리기 (목록, 진행률, 필터)
│       ├── todo-item.js     # 할 일 한 줄 요소 만들기
│       ├── sheet.js         # 추가/수정 바텀 시트
│       ├── rules-view.js    # 반복 일정 관리 화면
│       ├── banner.js        # 축하 배너
│       ├── drag.js          # 드래그 정렬
│       ├── theme.js         # 화면 모드 (PRD F12)
│       ├── search-bar.js    # 검색창 (5.10)
│       ├── more-view.js     # 더보기: 자동 분류 키워드·내보내기/가져오기·휴지통 (5.16, 5.12, 5.13)
│       ├── sort-menu.js     # 정렬 아이콘 + 메뉴 (5.11)
│       └── toast.js         # 짧은 알림 + 되돌리기
│
├── assets/
│   └── icons/               # 앱 아이콘 (SVG 원본 + 192px, 512px, maskable, iPhone용)
│
├── tests/
│   ├── core.test.html       # core/ 함수를 브라우저에서 확인하는 간단한 테스트 페이지
│   ├── run-core.mjs         # 같은 테스트를 Node에서 (시간대 바꿔 보기 --tz=)
│   ├── store.test.mjs       # store·storage 확인 (Node, 가짜 localStorage)
│   └── e2e/                 # 브라우저 확인: run.mjs(실행기), harness.js, audit.js, steps/*.js (8장)
│
└── docs/
    ├── PRD.md               # 무엇을 만드는지
    ├── TRD.md               # 어떻게 만드는지 (이 문서)
    ├── dev-log.md           # 날짜별 개발 기록
    └── tech-log.md          # 기술 결정 기록
```

### 의존 방향

```
main.js ──▶ ui/* ──▶ store.js ──▶ storage.js
   │           │         │
   │           └────────▶ core/*  ◀── features/*
   └──────────────────────────────────▶ features/*
```

- `core/`는 다른 폴더를 import하지 않아요 (`constants.js`만 예외).
- `storage.js`는 가져오기 검사에 `core/`(날짜·반복 검사)를 써요. `ui/`는 `storage.js`를 직접 부르지 않고 `store.js`를 거쳐요(예: `parseImportText`).
- `store.js`는 DOM을 건드리지 않아요. 상태가 바뀌면 구독한 함수(화면 그리기)를 불러요.
- `ui/`끼리는 서로 직접 부르지 않고 `render.js`를 거쳐요.

### 이름 규칙

- 파일: 소문자 + 하이픈 (`todo-item.js`)
- 함수·변수: camelCase (`addTodo`), 상수: UPPER_SNAKE (`MAX_TEXT_LENGTH`)
- CSS 클래스: 블록__요소--상태 (`todo__text--done`)
- 모든 모듈은 `export function`으로 필요한 것만 내보내요. 전역 변수는 쓰지 않아요.

## 4. 데이터 모델

`localStorage` 키 **`task-manager`** 하나에 전체를 JSON으로 저장해요.

```js
{
  version: 1,                       // 스키마 버전 (구조가 바뀌면 올림)
  todos: [Todo],
  rules: [Rule],
  trash: [TrashEntry],              // 휴지통 (PRD F17, 5.13). 없으면 []
  settings: {
    filter: "all",                  // "all" | "work" | "personal" | "study"
    lastCategory: "work",
    lastOpenedDate: "2026-11-11",   // 날짜 변경 감지용
    theme: "system",                // "system" | "light" | "dark" (PRD F12). 없으면 "system"
    sort: "manual",                 // "manual" | "created" | "category" | "status" (PRD F14). 없으면 "manual"
    autoCategory: {                 // 키워드 자동 분류 (PRD F18, 5.16). 없으면 { enabled: true, keywords: null }
      enabled: true,
      keywords: null                // null = 기본 키워드(constants.js). 고치면 { work: [...], personal: [...], study: [...] }
    }
  }
}
```

### Todo

```js
{
  id: "c1f2...",                    // core/id.js의 createId() (5.7)
  text: "보고서 마무리",              // 1~100자
  category: "work",                 // "work" | "personal" | "study"
  date: "2026-11-11",               // 이 할 일이 속한 날 (로컬 날짜)
  done: false,
  order: 3,                         // 같은 날 미완료 항목 안에서의 순서 (작을수록 위)
  ruleId: null,                     // 반복 규칙으로 생겼으면 규칙 id
  carriedFrom: "2026-11-10",        // 이월됐으면 처음 날짜, 아니면 null
  createdAt: "2026-11-10T00:12:00.000Z",
  completedAt: null                 // 완료한 시각 (ISO) 또는 null
}
```

### Rule (반복 규칙)

```js
{
  id: "a9b8...",
  text: "영단어 30개",
  category: "study",
  repeat: { type: "weekly", days: [1, 3] },  // type: "daily" | "weekdays" | "weekly", days: 0(일)~6(토)
  paused: false,
  createdAt: "2026-11-11T...",
  lastGeneratedDate: "2026-11-11"   // 마지막으로 할 일을 만든 날 (중복 방지)
}
```

### TrashEntry (휴지통 항목, PRD F17)

```js
{
  id: "e1...",                      // 휴지통 항목 id
  kind: "todo",                     // "todo" | "rule"
  item: { ...Todo 또는 Rule },       // 지운 것 그대로
  deletedAt: "2026-11-16T09:00:00.000Z",
  batchId: "b1..."                  // 한 번에 지운 묶음 (되돌리기 단위)
}
```

필드를 더한 것뿐이라 `version`은 1 그대로예요. 예전 데이터는 불러올 때 빈 휴지통·기본 정렬로 채워요.

### 저장 규칙

- 상태를 바꾸는 모든 함수는 `store.js`에만 있고, 바꾼 뒤 `storage.save()`를 불러요.
- 읽을 때 `JSON.parse` 실패나 `version` 불일치가 있으면:
  - 마이그레이션 함수가 있으면 변환해요 (`migrations[1→2]` 식으로 `storage.js`에 둠).
  - 변환할 수 없으면 원본을 `task-manager.backup.<시각>` 키에 복사하고 빈 상태로 시작해요.
- 용량: 할 일 수천 개도 1MB 이하라서 `localStorage` 한도(약 5MB)는 보통 문제되지 않아요. 그래도 휴지통·가져오기 백업이 쌓일 수 있어서, **저장에 실패하면 화면에 알려요**(`store.onSaveError` → 알림).
- **다른 탭**: 다른 탭이나 홈 화면 앱에서 저장하면 `storage` 이벤트로 이 탭의 상태를 갈아 끼워요(`store.replaceState`). 안 하면 이 탭의 옛 데이터가 다음 저장 때 다른 탭의 변경을 덮어써요.

## 5. 핵심 로직

### 5.1 날짜

- 날짜는 항상 **로컬 시간 기준 `'YYYY-MM-DD'` 문자열**로 다뤄요 ([TL-005](tech-log.md#tl-005)).
- `toISOString()`은 UTC로 바뀌어서 한국 시간 오전 9시 이전에 날짜가 하루 밀리므로, 날짜 키에는 쓰지 않아요.
- `core/date.js`: `todayKey()`, `toKey(date)`, `weekdayOf(key)`, `compareKeys(a, b)`

### 5.2 날짜 변경 처리 (`core/rollover.js`)

다음 세 가지 때에 `runRollover(state, todayKey)`를 불러요.

1. 앱을 열 때
2. 앱이 다시 화면에 보일 때 (`visibilitychange`)
3. 앱이 켜져 있는 동안 자정이 될 때 (자정까지 남은 시간으로 `setTimeout`)

`runRollover` 순서:

1. `date < 오늘`이고 미완료이며 `ruleId`가 **없는** 할 일 → `date = 오늘`, `carriedFrom`이 비어 있으면 원래 날짜를 넣음. 미완료 목록 **맨 위**에 놓음 (원래 날짜 오름차순, 같은 날짜면 기존 `order` 순)
2. `date < 오늘`이고 미완료이며 `ruleId`가 **있는** 할 일 → 삭제
3. 멈추지 않은 규칙마다, 오늘이 규칙에 해당하고 `lastGeneratedDate !== 오늘`이면 할 일을 만들고 `lastGeneratedDate = 오늘`. 만든 할 일은 5.4의 "새 할 일" 자리에 넣음
4. 오늘 미완료 항목의 `order`를 0부터 다시 매김 (5.4)
5. `settings.lastOpenedDate = 오늘`

이 함수는 같은 날 여러 번 불러도 결과가 같아야 해요 (멱등성).

### 5.3 반복 판단 (`core/recurrence.js`)

```js
matches(rule, dateKey):
  daily    → true
  weekdays → 요일이 1~5
  weekly   → rule.repeat.days에 요일이 있음
```

### 5.4 목록 정렬과 보여주기

화면의 목록은 세 구역이에요.

| 구역 | 조건 | 정렬 |
|---|---|---|
| 미완료 | `date === 오늘 && !done` | `order` 오름차순 |
| 완료 | `date === 오늘 && done` | `completedAt` 내림차순 |
| 이전에 완료한 항목 (접힘) | `date < 오늘 && done` | `completedAt` 내림차순 |

필터는 세 구역 모두에 적용해요. 진행률은 앞의 두 구역만 계산해요.

#### 순서(`order`) 규칙 ([TL-011](tech-log.md#tl-011))

- `order`는 오늘의 미완료 항목에만 의미가 있는 **0부터 시작하는 연속 정수**예요. 작을수록 위예요.
- 미완료 목록이 바뀔 때마다 `core/order.js`의 함수로 **배열 순서를 먼저 정하고, 0, 1, 2…로 다시 매겨요.** 빈 번호나 같은 번호가 생기지 않아요.

| 함수 | 하는 일 |
|---|---|
| `insertIndex(list)` | 맨 위에서부터 **연속으로 이어진** 이월 항목(`carriedFrom !== null`) 개수를 돌려줌 = 새 할 일이 들어갈 자리 |
| `insertNew(list, todo)` | `insertIndex` 자리에 끼워 넣음. 새 할 일·반복 생성·반복 규칙 저장 시 오늘 몫 모두 이 함수 사용 |
| `appendLast(list, todo)` | 맨 아래에 붙임. 완료를 취소했을 때 사용 |
| `move(list, from, to)` | 드래그 결과 반영 |
| `renumber(list)` | 배열 순서대로 `order = 0, 1, 2…` |

- 사용자가 드래그로 이월 항목을 아래로 내렸다면 그 항목은 더 이상 "맨 위에 이어진 이월 항목"이 아니라서, 새 할 일은 그 위에 들어가요. 드래그한 결과를 존중하기 위해서예요.
- 완료로 바꾼 항목의 `order`는 그대로 두고 쓰지 않아요 (완료 구역은 `completedAt`으로 정렬).

### 5.5 렌더링

- 상태가 바뀌면 `render(state)`가 화면 전체를 **다시 계산해요** ([TL-007](tech-log.md#tl-007)). 다만 할 일 한 줄 요소는 내용이 같으면 다시 만들지 않고, 자리가 바뀐 요소만 옮겨요 (5.14).
- 사용자 입력 글은 항상 `textContent`로 넣어요. `innerHTML`에 사용자 데이터를 넣지 않아요.
- 이벤트는 목록 부모 하나에 걸고 `data-id`로 어떤 항목인지 찾아요 (이벤트 위임).

### 5.6 드래그 정렬 (`ui/drag.js`)

- HTML5 Drag and Drop은 휴대폰 터치에서 동작하지 않아서 **Pointer Events**로 직접 만들어요 ([TL-004](tech-log.md#tl-004)).
- 손잡이(⠿)에서만 시작해요. 손잡이에 `touch-action: none`을 줘서 끄는 동안 화면이 스크롤되지 않게 해요.
- 끌 때 항목을 `transform: translateY()`로 움직이고, 다른 항목의 가운데를 지나면 자리를 바꿔요.
- 손을 떼면 `move()` 후 `renumber()`로 `order`를 0, 1, 2…로 다시 매겨서 저장해요 (5.4).
- 필터가 켜져 있으면 보이는 항목들이 원래 차지하던 `order` 자리 안에서만 섞어요.
- 화면 위/아래 끝에 가까워지면 목록을 자동으로 스크롤해요.

### 5.7 고유 id 만들기 (`core/id.js`)

- `crypto.randomUUID()`는 HTTPS나 localhost에서만 있어요. 휴대폰에서 PC IP 주소(`http://`)로 테스트하면 없어서 오류가 나요 ([TL-010](tech-log.md#tl-010)).
- 그래서 `createId()` 하나로 감싸서 씁니다.

```js
export function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // 대체: 시각(36진수) + 난수(36진수). 개인용 앱의 할 일 수에서는 겹칠 일이 사실상 없어요.
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
```

- 다른 파일에서는 `crypto.randomUUID()`를 직접 부르지 않아요.

> 알림 설계는 v0.2에서 뺐어요 ([TL-009](tech-log.md#tl-009)). 5.7 번호를 id 설계로 바꿔 썼어요.

### 5.8 PWA (`manifest.webmanifest`, `sw.js`, `features/pwa.js`)

- manifest: `name`, `short_name`, `start_url: "./"`, `display: "standalone"`, 테마 색, 아이콘 192/512/maskable
- 서비스 워커 캐시: 앱 파일(HTML·CSS·JS·아이콘)을 설치 때 저장하고, **캐시 먼저** 응답해요. 그래서 오프라인에서도 열려요.
- 캐시 이름에 버전을 붙여요 (`tm-cache-v1`). **앱 파일을 고치면 `sw.js`의 버전을 반드시 올려요.** 안 올리면 휴대폰에 옛 버전이 계속 보여요.
- 모든 경로는 상대 경로(`./`)로 써요. GitHub Pages의 하위 경로(`/task-manager/`)에서도 동작하게 하기 위해서예요.
- **새 파일을 만들면 `sw.js`의 `APP_FILES`에도 넣어요.** 빠지면 오프라인에서 그 파일만 못 불러와요.
- 옛 캐시는 `tm-cache-`로 시작하는 것만 지워요(같은 github.io 주소의 다른 앱 캐시 보호). `tests/`는 캐시하지 않아요.
- 등록은 `window.isSecureContext`(HTTPS·localhost)일 때만. PC IP 주소(`http://`)에서는 건너뛰어요.
- 아이콘 원본은 `assets/icons/icon.svg`, `icon-maskable.svg`이고 PNG는 여기서 만들어요. iPhone용 `apple-touch-icon.png`(180px)도 있어요 ([TL-018](tech-log.md#tl-018)).

### 5.9 추가/수정 시트 (`ui/sheet.js`)

- 시트 하나를 `openSheet({ mode, todo })`로 열어요. `mode`는 `"add"` 또는 `"edit"`.

| 줄 | 추가 (`add`) | 수정 (`edit`), 일반 할 일 | 수정 (`edit`), 반복 할 일 (`ruleId` 있음) |
|---|---|---|---|
| 내용 | 빈 칸 | 기존 내용 | 기존 내용 |
| 카테고리 | 마지막으로 고른 값 | 기존 값 | 기존 값 |
| 반복 | 보임 (기본: 반복 안 함) | 숨김 | 숨기고 안내 문구 표시 |
| 삭제 버튼 | 숨김 | 보임 | 보임 |

- 반복 할 일의 안내 문구: `🔁 {규칙 요약} 반복 · 반복 일정 관리에서 수정`. 누르면 시트를 닫고 `rules-view`를 열어 해당 규칙을 강조해요.
- 규칙이 이미 삭제됐으면(규칙을 찾을 수 없으면) 안내 대신 `🔁 삭제된 반복 일정에서 생긴 할 일`만 보여줘요.
- 수정 시트에서 바꾼 내용·카테고리는 그 할 일에만 저장하고, 규칙은 건드리지 않아요.
- 추가 모드에서 반복을 고르고 저장하면: 규칙을 만들고 → 오늘이 규칙에 맞으면 `insertNew()`로 오늘 할 일도 만들고 → 규칙의 `lastGeneratedDate = 오늘`.
- `rules-view`의 **+ 새 반복 일정**도 같은 시트를 `mode: "add"`로 열되, 반복 줄의 "반복 안 함"은 빼요.

### 5.10 검색 (`ui/search-bar.js`, `core/text.js`)

- 검색어는 화면 상태(`render.js`의 `searchQuery`)이고 저장하지 않아요.
- `parseQuery`: NFC로 맞추고 소문자·공백 정리 후 낱말로 나눠요. `matchesQuery`: 모든 낱말이 들어 있으면 맞음(AND).
- 화면에 보이는 조건 = 카테고리 필터 **그리고** 검색어. 미완료·완료·이전 완료 세 구역 모두에 적용하고, 진행률에는 적용하지 않아요.
- 드래그·키보드 이동은 이 조건을 `reorderTodo(id, to, isVisible)`에 넘겨서 `moveVisible`로 보이는 항목끼리만 섞어요.
- 강조: `findMatchRanges`로 구간을 구해 `<mark>`와 글자 노드로 나눠 넣어요(innerHTML 없음). 소문자로 바꿀 때 길이가 바뀌는 특수 문자가 있으면 강조하지 않아요.
- 입력은 150ms 디바운스, Enter는 바로(`flush`), 한글 조합 중 Enter·Esc는 무시해요.

### 5.11 보기 정렬 (`core/sort.js`, `ui/sort-menu.js`)

- 위치: 목록 맨 위 도구 줄(`.list-toolbar`)의 오른쪽 아이콘 버튼(`aria-haspopup="menu"`). 같은 줄 왼쪽에는 검색 결과 수가 나와요.
- 메뉴는 `role="menu"` + `menuitemradio`(지금 정렬에 `aria-checked`). 열면 지금 정렬에 포커스, ↑/↓·Home·End 이동, Enter로 고르기, Esc는 닫고 아이콘으로 포커스, Tab·바깥 누르기는 닫기만. 고르면 닫히고 아이콘으로 포커스.
- 직접 정렬이 아니면 아이콘에 정렬 이름을 붙이고 `is-active`(옅은 파랑 바탕 + 진한 파랑 글자, 4.5:1 이상). 버튼 이름은 "정렬: 생성일순. 이 정렬에서는 순서를 옮길 수 없어요"처럼 손잡이가 없는 이유까지 알려요.

- `sortForView(active, done, mode)`가 보이는 순서만 정하고 `order`는 건드리지 않아요.
- `created`: `createdAt` 오름차순, `category`: `CATEGORY_IDS` 순서(같으면 원래 순서), `status`: `merged: true`로 미완료 + 완료를 한 목록으로.
- `manual`이 아닐 때는 손잡이를 달지 않아서(드래그·키보드 이동 없음) `order`가 바뀔 일이 없어요.

### 5.12 내보내기·가져오기 (`storage.js`, `ui/more-view.js`)

- 내보내기: `serializeForExport` = `{ app: "task-manager", exportedAt, ...state }`, 파일은 Blob + `a[download]`. iOS Safari에서 끊기지 않게 URL은 10초 뒤 해제해요.
- 가져오기: `parseImport(text)`가 **앱 데이터를 불러올 때보다 꼼꼼히** 검사해요(밖에서 온 파일이라서).
  - 2MB 초과, JSON 아님, `version`·`todos` 없음, 더 새 버전, 마이그레이션 실패
  - 할 일: id 중복, 내용 비었거나 100자 초과, 카테고리, 날짜(`isValidKey`), 이월 날짜, `order` 숫자
  - 반복 일정: id 중복, 이름, 카테고리, `normalizeRepeat` 통과
  - 문제가 있으면 `ImportError`(사용자에게 보여줄 문장)로 알려요.
- 적용: `store.importState(next)` → 지금 상태를 `task-manager.backup.import.<시각>`에 백업(최근 3개만) → 바꾸기 → 휴지통 정리 → `runRollover` → 저장. 되돌리기용 사본을 돌려줘서 알림의 '되돌리기'가 `restoreSnapshot`으로 되돌려요.

### 5.13 휴지통 (`core/trash.js`)

- `deleteTodo`, `clearCompleted`, `deleteRule`이 지운 것을 `addToTrash`로 넣고 `batchId`를 돌려줘요. 화면은 그 묶음으로 '되돌리기'를 보여줘요.
- `purgeTrash`: 30일 지난 것과 100개를 넘는 것(오래된 것부터)을 빼요. 앱을 열 때·날짜 처리 때·넣을 때 정리해요.
- `restoreFromTrash({ entryId | batchId })`
  - 미완료 할 일은 `insertAt`으로 원래 `order` 자리에 넣고 `renumber`. 지난 날짜면 오늘로 옮기고 `carriedFrom`을 남겨요(안 그러면 `runRollover`가 반복 할 일을 다시 지우거나, 화면 어디에도 안 보여요).
  - 같은 id가 이미 있으면 건너뛰어요. 마지막에 `runRollover`를 불러 "다시 열었을 때"와 결과를 맞춰요(되살린 규칙의 `lastGeneratedDate`가 오늘이면 오늘 몫을 또 만들지 않아요).

### 5.14 성능 (100개 이상)

- **요소 재사용**: `render.js`의 `itemCache`(id → 요소). 화면에 보이는 값(내용·카테고리·완료·반복·이월·손잡이·검색어)이 같으면 전에 만든 요소를 그대로 써요.
- **최소 DOM 이동**: `syncChildren`이 원하는 순서와 다른 자리만 `insertBefore`로 옮겨요. 한 칸 옮기기·체크 하나는 DOM 작업 몇 번으로 끝나요.
- 반복 일정 목록·휴지통 목록은 내용이 바뀌었을 때만 다시 만들어요.
- **디바운스**(`core/debounce.js`): 검색 입력·중복 확인은 입력이 150ms 멈췄을 때 한 번만.
- 드래그 중에는 자리가 바뀐 항목에만 `transform`을 써요.
- 측정 (헤드리스 Chrome, CPU 4배 느리게 = 휴대폰 흉내, 중앙값):

| 할 일 300개 | 바꾸기 전 | 바꾼 뒤 |
|---|---|---|
| 체크 하나 | 72ms | 17ms |
| 한 칸 옮기기(키보드) | 64ms | 9ms |
| 필터 바꾸기 | 48ms | 31ms |
| 검색 글자 하나 입력 | — | 1ms (빠르게 5글자 → 다시 그리기 1번) |
| 검색 Enter(바로 찾기) | — | 37ms |

### 5.16 키워드 자동 분류 (`core/classify.js`)

- `classify(text, keywordsByCategory)` → `{ category, keyword }` 또는 `null`. 비교는 `normalizeText`(NFC·소문자·공백)와 부분 일치라 조사가 붙어도 찾아요.
- 여러 개 걸리면 ① 정리한 키워드가 긴 것 ② 내용에서 앞에 나온 것 ③ `CATEGORY_IDS` 순서.
- `effectiveKeywords(autoCategory)`: `keywords`가 `null`이면 `DEFAULT_CATEGORY_KEYWORDS`. 한 번도 안 고친 사람은 기본 키워드가 바뀌면 새것을 받아요. 처음 고칠 때 기본값을 복사해서 그 카테고리만 바꿔요(`store.setCategoryKeywords`).
- `parseKeywordInput`: 쉼표(·전각 쉼표·줄바꿈)로 나누고 공백 정리, 빈 것·20자 초과 빼기, 같은 것(정리한 글자 기준) 하나만, 카테고리당 50개까지. 저장된 값은 불러올 때 `normalizeKeywordMap`으로 다시 정리(깨져 있으면 `null` = 기본값).
- 시트(`ui/sheet.js`)
  - `add`·`rule-add`에서만. 입력이 멈추면(디바운스, 중복 확인과 같은 타이머) `autoClassify` → 칩을 골라요(`setRadio`는 `change`를 일으키지 않아서 '직접 고름'으로 치지 않아요).
  - 사용자가 칩을 누르면(`change`) `categoryTouched = true` → 이번 시트에서는 자동 분류를 멈춰요.
  - 키워드가 사라지면 열 때의 카테고리(`baseCategory`)로 되돌려요.
  - 저장할 때 디바운스를 `flush`해서, 입력하자마자 저장해도 분류가 적용돼요.
  - 자동으로 고른 채 저장하면 `addTodo/addRule(..., { remember: false })` → `lastCategory`를 안 바꿔요.
- 안내 문구의 조사는 `withParticle`(받침 보고 을/를·이/가·은/는, 한글이 아니면 "을(를)")로 붙여요.
- 더보기: 스위치(`role="switch"`), 카테고리별 여러 줄 칸(키워드가 많아도 보이게). `change`(다른 곳 누르기·Enter)에 저장하고 정리된 값으로 다시 보여줘요. 입력 중인 칸은 다시 그릴 때 덮어쓰지 않아요. `findKeywordConflicts`로 겹치는 키워드를 알려요.

## 6. 화면·스타일

- 디자인 기준은 [DESIGN-notion.md](DESIGN-notion.md)예요 ([TL-016](tech-log.md#tl-016)). 따뜻한 종이색 바탕(`--color-canvas` #f6f5f4) 위에 흰 카드, 1px 얇은 선(`--color-hairline`)과 아주 옅은 여러 겹 그림자(`--shadow-1`, `--shadow-2`)로 면을 나눠요.
- **구조를 칠하는 색은 파랑(`--color-primary` #0075de) 하나**: 주요 버튼, 체크, 선택된 필터·칩, 링크, 포커스. 다른 색으로 버튼이나 면을 칠하지 않아요.
- 예외: 떠 있는 **+ 버튼은 헤더 아이콘처럼 흑백**이에요. 글자색(`--color-ink`)으로 칠하고 + 는 바탕색(`--color-canvas`)이라, 라이트는 검은 원·흰 +, 다크는 흰 원·검은 + 로 저절로 뒤집혀요 ([TL-020](tech-log.md#tl-020)).
- 모양: 주요·보조 버튼과 배지는 알약(`--radius-full`), 입력창 4px, 작은 보조 버튼 8px, 카드 12px, 시트 16px.
- CSS 변수로 색과 간격을 정의해요 (`base.css`). 다크 모드는 변수만 바꿔요. 다크 변수는 두 곳에서 켜져요: `<html data-theme="dark">`(직접 고름) 또는 `prefers-color-scheme: dark`이면서 `data-theme="light"`가 아닐 때(시스템 설정, PRD F12). 저장된 모드는 `index.html` 머리의 작은 인라인 스크립트가 화면을 그리기 전에 적용해서 깜빡임이 없어요 ([TL-019](tech-log.md#tl-019)). 파랑은 칠하는 색(`--color-primary`)과 글자색(`--color-accent-text`, `--color-accent-text-strong`)을 나눠 둬서 다크 모드에서 글자만 밝게 바꿔요 ([TL-018](tech-log.md#tl-018)).
- 흐리게 보여야 할 글자에 `opacity`를 쓰지 않아요(대비가 떨어져요). 흐린 글자색 변수를 써요.
- 카테고리 색: 업무 `--cat-work`(파랑), 개인 `--cat-personal`(초록), 공부 `--cat-study`(주황). **작은 색 점에만** 쓰고 배지는 무채색 알약 + 색 점 + 글자예요. 색만으로 구분하지 않도록 글자를 항상 같이 넣어요.
- 글자 대비는 4.5:1 이상 (흐린 글자 `--color-ink-muted` #615d59). 가장 흐린 `--color-ink-faint`는 입력 안내(placeholder)·취소선 같은 장식에만 써요.
- 누르는 곳은 최소 44×44px.
- 노치·홈 바: `viewport-fit=cover` + `env(safe-area-inset-*)`로 여백을 줘요.
- 시트가 열리면 뒤 화면이 스크롤되지 않게 막고, 입력창에 바로 커서를 둬요.
- 휴대폰 확대 방지를 위해 입력창 글자 크기는 16px 이상이에요.

## 7. 접근성·보안

- 체크 버튼은 `<button aria-pressed>` 또는 `<input type="checkbox">`에 라벨을 붙여요.
- 시트는 `role="dialog"`, 열면 첫 입력창으로 포커스, Esc로 닫기.
- 드래그 외에도 순서를 바꿀 수 있도록 손잡이에 키보드(↑/↓) 이동을 지원해요.
- 사용자 입력은 `textContent`로만 화면에 넣어요 (XSS 방지).
- 외부로 데이터를 보내는 코드는 없어요.

## 8. 테스트

세 가지가 있어요. 아무것도 설치하지 않아도 돼요(Node·Chrome·Python만).

| 무엇 | 실행 | 걸리는 시간 |
|---|---|---|
| core 테스트 (순수 로직 78개) | 브라우저로 `tests/core.test.html` 열기, 또는 `node tests/run-core.mjs` | 1초 |
| store·storage 확인 (휴지통·가져오기·저장 실패 등) | `node tests/store.test.mjs` | 1초 |
| 브라우저 확인 (실제 화면을 눌러 보기, 185개) | `node tests/e2e/run.mjs` (고른 단계만: `node tests/e2e/run.mjs 04 07`) | 약 2분 |
| 성능 측정 | `node tests/e2e/run.mjs perf` (`PERF_N=100`처럼 개수 지정) | 1~2분 |

- **시간대**: `node tests/run-core.mjs --tz=America/Los_Angeles`. Windows(Git Bash 등)에서는 `TZ=… node`가 무시되니 꼭 `--tz=`로 넘겨요.
- **브라우저 확인 방식**: Chrome 확장·라이브러리 없이, 설치된 Chrome(없으면 Edge)을 헤드리스로 띄워 DevTools 프로토콜(Node 22 내장 WebSocket)로 조작해요. 실제 터치·마우스·키 입력, 서버를 끈 뒤 새로고침(오프라인), PC IP 접속, 라이트·다크 글자 대비, 두 탭, 파일 내려받기·올리기까지 확인해요.
  - `run.mjs`가 Chrome·Python을 찾고, 앱 서버(`BASE_URL`, 기본 `http://localhost:8000/`)가 없으면 잠깐 띄우고, 단계마다 `harness.js + audit.js + steps/<단계>.js`를 이어 붙여 실행해요. 단계 파일은 단독 실행 파일이 아니에요(공통 함수 `send·evaluate·check`를 그냥 써요).
  - 단계마다 새 Chrome 프로필(서비스 워커·저장소가 빈 상태)로 시작해요.
  - 결과(스크린샷·단계별 로그)는 `tests/e2e/.output/`에 남고 git에는 올라가지 않아요.
  - 환경 변수로 바꿀 수 있어요: `CHROME_PATH`, `BASE_URL`, `PYTHON`, `CDP_PORT`, `SECOND_PORT`(5단계가 껐다 켜는 서버, 기본 8001).
  - 사설 IP가 없는 컴퓨터에서는 "PC IP로 접속" 확인을 건너뛰어요.
  - `python -m http.server`는 동시에 연결이 몰리면 가끔 한 번 거절해요(`ERR_CONNECTION_REFUSED`). 그 단계만 다시 돌리면 돼요(앱 문제 아님).
- **기능을 바꾸면**: 관련 단계 파일의 기대값도 같이 고쳐요. 앱 파일을 더하면 5단계의 캐시 파일 개수(`sw.count`)도 바꿔요.

core 테스트에서 확인하는 것:

- `tests/core.test.html`: 브라우저로 열면 `core/` 함수들을 실행하고 통과/실패를 화면에 보여주는 간단한 페이지예요. 테스트 프레임워크 없이 `console.assert` 수준으로 만들어요.
  - 이월: 어제 미완료 → 오늘로, 어제 완료 → 그대로, 어제 반복 미완료 → 삭제
  - 반복: 평일 규칙이 토요일엔 안 생김, 같은 날 두 번 실행해도 하나만 생김
  - 날짜: 한국 시간 새벽에도 오늘 날짜가 맞게 나옴
  - 진행률: 0개일 때 0%
  - id: `crypto.randomUUID`가 없을 때도 `createId()`가 서로 다른 값을 돌려줌
  - 글자(v0.5): NFD 한글 정리, 여러 낱말 AND 검색, 강조 구간 합치기, 중복 할 일·반복 일정 찾기(자기 자신·완료·다른 날 제외)
  - 정렬(v0.5): 직접·생성일·카테고리·완료 상태(합친 목록), 받은 배열 안 바꿈
  - 디바운스(v0.5): 가짜 타이머로 마지막 값 한 번, flush·cancel
  - 휴지통(v0.5): 최근 것 먼저, 30일·100개 정리, 묶음 꺼내기 / 순서: `insertAt`
  - 자동 분류(v0.7): 조사 붙은 키워드, 대소문자·NFD, 긴 것→앞에 나온 것→카테고리 순서, 기본 키워드(두 글자 이상, 겹침 없음), 입력 정리, 저장값 정리, 겹침 찾기 / 조사 `withParticle`
  - 순서: 이월 2개 + 일반 3개일 때 새 할 일은 3번째 자리, 이월 항목을 아래로 드래그한 뒤에는 맨 위, 완료 취소는 맨 아래, 어떤 경우든 `order`가 0부터 빈틈없이 이어짐
- 수동 확인 목록 (마일스톤마다 [개발로그](dev-log.md)에 결과 기록):
  - 휴대폰 실제 기기에서 추가·체크·드래그
  - 새로고침 후 데이터 유지
  - 기기 날짜를 다음 날로 바꿔서 이월·반복 확인
  - PC IP 주소(`http://`)로 접속해서 할 일 추가가 되는지
  - 홈 화면 추가 후 비행기 모드에서 열리는지

## 9. 문서 관리 규칙

| 문서 | 언제 고치나 |
|---|---|
| PRD | 기능(무엇을)이 바뀔 때. 변경 이력 표에 한 줄 추가 |
| TRD | 구조·데이터·로직(어떻게)이 바뀔 때. 문서 버전 올림 |
| 개발로그 | 작업한 날마다. 한 일, 문제, 다음 할 일 |
| 기술로그 | 기술적인 선택을 할 때. 번호(TL-xxx)를 붙여 이유와 대안을 남김 |

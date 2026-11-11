# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 상태

**MyTask** — 휴대폰 중심 개인용 할 일 관리 PWA. 내부 이름(저장 키·캐시 접두사·내보내기 `app` 표시·저장소)은 `task-manager` 그대로 (TL-025). M1~M8 + PRD v0.6~v0.8(F13 검색, F14 보기 정렬, F15 내보내기·가져오기, F16 중복 경고, F17 휴지통, 성능, F18 키워드 자동 분류) 개발 완료. **배포됨**: https://yanniart.github.io/task-manager/ (공개 저장소 `yanniart/task-manager`, `main` push → Pages 1~2분 뒤 반영). 실제 휴대폰(Android Chrome·iPhone Safari) 확인까지 모두 통과(개발로그). 남은 작업 없음. 진행 현황은 `docs/dev-log.md` 위쪽 표를 확인.

설계의 기준은 문서다. 코드를 쓰기 전에 관련 부분을 읽을 것:
- `docs/PRD.md` — 기능(F1~F11, F9는 제거된 번호라 비워 둠), 화면, 마일스톤 M1~M8
- `docs/TRD.md` — 폴더 구조, 의존 방향, 데이터 모델, 핵심 로직(5장), 테스트(8장)
- `docs/tech-log.md` — 기술 결정 TL-001~TL-011과 이유
- `docs/roadmap.md` — 차후 계획(R0 지난 기록, R1 통계, R2 달력, R3 동기화, R4 알림). 확정 전이라 시작할 때 PRD에 기능 번호를 붙이고 "정해야 할 것"을 먼저 물어볼 것. R3·R4는 서버가 필요해 원칙(서버·외부 요청 없음)을 바꾸는 결정
- `docs/prompts.md` — 이어서 작업할 때 쓰는 프롬프트. 처음 1~5단계 프롬프트는 끝난 기록이라 그대로 따르지 말 것

## 실행·테스트

빌드·린트·패키지 매니저 없음. ES 모듈과 서비스 워커 때문에 `file://`로는 동작하지 않으므로 로컬 서버로 연다.

```bash
python -m http.server 8000      # http://localhost:8000
```

테스트 (TRD 8장, 프레임워크 없음):

```bash
node tests/run-core.mjs [--tz=America/Los_Angeles]   # core 78개, 1초 (core.test.html의 스크립트를 Node에서)
node tests/store.test.mjs                            # store·storage, 1초
node tests/e2e/run.mjs [02 07 ...]                   # 브라우저 확인 185개, 약 2분 (단계 파일 이름 앞부분으로 고르기)
node tests/e2e/run.mjs perf                          # 성능 측정 (PERF_N=300)
BASE_URL=https://yanniart.github.io/task-manager/ node tests/e2e/run.mjs deployed   # 배포 주소 확인 (기본 실행에서는 빠짐)
```

- `tests/core.test.html`은 브라우저에서도 열 수 있음(제목 ✅/❌, `globalThis.__testSummary`). 개별 테스트만 고르는 기능은 없음.
- **시간대는 `--tz=`로**: Windows에서는 `TZ=… node`가 무시됨(실제로 겪음, 개발로그 참고).
- e2e 단계 파일(`tests/e2e/steps/*.js`)은 단독 실행 불가 — `run.mjs`가 `harness.js`+`audit.js` 뒤에 이어 붙여 실행. 기능을 바꾸면 해당 단계의 기대값도 고칠 것. 캐시 버전·파일 개수는 확인 스크립트가 `sw.js`에서 직접 읽음.
- `python -m http.server`가 가끔 연결을 한 번 거절함 → 그 단계만 다시 돌리면 됨.
- 모바일 확인은 375px 화면 기준. 휴대폰에서 PC IP(`http://192.168...`)로 접속하면 서비스 워커와 `crypto.randomUUID`가 없으므로 이 환경에서도 앱이 멈추지 않아야 함.
- 개발용 `?today=YYYY-MM-DD`로 날짜를 바꿔 이월·반복을 확인 (localhost·사설 IP에서만 켜짐, TL-014). 날짜를 앞으로 되돌리면 뒤 날짜에 만든 할 일은 "미래"라서 안 보임.
- 브라우저 확인은 Chrome 확장 없이, 설치된 Chrome을 헤드리스로 띄워 DevTools 프로토콜(Node 22 내장 WebSocket)로 조작(`tests/e2e/`).

## 아키텍처 핵심

순수 HTML/CSS/JS(ES2020+)만 사용. 프레임워크·라이브러리·npm·빌드 도구 금지.

**의존 방향** (TRD 3장): `main.js → ui/* → store.js → storage.js`, 그리고 `ui/`, `store.js`, `features/` → `core/`.
- `js/core/`는 DOM을 모르는 순수 함수이며 다른 폴더를 import하지 않음 (`constants.js`만 예외).
- 상태 변경 함수는 `store.js`에만 있다. 변경 → `storage.save()` → 구독자(`render`) 호출. `store.js`는 DOM을 건드리지 않음.
- `ui/` 모듈끼리는 직접 부르지 않고 `render.js`를 거친다. 예: 시트 ↔ 반복 일정 관리 화면은 `render.js`가 `initSheet`/`initRulesView`에 콜백을 넘겨서 연결.
- 시트(`ui/sheet.js`)는 `add / edit / rule-add / rule-edit` 네 모드 (TL-015). 반복 일정 관리 화면 위에 시트가 겹쳐 열릴 수 있어서, 시트는 뒤 화면들의 `inert`를 기억했다 되돌리고 스크롤 잠금 클래스도 `is-sheet-open` / `is-rules-open`으로 나뉨.
- 규칙 추가·수정·다시 시작 후에도 `runRollover`를 다시 불러 오늘 몫을 만든다 → "저장 직후"와 "다시 열었을 때" 결과가 같음.
- 상태가 바뀌면 `render`가 화면 전체를 다시 계산 (TL-007). 단 할 일 줄 요소는 `itemCache`로 재사용하고 `syncChildren`이 바뀐 자리만 옮김(100개 이상 성능, TL-021) — 줄에 보이는 값을 새로 추가하면 `itemFor`의 key에도 넣을 것. 드래그 중에는 render를 미뤘다가 놓은 뒤 한 번만.

**데이터** (TRD 4장): `localStorage` 키 `task-manager` 하나에 `{ version, todos, rules, settings }`. 구조를 바꾸면 `version`을 올리고 `storage.js`에 마이그레이션 추가. 파싱 실패 시 원본을 `task-manager.backup.<시각>`에 복사하고 빈 상태로 시작.

**놓치기 쉬운 규칙**
- 날짜 키는 반드시 `core/date.js`의 로컬 `'YYYY-MM-DD'` 문자열. `toISOString()`으로 날짜 키를 만들지 말 것 (UTC라 한국 시간 오전 9시 전 하루 밀림, TL-005).
- id는 `core/id.js`의 `createId()`만 사용. `crypto.randomUUID()` 직접 호출 금지 (TL-010).
- 미완료 목록의 `order`는 0부터 빈틈없는 정수. 끼워 넣기·이동은 `core/order.js`(`insertIndex`/`insertNew`/`appendLast`/`move`/`renumber`)로만 하고 매번 `renumber` (TL-011, TRD 5.4). 새 할 일·반복 생성 → 맨 위에 **연속된** 이월 항목 바로 아래, 완료 취소 → 맨 아래.
- `runRollover(state, todayKey)`(TRD 5.2)는 멱등이어야 함. 앱 열 때 / `visibilitychange` / 자정 `setTimeout`에서 호출. 반복으로 생긴 할 일(`ruleId` 있음)은 이월하지 않고 지난 미완료분은 삭제 (TL-006). 중복 생성은 규칙의 `lastGeneratedDate`로 방지.
- 진행률은 오늘 날짜 항목만. 지난 날짜 완료 항목은 "이전에 완료한 항목" 접힘 구역에 표시하고 진행률에서 제외.
- 드래그는 Pointer Events로 직접 구현 (HTML5 DnD·라이브러리 금지, TL-004, `ui/drag.js`). 필터가 켜져 있으면 `order.moveVisible`로 보이는 항목들이 차지하던 자리 안에서만 섞음. 드래그와 키보드 ↑/↓ 모두 `store.reorderTodo(id, 보이는 목록 안 위치)`를 씀. 드래그 중에는 `render`가 요청을 미뤘다가 끝난 뒤 한 번 그림 (TL-017).
- 사용자 입력은 `textContent`로만 DOM에 넣는다 (`innerHTML` 금지). 이벤트는 목록 부모에 위임하고 `data-id`로 찾음.
- PWA: 모든 경로는 상대 경로(`./`) — GitHub Pages 하위 경로 `/task-manager/` 대응. **앱 파일을 고치면 `sw.js`의 `CACHE_VERSION`을 올리고, 새 파일은 `APP_FILES`에 추가할 것.** 서비스 워커 등록은 `isSecureContext`(HTTPS/localhost)에서만. 캐시 먼저라 localhost에서도 고친 파일이 바로 안 보일 수 있음 (헤드리스 확인은 매번 새 프로필로 하면 문제없음).
- 다크 모드는 `base.css`의 `:root[data-theme="dark"]` 변수 한 곳만. `data-theme`(light/dark)은 JS가 정함: 저장값 `settings.theme`(system/light/dark, PRD F12) + 시스템 설정. `index.html` 머리의 인라인 스크립트와 `ui/theme.js`가 같은 규칙이라 바꿀 땐 두 곳 모두 (TL-019). 파랑 글자는 `--color-accent-text(-strong)`, 파랑 면은 `--color-primary`. 흐린 표시에 `opacity` 쓰지 말 것(대비 저하, TL-018).
- 아이콘 PNG는 `node tools/make-icons.mjs`로 `assets/icons/*.svg`에서 만듦(헤드리스 Chrome). 아이콘을 바꾸면 SVG를 고치고 이걸 돌린 뒤 `CACHE_VERSION`을 올릴 것.
- 모바일: 터치 영역 44px 이상, 입력 글자 16px 이상, `env(safe-area-inset-*)`, 다크 모드는 `prefers-color-scheme`로 `base.css` 변수만 바꿈.
- 디자인 기준은 `docs/DESIGN-notion.md` (TL-016, TRD 6장): 종이색 바탕 + 흰 카드 + 얇은 선. **버튼·면을 칠하는 색은 `--color-primary` 하나**이고, 카테고리 색(`--cat-*`)은 작은 색 점에만 씀. 새 색을 하드코딩하지 말고 `base.css` 변수를 쓸 것. 글자 대비 4.5:1 이상(`--color-ink-faint`는 장식 전용). 웹 글꼴은 불러오지 않음.
- 360px에서 요일 7칸이 44px을 넘으려면 시트 좌우 여백은 16px이 한계.

**v0.6 기능에서 놓치기 쉬운 것** (TL-021)
- 화면에 보이는 조건 = 카테고리 필터 + 검색어(`render.js`의 `currentVisible`). 순서 바꾸기는 이 조건을 `reorderTodo(id, to, isVisible)`에 넘겨 보이는 것끼리만 섞음.
- 보기 정렬(`settings.sort`)은 보는 순서만. `manual`이 아니면 손잡이를 안 달아서 `order`는 안 바뀜. `status`는 미완료+완료를 한 목록(`merged`)으로. UI는 필터 탭 아래 도구 줄 오른쪽의 아이콘 메뉴(`ui/sort-menu.js`, TL-022). 더보기에는 데이터·휴지통만.
- 지우기는 모두 휴지통(`state.trash`)으로: `deleteTodo`/`clearCompleted`/`deleteRule`이 `batchId`를 돌려주고 화면은 그걸로 '되돌리기'. 되살릴 땐 `restoreFromTrash`(지난 날짜 미완료는 오늘로+이월 표시).
- 가져오기 파일 검사는 `storage.parseImport`(밖에서 온 파일이라 load보다 엄격). `ui/`는 `store.parseImportText`를 거침. 적용은 `importState`(백업+되돌리기용 사본).
- 비교·검색은 `core/text.js`(NFC·공백·대소문자 정리). 저장할 때도 NFC.
- 다른 탭 변경은 `storage` 이벤트 → `replaceState`. 저장 실패는 `onSaveError` → 알림.
- 디바운스 기본 타이머는 `setTimeout`을 함수로 감싸서 씀(그대로 꺼내 부르면 브라우저에서 Illegal invocation).
- 키워드 자동 분류(F18, TL-023): `core/classify.js`. 시트의 `add`·`rule-add`에서만, 칩을 직접 누르면(`change`) 멈춤, 저장 전 디바운스 `flush`, 자동 선택은 `{ remember: false }`로 `lastCategory`를 안 바꿈. `settings.autoCategory.keywords`가 `null`이면 `DEFAULT_CATEGORY_KEYWORDS`. 기본 키워드는 두 글자 이상·카테고리끼리 안 겹치게(테스트가 확인). 사용자에게 보이는 조사는 `withParticle`.

**배포할 때** (사용자가 요청할 때만 push)
- 앱 파일(HTML·CSS·JS·아이콘·manifest)을 바꿨으면 `sw.js`의 `CACHE_VERSION`을 올리고 새 파일은 `APP_FILES`에. 문서·테스트만 바꿨으면 올리지 않아도 됨(캐시 대상이 아님).
- push 뒤 `gh api repos/yanniart/task-manager/pages/builds/latest`로 빌드가 `built`인지 보고 `deployed` 확인을 돌릴 것.

**이름 규칙**: 파일 kebab-case, 함수·변수 camelCase, 상수 UPPER_SNAKE, CSS BEM(`todo__text--done`), `export function`만, 전역 변수 금지.

## 문서 갱신 규칙 (TRD 9장)

- 작업한 날은 `docs/dev-log.md`에 날짜별로 한 일·문제·다음 할 일을 최신이 위로 추가하고 진행 현황 표 갱신.
- 문서와 다르게 구현했거나 기술적 선택을 했으면 `docs/tech-log.md`에 다음 TL 번호로 이유·대안 기록. 결정을 뒤집을 땐 옛 항목을 지우지 말고 상태를 `대체됨 → TL-xxx`로.
- 기능이 바뀌면 PRD 변경 이력에 한 줄, 구조·로직이 바뀌면 TRD 버전을 올림.
- 문서는 한국어, 친근한 해요체로 작성.

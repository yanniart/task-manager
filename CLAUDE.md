# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 현재 상태와 다음에 할 일

**MyTask** — 휴대폰 중심 개인용 할 일 관리 PWA (순수 HTML/CSS/JS, 서버 없음).

- **완료**: PRD v0.9 (F1~F18, F9는 빈 번호) 개발·자동 확인·배포·실제 휴대폰(Android Chrome·iPhone Safari) 확인까지 끝. 남은 버그·할 일 없음.
- **배포**: https://yanniart.github.io/task-manager/ — 공개 저장소 `yanniart/task-manager`, `main` 브랜치 루트를 GitHub Pages로. push하면 1~2분 뒤 반영.
- **다음 후보** (`docs/roadmap.md`, 아직 확정 아님): R0 지난 기록 남기기 → R1 통계 → R2 달력 (서버 불필요) → R3 기기 간 동기화 → R4 알림 (서버 필요, 원칙 변경 결정이 먼저).
  - 시작 요청이 오면 roadmap의 해당 절 "정해야 할 것"을 **먼저 사용자에게 물어보고**, 정해지면 PRD에 기능 번호(F19~)를 붙인 뒤 진행.
  - R0은 저장 형식 `version: 2` 첫 마이그레이션이 필요함(roadmap R0 설계 초안).
- 이름: 사용자에게 보이는 이름은 MyTask, 내부 이름(저장 키 `task-manager`·캐시 접두사 `tm-cache-`·내보내기 `app` 표시·저장소·주소)은 **바꾸지 말 것** (TL-025, 바꾸면 저장된 데이터·설치한 앱이 끊김).

### 세션을 시작할 때

1. `git status` / `git log --oneline -5`로 작업 트리가 깨끗한지, `origin/main`과 같은지 확인.
2. `docs/dev-log.md` 맨 위 기록과 진행 현황 표를 읽기 (최신이 위).
3. 작업 전 기준선: `node tests/run-core.mjs && node tests/store.test.mjs` (각 1초). 화면을 건드릴 거면 `node tests/e2e/run.mjs`(약 2분)도.
4. 개발 서버: `python -m http.server 8000` (e2e 실행기는 서버가 없으면 알아서 띄움).

## 문서 (설계의 기준은 문서다 — 코드를 쓰기 전에 관련 부분을 읽을 것)

- `docs/PRD.md` (v0.9) — 무엇을: 기능 F1~F18, 화면, 마일스톤 M1~M8, 범위 밖 → roadmap 연결
- `docs/TRD.md` (v0.8) — 어떻게: 폴더 구조·의존 방향(3장), 데이터 모델(4장), 핵심 로직 5.1~5.16, 화면·스타일(6장), 테스트(8장)
- `docs/tech-log.md` — 기술 결정 TL-001~TL-025와 이유·대안
- `docs/dev-log.md` — 날짜별 기록, 확인 결과, 진행 현황
- `docs/DESIGN-notion.md` — 디자인 기준 (TL-016)
- `docs/roadmap.md` — 차후 계획 R0~R4 (설계 초안·정해야 할 것·완료 기준)
- `docs/prompts.md` — 이어서 작업할 때 쓰는 프롬프트. 아래쪽 1~5단계 프롬프트는 끝난 기록이라 그대로 따르지 말 것

## 실행·테스트

빌드·린트·패키지 매니저 없음. ES 모듈과 서비스 워커 때문에 `file://`로는 동작하지 않으므로 로컬 서버로 연다.

```bash
python -m http.server 8000                           # http://localhost:8000
node tests/run-core.mjs [--tz=America/Los_Angeles]   # core 78개, 1초 (core.test.html의 스크립트를 Node에서)
node tests/store.test.mjs                            # store·storage 23개, 1초
node tests/e2e/run.mjs [02 07 ...]                   # 브라우저 확인 185개, 약 2분 (단계 파일 이름 앞부분으로 고르기)
node tests/e2e/run.mjs perf                          # 성능 측정 (PERF_N=300)
BASE_URL=https://yanniart.github.io/task-manager/ node tests/e2e/run.mjs deployed   # 배포 주소 확인 9개 (기본 실행에서는 빠짐)
node tools/make-icons.mjs [--out=폴더]               # 아이콘 SVG → PNG
```

- 필요: Node 22 이상(내장 WebSocket), Chrome 또는 Edge(`CHROME_PATH`), Python 3.
- `tests/core.test.html`은 브라우저에서도 열 수 있음(제목 ✅/❌, `globalThis.__testSummary`). 개별 테스트만 고르는 기능은 없음.
- **시간대는 `--tz=`로**: Windows에서는 `TZ=… node`가 무시됨(실제로 겪음, TL-024).
- e2e 단계 파일(`tests/e2e/steps/*.js`)은 단독 실행 불가 — `run.mjs`가 `harness.js`+`audit.js` 뒤에 이어 붙여 실행(공통 함수 `send·evaluate·go·check·shot`을 그냥 씀). 기능을 바꾸면 해당 단계의 기대값도 고칠 것. 캐시 버전·파일 개수는 확인 스크립트가 `sw.js`에서 직접 읽음. 결과·스크린샷은 `tests/e2e/.output/`(git 무시).
- 새 기능에는 확인을 같이 만든다: 계산은 `core/` 순수 함수 + `core.test.html`에 테스트, 화면은 `tests/e2e/steps/`에 단계 추가, 라이트·다크 글자 대비는 `audit()`로.
- `python -m http.server`가 가끔 연결을 한 번 거절함(`ERR_CONNECTION_REFUSED`) → 그 단계만 다시 돌리면 됨(앱 문제 아님).
- 모바일 기준 375px(최소 360px). 휴대폰에서 PC IP(`http://192.168...`)로 접속하면 서비스 워커와 `crypto.randomUUID`가 없으므로 이 환경에서도 앱이 멈추지 않아야 함.
- 개발용 `?today=YYYY-MM-DD`로 날짜를 바꿔 이월·반복을 확인 (localhost·사설 IP에서만 켜짐, 배포 주소에서는 꺼짐, TL-014). 날짜를 앞으로 되돌리면 뒤 날짜에 만든 할 일은 "미래"라서 안 보임.

## 작업 환경 주의 (Windows, 실제로 겪은 것)

- **한국어가 든 수정은 파일로**: Git Bash에서 `python -c "…"`·`node -e "…"`·`<<EOF` 안에 한국어를 넣으면 cp949로 깨져서 문자열 찾기가 실패함. 수정 스크립트를 Write로 파일에 쓰고 실행하거나 Edit 도구를 쓸 것.
- Python `write_text`는 Windows에서 CRLF로 씀 → `.gitattributes`(`* text=auto eol=lf`)가 저장소에는 LF로 넣으므로 커밋 때 나오는 "CRLF will be replaced by LF" 경고는 무시해도 됨.
- 콘솔 출력의 한국어가 깨져 보여도 파일 내용은 UTF-8로 정상.
- e2e는 단계마다 새 Chrome 프로필 폴더를 씀(같은 폴더를 지우고 다시 쓰면 Windows에서 `EPERM`).

## 아키텍처 핵심

순수 HTML/CSS/JS(ES2020+)만 사용. 프레임워크·라이브러리·npm·빌드 도구·웹 글꼴·외부 요청 금지 (R3·R4를 시작하면 이 원칙을 바꾸는 결정을 TL로 먼저 남길 것).

**의존 방향** (TRD 3장): `main.js → ui/* → store.js → storage.js`, 그리고 `ui/`, `store.js`, `storage.js`, `features/` → `core/`.
- `js/core/`는 DOM을 모르는 순수 함수이며 다른 폴더를 import하지 않음 (`constants.js`만 예외).
- 상태 변경 함수는 `store.js`에만 있다. 변경 → `storage.save()` → 구독자(`render`) 호출. `store.js`는 DOM을 건드리지 않음. `ui/`는 `storage.js`를 직접 부르지 않음(예: `store.parseImportText`).
- `ui/` 모듈끼리는 직접 부르지 않고 `render.js`를 거친다(콜백을 넘겨 연결). 예외: 공용 도우미 없음 — 같은 배지 함수도 `rules-view.js`·`more-view.js`에 따로 둠.
- 시트(`ui/sheet.js`)는 `add / edit / rule-add / rule-edit` 네 모드 (TL-015). 반복 일정 관리 화면 위에 시트가 겹쳐 열릴 수 있어서(더보기 화면에서는 시트를 열지 않음), 시트는 뒤 화면들의 `inert`를 기억했다 되돌리고 스크롤 잠금 클래스도 `is-sheet-open` / `is-rules-open`으로 나뉨.
- 상태가 바뀌면 `render`가 화면 전체를 다시 계산 (TL-007). 단 할 일 줄 요소는 `itemCache`로 재사용하고 `syncChildren`이 바뀐 자리만 옮김(100개 이상 성능, TL-021) — 줄에 보이는 값을 새로 추가하면 `itemFor`의 key에도 넣을 것. 드래그 중에는 render를 미뤘다가 놓은 뒤 한 번만.

**데이터** (TRD 4장): `localStorage` 키 `task-manager` 하나에 `{ version: 1, todos, rules, trash, settings: { filter, lastCategory, lastOpenedDate, theme, sort, autoCategory } }`. 필드를 **더하는** 것은 `storage.normalize`가 기본값을 채워서 버전을 안 올려도 됨. 구조를 **바꾸면** `version`을 올리고 `storage.js`의 `migrations`에 변환 추가(+ 예전 데이터로 테스트). 파싱 실패 시 원본을 `task-manager.backup.<시각>`에 복사하고 빈 상태로 시작. 가져오기 전 백업은 `task-manager.backup.import.<시각>`(최근 3개).

**놓치기 쉬운 규칙**
- 날짜 키는 반드시 `core/date.js`의 로컬 `'YYYY-MM-DD'` 문자열. `toISOString()`으로 날짜 키를 만들지 말 것 (UTC라 한국 시간 오전 9시 전 하루 밀림, TL-005).
- id는 `core/id.js`의 `createId()`만 사용. `crypto.randomUUID()` 직접 호출 금지 (TL-010).
- 미완료 목록의 `order`는 0부터 빈틈없는 정수. 끼워 넣기·이동은 `core/order.js`(`insertIndex`/`insertNew`/`insertAt`/`appendLast`/`move`/`moveVisible`/`renumber`)로만 하고 매번 `renumber` (TL-011, TRD 5.4). 새 할 일·반복 생성 → 맨 위에 **연속된** 이월 항목 바로 아래, 완료 취소 → 맨 아래, 휴지통 복구 → 원래 자리.
- `runRollover(state, todayKey)`(TRD 5.2)는 받은 상태를 안 바꾸는 순수 함수이고 멱등이어야 함. 앱 열 때 / `visibilitychange` / 자정 `setTimeout`에서 호출. 규칙 추가·수정·다시 시작·휴지통 복구·가져오기 뒤에도 다시 불러 "저장 직후"와 "다시 열었을 때" 결과를 같게. 반복으로 생긴 할 일(`ruleId` 있음)은 이월하지 않고 지난 미완료분은 삭제 (TL-006). 중복 생성은 규칙의 `lastGeneratedDate`로 방지.
- 진행률은 오늘 날짜 항목만, 필터·검색과 무관. 지난 날짜 완료 항목은 "이전에 완료한 항목" 접힘 구역에 표시하고 진행률에서 제외.
- 화면에 보이는 조건 = 카테고리 필터 + 검색어(`render.js`의 `currentVisible`). 드래그·키보드 ↑/↓는 이 조건을 `store.reorderTodo(id, 보이는 목록 안 위치, isVisible)`에 넘겨 `moveVisible`로 보이는 것끼리만 섞음 (TL-017, TL-021).
- 드래그는 Pointer Events로 직접 구현 (HTML5 DnD·라이브러리 금지, TL-004, `ui/drag.js`).
- 보기 정렬(`settings.sort`)은 보는 순서만. `manual`이 아니면 손잡이를 안 달아서 `order`는 안 바뀜. `status`는 미완료+완료를 한 목록(`merged`)으로. UI는 필터 탭 아래 도구 줄 오른쪽 아이콘 메뉴(`ui/sort-menu.js`, TL-022).
- 지우기는 모두 휴지통(`state.trash`, 30일·100개)으로: `deleteTodo`/`clearCompleted`/`deleteRule`이 `batchId`를 돌려주고 화면은 그걸로 '되돌리기' 알림. 되살릴 땐 `restoreFromTrash`(지난 날짜 미완료는 오늘로+이월 표시).
- 가져오기 파일 검사는 `storage.parseImport`(밖에서 온 파일이라 load보다 엄격). 적용은 `store.importState`(백업 + 되돌리기용 사본).
- 비교·검색·중복 확인·자동 분류는 `core/text.js` 규칙(NFC·공백·대소문자 정리). 저장할 때도 NFC. 사용자에게 보이는 조사는 `withParticle`.
- 키워드 자동 분류(F18, TL-023): `core/classify.js`. 시트의 `add`·`rule-add`에서만, 칩을 직접 누르면(`change`) 멈춤, 저장 전 디바운스 `flush`, 자동 선택은 `{ remember: false }`로 `lastCategory`를 안 바꿈. `settings.autoCategory.keywords`가 `null`이면 `DEFAULT_CATEGORY_KEYWORDS`(두 글자 이상·카테고리끼리 안 겹침, 테스트가 확인).
- 디바운스(`core/debounce.js`) 기본 타이머는 `setTimeout`을 함수로 감싸서 씀(그대로 꺼내 부르면 브라우저에서 Illegal invocation).
- 다른 탭 변경은 `storage` 이벤트 → `store.replaceState`. 저장 실패는 `store.onSaveError` → 알림.
- 사용자 입력은 `textContent`로만 DOM에 넣는다 (`innerHTML`은 고정 아이콘 SVG에만). 이벤트는 목록 부모에 위임하고 `data-id`로 찾음.

**PWA**
- 모든 경로는 상대 경로(`./`) — GitHub Pages 하위 경로 `/task-manager/` 대응.
- **앱 파일(HTML·CSS·JS·아이콘·manifest)을 고치면 `sw.js`의 `CACHE_VERSION`을 올리고(지금 v7), 새 파일은 `APP_FILES`에 추가.** 문서·테스트·도구만 바꿨으면 올리지 않아도 됨.
- 서비스 워커 등록은 `isSecureContext`(HTTPS/localhost)에서만. 캐시 먼저라 localhost에서도 고친 파일이 바로 안 보일 수 있음(개발자 도구 "Update on reload"; 헤드리스 확인은 매번 새 프로필이라 문제없음).
- 아이콘 PNG는 `node tools/make-icons.mjs`로 `assets/icons/*.svg`에서 만듦. 아이콘을 바꾸면 SVG를 고치고 이걸 돌린 뒤 `CACHE_VERSION`을 올릴 것.

**화면·디자인** (`docs/DESIGN-notion.md`, TL-016, TRD 6장)
- 종이색 바탕 + 흰 카드 + 얇은 선. **버튼·면을 칠하는 색은 `--color-primary` 하나**(예외: + 버튼·알림은 흑백, TL-020). 카테고리 색(`--cat-*`)은 작은 색 점에만. 새 색을 하드코딩하지 말고 `base.css` 변수를 쓸 것.
- 다크 모드는 `base.css`의 `:root[data-theme="dark"]` 변수 한 곳만. `data-theme`(light/dark)은 JS가 정함: 저장값 `settings.theme`(system/light/dark, PRD F12) + 시스템 설정. `index.html` 머리의 인라인 스크립트와 `ui/theme.js`가 같은 규칙이라 바꿀 땐 두 곳 모두 (TL-019).
- 파랑 글자는 `--color-accent-text(-strong)`(옅은 파랑·종이색 바탕 위는 `-strong`), 파랑 면은 `--color-primary`. 흐린 표시에 `opacity` 쓰지 말 것(대비 저하, TL-018). 글자 대비 4.5:1 이상(`--color-ink-faint`는 장식 전용) — e2e의 `audit()`이 확인.
- 터치 영역 44px 이상, 입력 글자 16px 이상, `env(safe-area-inset-*)`. 360px에서 요일 7칸이 44px을 넘으려면 시트 좌우 여백은 16px이 한계. 헤더는 제목 한 줄 + 오른쪽 아이콘 4개, 날짜는 제목 아래 줄.

**이름 규칙**: 파일 kebab-case, 함수·변수 camelCase, 상수 UPPER_SNAKE, CSS BEM(`todo__text--done`), `export function`만, 전역 변수 금지.

## git·배포

- 브랜치 `main` 하나. 커밋 작성자는 로컬 git 설정(`yanniart`). 커밋 메시지는 한국어 제목 + 바뀐 것 목록 + `Co-Authored-By` 줄. 메시지는 파일로 써서 `git commit -F`(한국어 깨짐 방지).
- **커밋·push는 사용자가 요청할 때만.** 공개 저장소라 push하면 바로 공개되고 Pages에도 반영됨.
- 배포 순서: (앱 파일이 바뀌었으면 `CACHE_VERSION` 올림) → 확인 통과 → 커밋 → push → `gh api repos/yanniart/task-manager/pages/builds/latest`로 빌드 확인(이 조회는 늦게 갱신될 때가 있으니 사이트의 `manifest.webmanifest`·`sw.js`를 직접 받아 봐도 됨) → `deployed` 확인.

## 문서 갱신 규칙 (TRD 9장)

- 작업한 날은 `docs/dev-log.md`에 날짜별로 한 일·확인 결과·문제와 해결을 최신이 위로 추가하고 진행 현황 표 갱신.
- 문서와 다르게 구현했거나 기술적 선택을 했으면 `docs/tech-log.md`에 다음 TL 번호(다음은 TL-026)로 이유·대안 기록. 결정을 뒤집을 땐 옛 항목을 지우지 말고 상태를 `대체됨 → TL-xxx`로.
- 기능이 바뀌면 PRD 변경 이력에 한 줄(다음은 v1.0 또는 v0.10), 구조·로직이 바뀌면 TRD 버전을 올림.
- 확인 결과를 문서에 쓸 때는 실제로 돌린 값만 쓴다(예전에 시간대 확인이 실제로는 안 된 채 "통과"로 적은 적이 있음, TL-024).
- 문서는 한국어, 친근한 해요체로 작성.

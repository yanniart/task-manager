# MyTask

매일 10~20개의 할 일을 관리하는 개인용 웹 앱이에요. 휴대폰에서 쓰기 좋게 만들고, 홈 화면에 추가하면 앱처럼 쓸 수 있어요.

- 할 일 추가·수정·삭제, 완료 체크
- 카테고리(업무/개인/공부)와 필터
- 오늘의 진행률
- 못 끝낸 일 다음 날로 이월
- 반복 일정
- 드래그로 순서 바꾸기 (키보드 ↑/↓도 가능)
- 할 일 검색, 보기 정렬 (직접·생성일·카테고리·완료 상태)
- 키워드로 카테고리 자동 선택 ("회의" → 업무, 키워드는 더보기에서 고치기)
- JSON 내보내기·가져오기 (가져오기 전 자동 백업, 되돌리기)
- 같은 할 일 중복 경고
- 휴지통: 지운 할 일·반복 일정 되살리기 (지운 직후 '되돌리기')
- 다크 모드 (헤더 버튼으로 시스템 설정 / 라이트 / 다크)
- 홈 화면 추가·오프라인 사용 (PWA)
- 브라우저에 저장 (서버 없음)

> **바로 쓰기: https://yanniart.github.io/task-manager/** (휴대폰에서 열고 홈 화면에 추가)
>
> 현재 상태: **개발 완료·배포함 (M1~M8 + PRD v0.8)** — 실제 휴대폰 확인만 남았어요. 진행 상황은 [개발로그](docs/dev-log.md)를 보세요.

## 실행 방법

ES 모듈과 서비스 워커를 쓰기 때문에 `index.html`을 더블클릭하면 동작하지 않아요. 로컬 서버로 열어 주세요.

- VS Code: **Live Server** 확장 설치 → `index.html` 우클릭 → *Open with Live Server*
- 또는 이 폴더에서:

```bash
python -m http.server 8000
```

그다음 브라우저에서 `http://localhost:8000` 을 열어요.

| 하고 싶은 것 | 주소 |
|---|---|
| 앱 | `http://localhost:8000/` |
| core 로직 테스트 | `http://localhost:8000/tests/core.test.html` (모두 통과하면 제목에 ✅) |
| 날짜 바꿔 보기 (개발용) | `http://localhost:8000/?today=2026-11-12` — 그 날짜를 오늘로 보고 이월·반복이 동작해요. localhost·사설 IP에서만 켜지고 배포 주소에서는 무시돼요. |
| 휴대폰에서 열기 | PC와 같은 Wi‑Fi에서 `http://PC의IP:8000/` (예: `http://192.168.0.13:8000/`). 할 일 기능은 모두 되지만, HTTPS가 아니라서 오프라인·홈 화면 추가는 안 돼요. |

### 테스트

```bash
node tests/run-core.mjs            # core 로직 78개 (1초) — 시간대 바꾸기: --tz=America/Los_Angeles
node tests/store.test.mjs          # 저장·휴지통·가져오기 확인 (1초)
node tests/e2e/run.mjs             # 실제 화면을 눌러 보는 브라우저 확인 185개 (약 2분, Chrome 필요)
node tests/e2e/run.mjs 07          # 한 단계만
node tests/e2e/run.mjs perf        # 성능 측정
BASE_URL=https://yanniart.github.io/task-manager/ node tests/e2e/run.mjs deployed   # 배포 주소 확인
```

브라우저 확인은 Node 22 이상과 Chrome(또는 Edge)이 필요해요. 앱 서버가 안 떠 있으면 Python으로 잠깐 띄워요. 자세한 건 [TRD 8장](docs/TRD.md#8-테스트).

### 개발할 때 주의: 서비스 워커 캐시

localhost에서 한 번 열면 서비스 워커가 앱 파일을 **캐시 먼저** 보여줘요. 그래서 파일을 고쳐도 새로고침에 바로 안 보일 수 있어요.

- 개발 중에는 크롬 개발자 도구 → **Application → Service workers → "Update on reload"** 를 켜 두거나, 같은 화면의 **"Bypass for network"** 를 켜요.
- **배포하기 전에는 `sw.js`의 `CACHE_VERSION`을 꼭 올려요** (`v1` → `v2`). 안 올리면 휴대폰에 옛 버전이 계속 보여요.
- 새 파일을 만들었다면 `sw.js`의 `APP_FILES` 목록에도 넣어요.

### 데이터 옮기기·백업

- 헤더의 **⋯ 더보기 → JSON으로 내보내기**로 파일을 받아 두고, 다른 기기에서 **JSON 가져오기**로 옮겨요.
- 가져오면 그 기기의 데이터가 **통째로 바뀌어요.** 바뀌기 전 데이터는 자동으로 백업되고, 알림의 '되돌리기'로 바로 되돌릴 수 있어요.

## GitHub Pages로 배포하기

휴대폰에서 홈 화면 추가와 오프라인 사용을 하려면 HTTPS 주소가 필요해요 ([TL-008](docs/tech-log.md#tl-008)). 모든 경로가 상대 경로(`./`)라서 하위 경로(`/task-manager/`)에서도 그대로 동작해요.

1. **저장소 만들기** — 이 폴더에서:

   ```bash
   git init
   git add .
   git commit -m "할 일 관리 앱 첫 배포"
   git branch -M main
   ```

2. **GitHub에 올리기** — GitHub CLI(`gh`)가 있으면:

   ```bash
   gh repo create task-manager --public --source=. --remote=origin --push
   ```

   없으면 github.com에서 빈 저장소 `task-manager`를 만든 뒤:

   ```bash
   git remote add origin https://github.com/yanniart/task-manager.git
   git push -u origin main
   ```

3. **Pages 켜기** — 저장소 **Settings → Pages → Build and deployment**에서 *Source: Deploy from a branch*, *Branch: `main` / `(root)`* 를 고르고 Save.
   (CLI로는 `gh api -X POST repos/yanniart/task-manager/pages -f "source[branch]=main" -f "source[path]=/"`)

4. 1~2분 뒤 **https://yanniart.github.io/task-manager/** 가 열려요.

5. **휴대폰에서 확인**
   - Android Chrome: 메뉴 → *홈 화면에 추가* (또는 *앱 설치*)
   - iPhone Safari: 공유 버튼 → *홈 화면에 추가*
   - 홈 화면 아이콘으로 한 번 연 뒤, 비행기 모드에서도 열리는지 확인해요.

**다음에 고쳐서 다시 올릴 때**: `sw.js`의 `CACHE_VERSION`을 올리고 → `git add . && git commit -m "…" && git push`. 휴대폰에서는 앱을 한 번 열었다 닫고 다시 열면 새 버전이 보여요.

> 데이터는 브라우저(`localStorage`)에만 저장돼요. 휴대폰과 PC의 데이터는 서로 따로이고, 브라우저 데이터를 지우면 할 일도 사라져요.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/PRD.md](docs/PRD.md) | 무엇을 만드는지 (기능, 화면, 마일스톤) |
| [docs/TRD.md](docs/TRD.md) | 어떻게 만드는지 (폴더 구조, 데이터, 로직 설계) |
| [docs/DESIGN-notion.md](docs/DESIGN-notion.md) | 디자인 기준 (색, 글자, 모양) |
| [docs/dev-log.md](docs/dev-log.md) | 날짜별 개발 기록과 진행 현황 |
| [docs/tech-log.md](docs/tech-log.md) | 기술 결정과 이유 (TL-xxx) |
| [docs/prompts.md](docs/prompts.md) | 클로드 코드로 개발할 때 쓰는 5단계 프롬프트 |

## 폴더 구조

```
task-manager/
├── index.html, manifest.webmanifest, sw.js   # 앱 진입점과 PWA 파일
├── css/        # base(변수·다크모드) / layout / components
├── js/
│   ├── main.js, store.js, storage.js, constants.js
│   ├── core/       # 순수 로직: 날짜, id, 순서, 반복, 이월, 진행률, 검색·정렬, 휴지통, 디바운스
│   ├── features/   # PWA (서비스 워커 등록)
│   └── ui/         # 화면 그리기, 시트, 반복 일정 관리, 드래그, 검색창, 더보기, 알림
├── assets/icons/   # 앱 아이콘 (SVG 원본 + PNG)
├── tests/      # core 테스트(브라우저·Node), store 확인, 브라우저 확인(e2e/)
└── docs/       # PRD, TRD, 디자인, 개발로그, 기술로그
```

자세한 설명과 규칙은 [TRD 3장](docs/TRD.md#3-폴더-구조)에 있어요.

## 기술

순수 HTML / CSS / 자바스크립트. 프레임워크, 라이브러리, 빌드 도구, 외부 요청 없음.

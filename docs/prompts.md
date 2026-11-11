# 클로드 코드 단계별 프롬프트

[PRD](PRD.md) v0.4와 [TRD](TRD.md) v0.3을 바탕으로, 앱을 5단계로 나눠 만드는 프롬프트예요.

## 사용 방법

1. 클로드 코드를 `C:\dev\task-manager` 폴더에서 열어요.
2. 아래 단계의 프롬프트를 **한 번에 하나씩** 복사해서 붙여 넣어요.
3. 각 단계의 **완료 확인**을 직접 해 보고, 문제가 없으면 다음 단계로 넘어가요.
4. 문제가 있으면 다음 단계로 가지 말고 그 자리에서 고쳐 달라고 해요.

> 각 프롬프트는 앞 대화를 몰라도 동작하도록 썼어요. 단계마다 새 세션에서 시작해도 돼요.

## 단계 한눈에 보기

| 단계 | 내용 | PRD 기능 | 마일스톤 |
|---|---|---|---|
| 1 | 뼈대 + 추가·삭제·완료 체크 + 저장 | F1, F3, F4, F11 | M1, M2 |
| 2 | 카테고리·필터·진행률 + 수정 시트 | F2, F5, F6 | M3, M4 |
| 3 | 날짜·이월 + 반복 일정 | F7, F8 | M5, M6 |
| 4 | 드래그 정렬 | F10 | M7 |
| 5 | PWA·다크 모드·마무리·배포 준비 | 6장, 7장 | M8 |

---

## 1단계. 뼈대 + 추가·삭제·완료 체크 + 저장

```text
docs/PRD.md, docs/TRD.md, docs/tech-log.md를 먼저 끝까지 읽어 줘.
이번에는 1단계(마일스톤 M1, M2)만 만들어 줘: 프로젝트 뼈대와 할 일 추가·삭제·완료 체크·저장.

[만들 파일] TRD 3장 폴더 구조를 그대로 따라 줘.
- index.html: 헤더(제목 "오늘의 할 일", 오늘 날짜), 미완료 목록, 완료 구역, "완료한 항목 모두 지우기" 버튼, 오른쪽 아래 떠 있는 + 버튼, 추가 시트
- css/base.css, css/layout.css, css/components.css
- js/main.js, js/store.js, js/storage.js, js/constants.js
- js/core/id.js (TRD 5.7의 createId, 대체 방법 포함)
- js/core/date.js (TRD 5.1, 로컬 'YYYY-MM-DD')
- js/core/order.js (TRD 5.4의 insertIndex, insertNew, appendLast, move, renumber)
- js/ui/render.js, js/ui/todo-item.js, js/ui/sheet.js
- tests/core.test.html (id, date, order 테스트)

[지시 사항]
1. 순수 HTML/CSS/JS, ES 모듈만 써. 라이브러리·프레임워크·빌드 도구 금지.
2. 휴대폰(360~430px) 기준으로 먼저 디자인해. 누르는 곳은 44px 이상, 입력창 글자 16px 이상, 노치 영역은 env(safe-area-inset-*)로 피해.
3. 추가 시트(PRD F1): 내용 입력만 있으면 돼. 카테고리·반복 줄은 다음 단계에서 넣을 거니까 자리만 비워 둬.
   - 빈 내용이면 저장 버튼 비활성화, 최대 100자
   - 새 할 일은 order.js의 insertNew로 넣어
4. 완료 체크(F4): 체크하면 완료 구역으로, 취소하면 appendLast로 미완료 맨 아래로. 지원 기기에서는 navigator.vibrate로 짧게 진동.
5. 삭제(F3): 이번 단계에서는 각 항목에 임시 삭제 버튼을 둬(confirm으로 확인). 2단계에서 수정 시트 안으로 옮길 거야. "완료한 항목 모두 지우기"도 confirm으로 확인.
6. 저장(F11, TRD 4장): localStorage 키 "task-manager" 하나에 { version: 1, todos, rules: [], settings } 저장. 깨진 데이터면 백업 키에 복사하고 빈 상태로 시작.
7. Todo 필드는 TRD 4장을 그대로 따르되, 이번 단계에서 안 쓰는 필드(ruleId, carriedFrom)도 null로 미리 넣어 둬.
8. 사용자 입력은 textContent로만 화면에 넣어. 이벤트는 목록 부모에 위임해.
9. 상태 변경 함수는 store.js에만 두고, 바뀔 때마다 저장 → render 순서로 불러(TRD 5.5).

[하지 말 것]
- 카테고리, 필터, 진행률, 수정, 이월, 반복, 드래그, 서비스 워커는 아직 만들지 마.

[완료 확인]
- python -m http.server 8000 으로 띄우고 브라우저 휴대폰 화면(375px)에서 확인해 줘.
- 할 일 3개 추가 → 1개 완료 → 새로고침 → 그대로 남아 있음
- 완료 취소하면 미완료 맨 아래로 감
- tests/core.test.html 이 모두 통과
- 콘솔 오류 없음

[끝나면]
- docs/dev-log.md에 오늘 날짜로 한 일·문제·다음 할 일을 추가하고, 진행 현황 표의 M1, M2를 ✅로 바꿔 줘.
- 문서와 다르게 만든 부분이 있으면 docs/tech-log.md에 새 TL 번호로 이유를 남겨 줘.
```

---

## 2단계. 카테고리·필터·진행률 + 수정 시트

```text
docs/PRD.md, docs/TRD.md, docs/dev-log.md를 먼저 읽어 줘. 1단계(M1, M2)는 끝난 상태야.
이번에는 2단계(마일스톤 M3, M4)를 만들어 줘: 카테고리·필터·진행률(PRD F5, F6)과 수정 시트(F2).

[만들거나 고칠 파일]
- js/core/progress.js (새 파일, 진행률 계산 순수 함수)
- js/ui/sheet.js, js/ui/render.js, js/ui/todo-item.js, js/ui/banner.js(축하 문구)
- js/store.js, js/constants.js, css/*, tests/core.test.html

[지시 사항]
1. 카테고리(F5): 업무(work)/개인(personal)/공부(study) 세 가지 고정. 색은 업무 파랑, 개인 초록, 공부 주황이고 CSS 변수(--cat-work 등)로 정의해. 배지에는 글자도 넣어.
2. 추가 시트에 카테고리 선택 버튼 3개를 넣어. 기본값은 settings.lastCategory.
3. 필터 탭(F5): 전체/업무/개인/공부, 한 줄에 다 들어가게. 고른 값은 settings.filter에 저장해서 새로고침 후에도 유지.
4. 진행률(F6): 오늘 날짜의 할 일만 계산. "7 / 12 완료 · 58%" 문구 + 막대, 아래에 카테고리별 "업무 3/5" 표시. 0개면 "할 일을 추가해 보세요"와 0%. 100%면 축하 문구.
5. 수정 시트(F2, TRD 5.9): 할 일 내용을 탭하면 같은 시트를 mode "edit"로 열어.
   - 내용·카테고리 수정 가능, 반복 줄은 숨김
   - 시트 아래쪽에 삭제 버튼(confirm 확인). 1단계의 임시 삭제 버튼은 없애.
   - 시트는 role="dialog", 열면 입력창 포커스, Esc로 닫기, 열린 동안 뒤 화면 스크롤 막기
6. progress.js 테스트(0개일 때 0%, 카테고리별 계산)를 tests/core.test.html에 추가해.

[하지 말 것]
- 반복 줄, 반복 안내 문구, 이월, 드래그는 아직 만들지 마.

[완료 확인]
- 375px 화면에서: 카테고리별로 할 일 추가 → 필터 전환 → 진행률이 바로 바뀜 → 새로고침 후 필터 유지
- 할 일 탭 → 수정 → 저장 / Esc 취소 / 삭제 모두 동작
- 모두 완료하면 축하 문구
- 테스트 통과, 콘솔 오류 없음

[끝나면]
- docs/dev-log.md에 기록하고 M3, M4를 ✅로 바꿔 줘. 문서와 다르게 한 부분은 docs/tech-log.md에 남겨 줘.
```

---

## 3단계. 날짜·이월 + 반복 일정

```text
docs/PRD.md(F7, F8), docs/TRD.md(5.1~5.4, 5.9), docs/tech-log.md(TL-005, TL-006, TL-011), docs/dev-log.md를 먼저 읽어 줘. 2단계(M3, M4)까지 끝난 상태야.
이번에는 3단계(마일스톤 M5, M6)를 만들어 줘: 미완료 이월과 반복 일정.

[만들거나 고칠 파일]
- js/core/recurrence.js (새 파일, matches(rule, dateKey))
- js/core/rollover.js (새 파일, runRollover(state, todayKey))
- js/ui/rules-view.js (새 파일, 반복 일정 관리 화면)
- js/main.js, js/store.js, js/ui/sheet.js, js/ui/render.js, js/ui/todo-item.js, css/*, tests/core.test.html

[지시 사항]
1. runRollover는 TRD 5.2의 5단계 순서를 그대로 따라. 같은 날 여러 번 불러도 결과가 같아야 해(멱등성).
   - 지난 날짜 미완료 + ruleId 없음 → 오늘로 이월, carriedFrom 기록, 미완료 맨 위(원래 날짜 오래된 순)
   - 지난 날짜 미완료 + ruleId 있음 → 삭제
   - 오늘에 맞는 규칙 → 할 일 생성(insertNew), lastGeneratedDate로 중복 방지
   - 마지막에 renumber
2. runRollover를 부르는 시점: 앱을 열 때, visibilitychange로 다시 보일 때, 켜 둔 채 자정이 될 때(setTimeout으로 다음 자정 예약).
3. 화면(TRD 5.4): 오늘 미완료 / 오늘 완료 / "이전에 완료한 항목 (n)" 접힘 구역. 이전 완료 항목은 진행률에서 빼.
4. 이월된 할 일에는 "이월 11/10" 표시, 반복 할 일에는 🔁 표시.
5. 추가 시트에 반복 줄: 반복 안 함 / 매일 / 평일 / 매주(요일 여러 개 선택). 반복을 고르고 저장하면 규칙 생성 → 오늘이 맞으면 오늘 할 일도 생성.
6. 수정 시트(TRD 5.9): 반복 할 일이면 "🔁 {규칙 요약} 반복 · 반복 일정 관리에서 수정" 안내를 보여주고, 누르면 관리 화면에서 그 규칙을 강조. 규칙이 삭제됐으면 "🔁 삭제된 반복 일정에서 생긴 할 일".
7. 반복 일정 관리 화면(헤더 ☰): 규칙 목록, 수정·일시정지·삭제, "+ 새 반복 일정". 규칙 수정은 다음 생성분부터, 삭제해도 이미 생긴 할 일은 남아.
8. 날짜는 반드시 core/date.js만 써. toISOString()으로 날짜 키를 만들지 마(TL-005).
9. 테스트 추가(TRD 8장): 이월 3가지 경우, 평일 규칙이 토요일엔 안 생김, 같은 날 두 번 실행해도 하나만 생김, 이월 2개 + 일반 3개일 때 새 할 일 자리.

[하지 말 것]
- 드래그, 서비스 워커는 아직 만들지 마.

[완료 확인]
- 테스트를 위해 오늘 날짜를 바꿔 볼 수 있게, 개발 중에만 URL에 ?today=2026-11-12 를 붙이면 그 날짜로 동작하게 해 줘(배포 전 5단계에서 제거 여부 결정).
- ?today로 다음 날을 열었을 때: 미완료 일반 할 일은 이월, 완료 항목은 "이전에 완료한 항목"으로, 매일 반복은 새로 하나만 생김
- 테스트 통과, 콘솔 오류 없음

[끝나면]
- docs/dev-log.md에 기록하고 M5, M6를 ✅로 바꿔 줘. ?today 같은 개발용 장치를 넣었다면 docs/tech-log.md에 새 TL로 남겨 줘.
```

---

## 4단계. 드래그 정렬

```text
docs/PRD.md(F10), docs/TRD.md(5.4, 5.6, 7장), docs/tech-log.md(TL-004, TL-011), docs/dev-log.md를 먼저 읽어 줘. 3단계(M5, M6)까지 끝난 상태야.
이번에는 4단계(마일스톤 M7)를 만들어 줘: 드래그로 순서 바꾸기.

[만들거나 고칠 파일]
- js/ui/drag.js (새 파일)
- js/ui/todo-item.js, js/ui/render.js, js/store.js, css/components.css, tests/core.test.html

[지시 사항]
1. HTML5 Drag and Drop은 쓰지 말고 Pointer Events(pointerdown/move/up/cancel)로 직접 만들어(TL-004). 라이브러리 금지.
2. 각 미완료 항목 오른쪽에 ⠿ 손잡이. 손잡이에서만 드래그 시작, 손잡이에 touch-action: none.
3. 끄는 동안 항목은 transform: translateY로 움직이고, 다른 항목 가운데를 지나면 자리를 바꿔 보여줘. 끄는 중에는 render를 부르지 마.
4. 화면 위·아래 끝에 가까우면 자동 스크롤.
5. 손을 떼면 store에서 order.js의 move → renumber 후 저장하고 한 번만 render.
6. 필터가 켜져 있으면 보이는 항목들이 원래 차지하던 order 자리 안에서만 섞어(TRD 5.6).
7. 완료 구역 항목은 드래그할 수 없어.
8. 키보드 접근성: 손잡이에 포커스한 상태에서 ↑/↓로 한 칸씩 이동.
9. 테스트 추가: 필터 상태에서 move 했을 때 안 보이는 항목의 상대 순서가 유지됨, 이월 항목을 아래로 옮긴 뒤 새 할 일이 맨 위에 들어감.

[완료 확인]
- 375px 화면에서 터치 에뮬레이션으로 드래그 → 순서 바뀜 → 새로고침 후 유지
- 드래그하는 동안 화면이 같이 스크롤되지 않음
- 필터 켠 상태에서 드래그 후 "전체"로 돌아가도 순서가 어색하지 않음
- ↑/↓ 키로 이동 가능
- 테스트 통과, 콘솔 오류 없음

[끝나면]
- docs/dev-log.md에 기록하고 M7을 ✅로 바꿔 줘.
```

---

## 5단계. PWA·다크 모드·마무리·배포 준비

```text
docs/PRD.md(6장, 7장), docs/TRD.md(2장, 5.8, 6~8장), docs/tech-log.md(TL-008), docs/dev-log.md를 먼저 읽어 줘. 4단계(M7)까지 끝난 상태야.
이번에는 5단계(마일스톤 M8)를 만들어 줘: PWA, 다크 모드, 마무리 점검, 배포 준비.

[만들거나 고칠 파일]
- manifest.webmanifest, sw.js (루트), js/features/pwa.js
- assets/icons/ (192px, 512px, maskable 아이콘 — 간단한 체크 표시 모양을 SVG로 그려서 PNG로 만들 방법이 없으면 SVG 아이콘과 함께 방법을 알려 줘)
- index.html, css/base.css, README.md

[지시 사항]
1. manifest(TRD 5.8): name "오늘의 할 일", short_name "할 일", start_url "./", display "standalone", 테마 색, 아이콘.
2. 서비스 워커: 앱 파일 전체를 설치 때 캐시, 캐시 먼저 응답, 캐시 이름에 버전(tm-cache-v1), activate 때 옛 캐시 삭제. 모든 경로는 상대 경로(GitHub Pages 하위 경로 /task-manager/ 대응).
3. pwa.js: HTTPS나 localhost일 때만 서비스 워커 등록. http://192.168... 에서는 조용히 건너뛰어.
4. 다크 모드: prefers-color-scheme로 base.css 변수만 바꿔. 카테고리 색은 다크 배경에서도 읽히게.
5. 마무리 점검(PRD 전체 기준):
   - 빈 상태 문구, 100자 제한, 44px 터치 영역, 16px 입력 글자, 노치 여백
   - 시트·관리 화면 접근성(role, 포커스, Esc)
   - innerHTML에 사용자 데이터가 들어가는 곳이 없는지
   - 3단계의 ?today 개발용 장치: 배포 버전에서 꺼지게 하거나 제거(결정한 내용을 tech-log에)
6. README의 "현재 상태"와 실행 방법을 최신으로, GitHub Pages 배포 방법(TL-008)을 단계별로 추가.

[완료 확인]
- localhost에서: 서비스 워커 등록됨 → 서버를 끈 뒤 새로고침해도 앱이 열림
- 다크 모드 전환 시 모든 화면이 읽힘
- PRD 5장의 기능(F1~F8, F10, F11)을 하나씩 직접 눌러 보고 결과를 표로 보고해 줘
- 테스트 통과, 콘솔 오류 없음

[끝나면]
- docs/dev-log.md에 기록하고 M8을 ✅로 바꿔 줘.
- 배포는 아직 하지 말고, GitHub 저장소를 만들고 올리는 명령어를 정리해서 보여 줘. 실제 업로드는 내가 확인한 뒤에 할게.
```

---

## 단계 사이에 쓰면 좋은 짧은 프롬프트

| 상황 | 프롬프트 |
|---|---|
| 단계가 끝나고 점검하고 싶을 때 | `방금 만든 코드가 docs/PRD.md, docs/TRD.md와 다른 곳이 있는지 검토해 줘. 고치기 전에 목록만 보여 줘.` |
| 오류가 났을 때 | `콘솔에 이런 오류가 나: (오류 붙여 넣기). 원인을 찾아서 고치고, 왜 났는지 docs/dev-log.md에 적어 줘.` |
| 기능을 바꾸고 싶을 때 | `PRD의 F__를 이렇게 바꾸고 싶어: (내용). PRD·TRD를 먼저 고치고, 바뀐 이유를 tech-log에 남긴 다음 코드를 고쳐 줘.` |
| 하루 작업을 마칠 때 | `오늘 한 작업을 docs/dev-log.md에 정리하고, 진행 현황 표를 최신으로 바꿔 줘.` |

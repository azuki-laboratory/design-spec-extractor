# Azuki (Design Spec Extractor) — AI 에이전트 공통 가이드

크롬 확장(MV3). 현재 페이지 디자인 분석 → DESIGN.md 생성. 빌드 도구 없음, 순수 JS. 주석·문서 한국어.

## 파일 맵
- `analyzer.js` — 페이지 주입 분석 함수 `analyzePage()`. **자기완결 필수**: `chrome.scripting.executeScript({func})`로 직렬화되므로 함수 밖 스코프 참조 시 런타임 ReferenceError. 헬퍼는 전부 함수 내부에 둘 것
- `generator.js` — 분석 JSON → DESIGN.md(섹션 1~9 + 10 Design Lint) 변환. 진입점 `DesignGenerator.generate(data, lang)`. **다국어**: 공개 함수는 `lang`('en'|'ko', 기본 en) 인자. 모듈 `LANG` + `T(en, ko)`로 출력 문자열 선택. 색상 토큰 메모는 LANG별 캐시. e2e는 lang='ko'로 검증. **Azuki 시그니처 API**: `computeDNA`(디자인 지문 태그), `computeLint`(토큰 위반 진단), `mascotComment`(마스코트 촌평), `exportAgentPrompt`(에이전트 붙여넣기 프롬프트)
- `i18n.js` — popup/options **런타임** UI 문자열(`AZUKI_UI` en/ko) + 적용 헬퍼(`applyI18n`, `AZUKI_T`). 사용자 토글(storage.sync.lang) 기반 — chrome.i18n과 별개. 정적 요소는 `data-i18n`/`data-i18n-html`/`data-i18n-title`
- `_locales/en·ko/messages.json` — **manifest 문자열**(name/description/action title) 현지화. chrome.i18n + `default_locale:en` + manifest `__MSG_키__`. 브라우저 UI 언어 따름(앱 내 토글과 별개). build.js가 dist로 복사
- `popup.js` — 사이드패널 UI. 버튼(#analyze/#add)으로 현재 탭 분석·병합, 미리보기/DNA/린트/내보내기. 패널이라 안 닫힘 → analyses 메모리 유지. **배포는 host 권한 없음 → 분석 전 `ensureHostAccess()`가 `chrome.permissions.request`로 런타임 접근 획득**(버튼 클릭=제스처, 첫 await로 호출). 탭 선택은 lastFocusedWindow 우선
- `background.js` — service worker. 아이콘 클릭 시 사이드패널 열기 + hotreload(installType 게이트). **개발·배포 공용**. 분석은 안 함(패널이 수행)
- `options.html` / `options.js` — 설정 페이지(options_page). 설명 + 사용자 옵션(분석 요소 상한/저장 다이얼로그/다크 팔레트 포함) + 문의 mailto. `chrome.storage.sync` 저장. **기본값 DEFAULT_OPTS는 popup.js와 동기 유지**
- `manifest.json` — 개발용 manifest (tabs + host_permissions 포함, E2E 자동화용). action은 default_popup 없이 side_panel 사용. options_page + storage 권한. **optional_host_permissions**(배포에서 유지, 분석 버튼이 런타임 요청)
- `scripts/build.js` — 배포 빌드: tabs/host_permissions 제거 후 dist/release + zip 생성
- `scripts/publish.js` — Chrome Web Store 업로드 (.env.publish의 OAuth 자격 증명 필요)
- `test/e2e.js` — Playwright 기능 테스트 26항목. 확장 로드 → 픽스처 분석 → 문서 값 대조
- `test/fixture.html` — 알려진 디자인 값의 테스트 페이지. **값 수정 시 e2e.js assert 동기화 필수**
- `test/release.js` — 배포 빌드 스모크 (권한 축소·sidePanel/storage/background/options 유지·로드·권한 게이트 검증)

## 명령
```bash
npm run lint          # 전 소스 JS 문법 검사 (빠른 실패)
npm test              # 기능 E2E — analyzer/generator/popup 수정 후 필수
npm run build         # 배포 빌드 생성 (manifest 필수 키·파일 누락 시 실패)
npm run test:release  # 배포 빌드 검증 (build 선행 필요)
npm run verify        # lint + test + build + test:release 한 번에 (전체 게이트)
npm run publish       # 스토어 업로드+심사 제출 — 사람 확인 없이 실행 금지
```

## 불변 규칙
1. analyzer.js 수정 후 반드시 `npm test` 실행
2. 로직 파일(popup/analyzer/generator)은 개발·배포 공용 — 빌드별 분기 코드 금지, 권한 차이는 manifest에서만
3. 배포 빌드는 설치 시 최소 권한 유지(host_permissions 없음). 사이트 접근은 분석 버튼 클릭 시 optional_host_permissions 런타임 요청으로 얻음 — optional_host_permissions를 배포에서 제거하지 말 것. 새 chrome.* API 도입 시 manifest와 build.js 제거 목록 함께 검토
4. 릴리스 전 manifest.json version 증가 (스토어가 동일 버전 재업로드 거부)
5. `.env.publish` 읽기·커밋·출력 금지 (스토어 OAuth 자격 증명)
6. 번들러·프레임워크 도입 금지 (명시적 요청 시에만)
7. 사이드패널/팝업에서 대상 탭은 `lastFocusedWindow` 활성탭 우선 조회 — `currentWindow`는 패널 오픈 시점 탭에 고착됨(stale 버그 원인)
8. 배포에서 패널 버튼이 executeScript 하려면 클릭 시 `ensureHostAccess()`로 optional_host_permissions 런타임 요청 필수(제스처 직후 첫 await). 패널 버튼 클릭만으론 activeTab 안 생김
9. UI/생성문서 문자열 추가 시 i18n en/ko 동시 작성, 기본 'en'. `DEFAULT_OPTS`는 popup.js·options.js 양쪽 동기. e2e는 ko로 문서값 검증
10. 광범위 변경·릴리스 전 `npm run verify`(lint+test+build+test:release)로 자가 판정 — 하네스의 done-check

## 작업 시 역할 분리 권장 (모델 티어 매핑)
멀티 에이전트/모델 지원 도구에서는 다음 분담을 권장:
- **탐색·검색, 테스트 실행·보고**: 최저가 모델 (예: Haiku, GPT mini/nano, Gemini Flash) — 결론만 반환, 파일 덤프 금지
- **코드 리뷰**: 중급 모델 — 위 불변 규칙 1~3 위반 여부를 최우선 체크
- **설계·계획**: 최상위 모델 — 구현 전 수정 파일 목록과 테스트 영향(픽스처 동기화 여부)까지 산출
Claude Code에서는 `.claude/agents/`의 scout(haiku)/tester(haiku)/reviewer(sonnet)/architect(opus)가 이 분담을 구현함.

## 검증 기준
변경 완료 조건: `npm test` 통과. manifest/빌드 관련 변경은 `npm run build && npm run test:release`까지. 광범위 변경·릴리스 전에는 `npm run verify`(전체 게이트) 권장. 테스트를 건너뛴 채 완료 보고 금지.

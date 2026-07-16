# Azuki (Design Spec Extractor) — AI 에이전트 공통 가이드

크롬 확장(MV3). 현재 페이지 디자인 분석 → DESIGN.md 생성. 빌드 도구 없음, 순수 JS. 주석·문서 한국어.

## 파일 맵
> **구조**: 소스는 전부 `src/` 아래, **네이티브 ESM**(확장 페이지·모듈은 `import/export`, 번들러 없음). 진입: `src/popup.js`·`src/options.js`(`<script type="module">`). 자산 `icons/`·`_locales/`·설정·`scripts/`·`test/`는 루트. HTML의 아이콘 경로는 루트절대(`/icons/...`).
> **CSS**: 공용 `src/ui/theme.css`(브랜드 토큰 `:root`·리셋·focus = DESIGN.md(제품 디자인 시스템) 단일 출처) + 전용 `src/popup.css`·`src/options.css`. HTML은 `<link>`로 theme→page 순 로드(전용이 공용 override). 인라인 `<style>` 금지.
- `src/analyzer.js` — 페이지 주입 분석 함수 `export function analyzePage()`. **자기완결 필수**: `chrome.scripting.executeScript({func})`로 직렬화되므로 함수 밖 스코프 참조 시 런타임 ReferenceError. 헬퍼는 전부 함수 내부에 둘 것(ESM import도 함수 본문엔 넣지 말 것)
- `src/generator/` — 분석 JSON → DESIGN.md(섹션 1~11)·토큰·시그니처 변환 (ESM 모듈). `index.js`가 `DesignGenerator` 조립. **`core.js`**(공유 `state.LANG`·`T`·`htmlEsc`/`cssSafe`·색상/토큰/스케일/무드/frontmatter 엔진) · **`doc.js`**(`generate`) · **`signature.js`**(`computeDNA`·`computeLint`·`mascotComment`·`designFingerprint`·`exportPassport`) · **`exporters.js`**(`exportTokens`/`Preview`/`Tailwind`/`AgentPrompt`·`merge`) · **`kit.js`**(`exportKit(data,lang,kitOpts)` 런치 키트 — 페이지 9종(`KIT_PAGES`: 랜딩/인증/대시보드/가격/블로그/문서/법률/문의/갤러리, 전부 스크립트 0·CSS 전용 챗 위젯 포함) + 부속(DESIGN.md 동봉·analytics 스니펫·i18n strings·llms.txt·robots.txt·vercel/netlify 설정·README 연결 가이드)을 무압축 zip으로, `buildKitZip` · AI 맞춤: `customKitSystemPrompt`→온디바이스 LLM→`parseKitStructure`→`buildCustomKitPage`. **LLM은 구조 JSON만, HTML 렌더는 항상 kit.js(전 값 htmlEsc/cssSafe)** — 이 원칙 유지할 것. Prompt API(LanguageModel)는 popup.js에서 기능 감지, 미지원 시 UI 숨김). **다국어**: 공개 함수 `lang`('en'|'ko', 기본 en), `state.LANG`+`T(en,ko)`로 선택, 색상토큰 메모는 LANG별 캐시. e2e는 lang='ko'로 검증
- `src/i18n.js` — popup/options **런타임** UI 문자열(`AZUKI_UI` en/ko) + `export`(`applyI18n`, `AZUKI_T`). 사용자 토글(storage.sync.lang) 기반 — chrome.i18n과 별개. 정적 요소는 `data-i18n`/`data-i18n-html`/`data-i18n-title`
- `_locales/en·ko/messages.json` — **manifest 문자열**(name/description/action title) 현지화. chrome.i18n + `default_locale:en` + manifest `__MSG_키__`. 브라우저 UI 언어 따름(앱 내 토글과 별개). build.js가 dist로 복사
- `src/popup.js` — 사이드패널 UI(ESM). 버튼(#analyze/#add)으로 현재 탭 분석·병합, 미리보기/DNA/린트/내보내기. 패널이라 안 닫힘 → analyses 메모리 유지. **배포는 host 권한 없음 → 분석 전 `ensureHostAccess()`가 `chrome.permissions.request`로 런타임 접근 획득**(버튼 클릭=제스처, 첫 await). 탭은 lastFocusedWindow 우선. `DesignGenerator`는 E2E용으로 `window`에 노출
- `src/background.js` — service worker. 아이콘 클릭 시 사이드패널 열기 + hotreload(installType 게이트). 분석은 안 함(패널이 수행)
- `src/options.html` / `src/options.js` — 설정 페이지(options_page, ESM). 설명 + 사용자 옵션(분석 요소 상한/저장 다이얼로그/다크 팔레트) + 커스텀 드롭다운 + 문의 mailto. `chrome.storage.sync` 저장. **기본값 DEFAULT_OPTS는 popup.js와 동기 유지**
- `manifest.json` — 개발용 manifest (tabs + host_permissions 포함, E2E 자동화용). 경로는 `src/…`. side_panel + options_page + storage. **optional_host_permissions**(배포 유지, 분석 버튼이 런타임 요청)
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
4. 릴리스 전 manifest.json version 증가 (스토어가 동일 버전 재업로드 거부). **버전 규칙(MAJOR.MINOR.PATCH)**:
   - **MAJOR**(첫 자리): 주요 로직·코드 구조 변경 등 메이저 작업
   - **MINOR**(둘째 자리): 마이너 패치(기능 추가·수정)
   - **PATCH**(셋째 자리): 간단한 문구 수정·매우 마이너한 UI 수정
   - manifest.json과 package.json version 함께 맞출 것
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

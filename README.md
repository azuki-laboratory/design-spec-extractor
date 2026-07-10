# Azuki — Design Spec Extractor

현재 보고 있는 웹사이트의 디자인을 분석하여 **DESIGN.md** 문서를 자동 생성하는 크롬 확장 프로그램입니다.

## 생성되는 문서 구조

1. **시각적 테마 및 분위기** — 다크/라이트 판별, 분위기 서술 (채도·반경·그림자 기반 휴리스틱)
2. **컬러 팔레트 및 역할** — Background / Text / Primary / Accent / Border 역할 자동 배정, 사이트의 CSS 커스텀 프로퍼티(원본 토큰)도 함께 추출
3. **타이포그래피 규칙** — 폰트 패밀리, H1~H6 스펙, 타입 스케일, 굵기
4. **컴포넌트 스타일링** — 버튼(Primary/Secondary 클러스터링), 입력창, 카드 + 스타일시트에서 추출한 `:hover` / `:focus` 상태 규칙
5. **레이아웃 원칙** — 실사용 여백 스케일, gap, flex/grid 비중, 중앙 컨테이너 max-width
6. **깊이감 및 고도** — 그림자 시스템(빈도순 elevation 레벨), 반경 스케일, z-index, transition
7. **Do's and Don'ts** — 추출된 토큰 기반 가드레일 자동 생성
8. **반응형 동작** — 미디어쿼리에서 추출한 브레이크포인트, 모바일 전략 제안
9. **에이전트 프롬프트 가이드** — 실제 토큰 값이 채워진, AI에게 바로 붙여넣을 수 있는 프롬프트 셋

## 설치 (개발자 모드)

1. Chrome에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램을 로드합니다** 클릭 → 이 폴더 선택

## 사용법

1. 분석하고 싶은 사이트를 연다
2. 툴바에서 확장 아이콘 클릭 → **이 페이지 분석하기**
3. (선택) 다른 페이지로 이동 후 **＋ 페이지 추가** — 여러 페이지를 병합 분석해 컴포넌트 커버리지 확대
4. 미리보기 확인 후 다운로드:
   - **DESIGN.md** — AI 에이전트용 디자인 문서 (YAML frontmatter 토큰 + 9섹션)
   - **tokens.css** — `:root` CSS 커스텀 프로퍼티. 사이트가 다크모드를 정의하면 `prefers-color-scheme: dark` 블록 포함
   - **tokens.json** — W3C Design Tokens 포맷 — Style Dictionary·Figma Tokens 호환
   - **preview.html** — 추출 토큰으로 재구성한 스타일 카탈로그 (추출 정확도 육안 검증용)
   - **screenshot.png** — 분석 대상 페이지 캡처 (AI에게 시각 근거 제공)

추출 범위: 색상·그라디언트, 다크모드 팔레트(`prefers-color-scheme` 변수 재정의), 타이포, 버튼/입력창/카드/내비게이션, `:hover`/`:focus`(스타일시트) + JS 구동 hover(이벤트 시뮬레이션), 여백/반경/그림자 스케일, 브레이크포인트.

## 구조

| 파일 | 역할 |
|------|------|
| `manifest.json` | MV3 매니페스트 (`activeTab`, `tabs`, `scripting`, `downloads` + host_permissions) |
| `analyzer.js` | 페이지에 주입되는 자기완결 분석 함수 — computed style, 스타일시트, CSS 변수 수집 |
| `generator.js` | 분석 JSON → DESIGN.md 마크다운 변환 (역할 추론, 대비 계산, 프롬프트 생성) |
| `popup.html/js` | 팝업 UI — 실행, 미리보기, 복사/다운로드 |
| `test/e2e.js` | Playwright E2E — 확장 로드부터 DESIGN.md 검증까지 자동화 |
| `test/fixture.html` | 알려진 디자인 값으로 구성된 테스트 페이지 |

## 테스트 (E2E 자동화)

```bash
npm install        # playwright 설치
npm test           # 확장 로드 → 분석 → 26개 항목 검증
HEADFUL=1 npm test # 브라우저 창 보면서 실행
```

동작 방식: Playwright `launchPersistentContext`에 `--load-extension`으로 확장을 로드하고,
로컬 서버로 `test/fixture.html`(알려진 색상·폰트·브레이크포인트)을 띄운 뒤,
`chrome-extension://<ID>/popup.html`을 탭으로 열어 분석 버튼을 클릭한다.
생성된 DESIGN.md가 픽스처의 실제 값(Primary `#e11d48`, Georgia, 768px 브레이크포인트 등)과
일치하는지 26개 항목을 검증한다. 결과 문서는 `test/output-DESIGN.md`에 저장된다.

## 배포 (스토어용 빌드)

소스 manifest는 E2E 테스트용 넓은 권한(`tabs`, `host_permissions`)을 갖는다.
배포 빌드는 이를 제거하고 `activeTab`만 남긴다 — "모든 사이트 데이터 읽기" 경고 없음.

```bash
npm run build         # dist/release/ + dist/azuki-v1.0.0.zip 생성
npm run test:release  # 배포 빌드 스모크 테스트 (권한 축소·로드·UI·권한 게이트 검증)
```

배포 전 수동 확인 1회 필요 (activeTab은 실제 아이콘 클릭 제스처가 필요해 자동화 불가):
`chrome://extensions`에서 `dist/release/` 로드 → 아무 사이트에서 아이콘 클릭 → 분석 정상 동작 확인.
이후 zip을 Chrome Web Store 개발자 대시보드에 업로드.

| 구분 | 위치 | 권한 | 용도 |
|------|------|------|------|
| 개발 | 저장소 루트 | activeTab + tabs + host_permissions | `npm test` E2E 자동화 |
| 배포 | `dist/release/` | activeTab만 | 스토어 업로드, 실사용 |

## 배포 자동화 (업데이트 업로드)

최초 등록 후에는 `npm run publish` 한 줄로 빌드 → 스토어 업로드 → 심사 제출까지 자동.

**최초 1회 설정:**

1. **개발자 계정**: https://chrome.google.com/webstore/devconsole 에서 등록 (일회성 $5)
2. **첫 업로드(수동)**: 대시보드 → 새 항목 → `dist/*.zip` 업로드 → 스토어 등록정보
   (설명, 스크린샷 1280×800 최소 1장, 카테고리, 개인정보 처리방침) 작성 → 심사 제출.
   생성된 32자 확장 ID 기록
3. **OAuth 자격 증명**:
   - https://console.cloud.google.com 에서 프로젝트 생성 → "Chrome Web Store API" 사용 설정
   - OAuth 동의 화면 구성(내부/테스트) → 사용자 인증 정보 → OAuth 클라이언트 ID(데스크톱 앱) 생성
   - refresh token 발급: https://github.com/fregante/chrome-webstore-upload-keys 의 안내 도구 사용이 가장 간단
4. 프로젝트 루트에 `.env.publish` 작성 (`.gitignore`에 이미 등록됨):
   ```
   EXTENSION_ID=<32자 ID>
   CLIENT_ID=<xxx.apps.googleusercontent.com>
   CLIENT_SECRET=<...>
   REFRESH_TOKEN=<...>
   ```

**이후 매 릴리스:**

```bash
# manifest.json의 version 올리기 (스토어는 동일 버전 재업로드 거부)
npm test && npm run test:release   # 검증
npm run publish                    # 빌드 + 업로드 + 심사 제출
npm run publish -- --upload-only   # 업로드만 하고 게시는 대시보드에서 하고 싶을 때
```

자동화 한계: 신규 아이템 생성, 스토어 등록정보·스크린샷, 심사 승인 자체는 API 미지원 — 심사는 제출만 가능하고 통과는 Google 몫 (보통 1~3일).

## 알려진 제약

- **교차 출처 CSS**: 다른 도메인의 스타일시트는 CORS로 인해 `:hover`/미디어쿼리 추출이 불가할 수 있습니다 (computed style 기반 분석은 정상 동작).
- **Primary/Secondary 판별**은 채도·빈도 기반 휴리스틱이므로 검수를 권장합니다.
- 성능을 위해 최대 4,000개 요소까지만 스캔합니다.
- `chrome://` 등 브라우저 내부 페이지에서는 동작하지 않습니다.

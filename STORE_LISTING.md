# Chrome Web Store 등록 정보 (제출용)

개발자 대시보드에 그대로 붙여넣는 원문. 코드가 아닌 스토어 심사 항목 모음.
> 실제 데이터: 수집·전송·판매 **없음**. 모든 처리는 로컬(브라우저 내). 네트워크 요청 없음.

---

## 1. 단일 목적 (Single purpose)

**KO:** 현재 열려 있는 웹페이지의 디자인(색상·타이포그래피·여백·컴포넌트·접근성)을 분석해, AI 코딩 에이전트가 바로 쓸 수 있는 DESIGN.md 스펙과 디자인 토큰을 생성한다.

**EN:** Analyze the design of the currently open web page (colors, typography, spacing, components, accessibility) and generate a DESIGN.md spec and design tokens ready for AI coding agents.

---

## 2. 권한 사유 (Permission justification)

| 권한 | 사유 (KO) | Justification (EN) |
|------|-----------|--------------------|
| `activeTab` | 사용자가 분석 버튼을 누른 현재 탭에만 접근해 렌더된 스타일(computed style)을 읽는다. | Access only the current tab the user clicks Analyze on, to read its computed styles. |
| `scripting` | 현재 탭에 분석 함수를 1회 주입해 디자인 값을 추출한다(결과 반환 후 종료). | Inject a one-shot analysis function into the current tab to extract design values. |
| `downloads` | 생성된 DESIGN.md·tokens.css·tokens.json·preview.html·passport.svg·스크린샷을 파일로 저장한다. | Save generated files (DESIGN.md, tokens, preview, passport, screenshot). |
| `sidePanel` | 분석 결과 UI를 사이드패널로 표시한다. | Show the result UI in the side panel. |
| `storage` | 사용자 설정(언어·옵션)과 현재 세션 분석 결과를 로컬에 저장한다. 외부 전송 없음. | Store user settings and the current session's results locally. No external transfer. |
| `optional_host_permissions` (`http://*/*`, `https://*/*`) | 사용자가 **분석하려는 임의 사이트**의 스타일을 읽어야 하므로 넓은 호스트 접근이 필요하다. 설치 시 부여하지 않고, **분석 버튼 클릭(사용자 제스처) 시 런타임으로 요청**한다. | Reading styles of whatever site the user chooses to analyze requires broad host access. Not granted at install — requested at runtime on the Analyze button click (user gesture). |

> `tabs`·`host_permissions`는 개발/E2E 전용이며 배포 빌드에서 제거된다(설치 시 "모든 사이트 데이터 읽기" 경고 없음).

---

## 3. 데이터 안전성 (Data safety)

- **수집하는 사용자 데이터: 없음.** 개인정보·위치·금융·인증 정보 등 일절 수집하지 않는다.
- **전송: 없음.** 원격 서버로 어떤 데이터도 보내지 않는다(네트워크 요청 자체가 없음).
- **판매·제3자 공유: 없음.**
- **로컬 저장만:** 사용자 설정과 세션 분석 결과는 `chrome.storage`(로컬/동기)에 저장되며 기기를 벗어나지 않는다.
- **원격 코드 없음:** 모든 스크립트는 확장 패키지 내에 포함(외부 CDN·eval 없음).

대시보드 "데이터 사용" 체크:
- [ ] 이 확장은 사용자 데이터를 수집하지 않습니다 → **체크**
- 판매하지 않음 / 승인된 용도 외 사용 안 함 / 신용도 목적 사용 안 함 → 해당 없음(미수집)

---

## 4. 개인정보처리방침 (Privacy policy)

미수집이므로 단문으로 충분. 예:

> Azuki (Design Spec Extractor) does not collect, store, or transmit any personal data. All analysis runs locally in your browser; results and settings are stored only via chrome.storage on your device and are never sent anywhere.

(대시보드에 URL 요구 시 위 문구를 GitHub README 또는 별도 페이지에 게시하고 링크)

---

## 5. 설명 (Description) — manifest _locales와 동일

- **EN:** Analyze the current site's design and generate a DESIGN.md spec and design tokens for AI agents.
- **KO:** 현재 사이트의 디자인을 분석해 AI 에이전트용 DESIGN.md 스펙과 디자인 토큰을 생성합니다.

---

## 6. 스크린샷 / 등록정보 자산 (수동 준비 필요)

스토어 요구 규격 — 직접 캡처·업로드:
- [ ] 스크린샷 1280×800 또는 640×400, 최소 1장(권장 3~5장): ① 사이드패널 분석 결과 ② DESIGN.md 미리보기 ③ 디자인 여권(passport.svg) ④ 설정 페이지
- [ ] 아이콘 128×128 (포함됨: `icons/icon128.png`)
- [ ] 소형 프로모 타일 440×280 (선택)
- [ ] 카테고리: 개발자 도구
- [ ] 언어: 영어(기본) + 한국어

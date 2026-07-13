# Azuki — 노출·마케팅 플레이북

목표: Chrome Web Store 설치 늘리기. 타겟 = **AI 코딩 도구(Cursor/Claude/Copilot) 쓰는 개발자·디자이너**.
우선순위: 스토어 리스팅 → 데모 GIF → 초기 스파이크(PH/HN/커뮤니티) → 장기 유기(랜딩/블로그).

---

## 1. 스토어 리스팅 (최우선·즉효)
- 제목·설명은 [STORE_LISTING.md](STORE_LISTING.md) §5-1 SEO 카피 사용.
- **스크린샷 5장**(1280×800): ①분석 결과 패널 ②DESIGN.md ③에이전트 프롬프트 복사 ④디자인 여권 ⑤tokens 내보내기. 각 장에 한 줄 캡션 텍스트 얹기(전환율↑).
- 프로모 타일 440×280: 마스코트 + "Design → DESIGN.md".
- 카테고리: 개발자 도구. 언어: EN/KO.

## 2. 데모 GIF (모든 채널 재사용 자산)
- 15초 이내: 사이트 열기 → 아이콘 클릭 → 분석 → DESIGN.md/토큰 나오는 흐름.
- 도구: macOS `Cmd+Shift+5` 녹화 → [gifski](https://gif.ski) 또는 ezgif로 GIF 변환(≤5MB).
- 배치: 스토어 스샷, README 상단, PH 갤러리, 트위터/X, dev.to 글.
- 파일: `docs/assets/demo.gif` (랜딩·README에서 참조).

## 3. 초기 스파이크 (런칭 주)
- **Product Hunt** — 개발도구 초기 노출 최강 + 백링크(SEO 기여).
  - 태그라인: `Turn any website's design into a DESIGN.md spec for AI coding agents`
  - 준비: GIF, 썸네일, 첫 코멘트(제작 배경), 화요일~목요일 0:01 PT 등록.
- **Hacker News — Show HN**: `Show HN: Azuki – Extract any site's design into a DESIGN.md for AI agents`
- **Reddit**: r/ChatGPTCoding, r/cursor, r/webdev(자기홍보 규칙 확인). "내가 만든 툴 + 왜 만들었나" 진정성 글.
- **Discord**: Cursor / Claude 개발자 서버 #showcase.
- 공통: 판매 아님, "이 문제 겪어서 만들었다" 톤. 링크 1개 + GIF.

## 4. 장기 유기 트래픽
- **랜딩페이지**: `docs/index.html` (GitHub Pages, 무료). Settings → Pages → Source `/docs`.
- **블로그(dev.to 권장 > Medium)**: 
  - 제목 후보: "웹사이트 디자인을 AI가 읽는 DESIGN.md로 30초에" / "Give your AI coding agent real design context"
  - 구성: 문제(AI가 디자인 맥락 모름) → 데모 GIF → 사용법 → 출력 예시(DESIGN.md 실물) → 오픈소스 링크.
- **GitHub**: topics 태그(chrome-extension, design-tokens, ai, cursor, design-system, developer-tools), README 상단 GIF+설치 배지.

## 5. 측정
- 스토어 대시보드: 노출→설치 전환율, 유입 소스.
- README 배지 클릭, PH upvote, 유입 UTM(`?utm_source=producthunt` 등 랜딩 링크에).

---
체크리스트:
- [ ] 스토어 제목·설명 SEO 카피 적용
- [ ] 스크린샷 5장 + 캡션
- [ ] 데모 GIF 제작 → docs/assets/demo.gif
- [ ] GitHub topics 설정
- [ ] README 상단 GIF + 스토어 설치 배지
- [ ] GitHub Pages 랜딩 배포
- [ ] Product Hunt 등록
- [ ] Show HN + Reddit + Discord 글
- [ ] dev.to 블로그 글

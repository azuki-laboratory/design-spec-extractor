// i18n.js — popup(사이드패널) · options 공용 UI 문자열 + 적용 헬퍼.
// 기본 언어 'en'. 사용자 설정(chrome.storage.sync.lang)에 따라 'en' | 'ko'.
// 정적 요소: [data-i18n]=키 → textContent, [data-i18n-html]=키 → innerHTML,
//            [data-i18n-title]=키 → title 속성.
// 동적 문자열(popup.js/options.js): AZUKI_T(lang).키 또는 함수 호출.

const AZUKI_UI = {
  en: {
    // popup
    sub: "Azuki analyzes this page's design and builds a DESIGN.md.",
    analyze: "Analyze this page",
    add: "＋ Add page",
    clear: "Start over",
    hint: "Merge several pages into one spec: keep this panel open, go to another page, and click <b>Add page</b>. The panel stays open.",
    errNoPermission:
      "Access permission needed to read this site. Allow it and try again.",
    copy: "Copy",
    copied: "Copied",
    agentCopy: "Agent prompt",
    agentCopied: "Copied — paste into your agent",
    openPreview: "Open preview",
    passport: "Design passport",
    kit: "Page kit (.zip)",
    kitTitle: "Page kit",
    kitHint: "Get a launch-ready set of sample web pages built with this site's design — open right away, no build step.",
    kitLocked: "Analyze a page above first — this section unlocks when it's done.",
    kitIncludes: "Every kit includes: DESIGN.md · analytics snippets (GA4+PostHog) · i18n strings · llms.txt/robots.txt · deploy configs (Vercel/Netlify)",
    sectionAnalyze: "Analyze page",
    sectionKit: "Page kit",
    kitBrand: "Site or service name (blank = use page title)",
    kitHeadline: "Big title on the first screen (optional)",
    kitCta: "Text for the main button (optional, e.g. Start free)",
    kitLanding: "Landing",
    kitAuth: "Sign-in",
    kitDashboard: "Dashboard",
    kitComponents: "Gallery",
    kitPricing: "Pricing",
    kitBlog: "Blog",
    kitDocs: "Docs",
    kitLegal: "Legal",
    kitContact: "Contact",
    aiPrompt: "Describe the page you want — e.g. Intro page for a cafe with menu, prices and FAQ",
    aiGenerate: "Generate custom page (on-device AI)",
    aiWorking: "Composing with on-device AI…",
    aiBtnBusy: "Generating…",
    aiDownloading: "Downloading on-device model… this may take a while on first use.",
    aiDownloadPct: (p) => `Downloading on-device model… ${p}%`,
    aiReceiving: (n) => `Receiving response… ${n} chars`,
    aiDone: "Done! custom.html added — it will be included in the kit zip below.",
    aiFail: "AI could not produce a valid structure.",
    aiRetry: "Try again with a more specific description.",
    kitNoPages: "Select at least one page.",
    settings: "Settings",
    statusAnalyzing: "Analyzing page…",
    statusGenerating: "Generating document…",
    doneSingle: (el) => `Done — ${el} elements analyzed`,
    doneMerged: (pages, el) => `Done — ${pages} pages merged (${el} elements)`,
    errPrefix: "Error: ",
    errNoTab: "Can't run on this page. Use it on a regular website.",
    errNoResult: "Failed to get analysis result.",
    // options
    optTitle: "Azuki Settings",
    verWord: "Settings",
    aboutH: "About this extension",
    aboutP:
      "Analyzes the currently open web page and produces a <b>DESIGN.md</b> document plus design tokens that an AI agent can use directly. Colors, typography, spacing, components, and accessibility contrast are extracted at once.",
    usePanel: "Click the Azuki icon in the toolbar to open the side panel.",
    useMerge:
      "Move across pages and use “＋ Add page” to merge them into a single spec.",
    useExport: "Download in the format you want.",
    optionsH: "Custom Options",
    langLabel: "Language",
    langHint: "UI and generated documents follow this language.",
    maxLabel: "Max elements to analyze",
    maxHint:
      "Upper bound of DOM elements scanned per page. Higher is more thorough but slower. (default 4000, range 100–20000)",
    saveAsLabel: "Ask for location on download",
    saveAsHint:
      "Off saves straight to your Downloads folder. On asks where to save each time.",
    darkLabel: "Include dark-mode palette",
    darkHint:
      "When the page has <code>prefers-color-scheme: dark</code> overrides, include the dark palette in the output document/tokens.",
    save: "Save",
    reset: "Reset to defaults",
    saved: "Saved ✓",
    contactH: "Contact",
    contactP: "Send bug reports, feature ideas, and questions by email.",
    mailBtn: "Send email",
    mailSubject: "[Azuki] Inquiry",
  },
  ko: {
    // popup
    sub: "아즈키가 이 페이지의 디자인을 분석해 DESIGN.md를 만들어줘요.",
    analyze: "이 페이지 분석하기",
    add: "＋ 페이지 추가",
    clear: "새로 시작",
    hint: "여러 페이지를 한 스펙으로 <b>병합</b>: 패널을 연 채 다른 페이지로 이동해 <b>페이지 추가</b>를 누르세요. 패널은 닫히지 않아요.",
    errNoPermission:
      "이 사이트를 읽으려면 접근 권한이 필요해요. 허용한 뒤 다시 시도하세요.",
    copy: "복사",
    copied: "복사됨",
    agentCopy: "에이전트 프롬프트",
    agentCopied: "복사됨 — 에이전트에 붙여넣기",
    openPreview: "미리보기 열기",
    passport: "디자인 여권",
    kit: "페이지 키트 (.zip)",
    kitTitle: "페이지 키트",
    kitHint: "이 사이트의 디자인으로 만든, 배포 준비된 샘플 웹페이지 묶음을 받아요 — 빌드 없이 바로 열립니다.",
    kitLocked: "먼저 위에서 페이지를 분석하세요 — 완료되면 여기가 열려요.",
    kitIncludes: "모든 키트에 포함: DESIGN.md · 분석 스니펫(GA4+PostHog) · 다국어 문자열 · llms.txt/robots.txt · 배포 설정(Vercel/Netlify)",
    sectionAnalyze: "페이지 분석",
    sectionKit: "페이지 키트",
    kitBrand: "사이트/서비스 이름 (비우면 페이지 제목 사용)",
    kitHeadline: "첫 화면에 크게 보일 제목 (선택)",
    kitCta: "주요 버튼에 넣을 문구 (선택, 예: 무료로 시작)",
    kitLanding: "랜딩",
    kitAuth: "로그인",
    kitDashboard: "대시보드",
    kitComponents: "갤러리",
    kitPricing: "가격",
    kitBlog: "블로그",
    kitDocs: "문서",
    kitLegal: "법률",
    kitContact: "문의",
    aiPrompt: "원하는 페이지를 설명하세요 — 예: 카페 소개 페이지, 메뉴·가격·자주 묻는 질문 포함",
    aiGenerate: "AI 맞춤 페이지 생성 (온디바이스)",
    aiWorking: "온디바이스 AI로 구성 중…",
    aiBtnBusy: "생성 중…",
    aiDownloading: "온디바이스 모델 다운로드 중… 처음 한 번은 시간이 걸릴 수 있어요.",
    aiDownloadPct: (p) => `온디바이스 모델 다운로드 중… ${p}%`,
    aiReceiving: (n) => `응답 수신 중… ${n}자`,
    aiDone: "완료! custom.html 추가됨 — 아래 키트 zip에 포함됩니다.",
    aiFail: "AI가 유효한 구조를 만들지 못했어요.",
    aiRetry: "더 구체적으로 설명해서 다시 시도해 보세요.",
    kitNoPages: "페이지를 하나 이상 선택하세요.",
    settings: "설정",
    statusAnalyzing: "페이지 분석 중…",
    statusGenerating: "문서 생성 중…",
    doneSingle: (el) => `완료 — ${el}개 요소 분석됨`,
    doneMerged: (pages, el) => `완료 — ${pages}개 페이지 병합 (요소 ${el}개)`,
    errPrefix: "오류: ",
    errNoTab:
      "이 페이지에서는 실행할 수 없습니다. 일반 웹사이트에서 사용하세요.",
    errNoResult: "분석 결과를 가져오지 못했습니다.",
    // options
    optTitle: "Azuki 설정",
    verWord: "설정",
    aboutH: "이 확장 프로그램은",
    aboutP:
      "현재 열려 있는 웹페이지의 디자인을 분석해, AI 에이전트가 바로 쓸 수 있는 <b>DESIGN.md</b> 문서와 디자인 토큰을 만들어 줍니다. 색상·타이포그래피·여백·컴포넌트·접근성 대비까지 한 번에 추출합니다.",
    usePanel: "툴바의 Azuki 아이콘을 누르면 사이드패널이 열립니다.",
    useMerge:
      "여러 페이지를 돌며 “＋ 페이지 추가”로 하나의 스펙으로 병합할 수 있어요.",
    useExport: "사용자가 원하는 포맷으로 다운로드 할 수 있습니다.",
    optionsH: "커스텀 옵션",
    langLabel: "언어",
    langHint: "UI와 생성 문서가 이 언어를 따릅니다.",
    maxLabel: "분석 요소 최대 개수",
    maxHint:
      "한 페이지에서 훑을 DOM 요소 상한. 크게 하면 더 꼼꼼하지만 느려집니다. (기본 4000, 범위 100–20000)",
    saveAsLabel: "다운로드 시 위치 묻기",
    saveAsHint:
      "끄면 “다운로드” 폴더로 바로 저장됩니다. 켜면 저장 위치를 매번 물어봐요.",
    darkLabel: "다크 모드 팔레트 포함",
    darkHint:
      "페이지가 <code>prefers-color-scheme: dark</code> 재정의를 가질 때, 결과 문서/토큰에 다크 팔레트를 함께 넣습니다.",
    save: "저장",
    reset: "기본값으로",
    saved: "저장됨 ✓",
    contactH: "문의",
    contactP: "버그 제보, 기능 제안, 사용 문의는 메일로 보내주세요.",
    mailBtn: "메일 보내기",
    mailSubject: "[Azuki] 문의",
  },
};

export function AZUKI_T(lang) {
  return AZUKI_UI[lang === "ko" ? "ko" : "en"];
}

// 정적 [data-i18n*] 요소를 현재 언어로 채운다.
export function applyI18n(root, lang) {
  const t = AZUKI_T(lang);
  (root || document).querySelectorAll("[data-i18n]").forEach((el) => {
    const v = t[el.getAttribute("data-i18n")];
    if (typeof v === "string") el.textContent = v;
  });
  (root || document).querySelectorAll("[data-i18n-html]").forEach((el) => {
    const v = t[el.getAttribute("data-i18n-html")];
    if (typeof v === "string") el.innerHTML = v;
  });
  (root || document).querySelectorAll("[data-i18n-title]").forEach((el) => {
    const v = t[el.getAttribute("data-i18n-title")];
    if (typeof v === "string") el.title = v;
  });
  (root || document).querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const v = t[el.getAttribute("data-i18n-placeholder")];
    if (typeof v === "string") el.placeholder = v;
  });
}

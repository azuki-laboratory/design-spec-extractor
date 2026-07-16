// test/e2e.js — 크롬 로드부터 DESIGN.md 생성까지 전체 자동화 테스트
//
// 흐름:
//   1. 로컬 HTTP 서버 시작 → test/fixture.html 서빙 (알려진 디자인 값)
//   2. Playwright launchPersistentContext + --load-extension 으로 확장 로드
//   3. MV3 service worker URL에서 확장 ID 추출
//   4. 픽스처 페이지 탭 열기 (분석 대상)
//   5. chrome-extension://<ID>/popup.html 을 탭으로 열어 "분석하기" 클릭
//      → popup.js가 lastAccessed 폴백으로 픽스처 탭을 찾아 분석
//   6. 미리보기 텍스트를 읽어 픽스처의 알려진 값들과 대조(assert)
//
// 실행: npm test  (또는 node test/e2e.js)
// 옵션: HEADFUL=1 node test/e2e.js  → 브라우저 창 보면서 실행

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const EXT_DIR = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixture.html');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  /* 1. 픽스처 서버 */
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(FIXTURE));
  });
  await new Promise((r) => server.listen(0, r)); // 포트 0 = OS가 빈 포트 할당 (EADDRINUSE 방지)
  const PORT = server.address().port;
  console.log(`픽스처 서버: http://localhost:${PORT}`);

  /* 2. 확장 로드된 크롬 실행 */
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dse-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: !process.env.HEADFUL, // 신형 headless는 확장 지원
    args: [
      `--disable-extensions-except=${EXT_DIR}`,
      `--load-extension=${EXT_DIR}`,
    ],
  });

  try {
    /* 3. 확장 ID 추출 (MV3 → service worker 없으면 팝업 열어 감지 유도 불가하므로 대기) */
    let [sw] = context.serviceWorkers();
    // action-only 확장은 service worker가 없을 수 있음 → 관리 페이지에서 ID 조회 불가하므로
    // background 없는 본 확장은 chrome://extensions 대신 CDP Target 목록에서 찾는다.
    let extId = sw ? new URL(sw.url()).host : null;
    if (!extId) {
      // popup.html이 target으로 없으므로: 아무 페이지에서 CDP로 확장 목록 대신,
      // 고정 ID를 얻기 위해 manifest key 없이도 동작하는 방법 — chrome://extensions DOM 파싱
      const mgmt = await context.newPage();
      await mgmt.goto('chrome://extensions');
      extId = await mgmt.evaluate(() => {
        const items = document.querySelector('extensions-manager')
          .shadowRoot.querySelector('extensions-item-list')
          .shadowRoot.querySelectorAll('extensions-item');
        return items.length ? items[0].id : null;
      });
      await mgmt.close();
    }
    if (!extId) throw new Error('확장 ID를 찾지 못했습니다.');
    console.log(`확장 ID: ${extId}`);

    /* 4. 분석 대상 픽스처 탭 */
    const target = await context.newPage();
    await target.goto(`http://localhost:${PORT}/`);
    await target.waitForLoadState('load');

    /* 5. popup을 탭으로 열어 분석 실행 */
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/src/popup.html`);
    popup.on('console', (m) => console.log('[popup console]', m.type(), m.text()));

    // 기본 언어 = 영어. UI가 영문으로 적용되는지 확인.
    try {
      await popup.waitForFunction(
        () => document.getElementById('analyze')?.textContent.trim() === 'Analyze this page',
        { timeout: 8000 }
      );
      check('기본 언어 EN — 분석 버튼 영문', true);
    } catch (e) {
      check('기본 언어 EN — 분석 버튼 영문', false, await popup.textContent('#analyze'));
    }
    // 이후 문서 검증은 한국어 출력 기준 → lang=ko로 전환 후 리로드(loadOpts가 ko 반영).
    await popup.evaluate(() => chrome.storage.sync.set({ lang: 'ko' }));
    await popup.reload();
    await popup.waitForFunction(
      () => document.getElementById('analyze')?.textContent.trim() === '이 페이지 분석하기',
      { timeout: 8000 }
    );

    // 분석: 개발 빌드는 host_permissions 선언 → ensureHostAccess가 무프롬프트 통과.
    await popup.click('#analyze');
    try {
      await popup.waitForSelector('#result', { state: 'visible', timeout: 15000 });
    } catch (e) {
      console.error('분석 실패. 상태:', await popup.textContent('#status'));
      throw e;
    }
    const md = await popup.textContent('#preview');
    const status = await popup.textContent('#status');
    console.log(`상태: ${status}\n`);

    /* 6. 검증 — fixture.html의 알려진 값과 대조 */
    console.log('DESIGN.md 검증:');
    for (let i = 1; i <= 9; i++) check(`섹션 ${i} 존재`, md.includes(`## ${i}.`));
    check('라이트 테마 감지', md.includes('라이트 테마'));
    check('페이지 배경 #fafafa', md.toLowerCase().includes('#fafafa'));
    check('Primary 컬러 #e11d48 (버튼 배경)', md.toLowerCase().includes('#e11d48'));
    check('링크 색 #0ea5e9', md.toLowerCase().includes('#0ea5e9'));
    check('본문 폰트 Georgia', md.includes('Georgia'));
    check('H1 40px', /H1\s*\|\s*40px/.test(md));
    check('버튼 반경 10px', md.includes('border-radius: 10px'));
    check('카드 감지 (반경 14px)', md.includes('14px'));
    check('입력창 감지', md.includes('입력창'));
    check('컴포넌트 일관성 지표', /일관성.*감지, 스타일 \d+종/.test(md));
    check(':hover 규칙 추출', md.includes(':hover'));
    check('브레이크포인트 768px', /\|\s*768px\s*\|/.test(md));
    check('브레이크포인트 480px', /\|\s*480px\s*\|/.test(md));
    check('그림자 시스템 추출', md.includes('rgba(0, 0, 0, 0.08)') || md.includes('0.08'));
    check('CSS 변수 --color-primary 추출', md.includes('--color-primary'));
    check('여백 스케일 포함(16px)', md.includes('16px'));
    check('에이전트 프롬프트에 Primary 반영', md.split('## 9.')[1]?.includes('#e11d48'));
    check('max-width 960px 컨테이너', md.includes('960px'));

    // awesome-design-md 포맷 검증
    check('YAML frontmatter 시작', md.startsWith('---'));
    check('frontmatter colors 토큰', /colors:\n\s+canvas:/.test(md));
    check('frontmatter typography 토큰', md.includes('typography:') && md.includes('display-xl:'));
    check('frontmatter spacing 토큰', /spacing:\n\s+xxs:/.test(md) || /spacing:\n\s+xs:/.test(md));
    check('{colors.*} 토큰 참조', md.includes('{colors.primary}'));
    check('Key Characteristics', md.includes('Key Characteristics'));
    check('시맨틱 그룹 (Brand & Accent)', md.includes('### Brand & Accent'));
    check('elevation 레벨 테이블', md.includes('| Level | 그림자'));
    check('nav-bar 컴포넌트 (sticky 헤더)', md.includes('nav-bar') && md.includes('sticky'));
    check('터치 타깃 섹션', md.includes('터치 타깃'));
    check('Iteration Guide', md.includes('Iteration Guide'));

    // tokens.css / tokens.json 내보내기 검증
    const exported = await popup.evaluate(() => ({ css: window.__tokensCss, json: window.__tokensJson }));
    check('tokens.css 생성', !!exported.css && exported.css.includes(':root {'));
    check('tokens.css primary 변수', exported.css.includes('--color-primary: #e11d48;'));
    check('tokens.css spacing 변수', /--spacing-\w+: \d+px;/.test(exported.css));
    check('tokens.css radius 변수', /--radius-\w+: \d+px;/.test(exported.css));
    check('tokens.css 그림자 변수', exported.css.includes('--shadow-level-1:'));
    let tokensObj = null;
    try { tokensObj = JSON.parse(exported.json); } catch (e) {}
    check('tokens.json 유효한 JSON', !!tokensObj);
    check('tokens.json W3C color 토큰', tokensObj?.color?.primary?.$value === '#e11d48' && tokensObj?.color?.primary?.$type === 'color');
    check('tokens.json typography 토큰', tokensObj?.typography?.body?.$value?.fontFamily === 'Georgia');
    check('tokens.json breakpoint', tokensObj?.breakpoint?.['bp-768']?.$value === '768px');
    fs.writeFileSync(path.join(__dirname, 'output-tokens.css'), exported.css);
    fs.writeFileSync(path.join(__dirname, 'output-tokens.json'), exported.json);

    // 그라디언트 / 다크모드 팔레트
    check('그라디언트 추출', md.includes('linear-gradient(90deg, rgb(225, 29, 72)') || md.includes('그라디언트'));
    check('다크 모드 팔레트 (md)', md.includes('prefers-color-scheme: dark') && md.includes('--color-primary: #fb7185'));
    check('다크 모드 블록 (tokens.css)', exported.css.includes('@media (prefers-color-scheme: dark)'));

    // preview.html
    const pv = await popup.evaluate(() => window.__previewHtml);
    check('preview.html 생성', !!pv && pv.includes('<!DOCTYPE html>'));
    check('preview.html 색상 스와치', pv.includes('#e11d48'));
    check('preview.html 버튼 재현', pv.includes('button-primary'));
    fs.writeFileSync(path.join(__dirname, 'output-preview.html'), pv);

    // UI: 새 버튼 존재
    // preview/screenshot 다운로드 버튼은 제거됨 — preview는 '미리보기 열기'로만 사용
    check('preview.html 다운로드 버튼 없음', !(await popup.isVisible('#download-html').catch(() => false)));
    check('screenshot 버튼 없음', !(await popup.isVisible('#download-shot').catch(() => false)));
    check('분석/키트 스텝 구분 표시', (await popup.locator('.step-title').count()) === 2);
    check('키트 구역 잠금 해제 (분석 후)', (await popup.getAttribute('#kit-panel', 'aria-disabled')) === 'false');
    check('페이지 추가 버튼 표시', await popup.isVisible('#add'));

    // 멀티 페이지 병합: 다른 URL(같은 픽스처)을 추가 분석
    await target.goto(`http://localhost:${PORT}/page2`);
    await target.waitForLoadState('load');
    await popup.bringToFront();
    await popup.click('#add');
    await popup.waitForFunction(() => document.getElementById('status').textContent.includes('병합'), { timeout: 15000 });
    const mergedMd = await popup.textContent('#preview');
    const mergedStatus = await popup.textContent('#status');
    check('병합 상태 표시 (2개 페이지)', mergedStatus.includes('2개 페이지 병합'));
    check('병합 문서에 소스 2개 나열', mergedMd.includes('/page2') && mergedMd.includes('2개 페이지 병합'));
    check('병합 후에도 Primary 유지', mergedMd.includes('#e11d48'));
    check('병합 후 frontmatter 유지', mergedMd.startsWith('---'));

    // 웹폰트 @font-face 추출
    check('웹폰트 @font-face 추출', md.includes('로드된 웹폰트') && md.includes('Fixture Sans'));
    check('웹폰트 weight/format', md.includes('weight 700') && md.includes('woff2'));

    // WCAG 대비 리포트
    check('WCAG 대비 섹션', md.includes('접근성 대비 (WCAG Contrast)'));
    check('WCAG 판정 (본문 AAA)', /본문 텍스트 .* AAA/.test(md) || /본문 텍스트 .* AA/.test(md));

    // tailwind.config.js 내보내기
    const tw = await popup.evaluate(() => window.__tailwindCfg);
    check('tailwind.config.js 생성', !!tw && tw.includes('module.exports'));
    check('tailwind colors.primary', tw.includes("'primary': '#e11d48'"));
    check('tailwind spacing/radius', tw.includes('spacing:') && tw.includes('borderRadius:'));
    check('tailwind screens 브레이크포인트', tw.includes("'bp768': '768px'"));
    check('tailwind.config.js 다운로드 버튼', await popup.isVisible('#download-tw'));
    fs.writeFileSync(path.join(__dirname, 'output-tailwind.config.js'), tw);

    // 분석 고도화: 타입 스케일 비율 / 여백 기본단위 / 시맨틱 색
    check('타입 스케일 비율 감지', md.includes('감지된 스케일 비율'));
    check('여백 기본 단위 감지 (8px)', /기본 단위\*\*: 8px/.test(md));
    check('WCAG 대비 판정 유지', md.includes('접근성 대비 (WCAG Contrast)'));
    // 투명 버튼(rgba 0 알파)이 검정 phantom primary로 오인되지 않아야 함
    check('투명 버튼 → primary 오염 없음', /`{colors.primary}`\*\* — `#e11d48`/.test(md));
    check('phantom #000000 토큰 없음', !/\{colors\.(primary|canvas)\}`\*\* — `#000000`/.test(md));

    // Azuki 시그니처 기능
    check('디자인 DNA (섹션 1)', md.includes('디자인 DNA'));
    check('디자인 린트 섹션 (10)', md.includes('## 10.') && md.includes('디자인 린트'));
    check('마스코트 촌평 표시', (await popup.textContent('#mascot')).trim().length > 0);
    check('DNA 칩 렌더', (await popup.evaluate(() => document.querySelectorAll('#dna span').length)) > 0);
    check('에이전트 프롬프트 버튼', await popup.isVisible('#copy-agent'));
    const agentPrompt = await popup.evaluate(() => window.__agentPrompt);
    check('에이전트 프롬프트 생성', !!agentPrompt && agentPrompt.includes('Colors:') && agentPrompt.includes('#e11d48'));

    // 디자인 지문 + 여권 (신규 아이덴티티)
    const fp = await popup.evaluate(() => window.__fingerprint);
    check('디자인 지문 코드 형식', /^AZ-[0-9A-F]{4}-[0-9A-F]{4}$/.test(fp || ''));
    check('지문 표시 요소', await popup.isVisible('#fingerprint'));
    const passport = await popup.evaluate(() => window.__passportSvg);
    check('디자인 여권 SVG 생성', !!passport && passport.includes('<svg') && passport.includes('DESIGN PASSPORT'));
    check('여권에 지문 포함', !!passport && fp && passport.includes(fp));
    check('여권 다운로드 버튼', await popup.isVisible('#download-passport'));
    check('미리보기 열기 버튼', await popup.isVisible('#open-preview'));
    fs.writeFileSync(path.join(__dirname, 'output-passport.svg'), passport || '');

    // Azuki 시그니처: 페이지 키트 (스타터 템플릿 zip)
    const kitFiles = await popup.evaluate(() => window.__kitFiles);
    const kitByName = Object.fromEntries((kitFiles || []).map((f) => [f.name, f.content]));
    const KIT_EXPECT = ['index.html', 'auth.html', 'dashboard.html', 'pricing.html', 'blog.html', 'docs.html', 'legal.html', 'contact.html', 'components.html',
      '404.html', 'DESIGN.md', 'assets/css/tokens.css', 'assets/css/kit.css', 'assets/favicon.svg', 'snippets/analytics.html', 'i18n/strings.json',
      'llms.txt', 'robots.txt', 'sitemap.xml', '.gitignore', 'vercel.json', 'netlify.toml', 'README.md'];
    check('런치 키트 파일 23종 (상용 구조)', (kitFiles || []).length === KIT_EXPECT.length && KIT_EXPECT.every((n) => !!kitByName[n]));
    check('키트 파비콘·사이트맵', (kitByName['assets/favicon.svg'] || '').includes('<svg') && (kitByName['sitemap.xml'] || '').includes('<urlset'));
    check('키트 404 페이지', (kitByName['404.html'] || '').includes('404'));
    check('AI 구조 스키마 export', await popup.evaluate(() => !!window.DesignGenerator.KIT_STRUCTURE_SCHEMA && window.DesignGenerator.customKitFewShot('ko').length === 2));
    check('키트 DESIGN.md 동봉', (kitByName['DESIGN.md'] || '').includes('#e11d48'));
    check('키트 인증 페이지 (소셜 로그인)', (kitByName['auth.html'] || '').includes('social-btn') && (kitByName['auth.html'] || '').includes('Google'));
    check('키트 챗봇 위젯 (랜딩, CSS 전용)', (kitByName['index.html'] || '').includes('chat-fab') && !(kitByName['index.html'] || '').toLowerCase().includes('<script'));
    check('키트 SEO 메타 + LLMO', (kitByName['index.html'] || '').includes('og:title') && (kitByName['llms.txt'] || '').length > 0);
    check('키트 분석 스니펫 (GA4+PostHog)', (kitByName['snippets/analytics.html'] || '').includes('googletagmanager') && (kitByName['snippets/analytics.html'] || '').includes('posthog'));
    check('키트 다국어 문자열', (() => { try { const j = JSON.parse(kitByName['i18n/strings.json']); return !!j.en && !!j.ko; } catch (e) { return false; } })());
    check('키트 배포 설정', (kitByName['vercel.json'] || '').includes('cleanUrls') && (kitByName['netlify.toml'] || '').includes('publish'));
    check('키트 법률·문의 페이지', (kitByName['legal.html'] || '').includes('id="privacy"') && (kitByName['contact.html'] || '').includes('<form'));
    check('키트 랜딩에 토큰 참조', (kitByName['assets/css/kit.css'] || '').includes('var(--color-'));
    check('키트에 Primary 반영', (kitByName['assets/css/kit.css'] || '').toLowerCase().includes('#e11d48') || (kitByName['assets/css/tokens.css'] || '').includes('--color-primary: #e11d48'));
    check('키트 갤러리에 스와치', (kitByName['components.html'] || '').includes('--color-canvas'));
    check('키트 XSS 이스케이프 (script 태그 없음)', !(kitByName['index.html'] || '').toLowerCase().includes('<script') && !(kitByName['components.html'] || '').toLowerCase().includes('<script'));
    const zipHead = await popup.evaluate(() => {
      const zip = window.DesignGenerator.buildKitZip(window.__kitFiles, new Date());
      return [zip[0], zip[1], zip.length];
    });
    check('키트 zip 시그니처(PK)', zipHead[0] === 0x50 && zipHead[1] === 0x4b && zipHead[2] > 1000);
    check('페이지 키트 버튼', await popup.isVisible('#download-kit'));

    // 맞춤 키트: 옵션(브랜드/CTA/페이지 선택) 반영
    const customKit = await popup.evaluate(() => {
      const files = window.DesignGenerator.exportKit(window.__analysisData, 'ko', { brand: '테스트브랜드', cta: '구매하기', headline: '나만의 헤드라인', pages: ['landing'] });
      return { names: files.map((f) => f.name), index: files.find((f) => f.name === 'index.html')?.content || '' };
    });
    check('맞춤 키트 페이지 선택 (landing만)', customKit.names.includes('index.html') && !customKit.names.includes('dashboard.html') && !customKit.names.includes('pricing.html') && !customKit.names.includes('auth.html'));
    check('맞춤 키트 브랜드·문구 반영', customKit.index.includes('테스트브랜드') && customKit.index.includes('구매하기') && customKit.index.includes('나만의 헤드라인'));

    // AI 맞춤 페이지: 구조 JSON → 렌더 (결정적 검증 — LLM 호출 없음)
    const custom = await popup.evaluate(() => {
      const structure = window.DesignGenerator.parseKitStructure('```json\n{"title":"요가 스튜디오","brand":"<script>alert(1)</script>","sections":[{"type":"hero","title":"몸과 마음의 균형","body":"소규모 클래스","cta":"예약하기"},{"type":"pricing","items":[{"title":"1개월","price":"₩99,000","features":["주 2회"]}]},{"type":"faq","items":[{"title":"초보자도 되나요?","body":"네."}]}]}\n```');
      return structure ? window.DesignGenerator.buildCustomKitPage(window.__analysisData, structure, 'ko') : null;
    });
    check('AI 구조 JSON 파싱 (코드펜스 관용)', !!custom);
    check('AI 맞춤 페이지 렌더', !!custom && custom.includes('몸과 마음의 균형') && custom.includes('₩99,000') && custom.includes('예약하기'));
    check('AI 맞춤 페이지 XSS 이스케이프', !!custom && !custom.includes('<script>alert') && custom.includes('&lt;script&gt;'));
    check('AI 프롬프트 UI 기본 숨김 (미지원 환경)', !(await popup.isVisible('#ai-kit')));
    // 산출물 덤프 (육안 확인용)
    const kitDir = path.join(__dirname, 'output-kit');
    (kitFiles || []).forEach((f) => {
      const p = path.join(kitDir, f.name);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, f.content);
    });

    // 분석 고도화: 테두리 두께 / 불투명도 / 모션 / 접근성 / 아이콘 (섹션 6·11)
    check('테두리 두께 추출', /테두리 두께.*1px/.test(md));
    check('불투명도 스케일 추출', md.includes('불투명도 스케일') && md.includes('0.6'));
    check('애니메이션 추출', md.includes('애니메이션') && md.includes('spin'));
    check('접근성 섹션 (11)', md.includes('## 11.') && md.includes('접근성 & 자산'));
    check('제목 순서', md.includes('제목 순서') && md.includes('h1'));
    check('이미지 alt 커버리지 100%', /이미지 alt 커버리지.*100%/.test(md));
    check('랜드마크 감지', md.includes('랜드마크') && md.includes('main'));
    check('인라인 SVG 아이콘 감지', /인라인 SVG 아이콘.*1/.test(md));

    // 컴포넌트 감지 고도화
    check('배지/태그/칩 감지', md.includes('배지 / 태그 / 칩') && /`badge`/.test(md));
    check('폼 컨트롤 인벤토리', md.includes('폼 컨트롤') && md.includes('checkbox') && md.includes('radio'));
    check('폼 accent 색 감지', /강조색\(accent\).*#e11d48/.test(md));
    check('테이블 감지', md.includes('`table`') && md.includes('border-collapse'));

    // 보안: preview.html/passport 살균 — 악성 값 주입이 실행 코드로 새어나가지 않아야 함
    const xss = await popup.evaluate(() => {
      const evil = {
        meta: { title: '</title><script>window.__x=1<\/script>', url: 'https://e"vil</style><script>1<\/script>', analyzedAt: '2026', viewport: { width: 1, height: 1 }, elementsScanned: 1 },
        theme: { isDark: false, pageBackground: '#fff' },
        colors: { backgrounds: [{ hex: '#ffffff', weight: 1 }], texts: [{ hex: '#111111', count: 1 }], borders: [], links: [], gradients: [] },
        typography: { families: [{ family: '</style><script>window.__x=1<\/script>', count: 1 }], sizes: [{ px: 16, count: 1 }], weights: [{ weight: 400, count: 1 }], headings: {}, body: { size: 16, weight: 400, lineHeight: 1.5, family: '</style><script>1<\/script>' } },
        components: { buttons: [{ style: { background: 'red"><script>1<\/script>', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px', fontSize: '14px', fontWeight: '700', boxShadow: 'none', transition: 'none' }, count: 1 }], input: null, card: null, nav: null, badge: null, table: null, formControls: null, linkUnderline: null, hoverRules: [], focusRules: [], jsHoverDiffs: [] },
        layout: { spacingScale: [{ px: 8, count: 1 }], gaps: [], gridCount: 0, flexCount: 1, totalContainers: 1, containerWidths: [] },
        depth: { shadows: [], radii: [{ px: 4, count: 1 }], zIndices: [], transitions: [] },
        responsive: { breakpoints: [] }, cssVars: [], darkVars: [], fontFaces: [],
      };
      const pv = DesignGenerator.exportPreview(evil, 'en');
      const ps = DesignGenerator.exportPassport(evil, 'en');
      return { pvBad: /<script>/i.test(pv), psBad: /<script>/i.test(ps) };
    });
    check('preview.html XSS 살균 (raw <script> 없음)', xss.pvBad === false);
    check('passport.svg XSS 살균 (raw <script> 없음)', xss.psBad === false);

    // chrome.i18n — manifest 현지화(_locales) 해석 확인
    const i18nMsg = await popup.evaluate(() => ({
      desc: chrome.i18n.getMessage('extDescription'),
      title: chrome.i18n.getMessage('actionTitle'),
    }));
    check('_locales 메시지 해석 (extDescription)', !!i18nMsg.desc && i18nMsg.desc.length > 0);
    check('_locales 메시지 해석 (actionTitle)', !!i18nMsg.title && i18nMsg.title.length > 0);

    /* 결과 파일 저장 (수동 확인용) */
    const out = path.join(__dirname, 'output-DESIGN.md');
    fs.writeFileSync(out, md);
    console.log(`\n생성 문서 저장: ${out}`);
  } finally {
    await context.close();
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  console.log(failures === 0 ? '\n전체 통과 ✅' : `\n실패 ${failures}건 ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

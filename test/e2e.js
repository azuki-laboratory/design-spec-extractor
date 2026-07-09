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
    await popup.goto(`chrome-extension://${extId}/popup.html`);
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
    check('preview.html 다운로드 버튼', await popup.isVisible('#download-html'));
    check('screenshot 다운로드 버튼', await popup.isVisible('#download-shot'));
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

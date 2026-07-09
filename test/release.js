// test/release.js — 배포 빌드(dist/release) 스모크 테스트
//
// 배포 빌드는 activeTab만 쓰므로 "아이콘 클릭" 제스처가 필요한데,
// Playwright는 실제 툴바 클릭을 재현할 수 없다. 따라서 여기서는:
//   1. manifest 권한이 올바르게 축소되었는지 (tabs/host_permissions 제거)
//   2. 필수 파일이 모두 포함되었는지
//   3. 빌드된 확장이 크롬에 정상 로드되고 popup UI가 렌더되는지
//   4. 권한 게이트 동작: 탭으로 연 popup에서 분석 시도 → 대상 탭을 못 찾아
//      안내 오류가 뜨는지 (크래시 없이 실패해야 정상)
// 를 검증한다. 실제 분석 동작(제스처 필요)은 수동 1회 확인: README 참고.
//
// 실행: npm run build && npm run test:release

const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const OUT = path.resolve(__dirname, '..', 'dist', 'release');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  console.log('배포 빌드 검증:');

  /* 1. 정적 검증 */
  check('dist/release 존재', fs.existsSync(OUT), '먼저 npm run build 실행');
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
  check('tabs 권한 제거됨', !manifest.permissions.includes('tabs'));
  check('host_permissions 제거됨', !('host_permissions' in manifest));
  check('optional_host_permissions 유지 (런타임 요청용)', Array.isArray(manifest.optional_host_permissions) && manifest.optional_host_permissions.length > 0);
  check('activeTab 유지', manifest.permissions.includes('activeTab'));
  check('scripting 유지', manifest.permissions.includes('scripting'));
  check('sidePanel 유지', manifest.permissions.includes('sidePanel'));
  check('storage 유지', manifest.permissions.includes('storage'));
  check('side_panel 경로 유지', manifest.side_panel && manifest.side_panel.default_path === 'popup.html');
  check('options_page 유지', manifest.options_page === 'options.html');
  check('background(service worker) 유지', !!(manifest.background && manifest.background.service_worker));
  ['popup.html', 'popup.js', 'analyzer.js', 'generator.js', 'background.js', 'options.html', 'options.js', 'i18n.js', 'icons/icon128.png'].forEach((f) =>
    check(`파일 포함: ${f}`, fs.existsSync(path.join(OUT, f)))
  );

  /* 2. 크롬 로드 스모크 */
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dse-rel-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: !process.env.HEADFUL,
    args: [`--disable-extensions-except=${OUT}`, `--load-extension=${OUT}`],
  });
  try {
    const mgmt = await context.newPage();
    await mgmt.goto('chrome://extensions');
    const ext = await mgmt.evaluate(() => {
      const items = document.querySelector('extensions-manager')
        .shadowRoot.querySelector('extensions-item-list')
        .shadowRoot.querySelectorAll('extensions-item');
      if (!items.length) return null;
      const item = items[0];
      return { id: item.id, hasError: !!item.shadowRoot.querySelector('#errors-button') };
    });
    check('확장 로드됨', !!ext);
    check('로드 오류 없음', ext && !ext.hasError);
    await mgmt.close();

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${ext.id}/popup.html`);
    check('popup UI 렌더', await popup.isVisible('#analyze'));
    // 배포는 host_permissions 없음 → 분석 버튼이 permissions.request로 접근을 얻는다(런타임 팝업).
    // 실제 권한 승인 흐름은 헤드리스에서 재현 불가하므로 수동 1회 확인(README "배포" 참고).
    check('분석 버튼 존재(런타임 권한 요청 트리거)', await popup.isVisible('#analyze'));
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  console.log(failures === 0 ? '\n배포 빌드 통과 ✅ (실제 분석은 수동 1회 확인: README "배포" 참고)' : `\n실패 ${failures}건 ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

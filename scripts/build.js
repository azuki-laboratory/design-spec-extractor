// scripts/build.js — 스토어 배포용 빌드 생성
//
// 소스(개발용) manifest는 E2E 테스트를 위해 넓은 권한(tabs, host_permissions)을 갖는다.
// 배포 빌드는 이를 제거하고 activeTab만 남긴다 — 사용자가 아이콘을 클릭한 탭에만
// 접근하므로 "모든 사이트 데이터 읽기" 경고 없이 심사 통과가 쉽다.
//
// 실행: npm run build
// 산출물: dist/release/ (압축 해제 로드용), dist/azuki-v<버전>.zip (스토어 업로드용)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'release');

// 소스는 src/ 아래(ESM). 배포는 src/ 트리 통째로 복사.
const SRC = path.join(ROOT, 'src');
const KEY_FILES = ['src/popup.html', 'src/popup.js', 'src/analyzer.js', 'src/background.js', 'src/options.html', 'src/options.js', 'src/i18n.js', 'src/generator/index.js'];

// 빌드 전 사전 검증 — 핵심 소스 파일 존재 확인(누락 시 조용히 깨진 빌드 방지)
const missing = KEY_FILES.filter((f) => !fs.existsSync(path.join(ROOT, f)));
if (missing.length) throw new Error(`빌드 중단 — 소스 파일 누락: ${missing.join(', ')}`);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });

// manifest: 개발 전용 권한 제거
// - tabs / host_permissions: 배포는 activeTab 최소 권한만 → "모든 사이트 데이터 읽기" 경고 회피
// - background(background.js)는 유지: 사이드패널 열기(action.onClicked)에 필요.
//   background.js의 hotreload 분기는 installType 게이트로 배포 환경에서 자동 비활성.
// - sidePanel 권한 유지: 패널 열기에 필요.
// - optional_host_permissions 유지: 배포는 host_permissions 없이, 분석 버튼 클릭 시 런타임 요청으로 접근.
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

// manifest 필수 키 검증 — 하나라도 빠지면 배포 빌드가 조용히 망가지므로 즉시 실패.
const REQUIRED = ['manifest_version', 'name', 'version', 'background', 'action', 'side_panel', 'options_page', 'default_locale'];
const lackKeys = REQUIRED.filter((k) => !(k in manifest));
if (lackKeys.length) throw new Error(`빌드 중단 — manifest 필수 키 누락: ${lackKeys.join(', ')}`);
if (!Array.isArray(manifest.optional_host_permissions) || !manifest.optional_host_permissions.length) {
  throw new Error('빌드 중단 — optional_host_permissions 누락 (배포에서 분석 버튼이 접근을 못 얻음)');
}

manifest.permissions = manifest.permissions.filter((p) => p !== 'tabs');
delete manifest.host_permissions;
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 소스 복사 — src/ 트리 통째로
fs.cpSync(SRC, path.join(OUT, 'src'), { recursive: true });
fs.readdirSync(path.join(ROOT, 'icons')).forEach((f) =>
  fs.copyFileSync(path.join(ROOT, 'icons', f), path.join(OUT, 'icons', f))
);

// _locales (chrome.i18n) — default_locale 사용 시 필수
const localesSrc = path.join(ROOT, '_locales');
if (!fs.existsSync(localesSrc)) throw new Error('빌드 중단 — _locales 디렉터리 없음 (default_locale 사용 중)');
fs.cpSync(localesSrc, path.join(OUT, '_locales'), { recursive: true });

// 빌드 후 검증 — 배포에 최소 권한만 남았는지 + 산출 파일 존재 확인.
if (manifest.permissions.includes('tabs') || 'host_permissions' in manifest) {
  throw new Error('빌드 중단 — 배포 manifest에 tabs/host_permissions가 남음');
}
const notCopied = KEY_FILES.filter((f) => !fs.existsSync(path.join(OUT, f)));
if (notCopied.length) throw new Error(`빌드 중단 — 복사 실패: ${notCopied.join(', ')}`);
if (!fs.existsSync(path.join(OUT, '_locales', manifest.default_locale, 'messages.json'))) {
  throw new Error(`빌드 중단 — default_locale(${manifest.default_locale}) messages.json 없음`);
}

// 스토어 업로드용 zip
const zipName = `azuki-v${manifest.version}.zip`;
execSync(`cd "${OUT}" && zip -qr "../${zipName}" .`);

console.log(`빌드 완료:`);
console.log(`  ${path.relative(ROOT, OUT)}/  (압축 해제 로드용)`);
console.log(`  dist/${zipName}  (스토어 업로드용)`);
console.log(`  permissions: ${JSON.stringify(manifest.permissions)}`);

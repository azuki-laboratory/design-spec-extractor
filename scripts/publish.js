// scripts/publish.js — 빌드 후 Chrome Web Store에 업로드·게시
//
// 사전 조건 (최초 1회, README "배포 자동화" 참고):
//   1. 스토어에 확장이 이미 1회 수동 업로드되어 EXTENSION_ID 존재
//   2. Google Cloud OAuth 자격 증명 발급 완료
//   3. .env.publish 파일에 4개 값 저장 (git에 올리지 말 것)
//
// 실행: npm run publish          (업로드 + 심사 제출)
//       npm run publish -- --upload-only   (업로드만, 게시는 대시보드에서)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.publish');

// .env.publish 로드
if (fs.existsSync(ENV_FILE)) {
  fs.readFileSync(ENV_FILE, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) process.env[m[1]] = m[2];
  });
}

const required = ['EXTENSION_ID', 'CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`누락된 환경 변수: ${missing.join(', ')}`);
  console.error(`${ENV_FILE} 파일에 아래 형식으로 저장하세요:\n`);
  required.forEach((k) => console.error(`${k}=...`));
  console.error('\n발급 방법은 README "배포 자동화" 섹션 참고.');
  process.exit(1);
}

// 빌드
execSync('node scripts/build.js', { cwd: ROOT, stdio: 'inherit' });
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;
const zip = path.join(ROOT, 'dist', `azuki-v${version}.zip`);

// 업로드 (+게시)
const uploadOnly = process.argv.includes('--upload-only');
const cmd = uploadOnly ? 'upload' : '';
console.log(`\n${uploadOnly ? '업로드만' : '업로드 + 게시(심사 제출)'} 진행: v${version}`);
execSync(`npx chrome-webstore-upload ${cmd} --source "${zip}"`, { cwd: ROOT, stdio: 'inherit' });
console.log('\n완료. 심사 상태는 개발자 대시보드에서 확인: https://chrome.google.com/webstore/devconsole');

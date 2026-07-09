// scripts/check.js — 전 소스 JS 문법 검사 (Playwright 실행 전 빠른 실패용)
// 실행: npm run lint

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
  'analyzer.js', 'generator.js', 'popup.js', 'background.js', 'i18n.js', 'options.js',
  'scripts/build.js', 'scripts/publish.js', 'scripts/icons.js', 'scripts/check.js',
  'test/e2e.js', 'test/release.js',
];

console.log('문법 검사:');
let fail = 0;
for (const f of FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error(`  ✗ 파일 없음: ${f}`); fail++; continue; }
  try {
    execSync(`node --check "${p}"`, { stdio: 'pipe' });
    console.log(`  ✓ ${f}`);
  } catch (e) {
    console.error(`  ✗ 문법 오류: ${f}\n${String(e.stderr || e.message)}`);
    fail++;
  }
}
console.log(fail ? `\n문법 실패 ${fail}건 ❌` : '\n문법 통과 ✅');
process.exit(fail ? 1 : 0);

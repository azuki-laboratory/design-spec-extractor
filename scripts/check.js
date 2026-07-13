// scripts/check.js — 전 소스 JS 문법 검사 (Playwright 실행 전 빠른 실패용)
// src/**/*.js = ESM(모듈), scripts·test = CommonJS. 각각 맞는 방식으로 --check.
// 실행: npm run lint

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// src/ 하위 .js 전부(ESM)
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}
const esmFiles = walk(path.join(ROOT, 'src')).map((p) => path.relative(ROOT, p));
const cjsFiles = ['scripts/build.js', 'scripts/check.js', 'scripts/publish.js', 'scripts/icons.js', 'test/e2e.js', 'test/release.js'];

console.log('문법 검사:');
let fail = 0;
const checkFile = (f, esm) => {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.error(`  ✗ 파일 없음: ${f}`); fail++; return; }
  try {
    if (esm) execSync('node --check --input-type=module -', { input: fs.readFileSync(p), stdio: ['pipe', 'pipe', 'pipe'] });
    else execSync(`node --check "${p}"`, { stdio: 'pipe' });
    console.log(`  ✓ ${f}`);
  } catch (e) {
    console.error(`  ✗ 문법 오류: ${f}\n${String(e.stderr || e.message)}`);
    fail++;
  }
};
esmFiles.forEach((f) => checkFile(f, true));
cjsFiles.forEach((f) => checkFile(f, false));

console.log(fail ? `\n문법 실패 ${fail}건 ❌` : '\n문법 통과 ✅');
process.exit(fail ? 1 : 0);

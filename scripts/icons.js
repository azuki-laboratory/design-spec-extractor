// scripts/icons.js — 마스코트 원본을 16/48/128 PNG 아이콘으로 변환
//
// 원본 우선순위:
//   1. icons/azuki-art.png  — 이미지 생성 AI로 만든 고해상 원화 (정사각 권장, 512px+)
//   2. icons/azuki.svg      — 벡터 폴백
// 실행: npm run icons
//
// azuki-art.png 워크플로: ChatGPT/Gemini/Midjourney에서 생성 → icons/azuki-art.png 저장
// → npm run icons → chrome://extensions 리로드. 프롬프트 예시는 README 참고.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const ICONS = path.resolve(__dirname, '..', 'icons');
const ART = path.join(ICONS, 'azuki-art.png');

// 고해상 원화가 있으면 sips(macOS 내장)로 리사이즈 — Playwright 불필요
if (fs.existsSync(ART)) {
  for (const size of [16, 48, 128]) {
    execSync(`sips -Z ${size} "${ART}" --out "${path.join(ICONS, `icon${size}.png`)}" >/dev/null`);
    console.log(`icon${size}.png 생성 (azuki-art.png 원본)`);
  }
  process.exit(0);
}

const svg = fs.readFileSync(path.join(ICONS, 'azuki.svg'), 'utf8');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [16, 48, 128]) {
    // 16px에서는 테두리 프레임이 공간만 차지 — 소형 사이즈는 프레임 제거
    const src = size <= 16 ? svg.replace(/<rect[^>]*stroke[^>]*\/>\s*<\/svg>/, '</svg>') : svg;
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>*{margin:0}body{background:transparent}svg{display:block}</style>` +
      src.replace('<svg ', `<svg width="${size}" height="${size}" `)
    );
    await page.screenshot({ path: path.join(ICONS, `icon${size}.png`), omitBackground: true });
    console.log(`icon${size}.png 생성`);
  }
  await browser.close();
})();

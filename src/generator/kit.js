// generator/kit.js — 페이지 키트: 추출 토큰·컴포넌트로 스타터 페이지 묶음(zip) 생성 (ESM)
// index(랜딩)·dashboard·components(갤러리) + tokens.css/kit.css + README.
// 모든 페이지가 var(--color-*) 토큰을 참조 → tokens.css만 고치면 키트 전체에 반영된다.
import { state, T, htmlEsc, cssSafe, buildColorTokens, buildSpacingTokens, buildRadiusTokens, buildTypeTokens, rgbStrToHex, contrast, luminance } from './core.js';
import { exportTokens } from './exporters.js';

/* ---------- 색상 → 토큰 var() 참조 ---------- */
// 추출 색이 토큰과 일치하면 var(--color-name), 아니면 리터럴(살균) 사용.
function makeColorVar(tokens) {
  const byHex = new Map(tokens.map((t) => [t.hex.toLowerCase(), t.name]));
  return (colorStr, fallback) => {
    const hex = rgbStrToHex(colorStr);
    if (!hex) return fallback || 'transparent';
    const name = byHex.get(hex.toLowerCase());
    return name ? `var(--color-${name})` : cssSafe(hex);
  };
}

const tokenHex = (tokens, name, fb) => (tokens.find((t) => t.name === name) || {}).hex || fb;

/* ---------- kit.css: 추출 컴포넌트 → 재사용 클래스 ---------- */
function buildKitCss(data, tokens) {
  const cv = makeColorVar(tokens);
  const body = data.typography.body || {};
  const h = data.typography.headings || {};
  const btns = data.components.buttons || [];
  const b0 = btns[0]?.style, b1 = btns[1]?.style;
  const card = data.components.card;
  const input = data.components.input;
  const badge = data.components.badge;
  const nav = data.components.nav;
  const canvas = tokenHex(tokens, 'canvas', '#ffffff');
  const ink = tokenHex(tokens, 'ink', '#111111');
  const primary = tokenHex(tokens, 'primary', tokenHex(tokens, 'link', '#3b82f6'));
  const onPrimary = tokenHex(tokens, 'on-primary', contrast('#ffffff', primary) >= contrast('#111111', primary) ? '#ffffff' : '#111111');
  const spacing = buildSpacingTokens(data);
  const sp = (i, fb) => (spacing[i] ? `var(--spacing-${spacing[i].name})` : fb);
  const containerW = (data.layout.containerWidths || [])[0]?.px || 1080;
  const shadow = (data.depth.shadows || [])[0]?.shadow;
  const font = cssSafe(body.family || 'sans-serif');
  const headingFont = cssSafe(h.h1?.family || h.h2?.family || body.family || 'sans-serif');

  const c = [];
  c.push(T('/* kit.css — component layer built from the extracted design. Colors reference tokens.css */',
           '/* kit.css — 추출된 디자인으로 만든 컴포넌트 레이어. 색상은 tokens.css 토큰을 참조 */'));
  c.push('* { box-sizing: border-box; margin: 0; padding: 0; }');
  c.push(`body { font-family: "${font}", -apple-system, sans-serif; font-size: var(--font-size-base, ${cssSafe(body.size || 16)}px); line-height: ${cssSafe(body.lineHeight === 'normal' ? '1.5' : body.lineHeight || '1.5')}; color: var(--color-ink, ${cssSafe(ink)}); background: var(--color-canvas, ${cssSafe(canvas)}); }`);
  // 제목 위계 (추출 스케일)
  const hs = (tag, fbSize, fbW) => {
    const s = h[tag];
    return `${tag} { font-family: "${headingFont}", sans-serif; font-size: ${cssSafe(s?.size || fbSize)}px; font-weight: ${cssSafe(s?.weight || fbW)}; line-height: ${cssSafe(s?.lineHeight === 'normal' ? '1.2' : s?.lineHeight || '1.2')}; }`;
  };
  c.push(hs('h1', 40, 700));
  c.push(hs('h2', 28, 700));
  c.push(hs('h3', 20, 600));
  c.push(`a { color: var(--color-link, var(--color-primary, ${cssSafe(primary)})); text-decoration: ${data.components.linkUnderline === 'underline' ? 'underline' : 'none'}; }`);
  c.push(`.container { max-width: ${Math.round(containerW)}px; margin: 0 auto; padding: 0 ${sp(2, '16px')}; }`);
  c.push(`.stack { display: grid; gap: ${sp(3, '24px')}; }`);
  c.push(`.row { display: flex; gap: ${sp(2, '16px')}; flex-wrap: wrap; align-items: center; }`);
  c.push(`.grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: ${sp(3, '24px')}; }`);
  c.push(`.section { padding: ${sp(5, '64px')} 0; }`);
  c.push(`.muted { color: var(--color-ink-mute, ${cssSafe(tokenHex(tokens, 'ink-mute', '#666'))}); }`);

  // 버튼 (추출 스타일 그대로, 색만 토큰 참조)
  const btnBase = 'display: inline-flex; align-items: center; justify-content: center; cursor: pointer; text-decoration: none;';
  if (b0) {
    c.push(`.btn-primary { ${btnBase} background: ${cv(b0.background, `var(--color-primary, ${cssSafe(primary)})`)}; color: ${cv(b0.color, cssSafe(onPrimary))}; border: ${b0.border === 'none' ? 'none' : cssSafe(b0.border)}; border-radius: ${cssSafe(b0.borderRadius)}; padding: ${cssSafe(b0.padding)}; font-size: ${cssSafe(b0.fontSize)}; font-weight: ${cssSafe(b0.fontWeight)};${b0.boxShadow !== 'none' ? ` box-shadow: ${cssSafe(b0.boxShadow)};` : ''} }`);
    c.push('.btn-primary:hover { filter: brightness(0.92); }');
  } else {
    c.push(`.btn-primary { ${btnBase} background: var(--color-primary, ${cssSafe(primary)}); color: ${cssSafe(onPrimary)}; border: none; border-radius: var(--radius-sm, 6px); padding: 10px 20px; font-weight: 600; }`);
  }
  if (b1) {
    c.push(`.btn-secondary { ${btnBase} background: ${cv(b1.background, 'transparent')}; color: ${cv(b1.color, `var(--color-ink, ${cssSafe(ink)})`)}; border: ${b1.border === 'none' ? `1px solid var(--color-hairline, ${cssSafe(tokenHex(tokens, 'hairline', '#ddd'))})` : cssSafe(b1.border)}; border-radius: ${cssSafe(b1.borderRadius)}; padding: ${cssSafe(b1.padding)}; font-size: ${cssSafe(b1.fontSize)}; font-weight: ${cssSafe(b1.fontWeight)}; }`);
  } else {
    c.push(`.btn-secondary { ${btnBase} background: transparent; color: var(--color-ink, ${cssSafe(ink)}); border: 1px solid var(--color-hairline, #ddd); border-radius: var(--radius-sm, 6px); padding: 10px 20px; font-weight: 500; }`);
  }
  c.push('.btn-secondary:hover { filter: brightness(0.96); }');

  // 카드
  if (card) {
    c.push(`.card { background: ${cv(card.background, `var(--color-canvas, ${cssSafe(canvas)})`)}; border: ${card.border === 'none' ? 'none' : cssSafe(card.border)}; border-radius: ${cssSafe(card.borderRadius)}; padding: ${cssSafe(card.padding)};${card.boxShadow !== 'none' ? ` box-shadow: ${cssSafe(card.boxShadow)};` : ''} }`);
  } else {
    c.push(`.card { background: var(--color-canvas-soft, var(--color-canvas)); border: 1px solid var(--color-hairline, #e5e5e5); border-radius: var(--radius-md, 10px); padding: ${sp(3, '24px')};${shadow ? ` box-shadow: ${cssSafe(shadow)};` : ''} }`);
  }

  // 입력
  if (input) {
    c.push(`.input { width: 100%; background: ${cv(input.background, '#fff')}; color: ${cv(input.color, `var(--color-ink, ${cssSafe(ink)})`)}; border: ${input.border === 'none' ? '1px solid var(--color-hairline, #ddd)' : cssSafe(input.border)}; border-radius: ${cssSafe(input.borderRadius)}; padding: ${cssSafe(input.padding)}; font-size: ${cssSafe(input.fontSize)}; font-family: inherit; }`);
  } else {
    c.push('.input { width: 100%; background: #fff; border: 1px solid var(--color-hairline, #ddd); border-radius: var(--radius-sm, 6px); padding: 10px 12px; font-family: inherit; }');
  }
  c.push(`.input:focus { outline: 2px solid var(--color-primary, ${cssSafe(primary)}); outline-offset: 1px; }`);

  // 배지 (width: fit-content — grid/stack 안에서 풀폭으로 늘어나지 않게)
  if (badge) {
    c.push(`.badge { display: inline-block; width: fit-content; background: ${cv(badge.background, `var(--color-primary, ${cssSafe(primary)})`)}; color: ${cv(badge.color, cssSafe(onPrimary))}; border-radius: ${cssSafe(badge.borderRadius)}; padding: ${cssSafe(badge.padding)}; font-size: ${cssSafe(badge.fontSize)}; font-weight: 600; }`);
  } else {
    c.push(`.badge { display: inline-block; width: fit-content; background: var(--color-primary, ${cssSafe(primary)}); color: ${cssSafe(onPrimary)}; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 600; }`);
  }

  // 내비게이션
  const navBg = nav ? cv(nav.background, `var(--color-canvas, ${cssSafe(canvas)})`) : `var(--color-canvas, ${cssSafe(canvas)})`;
  c.push(`.nav { position: ${cssSafe(nav?.position === 'fixed' || nav?.position === 'sticky' ? 'sticky' : 'static')}; top: 0; z-index: 50; background: ${navBg}; border-bottom: 1px solid var(--color-hairline, #eee); }`);
  c.push(`.nav-inner { display: flex; align-items: center; justify-content: space-between; gap: ${sp(2, '16px')}; min-height: ${cssSafe(Math.min(Math.max(nav?.height || 64, 48), 96))}px; }`);
  c.push('.nav-links { display: flex; gap: 20px; list-style: none; align-items: center; }');
  c.push('.brand { font-weight: 700; font-size: 18px; color: inherit; text-decoration: none; }');

  // 테이블
  const tbl = data.components.table;
  c.push(`table { width: 100%; border-collapse: ${cssSafe(tbl?.borderCollapse || 'collapse')}; }`);
  c.push(`th, td { text-align: left; padding: ${cssSafe(tbl?.cellPadding || '8px 12px')}; border-bottom: ${tbl?.cellBorder && tbl.cellBorder !== 'none' ? cssSafe(tbl.cellBorder) : '1px solid var(--color-hairline, #eee)'}; }`);
  c.push('th { font-weight: 600; }');

  // 대시보드 레이아웃
  c.push('.dash { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }');
  c.push(`.sidebar { border-right: 1px solid var(--color-hairline, #eee); padding: ${sp(3, '24px')} ${sp(2, '16px')}; }`);
  c.push('.sidebar a { display: block; padding: 8px 12px; border-radius: var(--radius-xs, 6px); color: inherit; text-decoration: none; }');
  c.push('.sidebar a + a { margin-top: 4px; }');
  c.push(`.sidebar a.active { background: var(--color-primary, ${cssSafe(primary)}); color: ${cssSafe(onPrimary)}; }`);
  c.push(`.main { padding: ${sp(4, '32px')}; }`);
  c.push('.stat { display: grid; gap: 4px; }');
  c.push('.stat .num { font-size: 28px; font-weight: 700; }');
  c.push('footer.site { border-top: 1px solid var(--color-hairline, #eee); }');
  c.push('@media (max-width: 720px) { .dash { grid-template-columns: 1fr; } .sidebar { border-right: none; border-bottom: 1px solid var(--color-hairline, #eee); } }');
  return c.join('\n');
}

/* ---------- HTML 골격 ---------- */
function page(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="${state.LANG}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEsc(title)}</title>
<link rel="stylesheet" href="styles/tokens.css">
<link rel="stylesheet" href="styles/kit.css">
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

function navHtml(brand, active) {
  const link = (href, label, key) =>
    `<li><a href="${href}"${active === key ? ' style="font-weight:700"' : ''}>${label}</a></li>`;
  return `<nav class="nav"><div class="container nav-inner">
  <a class="brand" href="index.html">${htmlEsc(brand)}</a>
  <ul class="nav-links">
    ${link('index.html', T('Home', '홈'), 'home')}
    ${link('dashboard.html', T('Dashboard', '대시보드'), 'dash')}
    ${link('components.html', T('Components', '컴포넌트'), 'comp')}
    <li><a class="btn-primary" href="#">${T('Get started', '시작하기')}</a></li>
  </ul>
</div></nav>`;
}

function footerHtml(brand) {
  return `<footer class="site section"><div class="container row" style="justify-content:space-between">
  <span class="muted">© ${htmlEsc(brand)}</span>
  <span class="muted">${T('Built with the Azuki page kit', 'Azuki 페이지 키트로 제작')}</span>
</div></footer>`;
}

function landingHtml(data, brand) {
  const feats = [
    [T('Fast', '빠르게'), T('Describe the first key benefit of your product here.', '제품의 첫 번째 핵심 가치를 여기에 적으세요.')],
    [T('Consistent', '일관되게'), T('This kit reuses the exact tokens extracted from your reference design.', '이 키트는 참조 디자인에서 추출한 토큰을 그대로 사용합니다.')],
    [T('Yours', '당신답게'), T('Edit styles/tokens.css once — every page follows.', 'styles/tokens.css 한 곳만 고치면 모든 페이지에 반영됩니다.')],
  ].map(([h3, p]) => `<div class="card stack" style="gap:8px"><span class="badge">${T('Feature', '기능')}</span><h3>${h3}</h3><p class="muted">${p}</p></div>`).join('\n    ');
  return `${navHtml(brand, 'home')}
<header class="section"><div class="container stack" style="max-width:720px;text-align:center">
  <h1>${T('Your headline, in your design', '당신의 디자인으로, 당신의 헤드라인')}</h1>
  <p class="muted">${T('This starter page is styled with the palette, type scale and components extracted from the analyzed site. Replace this copy and ship.', '분석한 사이트에서 추출한 팔레트·타입 스케일·컴포넌트로 스타일된 스타터 페이지입니다. 문구만 바꿔서 배포하세요.')}</p>
  <div class="row" style="justify-content:center">
    <a class="btn-primary" href="#">${T('Primary action', '주요 액션')}</a>
    <a class="btn-secondary" href="#">${T('Secondary', '보조 액션')}</a>
  </div>
</div></header>
<section class="section"><div class="container grid-3">
    ${feats}
</div></section>
<section class="section"><div class="container card row" style="justify-content:space-between">
  <div><h2>${T('Ready to start?', '시작할 준비 되셨나요?')}</h2><p class="muted">${T('One primary action per band — as your design intends.', '밴드당 주요 액션 하나 — 원본 디자인의 의도대로.')}</p></div>
  <a class="btn-primary" href="#">${T('Get started', '시작하기')}</a>
</div></section>
${footerHtml(brand)}`;
}

function dashboardHtml(data, brand) {
  const rows = [
    [T('Design tokens', '디자인 토큰'), T('Synced', '동기화됨'), '128'],
    [T('Pages analyzed', '분석한 페이지'), T('Done', '완료'), '3'],
    [T('Components', '컴포넌트'), T('Stable', '안정'), '24'],
  ].map(([a, b, n]) => `<tr><td>${a}</td><td><span class="badge">${b}</span></td><td>${n}</td></tr>`).join('\n      ');
  return `${navHtml(brand, 'dash')}
<div class="dash">
  <aside class="sidebar">
    <a class="active" href="#">${T('Overview', '개요')}</a>
    <a href="#">${T('Reports', '리포트')}</a>
    <a href="#">${T('Settings', '설정')}</a>
  </aside>
  <main class="main stack">
    <h2>${T('Overview', '개요')}</h2>
    <div class="grid-3">
      <div class="card stat"><span class="muted">${T('Visitors', '방문자')}</span><span class="num">12,480</span></div>
      <div class="card stat"><span class="muted">${T('Conversion', '전환율')}</span><span class="num">4.2%</span></div>
      <div class="card stat"><span class="muted">${T('Revenue', '수익')}</span><span class="num">$8,210</span></div>
    </div>
    <div class="card stack">
      <div class="row" style="justify-content:space-between"><h3>${T('Recent items', '최근 항목')}</h3><button class="btn-secondary" type="button">${T('Export', '내보내기')}</button></div>
      <table><thead><tr><th>${T('Name', '이름')}</th><th>${T('Status', '상태')}</th><th>${T('Count', '수')}</th></tr></thead><tbody>
      ${rows}
      </tbody></table>
    </div>
    <div class="card stack" style="max-width:480px">
      <h3>${T('Quick form', '빠른 입력')}</h3>
      <input class="input" type="text" placeholder="${T('Type here…', '입력하세요…')}">
      <div class="row"><button class="btn-primary" type="button">${T('Save', '저장')}</button><button class="btn-secondary" type="button">${T('Cancel', '취소')}</button></div>
    </div>
  </main>
</div>`;
}

function componentsHtml(data, tokens, brand) {
  const swatches = tokens.map((t) =>
    `<div class="card" style="padding:12px"><div style="height:56px;border-radius:6px;background:var(--color-${cssSafe(t.name)});border:1px solid var(--color-hairline,#eee)"></div><p style="margin-top:8px"><b>${htmlEsc(t.name)}</b><br><span class="muted">${htmlEsc(t.hex)}</span></p></div>`
  ).join('\n    ');
  const radii = buildRadiusTokens(data).map((r) =>
    `<div class="card" style="text-align:center;padding:12px"><div style="width:56px;height:56px;margin:0 auto;background:var(--color-primary);border-radius:var(--radius-${cssSafe(r.name)})"></div><p class="muted" style="margin-top:6px">${htmlEsc(r.name)} · ${r.name === 'pill' ? '9999' : r.px}px</p></div>`
  ).join('\n    ');
  const type = buildTypeTokens(data).map((r) =>
    `<p style="font-size:${cssSafe(r.size)}px;font-weight:${cssSafe(r.weight)}">${htmlEsc(r.token)} — ${cssSafe(r.size)}px</p>`
  ).join('\n    ');
  return `${navHtml(brand, 'comp')}
<main class="section"><div class="container stack" style="gap:40px">
  <div><h1>${T('Component gallery', '컴포넌트 갤러리')}</h1><p class="muted">${T('Everything below is rendered with the extracted tokens.', '아래 모든 요소는 추출된 토큰으로 렌더링됩니다.')}</p></div>
  <section class="stack"><h2>${T('Colors', '컬러')}</h2><div class="grid-3">
    ${swatches}
  </div></section>
  <section class="stack"><h2>${T('Typography', '타이포그래피')}</h2><div class="card stack">
    ${type}
  </div></section>
  <section class="stack"><h2>${T('Buttons & badges', '버튼 & 배지')}</h2><div class="card row">
    <button class="btn-primary" type="button">${T('Primary', '주요')}</button>
    <button class="btn-secondary" type="button">${T('Secondary', '보조')}</button>
    <span class="badge">${T('Badge', '배지')}</span>
  </div></section>
  <section class="stack"><h2>${T('Form', '폼')}</h2><div class="card stack" style="max-width:420px">
    <input class="input" type="text" placeholder="${T('Input field', '입력 필드')}">
    <input class="input" type="email" placeholder="you@example.com">
  </div></section>
  <section class="stack"><h2>${T('Radius scale', '반경 스케일')}</h2><div class="row">
    ${radii}
  </div></section>
</div></main>
${footerHtml(brand)}`;
}

function readmeMd(data) {
  const host = (() => { try { return new URL(data.meta.url).host; } catch (e) { return data.meta.url; } })();
  return T(`# Azuki Page Kit

A starter page kit generated from the design analysis of **${host}**.

## What's inside

| File | Purpose |
|------|---------|
| \`index.html\` | Landing page (nav, hero, features, CTA, footer) |
| \`dashboard.html\` | App dashboard (sidebar, stat cards, table, form) |
| \`components.html\` | Live gallery of every extracted token & component |
| \`styles/tokens.css\` | **Design tokens — edit this file first** |
| \`styles/kit.css\` | Component classes built on the tokens |

## How to use

1. Unzip and open \`index.html\` in a browser — no build step needed.
2. Adjust colors/spacing in \`styles/tokens.css\`; every page follows.
3. Replace the placeholder copy, ship, or paste the files into your project.
4. Working with an AI coding agent? Give it \`DESIGN.md\` (exported separately) and these files as the style reference.

Generated by Azuki (Design Spec Extractor) · ${data.meta.analyzedAt}
`, `# Azuki 페이지 키트

**${host}** 디자인 분석으로 생성된 스타터 페이지 키트입니다.

## 구성

| 파일 | 용도 |
|------|------|
| \`index.html\` | 랜딩 페이지 (내비·히어로·기능·CTA·푸터) |
| \`dashboard.html\` | 앱 대시보드 (사이드바·스탯 카드·테이블·폼) |
| \`components.html\` | 추출된 토큰·컴포넌트 전체 갤러리 |
| \`styles/tokens.css\` | **디자인 토큰 — 가장 먼저 수정할 파일** |
| \`styles/kit.css\` | 토큰 위에 만든 컴포넌트 클래스 |

## 사용법

1. 압축 해제 후 \`index.html\`을 브라우저로 열기 — 빌드 불필요.
2. \`styles/tokens.css\`에서 색·여백만 고치면 모든 페이지에 반영.
3. 플레이스홀더 문구를 바꿔 그대로 배포하거나 프로젝트에 복사.
4. AI 코딩 에이전트와 쓸 때는 (별도 내보내는) \`DESIGN.md\`와 이 파일들을 스타일 기준으로 전달.

Azuki (Design Spec Extractor) 생성 · ${data.meta.analyzedAt}
`);
}

/* ---------- 공개 API ---------- */
// 파일 목록 생성. [{ name, content }]
export function exportKit(data, lang) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const brand = (data.meta.title || 'My Site').split(/[—|·:-]/)[0].trim().slice(0, 40) || 'My Site';
  const tokensCss = exportTokens(data, lang).css;
  return [
    { name: 'index.html', content: page(brand, landingHtml(data, brand)) },
    { name: 'dashboard.html', content: page(`${brand} — ${T('Dashboard', '대시보드')}`, dashboardHtml(data, brand)) },
    { name: 'components.html', content: page(`${brand} — ${T('Components', '컴포넌트')}`, componentsHtml(data, tokens, brand)) },
    { name: 'styles/tokens.css', content: tokensCss },
    { name: 'styles/kit.css', content: buildKitCss(data, tokens) },
    { name: 'README.md', content: readmeMd(data) },
  ];
}

/* ---------- ZIP (무압축 STORE) ----------
   외부 라이브러리 없이 zip 포맷 직접 생성. 텍스트 몇 KB라 압축 불필요. */
function crc32(bytes) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let cc = n;
      for (let k = 0; k < 8; k++) cc = cc & 1 ? 0xedb88320 ^ (cc >>> 1) : cc >>> 1;
      table[n] = cc >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildKitZip(files, when) {
  const enc = new TextEncoder();
  const d = when instanceof Date && !isNaN(when) ? when : new Date();
  const dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const f of files) {
    const name = enc.encode(f.name);
    const body = enc.encode(f.content);
    const crc = crc32(body);
    // local file header (method 0 = store, UTF-8 플래그)
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(body.length), ...u32(body.length),
      ...u16(name.length), ...u16(0),
    ]);
    chunks.push(local, name, body);
    central.push({ name, crc, size: body.length, offset });
    offset += local.length + name.length + body.length;
  }
  const cdStart = offset;
  for (const e of central) {
    const rec = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(dosTime), ...u16(dosDate), ...u32(e.crc), ...u32(e.size), ...u32(e.size),
      ...u16(e.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(e.offset),
    ]);
    chunks.push(rec, e.name);
    offset += rec.length + e.name.length;
  }
  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length),
    ...u32(offset - cdStart), ...u32(cdStart), ...u16(0),
  ]);
  chunks.push(eocd);
  const total = chunks.reduce((s, cc) => s + cc.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const cc of chunks) { out.set(cc, p); p += cc.length; }
  return out;
}

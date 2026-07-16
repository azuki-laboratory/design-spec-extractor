// generator/kit.js — 페이지 키트: 추출 토큰·컴포넌트로 스타터 페이지 묶음(zip) 생성 (ESM)
// index(랜딩)·dashboard·components(갤러리)·pricing + tokens.css/kit.css + README.
// 모든 페이지가 var(--color-*) 토큰을 참조 → tokens.css만 고치면 키트 전체에 반영된다.
// kitOpts(사용자 맞춤)와 buildCustomKitPage(AI 구조 JSON 렌더)도 여기서 처리 —
// LLM은 구조만 만들고 HTML 렌더는 항상 이 모듈(전 값 이스케이프)이 담당한다.
import { state, T, htmlEsc, cssSafe, buildColorTokens, buildSpacingTokens, buildRadiusTokens, buildTypeTokens, rgbStrToHex, contrast } from './core.js';
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
  // 프라이싱
  c.push(`.plan { display: grid; gap: 12px; align-content: start; }`);
  c.push(`.plan .price { font-size: 34px; font-weight: 700; }`);
  c.push(`.plan.featured { outline: 2px solid var(--color-primary, ${cssSafe(primary)}); }`);
  c.push('.plan ul { list-style: none; display: grid; gap: 6px; }');
  c.push(`.plan ul li::before { content: "✓ "; color: var(--color-primary, ${cssSafe(primary)}); font-weight: 700; }`);
  // FAQ
  c.push('details { border-bottom: 1px solid var(--color-hairline, #eee); padding: 12px 0; }');
  c.push('details summary { cursor: pointer; font-weight: 600; }');
  c.push('details p { margin-top: 8px; }');
  c.push('footer.site { border-top: 1px solid var(--color-hairline, #eee); }');
  // 인증 (소셜 로그인 버튼)
  c.push(`.auth-card { max-width: 400px; margin: 0 auto; }`);
  c.push(`.social-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px; border: 1px solid var(--color-hairline, #ddd); border-radius: var(--radius-sm, 6px); background: #fff; color: var(--color-ink, ${cssSafe(ink)}); cursor: pointer; font-weight: 500; text-decoration: none; }`);
  c.push('.social-btn:hover { filter: brightness(0.96); }');
  c.push(`.divider { display: flex; align-items: center; gap: 10px; color: var(--color-ink-mute, #888); font-size: 12px; } .divider::before, .divider::after { content: ""; flex: 1; border-top: 1px solid var(--color-hairline, #eee); }`);
  // 알림 (토스트·배너)
  c.push(`.toast { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: var(--radius-sm, 8px); background: var(--color-ink, ${cssSafe(ink)}); color: var(--color-canvas, #fff); font-size: 14px;${shadow ? ` box-shadow: ${cssSafe(shadow)};` : ''} }`);
  c.push(`.banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-radius: var(--radius-sm, 8px); background: var(--color-canvas-soft, #f5f5f5); border: 1px solid var(--color-hairline, #eee); font-size: 14px; }`);
  // 파일 업로드
  c.push(`.upload { display: grid; gap: 6px; justify-items: center; padding: 28px; border: 2px dashed var(--color-hairline, #ccc); border-radius: var(--radius-md, 10px); text-align: center; color: var(--color-ink-mute, #888); cursor: pointer; }`);
  c.push(`.upload:hover { border-color: var(--color-primary, ${cssSafe(primary)}); }`);
  // 지식 검색
  c.push('.search { position: relative; max-width: 420px; width: 100%; }');
  c.push('.search .input { padding-left: 34px; }');
  c.push(`.search::before { content: "🔍"; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; }`);
  // AI 챗봇 위젯 (CSS 전용 — 체크박스 토글, 스크립트 0)
  c.push('.chat-toggle { display: none; }');
  c.push(`.chat-fab { position: fixed; right: 20px; bottom: 20px; z-index: 90; width: 54px; height: 54px; border-radius: 50%; background: var(--color-primary, ${cssSafe(primary)}); color: ${cssSafe(onPrimary)}; display: flex; align-items: center; justify-content: center; font-size: 22px; cursor: pointer;${shadow ? ` box-shadow: ${cssSafe(shadow)};` : ''} }`);
  c.push(`.chat-panel { position: fixed; right: 20px; bottom: 84px; z-index: 90; width: 300px; display: none; flex-direction: column; gap: 10px; padding: 14px; background: var(--color-canvas, #fff); border: 1px solid var(--color-hairline, #ddd); border-radius: var(--radius-md, 12px);${shadow ? ` box-shadow: ${cssSafe(shadow)};` : ''} }`);
  c.push('.chat-toggle:checked ~ .chat-panel { display: flex; }');
  c.push(`.chat-msg { padding: 8px 12px; border-radius: var(--radius-sm, 8px); background: var(--color-canvas-soft, #f5f5f5); font-size: 13px; }`);
  // 블로그·문서
  c.push('.post { display: grid; gap: 6px; }');
  c.push('.post .meta { font-size: 12px; }');
  c.push('.docs { display: grid; grid-template-columns: 220px 1fr; gap: 32px; align-items: start; }');
  c.push('.docs nav.toc { position: sticky; top: 90px; display: grid; gap: 4px; font-size: 14px; }');
  c.push('.docs nav.toc a { color: inherit; padding: 4px 8px; border-radius: 4px; }');
  c.push(`.docs nav.toc a.active { background: var(--color-canvas-soft, #f5f5f5); font-weight: 600; }`);
  c.push('@media (max-width: 720px) { .dash { grid-template-columns: 1fr; } .sidebar { border-right: none; border-bottom: 1px solid var(--color-hairline, #eee); } .docs { grid-template-columns: 1fr; } .docs nav.toc { position: static; } }');
  return c.join('\n');
}

/* ---------- HTML 골격 (SEO 메타 + OG 태그) ---------- */
function page(title, bodyHtml, desc) {
  const d = htmlEsc((desc || title || '').slice(0, 160));
  return `<!DOCTYPE html>
<html lang="${state.LANG}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEsc(title)}</title>
<meta name="description" content="${d}">
<meta property="og:title" content="${htmlEsc(title)}">
<meta property="og:description" content="${d}">
<meta property="og:type" content="website">
<!-- TODO: og:image, canonical URL 배포 시 설정 -->
<link rel="stylesheet" href="styles/tokens.css">
<link rel="stylesheet" href="styles/kit.css">
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

const PAGE_META = {
  landing: { file: 'index.html' },
  auth: { file: 'auth.html' },
  dashboard: { file: 'dashboard.html' },
  pricing: { file: 'pricing.html' },
  blog: { file: 'blog.html' },
  docs: { file: 'docs.html' },
  legal: { file: 'legal.html' },
  contact: { file: 'contact.html' },
  components: { file: 'components.html' },
};
const pageLabel = (p) => ({
  landing: T('Home', '홈'), auth: T('Sign in', '로그인'), dashboard: T('Dashboard', '대시보드'),
  pricing: T('Pricing', '가격'), blog: T('Blog', '블로그'), docs: T('Docs', '문서'),
  legal: T('Legal', '법률'), contact: T('Contact', '문의'), components: T('Components', '컴포넌트'),
}[p]);

function navHtml(brand, pages, active) {
  // 상단 내비: 마케팅 링크만. 로그인·시작하기는 우측 액션.
  const navPages = ['landing', 'pricing', 'blog', 'docs', 'contact', 'components', 'dashboard'].filter((p) => pages.includes(p));
  const links = navPages.map((p) =>
    `<li><a href="${PAGE_META[p].file}"${active === p ? ' style="font-weight:700"' : ''}>${pageLabel(p)}</a></li>`).join('\n    ');
  const authLink = pages.includes('auth') ? `<li><a class="btn-secondary" href="auth.html">${T('Sign in', '로그인')}</a></li>` : '';
  return `<nav class="nav"><div class="container nav-inner">
  <a class="brand" href="${pages.includes('landing') ? 'index.html' : '#'}">${htmlEsc(brand)}</a>
  <ul class="nav-links">
    ${links}
    ${authLink}
    <li><a class="btn-primary" href="#">${T('Get started', '시작하기')}</a></li>
  </ul>
</div></nav>`;
}

/* AI 챗봇 위젯 (CSS 전용) — 랜딩·문서 페이지에 삽입 */
function chatWidgetHtml() {
  return `<!-- AI 챗봇 위젯: UI 스캐폴드. 실제 응답은 README의 '챗봇 연결' 참고 -->
<input type="checkbox" id="chat-open" class="chat-toggle">
<div class="chat-panel">
  <b>${T('Assistant', '어시스턴트')}</b>
  <div class="chat-msg">${T('Hi! Ask me anything about this product.', '안녕하세요! 무엇이든 물어보세요.')}</div>
  <input class="input" type="text" placeholder="${T('Type a message…', '메시지를 입력하세요…')}">
</div>
<label class="chat-fab" for="chat-open" title="${T('Chat', '채팅')}">💬</label>`;
}

function footerHtml(brand, pages) {
  const legalLink = pages && pages.includes('legal') ? `<a href="legal.html">${T('Privacy · Terms', '개인정보 · 약관')}</a>` : '';
  return `<footer class="site section"><div class="container stack">
  <!-- 뉴스레터 구독: form action을 이메일 서비스(예: Buttondown/Mailchimp) 엔드포인트로 교체 -->
  <form class="row" action="#" method="post" style="justify-content:center">
    <input class="input" type="email" name="email" placeholder="${T('Email for updates', '소식 받을 이메일')}" style="max-width:320px;width:100%">
    <button class="btn-secondary" type="submit">${T('Subscribe', '구독하기')}</button>
  </form>
  <div class="row" style="justify-content:space-between">
    <span class="muted">© ${htmlEsc(brand)}</span>
    ${legalLink}
    <span class="muted">${T('Built with the Azuki page kit', 'Azuki 페이지 키트로 제작')}</span>
  </div>
</div></footer>`;
}

/* ---------- 섹션 렌더러 (템플릿·AI 커스텀 공용) ----------
   모든 텍스트는 htmlEsc + 길이 상한. AI가 어떤 구조를 주든 여기서만 HTML이 된다. */
const esc = (s, n) => htmlEsc(String(s == null ? '' : s).slice(0, n));

const SECTION_RENDERERS = {
  hero(s) {
    return `<header class="section"><div class="container stack" style="max-width:720px;text-align:center">
  <h1>${esc(s.title, 90)}</h1>
  ${s.body ? `<p class="muted">${esc(s.body, 260)}</p>` : ''}
  <div class="row" style="justify-content:center">
    <a class="btn-primary" href="#">${esc(s.cta || T('Get started', '시작하기'), 30)}</a>
    ${s.cta2 ? `<a class="btn-secondary" href="#">${esc(s.cta2, 30)}</a>` : ''}
  </div>
</div></header>`;
  },
  features(s) {
    const cards = (s.items || []).slice(0, 6).map((it) =>
      `<div class="card stack" style="gap:8px">${it.badge ? `<span class="badge">${esc(it.badge, 16)}</span>` : ''}<h3>${esc(it.title, 50)}</h3><p class="muted">${esc(it.body, 200)}</p></div>`).join('\n    ');
    return `<section class="section"><div class="container stack">
  ${s.title ? `<h2>${esc(s.title, 60)}</h2>` : ''}
  <div class="grid-3">
    ${cards}
  </div>
</div></section>`;
  },
  stats(s) {
    const cells = (s.items || []).slice(0, 4).map((it) =>
      `<div class="card stat"><span class="muted">${esc(it.title, 30)}</span><span class="num">${esc(it.value, 16)}</span></div>`).join('\n    ');
    return `<section class="section"><div class="container grid-3">
    ${cells}
</div></section>`;
  },
  faq(s) {
    const rows = (s.items || []).slice(0, 8).map((it) =>
      `<details><summary>${esc(it.title, 90)}</summary><p class="muted">${esc(it.body, 300)}</p></details>`).join('\n    ');
    return `<section class="section"><div class="container stack" style="max-width:720px">
  <h2>${esc(s.title || 'FAQ', 60)}</h2>
  <div>
    ${rows}
  </div>
</div></section>`;
  },
  pricing(s) {
    const plans = (s.items || []).slice(0, 4).map((it, i) => {
      const feats = (it.features || []).slice(0, 6).map((f) => `<li>${esc(f, 60)}</li>`).join('');
      return `<div class="card plan${it.featured || i === 1 ? ' featured' : ''}">
      <h3>${esc(it.title, 30)}</h3>
      <div class="price">${esc(it.price, 20)}</div>
      ${it.body ? `<p class="muted">${esc(it.body, 120)}</p>` : ''}
      ${feats ? `<ul>${feats}</ul>` : ''}
      <a class="${it.featured || i === 1 ? 'btn-primary' : 'btn-secondary'}" href="#">${esc(it.cta || T('Choose', '선택'), 24)}</a>
    </div>`;
    }).join('\n    ');
    return `<section class="section"><div class="container stack">
  <h2 style="text-align:center">${esc(s.title || T('Pricing', '가격'), 60)}</h2>
  <div class="grid-3">
    ${plans}
  </div>
</div></section>`;
  },
  cta(s) {
    return `<section class="section"><div class="container card row" style="justify-content:space-between">
  <div><h2>${esc(s.title, 70)}</h2>${s.body ? `<p class="muted">${esc(s.body, 200)}</p>` : ''}</div>
  <a class="btn-primary" href="#">${esc(s.cta || T('Get started', '시작하기'), 30)}</a>
</div></section>`;
  },
};

function renderSections(sections) {
  return (sections || []).slice(0, 8)
    .map((s) => (SECTION_RENDERERS[s.type] ? SECTION_RENDERERS[s.type](s) : ''))
    .filter(Boolean).join('\n');
}

/* ---------- 기본 템플릿 페이지 ---------- */
function landingHtml(data, brand, pages, ko) {
  const sections = [
    { type: 'hero', title: ko.headline || T('Your headline, in your design', '당신의 디자인으로, 당신의 헤드라인'),
      body: ko.sub || T('This starter page is styled with the palette, type scale and components extracted from the analyzed site. Replace this copy and ship.', '분석한 사이트에서 추출한 팔레트·타입 스케일·컴포넌트로 스타일된 스타터 페이지입니다. 문구만 바꿔서 배포하세요.'),
      cta: ko.cta || T('Primary action', '주요 액션'), cta2: T('Secondary', '보조 액션') },
    { type: 'features', items: [
      { badge: T('Feature', '기능'), title: T('Fast', '빠르게'), body: T('Describe the first key benefit of your product here.', '제품의 첫 번째 핵심 가치를 여기에 적으세요.') },
      { badge: T('Feature', '기능'), title: T('Consistent', '일관되게'), body: T('This kit reuses the exact tokens extracted from your reference design.', '이 키트는 참조 디자인에서 추출한 토큰을 그대로 사용합니다.') },
      { badge: T('Feature', '기능'), title: T('Yours', '당신답게'), body: T('Edit styles/tokens.css once — every page follows.', 'styles/tokens.css 한 곳만 고치면 모든 페이지에 반영됩니다.') },
    ] },
    { type: 'cta', title: T('Ready to start?', '시작할 준비 되셨나요?'),
      body: T('One primary action per band — as your design intends.', '밴드당 주요 액션 하나 — 원본 디자인의 의도대로.'),
      cta: ko.cta || T('Get started', '시작하기') },
  ];
  return `${navHtml(brand, pages, 'landing')}
${renderSections(sections)}
${footerHtml(brand, pages)}
${chatWidgetHtml()}`;
}

/* 인증: 이메일 + 소셜 로그인 (Google/GitHub) — UI 스캐폴드, 역할 안내 주석 포함 */
function authHtml(data, brand, pages) {
  return `${navHtml(brand, pages, 'auth')}
<main class="section"><div class="container auth-card stack">
  <div style="text-align:center"><h2>${T('Welcome back', '다시 만나 반가워요')}</h2><p class="muted">${T('Sign in to continue', '계속하려면 로그인하세요')}</p></div>
  <div class="card stack" style="gap:12px">
    <!-- 소셜 로그인: href를 OAuth 엔드포인트로 교체 (README '인증 연결' 참고) -->
    <a class="social-btn" href="#">🟦 ${T('Continue with Google', 'Google로 계속하기')}</a>
    <a class="social-btn" href="#">⬛ ${T('Continue with GitHub', 'GitHub로 계속하기')}</a>
    <div class="divider">${T('or', '또는')}</div>
    <input class="input" type="email" placeholder="you@example.com">
    <input class="input" type="password" placeholder="${T('Password', '비밀번호')}">
    <button class="btn-primary" type="button">${T('Sign in', '로그인')}</button>
    <p class="muted" style="font-size:13px;text-align:center">${T('No account?', '계정이 없나요?')} <a href="#">${T('Sign up', '가입하기')}</a></p>
  </div>
  <!-- 역할(roles): 로그인 후 사용자 역할(admin/member/viewer)에 따라 dashboard.html 메뉴를 분기.
       정적 키트에서는 주석으로 표시 — 실제 분기는 README '인증 연결' 참고 -->
</div></main>
${footerHtml(brand, pages)}`;
}

/* 블로그: 목록 + SEO 힌트 */
function blogHtml(data, brand, pages) {
  const posts = [
    [T('Why design tokens matter', '디자인 토큰이 중요한 이유'), T('Tokens keep every page consistent as you grow.', '토큰은 서비스가 커져도 모든 페이지를 일관되게 지켜줍니다.')],
    [T('Shipping your first landing page', '첫 랜딩 페이지 배포하기'), T('From zip to live site in five minutes.', 'zip에서 라이브 사이트까지 5분.')],
    [T('Building trust with legal pages', '법률 페이지로 신뢰 쌓기'), T('Privacy and terms are part of the product.', '개인정보처리방침과 약관도 제품의 일부입니다.')],
  ].map(([t2, b]) => `<article class="card post">
      <span class="badge">${T('Post', '글')}</span>
      <h3><a href="#">${t2}</a></h3>
      <p class="muted">${b}</p>
      <span class="meta muted">2026-01-01 · ${T('3 min read', '3분 읽기')}</span>
    </article>`).join('\n    ');
  return `${navHtml(brand, pages, 'blog')}
<main class="section"><div class="container stack">
  <div><h1>${T('Blog', '블로그')}</h1><p class="muted">${T('Each post page should set its own title/description meta tags for SEO.', 'SEO를 위해 글마다 title/description 메타 태그를 설정하세요.')}</p></div>
  <div class="grid-3">
    ${posts}
  </div>
</div></main>
${footerHtml(brand, pages)}`;
}

/* 문서: 사이드 목차 + 지식 검색 UI */
function docsHtml(data, brand, pages) {
  return `${navHtml(brand, pages, 'docs')}
<main class="section"><div class="container stack">
  <div class="row" style="justify-content:space-between"><h1>${T('Documentation', '문서')}</h1>
    <!-- 지식 검색: 정적 UI. 실제 검색은 README '챗봇·검색 연결' 참고 -->
    <div class="search"><input class="input" type="search" placeholder="${T('Search docs…', '문서 검색…')}"></div>
  </div>
  <div class="docs">
    <nav class="toc">
      <a class="active" href="#">${T('Getting started', '시작하기')}</a>
      <a href="#">${T('Tokens', '토큰')}</a>
      <a href="#">${T('Components', '컴포넌트')}</a>
      <a href="#">${T('Deploy', '배포')}</a>
    </nav>
    <article class="stack">
      <h2>${T('Getting started', '시작하기')}</h2>
      <p>${T('Unzip the kit and open index.html. Edit styles/tokens.css to adjust the design — every page follows.', '키트 압축을 풀고 index.html을 여세요. styles/tokens.css를 수정하면 모든 페이지에 반영됩니다.')}</p>
      <div class="card"><b>${T('Tip', '팁')}</b> — ${T('Give DESIGN.md to your AI coding agent as the style contract.', 'DESIGN.md를 AI 코딩 에이전트에게 스타일 기준으로 전달하세요.')}</div>
    </article>
  </div>
</div></main>
${footerHtml(brand, pages)}
${chatWidgetHtml()}`;
}

/* 법률: 개인정보처리방침 + 이용약관 골격 */
function legalHtml(data, brand, pages) {
  return `${navHtml(brand, pages, 'legal')}
<main class="section"><div class="container stack" style="max-width:760px">
  <h1>${T('Legal', '법률 고지')}</h1>
  <section class="card stack" id="privacy">
    <h2>${T('Privacy Policy', '개인정보처리방침')}</h2>
    <p class="muted">${T('Describe what data you collect, why, how long you keep it, and how users can request deletion. Replace this placeholder before launch.', '수집하는 데이터, 목적, 보관 기간, 삭제 요청 방법을 설명하세요. 출시 전 반드시 실제 내용으로 교체해야 합니다.')}</p>
  </section>
  <section class="card stack" id="terms">
    <h2>${T('Terms of Service', '이용약관')}</h2>
    <p class="muted">${T('Service scope, user obligations, liability limits, governing law. This scaffold is not legal advice.', '서비스 범위, 이용자 의무, 책임 한계, 준거법. 이 골격은 법률 자문이 아닙니다.')}</p>
  </section>
</div></main>
${footerHtml(brand, pages)}`;
}

/* 문의: 폼 + 뉴스레터 */
function contactHtml(data, brand, pages) {
  return `${navHtml(brand, pages, 'contact')}
<main class="section"><div class="container stack" style="max-width:560px">
  <div><h1>${T('Contact', '문의하기')}</h1><p class="muted">${T('Form posts nowhere yet — point the action at your email service or backend (see README).', '폼 action이 비어 있어요 — 이메일 서비스나 백엔드 주소로 연결하세요 (README 참고).')}</p></div>
  <!-- action을 Formspree/자체 API 엔드포인트로 교체 -->
  <form class="card stack" action="#" method="post">
    <input class="input" type="text" name="name" placeholder="${T('Name', '이름')}" required>
    <input class="input" type="email" name="email" placeholder="you@example.com" required>
    <textarea class="input" name="message" rows="5" placeholder="${T('How can we help?', '무엇을 도와드릴까요?')}" required></textarea>
    <!-- 파일 업로드: 첨부가 필요 없으면 이 라벨 블록 삭제 -->
    <label class="upload">📎 ${T('Attach a file (optional)', '파일 첨부 (선택)')}<input type="file" hidden></label>
    <button class="btn-primary" type="submit">${T('Send message', '보내기')}</button>
  </form>
</div></main>
${footerHtml(brand, pages)}`;
}

function dashboardHtml(data, brand, pages) {
  const rows = [
    [T('Design tokens', '디자인 토큰'), T('Synced', '동기화됨'), '128'],
    [T('Pages analyzed', '분석한 페이지'), T('Done', '완료'), '3'],
    [T('Components', '컴포넌트'), T('Stable', '안정'), '24'],
  ].map(([a, b, n]) => `<tr><td>${a}</td><td><span class="badge">${b}</span></td><td>${n}</td></tr>`).join('\n      ');
  return `${navHtml(brand, pages, 'dashboard')}
<div class="dash">
  <aside class="sidebar">
    <a class="active" href="#">${T('Overview', '개요')}</a>
    <a href="#">${T('Reports', '리포트')}</a>
    <a href="#">${T('Settings', '설정')}</a>
  </aside>
  <main class="main stack">
    <!-- 알림 배너: 공지·경고에 사용 -->
    <div class="banner"><span>🔔 ${T('Notifications appear here — releases, limits, billing.', '알림은 여기에 — 릴리스, 한도, 결제 소식.')}</span><button class="btn-secondary" type="button">${T('Dismiss', '닫기')}</button></div>
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

function componentsHtml(data, tokens, brand, pages) {
  const swatches = tokens.map((t) =>
    `<div class="card" style="padding:12px"><div style="height:56px;border-radius:6px;background:var(--color-${cssSafe(t.name)});border:1px solid var(--color-hairline,#eee)"></div><p style="margin-top:8px"><b>${htmlEsc(t.name)}</b><br><span class="muted">${htmlEsc(t.hex)}</span></p></div>`
  ).join('\n    ');
  const radii = buildRadiusTokens(data).map((r) =>
    `<div class="card" style="text-align:center;padding:12px"><div style="width:56px;height:56px;margin:0 auto;background:var(--color-primary);border-radius:var(--radius-${cssSafe(r.name)})"></div><p class="muted" style="margin-top:6px">${htmlEsc(r.name)} · ${r.name === 'pill' ? '9999' : r.px}px</p></div>`
  ).join('\n    ');
  const type = buildTypeTokens(data).map((r) =>
    `<p style="font-size:${cssSafe(r.size)}px;font-weight:${cssSafe(r.weight)}">${htmlEsc(r.token)} — ${cssSafe(r.size)}px</p>`
  ).join('\n    ');
  return `${navHtml(brand, pages, 'components')}
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
  <section class="stack"><h2>${T('Notifications', '알림')}</h2><div class="card stack">
    <span class="toast">✓ ${T('Saved successfully', '저장되었습니다')}</span>
    <div class="banner"><span>🔔 ${T('New version available', '새 버전이 나왔어요')}</span><button class="btn-secondary" type="button">${T('Dismiss', '닫기')}</button></div>
  </div></section>
  <section class="stack"><h2>${T('Upload & search', '업로드 & 검색')}</h2><div class="card stack">
    <label class="upload">📎 ${T('Drop a file or click to upload', '파일을 끌어오거나 클릭해 업로드')}<input type="file" hidden></label>
    <div class="search"><input class="input" type="search" placeholder="${T('Search…', '검색…')}"></div>
  </div></section>
  <section class="stack"><h2>${T('Social sign-in', '소셜 로그인')}</h2><div class="card stack" style="max-width:360px">
    <a class="social-btn" href="#">🟦 ${T('Continue with Google', 'Google로 계속하기')}</a>
    <a class="social-btn" href="#">⬛ ${T('Continue with GitHub', 'GitHub로 계속하기')}</a>
  </div></section>
</div></main>
${footerHtml(brand, pages)}`;
}

function pricingHtml(data, brand, pages) {
  const sections = [
    { type: 'pricing', title: T('Simple pricing', '심플한 가격'), items: [
      { title: 'Starter', price: '$0', body: T('For trying things out', '가볍게 시작할 때'), features: [T('Core features', '핵심 기능'), T('Community support', '커뮤니티 지원')], cta: T('Start free', '무료 시작') },
      { title: 'Pro', price: '$12/mo', body: T('For growing products', '성장하는 제품을 위해'), features: [T('Everything in Starter', 'Starter 전부 포함'), T('Advanced exports', '고급 내보내기'), T('Priority support', '우선 지원')], featured: true, cta: T('Go Pro', 'Pro 시작') },
      { title: 'Team', price: '$39/mo', body: T('For teams and agencies', '팀·에이전시용'), features: [T('Everything in Pro', 'Pro 전부 포함'), T('Shared workspaces', '공유 워크스페이스')], cta: T('Contact us', '문의하기') },
    ] },
    { type: 'faq', title: 'FAQ', items: [
      { title: T('Can I change my plan later?', '플랜은 나중에 바꿀 수 있나요?'), body: T('Yes — upgrade or downgrade anytime.', '네 — 언제든 업그레이드/다운그레이드할 수 있어요.') },
      { title: T('Is there a free trial?', '무료 체험이 있나요?'), body: T('The Starter plan is free forever.', 'Starter 플랜은 계속 무료입니다.') },
    ] },
  ];
  return `${navHtml(brand, pages, 'pricing')}
${renderSections(sections)}
${footerHtml(brand, pages)}`;
}

/* ---------- 부속 파일 (분석·배포·다국어·LLMO) ---------- */
// GA4 + PostHog 스니펫 — 키트 페이지는 스크립트 0 유지, 필요할 때 <head>에 붙여넣는 방식
function analyticsSnippetHtml() {
  return `<!-- ${T('Analytics snippets — paste into <head> of each page when ready. IDs are placeholders.', '분석 스니펫 — 준비되면 각 페이지 <head>에 붙여넣으세요. ID는 플레이스홀더입니다.')} -->

<!-- Google Analytics 4 -->
<!--
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
-->

<!-- PostHog -->
<!--
<script>
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  posthog.init('phc_XXXXXXXXXX', {api_host: 'https://us.i.posthog.com'});
</script>
-->
`;
}

// 다국어 스캐폴드 — 문구를 키로 분리해두면 번역 추가가 쉬움
function i18nStringsJson(brand) {
  return JSON.stringify({
    _comment: T('Starter i18n strings. Render with your framework of choice, or swap text per locale build.', '다국어 스타터 문자열. 프레임워크로 렌더하거나 로케일별 빌드에서 교체하세요.'),
    en: { brand, cta: 'Get started', signIn: 'Sign in', contact: 'Contact', subscribe: 'Subscribe' },
    ko: { brand, cta: '시작하기', signIn: '로그인', contact: '문의하기', subscribe: '구독하기' },
  }, null, 2);
}

// LLMO: AI 검색엔진용 사이트 요약 (https://llmstxt.org 관례)
function llmsTxt(brand, host, pages) {
  const list = pages.map((p) => `- [${pageLabel(p)}](/${PAGE_META[p].file})`).join('\n');
  return `# ${brand}

> ${T(`Starter site generated from the design of ${host}. Replace this summary with what your product does.`, `${host} 디자인으로 생성된 스타터 사이트. 이 요약을 제품 설명으로 교체하세요.`)}

## ${T('Pages', '페이지')}

${list}
`;
}

function robotsTxt() {
  return `User-agent: *
Allow: /

# ${T('Set your sitemap URL after deploy', '배포 후 sitemap URL을 설정하세요')}
# Sitemap: https://example.com/sitemap.xml
`;
}

const vercelJson = () => JSON.stringify({ cleanUrls: true, trailingSlash: false }, null, 2);
const netlifyToml = () => `[build]
  publish = "."
`;

function readmeMd(data, pages, hasCustom, hasDesignMd) {
  const host = (() => { try { return new URL(data.meta.url).host; } catch (e) { return data.meta.url; } })();
  const rowsEn = {
    landing: '| `index.html` | Landing (hero, features, CTA, newsletter, AI chat widget) |',
    auth: '| `auth.html` | Sign in / sign up — email + Google/GitHub social buttons, role notes |',
    dashboard: '| `dashboard.html` | App dashboard (sidebar, stats, table, notification banner) |',
    pricing: '| `pricing.html` | Pricing plans + FAQ (subscription billing UI) |',
    blog: '| `blog.html` | Blog list with SEO guidance |',
    docs: '| `docs.html` | Docs with sidebar TOC + knowledge search UI |',
    legal: '| `legal.html` | Privacy policy + terms scaffold |',
    contact: '| `contact.html` | Contact form + file upload + newsletter |',
    components: '| `components.html` | Live gallery of every token & component |',
  };
  const rowsKo = {
    landing: '| `index.html` | 랜딩 (히어로·기능·CTA·뉴스레터·AI 챗 위젯) |',
    auth: '| `auth.html` | 로그인/가입 — 이메일 + Google/GitHub 소셜 버튼, 역할 주석 |',
    dashboard: '| `dashboard.html` | 앱 대시보드 (사이드바·스탯·테이블·알림 배너) |',
    pricing: '| `pricing.html` | 가격 플랜 + FAQ (구독 결제 UI) |',
    blog: '| `blog.html` | 블로그 목록 + SEO 안내 |',
    docs: '| `docs.html` | 문서 (사이드 목차 + 지식 검색 UI) |',
    legal: '| `legal.html` | 개인정보처리방침·이용약관 골격 |',
    contact: '| `contact.html` | 문의 폼 + 파일 업로드 + 뉴스레터 |',
    components: '| `components.html` | 토큰·컴포넌트 전체 갤러리 |',
  };
  const pageRows = (rows) => pages.map((p) => rows[p]).filter(Boolean).join('\n');
  const customEn = hasCustom ? '\n| `custom.html` | Page generated from your prompt (on-device AI) |' : '';
  const customKo = hasCustom ? '\n| `custom.html` | 프롬프트로 생성한 맞춤 페이지 (온디바이스 AI) |' : '';
  const designEn = hasDesignMd ? '\n| `DESIGN.md` | Your extracted design spec — give it to AI coding agents |' : '';
  const designKo = hasDesignMd ? '\n| `DESIGN.md` | 추출된 디자인 스펙 — AI 코딩 에이전트에게 전달 |' : '';
  return T(`# Azuki Launch Kit

A launch-ready page kit generated from the design analysis of **${host}**.
Static, dependency-free, zero scripts — open \`index.html\` right away.

## What's inside

| File | Purpose |
|------|---------|
${pageRows(rowsEn)}${customEn}${designEn}
| \`styles/tokens.css\` | **Design tokens — edit this file first** |
| \`styles/kit.css\` | Component classes built on the tokens |
| \`snippets/analytics.html\` | GA4 + PostHog snippets (paste into \`<head>\`) |
| \`i18n/strings.json\` | Multilingual starter strings (en/ko) |
| \`llms.txt\` | LLMO — site summary for AI search engines |
| \`robots.txt\` | SEO crawler rules |
| \`vercel.json\` / \`netlify.toml\` | One-click deploy configs |

## Quick start

1. Unzip, open \`index.html\` — no build step.
2. Edit \`styles/tokens.css\`; every page follows.
3. Replace placeholder copy and legal text, then deploy.

## Wiring guide (the kit ships UI scaffolds — connect services here)

- **Auth & roles**: point the social buttons in \`auth.html\` at your OAuth endpoints (Supabase/Clerk/Firebase). Branch dashboard menus by role after sign-in.
- **Payments & subscriptions**: link the plan buttons in \`pricing.html\` to Stripe Payment Links — no backend needed to start.
- **AI chatbot & search**: the chat widget and docs search are static UI. Wire them to your assistant API or a hosted search (Algolia/Typesense).
- **Email, newsletter & contact**: set each \`<form action="#">\` to Formspree/Buttondown/your API.
- **Analytics**: copy from \`snippets/analytics.html\` into each page's \`<head>\`, replacing the placeholder IDs.
- **Deploy (one-click)**: drag the folder into Vercel/Netlify, or \`vercel deploy\` / \`netlify deploy\` — configs included.
- **i18n**: keys live in \`i18n/strings.json\`; swap per-locale or render with your framework.
- **SEO & LLMO**: every page has title/description/OG meta. Update \`llms.txt\` and \`robots.txt\` after deploy.

Generated by Azuki (Design Spec Extractor) · ${data.meta.analyzedAt}
`, `# Azuki 런치 키트

**${host}** 디자인 분석으로 생성된, 바로 배포 가능한 페이지 키트입니다.
정적·의존성 0·스크립트 0 — \`index.html\`을 바로 여세요.

## 구성

| 파일 | 용도 |
|------|------|
${pageRows(rowsKo)}${customKo}${designKo}
| \`styles/tokens.css\` | **디자인 토큰 — 가장 먼저 수정할 파일** |
| \`styles/kit.css\` | 토큰 위에 만든 컴포넌트 클래스 |
| \`snippets/analytics.html\` | GA4 + PostHog 스니펫 (\`<head>\`에 붙여넣기) |
| \`i18n/strings.json\` | 다국어 스타터 문자열 (en/ko) |
| \`llms.txt\` | LLMO — AI 검색엔진용 사이트 요약 |
| \`robots.txt\` | SEO 크롤러 규칙 |
| \`vercel.json\` / \`netlify.toml\` | 원클릭 배포 설정 |

## 빠른 시작

1. 압축 해제 후 \`index.html\` 열기 — 빌드 불필요.
2. \`styles/tokens.css\`만 고치면 모든 페이지에 반영.
3. 플레이스홀더 문구·법률 문서를 교체하고 배포.

## 연결 가이드 (키트는 UI 스캐폴드 — 서비스는 여기서 연결)

- **인증·역할**: \`auth.html\`의 소셜 버튼을 OAuth 엔드포인트(Supabase/Clerk/Firebase)로 연결. 로그인 후 역할별로 대시보드 메뉴 분기.
- **결제·구독**: \`pricing.html\` 플랜 버튼을 Stripe Payment Links로 — 백엔드 없이 시작 가능.
- **AI 챗봇·지식 검색**: 챗 위젯과 문서 검색은 정적 UI. 어시스턴트 API나 호스팅 검색(Algolia/Typesense)에 연결.
- **이메일·뉴스레터·문의**: 각 \`<form action="#">\`을 Formspree/Buttondown/자체 API로.
- **분석**: \`snippets/analytics.html\` 내용을 각 페이지 \`<head>\`에 복사, 플레이스홀더 ID 교체.
- **배포(원클릭)**: 폴더를 Vercel/Netlify에 드래그하거나 \`vercel deploy\` / \`netlify deploy\` — 설정 파일 포함.
- **다국어**: \`i18n/strings.json\`의 키를 로케일별로 교체하거나 프레임워크로 렌더.
- **SEO·LLMO**: 전 페이지에 title/description/OG 메타 포함. 배포 후 \`llms.txt\`·\`robots.txt\` 갱신.

Azuki (Design Spec Extractor) 생성 · ${data.meta.analyzedAt}
`);
}

/* ---------- 공개 API ---------- */
// 파일 목록 생성. [{ name, content }]
// kitOpts: { brand, headline, sub, cta, pages: [...KIT_PAGES], customPage: {name, content}, designMd: string }
export const KIT_PAGES = ['landing', 'auth', 'dashboard', 'pricing', 'blog', 'docs', 'legal', 'contact', 'components'];

export function exportKit(data, lang, kitOpts) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const o = kitOpts || {};
  const pages = (o.pages && o.pages.length ? o.pages : KIT_PAGES).filter((p) => KIT_PAGES.includes(p));
  const tokens = buildColorTokens(data);
  const brand = String(o.brand || (data.meta.title || 'My Site').split(/[—|·:-]/)[0].trim()).slice(0, 40) || 'My Site';
  const ko = { headline: o.headline ? String(o.headline).slice(0, 90) : '', sub: o.sub ? String(o.sub).slice(0, 260) : '', cta: o.cta ? String(o.cta).slice(0, 30) : '' };
  const host = (() => { try { return new URL(data.meta.url).host; } catch (e) { return data.meta.url || ''; } })();
  const builders = {
    landing: () => ({ name: 'index.html', content: page(brand, landingHtml(data, brand, pages, ko), ko.sub) }),
    auth: () => ({ name: 'auth.html', content: page(`${brand} — ${T('Sign in', '로그인')}`, authHtml(data, brand, pages)) }),
    dashboard: () => ({ name: 'dashboard.html', content: page(`${brand} — ${T('Dashboard', '대시보드')}`, dashboardHtml(data, brand, pages)) }),
    pricing: () => ({ name: 'pricing.html', content: page(`${brand} — ${T('Pricing', '가격')}`, pricingHtml(data, brand, pages)) }),
    blog: () => ({ name: 'blog.html', content: page(`${brand} — ${T('Blog', '블로그')}`, blogHtml(data, brand, pages)) }),
    docs: () => ({ name: 'docs.html', content: page(`${brand} — ${T('Docs', '문서')}`, docsHtml(data, brand, pages)) }),
    legal: () => ({ name: 'legal.html', content: page(`${brand} — ${T('Legal', '법률 고지')}`, legalHtml(data, brand, pages)) }),
    contact: () => ({ name: 'contact.html', content: page(`${brand} — ${T('Contact', '문의')}`, contactHtml(data, brand, pages)) }),
    components: () => ({ name: 'components.html', content: page(`${brand} — ${T('Components', '컴포넌트')}`, componentsHtml(data, tokens, brand, pages)) }),
  };
  const files = pages.map((p) => builders[p]());
  if (o.customPage && o.customPage.content) files.push({ name: 'custom.html', content: o.customPage.content });
  if (o.designMd) files.push({ name: 'DESIGN.md', content: String(o.designMd) });
  files.push({ name: 'styles/tokens.css', content: exportTokens(data, lang).css });
  files.push({ name: 'styles/kit.css', content: buildKitCss(data, tokens) });
  files.push({ name: 'snippets/analytics.html', content: analyticsSnippetHtml() });
  files.push({ name: 'i18n/strings.json', content: i18nStringsJson(brand) });
  files.push({ name: 'llms.txt', content: llmsTxt(brand, host, pages) });
  files.push({ name: 'robots.txt', content: robotsTxt() });
  files.push({ name: 'vercel.json', content: vercelJson() });
  files.push({ name: 'netlify.toml', content: netlifyToml() });
  files.push({ name: 'README.md', content: readmeMd(data, pages, !!(o.customPage && o.customPage.content), !!o.designMd) });
  return files;
}

/* ---------- AI 맞춤 페이지 ----------
   구조 JSON(온디바이스 LLM 또는 어떤 출처든) → HTML. 렌더는 전부 이스케이프 경유. */
// structure: { title, brand, sections: [{type: hero|features|stats|faq|pricing|cta, title, body, cta, items:[...] }] }
export function buildCustomKitPage(data, structure, lang) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const st = structure || {};
  const brand = String(st.brand || (data.meta.title || 'My Site').split(/[—|·:-]/)[0].trim()).slice(0, 40) || 'My Site';
  const pages = ['landing', 'dashboard', 'components', 'pricing'];
  const bodyHtml = `${navHtml(brand, pages, null)}
${renderSections(st.sections)}
${footerHtml(brand, pages)}`;
  return page(String(st.title || brand).slice(0, 60), bodyHtml);
}

// 온디바이스 LLM에 줄 시스템 프롬프트 (구조 JSON만 요구 — HTML 생성 금지)
export function customKitSystemPrompt(lang) {
  const language = lang === 'ko' ? 'Korean' : 'English';
  return `You are a landing page architect. Given a user's description of a page, respond with ONLY a JSON object (no markdown fences, no commentary) describing the page structure. All user-facing text must be written in ${language}.
Schema:
{"title": string, "brand": string, "sections": [
 {"type":"hero","title":string,"body":string,"cta":string,"cta2":string?},
 {"type":"features","title":string?,"items":[{"badge":string?,"title":string,"body":string}]},
 {"type":"stats","items":[{"title":string,"value":string}]},
 {"type":"pricing","title":string?,"items":[{"title":string,"price":string,"body":string?,"features":[string],"featured":boolean?,"cta":string?}]},
 {"type":"faq","title":string?,"items":[{"title":string,"body":string}]},
 {"type":"cta","title":string,"body":string?,"cta":string}
]}
Rules: 3-6 sections. Start with a hero. Write concrete, specific copy for the user's business — no lorem ipsum. Keep titles under 60 characters and bodies under 200.`;
}

// LLM 응답에서 JSON 추출 (코드펜스·잡담 관용)
export function parseKitStructure(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (!obj || !Array.isArray(obj.sections) || !obj.sections.length) return null;
    return obj;
  } catch (e) {
    return null;
  }
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

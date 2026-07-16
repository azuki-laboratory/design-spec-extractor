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
  c.push(`.main { padding: ${sp(4, '32px')}; align-content: start; }`);
  c.push('.stat { display: grid; gap: 4px; align-content: start; }');
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
  /* ---- 프리미엄 레이어: 상용 랜딩 밀도를 위한 장치 (이미지 없이 CSS만) ---- */
  const tint = (pct) => `color-mix(in srgb, var(--color-primary, ${cssSafe(primary)}) ${pct}%, var(--color-canvas, ${cssSafe(canvas)}))`;
  // 마이크로 인터랙션
  c.push('.btn-primary, .btn-secondary, .card, .social-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease, background 0.15s ease; }');
  c.push(`.card.lift:hover { transform: translateY(-3px);${shadow ? ` box-shadow: ${cssSafe(shadow)};` : ' box-shadow: 0 8px 24px rgba(0,0,0,0.08);'} }`);
  // 아이브로우: 섹션 제목 위 소형 라벨
  c.push(`.eyebrow { display: block; width: fit-content; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--color-primary, ${cssSafe(primary)}); }`);
  c.push('.center { text-align: center; } .center .eyebrow, .center .badge { margin-left: auto; margin-right: auto; }');
  // 교차 밴드: 섹션 리듬
  c.push(`.band { background: ${tint(4)}; }`);
  c.push(`.band-ink { background: var(--color-ink, ${cssSafe(ink)}); color: var(--color-canvas, ${cssSafe(canvas)}); }`);
  c.push('.band-ink .muted { color: inherit; opacity: 0.65; }');
  // 히어로: 2분할 + 비주얼 패널 (그라디언트 위 플로팅 카드 목업)
  c.push('.hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 48px; align-items: center; }');
  const grad = (data.colors.gradients || [])[0]?.gradient;
  const heroBg = grad ? cssSafe(grad.slice(0, 200)) : `linear-gradient(135deg, ${tint(18)}, ${tint(55)})`;
  c.push(`.hero-visual { position: relative; min-height: 360px; border-radius: var(--radius-lg, 16px); background: ${heroBg}; overflow: hidden; }`);
  c.push('.hero-visual .float { position: absolute; }');
  c.push('.hero-visual .float.a { top: 10%; left: 8%; right: 26%; }');
  c.push('.hero-visual .float.b { bottom: 12%; right: 8%; width: 52%; }');
  c.push(`.trust-note { font-size: 13px; color: var(--color-ink-mute, #888); }`);
  // 로고 스트립 (텍스트 로고)
  c.push('.logo-strip { display: flex; flex-wrap: wrap; gap: 16px 40px; justify-content: center; align-items: center; }');
  c.push(`.logo-strip span { font-weight: 700; font-size: 17px; letter-spacing: 0.5px; color: var(--color-ink-mute, #999); opacity: 0.75; }`);
  // 아이콘 타일 (기능 카드용)
  c.push(`.icon-tile { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: var(--radius-sm, 10px); background: ${tint(12)}; font-size: 20px; }`);
  // 통계 밴드 숫자
  c.push('.stat-band { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 24px; text-align: center; }');
  c.push('.stat-band .num { font-size: 38px; font-weight: 700; }');
  // 아바타 (이니셜 원)
  c.push(`.avatar { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; background: ${tint(85)}; color: ${cssSafe(onPrimary)}; font-size: 14px; font-weight: 700; flex-shrink: 0; }`);
  // 후기 카드
  c.push('.quote { display: grid; gap: 14px; }');
  c.push('.quote p { font-size: 15px; }');
  c.push('.quote .who { display: flex; align-items: center; gap: 10px; }');
  c.push('.quote .who b { display: block; font-size: 13.5px; }');
  c.push('.quote .who span { font-size: 12px; }');
  c.push(`.stars { color: var(--color-warning, #f5a623); letter-spacing: 2px; font-size: 13px; }`);
  // 최종 CTA 밴드
  c.push(`.cta-band { background: ${tint(8)}; border: 1px solid ${tint(20)}; }`);
  // 푸터 4열 그리드
  c.push('.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; }');
  c.push('.footer-grid h4 { font-size: 13px; margin-bottom: 12px; }');
  c.push('.footer-grid ul { list-style: none; display: grid; gap: 8px; font-size: 13.5px; }');
  c.push('.footer-grid a { color: var(--color-ink-mute, #888); }');
  c.push('.footer-grid a:hover { color: var(--color-primary); }');
  // CSS 바 차트 (대시보드)
  c.push('.bars { display: flex; align-items: flex-end; gap: 8px; height: 120px; }');
  c.push(`.bars i { flex: 1; border-radius: 4px 4px 0 0; background: ${tint(80)}; opacity: 0.9; }`);
  c.push(`.bars i:nth-child(odd) { background: ${tint(35)}; }`);
  // 증감 배지
  c.push(`.delta { font-size: 12px; font-weight: 700; width: fit-content; padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, #16a34a 12%, var(--color-canvas, #fff)); color: #15803d; }`);
  c.push('.delta.down { background: color-mix(in srgb, #dc2626 12%, var(--color-canvas, #fff)); color: #b91c1c; }');
  // 활동 피드
  c.push('.feed { display: grid; gap: 14px; } .feed .item { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; } .feed .item .when { margin-left: auto; flex-shrink: 0; font-size: 12px; }');
  // 인증 2분할
  c.push(`.auth-split { display: grid; grid-template-columns: 1fr 1fr; min-height: calc(100vh - 80px); } .auth-side { background: ${heroBg}; display: flex; align-items: flex-end; padding: 48px; } .auth-form { display: flex; align-items: center; justify-content: center; padding: 48px 24px; }`);
  // 블로그 커버 (그라디언트 플레이스홀더)
  c.push(`.cover { height: 150px; border-radius: var(--radius-sm, 10px) var(--radius-sm, 10px) 0 0; background: ${heroBg}; margin: calc(-1 * var(--spacing-md, 24px)) calc(-1 * var(--spacing-md, 24px)) 0; }`);
  c.push('.post .cover { margin: -24px -24px 0; }');
  // 가격 비교 행
  c.push('.compare td:first-child { color: var(--color-ink-mute, #888); }');
  c.push('.check { color: var(--color-primary); font-weight: 700; }');
  c.push('@media (max-width: 860px) { .hero-grid { grid-template-columns: 1fr; } .auth-split { grid-template-columns: 1fr; } .auth-side { display: none; } .footer-grid { grid-template-columns: 1fr 1fr; } }');
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
  const has = (p) => pages && pages.includes(p);
  const link = (p, label) => `<li><a href="${has(p) ? PAGE_META[p].file : '#'}">${label}</a></li>`;
  return `<footer class="site section"><div class="container stack" style="gap:40px">
  <div class="footer-grid">
    <div class="stack" style="gap:12px">
      <span class="brand">${htmlEsc(brand)}</span>
      <p class="muted" style="font-size:13.5px;max-width:280px">${T('The work hub styled with your own design system.', '당신의 디자인 시스템으로 완성된 워크 허브.')}</p>
      <!-- 뉴스레터 구독: form action을 이메일 서비스(예: Buttondown/Mailchimp) 엔드포인트로 교체 -->
      <form class="row" action="#" method="post" style="gap:8px">
        <input class="input" type="email" name="email" placeholder="${T('Email for updates', '소식 받을 이메일')}" style="max-width:220px">
        <button class="btn-secondary" type="submit">${T('Subscribe', '구독')}</button>
      </form>
    </div>
    <div><h4>${T('Product', '제품')}</h4><ul>
      ${link('landing', T('Overview', '소개'))}
      ${link('pricing', T('Pricing', '가격'))}
      ${link('components', T('Components', '컴포넌트'))}
      ${link('dashboard', T('Dashboard', '대시보드'))}
    </ul></div>
    <div><h4>${T('Resources', '리소스')}</h4><ul>
      ${link('blog', T('Blog', '블로그'))}
      ${link('docs', T('Docs', '문서'))}
      ${link('contact', T('Contact', '문의'))}
      ${link('auth', T('Sign in', '로그인'))}
    </ul></div>
    <div><h4>${T('Legal', '법률')}</h4><ul>
      <li><a href="${has('legal') ? 'legal.html#privacy' : '#'}">${T('Privacy', '개인정보처리방침')}</a></li>
      <li><a href="${has('legal') ? 'legal.html#terms' : '#'}">${T('Terms', '이용약관')}</a></li>
    </ul></div>
  </div>
  <div class="row" style="justify-content:space-between;border-top:1px solid var(--color-hairline,#eee);padding-top:20px">
    <span class="muted" style="font-size:13px">© 2026 ${htmlEsc(brand)}. ${T('All rights reserved.', 'All rights reserved.')}</span>
    <span class="muted" style="font-size:13px">${T('Built with the Azuki page kit', 'Azuki 페이지 키트로 제작')}</span>
  </div>
</div></footer>`;
}

/* ---------- 섹션 렌더러 (템플릿·AI 커스텀 공용) ----------
   모든 텍스트는 htmlEsc + 길이 상한. AI가 어떤 구조를 주든 여기서만 HTML이 된다. */
const esc = (s, n) => htmlEsc(String(s == null ? '' : s).slice(0, n));

const SECTION_RENDERERS = {
  hero(s) {
    // 상용 히어로: 아이브로우 + 카피 + CTA 페어 + 신뢰 문구 + 비주얼 패널(플로팅 카드 목업)
    return `<header class="section"><div class="container hero-grid">
  <div class="stack" style="gap:18px">
    ${s.eyebrow ? `<span class="eyebrow">${esc(s.eyebrow, 40)}</span>` : ''}
    <h1>${esc(s.title, 90)}</h1>
    ${s.body ? `<p class="muted" style="font-size:18px">${esc(s.body, 260)}</p>` : ''}
    <div class="row">
      <a class="btn-primary" href="#">${esc(s.cta || T('Get started', '시작하기'), 30)}</a>
      ${s.cta2 ? `<a class="btn-secondary" href="#">${esc(s.cta2, 30)}</a>` : ''}
    </div>
    ${s.note ? `<span class="trust-note">✓ ${esc(s.note, 80)}</span>` : ''}
  </div>
  <div class="hero-visual" aria-hidden="true">
    <div class="card float a stack" style="gap:8px"><span class="badge">${esc(s.visualBadge || T('Live', '실시간'), 16)}</span><b>${esc(s.visualTitle || T('Weekly report', '주간 리포트'), 30)}</b><div class="bars" style="height:64px"><i style="height:40%"></i><i style="height:70%"></i><i style="height:55%"></i><i style="height:90%"></i><i style="height:65%"></i></div></div>
    <div class="card float b row" style="gap:10px"><span class="avatar">A</span><div><b style="font-size:13px">${esc(s.visualName || 'Azuki', 20)}</b><div class="muted" style="font-size:12px">${esc(s.visualDesc || T('Just now · task completed', '방금 전 · 작업 완료'), 40)}</div></div></div>
  </div>
</div></header>`;
  },
  logos(s) {
    const names = (s.items || []).slice(0, 6).map((it) => `<span>${esc(typeof it === 'string' ? it : it.title, 20)}</span>`).join('\n    ');
    return `<section style="padding:28px 0"><div class="container stack" style="gap:14px">
  ${s.title ? `<p class="muted center" style="font-size:13px;text-align:center">${esc(s.title, 60)}</p>` : ''}
  <div class="logo-strip">
    ${names}
  </div>
</div></section>`;
  },
  features(s) {
    const cards = (s.items || []).slice(0, 6).map((it) =>
      `<div class="card lift stack" style="gap:10px">${it.icon ? `<span class="icon-tile">${esc(it.icon, 4)}</span>` : (it.badge ? `<span class="badge">${esc(it.badge, 16)}</span>` : '')}<h3>${esc(it.title, 50)}</h3><p class="muted">${esc(it.body, 200)}</p></div>`).join('\n    ');
    return `<section class="section band"><div class="container stack" style="gap:36px">
  <div class="center stack" style="gap:10px;max-width:640px;margin:0 auto">
    ${s.eyebrow ? `<span class="eyebrow">${esc(s.eyebrow, 40)}</span>` : ''}
    ${s.title ? `<h2>${esc(s.title, 60)}</h2>` : ''}
    ${s.body ? `<p class="muted">${esc(s.body, 200)}</p>` : ''}
  </div>
  <div class="grid-3">
    ${cards}
  </div>
</div></section>`;
  },
  stats(s) {
    const cells = (s.items || []).slice(0, 4).map((it) =>
      `<div><div class="num">${esc(it.value, 16)}</div><span class="muted">${esc(it.title, 30)}</span></div>`).join('\n    ');
    return `<section class="section band-ink"><div class="container stat-band">
    ${cells}
</div></section>`;
  },
  testimonials(s) {
    const cards = (s.items || []).slice(0, 3).map((it) => {
      const name = esc(it.name || it.title, 24);
      const initial = String(it.name || it.title || 'A').trim().charAt(0).toUpperCase();
      return `<div class="card quote">
      <span class="stars" aria-label="5/5">★★★★★</span>
      <p>“${esc(it.body || it.quote, 200)}”</p>
      <div class="who"><span class="avatar">${htmlEsc(initial)}</span><div><b>${name}</b><span class="muted">${esc(it.role, 40)}</span></div></div>
    </div>`;
    }).join('\n    ');
    return `<section class="section"><div class="container stack" style="gap:36px">
  <div class="center stack" style="gap:10px">
    ${s.eyebrow ? `<span class="eyebrow">${esc(s.eyebrow, 40)}</span>` : ''}
    ${s.title ? `<h2>${esc(s.title, 60)}</h2>` : ''}
  </div>
  <div class="grid-3">
    ${cards}
  </div>
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
    return `<section class="section"><div class="container card cta-band center stack" style="gap:14px;padding:56px 24px">
  <h2>${esc(s.title, 70)}</h2>
  ${s.body ? `<p class="muted" style="max-width:520px;margin:0 auto">${esc(s.body, 200)}</p>` : ''}
  <div class="row" style="justify-content:center">
    <a class="btn-primary" href="#">${esc(s.cta || T('Get started', '시작하기'), 30)}</a>
    ${s.cta2 ? `<a class="btn-secondary" href="#">${esc(s.cta2, 30)}</a>` : ''}
  </div>
  ${s.note ? `<span class="trust-note">✓ ${esc(s.note, 80)}</span>` : ''}
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
    { type: 'hero',
      eyebrow: T('New — now in open beta', 'New — 오픈 베타 진행 중'),
      title: ko.headline || T('Everything your team ships, in one place', '팀의 모든 작업을 하나의 흐름으로'),
      body: ko.sub || T(`${brand} brings planning, tracking and reporting together, so your team spends time building — not syncing.`, `${brand}가 계획·추적·리포트를 한곳에 모아줍니다. 팀은 싱크 맞추는 시간 대신 만드는 데 집중하세요.`),
      cta: ko.cta || T('Start free', '무료로 시작'), cta2: T('Book a demo', '데모 신청'),
      note: T('Free 14-day trial · No credit card required', '14일 무료 체험 · 카드 등록 불필요'),
      visualName: brand.slice(0, 12) },
    { type: 'logos', title: T('Trusted by teams at', '이런 팀들이 함께하고 있어요'),
      items: ['Nordwind', 'Acme Corp', 'Hanbit Lab', 'Polaris', 'Mint&Co'] },
    { type: 'features',
      eyebrow: T('Features', '핵심 기능'),
      title: T('Built for the way you actually work', '실제 일하는 방식 그대로'),
      body: T('Every feature below inherits this design system — colors, type and spacing extracted from your reference.', '아래 모든 기능 카드는 이 디자인 시스템(추출된 색·타이포·여백)을 그대로 따릅니다.'),
      items: [
        { icon: '⚡', title: T('Instant setup', '즉시 시작'), body: T('Invite your team and go live in minutes — no onboarding project required.', '몇 분이면 팀 초대까지 끝나요. 별도 온보딩 프로젝트가 필요 없습니다.') },
        { icon: '🔄', title: T('Real-time sync', '실시간 동기화'), body: T('Boards, docs and reports stay in sync across every device, automatically.', '보드·문서·리포트가 모든 기기에서 자동으로 맞춰집니다.') },
        { icon: '🔐', title: T('Roles & permissions', '역할·권한 관리'), body: T('Admin, member and viewer roles keep sensitive work visible to the right people.', '관리자·멤버·뷰어 역할로 민감한 작업을 필요한 사람에게만.') },
        { icon: '📊', title: T('Live dashboards', '라이브 대시보드'), body: T('Progress, velocity and blockers on one screen — shareable with a link.', '진행률·속도·블로커를 한 화면에서, 링크 하나로 공유.') },
        { icon: '🤖', title: T('AI assistant', 'AI 어시스턴트'), body: T('Summarize threads, draft updates and answer questions from your workspace.', '스레드 요약, 업데이트 초안, 워크스페이스 기반 답변까지.') },
        { icon: '🌍', title: T('Works everywhere', '어디서나'), body: T('Multilingual UI, offline-friendly, and fast on any connection.', '다국어 UI, 오프라인 대응, 어떤 네트워크에서도 빠르게.') },
      ] },
    { type: 'stats', items: [
      { value: '12,000+', title: T('teams on board', '함께하는 팀') },
      { value: '99.9%', title: T('uptime last 12 months', '최근 12개월 가동률') },
      { value: '4.8/5', title: T('average review score', '평균 평점') },
      { value: '35%', title: T('less time in meetings', '회의 시간 절감') },
    ] },
    { type: 'testimonials',
      eyebrow: T('Testimonials', '사용 후기'),
      title: T('Loved by fast-moving teams', '빠른 팀들이 먼저 알아봤어요'),
      items: [
        { name: T('Sujin Park', '박수진'), role: T('Product Lead, Hanbit Lab', '프로덕트 리드 · 한빛랩'), body: T('We replaced three tools with one. Weekly planning went from two hours to twenty minutes.', '툴 세 개를 하나로 줄였어요. 주간 계획이 2시간에서 20분으로.') },
        { name: T('Daniel Cho', '조대현'), role: T('CTO, Polaris', 'CTO · 폴라리스'), body: T('The dashboards alone are worth it — leadership finally sees progress without asking.', '대시보드만으로도 값어치를 해요. 리더십이 묻지 않아도 진행 상황을 봅니다.') },
        { name: T('Mina Lee', '이민아'), role: T('Design Manager, Mint&Co', '디자인 매니저 · 민트앤코'), body: T('Clean, fast, and the permissions model actually makes sense for agencies.', '깔끔하고 빠르고, 권한 구조가 에이전시에 딱 맞아요.') },
      ] },
    { type: 'faq', title: 'FAQ', items: [
      { title: T('How long does setup take?', '도입에 얼마나 걸리나요?'), body: T('Most teams are up and running in under 10 minutes. Import from CSV or start fresh.', '대부분의 팀이 10분 안에 시작합니다. CSV 가져오기도 지원해요.') },
      { title: T('Can I try it before paying?', '결제 전에 써볼 수 있나요?'), body: T('Yes — every plan starts with a free 14-day trial, no credit card required.', '네 — 모든 플랜에 14일 무료 체험이 포함되고, 카드 등록도 필요 없습니다.') },
      { title: T('Is my data safe?', '데이터는 안전한가요?'), body: T('Data is encrypted in transit and at rest, with role-based access control.', '전송·저장 구간 모두 암호화되며 역할 기반 접근 제어를 제공합니다.') },
      { title: T('Do you offer team discounts?', '팀 할인이 있나요?'), body: T('Annual billing saves two months, and teams of 20+ get custom pricing.', '연간 결제 시 2개월 무료, 20인 이상 팀은 별도 견적을 드려요.') },
    ] },
    { type: 'cta', title: T('Start building with your own design', '당신의 디자인으로 바로 시작하세요'),
      body: T(`Join thousands of teams already shipping with ${brand}.`, `이미 ${brand}와 함께 배포하는 수천 팀에 합류하세요.`),
      cta: ko.cta || T('Start free', '무료로 시작'), cta2: T('Talk to sales', '도입 문의'),
      note: T('Cancel anytime', '언제든 해지 가능') },
  ];
  return `${navHtml(brand, pages, 'landing')}
${renderSections(sections)}
${footerHtml(brand, pages)}
${chatWidgetHtml()}`;
}

/* 인증: 2분할(브랜드 패널 + 폼) — 이메일 + 소셜 로그인, 역할 안내 주석 포함 */
function authHtml(data, brand, pages) {
  return `${navHtml(brand, pages, 'auth')}
<div class="auth-split">
  <aside class="auth-side" aria-hidden="true">
    <div class="card quote" style="max-width:380px">
      <span class="stars">★★★★★</span>
      <p>“${T('Setup took ten minutes. Our whole team was planning in it the same afternoon.', '도입에 10분 걸렸어요. 그날 오후부터 팀 전체가 여기서 계획을 짭니다.')}”</p>
      <div class="who"><span class="avatar">S</span><div><b>${T('Sujin Park', '박수진')}</b><span class="muted">${T('Product Lead, Hanbit Lab', '프로덕트 리드 · 한빛랩')}</span></div></div>
    </div>
  </aside>
  <main class="auth-form"><div class="auth-card stack" style="width:100%">
    <div style="text-align:center"><h2>${T('Welcome back', '다시 만나 반가워요')}</h2><p class="muted">${T(`Sign in to your ${brand} workspace`, `${brand} 워크스페이스에 로그인하세요`)}</p></div>
    <div class="card stack" style="gap:12px">
      <!-- 소셜 로그인: href를 OAuth 엔드포인트로 교체 (README '인증 연결' 참고) -->
      <a class="social-btn" href="#">🟦 ${T('Continue with Google', 'Google로 계속하기')}</a>
      <a class="social-btn" href="#">⬛ ${T('Continue with GitHub', 'GitHub로 계속하기')}</a>
      <div class="divider">${T('or', '또는')}</div>
      <input class="input" type="email" placeholder="you@example.com">
      <input class="input" type="password" placeholder="${T('Password', '비밀번호')}">
      <div class="row" style="justify-content:space-between;font-size:13px">
        <label class="row" style="gap:6px"><input type="checkbox" checked>${T('Remember me', '로그인 유지')}</label>
        <a href="#">${T('Forgot password?', '비밀번호 찾기')}</a>
      </div>
      <button class="btn-primary" type="button">${T('Sign in', '로그인')}</button>
      <p class="muted" style="font-size:13px;text-align:center">${T('No account?', '계정이 없나요?')} <a href="#">${T('Start free', '무료로 시작하기')}</a></p>
    </div>
    <p class="trust-note" style="text-align:center">🔒 ${T('Protected by SSO-ready authentication', 'SSO 지원 인증으로 보호됩니다')}</p>
  </div></main>
</div>
<!-- 역할(roles): 로그인 후 사용자 역할(admin/member/viewer)에 따라 dashboard.html 메뉴를 분기.
     정적 키트에서는 주석으로 표시 — 실제 분기는 README '인증 연결' 참고 -->
${footerHtml(brand, pages)}`;
}

/* 블로그: 커버(그라디언트) + 카테고리 + 저자/날짜 */
function blogHtml(data, brand, pages) {
  const posts = [
    [T('Product', '프로덕트'), T('How we cut weekly planning from 2 hours to 20 minutes', '주간 계획을 2시간에서 20분으로 줄인 방법'), T('A practical walkthrough of the planning workflow our fastest teams use.', '빠른 팀들이 실제로 쓰는 계획 워크플로를 단계별로 소개합니다.'), 'S', T('Sujin Park', '박수진'), '2026-07-02', 7],
    [T('Engineering', '엔지니어링'), T('Design tokens in production: lessons from 12k teams', '프로덕션 디자인 토큰: 1만 2천 팀에게 배운 것'), T('What breaks, what scales, and how to keep tokens the single source of truth.', '무엇이 깨지고 무엇이 확장되는지, 토큰을 단일 출처로 유지하는 법.'), 'D', T('Daniel Cho', '조대현'), '2026-06-24', 9],
    [T('Company', '컴퍼니'), T('Announcing roles & permissions for every plan', '모든 플랜에 역할·권한 기능을 오픈합니다'), T('Admin, member and viewer — now available to everyone, including free.', '관리자·멤버·뷰어 — 무료 플랜을 포함해 전부 제공됩니다.'), 'M', T('Mina Lee', '이민아'), '2026-06-10', 4],
  ].map(([cat, t2, b, i, name, date, min]) => `<article class="card lift post">
      <div class="cover" aria-hidden="true"></div>
      <span class="badge" style="margin-top:16px">${cat}</span>
      <h3><a href="#">${t2}</a></h3>
      <p class="muted">${b}</p>
      <div class="row" style="gap:10px;margin-top:4px"><span class="avatar" style="width:28px;height:28px;font-size:12px">${i}</span><span class="meta muted">${name} · ${date} · ${T(`${min} min read`, `${min}분 읽기`)}</span></div>
    </article>`).join('\n    ');
  return `${navHtml(brand, pages, 'blog')}
<main class="section"><div class="container stack" style="gap:36px">
  <div class="center stack" style="gap:10px"><span class="eyebrow">${T('Blog', '블로그')}</span><h1>${T('Notes on building better products', '더 나은 제품을 만드는 기록')}</h1><p class="muted">${T('Product updates, engineering deep-dives and company news.', '제품 업데이트, 엔지니어링 딥다이브, 회사 소식.')}</p></div>
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

/* 문의: 2분할 (연락 정보 카드 + 폼) */
function contactHtml(data, brand, pages) {
  return `${navHtml(brand, pages, 'contact')}
<main class="section"><div class="container stack" style="gap:36px">
  <div class="center stack" style="gap:10px"><span class="eyebrow">${T('Contact', '문의')}</span><h1>${T('We reply within one business day', '영업일 기준 하루 안에 답합니다')}</h1></div>
  <div class="grid-3" style="grid-template-columns:1fr 1.6fr;align-items:start">
    <div class="stack">
      <div class="card stack" style="gap:6px"><span class="icon-tile">✉️</span><h3>${T('Email', '이메일')}</h3><p class="muted">hello@example.com</p></div>
      <div class="card stack" style="gap:6px"><span class="icon-tile">💬</span><h3>${T('Live chat', '실시간 채팅')}</h3><p class="muted">${T('Weekdays 9:00–18:00 (KST)', '평일 9:00–18:00 (KST)')}</p></div>
      <div class="card stack" style="gap:6px"><span class="icon-tile">🏢</span><h3>${T('Office', '오피스')}</h3><p class="muted">${T('123 Product St, Seoul', '서울시 프로덕트로 123')}</p></div>
    </div>
    <!-- action을 Formspree/자체 API 엔드포인트로 교체 -->
    <form class="card stack" action="#" method="post">
      <div class="row" style="gap:10px"><input class="input" type="text" name="name" placeholder="${T('Name', '이름')}" required style="flex:1"><input class="input" type="email" name="email" placeholder="you@example.com" required style="flex:1.4"></div>
      <input class="input" type="text" name="subject" placeholder="${T('Subject', '제목')}">
      <textarea class="input" name="message" rows="6" placeholder="${T('How can we help?', '무엇을 도와드릴까요?')}" required></textarea>
      <!-- 파일 업로드: 첨부가 필요 없으면 이 라벨 블록 삭제 -->
      <label class="upload">📎 ${T('Attach a file (optional)', '파일 첨부 (선택)')}<input type="file" hidden></label>
      <button class="btn-primary" type="submit">${T('Send message', '보내기')}</button>
      <span class="trust-note">🔒 ${T('Your message is sent securely.', '메시지는 안전하게 전송됩니다.')}</span>
    </form>
  </div>
</div></main>
${footerHtml(brand, pages)}`;
}

function dashboardHtml(data, brand, pages) {
  const rows = [
    [T('Q3 launch plan', '3분기 런칭 플랜'), T('In progress', '진행 중'), T('Sujin P.', '박수진'), '82%'],
    [T('Mobile onboarding revamp', '모바일 온보딩 개편'), T('In review', '리뷰 중'), T('Daniel C.', '조대현'), '64%'],
    [T('Billing migration', '결제 마이그레이션'), T('Done', '완료'), T('Mina L.', '이민아'), '100%'],
    [T('Design token sync', '디자인 토큰 동기화'), T('In progress', '진행 중'), 'Azuki', '45%'],
  ].map(([a, b, o, p]) => `<tr><td><b>${a}</b></td><td><span class="badge">${b}</span></td><td>${o}</td><td>${p}</td></tr>`).join('\n      ');
  const feed = [
    ['S', T('Sujin merged the launch checklist', '수진 님이 런칭 체크리스트를 병합했어요'), T('12m ago', '12분 전')],
    ['D', T('Daniel commented on onboarding flow', '대현 님이 온보딩 플로우에 댓글을 남겼어요'), T('1h ago', '1시간 전')],
    ['M', T('Mina closed 8 design QA issues', '민아 님이 디자인 QA 이슈 8건을 닫았어요'), T('3h ago', '3시간 전')],
  ].map(([i, txt, when]) => `<div class="item"><span class="avatar" style="width:28px;height:28px;font-size:12px">${i}</span><span>${txt}</span><span class="when muted">${when}</span></div>`).join('\n      ');
  return `${navHtml(brand, pages, 'dashboard')}
<div class="dash">
  <aside class="sidebar">
    <a class="active" href="#">${T('Overview', '개요')}</a>
    <a href="#">${T('Projects', '프로젝트')}</a>
    <a href="#">${T('Reports', '리포트')}</a>
    <a href="#">${T('Members', '멤버')}</a>
    <a href="#">${T('Settings', '설정')}</a>
  </aside>
  <main class="main stack">
    <div class="row" style="justify-content:space-between">
      <h2>${T('Overview', '개요')}</h2>
      <div class="row" style="gap:10px">
        <div class="search" style="width:220px"><input class="input" type="search" placeholder="${T('Search…', '검색…')}"></div>
        <span class="avatar" title="Azuki">A</span>
      </div>
    </div>
    <!-- 알림 배너: 공지·경고에 사용 -->
    <div class="banner"><span>🔔 ${T('New: weekly digest emails are live — configure in Settings.', 'New: 주간 다이제스트 메일 오픈 — 설정에서 켤 수 있어요.')}</span><button class="btn-secondary" type="button">${T('Dismiss', '닫기')}</button></div>
    <div class="grid-3">
      <div class="card stat"><span class="muted">${T('Active projects', '진행 중 프로젝트')}</span><span class="num">24</span><span class="delta">▲ 12.4%</span></div>
      <div class="card stat"><span class="muted">${T('Tasks completed', '완료한 작업')}</span><span class="num">1,284</span><span class="delta">▲ 8.1%</span></div>
      <div class="card stat"><span class="muted">${T('Overdue', '기한 초과')}</span><span class="num">7</span><span class="delta down">▼ 3.2%</span></div>
    </div>
    <div class="grid-3" style="grid-template-columns:2fr 1fr">
      <div class="card stack">
        <div class="row" style="justify-content:space-between"><h3>${T('Weekly throughput', '주간 처리량')}</h3><span class="muted" style="font-size:12px">${T('Last 8 weeks', '최근 8주')}</span></div>
        <div class="bars"><i style="height:35%"></i><i style="height:52%"></i><i style="height:44%"></i><i style="height:68%"></i><i style="height:59%"></i><i style="height:82%"></i><i style="height:74%"></i><i style="height:95%"></i></div>
      </div>
      <div class="card stack">
        <h3>${T('Activity', '활동')}</h3>
        <div class="feed">
      ${feed}
        </div>
      </div>
    </div>
    <div class="card stack">
      <div class="row" style="justify-content:space-between"><h3>${T('Projects', '프로젝트')}</h3><button class="btn-secondary" type="button">${T('Export', '내보내기')}</button></div>
      <table><thead><tr><th>${T('Name', '이름')}</th><th>${T('Status', '상태')}</th><th>${T('Owner', '담당')}</th><th>${T('Progress', '진행률')}</th></tr></thead><tbody>
      ${rows}
      </tbody></table>
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
    { type: 'pricing', title: T('Pricing that scales with you', '성장에 맞춰 확장되는 가격'), items: [
      { title: 'Starter', price: '$0', body: T('For individuals and side projects', '개인·사이드 프로젝트용'), features: [T('Up to 3 projects', '프로젝트 3개'), T('Core features', '핵심 기능 전체'), T('Community support', '커뮤니티 지원')], cta: T('Start free', '무료 시작') },
      { title: 'Pro', price: T('$12 / user / mo', '$12 / 인 / 월'), body: T('For growing teams', '성장하는 팀을 위해'), features: [T('Unlimited projects', '무제한 프로젝트'), T('Roles & permissions', '역할·권한 관리'), T('Live dashboards & AI assistant', '라이브 대시보드·AI 어시스턴트'), T('Priority support', '우선 지원')], featured: true, cta: T('Start 14-day trial', '14일 체험 시작') },
      { title: 'Enterprise', price: T('Custom', '별도 견적'), body: T('For 20+ seats and agencies', '20인 이상·에이전시'), features: [T('Everything in Pro', 'Pro 전부 포함'), T('SSO & audit logs', 'SSO·감사 로그'), T('Dedicated manager', '전담 매니저')], cta: T('Talk to sales', '도입 문의') },
    ] },
  ];
  const compare = [
    [T('Projects', '프로젝트'), '3', T('Unlimited', '무제한'), T('Unlimited', '무제한')],
    [T('Members', '멤버'), '1', T('Unlimited', '무제한'), T('Unlimited', '무제한')],
    [T('Roles & permissions', '역할·권한'), '—', '✓', '✓'],
    [T('AI assistant', 'AI 어시스턴트'), '—', '✓', '✓'],
    [T('SSO / audit logs', 'SSO / 감사 로그'), '—', '—', '✓'],
  ].map(([f, a, b, cc]) => `<tr><td>${f}</td><td>${a}</td><td class="check">${b}</td><td>${cc}</td></tr>`).join('\n      ');
  const faqSections = [
    { type: 'faq', title: 'FAQ', items: [
      { title: T('Can I change my plan later?', '플랜은 나중에 바꿀 수 있나요?'), body: T('Yes — upgrade or downgrade anytime; changes are prorated.', '네 — 언제든 변경 가능하고 일할 계산됩니다.') },
      { title: T('Do you offer annual billing?', '연간 결제가 있나요?'), body: T('Annual billing saves two months on every paid plan.', '연간 결제 시 모든 유료 플랜에서 2개월이 무료입니다.') },
      { title: T('Is there a free trial?', '무료 체험이 있나요?'), body: T('Every paid plan starts with 14 days free — no credit card required.', '모든 유료 플랜에 14일 무료 체험 — 카드 등록 불필요.') },
    ] },
  ];
  return `${navHtml(brand, pages, 'pricing')}
${renderSections(sections)}
<section style="padding:8px 0 40px"><div class="container center"><span class="trust-note">💳 ${T('Annual billing: 2 months free · Cancel anytime', '연간 결제 시 2개월 무료 · 언제든 해지 가능')}</span></div></section>
<section class="section band"><div class="container stack">
  <h2 class="center" style="text-align:center">${T('Compare plans', '플랜 비교')}</h2>
  <div class="card" style="overflow-x:auto">
    <table class="compare"><thead><tr><th></th><th>Starter</th><th>Pro</th><th>Enterprise</th></tr></thead><tbody>
      ${compare}
    </tbody></table>
  </div>
</div></section>
${renderSections(faqSections)}
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
 {"type":"hero","eyebrow":string?,"title":string,"body":string,"cta":string,"cta2":string?,"note":string?},
 {"type":"logos","title":string?,"items":[string]},
 {"type":"features","eyebrow":string?,"title":string?,"body":string?,"items":[{"icon":string?,"title":string,"body":string}]},
 {"type":"stats","items":[{"title":string,"value":string}]},
 {"type":"testimonials","title":string?,"items":[{"name":string,"role":string,"body":string}]},
 {"type":"pricing","title":string?,"items":[{"title":string,"price":string,"body":string?,"features":[string],"featured":boolean?,"cta":string?}]},
 {"type":"faq","title":string?,"items":[{"title":string,"body":string}]},
 {"type":"cta","title":string,"body":string?,"cta":string,"note":string?}
]}
Rules: 4-7 sections. Start with a hero (include a short trust note like "no credit card required"). Prefer feature items with a single emoji icon. Write concrete, specific, production-ready copy for the user's business — no lorem ipsum, no instructions to the reader. Keep titles under 60 characters and bodies under 200.`;
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

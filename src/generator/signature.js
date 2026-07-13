// generator/signature.js — Azuki 시그니처: DNA·린트·마스코트·지문·여권 (ESM)
import { state, T, htmlEsc, cssSafe, buildColorTokens, buildRadiusTokens, buildSpacingTokens, detectSpacingBase, detectTypeScale, contrast, saturation, hueName } from './core.js';

export function computeDNA(data, lang) {
  if (lang !== undefined) state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const primary = tokens.find((t) => t.name === 'primary');
  const ink = tokens.find((t) => t.name === 'ink');
  const canvas = tokens.find((t) => t.name === 'canvas');
  const radius = buildRadiusTokens(data);
  const finite = radius.filter((r) => r.name !== 'pill').map((r) => r.px);
  const maxRad = finite.length ? Math.max(...finite) : 0;
  const hasPill = radius.some((r) => r.name === 'pill');
  const sb = detectSpacingBase(data);
  const scale = detectTypeScale(data);

  const tags = [];
  tags.push(data.theme.isDark ? T('Dark', '다크') : T('Light', '라이트'));
  if (ink && canvas) {
    const c = contrast(ink.hex, canvas.hex);
    tags.push(c >= 7 ? T('High-contrast', '고대비') : c >= 4.5 ? T('Balanced contrast', '균형 대비') : T('Low-contrast', '저대비'));
  }
  if (primary) {
    const s = saturation(primary.hex);
    tags.push(s > 0.6 ? T('Vivid', '비비드') : s > 0.3 ? T('Muted', '뮤트') : T('Subtle', '차분'));
  } else {
    tags.push(T('Monochrome', '모노크롬'));
  }
  tags.push(hasPill ? T('Pill corners', '필 코너') : maxRad >= 16 ? T('Soft corners', '둥근 코너') : maxRad >= 6 ? T('Rounded', '약간 둥근') : T('Sharp corners', '각진 코너'));
  if (sb) tags.push(T(`${sb.base}px grid`, `${sb.base}px 그리드`));
  tags.push(data.layout.flexCount >= data.layout.gridCount ? T('Flex-first', 'Flex 우선') : T('Grid-first', 'Grid 우선'));
  if (scale) tags.push(scale.name);
  return tags;
}

/* ---------- Azuki 시그니처: 디자인 린트 ---------- */
// 페이지가 "자기 자신의 토큰"을 어기는 지점을 진단. { level: 'warn'|'info', msg }[]
export function computeLint(data, lang) {
  if (lang !== undefined) state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const byName = (n) => tokens.find((t) => t.name === n)?.hex;
  const issues = [];

  // 대비 (WCAG 4.5:1 미만)
  [['ink', 'canvas', T('body text', '본문')], ['on-primary', 'primary', T('primary button', 'primary 버튼')], ['link', 'canvas', T('links', '링크')]]
    .forEach(([fg, bg, use]) => {
      const f = byName(fg), b = byName(bg);
      if (f && b) {
        const c = contrast(f, b);
        if (c < 4.5) issues.push({ level: 'warn', msg: T(`Low contrast on ${use}: ${c.toFixed(1)}:1 (< 4.5)`, `${use} 대비 낮음: ${c.toFixed(1)}:1 (< 4.5)`) });
      }
    });

  // 그리드 이탈 여백
  const sb = detectSpacingBase(data);
  if (sb && sb.off.length) issues.push({ level: 'warn', msg: T(`Off-grid spacing (not ${sb.base}px multiples): ${sb.off.map((v) => v + 'px').join(', ')}`, `그리드 이탈 여백 (${sb.base}px 배수 아님): ${sb.off.map((v) => v + 'px').join(', ')}`) });

  // 컴포넌트 반경이 반경 스케일을 벗어남
  const scalePx = buildRadiusTokens(data).filter((r) => r.name !== 'pill').map((r) => r.px);
  const compRadii = [];
  (data.components.buttons || []).slice(0, 3).forEach((b) => { const px = parseInt(b.style.borderRadius, 10); if (Number.isFinite(px)) compRadii.push(px); });
  ['input', 'card', 'nav'].forEach((k) => { const s = data.components[k]; if (s && s.borderRadius) { const px = parseInt(s.borderRadius, 10); if (Number.isFinite(px)) compRadii.push(px); } });
  const oddR = [...new Set(compRadii)].filter((px) => px > 0 && px < 999 && !scalePx.some((r) => Math.abs(r - px) <= 1));
  if (oddR.length) issues.push({ level: 'info', msg: T(`Radius outside scale: ${oddR.map((v) => v + 'px').join(', ')}`, `반경 스케일 이탈: ${oddR.map((v) => v + 'px').join(', ')}`) });

  // 타입/굵기 과다
  const nSizes = (data.typography.sizes || []).length;
  if (nSizes > 7) issues.push({ level: 'info', msg: T(`Many font sizes (${nSizes}) — consider consolidating`, `폰트 크기 과다 (${nSizes}종) — 정리 고려`) });
  const nW = (data.typography.weights || []).length;
  if (nW > 4) issues.push({ level: 'info', msg: T(`Many font weights (${nW})`, `폰트 굵기 과다 (${nW}종)`) });

  return issues;
}

/* ---------- Azuki 시그니처: 마스코트 촌평 ----------
   상태(clean/warn/info)별 대사 풀 + 디자인 특성(다크/비비드/필/고대비/각짐) 플레이버.
   designFingerprint로 결정적 선택 — 같은 사이트는 항상 같은 대사, 사이트별로 달라진다. */
export function mascotComment(data, lang) {
  if (lang !== undefined) state.LANG = lang === 'ko' ? 'ko' : 'en';
  const issues = computeLint(data);
  const warns = issues.filter((i) => i.level === 'warn').length;

  // 결정적 인덱스 (지문 문자열 해시)
  const fp = designFingerprint(data);
  let hh = 0;
  for (let i = 0; i < fp.length; i++) hh = (hh * 31 + fp.charCodeAt(i)) >>> 0;
  const pick = (arr) => arr[hh % arr.length];

  let base;
  if (!issues.length) {
    base = pick([
      T('Clean and consistent — great tokens! 🫘', '토큰 깔끔하고 일관돼요 — 훌륭해요! 🫘'),
      T("Tidy system. Nothing to nag about. 🫘", '정돈된 시스템이에요. 잔소리할 게 없네요. 🫘'),
      T('Every token lines up. Chef\'s kiss. 🫘', '토큰이 딱딱 맞아떨어져요. 최고! 🫘'),
      T('Coherent and calm — I like it. 🫘', '일관되고 차분해요 — 아즈키 마음에 들어요. 🫘'),
      T('No loose ends. Ship it. 🫘', '흐트러진 데 없어요. 그대로 가도 돼요. 🫘'),
    ]);
  } else if (warns) {
    base = pick([
      T(`Spotted ${warns} thing(s) worth fixing — see the lint. 🫘`, `고칠 점 ${warns}개 발견 — 린트를 확인해요. 🫘`),
      T(`${warns} rough edge(s) below. Quick wins! 🫘`, `아래 ${warns}가지만 다듬으면 돼요. 금방이에요! 🫘`),
      T(`Found ${warns} issue(s) — small tweaks, big polish. 🫘`, `${warns}건 발견 — 살짝만 손보면 확 살아나요. 🫘`),
      T(`${warns} spot(s) need love. Check the lint. 🫘`, `${warns}군데만 손보면 완성이에요. 린트 봐요. 🫘`),
    ]);
  } else {
    base = pick([
      T('Looks solid, just a few small notes. 🫘', '대체로 탄탄해요, 참고사항 몇 개만! 🫘'),
      T('Solid base — a couple of notes below. 🫘', '기반은 탄탄해요 — 아래 참고 몇 개. 🫘'),
      T('Nearly there. Minor notes only. 🫘', '거의 다 왔어요. 사소한 메모뿐이에요. 🫘'),
    ]);
  }

  // 특성 플레이버 (해당하면 한 마디 덧붙임)
  const tokens = buildColorTokens(data);
  const primary = tokens.find((t) => t.name === 'primary');
  const ink = tokens.find((t) => t.name === 'ink');
  const canvas = tokens.find((t) => t.name === 'canvas');
  const radius = buildRadiusTokens(data);
  const flavors = [];
  if (data.theme.isDark) flavors.push(T('Moody dark palette.', '무드 있는 다크 팔레트네요.'));
  if (primary && saturation(primary.hex) > 0.6) flavors.push(T('Bold, vivid color.', '대담하고 선명한 컬러예요.'));
  if (radius.some((r) => r.name === 'pill')) flavors.push(T('Those pill shapes feel friendly.', '동글동글 필 형태가 친근해요.'));
  if (ink && canvas && contrast(ink.hex, canvas.hex) >= 7) flavors.push(T('Crisp, high contrast.', '또렷한 고대비예요.'));
  const maxRad = Math.max(0, ...radius.filter((r) => r.name !== 'pill').map((r) => r.px));
  if (maxRad < 6 && !radius.some((r) => r.name === 'pill')) flavors.push(T('Sharp and minimal.', '각지고 미니멀해요.'));

  return flavors.length ? `${base} ${pick(flavors)}` : base;
}

/* ---------- Azuki 시그니처: 에이전트 프롬프트 브릿지 ---------- */
// AI 코딩 에이전트에 바로 붙여넣는 self-contained 프롬프트.
export function designFingerprint(data) {
  const tokens = buildColorTokens(data);
  const primary = (tokens.find((t) => t.name === 'primary') || tokens.find((t) => t.name === 'canvas') || {}).hex || '#000000';
  const body = data.typography.body || {};
  const sb = detectSpacingBase(data);
  const rad = buildRadiusTokens(data);
  const sig = [
    primary, body.family, body.size, data.theme.isDark ? 'd' : 'l',
    sb ? sb.base : 0, rad.map((r) => r.px).join('.'),
    (data.responsive.breakpoints || []).map((b) => b.px).join('.'),
  ].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < sig.length; i++) { h ^= sig.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `AZ-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/* ---------- Azuki 시그니처: 디자인 여권(Passport) SVG ---------- */
// 사이트 디자인 정체성을 한 장으로 요약한 자기완결 SVG 카드. 브랜드(잉크/크림/블루) 스타일.
export function exportPassport(data, lang) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const dna = computeDNA(data);
  const fp = designFingerprint(data);
  const primary = cssSafe((tokens.find((t) => t.name === 'primary') || {}).hex || '#2f6bff');
  const swatches = tokens.slice(0, 6).map((t) => cssSafe(t.hex));
  const body = data.typography.body || {};
  const esc = htmlEsc; // SVG 텍스트/속성: 완전 이스케이프(따옴표 포함)
  const title = esc((data.meta.title || data.meta.url || '').slice(0, 42));
  const host = esc((() => { try { return new URL(data.meta.url).host; } catch (e) { return data.meta.url || ''; } })().slice(0, 48));

  const W = 520, H = 300;
  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, 'Apple SD Gothic Neo', sans-serif">`);
  s.push(`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="10" fill="#f6f3ec" stroke="#14161c" stroke-width="2"/>`);
  // 헤더 바
  s.push(`<text x="28" y="44" font-size="13" letter-spacing="2" fill="#5b606e">AZUKI · DESIGN PASSPORT</text>`);
  s.push(`<circle cx="${W - 34}" cy="38" r="10" fill="${esc(primary)}"/>`);
  s.push(`<line x1="28" y1="60" x2="${W - 28}" y2="60" stroke="#e3ddd0" stroke-width="1"/>`);
  // 타이틀
  s.push(`<text x="28" y="92" font-size="20" font-weight="700" fill="#14161c">${title}</text>`);
  s.push(`<text x="28" y="114" font-size="12" fill="#5b606e">${host}</text>`);
  // 팔레트 스와치
  swatches.forEach((hex, i) => {
    s.push(`<rect x="${28 + i * 34}" y="132" width="28" height="28" rx="3" fill="${esc(hex)}" stroke="#e3ddd0" stroke-width="1"/>`);
  });
  // DNA 태그 (칩)
  let x = 28; const y = 186;
  dna.slice(0, 6).forEach((tag) => {
    const w = 12 + esc(tag).length * 7;
    if (x + w > W - 28) return;
    s.push(`<rect x="${x}" y="${y}" width="${w}" height="22" rx="3" fill="#ffffff" stroke="#e3ddd0" stroke-width="1"/>`);
    s.push(`<text x="${x + w / 2}" y="${y + 15}" font-size="11" font-weight="600" fill="#14161c" text-anchor="middle">${esc(tag)}</text>`);
    x += w + 7;
  });
  // 본문 타이포 요약
  s.push(`<text x="28" y="238" font-size="12" fill="#5b606e">${esc(body.family || '')} · ${esc(body.size || '')}px · ${data.theme.isDark ? (state.LANG === 'ko' ? '다크' : 'Dark') : (state.LANG === 'ko' ? '라이트' : 'Light')}</text>`);
  // 지문 코드 (풋터)
  s.push(`<line x1="28" y1="256" x2="${W - 28}" y2="256" stroke="#e3ddd0" stroke-width="1"/>`);
  s.push(`<text x="28" y="280" font-size="13" font-weight="700" letter-spacing="1" fill="#14161c">${esc(fp)}</text>`);
  s.push(`<text x="${W - 28}" y="280" font-size="11" fill="#5b606e" text-anchor="end">${state.LANG === 'ko' ? '디자인 지문' : 'design fingerprint'}</text>`);
  s.push('</svg>');
  return s.join('\n');
}


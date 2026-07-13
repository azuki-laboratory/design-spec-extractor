// generator/doc.js — DESIGN.md 조립 (섹션 1~11) (ESM)
import { state, T, buildColorTokens, makeColorRef, buildSpacingTokens, buildRadiusTokens, buildTypeTokens, buildFrontmatter, describeMood, keyCharacteristics, detectTypeScale, detectSpacingBase, contrast } from './core.js';
import { computeDNA, computeLint } from './signature.js';

export function generate(data, lang) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const colorRef = makeColorRef(tokens);
  const spacing = buildSpacingTokens(data);
  const radius = buildRadiusTokens(data);
  const typeRoles = buildTypeTokens(data);

  const L = [];
  const push = (...s) => L.push(...s);

  push(...buildFrontmatter(data, tokens, typeRoles, radius, spacing, colorRef));
  push('');
  push(`# DESIGN.md — ${data.meta.title || data.meta.url}`);
  push('');
  if (data.meta.sources && data.meta.sources.length > 1) {
    push(T(`> Sources (${data.meta.sources.length} pages merged):`, `> 원본 (${data.meta.sources.length}개 페이지 병합):`));
    data.meta.sources.forEach((s) => push(`> - ${s}`));
  } else {
    push(T(`> Source: ${data.meta.url}`, `> 원본: ${data.meta.url}`));
  }
  push(T(`> Analyzed: ${data.meta.analyzedAt} · ${data.meta.elementsScanned} elements · viewport ${data.meta.viewport.width}×${data.meta.viewport.height}`,
         `> 분석: ${data.meta.analyzedAt} · 요소 ${data.meta.elementsScanned}개 · 뷰포트 ${data.meta.viewport.width}×${data.meta.viewport.height}`));
  push('');

  /* 1. 시각적 테마 및 분위기 */
  push(T('## 1. Visual Theme & Atmosphere', '## 1. 시각적 테마 및 분위기 (Visual Theme & Atmosphere)'));
  push('');
  push(T(`- **Theme type**: ${data.theme.isDark ? 'Dark theme' : 'Light theme'} (page background \`${data.theme.pageBackground}\`)`,
         `- **테마 유형**: ${data.theme.isDark ? '다크 테마' : '라이트 테마'} (페이지 배경 \`${data.theme.pageBackground}\`)`));
  push(T(`- **Mood**: ${describeMood(data, tokens)}`, `- **분위기**: ${describeMood(data, tokens)}`));
  push('');
  push('**Key Characteristics:**');
  keyCharacteristics(data, tokens, spacing, radius).forEach((c) => push(`- ${c}`));
  push('');
  const dnaTags = computeDNA(data);
  if (dnaTags.length) { push(T(`**Design DNA:** ${dnaTags.join(' · ')}`, `**디자인 DNA:** ${dnaTags.join(' · ')}`)); push(''); }

  /* 2. 컬러 팔레트 및 역할 */
  push(T('## 2. Color Palette & Roles', '## 2. 컬러 팔레트 및 역할 (Color Palette & Roles)'));
  push('');
  ['Brand & Accent', 'Semantic', 'Surface', 'Text'].forEach((group) => {
    const gts = tokens.filter((t) => t.group === group);
    if (!gts.length) return;
    push(`### ${group}`);
    gts.forEach((t) => push(`- **\`{colors.${t.name}}\`** — \`${t.hex}\`: ${t.note}`));
    push('');
  });
  const extraBgs = (data.colors.backgrounds || []).slice(0, 6).map((b) => `\`${b.hex}\``).join(', ');
  if (extraBgs) push(T(`**Background colors (area-weighted, top)**: ${extraBgs}`, `**배경색 사용 빈도(면적 가중 상위)**: ${extraBgs}`));
  const extraTxts = (data.colors.texts || []).slice(0, 6).map((t) => `\`${t.hex}\``).join(', ');
  if (extraTxts) push(T(`**Top text colors**: ${extraTxts}`, `**텍스트 색 상위**: ${extraTxts}`));
  const grads = data.colors.gradients || [];
  if (grads.length) {
    push('');
    push(T('### Gradients', '### 그라디언트'));
    grads.forEach((g) => push(T(`- \`${g.gradient}\` (${g.count}×)`, `- \`${g.gradient}\` (${g.count}회)`)));
  }
  if (data.darkVars && data.darkVars.length) {
    push('');
    push(T('### Dark Mode Palette (`prefers-color-scheme: dark` overrides)', '### 다크 모드 팔레트 (`prefers-color-scheme: dark` 재정의)'));
    push('```css');
    data.darkVars.slice(0, 30).forEach((v) => push(`${v.name}: ${v.value};`));
    push('```');
  }
  if (data.cssVars && data.cssVars.length) {
    push('');
    push(T('<details><summary>Site-defined CSS custom properties (original design tokens)</summary>', '<details><summary>사이트가 정의한 CSS 커스텀 프로퍼티 (원본 디자인 토큰)</summary>'));
    push('');
    push('```css');
    data.cssVars.slice(0, 40).forEach((v) => push(`${v.name}: ${v.value};`));
    push('```');
    push('</details>');
  }
  push('');

  /* 3. 타이포그래피 */
  push(T('## 3. Typography Rules', '## 3. 타이포그래피 규칙 (Typography Rules)'));
  push('');
  const fams = (data.typography.families || []).map((f) => `\`${f.family}\``).join(' > ');
  push(T(`- **Font families (by usage)**: ${fams || 'not detected'}`, `- **폰트 패밀리 (사용 빈도순)**: ${fams || '감지 실패'}`));
  const ff = data.fontFaces || [];
  if (ff.length) {
    push(T('- **Loaded web fonts (`@font-face`)**:', '- **로드된 웹폰트 (`@font-face`)**:'));
    ff.slice(0, 12).forEach((f) => {
      const bits = [`weight ${f.weight}`, f.style !== 'normal' ? f.style : null, f.format ? `${f.format}` : null, f.display ? `display:${f.display}` : null].filter(Boolean).join(', ');
      push(`  - \`${f.family}\` — ${bits}${f.url ? ` · \`${f.url}\`` : ''}`);
    });
  }
  push('');
  push(T('| Element | Size | Weight | Line height | Letter spacing | Token | Use |', '| 요소 | 크기 | 굵기 | 행간 | 자간 | 토큰 | 용도 |'));
  push('|------|------|------|------|------|------|------|');
  typeRoles.forEach((r) =>
    push(`| ${r.el} | ${r.size}px | ${r.weight} | ${r.lineHeight} | ${r.letterSpacing} | \`{typography.${r.token}}\` | ${r.use} |`));
  push('');
  const sizes = (data.typography.sizes || []).map((s) => `${s.px}px`).join(', ');
  push(T(`- **Type scale in use**: ${sizes}`, `- **실사용 타입 스케일**: ${sizes}`));
  const scaleInfo = detectTypeScale(data);
  if (scaleInfo) push(T(`- **Detected scale ratio**: ≈${scaleInfo.ratio} (${scaleInfo.name})`, `- **감지된 스케일 비율**: ≈${scaleInfo.ratio} (${scaleInfo.name})`));
  const weights = (data.typography.weights || []).map((w) => w.weight).join(', ');
  push(T(`- **Weights used**: ${weights}`, `- **사용 굵기**: ${weights}`));
  push('');
  push('**Principles:**');
  push(T(`- Body defaults to \`{typography.body}\` (${data.typography.body.size}px). Do not create sizes outside the scale.`, `- 본문은 \`{typography.body}\` (${data.typography.body.size}px) 기본. 스케일 밖 크기를 만들지 않는다.`));
  const h1 = typeRoles.find((r) => r.el === 'H1');
  if (h1 && String(h1.letterSpacing).startsWith('-')) push(T(`- Keep the negative letter-spacing (${h1.letterSpacing}) on large headings — this site's typographic signature.`, `- 대형 제목의 음수 자간(${h1.letterSpacing})을 유지한다 — 이 사이트의 타이포 시그니처.`));
  if ((data.typography.weights || []).length <= 3) push(T(`- Use only these weights: ${weights} — do not introduce new weights.`, `- 굵기는 ${weights} 만 사용 — 새 굵기 도입 금지.`));
  push('');

  /* 4. 컴포넌트 스타일링 */
  push(T('## 4. Component Styling', '## 4. 컴포넌트 스타일링 (Component Stylings)'));
  push('');
  const btns = data.components.buttons || [];
  if (btns.length) {
    btns.slice(0, 2).forEach((b, i) => {
      push(`### \`button-${i === 0 ? 'primary' : 'secondary'}\`${b.sample ? T(` (e.g. "${b.sample}")`, ` (예: "${b.sample}")`) : ''}`);
      push(T(`- Background ${colorRef(b.style.background)}, text ${colorRef(b.style.color)}${b.height ? `, height ${b.height}px` : ''}`, `- 배경 ${colorRef(b.style.background)}, 텍스트 ${colorRef(b.style.color)}${b.height ? `, 높이 ${b.height}px` : ''}`));
      push('```css');
      push(`background: ${b.style.background};`);
      push(`color: ${b.style.color};`);
      push(`border: ${b.style.border};`);
      push(`border-radius: ${b.style.borderRadius};`);
      push(`padding: ${b.style.padding};`);
      push(`font-size: ${b.style.fontSize}; font-weight: ${b.style.fontWeight};`);
      if (b.style.boxShadow !== 'none') push(`box-shadow: ${b.style.boxShadow};`);
      if (b.style.transition !== 'none') push(`transition: ${b.style.transition};`);
      push('```');
      push('');
    });
  } else {
    push(T('_No button elements detected._', '_버튼 요소가 감지되지 않았습니다._'));
    push('');
  }
  if (data.components.input) {
    const s = data.components.input;
    push(T('### `text-input` — Input / Textarea / Select', '### `text-input` — 입력창 (Input / Textarea / Select)'));
    push(T(`- Background ${colorRef(s.background)}, text ${colorRef(s.color)}`, `- 배경 ${colorRef(s.background)}, 텍스트 ${colorRef(s.color)}`));
    push('```css');
    push(`background: ${s.background};`);
    push(`color: ${s.color};`);
    push(`border: ${s.border};`);
    push(`border-radius: ${s.borderRadius};`);
    push(`padding: ${s.padding};`);
    push(`font-size: ${s.fontSize};`);
    push('```');
    push('');
  }
  if (data.components.card) {
    const s = data.components.card;
    push(T('### `card` (inferred)', '### `card` (추정)'));
    push(T(`- Background ${colorRef(s.background)}`, `- 배경 ${colorRef(s.background)}`));
    push('```css');
    push(`background: ${s.background};`);
    push(`border: ${s.border};`);
    push(`border-radius: ${s.borderRadius};`);
    push(`padding: ${s.padding};`);
    if (s.boxShadow !== 'none') push(`box-shadow: ${s.boxShadow};`);
    push('```');
    push('');
  }
  if (data.components.nav) {
    const s = data.components.nav;
    push(T('### `nav-bar` — Navigation', '### `nav-bar` — 내비게이션'));
    push(T(`- Background ${colorRef(s.background)}, height ${s.height}px, position \`${s.position}\``, `- 배경 ${colorRef(s.background)}, 높이 ${s.height}px, position \`${s.position}\``));
    push('```css');
    push(`background: ${s.background};`);
    push(`padding: ${s.padding};`);
    if (s.boxShadow !== 'none') push(`box-shadow: ${s.boxShadow};`);
    push('```');
    push('');
  }
  if (data.components.badge) {
    const s = data.components.badge;
    push(T('### `badge` — Badge / Tag / Chip', '### `badge` — 배지 / 태그 / 칩'));
    push(T(`- Background ${colorRef(s.background)}, text ${colorRef(s.color)}`, `- 배경 ${colorRef(s.background)}, 텍스트 ${colorRef(s.color)}`));
    push('```css');
    push(`background: ${s.background};`);
    push(`color: ${s.color};`);
    push(`border-radius: ${s.borderRadius};`);
    push(`padding: ${s.padding};`);
    push(`font-size: ${s.fontSize};`);
    push('```');
    push('');
  }
  const fc = data.components.formControls;
  if (fc && (fc.checkbox || fc.radio || fc.select || fc.textarea || fc.range)) {
    const present = ['checkbox', 'radio', 'select', 'textarea', 'range'].filter((k) => fc[k]);
    push(T('### Form Controls', '### 폼 컨트롤'));
    push(T(`- **Present**: ${present.join(', ')}`, `- **사용 컨트롤**: ${present.join(', ')}`));
    if (fc.accent) push(T(`- **Accent color**: ${colorRef(fc.accent)}`, `- **강조색(accent)**: ${colorRef(fc.accent)}`));
    push('');
  }
  if (data.components.table) {
    const s = data.components.table;
    push(T('### `table`', '### `table` — 표'));
    push(T(`- border-collapse \`${s.borderCollapse}\`${s.cellPadding ? `, cell padding \`${s.cellPadding}\`` : ''}`, `- border-collapse \`${s.borderCollapse}\`${s.cellPadding ? `, 셀 패딩 \`${s.cellPadding}\`` : ''}`));
    if (s.cellBorder && s.cellBorder !== 'none') push(T(`- cell border: \`${s.cellBorder}\``, `- 셀 테두리: \`${s.cellBorder}\``));
    push('');
  }
  if (data.components.linkUnderline) {
    push(T('### Link Convention', '### 링크 관례'));
    push(T(`- Underline: \`${data.components.linkUnderline}\`${data.components.linkUnderline === 'none' ? ' — distinguished by {colors.link} color only' : ''}`, `- 밑줄: \`${data.components.linkUnderline}\`${data.components.linkUnderline === 'none' ? ' — {colors.link} 색상만으로 구분' : ''}`));
    push('');
  }
  const hov = data.components.hoverRules || [];
  if (hov.length) {
    push(T('### State Styles — :hover (from stylesheet)', '### 상태별 스타일 — :hover (스타일시트에서 추출)'));
    push('```css');
    hov.slice(0, 8).forEach((r) => push(`${r.selector} { ${r.css} }`));
    push('```');
    push('');
  }
  const foc = data.components.focusRules || [];
  if (foc.length) {
    push(T('### State Styles — :focus', '### 상태별 스타일 — :focus'));
    push('```css');
    foc.slice(0, 5).forEach((r) => push(`${r.selector} { ${r.css} }`));
    push('```');
    push('');
  }
  const jsHov = data.components.jsHoverDiffs || [];
  if (jsHov.length) {
    push(T('### State Styles — JS-driven hover (detected via event simulation)', '### 상태별 스타일 — JS 구동 hover (이벤트 시뮬레이션으로 감지)'));
    jsHov.forEach((h) => {
      push(`- **"${h.sample}"**: ${Object.entries(h.diff).map(([k, v]) => `${k}: \`${v.from}\` → \`${v.to}\``).join(', ')}`);
    });
    push('');
  }

  /* 5. 레이아웃 원칙 */
  push(T('## 5. Layout Principles', '## 5. 레이아웃 원칙 (Layout Principles)'));
  push('');
  if (spacing.length) {
    push('### Spacing System');
    push(T(`- **Tokens**: ${spacing.map((s) => `\`{spacing.${s.name}}\` ${s.px}px`).join(' · ')}`, `- **토큰**: ${spacing.map((s) => `\`{spacing.${s.name}}\` ${s.px}px`).join(' · ')}`));
    const sb = detectSpacingBase(data);
    if (sb) {
      push(T(`- **Base unit**: inferred as multiples of ${sb.base}px`, `- **기본 단위**: ${sb.base}px 배수 체계로 추정`));
      if (sb.off.length) push(T(`- **Off-grid values** (not multiples of ${sb.base}px): ${sb.off.map((v) => v + 'px').join(', ')} — cleanup recommended`, `- **그리드 이탈 값** (${sb.base}px 배수 아님): ${sb.off.map((v) => v + 'px').join(', ')} — 정리 권장`));
    }
    push('');
  }
  const gp = (data.layout.gaps || []).map((g) => `${g.px}px`).join(', ');
  push('### Grid & Container');
  push(T(`- **Layout method**: flex ${data.layout.flexCount} / grid ${data.layout.gridCount} containers — ${data.layout.flexCount >= data.layout.gridCount ? 'Flexbox-centered' : 'CSS Grid-centered'}`, `- **레이아웃 방식**: flex ${data.layout.flexCount} / grid ${data.layout.gridCount} 컨테이너 — ${data.layout.flexCount >= data.layout.gridCount ? 'Flexbox 중심' : 'CSS Grid 중심'}`));
  if (gp) push(`- **flex/grid gap**: ${gp}`);
  const cw = (data.layout.containerWidths || []).map((c) => `${c.px}px`).join(', ');
  if (cw) push(T(`- **Centered container max-width**: ${cw}`, `- **중앙 컨테이너 max-width**: ${cw}`));
  push('');
  push('### Whitespace Philosophy');
  const sp = data.layout.spacingScale || [];
  const large = sp.filter((s) => s.px >= 32).reduce((a, s) => a + s.count, 0);
  const small = sp.filter((s) => s.px < 16).reduce((a, s) => a + s.count, 0);
  push(large > small ? T('- Generous whitespace — large gaps between sections create breathing room. Do not pack content densely.', '- 넉넉한 여백 위주 — 섹션 간 큰 간격으로 호흡을 만든다. 콘텐츠를 빽빽하게 채우지 말 것.')
                     : T('- Dense layout — small spacing units dominate. Excessive whitespace would feel out of place.', '- 밀도 높은 레이아웃 — 작은 여백 단위가 지배적. 과도한 여백은 오히려 이질적.'));
  push('');

  /* 6. 깊이감 및 고도 */
  push(T('## 6. Depth & Elevation', '## 6. 깊이감 및 고도 (Depth & Elevation)'));
  push('');
  const sh = data.depth.shadows || [];
  if (sh.length) {
    push(T('| Level | Shadow | Usage |', '| Level | 그림자 | 사용 빈도 |'));
    push('|-------|--------|----------|');
    push(T('| 0 | None (flat) | Base surface |', '| 0 | 없음 (플랫) | 기본 표면 |'));
    sh.forEach((s, i) => push(T(`| ${i + 1} | \`${s.shadow}\` | ${s.count}× |`, `| ${i + 1} | \`${s.shadow}\` | ${s.count}회 |`)));
  } else {
    push(T('- No shadows — fully flat. Separation via color/borders only.', '- 그림자 미사용 — 완전 플랫. 구분은 색·테두리로만.'));
  }
  push('');
  if (radius.length) {
    push('### Border Radius Scale');
    push(T('| Token | Value |', '| 토큰 | 값 |'));
    push('|------|-----|');
    radius.forEach((r) => push(`| \`{rounded.${r.name}}\` | ${r.name === 'pill' ? '9999px' : r.px + 'px'} |`));
    push('');
  }
  const bwv = (data.depth.borderWidths || []).map((b) => b.px + 'px').join(', ');
  if (bwv) push(T(`- **Border widths**: ${bwv}`, `- **테두리 두께**: ${bwv}`));
  const opv = (data.depth.opacities || []).map((o) => o.value).join(', ');
  if (opv) push(T(`- **Opacity scale**: ${opv}`, `- **불투명도 스케일**: ${opv}`));
  const zx = (data.depth.zIndices || []).map((z) => z.z).join(', ');
  if (zx) push(T(`- **z-index layers**: ${zx}`, `- **z-index 레이어**: ${zx}`));
  const mo = data.motion || {};
  const tr = (mo.durations || data.depth.transitions || []).map((t) => t.duration).join(', ');
  if (tr) push(T(`- **Transition durations**: ${tr}`, `- **전환 지속시간**: ${tr}`));
  const ez = (mo.easings || []).map((e) => `\`${e.easing}\``).join(', ');
  if (ez) push(T(`- **Easing**: ${ez}`, `- **이징 함수**: ${ez}`));
  const anim = (mo.animations || []).map((a) => `\`${a.name}\``).join(', ');
  if (anim) push(T(`- **Animations**: ${anim}`, `- **애니메이션**: ${anim}`));
  push('');

  /* 7. Do's and Don'ts */
  push(T("## 7. Do's and Don'ts (Design Guardrails)", "## 7. Do's and Don'ts (디자인 가드레일)"));
  push('');
  const primary = tokens.find((t) => t.name === 'primary');
  const canvas = tokens.find((t) => t.name === 'canvas');
  const ink = tokens.find((t) => t.name === 'ink');
  push('### Do');
  if (primary) push(T(`- Use only {colors.primary} \`${primary.hex}\` for primary CTAs — one filled button per band.`, `- 주요 CTA에는 {colors.primary} \`${primary.hex}\` 만 사용한다 — 밴드당 하나의 filled 버튼.`));
  if (spacing.length) push(T(`- Choose spacing only from the defined tokens (${spacing.map((s) => s.px + 'px').join(', ')}).`, `- 여백은 정의된 토큰(${spacing.map((s) => s.px + 'px').join(', ')})에서만 선택한다.`));
  if (radius.length) push(T('- Use corner radii only within the `{rounded.*}` scale.', '- 모서리 반경은 `{rounded.*}` 스케일 내에서만 사용한다.'));
  if (fams) push(T(`- New text follows the ${(data.typography.families || [])[0]?.family} family and \`{typography.*}\` roles.`, `- 새 텍스트는 ${(data.typography.families || [])[0]?.family} 패밀리와 \`{typography.*}\` 역할을 따른다.`));
  if (ink && canvas) push(T(`- Keep text/background contrast at least 4.5:1 (current body ${contrast(ink.hex, canvas.hex).toFixed(1)}:1).`, `- 텍스트/배경 대비 최소 4.5:1 유지 (현재 본문 ${contrast(ink.hex, canvas.hex).toFixed(1)}:1).`));
  if (btns[0]?.height) push(T(`- Follow the existing button height of ${btns[0].height}px, and ensure ≥44px on mobile.`, `- 버튼 높이는 기존 ${btns[0].height}px 기준을 따르고, 모바일에서 44px 이상을 보장한다.`));
  push('');
  push("### Don't");
  push(T('- Do not add arbitrary colors outside the palette.', '- 팔레트 밖의 색상을 임의로 추가하지 않는다.'));
  push(data.theme.isDark ? T('- Do not break the dark theme with large light background areas.', '- 밝은 대형 배경 영역으로 다크 테마의 통일감을 깨지 않는다.') : T('- Do not break the light theme with large dark background areas.', '- 어두운 대형 배경 영역으로 라이트 테마의 통일감을 깨지 않는다.'));
  if (sh.length === 0) push(T('- Do not introduce new shadows — this is a flat style.', '- 그림자를 새로 도입하지 않는다 — 플랫 스타일이다.'));
  else if (sh.length <= 2) push(T('- Do not add shadows outside the defined Levels.', '- 정의된 Level 외의 그림자를 추가하지 않는다.'));
  push(T('- Do not use font sizes outside the type scale.', '- 타입 스케일에 없는 폰트 크기를 사용하지 않는다.'));
  if (primary) push(T('- Do not overuse {colors.primary} for large backgrounds or body text.', '- {colors.primary}를 넓은 배경 면적이나 본문 텍스트 색으로 남용하지 않는다.'));
  if (data.components.linkUnderline === 'none') push(T('- Do not add underlines to links — color-only distinction is the convention.', '- 링크에 밑줄을 추가하지 않는다 — 색으로만 구분하는 것이 관례.'));
  push('');

  // 접근성 대비 (WCAG) — 토큰 쌍의 대비비 계산, AA/AAA 판정
  const byName = (n) => tokens.find((t) => t.name === n)?.hex;
  const pairs = [
    ['ink', 'canvas', T('Body text', '본문 텍스트')],
    ['ink-mute', 'canvas', T('Secondary text', '보조 텍스트')],
    ['ink', 'canvas-soft', T('Body on secondary surface', '2차 표면 위 본문')],
    ['on-primary', 'primary', T('Primary button label', 'Primary 버튼 라벨')],
    ['link', 'canvas', T('Link', '링크')],
  ].map(([fg, bg, use]) => ({ fg: byName(fg), bg: byName(bg), fgN: fg, bgN: bg, use }))
   .filter((p) => p.fg && p.bg);
  if (pairs.length) {
    const verdict = (r) => r >= 7 ? 'AAA ✅' : r >= 4.5 ? 'AA ✅' : r >= 3 ? T('Large text only AA ⚠️', '큰 글자만 AA ⚠️') : 'FAIL ❌';
    push(T('### Accessibility Contrast (WCAG)', '### 접근성 대비 (WCAG Contrast)'));
    push('');
    push(T('| Use | Foreground | Background | Contrast | Verdict |', '| 용도 | 전경 | 배경 | 대비 | 판정 |'));
    push('|------|------|------|------|------|');
    pairs.forEach((p) => {
      const r = contrast(p.fg, p.bg);
      push(`| ${p.use} | \`{colors.${p.fgN}}\` | \`{colors.${p.bgN}}\` | ${r.toFixed(2)}:1 | ${verdict(r)} |`);
    });
    const fails = pairs.filter((p) => contrast(p.fg, p.bg) < 4.5);
    if (fails.length) {
      push('');
      push(T(`> ⚠️ ${fails.map((p) => p.use).join(', ')} — below the normal-text threshold (4.5:1). Color adjustment recommended.`, `> ⚠️ ${fails.map((p) => p.use).join(', ')} — 일반 텍스트 기준(4.5:1) 미달. 색 조정 권장.`));
    }
    push('');
  }

  /* 8. 반응형 동작 */
  push(T('## 8. Responsive Behavior', '## 8. 반응형 동작 (Responsive Behavior)'));
  push('');
  const bps = data.responsive.breakpoints || [];
  if (bps.length) {
    push(T('| Breakpoint | Media-query count |', '| 브레이크포인트 | 미디어쿼리 사용 횟수 |'));
    push('|----------------|--------------------|');
    bps.forEach((b) => push(`| ${b.px}px | ${b.count} |`));
    push('');
    const majors = bps.filter((b) => b.count >= Math.max(2, (bps[0].count || 1) * 0.2)).map((b) => b.px + 'px').join(', ');
    push(T(`- **Major breakpoints**: ${majors}`, `- **주요 브레이크포인트**: ${majors}`));
  } else {
    push(T('- Media-query extraction failed (possibly cross-origin CSS limits). Recommend conventional 640/768/1024/1280px.', '- 미디어쿼리 추출 실패 (교차 출처 CSS 제한 가능성). 관례인 640/768/1024/1280px 기준 권장.'));
  }
  push('');
  push(T('### Touch Targets', '### 터치 타깃'));
  if (btns[0]?.height) {
    push(T(`- Current button heights ${btns.slice(0, 2).map((b) => b.height + 'px').join(', ')} — keep ≥44×44px on mobile (WCAG).`, `- 현재 버튼 높이 ${btns.slice(0, 2).map((b) => b.height + 'px').join(', ')} — 모바일에서 44×44px 이상 유지 (WCAG).`));
  } else {
    push(T('- Keep mobile touch targets ≥44×44px (WCAG).', '- 모바일 터치 타깃 44×44px 이상 유지 (WCAG).'));
  }
  push('');
  push(T('### Scaling Strategy', '### 축소 전략'));
  push(data.layout.flexCount >= data.layout.gridCount ? T('- Flexbox-based — collapse to a single column via flex-direction switch/wrap', '- Flexbox 기반 — flex-direction 전환·wrap으로 단일 컬럼 축소') : T('- Grid-based — adapt by reducing grid-template-columns', '- Grid 기반 — grid-template-columns 축소로 대응'));
  if (cw) push(T(`- Below the desktop max width ${cw}, use a fluid layout`, `- 데스크톱 최대폭 ${cw} 이하에서는 유동(fluid) 레이아웃`));
  const h1r = typeRoles.find((r) => r.el === 'H1');
  if (h1r) push(T(`- Recommend stepping headings down from ${h1r.size}px to ~${Math.round(h1r.size * 0.7)}px on mobile`, `- 제목은 ${h1r.size}px에서 모바일 ~${Math.round(h1r.size * 0.7)}px로 계단식 축소 권장`));
  push('');

  /* 9. 에이전트 프롬프트 가이드 */
  push(T('## 9. Agent Prompt Guide', '## 9. 에이전트 프롬프트 가이드 (Agent Prompt Guide)'));
  push('');
  push(T('Use when directing an AI coding agent to work in this style. Reference the frontmatter tokens directly as `{colors.primary}`.', 'AI 코딩 에이전트에게 이 스타일로 작업시킬 때 사용. frontmatter의 토큰을 `{colors.primary}` 형식으로 직접 참조하라.'));
  push('');
  push(T('### System / Context Prompt', '### 시스템/컨텍스트 프롬프트'));
  push('```text');
  push(T("Strictly follow the design tokens in this document's frontmatter:", '이 문서 상단 frontmatter의 디자인 토큰을 엄격히 준수하라:'));
  push(T(`- Theme: ${data.theme.isDark ? 'dark' : 'light'} (background ${data.theme.pageBackground})`, `- 테마: ${data.theme.isDark ? '다크' : '라이트'} (배경 ${data.theme.pageBackground})`));
  tokens.slice(0, 7).forEach((t) => push(`- {colors.${t.name}}: ${t.hex}`));
  push(T(`- Body: {typography.body} = ${data.typography.body.family} ${data.typography.body.size}px / ${data.typography.body.lineHeight}`, `- 본문: {typography.body} = ${data.typography.body.family} ${data.typography.body.size}px / ${data.typography.body.lineHeight}`));
  if (spacing.length) push(T(`- Spacing: ${spacing.map((s) => `{spacing.${s.name}}=${s.px}px`).join(' ')}`, `- 여백: ${spacing.map((s) => `{spacing.${s.name}}=${s.px}px`).join(' ')}`));
  if (radius.length) push(T(`- Radius: ${radius.map((r) => `{rounded.${r.name}}=${r.name === 'pill' ? '9999' : r.px}px`).join(' ')}`, `- 반경: ${radius.map((r) => `{rounded.${r.name}}=${r.name === 'pill' ? '9999' : r.px}px`).join(' ')}`));
  if (sh.length) push(T(`- Shadow Level 1: ${sh[0].shadow}`, `- 그림자 Level 1: ${sh[0].shadow}`));
  if (bps.length) push(T(`- Breakpoints: ${bps.map((b) => b.px + 'px').join(', ')}`, `- 브레이크포인트: ${bps.map((b) => b.px + 'px').join(', ')}`));
  push(T('Do not create colors/spacing/sizes outside the tokens. When ambiguous, snap to the nearest token.', '토큰 밖의 색·여백·크기 생성 금지. 모호하면 가장 가까운 토큰으로 스냅.'));
  push('```');
  push('');
  push(T('### Task Prompts', '### 작업별 프롬프트'));
  push('');
  push(T('**Add a new component**', '**새 컴포넌트 추가**'));
  push('```text');
  push(T(`Build [component name] following the DESIGN.md tokens. CTA uses {colors.primary}${primary ? ` (${primary.hex})` : ''}, radius ${btns[0] ? btns[0].style.borderRadius : (radius[0] ? radius[0].px + 'px' : '8px')}, padding same as the existing button-primary.`,
         `DESIGN.md 토큰을 따르는 [컴포넌트명]을 만들어라. CTA는 {colors.primary}${primary ? ` (${primary.hex})` : ''}, 반경 ${btns[0] ? btns[0].style.borderRadius : (radius[0] ? radius[0].px + 'px' : '8px')}, 패딩은 기존 button-primary와 동일하게.`));
  push('```');
  push('');
  push(T('**Refactor an existing page**', '**기존 페이지 리팩토링**'));
  push('```text');
  push(T(`Refactor this page to the DESIGN.md tokens. Snap hardcoded colors to the nearest {colors.*}, spacing to {spacing.*}. Preserve the visual hierarchy (H1 ${h1r ? h1r.size + 'px' : ''} > body ${data.typography.body.size}px).`,
         `이 페이지를 DESIGN.md 토큰으로 리팩토링하라. 하드코딩 색상은 {colors.*} 중 가장 가까운 값으로, 여백은 {spacing.*}으로 스냅. 시각적 위계(H1 ${h1r ? h1r.size + 'px' : ''} > 본문 ${data.typography.body.size}px)는 유지.`));
  push('```');
  push('');
  push(T('**Responsive implementation**', '**반응형 구현**'));
  push('```text');
  push(T(`${bps.length ? 'Implement graceful scaling at the ' + bps.map((b) => b.px + 'px').join(', ') + ' breakpoints.' : 'Implement graceful scaling at 640/768/1024px.'} Single column on mobile, touch targets ≥44px.`,
         `${bps.length ? bps.map((b) => b.px + 'px').join(', ') + ' 브레이크포인트에서' : '640/768/1024px 기준으로'} 자연스럽게 축소되도록 구현하라. 모바일 단일 컬럼, 터치 타깃 44px 이상.`));
  push('```');
  push('');
  push('### Iteration Guide');
  push(T('1. Handle one component at a time.', '1. 한 번에 하나의 컴포넌트만 다룬다.'));
  push(T('2. Reference tokens by name — `{colors.primary}`, `{spacing.md}`, `{rounded.lg}`.', '2. 토큰을 이름으로 직접 참조한다 — `{colors.primary}`, `{spacing.md}`, `{rounded.lg}`.'));
  push(T('3. Add new variants as separate entries instead of modifying existing ones.', '3. 새 변형(variant)은 기존 항목 수정 대신 별도 항목으로 추가한다.'));
  push(T('4. When colors/sizes are ambiguous, the frontmatter token values always win.', '4. 색·크기가 모호하면 frontmatter의 토큰 값이 항상 우선이다.'));
  push('');

  /* 10. 디자인 린트 (Azuki 시그니처) */
  push(T('## 10. Design Lint (Azuki)', '## 10. 디자인 린트 (Azuki)'));
  push('');
  const lintIssues = computeLint(data);
  if (!lintIssues.length) {
    push(T('- ✅ No inconsistencies found — tokens are coherent.', '- ✅ 불일치 없음 — 토큰이 일관됩니다.'));
  } else {
    lintIssues.forEach((i) => push(`- ${i.level === 'warn' ? '⚠️' : 'ℹ️'} ${i.msg}`));
  }
  push('');

  /* 11. 접근성 & 자산 */
  const a11y = data.a11y;
  const icons = data.icons;
  if (a11y || icons) {
    push(T('## 11. Accessibility & Assets', '## 11. 접근성 & 자산 (Accessibility & Assets)'));
    push('');
    if (a11y) {
      if (a11y.headingOrder && a11y.headingOrder.length) {
        push(T(`- **Heading order**: ${a11y.headingOrder.join(' → ')}`, `- **제목 순서**: ${a11y.headingOrder.join(' → ')}`));
        if (a11y.h1Count !== 1) push(T(`  - ⚠️ ${a11y.h1Count} \`<h1>\` found — exactly one is recommended.`, `  - ⚠️ \`<h1>\` ${a11y.h1Count}개 — 페이지당 1개 권장.`));
      }
      if (a11y.imgTotal) push(T(`- **Image alt coverage**: ${a11y.imgAltCoverage}% (${a11y.imgTotal} images)`, `- **이미지 alt 커버리지**: ${a11y.imgAltCoverage}% (이미지 ${a11y.imgTotal}개)`));
      if (a11y.landmarks && a11y.landmarks.length) push(T(`- **Landmarks**: ${a11y.landmarks.join(', ')}`, `- **랜드마크**: ${a11y.landmarks.join(', ')}`));
      push(T(`- **\`<html lang>\` set**: ${a11y.langSet ? 'yes' : 'no'}`, `- **\`<html lang>\` 지정**: ${a11y.langSet ? '예' : '아니오'}`));
    }
    if (icons && icons.svgCount) {
      const sizes = (icons.commonSizes || []).map((s) => s.px + 'px').join(', ');
      push(T(`- **Inline SVG icons**: ${icons.svgCount}${sizes ? ` · common sizes ${sizes}` : ''}`, `- **인라인 SVG 아이콘**: ${icons.svgCount}개${sizes ? ` · 주 크기 ${sizes}` : ''}`));
    }
    push('');
  }

  push('---');
  push(T('_Auto-generated by Azuki (Design Spec Extractor). Includes heuristic estimates — verify primary/secondary detection._', '_Azuki (Design Spec Extractor)로 자동 생성. 휴리스틱 추정값 포함 — primary/secondary 판별은 검수 권장._'));

  return L.join('\n');
}

/* ---------- 토큰 파일 내보내기 (tokens.css / tokens.json) ---------- */
// DESIGN.md와 동일한 토큰 빌더를 재사용해 빌드 파이프라인용 산출물을 만든다.

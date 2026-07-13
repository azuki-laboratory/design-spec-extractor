// generator/exporters.js — tokens.css/json·merge·preview.html·tailwind·agent 프롬프트 (ESM)
import { state, T, htmlEsc, cssSafe, buildColorTokens, buildSpacingTokens, buildRadiusTokens, buildTypeTokens, rgbStrToHex, saturation } from './core.js';

export function exportTokens(data, lang) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const spacing = buildSpacingTokens(data);
  const radius = buildRadiusTokens(data);
  const typeRoles = buildTypeTokens(data);
  const sh = data.depth.shadows || [];
  const bps = data.responsive.breakpoints || [];

  /* tokens.css — CSS 커스텀 프로퍼티 */
  const css = [];
  css.push(T(`/* tokens.css — design tokens extracted from ${data.meta.url} */`, `/* tokens.css — ${data.meta.url} 에서 추출된 디자인 토큰 */`));
  css.push(T(`/* Generated: ${data.meta.analyzedAt} · Azuki (Design Spec Extractor) */`, `/* 생성: ${data.meta.analyzedAt} · Azuki (Design Spec Extractor) */`));
  css.push('');
  css.push(':root {');
  css.push('  /* colors */');
  tokens.forEach((t) => css.push(`  --color-${t.name}: ${t.hex};`));
  if (spacing.length) {
    css.push('');
    css.push('  /* spacing */');
    spacing.forEach((s) => css.push(`  --spacing-${s.name}: ${s.px}px;`));
  }
  if (radius.length) {
    css.push('');
    css.push('  /* border radius */');
    radius.forEach((r) => css.push(`  --radius-${r.name}: ${r.name === 'pill' ? '9999px' : r.px + 'px'};`));
  }
  css.push('');
  css.push('  /* typography */');
  const bodyRole = typeRoles.find((r) => r.token === 'body');
  if (bodyRole) {
    css.push(`  --font-family-base: "${bodyRole.family}";`);
    css.push(`  --font-size-base: ${bodyRole.size}px;`);
    css.push(`  --line-height-base: ${bodyRole.lineHeight};`);
  }
  typeRoles.filter((r) => r.token !== 'body').forEach((r) => {
    css.push(`  --font-size-${r.token}: ${r.size}px;`);
  });
  if (sh.length) {
    css.push('');
    css.push('  /* elevation */');
    sh.slice(0, 4).forEach((s, i) => css.push(`  --shadow-level-${i + 1}: ${s.shadow};`));
  }
  css.push('}');
  if (data.darkVars && data.darkVars.length) {
    css.push('');
    css.push(T('/* Site-defined dark-mode overrides (original variable names) */', '/* 사이트가 정의한 다크 모드 재정의 (원본 변수명 그대로) */'));
    css.push('@media (prefers-color-scheme: dark) {');
    css.push('  :root {');
    data.darkVars.slice(0, 30).forEach((v) => css.push(`    ${v.name}: ${v.value};`));
    css.push('  }');
    css.push('}');
  }
  if (bps.length) {
    css.push('');
    css.push(T("/* breakpoints (CSS vars can't be used in media queries, listed as comments) */", '/* breakpoints (미디어쿼리에서는 CSS 변수를 쓸 수 없어 주석으로 명시) */'));
    bps.forEach((b) => css.push(T(`/* @media (max-width: ${b.px}px) — used ${b.count}× */`, `/* @media (max-width: ${b.px}px) — 사용 ${b.count}회 */`)));
  }
  css.push('');

  /* tokens.json — W3C Design Tokens Community Group 포맷 */
  const json = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $description: T(`Extracted from ${data.meta.url} (${data.meta.analyzedAt})`, `${data.meta.url} 에서 추출 (${data.meta.analyzedAt})`),
    color: {},
    spacing: {},
    radius: {},
    typography: {},
    shadow: {},
    breakpoint: {},
  };
  tokens.forEach((t) => {
    json.color[t.name] = { $value: t.hex, $type: 'color', $description: t.note };
  });
  spacing.forEach((s) => { json.spacing[s.name] = { $value: `${s.px}px`, $type: 'dimension' }; });
  radius.forEach((r) => { json.radius[r.name] = { $value: r.name === 'pill' ? '9999px' : `${r.px}px`, $type: 'dimension' }; });
  typeRoles.forEach((r) => {
    json.typography[r.token] = {
      $type: 'typography',
      $value: {
        fontFamily: r.family,
        fontSize: `${r.size}px`,
        fontWeight: Number(r.weight) || r.weight,
        ...(r.lineHeight && r.lineHeight !== '—' ? { lineHeight: Number(r.lineHeight) || r.lineHeight } : {}),
        ...(r.letterSpacing && r.letterSpacing !== '—' && r.letterSpacing !== 'normal' ? { letterSpacing: r.letterSpacing } : {}),
      },
    };
  });
  sh.slice(0, 4).forEach((s, i) => {
    json.shadow[`level-${i + 1}`] = { $value: s.shadow, $type: 'shadow', $description: T(`used ${s.count}× (raw CSS)`, `사용 ${s.count}회 (CSS 원문)`) };
  });
  bps.forEach((b) => { json.breakpoint[`bp-${b.px}`] = { $value: `${b.px}px`, $type: 'dimension' }; });
  // 빈 그룹 제거
  Object.keys(json).forEach((k) => {
    if (typeof json[k] === 'object' && json[k] !== null && !Object.keys(json[k]).length) delete json[k];
  });

  return { css: css.join('\n'), json: JSON.stringify(json, null, 2) };
}

/* ---------- 멀티 페이지 병합 ---------- */
// 여러 페이지의 분석 결과를 단일 분석과 동일한 형태로 병합한다.
// 빈도 목록은 합산 후 재정렬, 단일 컴포넌트는 첫 번째 non-null을 채택.
export function merge(analyses) {
  if (!analyses.length) return null;
  if (analyses.length === 1) return analyses[0];
  const first = analyses[0];

  // {key: hex|px|..., 계수 필드} 목록 병합
  const mergeList = (lists, keyField, numFields, cap, sortBy) => {
    const map = new Map();
    lists.flat().filter(Boolean).forEach((item) => {
      const k = item[keyField];
      if (!map.has(k)) map.set(k, { ...item });
      else numFields.forEach((f) => { map.get(k)[f] = (map.get(k)[f] || 0) + (item[f] || 0); });
    });
    const arr = [...map.values()];
    arr.sort(sortBy || ((a, b) => (b[numFields[0]] || 0) - (a[numFields[0]] || 0)));
    return arr.slice(0, cap);
  };
  const byPx = (a, b) => a.px - b.px;
  const pick = (field) => analyses.map((a) => a.components[field]).find(Boolean) || null;

  // 버튼: 스타일 시그니처로 클러스터 병합 후 채도 우선 재정렬
  const btnMap = new Map();
  analyses.flatMap((a) => a.components.buttons || []).forEach((b) => {
    const k = `${b.style.background}|${b.style.color}|${b.style.borderRadius}|${b.style.border}`;
    if (!btnMap.has(k)) btnMap.set(k, { ...b });
    else btnMap.get(k).count += b.count;
  });
  const buttons = [...btnMap.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  buttons.sort((a, b) => {
    const s = (btn) => { const h = rgbStrToHex(btn.style.background); return h ? saturation(h) : -1; };
    return s(b) - s(a);
  });

  const dedupeRules = (field, cap) => {
    const seen = new Set();
    return analyses.flatMap((a) => a.components[field] || []).filter((r) => {
      if (seen.has(r.selector)) return false;
      seen.add(r.selector);
      return true;
    }).slice(0, cap);
  };
  const dedupeVars = (field) => {
    const seen = new Map();
    analyses.flatMap((a) => a[field] || []).forEach((v) => { if (!seen.has(v.name)) seen.set(v.name, v); });
    return [...seen.values()].slice(0, 60);
  };

  // 제목 스타일: 태그별 첫 번째 non-null
  const headings = {};
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach((tag) => {
    const found = analyses.map((a) => a.typography.headings?.[tag]).find(Boolean);
    if (found) headings[tag] = found;
  });

  return {
    meta: {
      ...first.meta,
      sources: analyses.map((a) => a.meta.url),
      elementsScanned: analyses.reduce((s, a) => s + a.meta.elementsScanned, 0),
    },
    theme: {
      // 다수결
      isDark: analyses.filter((a) => a.theme.isDark).length > analyses.length / 2,
      pageBackground: first.theme.pageBackground,
    },
    colors: {
      backgrounds: mergeList(analyses.map((a) => a.colors.backgrounds), 'hex', ['weight'], 8),
      texts: mergeList(analyses.map((a) => a.colors.texts), 'hex', ['count'], 8),
      borders: mergeList(analyses.map((a) => a.colors.borders), 'hex', ['count'], 5),
      links: mergeList(analyses.map((a) => a.colors.links), 'hex', ['count'], 3),
      gradients: mergeList(analyses.map((a) => a.colors.gradients), 'gradient', ['count'], 4),
    },
    typography: {
      families: mergeList(analyses.map((a) => a.typography.families), 'family', ['count'], 5),
      sizes: mergeList(analyses.map((a) => a.typography.sizes), 'px', ['count'], 12, byPx),
      weights: mergeList(analyses.map((a) => a.typography.weights), 'weight', ['count'], 6),
      headings,
      body: first.typography.body,
    },
    components: {
      buttons,
      input: pick('input'),
      card: pick('card'),
      nav: pick('nav'),
      badge: pick('badge'),
      table: pick('table'),
      formControls: (() => {
        const fcs = analyses.map((a) => a.components.formControls).filter(Boolean);
        if (!fcs.length) return null;
        return {
          checkbox: fcs.some((f) => f.checkbox),
          radio: fcs.some((f) => f.radio),
          select: fcs.some((f) => f.select),
          textarea: fcs.some((f) => f.textarea),
          range: fcs.some((f) => f.range),
          accent: (fcs.find((f) => f.accent) || {}).accent || null,
        };
      })(),
      linkUnderline: pick('linkUnderline'),
      hoverRules: dedupeRules('hoverRules', 20),
      focusRules: dedupeRules('focusRules', 10),
      jsHoverDiffs: analyses.flatMap((a) => a.components.jsHoverDiffs || []).slice(0, 3),
    },
    layout: {
      spacingScale: mergeList(analyses.map((a) => a.layout.spacingScale), 'px', ['count'], 14, byPx),
      gaps: mergeList(analyses.map((a) => a.layout.gaps), 'px', ['count'], 8, byPx),
      gridCount: analyses.reduce((s, a) => s + a.layout.gridCount, 0),
      flexCount: analyses.reduce((s, a) => s + a.layout.flexCount, 0),
      totalContainers: analyses.reduce((s, a) => s + a.layout.totalContainers, 0),
      containerWidths: mergeList(analyses.map((a) => a.layout.containerWidths), 'px', ['count'], 4),
    },
    depth: {
      shadows: mergeList(analyses.map((a) => a.depth.shadows), 'shadow', ['count'], 6),
      radii: mergeList(analyses.map((a) => a.depth.radii), 'px', ['count'], 8, byPx),
      zIndices: mergeList(analyses.map((a) => a.depth.zIndices), 'z', ['count'], 8, (a, b) => a.z - b.z),
      transitions: mergeList(analyses.map((a) => a.depth.transitions), 'duration', ['count'], 4),
      borderWidths: mergeList(analyses.map((a) => a.depth.borderWidths || []), 'px', ['count'], 5, byPx),
      opacities: mergeList(analyses.map((a) => a.depth.opacities || []), 'value', ['count'], 6, (a, b) => a.value - b.value),
    },
    motion: {
      durations: mergeList(analyses.map((a) => (a.motion && a.motion.durations) || []), 'duration', ['count'], 4),
      easings: mergeList(analyses.map((a) => (a.motion && a.motion.easings) || []), 'easing', ['count'], 4),
      animations: mergeList(analyses.map((a) => (a.motion && a.motion.animations) || []), 'name', ['count'], 6),
    },
    responsive: {
      breakpoints: mergeList(analyses.map((a) => a.responsive.breakpoints), 'px', ['count'], 8, byPx),
    },
    // 아이콘: 합산 svgCount + 크기 병합. a11y: 첫 페이지 대표값(멀티 시 평균 대신 대표).
    icons: {
      svgCount: analyses.reduce((s, a) => s + ((a.icons && a.icons.svgCount) || 0), 0),
      commonSizes: mergeList(analyses.map((a) => (a.icons && a.icons.commonSizes) || []), 'px', ['count'], 4, byPx),
    },
    a11y: first.a11y || null,
    cssVars: dedupeVars('cssVars'),
    darkVars: dedupeVars('darkVars'),
    fontFaces: (() => {
      const seen = new Set();
      return analyses.flatMap((a) => a.fontFaces || []).filter((f) => {
        const k = `${f.family}|${f.weight}|${f.style}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 30);
    })(),
  };
}

/* ---------- preview.html — 추출 토큰으로 만든 스타일 카탈로그 ---------- */
// 추출 정확도를 눈으로 검증하는 자기완결 HTML. 외부 리소스 없음.
export function exportPreview(data, lang) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const spacing = buildSpacingTokens(data);
  const radius = buildRadiusTokens(data);
  const typeRoles = buildTypeTokens(data);
  const sh = data.depth.shadows || [];
  const btns = (data.components.buttons || []).slice(0, 2);
  const esc = htmlEsc; // 텍스트/속성: 완전 이스케이프

  const canvas = cssSafe(tokens.find((t) => t.name === 'canvas')?.hex || '#ffffff');
  const ink = cssSafe(tokens.find((t) => t.name === 'ink')?.hex || '#111111');
  const hairline = cssSafe(tokens.find((t) => t.name === 'hairline')?.hex || '#dddddd');
  const bodyFam = cssSafe(data.typography.body.family);
  const bodySize = cssSafe(data.typography.body.size);
  const bodyLh = cssSafe(data.typography.body.lineHeight);

  const H = [];
  H.push(`<!DOCTYPE html><html lang="${state.LANG}"><head><meta charset="UTF-8">`);
  H.push(`<title>Preview — ${esc(data.meta.title || data.meta.url)}</title>`);
  H.push('<style>');
  H.push(`body{background:${canvas};color:${ink};font-family:"${bodyFam}",sans-serif;font-size:${bodySize}px;line-height:${bodyLh};margin:0;padding:40px;max-width:960px;margin-inline:auto}`);
  H.push(`section{margin-bottom:48px}h2.pv{font-size:14px;text-transform:uppercase;letter-spacing:1px;opacity:.55;border-bottom:1px solid ${hairline};padding-bottom:8px}`);
  H.push('.sw{display:inline-block;width:150px;margin:0 12px 12px 0;vertical-align:top;font-size:12px}.sw i{display:block;height:56px;border-radius:8px;border:1px solid rgba(128,128,128,.25)}');
  H.push('.chips span{display:inline-block;background:rgba(128,128,128,.12);margin:0 8px 8px 0;text-align:center;font-size:11px;line-height:2.2}');
  H.push('.shadow-box{display:inline-block;width:140px;height:80px;border-radius:10px;margin:0 16px 16px 0;background:inherit;font-size:11px;padding:8px}');
  H.push('</style></head><body>');
  H.push(`<p style="opacity:.6;font-size:13px">${T('Azuki extraction preview', 'Azuki 추출 미리보기')} · ${esc(data.meta.url)} · ${esc(data.meta.analyzedAt)}</p>`);

  H.push('<section><h2 class="pv">Colors</h2>');
  tokens.forEach((t) => {
    H.push(`<div class="sw"><i style="background:${cssSafe(t.hex)}"></i><b>${esc(t.name)}</b><br>${esc(t.hex)}</div>`);
  });
  H.push('</section>');

  H.push('<section><h2 class="pv">Typography</h2>');
  typeRoles.forEach((r) => {
    H.push(`<div style="font-family:'${cssSafe(r.family)}';font-size:${cssSafe(r.size)}px;font-weight:${cssSafe(r.weight)};margin-bottom:8px">${esc(r.token)} — ${esc(r.size)}px / ${esc(r.weight)}</div>`);
  });
  H.push('</section>');

  if (btns.length || data.components.input || data.components.card) {
    H.push('<section><h2 class="pv">Components</h2>');
    btns.forEach((b, i) => {
      const st = b.style;
      H.push(`<button style="background:${cssSafe(st.background)};color:${cssSafe(st.color)};border:${cssSafe(st.border)};border-radius:${cssSafe(st.borderRadius)};padding:${cssSafe(st.padding)};font-size:${cssSafe(st.fontSize)};font-weight:${cssSafe(st.fontWeight)};${st.boxShadow !== 'none' ? `box-shadow:${cssSafe(st.boxShadow)};` : ''}margin-right:12px;cursor:pointer">button-${i === 0 ? 'primary' : 'secondary'}</button>`);
    });
    if (data.components.input) {
      const st = data.components.input;
      H.push(`<input placeholder="text-input" style="background:${cssSafe(st.background)};color:${cssSafe(st.color)};border:${cssSafe(st.border)};border-radius:${cssSafe(st.borderRadius)};padding:${cssSafe(st.padding)};font-size:${cssSafe(st.fontSize)};margin-left:4px">`);
    }
    if (data.components.card) {
      const st = data.components.card;
      H.push(`<div style="background:${cssSafe(st.background)};border:${cssSafe(st.border)};border-radius:${cssSafe(st.borderRadius)};padding:${cssSafe(st.padding)};${st.boxShadow !== 'none' ? `box-shadow:${cssSafe(st.boxShadow)};` : ''}max-width:320px;margin-top:20px"><b>card</b><p style="margin:.5em 0 0;opacity:.7">${T('Reproduced extracted card style.', '추출된 카드 스타일 재현.')}</p></div>`);
    }
    H.push('</section>');
  }

  if (spacing.length || radius.length) {
    H.push('<section><h2 class="pv">Spacing &amp; Radius</h2><div class="chips">');
    spacing.forEach((s) => H.push(`<span style="width:${Math.max(s.px * 2, 34)}px">${esc(s.name)} ${esc(s.px)}</span>`));
    H.push('</div><div class="chips">');
    radius.forEach((r) => H.push(`<span style="width:72px;border-radius:${r.name === 'pill' ? '9999px' : cssSafe(r.px) + 'px'};border:1px solid ${hairline}">${esc(r.name)}</span>`));
    H.push('</div></section>');
  }

  if (sh.length) {
    H.push('<section><h2 class="pv">Elevation</h2>');
    sh.slice(0, 4).forEach((s, i) => H.push(`<div class="shadow-box" style="box-shadow:${cssSafe(s.shadow)}">Level ${i + 1}</div>`));
    H.push('</section>');
  }

  H.push('</body></html>');
  return H.join('\n');
}

/* ---------- tailwind.config.js 내보내기 ---------- */
export function exportTailwind(data, lang) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const spacing = buildSpacingTokens(data);
  const radius = buildRadiusTokens(data);
  const typeRoles = buildTypeTokens(data);
  const bps = data.responsive.breakpoints || [];
  const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
  const L = [];
  L.push(T(`// tailwind.config.js — extracted from ${data.meta.url} (${data.meta.analyzedAt})`, `// tailwind.config.js — ${data.meta.url} 추출 (${data.meta.analyzedAt})`));
  L.push(T('// Azuki (Design Spec Extractor). Merge into theme.extend.', '// Azuki (Design Spec Extractor). theme.extend 에 병합해 사용.'));
  L.push('/** @type {import("tailwindcss").Config} */');
  L.push('module.exports = {');
  L.push('  theme: {');
  L.push('    extend: {');
  L.push('      colors: {');
  tokens.forEach((t) => L.push(`        ${q(t.name)}: ${q(t.hex)},`));
  L.push('      },');
  if (spacing.length) {
    L.push('      spacing: {');
    spacing.forEach((s) => L.push(`        ${q(s.name)}: ${q(s.px + 'px')},`));
    L.push('      },');
  }
  if (radius.length) {
    L.push('      borderRadius: {');
    radius.forEach((r) => L.push(`        ${q(r.name)}: ${q(r.name === 'pill' ? '9999px' : r.px + 'px')},`));
    L.push('      },');
  }
  L.push('      fontSize: {');
  typeRoles.forEach((r) => L.push(`        ${q(r.token)}: ${q(r.size + 'px')},`));
  L.push('      },');
  const bodyFam = data.typography.body.family;
  if (bodyFam) {
    L.push('      fontFamily: {');
    L.push(`        base: [${q(bodyFam)}, 'sans-serif'],`);
    L.push('      },');
  }
  if (bps.length) {
    L.push('      screens: {');
    bps.forEach((b) => L.push(`        ${q('bp' + b.px)}: ${q(b.px + 'px')},`));
    L.push('      },');
  }
  L.push('    },');
  L.push('  },');
  L.push('};');
  return L.join('\n');
}

/* ---------- Azuki 시그니처: 디자인 DNA ---------- */
// 팔레트·대비·타이포·간격·반경을 짧은 특성 태그로 요약 (브랜드 지문).
export function exportAgentPrompt(data, lang) {
  state.LANG = lang === 'ko' ? 'ko' : 'en';
  const tokens = buildColorTokens(data);
  const spacing = buildSpacingTokens(data);
  const radius = buildRadiusTokens(data);
  const sh = data.depth.shadows || [];
  const bps = data.responsive.breakpoints || [];
  const P = [];
  P.push(T('You are building UI in the design system below. Follow these tokens strictly — do not invent colors, spacing, or sizes outside them. When unsure, snap to the nearest token.',
           '아래 디자인 시스템으로 UI를 만든다. 토큰을 엄격히 따르고, 토큰 밖의 색·여백·크기를 만들지 마라. 모호하면 가장 가까운 토큰으로 스냅.'));
  P.push('');
  P.push(T(`Theme: ${data.theme.isDark ? 'dark' : 'light'} (background ${data.theme.pageBackground})`, `테마: ${data.theme.isDark ? '다크' : '라이트'} (배경 ${data.theme.pageBackground})`));
  P.push('Colors:');
  tokens.forEach((t) => P.push(`  ${t.name}: ${t.hex}`));
  P.push(`Body: ${data.typography.body.family} ${data.typography.body.size}px / ${data.typography.body.lineHeight}`);
  if (spacing.length) P.push('Spacing: ' + spacing.map((s) => `${s.name}=${s.px}px`).join(' '));
  if (radius.length) P.push('Radius: ' + radius.map((r) => `${r.name}=${r.name === 'pill' ? '9999' : r.px}px`).join(' '));
  if (sh.length) P.push('Shadow-1: ' + sh[0].shadow);
  if (bps.length) P.push('Breakpoints: ' + bps.map((b) => b.px + 'px').join(', '));
  P.push('');
  P.push(T('Task: <describe the component or page to build>', '작업: <만들 컴포넌트/페이지를 여기 적기>'));
  return P.join('\n');
}

/* ---------- Azuki 시그니처: 디자인 지문(Fingerprint) ---------- */
// 팔레트·타이포·간격·반경·브레이크포인트로부터 결정적 짧은 코드 생성.
// 두 사이트가 같은 디자인 시스템을 쓰는지 한눈에 대조 가능. (Date/random 미사용 — 결정적)

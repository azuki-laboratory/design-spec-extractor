// generator/core.js — 공유 상태 + 색상/토큰/스케일/무드/frontmatter 엔진 (ESM)

export const state = { LANG: 'en' };
export const T = (en, ko) => (state.LANG === 'ko' ? ko : en);

/* ---------- 보안: 페이지 유래 값 살균 ----------
   분석 대상은 신뢰할 수 없는(악성 가능) 페이지다. 추출값을 preview.html/passport.svg에
   삽입할 때 반드시 살균한다. preview.html은 blob(=확장 origin)으로 열리므로 XSS 시 확장 권한 위험. */
export const htmlEsc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
// CSS 값 화이트리스트 (색/치수/폰트명/그림자만 허용, < " ' { } ; \ 등 차단)
export const cssSafe = (v) => String(v == null ? '' : v).replace(/[^a-zA-Z0-9#(),.%/\s_-]/g, '').slice(0, 300);

/* ---------- 색상 헬퍼 ---------- */
export function hexToRgb(hex) {
  const m = hex.match(/^#(..)(..)(..)$/);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
export function luminance(hex) {
  const c = hexToRgb(hex);
  if (!c) return 0;
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
export function saturation(hex) {
  const c = hexToRgb(hex);
  if (!c) return 0;
  const max = Math.max(c.r, c.g, c.b) / 255, min = Math.min(c.r, c.g, c.b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2, d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}
export function contrast(h1, h2) {
  const l1 = luminance(h1), l2 = luminance(h2);
  return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
}
export function rgbStrToHex(str) {
  if (!str) return null;
  if (str[0] === '#') return str;
  // 알파 포함 매치 — 거의 투명한 색(투명 배경 버튼 등)은 "색 없음"이므로 null.
  const m = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/);
  if (!m) return null;
  if (m[4] !== undefined) {
    let a = parseFloat(m[4]);
    if (String(m[4]).includes('%')) a /= 100;
    if (a < 0.05) return null;
  }
  const h = (n) => Math.round(+n).toString(16).padStart(2, '0');
  return '#' + h(m[1]) + h(m[2]) + h(m[3]);
}
export function hueName(hex) {
  const c = hexToRgb(hex);
  if (!c) return T('achromatic', '무채색');
  if (saturation(hex) < 0.12) {
    const l = luminance(hex);
    return l > 0.8 ? T('light achromatic', '밝은 무채색') : l < 0.1 ? T('dark achromatic', '어두운 무채색') : T('grayish', '회색 계열');
  }
  const { r, g, b } = c;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  if (h < 15 || h >= 345) return T('red', '레드');
  if (h < 45) return T('orange', '오렌지');
  if (h < 70) return T('yellow', '옐로우');
  if (h < 160) return T('green', '그린');
  if (h < 200) return T('cyan/teal', '시안/틸');
  if (h < 255) return T('blue', '블루');
  if (h < 290) return T('purple', '퍼플');
  return T('pink/magenta', '핑크/마젠타');
}

/* ---------- 색상 클러스터링 & 시맨틱 ---------- */
// 지각적으로 가까운 색을 병합해 팔레트 파편화를 막는다.
// (예: #ffffff / #fefefe / #fdfdfd 는 하나의 canvas로 합쳐야 함)
export function rgbDist(h1, h2) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  if (!a || !b) return Infinity;
  // 밝기 가중 유클리드 근사 (지각 거리)
  const rm = (a.r + b.r) / 2;
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
// list: [{hex, <weightField>}] → near-dupe 병합, 가중치 합산, 최다 가중 대표색 유지
export function clusterColors(list, weightField, threshold = 24) {
  const clusters = [];
  for (const item of list || []) {
    const w = item[weightField] || 0;
    let hit = null;
    // 거리 비교는 고정 앵커(anchor) 기준 — 대표색이 이동해도 병합 경계가 흐르지 않음(leader 클러스터링)
    for (const c of clusters) {
      if (rgbDist(c.anchor, item.hex) <= threshold) { hit = c; break; }
    }
    if (hit) {
      hit.total += w;
      if (w > hit.topW) { hit.hex = item.hex; hit.topW = w; } // 표시 대표색 = 최다 가중
    } else {
      clusters.push({ anchor: item.hex, hex: item.hex, total: w, topW: w });
    }
  }
  return clusters.sort((a, b) => b.total - a.total)
    .map((c) => ({ hex: c.hex, [weightField]: c.total }));
}
export function hueDeg(hex) {
  const c = hexToRgb(hex);
  if (!c || saturation(hex) < 0.15) return -1; // 무채색
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}
// 유채색을 status 역할로 매핑 (없으면 null)
export function semanticRole(hex) {
  const h = hueDeg(hex);
  if (h < 0) return null;
  if (h < 18 || h >= 345) return 'danger';   // 레드
  if (h >= 90 && h < 160) return 'success';   // 그린
  if (h >= 35 && h < 60) return 'warning';    // 앰버
  if (h >= 195 && h < 240) return 'info';     // 블루
  return null;
}

/* ---------- 시맨틱 컬러 토큰 ---------- */
// 역할별 토큰 이름 부여. awesome-design-md 관례:
// canvas(배경) / ink(텍스트) / primary(브랜드) / hairline(테두리) 등.
// data별 + 언어별 메모이즈 — 5개 내보내기가 같은 data로 각각 호출하므로 clusterColors 반복 실행 방지.
// note 텍스트가 언어별로 다르므로 state.LANG를 캐시 키에 포함.
export const _colorMemo = new WeakMap();
export function buildColorTokens(data) {
  let perLang = _colorMemo.get(data);
  if (!perLang) { perLang = {}; _colorMemo.set(data, perLang); }
  if (perLang[state.LANG]) return perLang[state.LANG];
  const result = buildColorTokensImpl(data);
  perLang[state.LANG] = result;
  return result;
}
export function buildColorTokensImpl(data) {
  const tokens = []; // { name, hex, group, note }
  const used = new Set();
  const add = (name, hex, group, note) => {
    if (!hex || used.has(hex)) return false;
    tokens.push({ name, hex, group, note });
    used.add(hex);
    return true;
  };

  // near-dupe 병합 후 역할 배정 (파편화된 흰색/회색 계열을 하나로)
  const bgList = clusterColors(data.colors.backgrounds, 'weight');
  const txtList = clusterColors(data.colors.texts, 'count');

  add('canvas', bgList[0]?.hex, 'Surface', T('Page base background. Largest area', '페이지 기본 배경. 가장 넓은 면적'));
  const soft = bgList.find((b) => !used.has(b.hex) && saturation(b.hex) < 0.15);
  if (soft) add('canvas-soft', soft.hex, 'Surface', T('Secondary surface (cards, section bands)', '카드·섹션 밴드 등 2차 표면'));

  const canvas = tokens.find((t) => t.name === 'canvas')?.hex;
  const ink = txtList[0]?.hex;
  add('ink', ink, 'Text', T('Default body text', '기본 본문 텍스트') + (canvas ? T(` — contrast vs background ${contrast(ink, canvas).toFixed(1)}:1`, ` — 배경 대비 ${contrast(ink, canvas).toFixed(1)}:1`) : ''));
  const mute = txtList.find((t) => !used.has(t.hex) && saturation(t.hex) < 0.2);
  if (mute) add('ink-mute', mute.hex, 'Text', T('Secondary text, captions, helpers', '보조 텍스트, 캡션, 헬퍼'));

  // primary 선정: 버튼 배경을 (유채도 × 등장 빈도)로 점수화, 최고점 채택. 없으면 링크색.
  const btns = data.components.buttons || [];
  const btnScored = btns
    .map((b) => ({ hex: rgbStrToHex(b.style.background), count: b.count || 1, btn: b }))
    .filter((x) => x.hex && !used.has(x.hex) && saturation(x.hex) > 0.15)
    .sort((a, b) => (saturation(b.hex) * Math.log2(b.count + 1)) - (saturation(a.hex) * Math.log2(a.count + 1)));
  const primaryPick = btnScored[0];
  const primary = primaryPick?.hex || data.colors.links?.[0]?.hex;
  if (primary && !used.has(primary)) {
    add('primary', primary, 'Brand & Accent', T(`Primary CTA/action. ${hueName(primary)} family — use sparingly`, `주요 CTA·액션. ${hueName(primary)} 계열 — 절제해서 사용`));
    const onPrimary = primaryPick ? rgbStrToHex(primaryPick.btn.style.color) : null;
    if (onPrimary) add('on-primary', onPrimary, 'Brand & Accent', T('Text on primary surface', 'primary 표면 위 텍스트'));
    // secondary 버튼이 별도 유채색이면 accent 후보
    const second = btnScored[1];
    if (second && rgbDist(second.hex, primary) > 40) {
      add('primary-alt', second.hex, 'Brand & Accent', T(`Secondary action button. ${hueName(second.hex)} family`, `보조 액션 버튼. ${hueName(second.hex)} 계열`));
    }
  }
  const link = data.colors.links?.[0]?.hex;
  if (link && (!primary || rgbDist(link, primary) > 24)) add('link', link, 'Brand & Accent', T('Inline links, emphasis', '인라인 링크, 강조'));

  const border = clusterColors(data.colors.borders, 'count')[0]?.hex;
  if (border) add('hairline', border, 'Surface', T('1px dividers/borders', '1px 구분선·테두리'));

  // 시맨틱 상태색: 배경·테두리·텍스트 유채색 중 status 색상(레드/그린/앰버/블루) 감지
  const semanticSeen = new Set();
  const candidates = [
    ...clusterColors(data.colors.backgrounds, 'weight'),
    ...(data.colors.borders || []),
    ...(data.colors.texts || []),
  ];
  // 이미 배정된 토큰과 육안상 근접한 색은 시맨틱으로 중복 배정하지 않음
  const nearUsed = (hex) => [...used].some((u) => rgbDist(u, hex) <= 24);
  candidates.forEach((c) => {
    // status 색은 보통 선명함 — 낮은 채도의 슬레이트/그레이 오탐 방지
    if (saturation(c.hex) < 0.4) return;
    const role = semanticRole(c.hex);
    if (role && !semanticSeen.has(role) && !used.has(c.hex) && !nearUsed(c.hex)) {
      semanticSeen.add(role);
      const label = {
        danger: T('Error/Delete', '오류/삭제'),
        success: T('Success/Confirm', '성공/확인'),
        warning: T('Warning/Caution', '경고/주의'),
        info: T('Info/Link', '정보/링크'),
      }[role];
      add(role, c.hex, 'Semantic', T(`${label} status color (${hueName(c.hex)})`, `${label} 상태색 (${hueName(c.hex)})`));
    }
  });

  // 나머지 채도 높은 배경 = accent
  let accentIdx = 1;
  bgList.filter((b) => !used.has(b.hex) && saturation(b.hex) > 0.3 && accentIdx <= 2)
    .forEach((b) => add(`accent-${accentIdx++}`, b.hex, 'Brand & Accent', T(`${hueName(b.hex)} accent`, `${hueName(b.hex)} 계열 포인트`)));

  return tokens;
}

// 색상값(hex/rgb 문자열) → 토큰 참조 문자열. 매칭 실패 시 원본 hex.
export function makeColorRef(tokens) {
  const byHex = new Map(tokens.map((t) => [t.hex.toLowerCase(), t.name]));
  return (colorStr) => {
    const hex = rgbStrToHex(colorStr);
    if (!hex) return colorStr;
    const name = byHex.get(hex.toLowerCase());
    return name ? `{colors.${name}} (\`${hex}\`)` : `\`${hex}\``;
  };
}

/* ---------- 스케일 검출 (타입 비율 / 여백 기본단위) ---------- */
// 제목·본문 크기 간 비율의 중앙값을 구해 잘 알려진 모듈러 스케일로 명명.
export function detectTypeScale(data) {
  const sizes = [...new Set([
    ...(data.typography.sizes || []).map((s) => s.px),
    ...Object.values(data.typography.headings || {}).map((h) => h.size),
    data.typography.body?.size,
  ].filter((n) => n > 0))].sort((a, b) => a - b);
  if (sizes.length < 3) return null;
  const ratios = [];
  for (let i = 1; i < sizes.length; i++) {
    const r = sizes[i] / sizes[i - 1];
    if (r > 1.03 && r < 2.2) ratios.push(r); // 인접 중복·과도 점프 제외
  }
  if (ratios.length < 2) return null;
  ratios.sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  const NAMED = [
    [1.067, 'Minor Second'], [1.125, 'Major Second'], [1.2, 'Minor Third'],
    [1.25, 'Major Third'], [1.333, 'Perfect Fourth'], [1.414, 'Augmented Fourth'],
    [1.5, 'Perfect Fifth'], [1.618, 'Golden Ratio'],
  ];
  const nearest = NAMED.reduce((best, cur) =>
    Math.abs(cur[0] - median) < Math.abs(best[0] - median) ? cur : best);
  const name = Math.abs(nearest[0] - median) < 0.05 ? nearest[1] : T('Custom (irregular)', '커스텀(불규칙)');
  return { ratio: median.toFixed(3), name };
}
// 여백 값들의 최대공약수 기반 기본 단위 추정 + 그리드 이탈 값 플래그.
export function detectSpacingBase(data) {
  const vals = (data.layout.spacingScale || []).map((s) => s.px).filter((v) => v > 0);
  if (vals.length < 2) return null;
  const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
  // 4 또는 8이 대부분을 나누면 그걸 기본 단위로 우선 채택 (실무 관례)
  for (const base of [8, 4]) {
    const onGrid = vals.filter((v) => v % base === 0);
    if (onGrid.length / vals.length >= 0.7) {
      const off = vals.filter((v) => v % base !== 0).sort((a, b) => a - b);
      return { base, off };
    }
  }
  const g = vals.reduce((a, b) => gcd2(a, b));
  return g >= 2 ? { base: g, off: [] } : null;
}

/* ---------- 스케일 토큰 네이밍 ---------- */
export function nameScale(values, names) {
  return values.slice(0, names.length).map((px, i) => ({ name: names[i], px }));
}
export function buildSpacingTokens(data) {
  const byFreq = [...(data.layout.spacingScale || [])].sort((a, b) => b.count - a.count).slice(0, 8);
  const values = byFreq.map((s) => s.px).sort((a, b) => a - b);
  return nameScale(values, ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'huge']);
}
export function buildRadiusTokens(data) {
  const values = (data.depth.radii || []).map((r) => r.px);
  const pill = values.filter((v) => v >= 999);
  const rest = values.filter((v) => v < 999).slice(0, 6);
  const named = nameScale(rest, ['xs', 'sm', 'md', 'lg', 'xl', 'xxl']);
  if (pill.length) named.push({ name: 'pill', px: 9999 });
  return named;
}
export function buildTypeTokens(data) {
  const roles = [];
  const H_NAMES = { h1: 'display-xl', h2: 'display-lg', h3: 'heading-lg', h4: 'heading-md', h5: 'heading-sm', h6: 'heading-xs' };
  Object.entries(data.typography.headings || {}).forEach(([tag, h]) => {
    roles.push({ token: H_NAMES[tag], el: tag.toUpperCase(), size: h.size, weight: h.weight, lineHeight: h.lineHeight, letterSpacing: h.letterSpacing, family: h.family, use: tag === 'h1' ? T('Hero/page title', '히어로/페이지 제목') : T('Section heading', '섹션 제목') });
  });
  const b = data.typography.body;
  roles.push({ token: 'body', el: 'P', size: b.size, weight: b.weight, lineHeight: b.lineHeight, letterSpacing: b.letterSpacing || 'normal', family: b.family, use: T('Default body', '기본 본문') });
  const smaller = (data.typography.sizes || []).map((s) => s.px).filter((px) => px < b.size);
  if (smaller.length) {
    roles.push({ token: 'caption', el: '—', size: Math.max(...smaller), weight: '400', lineHeight: '—', letterSpacing: '—', family: b.family, use: T('Caption, helper text', '캡션, 헬퍼 텍스트') });
  }
  return roles;
}

/* ---------- 분위기 서술 ---------- */
export function describeMood(data, tokens) {
  const dark = data.theme.isDark;
  const primary = tokens.find((t) => t.name === 'primary');
  const sat = primary ? saturation(primary.hex) : 0;
  const radii = data.depth.radii || [];
  const finite = radii.map((r) => r.px).filter((p) => p < 999);
  const maxRad = finite.length ? Math.max(...finite) : 0;
  const shadowCount = (data.depth.shadows || []).length;

  const parts = [];
  parts.push(dark ? T('Dark-theme based — content stands out against a dark background through contrast.', '다크 테마 기반 — 콘텐츠가 어두운 배경 위에서 대비로 부각됩니다.')
                  : T('Light-theme based — content sits on a bright background.', '라이트 테마 기반 — 밝은 배경 위에 콘텐츠를 얹는 구조입니다.'));
  if (primary) {
    const satPart = sat > 0.6 ? T('high saturation gives an energetic, vivid impression.', '채도가 높아 에너지 있고 선명한 인상.') :
                    sat > 0.3 ? T('medium saturation feels stable yet present.', '중간 채도로 안정적이면서 존재감 있는 인상.') :
                                T('low saturation feels calm and restrained.', '낮은 채도로 차분하고 절제된 인상.');
    parts.push(T(`The core brand color is in the ${hueName(primary.hex)} family ({colors.primary} — \`${primary.hex}\`), and ${satPart}`,
                 `핵심 브랜드 컬러는 ${hueName(primary.hex)} 계열({colors.primary} — \`${primary.hex}\`)이며, ${satPart}`));
  }
  parts.push(maxRad >= 16 ? T('Large corner radii create a soft, friendly feel.', '큰 모서리 반경으로 부드럽고 친근한 분위기.') :
             maxRad >= 6  ? T('Moderate corner radii give a modern look.', '적당한 모서리 반경의 모던한 인상.') :
                            T('Minimal radii for a sharp, minimalist look.', '반경을 거의 쓰지 않는 각지고 미니멀한 인상.'));
  parts.push(shadowCount >= 3 ? T('Layered shadows express depth.', '그림자를 다층적으로 사용해 입체감을 표현합니다.') :
             shadowCount >= 1 ? T('Shadows are restrained, close to flat.', '그림자는 절제되어 플랫에 가깝습니다.') :
                                T('Completely flat, shadow-free style.', '그림자 없는 완전 플랫 스타일입니다.'));
  return parts.join(' ');
}

export function keyCharacteristics(data, tokens, spacing, radius) {
  const chars = [];
  const primary = tokens.find((t) => t.name === 'primary');
  if (primary) chars.push(T(`Single primary CTA system: {colors.primary} \`${primary.hex}\` owns the action color`, `단일 Primary CTA 체계: {colors.primary} \`${primary.hex}\` 가 액션 색상을 독점`));
  const fam = (data.typography.families || [])[0];
  if (fam) chars.push(T(`\`${fam.family}\`-centered typography, body ${data.typography.body.size}px / line-height ${data.typography.body.lineHeight}`, `\`${fam.family}\` 중심 타이포그래피, 본문 ${data.typography.body.size}px / 행간 ${data.typography.body.lineHeight}`));
  if (spacing.length >= 3) chars.push(T(`${spacing[0].px}px-based spacing scale (${spacing.map((s) => s.px + 'px').join(' · ')})`, `${spacing[0].px}px 기반 여백 스케일 (${spacing.map((s) => s.px + 'px').join(' · ')})`));
  const pill = radius.find((r) => r.name === 'pill');
  if (pill) chars.push(T('Pill (fully rounded) button shape', 'pill(완전 원형) 버튼 형태 사용'));
  else if (radius.length) chars.push(T(`Corner radius scale ${radius.map((r) => r.px + 'px').join(' · ')}`, `모서리 반경 스케일 ${radius.map((r) => r.px + 'px').join(' · ')}`));
  chars.push(data.layout.flexCount >= data.layout.gridCount ? T('Flexbox-centered layout', 'Flexbox 중심 레이아웃') : T('CSS Grid-centered layout', 'CSS Grid 중심 레이아웃'));
  const cw = (data.layout.containerWidths || [])[0];
  if (cw) chars.push(T(`Center-aligned container, max content width ${cw.px}px`, `콘텐츠 최대폭 ${cw.px}px 중앙 정렬 컨테이너`));
  const nav = data.components.nav;
  if (nav && (nav.position === 'fixed' || nav.position === 'sticky')) {
    chars.push(T(`Top-fixed (${nav.position}) navigation, height ${nav.height}px`, `상단 고정(${nav.position}) 내비게이션, 높이 ${nav.height}px`));
  }
  if (data.components.linkUnderline === 'none') chars.push(T('No link underline — distinguished by color only', '링크 밑줄 없음 — 색상으로만 구분'));
  return chars;
}

/* ---------- YAML frontmatter ---------- */
export function buildFrontmatter(data, tokens, typeRoles, radius, spacing, colorRef) {
  const L = [];
  L.push('---');
  L.push('version: 1');
  L.push(`name: ${(data.meta.title || 'design-analysis').replace(/[:#"]/g, ' ').trim()}`);
  L.push(`source: ${data.meta.url}`);
  L.push(`analyzedAt: ${data.meta.analyzedAt}`);
  L.push('');
  L.push('colors:');
  tokens.forEach((t) => L.push(`  ${t.name}: "${t.hex}"`));
  L.push('');
  L.push('typography:');
  typeRoles.forEach((r) => {
    L.push(`  ${r.token}:`);
    L.push(`    fontFamily: "${r.family}"`);
    L.push(`    fontSize: ${r.size}px`);
    L.push(`    fontWeight: ${r.weight}`);
    if (r.lineHeight && r.lineHeight !== '—') L.push(`    lineHeight: ${r.lineHeight}`);
    if (r.letterSpacing && r.letterSpacing !== '—') L.push(`    letterSpacing: ${r.letterSpacing}`);
  });
  L.push('');
  if (radius.length) {
    L.push('rounded:');
    radius.forEach((r) => L.push(`  ${r.name}: ${r.name === 'pill' ? '9999px' : r.px + 'px'}`));
    L.push('');
  }
  if (spacing.length) {
    L.push('spacing:');
    spacing.forEach((s) => L.push(`  ${s.name}: ${s.px}px`));
    L.push('');
  }
  // components: 토큰 참조 형태
  const tokenName = (colorStr) => {
    const ref = colorRef(colorStr);
    const m = ref.match(/\{colors\.([a-z0-9-]+)\}/);
    return m ? `"{colors.${m[1]}}"` : `"${rgbStrToHex(colorStr) || colorStr}"`;
  };
  const comps = [];
  (data.components.buttons || []).slice(0, 2).forEach((b, i) => {
    comps.push(`  button-${i === 0 ? 'primary' : 'secondary'}:`);
    comps.push(`    backgroundColor: ${tokenName(b.style.background)}`);
    comps.push(`    textColor: ${tokenName(b.style.color)}`);
    comps.push(`    rounded: ${b.style.borderRadius}`);
    comps.push(`    padding: ${b.style.padding}`);
  });
  if (data.components.input) {
    const s = data.components.input;
    comps.push('  text-input:');
    comps.push(`    backgroundColor: ${tokenName(s.background)}`);
    comps.push(`    textColor: ${tokenName(s.color)}`);
    comps.push(`    border: ${s.border}`);
    comps.push(`    rounded: ${s.borderRadius}`);
  }
  if (data.components.card) {
    const s = data.components.card;
    comps.push('  card:');
    comps.push(`    backgroundColor: ${tokenName(s.background)}`);
    comps.push(`    rounded: ${s.borderRadius}`);
    comps.push(`    padding: ${s.padding}`);
    if (s.boxShadow !== 'none') comps.push(`    boxShadow: "${s.boxShadow}"`);
  }
  if (comps.length) { L.push('components:'); L.push(...comps); }
  L.push('---');
  return L;
}

/* ---------- 마크다운 조립 ---------- */

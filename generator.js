// generator.js — 분석 결과(JSON)를 DESIGN.md 마크다운으로 변환 (popup 컨텍스트에서 실행)
//
// 출력 포맷은 VoltAgent/awesome-design-md 컬렉션 스타일을 따른다:
//   - YAML frontmatter에 기계가 읽는 디자인 토큰 (colors / typography / rounded / spacing / components)
//   - 본문에서 토큰을 {colors.primary} 형식으로 상호 참조
//   - 9개 섹션: 테마 / 컬러 / 타이포 / 컴포넌트 / 레이아웃 / 깊이 / Do's&Don'ts / 반응형 / 에이전트 가이드
//
// 다국어: 공개 함수는 lang 인자('en'|'ko')를 받는다. 기본은 'en'.
//   모듈 레벨 LANG를 진입점에서 설정하고, T(en, ko) 헬퍼로 출력 문자열을 선택한다.
//   (동기 실행이므로 LANG 공유 안전. 색상 토큰 메모는 LANG별로 캐시.)

const DesignGenerator = (() => {

  let LANG = 'en';
  const T = (en, ko) => (LANG === 'ko' ? ko : en);

  /* ---------- 보안: 페이지 유래 값 살균 ----------
     분석 대상은 신뢰할 수 없는(악성 가능) 페이지다. 추출값을 preview.html/passport.svg에
     삽입할 때 반드시 살균한다. preview.html은 blob(=확장 origin)으로 열리므로 XSS 시 확장 권한 위험. */
  const htmlEsc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  // CSS 값 화이트리스트 (색/치수/폰트명/그림자만 허용, < " ' { } ; \ 등 차단)
  const cssSafe = (v) => String(v == null ? '' : v).replace(/[^a-zA-Z0-9#(),.%/\s_-]/g, '').slice(0, 300);

  /* ---------- 색상 헬퍼 ---------- */
  function hexToRgb(hex) {
    const m = hex.match(/^#(..)(..)(..)$/);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }
  function luminance(hex) {
    const c = hexToRgb(hex);
    if (!c) return 0;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function saturation(hex) {
    const c = hexToRgb(hex);
    if (!c) return 0;
    const max = Math.max(c.r, c.g, c.b) / 255, min = Math.min(c.r, c.g, c.b) / 255;
    if (max === min) return 0;
    const l = (max + min) / 2, d = max - min;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }
  function contrast(h1, h2) {
    const l1 = luminance(h1), l2 = luminance(h2);
    return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
  }
  function rgbStrToHex(str) {
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
  function hueName(hex) {
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
  function rgbDist(h1, h2) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    if (!a || !b) return Infinity;
    // 밝기 가중 유클리드 근사 (지각 거리)
    const rm = (a.r + b.r) / 2;
    const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  }
  // list: [{hex, <weightField>}] → near-dupe 병합, 가중치 합산, 최다 가중 대표색 유지
  function clusterColors(list, weightField, threshold = 24) {
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
  function hueDeg(hex) {
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
  function semanticRole(hex) {
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
  // note 텍스트가 언어별로 다르므로 LANG를 캐시 키에 포함.
  const _colorMemo = new WeakMap();
  function buildColorTokens(data) {
    let perLang = _colorMemo.get(data);
    if (!perLang) { perLang = {}; _colorMemo.set(data, perLang); }
    if (perLang[LANG]) return perLang[LANG];
    const result = buildColorTokensImpl(data);
    perLang[LANG] = result;
    return result;
  }
  function buildColorTokensImpl(data) {
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
  function makeColorRef(tokens) {
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
  function detectTypeScale(data) {
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
  function detectSpacingBase(data) {
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
  function nameScale(values, names) {
    return values.slice(0, names.length).map((px, i) => ({ name: names[i], px }));
  }
  function buildSpacingTokens(data) {
    const byFreq = [...(data.layout.spacingScale || [])].sort((a, b) => b.count - a.count).slice(0, 8);
    const values = byFreq.map((s) => s.px).sort((a, b) => a - b);
    return nameScale(values, ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'huge']);
  }
  function buildRadiusTokens(data) {
    const values = (data.depth.radii || []).map((r) => r.px);
    const pill = values.filter((v) => v >= 999);
    const rest = values.filter((v) => v < 999).slice(0, 6);
    const named = nameScale(rest, ['xs', 'sm', 'md', 'lg', 'xl', 'xxl']);
    if (pill.length) named.push({ name: 'pill', px: 9999 });
    return named;
  }
  function buildTypeTokens(data) {
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
  function describeMood(data, tokens) {
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

  function keyCharacteristics(data, tokens, spacing, radius) {
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
  function buildFrontmatter(data, tokens, typeRoles, radius, spacing, colorRef) {
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
  function generate(data, lang) {
    LANG = lang === 'ko' ? 'ko' : 'en';
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
  function exportTokens(data, lang) {
    LANG = lang === 'ko' ? 'ko' : 'en';
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
  function merge(analyses) {
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
  function exportPreview(data, lang) {
    LANG = lang === 'ko' ? 'ko' : 'en';
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
    H.push(`<!DOCTYPE html><html lang="${LANG}"><head><meta charset="UTF-8">`);
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
  function exportTailwind(data, lang) {
    LANG = lang === 'ko' ? 'ko' : 'en';
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
  function computeDNA(data, lang) {
    if (lang !== undefined) LANG = lang === 'ko' ? 'ko' : 'en';
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
  function computeLint(data, lang) {
    if (lang !== undefined) LANG = lang === 'ko' ? 'ko' : 'en';
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

  /* ---------- Azuki 시그니처: 마스코트 촌평 ---------- */
  function mascotComment(data, lang) {
    if (lang !== undefined) LANG = lang === 'ko' ? 'ko' : 'en';
    const issues = computeLint(data);
    const warns = issues.filter((i) => i.level === 'warn').length;
    if (!issues.length) return T('Clean and consistent — great tokens! 🫘', '토큰 깔끔하고 일관돼요 — 훌륭해요! 🫘');
    if (warns) return T(`Spotted ${warns} thing(s) worth fixing — see the lint. 🫘`, `고칠 점 ${warns}개 발견 — 린트를 확인해요. 🫘`);
    return T('Looks solid, just a few small notes. 🫘', '대체로 탄탄해요, 참고사항 몇 개만! 🫘');
  }

  /* ---------- Azuki 시그니처: 에이전트 프롬프트 브릿지 ---------- */
  // AI 코딩 에이전트에 바로 붙여넣는 self-contained 프롬프트.
  function exportAgentPrompt(data, lang) {
    LANG = lang === 'ko' ? 'ko' : 'en';
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
  function designFingerprint(data) {
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
  function exportPassport(data, lang) {
    LANG = lang === 'ko' ? 'ko' : 'en';
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
    s.push(`<text x="28" y="238" font-size="12" fill="#5b606e">${esc(body.family || '')} · ${esc(body.size || '')}px · ${data.theme.isDark ? (LANG === 'ko' ? '다크' : 'Dark') : (LANG === 'ko' ? '라이트' : 'Light')}</text>`);
    // 지문 코드 (풋터)
    s.push(`<line x1="28" y1="256" x2="${W - 28}" y2="256" stroke="#e3ddd0" stroke-width="1"/>`);
    s.push(`<text x="28" y="280" font-size="13" font-weight="700" letter-spacing="1" fill="#14161c">${esc(fp)}</text>`);
    s.push(`<text x="${W - 28}" y="280" font-size="11" fill="#5b606e" text-anchor="end">${LANG === 'ko' ? '디자인 지문' : 'design fingerprint'}</text>`);
    s.push('</svg>');
    return s.join('\n');
  }

  return { generate, exportTokens, merge, exportPreview, exportTailwind, computeDNA, computeLint, mascotComment, exportAgentPrompt, designFingerprint, exportPassport };
})();

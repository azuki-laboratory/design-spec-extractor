// analyzer.js
// 페이지에 주입되어 실행되는 자기완결(self-contained) 분석 함수.
// popup.js에서 chrome.scripting.executeScript({ func: analyzePage, args: [opts] })로
// 직렬화되어 대상 페이지 컨텍스트에서 실행되므로, 외부 스코프를 참조하면 안 된다.
// opts: 설정 페이지(options)에서 온 사용자 옵션. 인자 없이 호출되면 기본값 사용.

export function analyzePage(opts) {
  opts = opts || {};
  const MAX_ELEMENTS = opts.maxElements > 0 ? opts.maxElements : 4000;

  /* ---------- 색상 유틸 ---------- */
  function parseAlpha(raw) {
    if (raw === undefined || raw === null || raw === '') return 1;
    let a = parseFloat(raw);
    if (String(raw).includes('%')) a /= 100;
    return isNaN(a) ? 1 : a;
  }
  function parseColor(str) {
    if (!str) return null;
    str = str.trim();
    if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    // rgb()/rgba() — 대부분의 computed value
    let m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: parseAlpha(m[4]) };
    // color(srgb r g b / a) — 광색역 지정 시 Chrome computed value (성분 0~1)
    m = str.match(/^color\(srgb\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/);
    if (m) {
      const c01 = (v) => Math.min(255, Math.max(0, parseFloat(v) * 255));
      return { r: c01(m[1]), g: c01(m[2]), b: c01(m[3]), a: parseAlpha(m[4]) };
    }
    // oklch()/oklab() — sRGB 밖 색은 지정 그대로 직렬화됨. sRGB로 변환(클램프).
    m = str.match(/^okl(ch|ab)\(\s*([\d.]+%?)\s+([\d.-]+%?)\s+([\d.-]+)(?:deg)?\s*(?:\/\s*([\d.]+%?))?\s*\)/);
    if (m) {
      const L = String(m[2]).includes('%') ? parseFloat(m[2]) / 100 : parseFloat(m[2]);
      let A, B;
      if (m[1] === 'ch') {
        const C = String(m[3]).includes('%') ? parseFloat(m[3]) * 0.004 : parseFloat(m[3]);
        const H = (parseFloat(m[4]) * Math.PI) / 180;
        A = C * Math.cos(H); B = C * Math.sin(H);
      } else {
        A = String(m[3]).includes('%') ? parseFloat(m[3]) * 0.004 : parseFloat(m[3]);
        B = String(m[4]).includes('%') ? parseFloat(m[4]) * 0.004 : parseFloat(m[4]);
      }
      // OKLab → linear sRGB (표준 행렬)
      const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
      const mm = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
      const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
      const lin = [
        4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
      ].map((v) => {
        v = Math.min(1, Math.max(0, v));
        return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
      });
      return { r: lin[0], g: lin[1], b: lin[2], a: parseAlpha(m[5]) };
    }
    return null;
  }
  // fg(반투명)를 불투명 bg 위에 합성 — 화면에 실제 보이는 색
  function composite(fg, bg) {
    const a = fg.a;
    return {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
      a: 1,
    };
  }
  function toHex(c) {
    const h = (n) => Math.round(n).toString(16).padStart(2, '0');
    return '#' + h(c.r) + h(c.g) + h(c.b);
  }
  function luminance(c) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function saturation(c) {
    const max = Math.max(c.r, c.g, c.b) / 255;
    const min = Math.min(c.r, c.g, c.b) / 255;
    const l = (max + min) / 2;
    if (max === min) return 0;
    const d = max - min;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }
  function contrastRatio(c1, c2) {
    const l1 = luminance(c1), l2 = luminance(c2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function isTransparent(c) {
    return !c || c.a < 0.05;
  }
  function isNeutral(c) {
    return saturation(c) < 0.12;
  }

  /* ---------- 집계 헬퍼 ---------- */
  function tally(map, key, weight = 1) {
    if (key === null || key === undefined || key === '') return;
    map.set(key, (map.get(key) || 0) + weight);
  }
  function topEntries(map, n = 10) {
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }
  // 근접 수치 병합 (15/16/17px → 16px) — 서브픽셀·반응형 노이즈로 인한 스케일 파편화 방지.
  // count 내림차순으로 대표값을 고정하고, 허용 오차 내 값을 흡수한다.
  function snapScale(map, tol = 1) {
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const out = new Map();
    for (const [v, n] of entries) {
      let rep = null;
      for (const k of out.keys()) {
        if (Math.abs(k - v) <= tol) { rep = k; break; }
      }
      out.set(rep === null ? v : rep, (out.get(rep === null ? v : rep) || 0) + n);
    }
    return out;
  }
  function visible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }
  function area(el) {
    const r = el.getBoundingClientRect();
    return Math.min(r.width * r.height, window.innerWidth * window.innerHeight);
  }

  /* ---------- 수집 컨테이너 ---------- */
  const bgColors = new Map();      // hex -> 면적 가중치
  const textColors = new Map();    // hex -> 텍스트 요소 수
  const borderColors = new Map();
  const linkColors = new Map();
  const fontFamilies = new Map();
  const fontSizes = new Map();     // px -> count
  const fontWeights = new Map();
  const headingStyles = {};        // h1..h6 -> {size, weight, lineHeight, family}
  const bodyStyle = {};
  const radii = new Map();
  const shadows = new Map();
  const spacings = new Map();      // margin/padding px 값 -> count
  const gaps = new Map();
  const zIndices = new Map();
  let gridCount = 0, flexCount = 0, totalContainers = 0;
  const containerWidths = new Map();
  const transitions = new Map();
  const gradients = new Map();
  const borderWidths = new Map(); // px -> count (테두리 두께 스케일)
  const opacities = new Map();    // opacity(<1) -> count
  const easings = new Map();      // transition-timing-function -> count
  const animations = new Map();   // animation-name -> count

  // 요소 뒤에 실제로 깔린 불투명 배경색 (조상 체인 합성, 요소별 캐시)
  const bgCache = new Map();
  function resolvedBg(el) {
    if (!el || el.nodeType !== 1) return { r: 255, g: 255, b: 255, a: 1 };
    if (bgCache.has(el)) return bgCache.get(el);
    const c = parseColor(getComputedStyle(el).backgroundColor);
    let out;
    if (c && c.a >= 0.95) out = c;
    else {
      const behind = resolvedBg(el.parentElement);
      out = (!c || c.a < 0.05) ? behind : composite(c, behind);
    }
    bgCache.set(el, out);
    return out;
  }
  // 화면에 보이는 색으로 정규화: 반투명이면 backdropEl의 배경 위에 합성
  // (요소 배경 → 부모, 텍스트·테두리 → 요소 자신)
  function seenColor(c, backdropEl) {
    if (!c || isTransparent(c)) return null;
    return c.a >= 0.95 ? c : composite(c, resolvedBg(backdropEl));
  }

  const all = document.querySelectorAll('body, body *');
  // 상한 초과 시 앞부분만 자르지 않고 전체를 등간격 샘플링 — 문서 순서(상단) 편향 방지
  const stride = all.length > MAX_ELEMENTS ? all.length / MAX_ELEMENTS : 1;
  const limit = Math.min(all.length, MAX_ELEMENTS);

  for (let i = 0; i < limit; i++) {
    const el = all[Math.floor(i * stride)];
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    // 크기는 있어도 실제로 안 보이는 요소(닫힌 메뉴·오버레이) 제외 — 팔레트 오염 방지
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;

    // 배경색 (면적 가중, 반투명은 뒤 배경과 합성해 실제 표시색으로)
    const bg = seenColor(parseColor(cs.backgroundColor), el.parentElement);
    if (bg) tally(bgColors, toHex(bg), Math.sqrt(area(el)));

    // 텍스트 색 — 글자 수 가중: 한 글자 아이콘 span과 본문 문단을 구별
    const textLen = [...el.childNodes].reduce(
      (sum, n) => sum + (n.nodeType === 3 ? n.textContent.trim().length : 0), 0
    );
    if (textLen > 0) {
      const tw = Math.min(textLen, 300); // 초장문 문단이 독점하지 않게 상한
      const fg = seenColor(parseColor(cs.color), el);
      if (fg) tally(textColors, toHex(fg), tw);
      tally(fontFamilies, cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), tw);
      tally(fontSizes, Math.round(parseFloat(cs.fontSize)), tw);
      tally(fontWeights, cs.fontWeight, tw);
      if (el.tagName === 'A') {
        if (fg) tally(linkColors, toHex(fg));
      }
    }

    // 테두리 (색 + 두께)
    const bw = parseFloat(cs.borderTopWidth);
    if (bw > 0 && cs.borderTopStyle !== 'none') {
      const bc = seenColor(parseColor(cs.borderTopColor), el);
      if (bc) tally(borderColors, toHex(bc));
      if (bw <= 12) tally(borderWidths, Math.round(bw));
    }

    // 불투명도 스케일
    const op = parseFloat(cs.opacity);
    if (op > 0 && op < 1) tally(opacities, op.toFixed(2));

    // 모서리 반경
    const rad = parseFloat(cs.borderTopLeftRadius);
    if (rad > 0) tally(radii, Math.round(rad));

    // 그림자 (소수점 px는 반올림해 동일 그림자의 파편화 방지)
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      tally(shadows, cs.boxShadow.replace(/(-?\d+\.\d+)px/g, (_, n) => Math.round(parseFloat(n)) + 'px'));
    }

    // 여백 스케일
    ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
     'marginTop', 'marginBottom'].forEach((p) => {
      const v = Math.round(parseFloat(cs[p]));
      if (v > 0 && v < 200) tally(spacings, v);
    });

    // 레이아웃
    if (cs.display === 'grid' || cs.display === 'inline-grid') { gridCount++; totalContainers++; }
    else if (cs.display === 'flex' || cs.display === 'inline-flex') { flexCount++; totalContainers++; }
    if (cs.display.includes('grid') || cs.display.includes('flex')) {
      const g = Math.round(parseFloat(cs.gap || cs.columnGap) || 0);
      if (g > 0) tally(gaps, g);
    }

    // 최대폭 컨테이너 (중앙 정렬 래퍼 추정)
    const mw = parseFloat(cs.maxWidth);
    if (mw > 400 && mw < 2000 && (cs.marginLeft === 'auto' || cs.marginRight === 'auto' ||
        Math.abs(el.getBoundingClientRect().left - (window.innerWidth - el.getBoundingClientRect().width) / 2) < 40)) {
      tally(containerWidths, Math.round(mw));
    }

    // 그라디언트 배경
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
      tally(gradients, cs.backgroundImage.slice(0, 220));
    }

    // z-index / 전환
    if (cs.zIndex !== 'auto' && +cs.zIndex > 0) tally(zIndices, +cs.zIndex);
    if (cs.transitionDuration && cs.transitionDuration !== '0s') {
      tally(transitions, cs.transitionDuration.split(',')[0].trim());
      if (cs.transitionTimingFunction) tally(easings, cs.transitionTimingFunction.split(',')[0].trim());
    }
    // 애니메이션
    if (cs.animationName && cs.animationName !== 'none') {
      cs.animationName.split(',').forEach((a) => { const n = a.trim(); if (n && n !== 'none') tally(animations, n); });
    }
  }

  /* ---------- 아이콘 감사 (인라인 SVG 규모·크기) ---------- */
  const svgs = [...document.querySelectorAll('svg')].filter(visible);
  const iconSizes = new Map();
  svgs.slice(0, 300).forEach((s) => {
    const r = s.getBoundingClientRect();
    const side = Math.round(Math.max(r.width, r.height));
    if (side >= 8 && side <= 96) tally(iconSizes, side);
  });
  const icons = {
    svgCount: svgs.length,
    commonSizes: topEntries(iconSizes, 4).map(([px, n]) => ({ px, count: n })).sort((a, b) => a.px - b.px),
  };

  /* ---------- 접근성 스냅샷 ---------- */
  const headingOrder = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].slice(0, 40).map((h) => h.tagName.toLowerCase());
  const imgs = [...document.querySelectorAll('img')];
  const imgWithAlt = imgs.filter((im) => (im.getAttribute('alt') || '').trim().length > 0 || im.getAttribute('alt') === '').length;
  const landmarkSel = { header: 'header,[role=banner]', nav: 'nav,[role=navigation]', main: 'main,[role=main]', footer: 'footer,[role=contentinfo]', aside: 'aside,[role=complementary]' };
  const landmarks = Object.keys(landmarkSel).filter((k) => document.querySelector(landmarkSel[k]));
  const a11y = {
    headingOrder,
    h1Count: headingOrder.filter((t) => t === 'h1').length,
    imgTotal: imgs.length,
    imgAltCoverage: imgs.length ? Math.round((imgWithAlt / imgs.length) * 100) : null,
    landmarks,
    langSet: !!(document.documentElement.getAttribute('lang') || '').trim(),
  };

  /* ---------- 제목/본문 타이포 ---------- */
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach((tag) => {
    const el = document.querySelector(tag);
    if (el && visible(el)) {
      const cs = getComputedStyle(el);
      headingStyles[tag] = {
        size: Math.round(parseFloat(cs.fontSize)),
        weight: cs.fontWeight,
        lineHeight: cs.lineHeight === 'normal' ? 'normal' : (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2),
        family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        letterSpacing: cs.letterSpacing,
      };
    }
  });
  {
    const p = document.querySelector('main p, article p, p') || document.body;
    const cs = getComputedStyle(p);
    bodyStyle.size = Math.round(parseFloat(cs.fontSize));
    bodyStyle.weight = cs.fontWeight;
    bodyStyle.lineHeight = cs.lineHeight === 'normal' ? 'normal' : (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2);
    bodyStyle.family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    bodyStyle.letterSpacing = cs.letterSpacing;
  }

  /* ---------- 컴포넌트 샘플링 ---------- */
  function styleSnapshot(el) {
    const cs = getComputedStyle(el);
    return {
      background: cs.backgroundColor,
      color: cs.color,
      border: cs.borderTopWidth !== '0px' ? `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` : 'none',
      borderStyle: cs.borderTopStyle,
      borderRadius: cs.borderTopLeftRadius,
      padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      boxShadow: cs.boxShadow,
      transition: cs.transitionDuration !== '0s' ? `${cs.transitionProperty.split(',')[0]} ${cs.transitionDuration.split(',')[0]}` : 'none',
      textTransform: cs.textTransform,
    };
  }

  // 스타일 클러스터 키: 정규화된 hex + 반올림 반경 — rgba 표기·서브픽셀 차이로 분열하지 않게
  const hexKey = (str) => {
    const c = parseColor(str);
    return !c || isTransparent(c) ? 't' : toHex(c);
  };
  // 클러스터 맵 → 일관성 지표 (감지 수 / 스타일 변형 수 / 최다 스타일 커버 수)
  const consistencyOf = (total, clusters) => (total ? {
    total,
    variants: clusters.size,
    topCount: Math.max(...[...clusters.values()].map((c) => c.count)),
  } : null);

  // 버튼: 스타일 시그니처별로 클러스터링해서 상위 2종(primary/secondary 추정)
  const buttonEls = [...document.querySelectorAll(
    'button, [role="button"], input[type="submit"], input[type="button"], a[class*="btn" i], a[class*="button" i]'
  )].filter(visible).slice(0, 200);
  const btnClusters = new Map();
  buttonEls.forEach((el) => {
    const s = styleSnapshot(el);
    const key = `${hexKey(s.background)}|${hexKey(s.color)}|${Math.round(parseFloat(s.borderRadius) || 0)}|${s.border}`;
    const label = (el.textContent || el.value || '').trim().slice(0, 30);
    if (!btnClusters.has(key)) {
      btnClusters.set(key, { style: s, count: 0, sample: label, heights: [] });
    }
    const cl = btnClusters.get(key);
    cl.count++;
    // offsetHeight: transform(회전·스케일)에 영향받지 않는 레이아웃 높이
    if (cl.heights.length < 20) cl.heights.push(el.offsetHeight || Math.round(el.getBoundingClientRect().height));
    if (!cl.sample && label) cl.sample = label; // 아이콘 전용 버튼이 대표가 됐으면 텍스트 있는 샘플로 교체
  });
  // 대표 높이 = 중앙값 — 첫 요소가 flex 스트레치 등으로 비정상 높이일 때 오염 방지
  btnClusters.forEach((cl) => {
    const hs = cl.heights.sort((a, b) => a - b);
    cl.height = hs.length ? hs[Math.floor(hs.length / 2)] : null;
    delete cl.heights;
  });
  const buttonVariants = [...btnClusters.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  // 유채색 배경 버튼을 primary로 우선
  buttonVariants.sort((a, b) => {
    const sa = parseColor(a.style.background), sb = parseColor(b.style.background);
    const score = (c) => (c && !isTransparent(c) ? saturation(c) : -1);
    return score(sb) - score(sa);
  });

  // 입력창: 전체 수집 후 클러스터링 — 첫 요소가 아웃라이어(검색창 등)여도 지배 스타일 채택
  const inputEls = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), textarea, select')]
    .filter(visible).slice(0, 40);
  const inputClusters = new Map();
  inputEls.forEach((el) => {
    const s = styleSnapshot(el);
    const key = `${hexKey(s.background)}|${s.border}|${Math.round(parseFloat(s.borderRadius) || 0)}`;
    const cl = inputClusters.get(key);
    if (!cl) inputClusters.set(key, { style: s, count: 1 });
    else cl.count++;
  });
  const inputTop = [...inputClusters.values()].sort((a, b) => b.count - a.count)[0];
  const inputStyle = inputTop ? inputTop.style : null;

  // 내비게이션 (헤더 바)
  const navEl = [...document.querySelectorAll('header, nav, [role="banner"]')].filter(visible)[0];
  const navStyle = navEl ? Object.assign(styleSnapshot(navEl), {
    height: navEl.offsetHeight || Math.round(navEl.getBoundingClientRect().height),
    position: getComputedStyle(navEl).position,
  }) : null;

  // 링크 밑줄 관례
  const linkSample = [...document.querySelectorAll('a')].filter(visible).slice(0, 30);
  const underlined = linkSample.filter((a) => getComputedStyle(a).textDecorationLine.includes('underline')).length;
  const linkUnderline = linkSample.length ? (underlined / linkSample.length > 0.5 ? 'underline' : 'none') : null;

  // 카드: 반경 + (그림자 또는 테두리) + 패딩 + 복수 자식.
  // 후보 전체를 클러스터링해 "가장 반복되는" 스타일을 대표로 — 최대 면적 1개 채택은 아웃라이어에 취약
  const cardCandidates = [...document.querySelectorAll('div, section, article, li')]
    .filter(visible)
    .filter((el) => {
      const cs = getComputedStyle(el);
      const hasRad = parseFloat(cs.borderTopLeftRadius) >= 4;
      const hasEdge = (cs.boxShadow && cs.boxShadow !== 'none') || parseFloat(cs.borderTopWidth) > 0;
      const hasPad = parseFloat(cs.paddingTop) >= 8;
      const bg = parseColor(cs.backgroundColor);
      return hasRad && hasEdge && hasPad && !isTransparent(bg) && el.children.length >= 2;
    })
    .slice(0, 80);
  const cardClusters = new Map();
  cardCandidates.forEach((el) => {
    const s = styleSnapshot(el);
    const key = `${hexKey(s.background)}|${Math.round(parseFloat(s.borderRadius) || 0)}|${s.border}|${s.boxShadow !== 'none'}`;
    const cl = cardClusters.get(key);
    if (!cl) cardClusters.set(key, { style: s, count: 1, area: area(el) });
    else { cl.count++; cl.area = Math.max(cl.area, area(el)); }
  });
  const cardTop = [...cardClusters.values()].sort((a, b) => b.count - a.count || b.area - a.area)[0];
  const cardStyle = cardTop ? cardTop.style : null;

  // 배지/칩: 배경 있는 작은 인라인 요소, 짧은 텍스트, 약간의 반경.
  // 첫 매치가 아니라 최다 반복 스타일을 대표로 채택
  const badgeCandidates = [...document.querySelectorAll('span, small, [class*="badge" i], [class*="tag" i], [class*="chip" i], [class*="pill" i], [class*="label" i]')]
    .filter(visible)
    .filter((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const bg = parseColor(cs.backgroundColor);
      return !isTransparent(bg) && parseFloat(cs.borderTopLeftRadius) >= 2 &&
        r.height > 0 && r.height <= 40 && r.width <= 220 &&
        (el.textContent || '').trim().length <= 24 && el.children.length <= 1;
    })
    .slice(0, 60);
  const badgeClusters = new Map();
  badgeCandidates.forEach((el) => {
    const s = styleSnapshot(el);
    const key = `${hexKey(s.background)}|${hexKey(s.color)}|${Math.round(parseFloat(s.borderRadius) || 0)}`;
    const cl = badgeClusters.get(key);
    if (!cl) badgeClusters.set(key, { style: s, count: 1 });
    else cl.count++;
  });
  const badgeTop = [...badgeClusters.values()].sort((a, b) => b.count - a.count)[0];
  const badgeStyle = badgeTop ? badgeTop.style : null;

  // 폼 컨트롤 인벤토리 (체크박스/라디오/셀렉트/텍스트영역/레인지 + accent 색)
  const accentEl = document.querySelector('input[type=checkbox], input[type=radio]');
  let formAccent = null;
  if (accentEl) {
    const ac = parseColor(getComputedStyle(accentEl).accentColor);
    if (ac && !isTransparent(ac)) formAccent = toHex(ac);
  }
  const formControls = {
    checkbox: !!document.querySelector('input[type=checkbox]'),
    radio: !!document.querySelector('input[type=radio]'),
    select: !!document.querySelector('select'),
    textarea: !!document.querySelector('textarea'),
    range: !!document.querySelector('input[type=range]'),
    accent: formAccent,
  };

  // 테이블 스타일
  const tableEl = [...document.querySelectorAll('table')].filter(visible)[0];
  let tableStyle = null;
  if (tableEl) {
    const cell = tableEl.querySelector('td, th');
    const ccs = cell ? getComputedStyle(cell) : null;
    tableStyle = {
      borderCollapse: getComputedStyle(tableEl).borderCollapse,
      cellPadding: ccs ? `${ccs.paddingTop} ${ccs.paddingRight} ${ccs.paddingBottom} ${ccs.paddingLeft}` : null,
      cellBorder: ccs && ccs.borderBottomWidth !== '0px' ? `${ccs.borderBottomWidth} ${ccs.borderBottomStyle} ${ccs.borderBottomColor}` : 'none',
    };
  }

  /* ---------- 스타일시트 단일 패스 ----------
     document.styleSheets를 한 번만 순회하며 규칙마다 아래 수집기로 분배한다:
       - 브레이크포인트 (미디어쿼리 min/max-width)
       - :hover / :focus 정적 규칙
       - :root/html CSS 커스텀 프로퍼티 (디자인 토큰)
       - prefers-color-scheme: dark 내부의 :root 변수 재정의 (다크 팔레트)
       - @font-face 웹폰트
     교차 출처 스타일시트는 cssRules 접근이 막히므로 sheet 단위 try로 건너뛴다. */
  const breakpoints = new Map();
  const hoverRules = [];
  const focusRules = [];
  const cssVars = [];
  const darkVars = [];
  const fontFaces = [];
  const rootStyle = getComputedStyle(document.documentElement);

  const collectStyleRule = (rule) => {
    // :root/html 변수
    if (rule.selectorText === ':root' || rule.selectorText === 'html') {
      for (const prop of rule.style) {
        if (prop.startsWith('--') && cssVars.length < 60) {
          cssVars.push({ name: prop, value: rootStyle.getPropertyValue(prop).trim() });
        }
      }
    }
    // hover / focus
    if (rule.selectorText) {
      if (hoverRules.length < 20 && rule.selectorText.includes(':hover') &&
          /btn|button|link|nav|card|a\b|a:/i.test(rule.selectorText)) {
        hoverRules.push({ selector: rule.selectorText.slice(0, 80), css: rule.style.cssText.slice(0, 160) });
      }
      if (focusRules.length < 10 && /:focus/.test(rule.selectorText) &&
          /input|btn|button|field|textarea|select/i.test(rule.selectorText)) {
        focusRules.push({ selector: rule.selectorText.slice(0, 80), css: rule.style.cssText.slice(0, 160) });
      }
    }
  };

  const collectMediaRule = (rule) => {
    const mt = rule.media.mediaText;
    // 브레이크포인트
    const ms = mt.match(/(?:max|min)-width:\s*([\d.]+)(px|em|rem)/g) || [];
    ms.forEach((m) => {
      const v = m.match(/([\d.]+)(px|em|rem)/);
      let px = parseFloat(v[1]);
      if (v[2] !== 'px') px = px * 16;
      tally(breakpoints, Math.round(px));
    });
    // 다크 팔레트 (prefers-color-scheme: dark 내부 :root/html/body 변수)
    if (mt.includes('prefers-color-scheme') && mt.includes('dark') && rule.cssRules) {
      for (const inner of rule.cssRules) {
        if (inner.selectorText === ':root' || inner.selectorText === 'html' || inner.selectorText === 'body') {
          for (const prop of inner.style) {
            if (darkVars.length >= 60) break;
            darkVars.push({ name: prop, value: inner.style.getPropertyValue(prop).trim() });
          }
        }
      }
    }
  };

  const collectFontFace = (rule) => {
    const st = rule.style;
    if (!st) return;
    const family = (st.getPropertyValue('font-family') || '').replace(/["']/g, '').trim();
    if (!family || fontFaces.length >= 30) return;
    const srcRaw = st.getPropertyValue('src') || '';
    const url = (srcRaw.match(/url\(([^)]+)\)/) || [])[1]?.replace(/["']/g, '').trim() || '';
    const fmt = (srcRaw.match(/format\(([^)]+)\)/) || [])[1]?.replace(/["']/g, '').trim() || '';
    fontFaces.push({
      family,
      weight: (st.getPropertyValue('font-weight') || 'normal').trim(),
      style: (st.getPropertyValue('font-style') || 'normal').trim(),
      display: (st.getPropertyValue('font-display') || '').trim(),
      format: fmt,
      url: url.slice(0, 200),
    });
  };

  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; } // 교차 출처 CSS는 접근 불가
    if (!rules) continue;
    for (const rule of rules) {
      try {
        if (rule.media && rule.media.mediaText) collectMediaRule(rule);
        else if (rule.constructor.name === 'CSSFontFaceRule' || rule.type === 5) collectFontFace(rule);
        else if (rule.selectorText) collectStyleRule(rule);
      } catch (e) { /* 개별 규칙 파싱 실패 무시 */ }
    }
  }

  /* ---------- hover 시뮬레이션 (JS 구동 스타일 한정) ----------
     CSS :hover 의사클래스는 JS 이벤트로 발동되지 않으므로, 여기서 잡히는 것은
     mouseover 리스너로 스타일을 바꾸는 CSS-in-JS/JS 구동 사이트뿐이다.
     스타일시트 기반 :hover는 위의 hoverRules(정적 파싱)가 담당한다. */
  const jsHoverDiffs = [];
  try {
    const targets = buttonEls.slice(0, 5);
    for (const el of targets) {
      const before = styleSnapshot(el);
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const after = styleSnapshot(el);
      el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      const diff = {};
      for (const k of Object.keys(before)) {
        if (before[k] !== after[k]) diff[k] = { from: before[k], to: after[k] };
      }
      if (Object.keys(diff).length) {
        jsHoverDiffs.push({ sample: (el.textContent || '').trim().slice(0, 30), diff });
        if (jsHoverDiffs.length >= 3) break;
      }
    }
  } catch (e) { /* 무시 */ }

  /* ---------- 결과 조립 ---------- */
  // body가 반투명/투명이어도 조상 합성으로 실제 표시 배경을 얻는다
  const effectiveBg = resolvedBg(document.body);

  return {
    meta: {
      url: location.href,
      title: document.title,
      analyzedAt: new Date().toISOString(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      elementsScanned: limit,
    },
    theme: {
      isDark: luminance(effectiveBg) < 0.3,
      pageBackground: toHex(effectiveBg),
    },
    colors: {
      backgrounds: topEntries(bgColors, 8).map(([hex, w]) => ({ hex, weight: Math.round(w) })),
      texts: topEntries(textColors, 8).map(([hex, n]) => ({ hex, count: n })),
      borders: topEntries(borderColors, 5).map(([hex, n]) => ({ hex, count: n })),
      links: topEntries(linkColors, 3).map(([hex, n]) => ({ hex, count: n })),
      gradients: topEntries(gradients, 4).map(([g, n]) => ({ gradient: g, count: n })),
    },
    typography: {
      families: topEntries(fontFamilies, 5).map(([f, n]) => ({ family: f, count: n })),
      sizes: topEntries(fontSizes, 12).map(([s, n]) => ({ px: s, count: n })).sort((a, b) => a.px - b.px),
      weights: topEntries(fontWeights, 6).map(([w, n]) => ({ weight: w, count: n })),
      headings: headingStyles,
      body: bodyStyle,
    },
    components: {
      buttons: buttonVariants,
      input: inputStyle,
      card: cardStyle,
      nav: navStyle,
      badge: badgeStyle,
      formControls,
      table: tableStyle,
      // 컴포넌트 일관성: 감지 수 / 스타일 변형 수 / 최다 스타일 커버 수 — 문서 표기·린트에 사용
      consistency: {
        buttons: consistencyOf(buttonEls.length, btnClusters),
        cards: consistencyOf(cardCandidates.length, cardClusters),
        inputs: consistencyOf(inputEls.length, inputClusters),
        badges: consistencyOf(badgeCandidates.length, badgeClusters),
      },
      linkUnderline,
      hoverRules,
      focusRules,
      jsHoverDiffs,
    },
    layout: {
      spacingScale: topEntries(snapScale(spacings), 14).map(([v, n]) => ({ px: v, count: n })).sort((a, b) => a.px - b.px),
      gaps: topEntries(snapScale(gaps), 8).map(([v, n]) => ({ px: v, count: n })).sort((a, b) => a.px - b.px),
      gridCount, flexCount, totalContainers,
      containerWidths: topEntries(containerWidths, 4).map(([v, n]) => ({ px: v, count: n })),
    },
    depth: {
      shadows: topEntries(shadows, 6).map(([s, n]) => ({ shadow: s, count: n })),
      radii: topEntries(snapScale(radii), 8).map(([r, n]) => ({ px: r, count: n })).sort((a, b) => a.px - b.px),
      zIndices: topEntries(zIndices, 8).map(([z, n]) => ({ z, count: n })).sort((a, b) => a.z - b.z),
      transitions: topEntries(transitions, 4).map(([t, n]) => ({ duration: t, count: n })),
      borderWidths: topEntries(borderWidths, 5).map(([px, n]) => ({ px, count: n })).sort((a, b) => a.px - b.px),
      opacities: topEntries(opacities, 6).map(([v, n]) => ({ value: v, count: n })).sort((a, b) => a.value - b.value),
    },
    motion: {
      durations: topEntries(transitions, 4).map(([t, n]) => ({ duration: t, count: n })),
      easings: topEntries(easings, 4).map(([e, n]) => ({ easing: e, count: n })),
      animations: topEntries(animations, 6).map(([a, n]) => ({ name: a, count: n })),
    },
    responsive: {
      breakpoints: topEntries(breakpoints, 8).map(([px, n]) => ({ px, count: n })).sort((a, b) => a.px - b.px),
    },
    icons,
    a11y,
    cssVars,
    darkVars,
    fontFaces,
    _utils: null,
  };
}

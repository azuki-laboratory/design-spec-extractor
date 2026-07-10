// popup.js — 사이드패널 UI. 버튼으로 현재 탭 분석(단일/누적 병합), 미리보기, 내보내기.
// 패널이라 안 닫힘 → analyses가 메모리에 유지된다.
// 배포 빌드는 host_permissions가 없으므로 분석 전 optional_host_permissions를 런타임 요청한다
// (버튼 클릭=사용자 제스처라 permissions.request 허용). 개발 빌드는 host_permissions 선언으로 무프롬프트.

const $ = (id) => document.getElementById(id);
let analyses = [];      // 누적된 페이지별 분석 결과
let outputs = {};       // 버튼 id -> 생성된 문자열 (현재 분석 기준)
let lastTab = null;     // 스크린샷 대상
let lastData = null;    // 에이전트 프롬프트 복사용 (현재 병합/필터된 data)

// 사용자 옵션 — 설정 페이지(options.html)에서 chrome.storage.sync에 저장.
// 기본값은 options.js와 동일하게 유지할 것.
const DEFAULT_OPTS = { lang: 'en', maxElements: 4000, saveAsDialog: true, includeDarkPalette: true };
let opts = { ...DEFAULT_OPTS };
const t = () => AZUKI_T(opts.lang); // 현재 언어 UI 문자열

async function loadOpts() {
  try {
    const stored = await chrome.storage.sync.get(DEFAULT_OPTS);
    opts = { ...DEFAULT_OPTS, ...stored };
  } catch (e) {
    opts = { ...DEFAULT_OPTS };
  }
  applyI18n(document, opts.lang);
}

// 산출물 레지스트리 — 새 포맷은 여기 한 줄만 추가하면 배선·다운로드·미리보기가 자동 연결된다.
// fn(data) => 문자열. win: E2E 검증용 window 전역 이름(선택).
const EXPORTERS = [
  { id: 'download', file: 'DESIGN.md', mime: 'text/markdown', fn: (d) => DesignGenerator.generate(d, opts.lang), preview: true },
  { id: 'download-css', file: 'tokens.css', mime: 'text/css', fn: (d) => DesignGenerator.exportTokens(d, opts.lang).css, win: '__tokensCss' },
  { id: 'download-json', file: 'tokens.json', mime: 'application/json', fn: (d) => DesignGenerator.exportTokens(d, opts.lang).json, win: '__tokensJson' },
  { id: 'download-html', file: 'preview.html', mime: 'text/html', fn: (d) => DesignGenerator.exportPreview(d, opts.lang), win: '__previewHtml' },
  { id: 'download-tw', file: 'tailwind.config.js', mime: 'text/javascript', fn: (d) => DesignGenerator.exportTailwind(d, opts.lang), win: '__tailwindCfg' },
  { id: 'download-passport', file: 'passport.svg', mime: 'image/svg+xml', fn: (d) => DesignGenerator.exportPassport(d, opts.lang), win: '__passportSvg' },
];

// 분석 대상 탭에 접근할 host 권한 확보.
// 개발(host_permissions 선언) → 즉시 true. 배포(optional만) → 최초 1회 권한 팝업.
// permissions.request는 사용자 제스처(버튼 클릭) 직후 첫 await로 호출해야 한다.
async function ensureHostAccess() {
  try {
    return await chrome.permissions.request({ origins: ['http://*/*', 'https://*/*'] });
  } catch (e) {
    return false;
  }
}

async function findTargetTab() {
  // 사이드패널은 자체 컨텍스트라 currentWindow가 패널 오픈 시점 탭에 고착될 수 있다.
  // lastFocusedWindow(사용자가 마지막으로 조작한 콘텐츠 창)를 우선으로 현재 활성 탭을 매번 새로 조회.
  const pickActive = async (q) => {
    const [tab] = await chrome.tabs.query(q);
    if (!tab) return null;
    if (tab.url && !/^https?:/.test(tab.url)) return null;
    return tab;
  };
  let tab = (await pickActive({ active: true, lastFocusedWindow: true }))
    || (await pickActive({ active: true, currentWindow: true }));
  if (tab) return tab;
  // 폴백: popup이 일반 탭으로 열린 경우(E2E 등) 가장 최근 접근한 http(s) 탭.
  const candidates = (await chrome.tabs.query({}))
    .filter((tb) => !tb.url || /^https?:/.test(tb.url))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return candidates[0] || null;
}

function render() {
  let data = DesignGenerator.merge(analyses);
  // 옵션: 다크 팔레트 미포함 시 darkVars 제거 → generator가 관련 블록을 건너뜀
  if (!opts.includeDarkPalette) data = { ...data, darkVars: [] };
  lastData = data;
  outputs = {};
  let previewText = '';
  for (const e of EXPORTERS) {
    outputs[e.id] = e.fn(data);
    if (e.win) window[e.win] = outputs[e.id]; // E2E 검증용 노출
    if (e.preview) previewText = outputs[e.id];
  }

  // 병합된 페이지 목록 — 누적 상태를 눈으로 확인
  const pages = $('pages');
  pages.innerHTML = '';
  analyses.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'page';
    row.title = a.meta.url;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = i + 1;
    const tt = document.createElement('span');
    tt.className = 't';
    tt.textContent = a.meta.title || a.meta.url;
    row.append(n, tt);
    pages.appendChild(row);
  });
  pages.style.display = analyses.length > 1 ? 'block' : 'none';

  // Azuki 시그니처: 마스코트 촌평 + 디자인 DNA 칩
  const mascotEl = $('mascot');
  mascotEl.textContent = DesignGenerator.mascotComment(data, opts.lang);
  mascotEl.style.display = 'block';
  const dnaEl = $('dna');
  dnaEl.innerHTML = '';
  DesignGenerator.computeDNA(data, opts.lang).forEach((tag) => {
    const s = document.createElement('span');
    s.textContent = tag;
    dnaEl.appendChild(s);
  });
  dnaEl.style.display = 'flex';
  // 디자인 지문 코드
  const fp = DesignGenerator.designFingerprint(data);
  const fpEl = $('fingerprint');
  fpEl.textContent = fp;
  fpEl.style.display = 'block';
  window.__fingerprint = fp; // E2E 검증용
  window.__agentPrompt = DesignGenerator.exportAgentPrompt(data, opts.lang); // E2E 검증용

  $('preview').textContent = previewText;
  $('result').style.display = 'block';
  $('add').style.display = 'inline-block';
  $('status').className = '';
  $('status').textContent = analyses.length > 1
    ? t().doneMerged(analyses.length, data.meta.elementsScanned)
    : t().doneSingle(data.meta.elementsScanned);
}

async function runAnalysis(accumulate) {
  const status = $('status');
  $('analyze').disabled = true;
  $('add').disabled = true;
  status.className = '';
  status.textContent = t().statusAnalyzing;

  try {
    // 제스처 직후 첫 await로 권한 확보(배포: 최초 1회 팝업).
    const granted = await ensureHostAccess();
    if (!granted) throw new Error(t().errNoPermission);

    const tab = await findTargetTab();
    if (!tab) throw new Error(t().errNoTab);
    lastTab = tab;

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: analyzePage, // analyzer.js의 자기완결 함수
      args: [{ maxElements: opts.maxElements }],
    });
    if (!result) throw new Error(t().errNoResult);

    if (accumulate) {
      // 같은 URL 재분석이면 교체, 아니면 추가
      analyses = analyses.filter((a) => a.meta.url !== result.meta.url);
      analyses.push(result);
    } else {
      analyses = [result];
    }
    status.textContent = t().statusGenerating;
    render();
  } catch (e) {
    status.className = 'error';
    status.textContent = t().errPrefix + (e.message || e);
  } finally {
    $('analyze').disabled = false;
    $('add').disabled = false;
  }
}

$('analyze').addEventListener('click', () => runAnalysis(false));
$('add').addEventListener('click', () => runAnalysis(true));

// 설정 페이지 열기
const settingsBtn = $('open-settings');
if (settingsBtn) settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

// 옵션 로드 후, 패널 유지 중 옵션이 바뀌면 반영(이미 분석 결과가 있으면 재렌더)
loadOpts();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const k in changes) if (k in opts) opts[k] = changes[k].newValue;
  if ('lang' in changes) applyI18n(document, opts.lang);
  if (analyses.length) render();
});

$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(outputs['download'] || '');
  $('copy').textContent = t().copied;
  setTimeout(() => ($('copy').textContent = t().copy), 1500);
});

// Azuki 시그니처: 에이전트 프롬프트 브릿지 — 바로 붙여넣는 프롬프트 복사
$('copy-agent').addEventListener('click', async () => {
  if (!lastData) return;
  await navigator.clipboard.writeText(DesignGenerator.exportAgentPrompt(lastData, opts.lang));
  $('copy-agent').textContent = t().agentCopied;
  setTimeout(() => ($('copy-agent').textContent = t().agentCopy), 1800);
});

// 생성된 preview.html(추출 토큰 카탈로그)을 새 탭에서 바로 보기 — 추출 정확도 육안 확인.
$('open-preview').addEventListener('click', () => {
  const html = outputs['download-html'];
  if (!html) return;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  chrome.tabs.create({ url });
});

function downloadText(content, filename, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: opts.saveAsDialog }, () => {
    URL.revokeObjectURL(url);
  });
}

// 레지스트리 기반 다운로드 배선
for (const e of EXPORTERS) {
  $(e.id).addEventListener('click', () => downloadText(outputs[e.id], e.file, e.mime));
}

$('download-shot').addEventListener('click', async () => {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(lastTab ? lastTab.windowId : undefined, { format: 'png' });
    chrome.downloads.download({ url: dataUrl, filename: 'screenshot.png', saveAs: opts.saveAsDialog });
  } catch (e) {
    $('status').className = 'error';
    $('status').textContent = t().shotFail + (e.message || e);
  }
});

// options.js — 설정 페이지 로직. chrome.storage.sync에 사용자 옵션 저장/복원.
// 기본값은 popup.js의 DEFAULT_OPTS와 동일하게 유지할 것. UI 문자열은 i18n.js.

const DEFAULT_OPTS = { lang: 'en', maxElements: 4000, saveAsDialog: true, includeDarkPalette: true };
const CONTACT_EMAIL = 'lab.azukki@gmail.com';

const $ = (id) => document.getElementById(id);

// 폼 <-> 옵션 매핑
function readForm() {
  let n = parseInt($('maxElements').value, 10);
  if (!Number.isFinite(n)) n = DEFAULT_OPTS.maxElements;
  n = Math.min(20000, Math.max(100, n));
  return {
    lang: $('lang').value === 'ko' ? 'ko' : 'en',
    maxElements: n,
    saveAsDialog: $('saveAsDialog').checked,
    includeDarkPalette: $('includeDarkPalette').checked,
  };
}

function writeForm(o) {
  $('lang').value = o.lang === 'ko' ? 'ko' : 'en';
  $('maxElements').value = o.maxElements;
  $('saveAsDialog').checked = o.saveAsDialog;
  $('includeDarkPalette').checked = o.includeDarkPalette;
}

// 현재 언어로 정적 UI + 제목 + 버전 + mailto 갱신
function applyLang(lang) {
  applyI18n(document, lang);
  const t = AZUKI_T(lang);
  document.title = t.optTitle;
  let ver = '';
  try { ver = chrome.runtime.getManifest().version; } catch (e) {}
  $('ver').textContent = ver ? `v${ver} · ${t.verWord}` : t.verWord;
  const subject = encodeURIComponent(t.mailSubject);
  const body = encodeURIComponent(`\n\n---\nversion: v${ver}\nUA: ${navigator.userAgent}`);
  $('mailto').href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

function flashSaved() {
  const saved = $('saved');
  saved.classList.add('show');
  setTimeout(() => saved.classList.remove('show'), 1500);
}

async function load() {
  const o = { ...DEFAULT_OPTS, ...(await chrome.storage.sync.get(DEFAULT_OPTS)) };
  writeForm(o);
  applyLang(o.lang);
}

async function save() {
  const o = readForm();
  writeForm(o); // 정규화된 값 반영
  await chrome.storage.sync.set(o);
  applyLang(o.lang);
  flashSaved();
}

// 커스텀 옵션은 "저장"을 눌러야 반영됨(언어 포함).
$('save').addEventListener('click', save);
// 기본값으로 = 즉시 초기화 + 저장 + 반영.
$('reset').addEventListener('click', async () => {
  writeForm(DEFAULT_OPTS);
  await chrome.storage.sync.set(DEFAULT_OPTS);
  applyLang(DEFAULT_OPTS.lang);
  flashSaved();
});

load();

// background.js — service worker (개발·배포 공용)
//
// 역할:
//   1. 툴바 Azuki 아이콘 클릭 → 현재 창의 사이드패널 열기.
//   2. 개발(load unpacked) 시 파일 변경 자동 리로드 (installType 게이트로 배포에선 비활성).
//
// 분석은 패널(popup.js)에서 버튼 클릭 시 수행한다. 배포 빌드는 host_permissions가 없으므로
// 패널이 optional_host_permissions를 런타임에 요청(버튼 클릭=제스처)해 executeScript 권한을 얻는다.

chrome.action.onClicked.addListener((tab) => {
  // default_popup을 두지 않았으므로 onClicked가 발화한다. 제스처 컨텍스트에서 즉시 open.
  if (tab && tab.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});

// --- 개발용 자동 리로드 (구 hotreload.js) ---
const filesInDirectory = (dir) =>
  new Promise((resolve) =>
    dir.createReader().readEntries((entries) =>
      Promise.all(
        entries
          .filter((e) => e.name[0] !== '.')
          .map((e) => (e.isDirectory ? filesInDirectory(e) : new Promise((r) => e.file(r))))
      )
        .then((files) => [].concat(...files))
        .then(resolve)
    )
  );

const timestampForFilesInDirectory = (dir) =>
  filesInDirectory(dir).then((files) => files.map((f) => f.name + f.lastModifiedDate).join());

function watchChanges(dir, lastTimestamp) {
  timestampForFilesInDirectory(dir).then((timestamp) => {
    if (!lastTimestamp || timestamp === lastTimestamp) {
      setTimeout(() => watchChanges(dir, timestamp), 1000);
    } else {
      chrome.runtime.reload();
    }
  });
}

chrome.management.getSelf((self) => {
  if (self.installType === 'development') {
    chrome.runtime.getPackageDirectoryEntry((dir) => watchChanges(dir));
  }
});

// 检查更新：每次启动时查一次 GitHub Releases，之后每 12 小时再查一次（Memo 常驻托盘，很少真正重启）。
// 只读取版本号、下载安装包（Windows 约 70MB），不上传任何数据。
//
// - Windows：后台自动下载新版本，下好后弹通知；点通知立即重启更新，不点就在下次重启 Memo 时自动安装。
// - Mac：Mac 的自动更新要求苹果开发者签名，我们只有免费的临时签名，所以只提醒有新版本，点通知打开下载页。
// - 只在打包安装的版本里运行（开发运行 / 自检模式不检查）。
const { app, Notification, shell } = require('electron');

const OWNER = 'yihan498';
const REPO = 'memo';
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases/latest`;
const RECHECK_MS = 12 * 60 * 60 * 1000;

function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  if (onClick) n.on('click', onClick);
  n.show();
}

/** 'v1.10.0' > 'v1.9.2' */
function isNewer(latest, current) {
  const a = String(latest).replace(/^v/, '').split('.').map(Number);
  const b = String(current).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

function setupWindows() {
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { console.warn('electron-updater missing', e); return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  let announced = null;
  autoUpdater.on('update-downloaded', (info) => {
    if (announced === info.version) return;
    announced = info.version;
    notify(`Memo ${info.version} 已下载好`, '点这里立即重启更新；不点的话，下次重启 Memo 时自动安装', () => {
      autoUpdater.quitAndInstall(); // 会先触发 before-quit，main.js 据此放行关窗
    });
  });
  autoUpdater.on('error', (e) => console.warn('update check failed', e && e.message));
  const check = () => autoUpdater.checkForUpdates().catch(() => {}); // 没网就安静跳过，下次再查
  check();
  setInterval(check, RECHECK_MS);
}

function setupMac() {
  let announced = null;
  const check = async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Memo-update-check' }
      });
      if (!res.ok) return;
      const { tag_name: tag } = await res.json();
      if (!tag || tag === announced || !isNewer(tag, app.getVersion())) return;
      announced = tag;
      notify(`Memo 有新版本 ${tag}`, '点这里打开下载页，下载新的 dmg 覆盖安装即可（数据会保留）', () => shell.openExternal(RELEASES_URL));
    } catch { /* 没网就安静跳过 */ }
  };
  check();
  setInterval(check, RECHECK_MS);
}

function setupUpdates() {
  if (!app.isPackaged || process.env.TODO_DATA_DIR) return;
  if (process.platform === 'win32') setupWindows();
  else if (process.platform === 'darwin') setupMac();
}

module.exports = { setupUpdates, isNewer };

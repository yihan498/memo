const { app, BrowserWindow, Menu, Tray, ipcMain, screen, nativeImage, Notification, globalShortcut, clipboard } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Fix for GPU crash with transparent windows
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Windows 通知需要 AppUserModelId
// 只给 CI 自检用：GitHub 的 Windows Server 打包机上 GPU 进程的沙箱会崩溃（0xC0000005），窗口出不来
if (process.env.TODO_DATA_DIR && process.env.TODO_DEBUG_NO_GPU) {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('no-sandbox');
}
app.setAppUserModelId('com.tianyihan.memo'); // 必须和 package.json 的 appId 一致，否则 Windows 安装版弹不出通知

// 开发调试：TODO_DATA_DIR 指定独立数据目录，避免污染真实数据
// 数据目录固定为 %APPDATA%/desktop-todo，改名 / 打包都不会丢数据
if (process.env.TODO_DATA_DIR) app.setPath('userData', process.env.TODO_DATA_DIR);
else app.setPath('userData', path.join(app.getPath('appData'), 'desktop-todo'));

// Initialize store for settings
const store = new Store({
  defaults: {
    windowBounds: { width: 320, height: 480, x: 100, y: 100 },
    alwaysOnTop: true,
    theme: 'dark'
  }
});

const isMac = process.platform === 'darwin';
/** 快捷键文字按平台显示（Mac：Ctrl → ⌘，Alt → ⌥），和 renderer 的 utils/helpers.js keyLabel 一致 */
const keyLabel = (s) => (isMac && s ? String(s).replace(/Ctrl(?=[ +]\(?(Shift\)? )?Tab)/g, '⌃').replace(/Ctrl/g, '⌘').replace(/Alt/g, '⌥') : s);
const ASSETS = path.join(__dirname, '..', 'assets');

let mainWindow;
let tray;
let isQuitting = false;
let savedHeight = 480;
let isCompactMode = false;

// 收集模式（Ctrl+Alt+Shift+V 开 / 关）：开着时每复制一段新文字，自动收进想法
// 电脑微信多选消息后不能复制，只能一条条右键复制，这样就不用每条再按一次快捷键
const COLLECT_POLL_MS = 400;
const COLLECT_IDLE_MS = 10 * 60 * 1000; // 10 分钟没有新复制就自动结束，免得忘了关
let collect = null; // { timer, last, lastAt }

function stopCollect() {
  if (!collect) return;
  clearInterval(collect.timer);
  collect = null;
  if (tray) tray.setToolTip(keyLabel('Memo（Ctrl+Alt+D 呼出）'));
  if (mainWindow) mainWindow.webContents.send('collect', false);
}

function startCollect() {
  collect = { last: clipboard.readText(), lastAt: Date.now() }; // 开始前剪贴板里的旧内容不收
  collect.timer = setInterval(() => {
    const text = clipboard.readText();
    if (text !== collect.last) {
      collect.last = text;
      collect.lastAt = Date.now();
      if (text.trim() && mainWindow) mainWindow.webContents.send('clip-idea', text, true);
    } else if (Date.now() - collect.lastAt > COLLECT_IDLE_MS) stopCollect();
  }, COLLECT_POLL_MS);
  if (tray) tray.setToolTip(keyLabel('Memo · 收集中（Ctrl+Alt+Shift+V 结束）'));
  if (mainWindow) mainWindow.webContents.send('collect', true);
}

/**
 * 置顶 / 取消置顶。置顶：浮在所有窗口上，Mac 上还跟着切到每个桌面、浮在全屏软件上面。
 * 不置顶就是普通窗口：Mac 上原来不管置不置顶都设了「出现在所有桌面和全屏软件上」，
 * 结果取消置顶后切到别的桌面或全屏软件时它还会跟过去挡在前面，所以这一项也跟着置顶走。
 * （Windows 没有这个设置，那一句在 Windows 上不起作用。）
 */
function applyPin(on) {
  if (on) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    mainWindow.setAlwaysOnTop(false);
    // skipTransformProcessType：不然 Electron 会把 Memo 变回普通程序，Dock 栏里多出一个图标
    mainWindow.setVisibleOnAllWorkspaces(false, { skipTransformProcessType: true });
  }
}

function createWindow() {
  // Get stored window bounds or use defaults
  const bounds = store.get('windowBounds');
  const alwaysOnTop = store.get('alwaysOnTop', true);

  // Create the browser window
  mainWindow = new BrowserWindow({
    show: !process.env.TODO_DATA_DIR, // 调试实例稍后用 showInactive 显示
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 280,
    maxWidth: 400,
    minHeight: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: alwaysOnTop,
    resizable: true,
    skipTaskbar: true, // 只在托盘显示，不占任务栏（托盘图标 / Ctrl+Alt+D 呼出）
    icon: path.join(ASSETS, isMac ? 'icon-png.png' : 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // 隐藏到托盘时定时器照常跑（跨天重置、晚间检查）
      backgroundThrottling: false
    }
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 调试实例（设了 TODO_DATA_DIR）：显示时不抢焦点，避免你在别处打字时按键落进测试窗口；
  // TODO_DEBUG_EVAL 指向一个 js 文件时，页面加载后在渲染进程执行它（模拟输入用）
  if (process.env.TODO_DATA_DIR) {
    mainWindow.once('ready-to-show', () => mainWindow.showInactive());
    if (process.env.TODO_DEBUG_EVAL) {
      mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
          mainWindow.webContents.executeJavaScript(require('fs').readFileSync(process.env.TODO_DEBUG_EVAL, 'utf8')).catch(e => console.error(e));
        }, 1500);
      });
    }
  }

  applyPin(alwaysOnTop);

  // Handle window events
  mainWindow.on('close', (event) => {
    // 贴边收着时退出：先恢复原样，存下来的才是展开时的大小，下次启动不会是一条竖条
    if (dock) setDocked(false);
    // Save window bounds
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', isCompactMode ? { ...bounds, height: savedHeight } : bounds);
    }

    // 关闭 = 隐藏到托盘，保证提醒继续工作；真正退出走托盘菜单
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Make window draggable from anywhere
  mainWindow.setMovable(true);

  // Development tools
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  let trayIcon;

  try {
    // Mac 不认 .ico，且菜单栏图标要缩到 18pt；Mac 上程序坞图标已隐藏，托盘图标出不来就只能靠快捷键找到窗口
    trayIcon = isMac
      ? nativeImage.createFromPath(path.join(ASSETS, 'icon-png.png')).resize({ width: 18, height: 18 })
      : nativeImage.createFromPath(path.join(ASSETS, 'icon.ico'));

    if (trayIcon.isEmpty()) {
      console.log('No valid icon found for tray');
      return;
    }

    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示',
        click: () => mainWindow.show()
      },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip(keyLabel('Memo（Ctrl+Alt+D 呼出）'));
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });

  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our existing window instead.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // App event handlers
  app.whenReady().then(() => {
    if (process.platform === 'darwin') {
    app.dock.hide();
  }
  
  // 打包安装后开机自启（开发模式下不注册，避免把 electron.exe 加进启动项）
  if (app.isPackaged && !process.env.TODO_DATA_DIR) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  createWindow();
  createTray();
  require('./updater').setupUpdates(); // 启动时查一次新版本（只在安装版里），见 updater.js

  // 全局快捷键：任何地方按 Ctrl+Alt+D 呼出 / 隐藏（被别的软件占用时静默跳过）
  try {
    globalShortcut.register('CommandOrControl+Alt+D', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    });
  } catch (e) { console.warn('globalShortcut failed', e); }
  // Ctrl+Alt+I：任何地方呼出窗口并直接进入「想法」输入框
  try {
    globalShortcut.register('CommandOrControl+Alt+I', () => {
      if (!mainWindow) return;
      mainWindow.show(); mainWindow.focus(); setDocked(false);
      mainWindow.webContents.send('quick-idea');
    });
  } catch (e) { console.warn('globalShortcut failed', e); }
  // Ctrl+Alt+H：贴边收起 / 展开；窗口藏在托盘里时，按它 = 拿出来并展开
  try {
    globalShortcut.register('CommandOrControl+Alt+H', () => {
      if (!mainWindow) return;
      if (!mainWindow.isVisible()) { mainWindow.show(); setDocked(false); return; }
      setDocked(!dock);
    });
  } catch (e) { console.warn('globalShortcut failed', e); }
  // Ctrl+Alt+V：把剪贴板文字收进「想法」，不弹出窗口（手机发到微信文件传输助手 → 电脑微信右键复制 → 按它）
  try {
    const ok = globalShortcut.register('CommandOrControl+Alt+V', () => {
      if (!mainWindow) return;
      mainWindow.webContents.send('clip-idea', clipboard.readText());
    });
    const ok2 = globalShortcut.register('CommandOrControl+Alt+Shift+V', () => (collect ? stopCollect() : startCollect()));
    if (!ok2 && Notification.isSupported()) {
      new Notification({ title: keyLabel('Ctrl+Alt+Shift+V 被别的软件占用'), body: '收集模式用不了，告诉 Claude 换个快捷键' }).show();
    }
    // 被别的软件占用时 register 返回 false（不抛错），要明说，否则按了没反应也不知道为什么
    if (!ok && Notification.isSupported()) {
      new Notification({ title: keyLabel('Ctrl+Alt+V 被别的软件占用'), body: '剪贴板收进想法用不了，告诉 Claude 换个快捷键' }).show();
    }
  } catch (e) { console.warn('globalShortcut failed', e); }

  // 自检（CI 在没有真机的系统上用，见 .github/scripts/smoke.sh）：TODO_DEBUG_OUT 指向输出目录时，
  // 按 TODO_DEBUG_SHOTS（秒，逗号分隔）截取窗口自身内容，最后写 status.json（托盘、全局快捷键是否就绪）并退出
  if (process.env.TODO_DATA_DIR && process.env.TODO_DEBUG_OUT) {
    const fs = require('fs');
    const out = process.env.TODO_DEBUG_OUT;
    fs.mkdirSync(out, { recursive: true });
    const shots = (process.env.TODO_DEBUG_SHOTS || '5').split(',').map(Number).filter(n => n > 0);
    shots.forEach((sec, i) => setTimeout(async () => {
      try {
        const img = await mainWindow.webContents.capturePage();
        fs.writeFileSync(path.join(out, `shot${i + 1}.png`), img.toPNG());
      } catch (e) { console.error('capture failed', e); }
      if (i === shots.length - 1) {
        const keys = ['CommandOrControl+Alt+D', 'CommandOrControl+Alt+I', 'CommandOrControl+Alt+V', 'CommandOrControl+Alt+Shift+V'];
        fs.writeFileSync(path.join(out, 'status.json'), JSON.stringify({
          platform: process.platform, arch: process.arch, electron: process.versions.electron,
          tray: !!tray, windowVisible: !!mainWindow && mainWindow.isVisible(),
          shortcuts: Object.fromEntries(keys.map(k => [k, globalShortcut.isRegistered(k)]))
        }, null, 2));
        isQuitting = true;
        app.exit(0);
      }
    }, sec * 1000));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Keep running in tray
    }
  });
}

// IPC handlers
ipcMain.handle('get-store-value', (event, key, defaultValue) => {
  return store.get(key, defaultValue);
});

ipcMain.handle('set-store-value', (event, key, value) => {
  store.set(key, value);
});

ipcMain.handle('toggle-always-on-top', () => {
  const current = mainWindow.isAlwaysOnTop();
  applyPin(!current);
  store.set('alwaysOnTop', !current);
  return !current;
});

ipcMain.handle('minimize-window', () => {
  mainWindow.hide(); // Hide to tray instead of standard minimize
});

ipcMain.handle('close-window', () => {
  mainWindow.close();
});

// 收起：height = 标题栏 + 正在计时的行数（计时开始 / 结束时 renderer 会再调一次调整高度）
ipcMain.handle('set-compact-mode', function compactHandler(event, isCompact, height = 46) {
  if (!mainWindow) return;
  // 贴边收着时不改窗口大小（不然竖条会被撑回 280 宽），记下最后一次，展开回来再补上
  if (dock) { queuedCompact = () => compactHandler(event, isCompact, height); return; }
  const bounds = mainWindow.getBounds();
  if (isCompact) {
    if (!isCompactMode) savedHeight = bounds.height; // 已收起时只改高度，不覆盖展开高度
    isCompactMode = true;
    mainWindow.setMinimumSize(280, height);
    mainWindow.setSize(bounds.width, height, true);
  } else {
    isCompactMode = false;
    mainWindow.setSize(bounds.width, savedHeight, true);
    mainWindow.setMinimumSize(280, 400);
  }
});

// 标题栏由页面自己拖动（透明窗口的系统拖动区收不到双击，页面改成自己拖，双击标题栏才能收起）。
// 宽高用按下时的值一起给：单用 setPosition 在 Windows 缩放屏上会让窗口越挪越宽
ipcMain.on('move-window', (event, x, y, width, height) => {
  if (!mainWindow || dock) return;
  if (width && height) mainWindow.setBounds({ x, y, width, height });
  else mainWindow.setPosition(x, y);
});

// ---------- 贴边收起：窗口缩成屏幕右边缘的一条竖条，点竖条回到原来的位置和大小 ----------
// 双击收起键 / Ctrl+Alt+H 切换。只改窗口大小和位置，置顶照旧
// Windows 不让窗口窄于 32px：窗口给 DOCK_W，实际可能更宽，多出来的部分伸到屏幕外，竖条在页面里写死 18px 宽
const DOCK_W = 18, DOCK_H = 44;
let dock = null;          // 收着时 = { bounds, min, wa }：收起前的位置大小、最小尺寸，贴的那块屏的工作区
let dockY = null;         // 竖条上下拖过之后停的位置，下次收起还放这里（不退出就一直记着）
let queuedCompact = null; // 收着期间想改的收起高度（计时开始 / 结束），展开后补做

function moveDock(y) {
  const wa = dock.wa;
  dockY = Math.round(Math.min(Math.max(y, wa.y), wa.y + wa.height - DOCK_H));
  mainWindow.setBounds({ x: wa.x + wa.width - DOCK_W, y: dockY, width: DOCK_W, height: DOCK_H });
}

function setDocked(on) {
  if (!mainWindow || mainWindow.isDestroyed() || on === !!dock) return;
  if (on) {
    const b = mainWindow.getBounds();
    const wa = screen.getDisplayMatching(b).workArea; // 窗口在哪块屏，就贴哪块屏的右边（不压任务栏）
    dock = { bounds: b, min: mainWindow.getMinimumSize(), wa };
    mainWindow.webContents.send('docked', true); // 先让页面换成竖条，再缩窗口
    mainWindow.setMinimumSize(1, 1);
    moveDock(dockY ?? b.y);
  } else {
    const d = dock;
    dock = null;
    mainWindow.setBounds(d.bounds);
    mainWindow.setMinimumSize(d.min[0], d.min[1]);
    if (queuedCompact) { const q = queuedCompact; queuedCompact = null; q(); }
    mainWindow.webContents.send('docked', false);
  }
}

ipcMain.on('toggle-dock', () => setDocked(!dock));
ipcMain.on('dock-move', (event, y) => { if (dock) moveDock(y); });

ipcMain.handle('notify', (event, title, body) => {
  if (!Notification.isSupported()) return false;
  const n = new Notification({
    title, // 快捷键文字由 renderer 在固定文案上换好，这里不碰用户内容（待办名、剪贴板文字）
    body,
    icon: path.join(ASSETS, 'icon-png.png')
  });
  n.on('click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
  n.show();
  return true;
});

app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => { stopCollect(); globalShortcut.unregisterAll(); });

ipcMain.handle('get-screen-size', () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.workAreaSize;
});

// 给本机扩展入口用（如在别的快捷键里先展开竖条）
module.exports = { setDocked, isDocked: () => !!dock };

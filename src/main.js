const { app, BrowserWindow, Menu, Tray, ipcMain, screen, nativeImage, Notification, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Fix for GPU crash with transparent windows
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Windows 通知需要 AppUserModelId
app.setAppUserModelId('Memo');

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

let mainWindow;
let tray;
let isQuitting = false;
let savedHeight = 480;
let isCompactMode = false;

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
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'), // Set application icon
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

  // Aggressively enforce always on top and workspaces
  if (alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Handle window events
  mainWindow.on('close', (event) => {
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
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico');
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(iconPath);

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

    tray.setToolTip('Memo（Ctrl+Alt+D 呼出）');
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
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  createWindow();
  createTray();

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
      mainWindow.show(); mainWindow.focus();
      mainWindow.webContents.send('quick-idea');
    });
  } catch (e) { console.warn('globalShortcut failed', e); }

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
  if (!current) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    mainWindow.setAlwaysOnTop(false);
  }
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
ipcMain.handle('set-compact-mode', (event, isCompact, height = 46) => {
  if (!mainWindow) return;
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

ipcMain.handle('notify', (event, title, body) => {
  if (!Notification.isSupported()) return false;
  const n = new Notification({
    title,
    body,
    icon: path.join(__dirname, '..', 'assets', 'icon-png.png')
  });
  n.on('click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
  n.show();
  return true;
});

app.on('before-quit', () => { isQuitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());

ipcMain.handle('get-screen-size', () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.workAreaSize;
});

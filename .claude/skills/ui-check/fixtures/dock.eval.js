// 贴边收起：1 秒后收到屏幕右边，再过 4 秒展开。（截图时间用 "2,5,9"：第一张要在收起前，工具靠它找到窗口）
setTimeout(() => window.electronAPI.toggleDock(), 1000);
setTimeout(() => window.electronAPI.toggleDock(), 5000);

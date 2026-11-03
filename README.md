# desktop-todo · 今日事

**是什么**：Windows 桌面置顶小窗，管两类事——每日常规（一天内完成即可）+ 零碎待办。
**为什么做**：自用，提醒自己完成每日动作，零碎事项不丢。
**当前状态**：v0.1 可用（2026-11-03），基于 [flost8](https://github.com/singharyan006/flost8)（MIT）改造。

## 功能
- **每日常规**：每天 0 点自动重置为未完成；昨天没做完的会挂红色「上次未完成」标记。
- **最近 7 天圆点**：绿 = 全部完成，红 = 有遗漏（悬停看漏了哪些），灰 = 无记录，蓝圈 = 今天。
- **晚间检查**（默认 21:30，可在每日页修改）：到点还有没做完的 → 弹 Windows 系统通知，每天一次。
- **零碎待办**：原版功能，可清除已完成。
- 关闭按钮 = 隐藏到托盘（提醒继续工作）；托盘右键「退出」才真正退出。打包安装后开机自启。

## 运行（在 Windows 侧，不要在 WSL 里）
```cmd
cd /d D:\cc_workstation\workstation\projects\personal\desktop-todo
npm install        :: 慢的话先 set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm start          :: 开发运行
npm test           :: 跑每日逻辑测试
npm run build:win  :: 打包安装程序到 dist/
```

## 代码地图
- `src/renderer/services/dailyManager.js` — 跨天重置 / 历史 / 检查提醒，纯函数，有测试
- `src/renderer/app.js` — 状态、视图切换、每 30 秒 tick
- `src/main.js` — 窗口、托盘、系统通知（`notify` IPC）
- 新样式写在 `index.html` 的 `<style>` 里（`styles.css` 是预编译 Tailwind，新加的 Tailwind 类不会生效）

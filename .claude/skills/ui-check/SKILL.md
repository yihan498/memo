---
name: ui-check
description: Visually verify Memo's real UI after a change — launches an isolated debug instance on Windows (from WSL) with seeded data, optionally simulates input, screenshots the window at chosen times, then kills only that instance. Use after any change to renderer HTML/CSS/components, or to reproduce a UI bug the user reports.
---

# ui-check: 看真实界面，而不只是跑单测

**为什么要有它：** `npm test` 只覆盖纯函数（解析、分组、计时）。布局挤掉按钮、
分区框没画出来、倒计时条不动这类问题，只有截图才看得到。手工做容易出四种事故，
所以全部写进了脚本：

| 事故 | 脚本里怎么防 |
|------|------|
| 测试数据写进用户的真实数据 | `TODO_DATA_DIR=<项目>/.testdata`，每次运行先清空（已 gitignore） |
| 测试窗口抢焦点，用户打的字落进去 | 调试实例用 `showInactive()` 显示；运行结束打印 `FOCUS unchanged/CHANGED` |
| 误杀用户正在用的 Memo | 只杀「路径在本项目下 **且** 启动时间晚于本次运行」的 electron 进程 |
| 截到用户的私人屏幕内容 | 用 `PrintWindow` 只取测试窗口自身的内容，**不用 `CopyFromScreen`**（后者按屏幕坐标截，测试窗口被挡住时截到的是别人的窗口——真出过事） |

## 用法（在 WSL 里，项目根目录）

```bash
S=.claude/skills/ui-check
$S/ui-check.sh <seed.json> [eval.js|-] [截图秒数,逗号分隔]

$S/ui-check.sh $S/fixtures/daily-countdown.json - 5,16                     # 倒计时：16 秒时 1 分钟项应已到点沉底
$S/ui-check.sh $S/fixtures/todo-areas.json - 4                             # 待办分区 + 已完成分区沉底
$S/ui-check.sh $S/fixtures/todo-areas.json $S/fixtures/quick-add.eval.js 4 # 一句话添加 → 已填好的表单
```

运行后用 Read 看输出的 `PNG` 路径（`.testdata/shots/shotN.png`）。**下次运行会清空**，
要对比前后图就先复制到 scratchpad。

## 写新的 seed（初始数据）

seed 就是 electron-store 的 `config.json`。关键字段见 `src/renderer/app.js` 的 `PERSIST_KEYS`：
`view`（daily/todo/records）、`lastResetDate`、`tasks`。占位符：

- `__TODAY__`：今天的 `YYYY-MM-DD`。`lastResetDate` 一定用它，否则启动时会触发跨天重置
- `__AGO_<秒>__`：UTC ISO 时间。`runningSince: "__AGO_1500__"` 表示已计时 25 分钟
- `__LOCAL_<±分钟>__`：本地时间，格式 `YYYY-MM-DDTHH:MM`，用于待办的 `dueAt` / `plannedAt`
- 没写 `windowBounds` 时自动放在 x=700，避开用户放在 100,100 附近的 Memo

任务字段参照现有 fixtures：daily 用 `targetMin / countdown / sessions / runningSince / area`；
todo 用 `dueAt / plannedAt / remindBefore / important / urgent / area`。

## 写 eval（模拟操作）

页面加载 1.5 秒后，eval 在渲染进程里执行（见 `src/main.js`）。

- 用 `dispatchEvent` 触发事件，**不要调 `.focus()`**：实测会让测试窗口变成前台窗口
- 截图时间点要排在 eval 执行（约 2.5 秒）之后，建议 ≥ 4 秒

## 看图时检查什么

- 底部输入行的「+」按钮没被挤出去
- 分区框完整，已完成的分区是绿色虚线框、排在最下面
- 文字没被截断，深色主题下颜色可读
- 时间相关的显示和 seed 对得上

## 注意

- 前提：Windows 侧已经 `npm install`，存在 `node_modules/electron/dist/electron.exe`
- `capture.ps1` 必须保存为 **UTF-8 带 BOM**。Windows PowerShell 5 读不带 BOM 的文件时按 GBK 解析，
  中文注释会把语法搞坏（报 `MissingCatchOrFinally`）。用 Write 改完要重新加 BOM：
  `printf '\xef\xbb\xbf' | cat - capture.ps1 > t && mv t capture.ps1`
- 显示器缩放约 200%。脚本按物理像素截图，默认缩小一半输出
- 截图里如果出现的不是 Memo，立刻删掉，不要描述内容，然后排查截图方式
- 鼠标悬停在测试窗口上时，截图里可能带 tooltip，属正常

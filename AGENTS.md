# 给 AI agent 的改造说明

> For AI coding agents (Claude Code, Codex, Cursor…): this file tells you how to customize Memo for your user. It is written in Chinese; the rules and file paths below are what matter.

Memo 欢迎你按自己的习惯改。代码是 MIT 协议，fork 下来让你的 AI agent 改成你想要的样子，完全允许，不需要问作者。这份文件写给替你动手的 agent：先读完它，再动代码。

## 一、Memo 是什么，用什么写的
- Windows 桌面置顶小窗（Mac 是测试版），四个页面：每日常规 / 零碎待办 / 记录 / 想法。功能全表和每项的代码位置见 `docs/features.md`，用户视角的说明见 `README.md`
- Electron 27 + 原生 JavaScript（ES modules），**没有前端框架，渲染进程没有构建步骤**：改完 `src/renderer/` 下的文件，重启就生效
- 数据全部存在本机一个 JSON 文件里（electron-store），不联网；联网只有检查更新

## 二、动手前必须守住的四条
1. **不碰用户的真实数据**。调试时设环境变量 `TODO_DATA_DIR` 指向一个独立目录（例如项目下的 `.testdata/`，已 gitignore），Memo 就会读写那里，而不是 `%APPDATA%\desktop-todo`。设了它的实例显示时不抢焦点，适合边开着真 Memo 边调试
2. **数据要向后兼容**。已有的 key（`tasks`、`dailyHistory`、`todoLog`、`ideas` 等，见 `docs/features.md`「数据长什么样」）不改名、不改含义；加字段就加成可选的，读的时候给默认值。数据目录名 `desktop-todo` 故意没改，改了用户的旧记录就找不到了
3. **改逻辑就跑测试**。规则都写成了 `src/renderer/services/` 下的纯函数，用例在 `tests/`，`npm test` 跑全部。改规则先加一条能复现的用例，再改代码
4. **自己打包的版本，先改掉更新源**。`package.json` 的 `build.publish` 指向原作者的仓库，安装版每 12 小时会去那里查新版本并自动安装——不改的话，你改好的版本会被官方版本覆盖。二选一：把 `owner` / `repo` 改成你自己的 fork（然后在自己的 fork 发 Release），或者在 `src/updater.js` 里直接 `return` 掉检查。只用 `npm start` 运行的不受影响（未打包时不查更新）

## 三、常见的改法去哪里改
| 想改的 | 去哪里 |
|------|------|
| 颜色、深浅色 | `src/renderer/index.html` 的 `<style>`：颜色全是 `:root` 变量（`--accent` 等），深色在 `html.dark` 下覆盖一份。别在组件里写死颜色 |
| 晚间检查的默认时间（21:30） | `src/renderer/app.js` 的初始状态 `checkTime`；判断逻辑在 `services/dailyManager.js` |
| 一句话添加能认的说法 | `services/quickParse.js`（纯本地正则），用例 `tests/parse.test.mjs`。遇到认错的句子，先加进用例再改规则 |
| 提醒的提前量选项 | `services/todoSort.js` 的 `REMIND_OPTIONS`（截止提醒）和 `PLAN_REMIND_OPTIONS`（计划提醒）；默认值在 `components/TodoForm.js` |
| 待办排序和分组 | `services/todoSort.js`（`sortTodos` 四象限、`sortTodosByTime` 按时间、`dayGroup` 分组） |
| 分区怎么分组、排序 | `services/areas.js` |
| 计时、0 点重置、历史记录 | `services/dailyManager.js` |
| 记录页的统计口径 | `services/records.js`（计算）+ `components/Records.js`（渲染） |
| 想法页 | `services/ideas.js` + `components/Ideas.js` |
| 窗口内快捷键 | `src/renderer/app.js` 的 `setupKeyboardShortcuts()`，帮助面板也在那里 |
| 全局快捷键（`Ctrl+Alt+D` / `I` / `V`，收集模式 `Ctrl+Alt+Shift+V`） | `src/main.js` 里的 `globalShortcut.register` |
| 窗口宽度（280–400） | `src/main.js` 的 `minWidth` / `maxWidth` |
| 开机自启 | `src/main.js` 的 `setLoginItemSettings`（安装版每次启动都会打开自启，想关就删掉或改成 `false`） |
| 系统通知 | 渲染进程调 `window.electronAPI.notify(title, body)`，主进程在 `src/main.js` 的 `notify` IPC 里弹 |
| 新增一个要保存的状态 | 加进 `src/renderer/app.js` 的 `PERSIST_KEYS`，并给默认值 |

主进程和页面之间只通过 `src/preload.js` 暴露的 `window.electronAPI` 通信；要新增系统能力（读文件、调系统接口），在 `src/main.js` 加 `ipcMain.handle`，再在 `preload.js` 暴露出来，不要在渲染进程里开 Node 权限。

## 四、怎么跑、怎么验证
在 Windows 侧运行（不要在 WSL 里跑 Electron），需要 Node.js 20：
```cmd
npm install
npm test           :: 逻辑测试
npm start          :: 开发运行
npm run build:win  :: 打包安装程序到 dist/
```
- 改了界面，要真的打开看一眼：`set TODO_DATA_DIR=%CD%\.testdata` 后 `npm start`，在隔离数据里操作。再设 `TODO_DEBUG_EVAL` 指向一个 js 文件，页面加载 1.5 秒后会在页面里执行它，可以用来模拟输入、点击
- 作者自己用的界面截图测试在 `.claude/skills/ui-check/`（从 WSL 驱动 Windows 截图），环境一样的话可以直接用，不一样就参考它的做法：隔离数据 → 启动 → 模拟输入 → 只截测试窗口 → 只关测试实例

## 五、改完之后
- 装回自己电脑：`npm run build:win` 出的安装包直接覆盖安装，记录都在（数据不在安装目录里）。别忘了第二节第 4 条
- 觉得改法别人也用得上，欢迎在原仓库提 issue 或 PR；不提也完全没关系

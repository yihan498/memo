#!/usr/bin/env bash
# Memo 界面测试（从 WSL 运行）：准备隔离数据 → Windows 侧启动调试实例 → 定时截图 → 关掉调试实例。
#
# 用法：
#   ui-check.sh <seed.json> [eval.js] [shots]
#     seed.json  初始数据（electron-store 的 config.json）。支持占位符：
#                  __TODAY__          今天 YYYY-MM-DD
#                  __AGO_<秒>__       <秒> 之前的 UTC ISO 时间（造「正在计时」的状态）
#                  __LOCAL_<±分钟>__   本地 datetime-local 'YYYY-MM-DDTHH:MM'（待办的截止 / 计划时间）
#                没写 windowBounds 时自动放到 x=700，避开你正在用的 Memo
#     eval.js    可选：页面加载 1.5 秒后在渲染进程执行（模拟输入 / 点击）；不需要时传 -
#     shots      可选：逗号分隔的截图时间点（秒，从启动算起），默认 5
# 输出：<项目>/.testdata/shots/shotN.png（.testdata 已 gitignore；下次运行会清空）
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$(cd "$SKILL_DIR/../../.." && pwd)"
SEED="${1:?usage: ui-check.sh <seed.json> [eval.js|-] [shots]}"
EVAL="${2:--}"
SHOTS="${3:-5}"
DATA="$PROJECT/.testdata"

[ -f "$SEED" ] || { echo "seed not found: $SEED" >&2; exit 1; }
[ -f "$PROJECT/node_modules/electron/dist/electron.exe" ] || { echo "electron.exe missing: run npm install on the Windows side" >&2; exit 1; }

rm -rf "$DATA"
mkdir -p "$DATA/shots"

# 填占位符
python3 - "$SEED" "$DATA/config.json" <<'PY'
import sys, re, json, datetime as dt
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
s = s.replace('__TODAY__', dt.date.today().isoformat())
now = dt.datetime.now(dt.timezone.utc)
s = re.sub(r'__AGO_(\d+)__', lambda m: (now - dt.timedelta(seconds=int(m.group(1)))).strftime('%Y-%m-%dT%H:%M:%S.000Z'), s)
loc = dt.datetime.now()
s = re.sub(r'__LOCAL_([+-]?\d+)__', lambda m: (loc + dt.timedelta(minutes=int(m.group(1)))).strftime('%Y-%m-%dT%H:%M'), s)
cfg = json.loads(s)
cfg.setdefault('windowBounds', {'width': 380, 'height': 620, 'x': 700, 'y': 60})
cfg.setdefault('alwaysOnTop', False)
open(dst, 'w', encoding='utf-8').write(json.dumps(cfg, ensure_ascii=False, indent=2))
PY

EVAL_WIN=""
if [ "$EVAL" != "-" ]; then
  [ -f "$EVAL" ] || { echo "eval not found: $EVAL" >&2; exit 1; }
  cp "$EVAL" "$DATA/eval.js"
  EVAL_WIN="$(wslpath -w "$DATA/eval.js")"
fi

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w "$SKILL_DIR/capture.ps1")" \
  -Project "$(wslpath -w "$PROJECT")" \
  -DataDir "$(wslpath -w "$DATA")" \
  -Out "$(wslpath -w "$DATA/shots")" \
  -Eval "$EVAL_WIN" \
  -Shots "$SHOTS" | tr -d '\r'

ls "$DATA/shots"/*.png 2>/dev/null | sed 's/^/PNG /' || echo "no screenshots produced"

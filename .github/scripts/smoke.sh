#!/usr/bin/env bash
# 在 CI 的真机系统上（目前是 GitHub 的 macOS 打包机）把打好的 Memo 打开、跑几个场景、截窗口图。
# 复用 .claude/skills/ui-check/fixtures 里的初始数据和模拟操作；截图由 App 自己截（main.js 的 TODO_DEBUG_OUT），
# 不需要系统录屏权限。用法：smoke.sh <可执行文件> <输出目录> [期望的 arch，如 x64]
# 任一场景没写出 status.json、托盘没建好、窗口没显示或全局快捷键没注册上，整个脚本 exit 1，让 CI 失败、不发布。
set -uo pipefail
BIN="$1"; OUT="$2"; ARCH="${3:-}"
FIX=.claude/skills/ui-check/fixtures
mkdir -p "$OUT"
FAILED=0

seed() { # seed.json → 填好占位符的 config.json
  python3 - "$1" "$2" <<'PY'
import sys, re, json, datetime as dt
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
s = s.replace('__TODAY__', dt.date.today().isoformat())
now = dt.datetime.now(dt.timezone.utc)
s = re.sub(r'__AGO_(\d+)__', lambda m: (now - dt.timedelta(seconds=int(m.group(1)))).strftime('%Y-%m-%dT%H:%M:%S.000Z'), s)
loc = dt.datetime.now()
s = re.sub(r'__DAY_([+-]?\d+)__', lambda m: (loc + dt.timedelta(days=int(m.group(1)))).strftime('%Y-%m-%d'), s)
s = re.sub(r'__LOCAL_([+-]?\d+)__', lambda m: (loc + dt.timedelta(minutes=int(m.group(1)))).strftime('%Y-%m-%dT%H:%M'), s)
cfg = json.loads(s)
cfg.setdefault('windowBounds', {'width': 380, 'height': 620, 'x': 200, 'y': 80})
cfg.setdefault('alwaysOnTop', False)
open(dst, 'w', encoding='utf-8').write(json.dumps(cfg, ensure_ascii=False, indent=2))
PY
}

run() { # 名字 seed eval(或 -) 截图秒数
  local name=$1 data; data="$(mktemp -d)"
  seed "$FIX/$2" "$data/config.json"
  local ev=""; [ "$3" != "-" ] && ev="$PWD/$FIX/$3"
  echo "== $name"
  TODO_DATA_DIR="$data" TODO_DEBUG_EVAL="$ev" TODO_DEBUG_OUT="$OUT/$name" TODO_DEBUG_SHOTS="$4" "$BIN" &
  local pid=$!
  sleep 3; command -v screencapture >/dev/null && screencapture -x "$OUT/$name-screen.png" 2>/dev/null
  for _ in $(seq 1 40); do kill -0 $pid 2>/dev/null || break; sleep 1; done
  kill $pid 2>/dev/null
  local st="$OUT/$name/status.json"
  if [ ! -f "$st" ]; then echo "!! $name 没有写出 status.json（App 没起来或崩了）"; FAILED=1; return; fi
  cat "$st"; echo
  python3 - "$st" "$ARCH" <<'PY2' || FAILED=1
import json, sys
s = json.load(open(sys.argv[1], encoding='utf-8'))
bad = [k for k in ('tray', 'windowVisible') if not s.get(k)] + [k for k, v in (s.get('shortcuts') or {}).items() if not v]
if not s.get('shortcuts'): bad.append('shortcuts(空)')
if len(sys.argv) > 2 and sys.argv[2] and s.get('arch') != sys.argv[2]: bad.append(f"arch={s.get('arch')}，期望 {sys.argv[2]}")
if bad: print('!! 不通过：', ', '.join(bad)); sys.exit(1)
PY2
}

run daily   two-timers.json     -                      4
run compact compact-timers.json compact-timers.eval.js 4,8
run help    ideas.json          help.eval.js           4
ls -R "$OUT"
[ "$FAILED" = 0 ] && echo "== 自检通过" || echo "== 自检失败"
exit "$FAILED"

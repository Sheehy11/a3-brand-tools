#!/bin/zsh
set -u
unsetopt BG_NICE

SCRIPT_DIR=${0:A:h}
PORT=8788
RUNTIME_DIR=${TMPDIR:-/tmp}
PID_FILE="${RUNTIME_DIR%/}/a3-brand-tools-local-proxy.pid"
LOG_FILE="${RUNTIME_DIR%/}/a3-brand-tools-local-proxy.log"

health_ok(){
  /usr/bin/curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/health" 2>/dev/null | /usr/bin/grep -q 'a3-brand-tools-local-proxy'
}

NODE_BIN=$(command -v node 2>/dev/null || true)
if [[ -z "$NODE_BIN" ]]; then
  for CANDIDATE in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do [[ -x "$CANDIDATE" ]] && NODE_BIN="$CANDIDATE" && break; done
fi
if [[ -z "$NODE_BIN" ]]; then
  echo "未找到 Node.js，无法启动本地验收。"
  read "?按回车键关闭窗口。"
  exit 1
fi

if health_ok; then
  echo "A3 内容工具本机转发已在运行。"
  [[ "${A3_NO_OPEN:-0}" == "1" ]] || /usr/bin/open "$SCRIPT_DIR/index.html"
  exit 0
fi

if /usr/sbin/lsof -tiTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 ${PORT} 被其他程序占用。请先双击“停止A3本地验收.command”，再重新启动。"
  read "?按回车键关闭窗口。"
  exit 1
fi

cd "$SCRIPT_DIR" || exit 1
/usr/bin/nohup "$NODE_BIN" "$SCRIPT_DIR/a3-local-proxy.mjs" >>"$LOG_FILE" 2>&1 </dev/null &
SERVER_PID=$!
echo "$SERVER_PID" >"$PID_FILE"

for i in {1..40}; do
  if health_ok; then
    echo "启动成功。正在打开本地内容工具……"
    [[ "${A3_NO_OPEN:-0}" == "1" ]] || /usr/bin/open "$SCRIPT_DIR/index.html"
    exit 0
  fi
  sleep .25
done

echo "启动失败。日志位置：$LOG_FILE"
/bin/kill "$SERVER_PID" 2>/dev/null || true
read "?按回车键关闭窗口。"
exit 1

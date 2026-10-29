#!/bin/zsh
set -u

SCRIPT_DIR=${0:A:h}
RUNTIME_DIR=${TMPDIR:-/tmp}
PID_FILE="${RUNTIME_DIR%/}/a3-brand-tools-local-proxy.pid"
STOPPED=0
PIDS=()
[[ -f "$PID_FILE" ]] && PIDS+=("$(<"$PID_FILE")")
while IFS= read -r LISTENER_PID; do [[ "$LISTENER_PID" == <-> ]] && PIDS+=("$LISTENER_PID");done < <(/usr/sbin/lsof -tiTCP:8788 -sTCP:LISTEN 2>/dev/null)
for PID in ${PIDS[@]}; do
  [[ "$PID" == <-> ]] || continue
  PROCESS_CWD=$(/usr/sbin/lsof -a -p "$PID" -d cwd -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p')
  if [[ "$PROCESS_CWD" == "$SCRIPT_DIR" ]]; then /bin/kill "$PID" 2>/dev/null || true;STOPPED=1;fi
done
/bin/rm -f "$PID_FILE"
if (( STOPPED )); then echo "A3 内容工具本机转发已停止。";else echo "没有发现正在运行的 A3 内容工具本机转发。";fi
sleep 1

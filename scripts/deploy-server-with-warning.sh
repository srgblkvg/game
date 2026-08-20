#!/usr/bin/env bash
set -euo pipefail

# Safe production server deploy: announce, wait, re-check dungeon runs, restart.

HOST="root@194.226.142.237"
WAIT_SECONDS="${DEPLOY_WARNING_SECONDS:-120}"
MESSAGE="${DEPLOY_WARNING_MESSAGE:-⚠️ Сервер будет перезапущен через 2 минуты для обновления. Завершите походы в подземелье.}"

require_cmd() { command -v "$1" >/dev/null || { echo "Не найдена команда: $1" >&2; exit 1; }; }
require_cmd sshpass
require_cmd rsync
require_cmd curl
require_cmd node

if [[ -z "${SSHPASS:-}" ]]; then
  echo 'Перед запуском задайте SSHPASS в окружении.' >&2
  exit 1
fi

remote_admin_token() {
  sshpass -e ssh "$HOST" "cd /opt/game/server && node -e \"require('dotenv').config({path:'.env',quiet:true}); process.stdout.write(require('jsonwebtoken').sign({role:'admin',adminId:0}, process.env.JWT_SECRET))\""
}

admin_api() {
  local method="$1" path="$2" body="${3:-}"
  local token
  token="$(remote_admin_token)"
  if [[ -n "$body" ]]; then
    curl -fsS -X "$method" --oauth2-bearer "${token}" -H 'Content-Type: application/json' --data "$body" "https://mmoarena.ru$path"
  else
    curl -fsS --oauth2-bearer "${token}" "https://mmoarena.ru$path"
  fi
}

active_runs() {
  admin_api GET /api/admin/chat/deploy-status | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).activeDungeonRuns)))"
}

echo 'Сборка сервера...'
(cd server && npm run build)

before="$(active_runs)"
echo "Активных походов перед предупреждением: $before"

warning_body="$(MESSAGE="$MESSAGE" node -p 'JSON.stringify({content: process.env.MESSAGE})')"
admin_api POST /api/admin/chat/system-message "$warning_body" >/dev/null
echo "Предупреждение отправлено. Ожидание ${WAIT_SECONDS} секунд..."
sleep "$WAIT_SECONDS"

after="$(active_runs)"
if [[ "$after" != "0" ]]; then
  echo "Принудительно завершаю активные походы: $after"
  finish_result="$(admin_api POST /api/admin/chat/deploy-finish-dungeons '{}')"
  echo "Результат завершения: $finish_result"
fi

final_runs="$(active_runs)"
if [[ "$final_runs" != "0" ]]; then
  echo "Деплой остановлен: после force-finish остались активные походы: $final_runs" >&2
  exit 2
fi

sshpass -e rsync -avz server/dist/ "$HOST:/opt/game/server/dist/"
sshpass -e ssh "$HOST" 'pm2 flush && pm2 restart game-server'
sshpass -e ssh "$HOST" 'curl -fsS http://127.0.0.1:3002/api/time >/dev/null && pm2 show game-server >/dev/null'
echo 'Безопасный server deploy завершён.'
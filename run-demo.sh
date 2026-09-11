#!/usr/bin/env bash
# Lance FleetPro en mode démo.
#   backend NestJS  : http://localhost:3011/api
#   frontend Next.js: http://localhost:3021   (proxifie /api -> backend)
# Une seule URL à exposer publiquement : le port 3021 (VS Code : Ports -> Forward 3021 -> Public).
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Arrêt d'une éventuelle instance précédente…"
[ -f "$ROOT/backend/demo.pid" ]  && kill "$(cat "$ROOT/backend/demo.pid")"  2>/dev/null || true
[ -f "$ROOT/frontend/demo.pid" ] && kill "$(cat "$ROOT/frontend/demo.pid")" 2>/dev/null || true
pkill -f "PORT=3011 node dist/main.js" 2>/dev/null || true
pkill -f "next start -p 3021" 2>/dev/null || true
sleep 1

echo "▶ Postgres…"
docker start fleet-postgres >/dev/null 2>&1 || true
for i in $(seq 1 30); do
  docker exec fleet-postgres pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

echo "▶ Backend (build + seed)…"
cd "$ROOT/backend"
npm run build
npm run seed
( PORT=3011 node dist/main.js > "$ROOT/backend/demo.log" 2>&1 & echo $! > "$ROOT/backend/demo.pid" )

echo "▶ Frontend (build + start :3021)…"
cd "$ROOT/frontend"
npm run build
( npx next start -p 3021 > "$ROOT/frontend/demo.log" 2>&1 & echo $! > "$ROOT/frontend/demo.pid" )

echo "▶ Vérification…"
for i in $(seq 1 30); do
  curl -sf http://localhost:3021/api/vehicles >/dev/null 2>&1 && break
  sleep 1
done

echo
echo "✅ Prêt :  http://localhost:3021"
echo "   Backend $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3011/api/vehicles) · Frontend $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3021/)"
echo "   Logs :  backend/demo.log  ·  frontend/demo.log"
echo "   Stop :  kill \$(cat backend/demo.pid) \$(cat frontend/demo.pid)"
echo
echo "➡  VS Code : panneau PORTS → Forward a Port → 3021 → clic droit → Port Visibility : Public"

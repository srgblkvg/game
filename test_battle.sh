#!/bin/bash
set -e

echo "=== Creating guest ==="
GUEST=*** -s http://localhost:3001/api/guest -X POST -H "Content-Type: application/json")
echo "$GUEST" | python3 -m json.tool
TOKEN=*** "$GUEST" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "=== Before battle ==="
curl -s http://localhost:3001/api/character/me -H "Authorization: Bearer *** | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'level={d[\"level\"]}, exp={d[\"exp\"]}')
"

echo "=== Finding opponent ==="
OPP=$(curl -s "http://localhost:3001/api/arena/opponent" -H "Authorization: Bearer *** | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [ -z "$OPP" ]; then
    echo "No opponent found, trying direct battle"
    curl -s http://localhost:3001/api/battle -X POST -H "Authorization: Bearer *** -H "Content-Type: application/json" -d '{}' | python3 -m json.tool
else
    echo "Opponent: $OPP"
    echo "=== Battle ==="
    curl -s http://localhost:3001/api/battle -X POST -H "Authorization: Bearer *** -H "Content-Type: application/json" -d "{\"opponentId\":$OPP}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'winnerId={d.get(\"winnerId\")}, expGained={d.get(\"expGained\")}, newLevel={d.get(\"newLevel\")}, newExp={d.get(\"newExp\")}')
print(f'error={d.get(\"error\", \"none\")}')
"
fi

echo "=== After battle ==="
curl -s http://localhost:3001/api/character/me -H "Authorization: Bearer *** | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'level={d[\"level\"]}, exp={d[\"exp\"]}')
"

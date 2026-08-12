#!/bin/bash
D=/opt/game/backups
mkdir -p $D/uploads $D/env $D/db

# Uploads
tar czf "$D/uploads/uploads-$(date +%Y%m%d-%H%M).tgz" -C /opt/game/server uploads

# .env
cp /opt/game/server/.env "$D/env/.env-$(date +%Y%m%d-%H%M)"

# Database
PGPASSWORD=game123 pg_dump -h localhost -U game -d game -Fc > "$D/db/game-$(date +%Y%m%d-%H%M).dump"

# keep last 72 hourly (3 days) / 7 daily for DB
ls -t $D/uploads/*.tgz 2>/dev/null | tail -n +73 | xargs -r rm
ls -t $D/env/.env-* 2>/dev/null | tail -n +73 | xargs -r rm
ls -t $D/db/*.dump 2>/dev/null | tail -n +169 | xargs -r rm

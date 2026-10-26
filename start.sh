#!/bin/bash
# Start SWK OS from the folder this script lives in. Set APP_SECRET (and the other settings in .env.example) in the environment first.
cd "$(dirname "$0")"
export NODE_ENV=production
export PORT=8080
export DATA_DIR="${DATA_DIR:-$PWD/data}"
export PUBLIC_URL=https://os.swkpropertiesuae.com
export TRUST_PROXY=true
export COOKIE_SECURE=true
export APP_TIMEZONE=Asia/Dubai
export BASE_CURRENCY=AED
export APP_SECRET="${APP_SECRET:?Set APP_SECRET before starting}"

exec /usr/bin/node dist/server/index.mjs

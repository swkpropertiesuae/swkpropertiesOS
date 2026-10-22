#!/bin/bash
cd /home/shamhar07/DigitalBurj-OS
export NODE_ENV=production
export PORT=8080
export DATA_DIR=/home/shamhar07/DigitalBurj-OS/data
export PUBLIC_URL=https://os.swkpropertiesuae.com
export TRUST_PROXY=true
export COOKIE_SECURE=true
export APP_TIMEZONE=Asia/Dubai
export BASE_CURRENCY=AED
export APP_SECRET=prod-secret-change-me-32chars!!

exec /usr/bin/node dist/server/index.mjs

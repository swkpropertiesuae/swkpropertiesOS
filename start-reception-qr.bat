@echo off
cd /d "%~dp0"
title SWK Properties — Standalone Reception QR Terminal (No Login Required)

set "PATH=C:\Users\Shahid\.gemini\antigravity\scratch\tools\node;C:\Users\Shahid\.gemini\antigravity\scratch\tools\git\cmd;%PATH%"

if not exist "dist\server\index.mjs" (
    echo Building SWK Properties OS + Standalone Reception QR...
    call npm run build
)

start "" "http://localhost:8080/reception-qr"
node --env-file-if-exists=.env dist/server/index.mjs

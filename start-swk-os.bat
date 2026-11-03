@echo off
cd /d "%~dp0"
title SWK Properties OS + Internal Ollama Studio (Qwen 3.5)

set "PATH=C:\Users\Shahid\.gemini\antigravity\scratch\tools\node;C:\Users\Shahid\.gemini\antigravity\scratch\tools\git\cmd;%PATH%"

if not exist "dist\server\index.mjs" (
    echo Building SWK Properties OS...
    call npm run build
)

start "" "http://localhost:8080/ai"
node --env-file-if-exists=.env dist/server/index.mjs

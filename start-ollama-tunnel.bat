@echo off
cd /d "%~dp0"
title SWK Properties OS - Cloudflare Zero Trust Domain Tunnel

powershell -ExecutionPolicy Bypass -Command ^
  "$exe = Join-Path $PWD 'cloudflared.exe'; " ^
  "if (-not (Test-Path $exe)) { " ^
  "  Write-Host 'Downloading official cloudflared client for Windows...' -ForegroundColor Yellow; " ^
  "  Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $exe -UseBasicParsing; " ^
  "}; " ^
  "Write-Host '============================================================' -ForegroundColor Cyan; " ^
  "Write-Host '  SWK Properties OS + Internal Ollama Tunnel (Port 8080)' -ForegroundColor Cyan; " ^
  "Write-Host '============================================================' -ForegroundColor Cyan; " ^
  "Write-Host '1. Instant Mobile HTTPS Link (Quick Tunnel)'; " ^
  "Write-Host '2. Custom Company Domain (os.swkpropertiesuae.com / ai.swkpropertiesuae.com) via Tunnel Token'; " ^
  "$c = Read-Host 'Select 1 or 2 (default 1)'; " ^
  "if ($c -eq '2') { " ^
  "  $tok = Read-Host 'Paste your Cloudflare Tunnel Token'; " ^
  "  & $exe tunnel --no-autoupdate run --token $tok.Trim(); " ^
  "} else { " ^
  "  & $exe tunnel --url http://localhost:8080; " ^
  "}"
pause

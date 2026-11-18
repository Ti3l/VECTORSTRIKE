@echo off
setlocal
cd /d "%~dp0"
title VECTOR STRIKE - JOGAR ONLINE COM AMIGOS
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instale Node.js 22.12 ou superior.
  pause
  exit /b 1
)
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo.
  echo Para criar o link HTTPS, instale cloudflared pelo PowerShell:
  echo   winget install -e --id Cloudflare.cloudflared
  echo.
  echo Depois feche e abra o terminal novamente e execute este .bat.
  echo Ajuda: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
  echo.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Instalando dependencias na primeira execucao...
  call npm install
  if errorlevel 1 (
    echo ERRO: npm install falhou.
    pause
    exit /b 1
  )
)
call npm run online
if errorlevel 1 (
  echo.
  echo O modo online terminou com erro. Leia JOGAR-ONLINE-LEIA-ME.md
  pause
  exit /b 1
)
pause

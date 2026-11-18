@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Instale o Node.js 22.12 ou superior e abra este arquivo novamente.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo Instalando dependencias para o VECTOR STRIKE V1.8.1...
  call npm install
  if errorlevel 1 (
    echo ERRO: A instalacao falhou. Confira a conexao com a internet.
    pause
    exit /b 1
  )
)
echo Iniciando VECTOR STRIKE V1.8.1...
call npm run dev
pause

@echo off
chcp 65001 >nul
setlocal
title Sahba
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [!] Node.js is not installed.
  echo      Install Node.js 22 or newer from https://nodejs.org  ^(LTS^), then run start.bat again.
  echo  [!] Node.js غير مثبّت. ثبّت Node.js نسخة 22 أو أحدث من https://nodejs.org ثم شغّل start.bat من جديد.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 22 (
  echo.
  echo  [!] Your Node.js is too old: v%NODE_MAJOR%. Sahba needs Node.js 22 or newer.
  echo      Update it from https://nodejs.org  ^(LTS^), then run start.bat again.
  echo  [!] نسخة Node.js عندك قديمة. سَحبة بتحتاج نسخة 22 أو أحدث — حدّثها من https://nodejs.org
  echo.
  pause
  exit /b 1
)

if "%PORT%"=="" set PORT=8900
echo.
echo  Sahba is starting on http://127.0.0.1:%PORT%
echo  سَحبة شغّالة — خلّي هالنافذة مفتوحة. للإيقاف: سكّرها أو اضغط Ctrl+C.
echo.

start "" /min cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:%PORT%/"
node app\server.mjs
if errorlevel 1 (
  echo.
  echo  [!] The server stopped with an error. If the port is busy, close the other Sahba window and try again.
  echo  [!] السيرفر وقف بخطأ. إذا البورت مستخدم، سكّر نافذة سَحبة الثانية وجرّب مرة ثانية.
  pause
)
endlocal

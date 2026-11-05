#!/bin/bash
# Sahba — macOS launcher.
# First time only: open Terminal in this folder and run:  chmod +x start.command
# (or right-click → Open, if macOS blocks it the first time)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo " [!] Node.js is not installed. Install Node.js 22 or newer from https://nodejs.org (LTS), then run start.command again."
  echo " [!] Node.js غير مثبّت. ثبّت Node.js نسخة 22 أو أحدث من https://nodejs.org ثم شغّل start.command من جديد."
  echo ""
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo ""
  echo " [!] Your Node.js is too old: v$NODE_MAJOR. Sahba needs Node.js 22 or newer — update it from https://nodejs.org"
  echo " [!] نسخة Node.js عندك قديمة. سَحبة بتحتاج نسخة 22 أو أحدث — حدّثها من https://nodejs.org"
  echo ""
  read -n 1 -s -r -p "Press any key to close…"
  exit 1
fi

PORT="${PORT:-8900}"
export PORT
echo ""
echo " Sahba is starting on http://127.0.0.1:$PORT"
echo " سَحبة شغّالة — خلّي هالنافذة مفتوحة. للإيقاف: سكّرها أو اضغط Ctrl+C."
echo ""

( sleep 2; open "http://127.0.0.1:$PORT" ) &
node app/server.mjs
STATUS=$?
if [ $STATUS -ne 0 ]; then
  echo ""
  echo " [!] The server stopped with an error. If the port is busy, close the other Sahba window and try again."
  echo " [!] السيرفر وقف بخطأ. إذا البورت مستخدم، سكّر نافذة سَحبة الثانية وجرّب مرة ثانية."
  read -n 1 -s -r -p "Press any key to close…"
fi

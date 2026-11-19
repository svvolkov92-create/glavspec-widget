#!/usr/bin/env bash
# Builds dist/PultServer/install-pult-server.sh: the installer with the whole server inside (one file to copy to the VPS).
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(node -e "process.stdout.write(require('./server/pult-server.js').VERSION)")
OUT=dist/PultServer
STAGE=$(mktemp -d)
P="$STAGE/pult-server"
mkdir -p "$P/lib" "$OUT"
cp server/pult-server.js server/cabinet-server.js server/cabinet-on-base.js "$P/"
cp -r server/web "$P/web"
# The shared code the server runs (rules, interface for the web version, customer page, cabinet client).
for d in core renderer report; do cp -r "src/$d" "$P/lib/$d"; done
cp src/cabinet.js "$P/lib/"
[ -f src/contact.js ] && cp src/contact.js "$P/lib/"
rm -f "$P/lib/renderer/pp87.js"
rm -rf "$P/lib/renderer/app" # the parts of app.js: already in app.js
node tools/build-app.js --check
sed "s/@VERSION@/$VERSION/" server/install.sh.in > "$OUT/install-pult-server.sh"
tar -C "$STAGE" -czf - pult-server | base64 -w 76 >> "$OUT/install-pult-server.sh"
chmod +x "$OUT/install-pult-server.sh"
cp server/README.md "$OUT/ПРОЧТИ-сервер.md"
rm -rf "$STAGE"
ls -la "$OUT"
echo "Сервер Пульта $VERSION: $OUT/install-pult-server.sh"

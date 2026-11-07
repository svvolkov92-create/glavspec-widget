#!/usr/bin/env bash
# Builds the Windows installer package: the app plus a PowerShell script that downloads
# the official Electron runtime from GitHub, verifies its SHA-256 and installs per-user.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/dist"
INST="$OUT/PultGlavspeca-setup"

rm -rf "$INST" "$OUT/PultGlavspeca-setup.zip"
mkdir -p "$INST/app"
cp -r "$ROOT/package.json" "$ROOT/src" "$ROOT/assets" "$INST/app/"
mkdir -p "$INST/app/server" && cp "$ROOT/server/cabinet-server.js" "$INST/app/server/"   # «кабинет на этом компьютере»
printf '\xEF\xBB\xBF' > "$INST/install.ps1"           # BOM: Windows PowerShell 5.1 reads Cyrillic correctly only with it
sed 's/$/\r/' "$ROOT/installer/install.ps1" >> "$INST/install.ps1"
sed 's/$/\r/' "$ROOT/installer/install.cmd" > "$INST/Установить.cmd"
sed 's/$/\r/' "$ROOT/README-win.txt" > "$INST/ПРОЧТИ.txt"

(cd "$OUT" && python3 - <<'EOF'
import os, zipfile
with zipfile.ZipFile('PultGlavspeca-setup.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for base, _, files in os.walk('PultGlavspeca-setup'):
        for f in files:
            z.write(os.path.join(base, f))
EOF
)
echo "Built: $OUT/PultGlavspeca-setup.zip"

# Customer cabinet server: the server script, the shared code it renders with, start scripts and the guide.
SRV="$OUT/KabinetZakazchika-server"
rm -rf "$SRV" "$OUT/KabinetZakazchika-server.zip"
mkdir -p "$SRV/lib/report" "$SRV/lib/renderer/brand" "$SRV/lib/renderer/fonts" "$SRV/data"
cp "$ROOT/server/cabinet-server.js" "$SRV/"
cp "$ROOT/src/report/customer.js" "$SRV/lib/report/"
cp "$ROOT/src/renderer/logic.js" "$ROOT/src/renderer/calendar.js" "$ROOT/src/renderer/composition.js" "$SRV/lib/renderer/"
cp "$ROOT/src/renderer/brand/tandem-logo.svg" "$SRV/lib/renderer/brand/"
cp "$ROOT/src/renderer/fonts/GolosText.ttf" "$ROOT/src/renderer/fonts/Montserrat.ttf" "$ROOT/src/renderer/fonts/OFL-GolosText.txt" "$ROOT/src/renderer/fonts/OFL-Montserrat.txt" "$SRV/lib/renderer/fonts/"
cp "$ROOT/server/package/config.example.json" "$ROOT/server/package/cabinet.service" "$ROOT/server/package/Caddyfile.example" "$SRV/"
for f in "$ROOT/server/package/"*.cmd "$ROOT/server/package/УСТАНОВКА.txt"; do sed 's/$/\r/' "$f" > "$SRV/$(basename "$f")"; done
(cd "$OUT" && python3 - <<'PY'
import os, zipfile
with zipfile.ZipFile('KabinetZakazchika-server.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for base, dirs, files in os.walk('KabinetZakazchika-server'):
        if not files and not dirs:
            z.write(base)  # keep the empty data folder
        for f in files:
            z.write(os.path.join(base, f))
PY
)
echo "Built: $OUT/KabinetZakazchika-server.zip"

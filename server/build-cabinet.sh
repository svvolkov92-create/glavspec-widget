#!/usr/bin/env bash
# Builds dist/KabinetZakazchika-server.zip: the standalone customer cabinet server (the Pult server has its own inside).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
mkdir -p "$OUT"

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

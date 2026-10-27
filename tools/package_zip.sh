#!/usr/bin/env bash
# Lägger allt som hör till en release i en enda zip.
#
# Två filer kan inte ligga i zippen på release-sidan: updates.json och
# SortBro-Thunderbird.xpi. Thunderbird hämtar dem över HTTP och kan inte packa
# upp något – adressen till updates.json är dessutom inbakad i varje redan
# installerad kopia och går inte att ändra i efterhand. Zippen är alltså det
# kompletta paketet för den som vill ha allt på ett ställe, medan de två
# nödvändiga filerna ligger kvar bredvid.
#
#   tools/package_zip.sh            # bygger dist/SortBro-<version>.zip
#
# dist/ är gitignorerad: zippen byggs om vid varje släpp i stället för att
# versionshanteras som binärfil.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

VERSION=$(python3 -c "import json;print(json.load(open('addon/manifest.json'))['version'])")
OUT="dist/SortBro-$VERSION.zip"

for f in SortBro-Thunderbird.xpi SortBro-Thunderbird.xpi.sha256 updates.json Uppdatera-SortBro.bat LAS-MIG.md; do
  [ -f "$f" ] || { echo "saknas: $f" >&2; exit 1; }
done

mkdir -p dist
rm -f "$OUT"
zip -j -X -q "$OUT" \
  SortBro-Thunderbird.xpi \
  SortBro-Thunderbird.xpi.sha256 \
  updates.json \
  Uppdatera-SortBro.bat \
  LAS-MIG.md

echo "$OUT"

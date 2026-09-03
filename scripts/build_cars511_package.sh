#!/usr/bin/env bash
# Rebuild CARS511_Package.zip from the maintained sources.
# The builder shipped in the zip IS the standalone build — packaging a separate
# copy is what let the zip drift a whole generation behind (old schedule,
# cameras, Esri basemap) while the real builder moved on.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$(mktemp -d)"
PKG="$STAGE/CARS511_Package"
mkdir -p "$PKG/docs"

cp "$ROOT/frontend/public/cars511-request-standalone.html" "$PKG/CARS511-Request-Builder.html"
cp "$ROOT/docs/CARS511_PACKAGE_README.txt"                 "$PKG/README.txt"
for f in CARS511_QUICK_REFERENCE.md CARS511_DATABASE_INTEGRATION.md \
         CARS511_project_list_TEMPLATE.csv NV_NE_WORKZONE_IMPROVEMENT_BRIEFING.md; do
  cp "$ROOT/docs/$f" "$PKG/docs/$f"
done

rm -f "$ROOT/CARS511_Package.zip"
(cd "$STAGE" && zip -qr "$ROOT/CARS511_Package.zip" CARS511_Package)
rm -rf "$STAGE"
echo "Built $ROOT/CARS511_Package.zip"
unzip -l "$ROOT/CARS511_Package.zip"

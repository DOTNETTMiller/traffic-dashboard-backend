#!/usr/bin/env bash
# Rebuild DOT_WorkZone_Builders_50states.zip from the maintained sources.
# Every builder in the zip IS its frontend/public source file — nothing is
# copied or forked, so the package cannot drift behind the tool again.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/frontend/public"
OUT="${1:-$ROOT/DOT_WorkZone_Builders_50states.zip}"
STAGE="$(mktemp -d)"

cp "$SRC"/*-wz-request-standalone.html "$STAGE/"      # the 49 state builders
cp "$SRC/cars511-request-standalone.html" "$STAGE/"   # Iowa
cp "$ROOT/docs/50STATE_PACKAGE_README.txt" "$STAGE/README.txt"

n=$(ls -1 "$STAGE"/*-standalone.html | wc -l | tr -d ' ')
if [ "$n" -ne 50 ]; then echo "expected 50 builders, staged $n" >&2; exit 1; fi

rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OUT" .)
rm -rf "$STAGE"
echo "Built $OUT ($n builders)"

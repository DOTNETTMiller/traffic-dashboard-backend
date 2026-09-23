#!/usr/bin/env bash
# Rebuild DOT_WorkZone_Builders_50states.zip from the maintained sources.
# 51 jurisdictions: 49 states, Iowa (iadot) and the District of Columbia (ddot).
# Every builder in the zip IS its frontend/public source file — nothing is
# copied or forked, so the package cannot drift behind the tool again.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/frontend/public"
OUT="${1:-$ROOT/DOT_WorkZone_Builders_50states.zip}"
STAGE="$(mktemp -d)"

cp "$SRC"/*-wz-request-standalone.html "$STAGE/"      # 49 states + Iowa + DC
cp "$ROOT/docs/50STATE_PACKAGE_README.txt" "$STAGE/README.txt"

n=$(ls -1 "$STAGE"/*-standalone.html | wc -l | tr -d ' ')
if [ "$n" -ne 51 ]; then echo "expected 51 builders, staged $n" >&2; exit 1; fi

rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OUT" .)
rm -rf "$STAGE"
echo "Built $OUT ($n builders)"

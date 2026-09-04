#!/usr/bin/env bash
# Sync the maintained work-zone builders into the DTCD dashboard site
# (dashboard.purposebuilt.systems/wz/), which is a separate Vite app in a
# separate repo. Nothing here transforms the files -- the deployed copies are
# byte-identical to the sources, so the site cannot drift behind the tool.
#
# Mapping (verified against what is deployed today):
#   <state>-wz-request-standalone.html  ->  wz/<state>-wz-request.html
#     The site serves the SELF_CONTAINED standalone build under the hosted
#     name; there is no thin hosted variant on the dashboard.
#   cars511-request.html                ->  wz/cars511-request.html
#   cars511-request-standalone.html     ->  wz/cars511-request-standalone.html
#     Iowa maps 1:1 by filename and ships both variants.
#
# Deploy is NOT git-connected. After syncing:
#   cd "$DASH" && npm run build && wrangler pages deploy dist --project-name=dtcd-dashboard
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/frontend/public"
DASH="${DASH:-$ROOT/../../digital-traffic-control-diary/dashboard-v2}"
WZ="$DASH/public/wz"

[ -d "$WZ" ] || { echo "dashboard wz/ not found: $WZ" >&2; exit 1; }

n=0
for f in "$SRC"/*-wz-request-standalone.html; do
  base="$(basename "$f" -wz-request-standalone.html)"
  [ "$base" = "cars511-request" ] && continue
  cp "$f" "$WZ/$base-wz-request.html"; n=$((n+1))
done
cp "$SRC/cars511-request.html"            "$WZ/cars511-request.html"
cp "$SRC/cars511-request-standalone.html" "$WZ/cars511-request-standalone.html"

echo "Synced $n state builders + 2 Iowa variants -> $WZ"
[ "$n" -eq 49 ] || { echo "expected 49 state builders, synced $n" >&2; exit 1; }

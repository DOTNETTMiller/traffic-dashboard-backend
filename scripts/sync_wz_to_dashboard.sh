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
#     Iowa is iadot and goes through the same rule as every other state; it
#     used to be cars511-request*.html and carried its own branch here.
#
# Iowa's old hosted URLs are left behind as redirects, because they are in
# circulation -- in the CARS511 package, in email, on intranet pages. A rename
# we control should not 404 a link someone else is holding.
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
  cp "$f" "$WZ/$base-wz-request.html"; n=$((n+1))
done

# Redirect stubs for Iowa's pre-rename URLs. Relative target, so they work
# wherever wz/ is mounted.
for old in cars511-request cars511-request-standalone; do
  cat > "$WZ/$old.html" <<'HTML'
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Moved - Iowa Work-Zone Request Builder</title>
<link rel="canonical" href="iadot-wz-request.html">
<meta http-equiv="refresh" content="0; url=iadot-wz-request.html">
<style>body{font:16px/1.5 system-ui,sans-serif;margin:3rem auto;max-width:34rem;padding:0 1rem}</style>
<h1>This builder has moved</h1>
<p>Iowa's work-zone request builder is now named like every other state's:
<a href="iadot-wz-request.html">iadot-wz-request.html</a>.</p>
<p>You are being redirected. Please update your bookmark.</p>
</html>
HTML
done

echo "Synced $n builders (49 states + Iowa + DC) -> $WZ"
echo "Left redirects at cars511-request.html and cars511-request-standalone.html"
[ "$n" -eq 51 ] || { echo "expected 51 builders, synced $n" >&2; exit 1; }

#!/usr/bin/env bash
# Build and restart without breaking tabs people already have open:
#  1. a new deployment id (Next reloads old tabs on their next navigation instead of failing)
#  2. the previous build's static files are kept alongside the new ones for a few days
set -euo pipefail
cd "$(dirname "$0")/.."
KEEP=../.static-keep
mkdir -p "$KEEP"
[ -d .next/static ] && rsync -a .next/static/ "$KEEP/"
date +%Y%m%d%H%M%S > .deployment-id
npx next build
rsync -a --ignore-existing "$KEEP/" .next/static/
find "$KEEP" -type f -mtime +3 -delete 2>/dev/null || true
sudo systemctl restart quiet-consensus-app
echo "deployed $(cat .deployment-id)"

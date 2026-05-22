#!/bin/bash
# Pre-warm production routes 5 min before the demo so Vercel cold-start
# latency doesn't hit during the call. Hits each demo page once with a
# realistic User-Agent and reports the response time. Public pages only
# (no auth) — the /portal routes are warm-cached behind Clerk and warm
# from the SSR pass once Adam logs in.
#
# Usage:
#   bash scripts/prewarm-demo.sh
set -e

PAGES=(
  "https://www.leasestack.co/"
  "https://www.leasestack.co/sign-in"
  "https://www.telegraphcommons.com/"
  "https://www.telegraphcommons.com/availability"
  "https://www.telegraphcommons.com/floor-plans"
  "https://www.telegraphcommons.com/contact"
  "https://leasestack.co/embed/popup.js"
  "https://leasestack.co/embed/chatbot.js"
  "https://www.leasestack.co/api/public/popup/config/telegraph-commons"
  "https://www.leasestack.co/api/public/chatbot/config?slug=telegraph-commons"
)

echo "Pre-warming $(( ${#PAGES[@]} )) routes…"
for url in "${PAGES[@]}"; do
  time=$(curl -sL -o /dev/null -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" -w "%{http_code} %{time_total}s" "$url")
  echo "  $url -> $time"
done
echo "Done. Cache is warm."

#!/bin/bash
# E2E smoke test: hit every critical page and API route, verify HTTP status
# Usage: bash __tests__/e2e-routes.sh

BASE="http://localhost:3099"
PASS=0
FAIL=0
ERRORS=""

check() {
  local path="$1"
  local expected="${2:-200}"
  local method="${3:-GET}"

  if [ "$method" = "POST" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$path" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
  else
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path" 2>/dev/null)
  fi

  if [ "$status" = "$expected" ]; then
    echo "  PASS  $method $path → $status"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $method $path → $status (expected $expected)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL  $method $path → $status (expected $expected)"
  fi
}

echo "=== Marketing Pages ==="
check "/"
check "/about"
check "/blog"
check "/demo"
check "/press"
check "/ai-ified"
check "/terms"
check "/privacy"
check "/status"
check "/sitemap.xml"

echo ""
echo "=== Industry Pages ==="
check "/food-beverage"
check "/wine-spirits"
check "/coffee-tea"
check "/seafood-meat"
check "/industrial-supply"
check "/bakery-distribution"
check "/beauty-cosmetics"
check "/pet-supply"
check "/supplements"

echo ""
echo "=== Blog Posts (sample) ==="
check "/blog/shopify-b2b-vs-custom-wholesale-portal"
check "/blog/wholesail-vs-netsuite-for-distributors"
check "/blog/hubspot-salesforce-distribution-alternatives"

echo ""
echo "=== Auth Pages ==="
check "/sign-in"
check "/sign-up"

echo ""
echo "=== TBGC Redirects (should 308/302) ==="
check "/journal" "308"
check "/provenance" "308"
check "/social" "308"
check "/guide" "308"
check "/seasonal" "308"
check "/drops" "308"
check "/partner" "308"
check "/apply" "308"

echo ""
echo "=== Public API Routes ==="
# Intake POST without body → should get 400 (validation)
check "/api/intake" "400" "POST"
# Subscribe POST without body → should get 400 or 429
check "/api/subscribe" "400" "POST"
# Notify-me POST without body → should get 400
check "/api/notify-me" "400" "POST"

echo ""
echo "=== Protected API Routes (should 401/403 without auth) ==="
check "/api/admin/analytics" "401"
check "/api/admin/clients/health-scores" "401"
check "/api/admin/ceo/export" "401"
check "/api/admin/ceo/cohorts" "401"
check "/api/admin/ceo/product-trends" "401"
check "/api/admin/chat" "405"
check "/api/admin/intakes" "401"
check "/api/admin/orders/export" "401"
check "/api/admin/products" "401"

echo ""
echo "=== Cron Routes (should 401 without CRON_SECRET) ==="
check "/api/cron/intake-nurture" "401"
check "/api/cron/billing-reminders" "401"
check "/api/cron/partner-nurture" "401"
check "/api/cron/lapsed-clients" "401"
check "/api/cron/abandoned-carts" "401"
check "/api/cron/weekly-report" "401"
check "/api/cron/weekly-digest" "401"
check "/api/cron/low-stock-alerts" "401"
check "/api/cron/onboarding-drip" "401"

echo ""
echo "=== Webhook Routes ==="
# Cal.com webhook with bad signature → 401
check "/api/intake/cfakeintakeid123456789/cal-booked" "401" "POST"

echo ""
echo "=== Client Portal (auth required) ==="
check "/client-portal" "307"

echo ""
echo "========================================="
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "FAILURES:"
  echo -e "$ERRORS"
  exit 1
fi

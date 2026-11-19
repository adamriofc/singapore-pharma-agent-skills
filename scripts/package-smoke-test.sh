#!/usr/bin/env bash
# Package Smoke Installation & Module Export Test (`scripts/package-smoke-test.sh`)
# Packs repository tarball, installs in isolated temp environment, and verifies module exports.
# Compatible with read-only host environments & sandboxes (tmpfs cache).

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR=$(mktemp -d /tmp/pharma-sg-smoke-XXXXXX)
CACHE_DIR=$(mktemp -d /tmp/pharma-sg-cache-XXXXXX)

cleanup() {
  rm -rf "$TEMP_DIR" "$CACHE_DIR"
  if [ -n "$TARBALL_PATH" ] && [ -f "$TARBALL_PATH" ]; then
    rm -f "$TARBALL_PATH"
  fi
}
trap cleanup EXIT

echo "📦 Running Singapore Pharma Package Smoke Installation & Export Test..."

cd "$ROOT_DIR"
TARBALL=$(npm pack --pack-destination "$TEMP_DIR" --cache "$CACHE_DIR" --quiet | tail -n 1)
TARBALL_PATH="$TEMP_DIR/$TARBALL"

if [ ! -f "$TARBALL_PATH" ]; then
  echo "❌ Error: Tarball was not created at expected path: $TARBALL_PATH"
  exit 1
fi

echo "  [1/3] Created package tarball: $TARBALL"

cd "$TEMP_DIR"
npm init -y --cache "$CACHE_DIR" > /dev/null
npm install "$TARBALL_PATH" --cache "$CACHE_DIR" --quiet > /dev/null

echo "  [2/3] Successfully installed tarball into isolated temp environment: $TEMP_DIR"

# Verify module requiring and execution
node -e "
const pkg = require('singapore-pharma-agent-skills/package.json');
console.log('    ✓ Package name:', pkg.name, 'v' + pkg.version);

const pharma = require('singapore-pharma-agent-skills');
if (typeof pharma.evaluateColdChainMkt !== 'function') throw new Error('Missing evaluateColdChainMkt');
if (typeof pharma.evaluateHsaRegistration !== 'function') throw new Error('Missing evaluateHsaRegistration');
if (typeof pharma.auditCleanroom !== 'function') throw new Error('Missing auditCleanroom');
if (typeof pharma.modelReimbursementPricing !== 'function') throw new Error('Missing modelReimbursementPricing');

const mkt = pharma.evaluateColdChainMkt({
  readings: [4.2, 4.5, 5.0, 5.2, 4.8],
  storageCondition: 'COLD_CHAIN_2_8'
});
if (mkt.auditVerdict.complianceStatus !== 'COMPLIANT') throw new Error('MKT compliance status mismatch');
console.log('    ✓ Engine evaluateColdChainMkt required & executed successfully (MKT = ' + mkt.metrics.mktCelsius + '°C)');

const hsa = pharma.evaluateHsaRegistration({
  category: 'NDA_1',
  referenceAgencies: ['US_FDA', 'EMA']
});
if (hsa.pathway !== 'VERIFICATION') throw new Error('HSA pathway mismatch');
if (hsa.totalStatutoryFeeSgd !== 23645) throw new Error('HSA statutory fee mismatch');
console.log('    ✓ Engine evaluateHsaRegistration required & executed successfully (Pathway = ' + hsa.pathway + ', Fee = S$' + hsa.totalStatutoryFeeSgd.toLocaleString() + ')');
"

echo "  [3/3] Standalone tarball installation and execution verified 100%!"
echo "✅ Package smoke test PASSED!"

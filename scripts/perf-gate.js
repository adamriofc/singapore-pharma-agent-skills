#!/usr/bin/env node
/**
 * Performance Gate & Throughput Regression Test (`scripts/perf-gate.js`)
 * Benchmarks engine execution speed and enforces maximum latency boundaries.
 */

'use strict';

const assert = require('assert');
const {
  evaluateColdChainMkt,
  evaluateHsaRegistration,
  auditCleanroom,
  modelReimbursementPricing
} = require('../index.js');

function runPerfGate() {
  console.log("⚡ Running Singapore Pharmaceutical Engine Performance Gate...");

  const iterations = 10000;

  // 1. Benchmark evaluateColdChainMkt
  const readings = [4.2, 4.5, 5.0, 5.8, 6.2, 5.0, 4.3];
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    evaluateColdChainMkt({ readings, storageCondition: 'COLD_CHAIN_2_8' });
  }
  const t1 = process.hrtime.bigint();
  const mktElapsedMs = Number(t1 - t0) / 1e6;
  const mktOpsPerSec = Math.round((iterations / (mktElapsedMs / 1000)));

  console.log(`  [1/4] evaluateColdChainMkt: ${iterations} runs in ${mktElapsedMs.toFixed(2)} ms (${mktOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(mktElapsedMs < 500, `MKT execution too slow: ${mktElapsedMs}ms`);

  // 2. Benchmark evaluateHsaRegistration
  const hsaInput = { category: 'NDA_1', referenceAgencies: ['US_FDA', 'EMA'] };
  const t2 = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    evaluateHsaRegistration(hsaInput);
  }
  const t3 = process.hrtime.bigint();
  const hsaElapsedMs = Number(t3 - t2) / 1e6;
  const hsaOpsPerSec = Math.round((iterations / (hsaElapsedMs / 1000)));

  console.log(`  [2/4] evaluateHsaRegistration: ${iterations} runs in ${hsaElapsedMs.toFixed(2)} ms (${hsaOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(hsaElapsedMs < 500, `HSA Registration execution too slow: ${hsaElapsedMs}ms`);

  // 3. Benchmark auditCleanroom
  const cleanroomInput = { grade: 'GRADE_B', particles05AtRest: 3000, differentialPressurePa: 15 };
  const t4 = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    auditCleanroom(cleanroomInput);
  }
  const t5 = process.hrtime.bigint();
  const cleanroomElapsedMs = Number(t5 - t4) / 1e6;
  const cleanroomOpsPerSec = Math.round((iterations / (cleanroomElapsedMs / 1000)));

  console.log(`  [3/4] auditCleanroom: ${iterations} runs in ${cleanroomElapsedMs.toFixed(2)} ms (${cleanroomOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(cleanroomElapsedMs < 500, `Cleanroom execution too slow: ${cleanroomElapsedMs}ms`);

  // 4. Benchmark modelReimbursementPricing
  const aceInput = { exFactoryPriceSgd: 350.0, drugTier: 'brandedStandard', subsidyScheme: 'SDL' };
  const t6 = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    modelReimbursementPricing(aceInput);
  }
  const t7 = process.hrtime.bigint();
  const aceElapsedMs = Number(t7 - t6) / 1e6;
  const aceOpsPerSec = Math.round((iterations / (aceElapsedMs / 1000)));

  console.log(`  [4/4] modelReimbursementPricing: ${iterations} runs in ${aceElapsedMs.toFixed(2)} ms (${aceOpsPerSec.toLocaleString()} ops/sec)`);
  assert.ok(aceElapsedMs < 500, `ACE Reimbursement execution too slow: ${aceElapsedMs}ms`);

  console.log("  ✅ All Singapore pharmaceutical engines operate within ultra-low latency bounds (< 0.05 ms/op)!\n");
}

if (require.main === module) {
  runPerfGate();
}

module.exports = { runPerfGate };

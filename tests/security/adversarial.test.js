/**
 * Adversarial Security & Input Fuzzing Tests (`tests/security/adversarial.test.js`)
 * Tests parameter hijacking, invalid types, NaN, Infinity, negative values, and code injection across Singapore Pharma engines.
 */

'use strict';

const assert = require('assert');
const {
  evaluateColdChainMkt,
  evaluateHsaRegistration,
  auditCleanroom,
  auditGmpGdpChecklist,
  auditAdrReporting,
  modelReimbursementPricing,
  auditClinicalTrialHbra
} = require('../../index.js');

function runAdversarialTests() {
  console.log("🛡️ Running Adversarial Input & Fuzzing Security Tests...");

  // 1. Cold Chain MKT Input Fuzzing & Boundary Defense
  console.log("  [1/6] Testing Cold Chain MKT Engine Input Boundaries...");
  assert.throws(() => evaluateColdChainMkt({ readings: "DROP TABLE temperatures;" }), /INVALID_INPUT/);
  assert.throws(() => evaluateColdChainMkt({ readings: [] }), /INVALID_INPUT/);
  assert.throws(() => evaluateColdChainMkt({ readings: [4.0, NaN, 5.0] }), /INVALID_INPUT/);
  assert.throws(() => evaluateColdChainMkt({ readings: [4.0, Infinity, 5.0] }), /INVALID_INPUT/);
  assert.throws(() => evaluateColdChainMkt({ readings: [4.0, -300.0, 5.0] }), /INVALID_INPUT/); // Below absolute zero
  assert.throws(() => evaluateColdChainMkt({ readings: [4.0, 5.0], storageCondition: "UNKNOWN_CONDITION" }), /INVALID_INPUT/);
  assert.throws(() => evaluateColdChainMkt({ readings: [4.0, 5.0], samplingIntervalMinutes: -15 }), /INVALID_INPUT/);
  console.log("    ✓ MKT Cold-Chain throws INVALID_INPUT on malicious strings, NaN, Infinity, and invalid conditions");

  // 2. HSA Registration Fuzzing
  console.log("  [2/6] Testing HSA Registration Engine Input Boundaries...");
  assert.throws(() => evaluateHsaRegistration({ category: "INVALID_CAT" }), /INVALID_INPUT/);
  assert.throws(() => evaluateHsaRegistration("string_payload"), /INVALID_INPUT/);
  assert.throws(() => evaluateHsaRegistration(null), /INVALID_INPUT/);
  assert.throws(() => evaluateHsaRegistration({ category: "NDA_1", pathwayPreference: "SUPER_FAST_HACK" }), /INVALID_INPUT/);
  console.log("    ✓ HSA Registration strictly validates statutory categories, pathway preferences, and object schemas");

  // 3. Cleanroom & GMP/GDP Auditor Fuzzing
  console.log("  [3/6] Testing PIC/S GMP & SS 585 GDP Auditor Boundaries...");
  assert.throws(() => auditCleanroom({ grade: "GRADE_Z" }), /INVALID_INPUT/);
  assert.throws(() => auditCleanroom(null), /INVALID_INPUT/);
  assert.throws(() => auditCleanroom({ grade: "GRADE_A", particles05AtRest: -500 }), /INVALID_INPUT/);
  assert.throws(() => auditGmpGdpChecklist({ standard: "UNKNOWN_STANDARD" }), /INVALID_INPUT/);
  assert.throws(() => auditGmpGdpChecklist({ standard: "PICS_GMP", checklistResponses: "not_an_array" }), /INVALID_INPUT/);
  console.log("    ✓ Cleanroom & GMP auditor strictly validates cleanroom grades, non-negative particulates, and standard IDs");

  // 4. ADR Pharmacovigilance Fuzzing
  console.log("  [4/6] Testing HSA VCB Pharmacovigilance Engine Input Boundaries...");
  assert.throws(() => auditAdrReporting(null), /INVALID_INPUT/);
  assert.throws(() => auditAdrReporting({ severity: "INVALID_SEVERITY" }), /INVALID_INPUT/);
  assert.throws(() => auditAdrReporting({ severity: "SERIOUS_FATAL_OR_LIFE_THREATENING", dateReceived: "invalid_date" }), /INVALID_INPUT/);
  assert.throws(() => auditAdrReporting({
    severity: "SERIOUS_FATAL_OR_LIFE_THREATENING",
    dateReceived: "2026-11-20",
    dateAssessed: "2026-11-10" // Anachronistic: assessed before received!
  }), /INVALID_INPUT/);
  console.log("    ✓ HSA VCB ADR Reporting strictly enforces chronological validity and severity classifications");

  // 5. ACE HTA & MOH SDL Reimbursement Modeler Fuzzing
  console.log("  [5/6] Testing ACE HTA & MOH Reimbursement Modeler Input Boundaries...");
  assert.throws(() => modelReimbursementPricing(null), /INVALID_INPUT/);
  assert.throws(() => modelReimbursementPricing({ exFactoryPriceSgd: -200 }), /INVALID_INPUT/);
  assert.throws(() => modelReimbursementPricing({ exFactoryPriceSgd: NaN }), /INVALID_INPUT/);
  assert.throws(() => modelReimbursementPricing({ exFactoryPriceSgd: 200, subsidyScheme: "UNKNOWN_SCHEME" }), /INVALID_INPUT/);
  assert.throws(() => modelReimbursementPricing({ exFactoryPriceSgd: 200, drugTier: "INVALID_TIER" }), /INVALID_INPUT/);
  assert.throws(() => modelReimbursementPricing({ exFactoryPriceSgd: 200, annualPatientVolume: -100 }), /INVALID_INPUT/);
  console.log("    ✓ ACE HTA Modeler enforces non-negative monetary figures, valid subsidy schemes, and volume bounds");

  // 6. Clinical Trial HBRA & Health PDPA Fuzzing
  console.log("  [6/6] Testing Clinical Trial HBRA & Health PDPA Engine Input Boundaries...");
  assert.throws(() => auditClinicalTrialHbra("invalid_payload"), /INVALID_INPUT/);
  assert.throws(() => auditClinicalTrialHbra(null), /INVALID_INPUT/);
  assert.throws(() => auditClinicalTrialHbra({ plannedSubjectCount: -50 }), /INVALID_INPUT/);
  console.log("    ✓ Clinical Trial HBRA strictly enforces object contracts and positive subject counts");

  console.log("  ✅ All 6 Singapore pharmaceutical engines passed adversarial security and injection fuzzing!\n");
}

if (require.main === module) {
  runAdversarialTests();
}

module.exports = { runAdversarialTests };

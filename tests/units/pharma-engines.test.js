/**
 * Unit & Invariant Tests for Singapore Pharmaceutical Engines (`tests/units/pharma-engines.test.js`)
 *
 * Verifies:
 *   1. HSA Therapeutic Product Registration & Fees Engine (Health Products Act 2007 & 2016 Regs)
 *   2. PIC/S GMP & SS 585 GDP Cleanroom & Facility Auditor (Annex 1 cleanroom grades & pressure cascades)
 *   3. Mean Kinetic Temperature (MKT) Cold-Chain Engine (Haynes 1971 / USP <1079> / Changi tarmac)
 *   4. Pharmacovigilance & HSA VCB Adverse Drug Reaction Engine (15-day SLA & WHO-UMC causality)
 *   5. ACE HTA & MOH Standard Drug List (SDL/MAF) Subsidy Modeler (GST 9%, hospital markups)
 *   6. Clinical Trial HBRA & Health PDPA Privacy Auditor (CTA 30-day / CTN 15-day & Section 26 PDPA)
 *   7. Strict input validation and fail-closed error boundaries
 */

'use strict';

const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

const { evaluateHsaRegistration } = require(path.join(ROOT, 'engines/hsa-therapeutic-registration-engine'));
const { auditCleanroom, auditGmpGdpChecklist } = require(path.join(ROOT, 'engines/hsa-gmp-gdp-auditor-engine'));
const { evaluateColdChainMkt } = require(path.join(ROOT, 'engines/mkt-cold-chain-engine'));
const { auditAdrReporting } = require(path.join(ROOT, 'engines/hsa-adr-pharmacovigilance-engine'));
const { modelReimbursementPricing } = require(path.join(ROOT, 'engines/ace-hta-reimbursement-modeler'));
const { auditClinicalTrialHbra } = require(path.join(ROOT, 'engines/clinical-trial-hbra-engine'));
const { runMktTests } = require(path.join(__dirname, 'mkt-cold-chain.test'));

function runPharmaEngineTests() {
  console.log("🧪 Running Singapore Pharmaceutical & Biomedical Intelligence Engine Tests...\n");

  // -------------------------------------------------------------
  // Test 1: HSA Therapeutic Product Registration & Fee Engine
  // -------------------------------------------------------------
  console.log("  [1/6] Testing HSA Therapeutic Product Registration & Route Determination Engine...");

  // 1a. NDA-1 Verification Route with Reference Agency Approval (e.g. US FDA / EMA)
  const resHsaVerif = evaluateHsaRegistration({
    category: 'NDA_1',
    referenceAgencies: ['US_FDA', 'EMA'],
    dossier: {
      ctdModules: {
        module1Admin: true,
        module2Summaries: true,
        module3Quality: true,
        module4Nonclinical: true,
        module5Clinical: true
      }
    }
  });

  assert.strictEqual(resHsaVerif.category, 'NDA_1');
  assert.strictEqual(resHsaVerif.pathway, 'VERIFICATION');
  assert.strictEqual(resHsaVerif.feeBreakdownSgd.screeningFee, 545);
  assert.strictEqual(resHsaVerif.feeBreakdownSgd.evaluationFee, 23100);
  assert.strictEqual(resHsaVerif.totalStatutoryFeeSgd, 23645);
  assert.strictEqual(resHsaVerif.evaluationSlaWorkingDays, 60);
  assert.strictEqual(resHsaVerif.dossierAudit.isComplete, true);
  assert.strictEqual(resHsaVerif.dossierAudit.readinessScorePercent, 100);

  // 1b. NDA-1 Full Route (De novo clinical evaluation, no reference agency)
  const resHsaFull = evaluateHsaRegistration({
    category: 'NDA_1',
    referenceAgencies: [],
    dossier: {
      ctdModules: {
        module1Admin: true,
        module2Summaries: true,
        module3Quality: true,
        module4Nonclinical: true,
        module5Clinical: true
      }
    }
  });

  assert.strictEqual(resHsaFull.pathway, 'FULL');
  assert.strictEqual(resHsaFull.feeBreakdownSgd.screeningFee, 545);
  assert.strictEqual(resHsaFull.feeBreakdownSgd.evaluationFee, 94500);
  assert.strictEqual(resHsaFull.totalStatutoryFeeSgd, 95045);
  assert.strictEqual(resHsaFull.evaluationSlaWorkingDays, 270);

  // 1c. Generic GDA-1 Abridged Route
  const resGdaAbridged = evaluateHsaRegistration({
    category: 'GDA_1',
    dossier: {
      ctdModules: {
        module1Admin: true,
        module2Summaries: true,
        module3Quality: true,
        module4Nonclinical: false,
        module5Clinical: true // bioequivalence
      }
    }
  });

  assert.strictEqual(resGdaAbridged.category, 'GDA_1');
  assert.strictEqual(resGdaAbridged.pathway, 'ABRIDGED');
  assert.strictEqual(resGdaAbridged.totalStatutoryFeeSgd, 13145);
  assert.strictEqual(resGdaAbridged.evaluationSlaWorkingDays, 180);
  assert.strictEqual(resGdaAbridged.dossierAudit.isComplete, true);

  // 1d. Invalid category throws
  assert.throws(() => evaluateHsaRegistration({ category: 'INVALID_CATEGORY' }), /INVALID_INPUT/);

  // -------------------------------------------------------------
  // Test 2: PIC/S GMP & SS 585 GDP Auditor Engine
  // -------------------------------------------------------------
  console.log("  [2/6] Testing PIC/S GMP Annex 1 Cleanroom & Facility Auditor Engine...");

  // 2a. Grade A Cleanroom (Laminar Airflow) Compliant
  const resGradeA = auditCleanroom({
    grade: 'GRADE_A',
    particles05AtRest: 3100,
    particles05InOperation: 3200,
    particles50AtRest: 12,
    differentialPressurePa: 16.0,
    airVelocityMps: 0.45,
    microbialAirCfuM3: 0.2
  });

  assert.strictEqual(resGradeA.isCompliant, true);
  assert.strictEqual(resGradeA.verdict, 'QUALIFIED_COMPLIANT');
  assert.strictEqual(resGradeA.riskLevel, 'LOW');
  assert.strictEqual(resGradeA.breaches.length, 0);

  // 2b. Grade B Cleanroom Pressure Cascade Breach (< 15 Pa relative to Grade C)
  const resGradeBBreach = auditCleanroom({
    grade: 'GRADE_B',
    particles05AtRest: 3400,
    particles05InOperation: 320000,
    particles50AtRest: 25,
    differentialPressurePa: 8.5, // Critical breach! Must be >= 15 Pa
    microbialAirCfuM3: 4
  });

  assert.strictEqual(resGradeBBreach.isCompliant, false);
  assert.strictEqual(resGradeBBreach.verdict, 'NON_CONFORMING_BREACH');
  assert.strictEqual(resGradeBBreach.riskLevel, 'CRITICAL');
  assert.ok(resGradeBBreach.breaches.some(b => b.includes('PRESSURE_CASCADE_INSUFFICIENT')));

  // 2c. GMP Facility Checklist Audit
  const resGmpAudit = auditGmpGdpChecklist({
    standard: 'PICS_GMP',
    checklistResponses: [
      { id: 'GMP-01', status: 'PASS' },
      { id: 'GMP-02', status: 'PASS' },
      { id: 'GMP-03', status: 'PASS' },
      { id: 'GMP-04', status: 'PASS' },
      { id: 'GMP-05', status: 'PASS' },
      { id: 'GMP-06', status: 'PASS' },
      { id: 'GMP-07', status: 'PASS' }
    ]
  });

  assert.strictEqual(resGmpAudit.complianceScorePercent, 100);
  assert.strictEqual(resGmpAudit.auditVerdict, 'PASSED');
  assert.strictEqual(resGmpAudit.licenseRecommendation, 'RECOMMEND_ISSUANCE_OR_RETENTION');

  // -------------------------------------------------------------
  // Test 3: Mean Kinetic Temperature (MKT) Cold-Chain Engine
  // -------------------------------------------------------------
  console.log("  [3/6] Delegating to comprehensive MKT Cold-Chain Unit Suite...");
  runMktTests();

  // -------------------------------------------------------------
  // Test 4: Pharmacovigilance & HSA VCB ADR Reporting Engine
  // -------------------------------------------------------------
  console.log("  [4/6] Testing Pharmacovigilance & HSA VCB ADR Reporting Engine (15-day SLA)...");

  // 4a. Serious Fatal/Life-Threatening Report (Day 4 of 15)
  const resAdrSerious = auditAdrReporting({
    therapeuticProductName: 'Ticagrelor 90mg Tablet',
    severity: 'SERIOUS_FATAL_OR_LIFE_THREATENING',
    dateReceived: '2026-11-15',
    dateAssessed: '2026-11-19',
    causalityFactors: {
      plausibleTimeSequence: true,
      dechallenge: 'POSITIVE',
      rechallenge: 'UNKNOWN',
      alternativeCause: false,
      informationComplete: true
    }
  });

  assert.strictEqual(resAdrSerious.severity, 'SERIOUS_FATAL_OR_LIFE_THREATENING');
  assert.strictEqual(resAdrSerious.statutoryMaxCalendarDays, 15);
  assert.strictEqual(resAdrSerious.timelineStatus.daysElapsed, 4);
  assert.strictEqual(resAdrSerious.timelineStatus.daysRemaining, 11);
  assert.strictEqual(resAdrSerious.timelineStatus.isOverdue, false);
  assert.strictEqual(resAdrSerious.whoUmcCausality.causalityLevel, 'PROBABLE');
  assert.ok(resAdrSerious.hsaVcbActions.some(a => a.includes('HSA PRISM')));

  // 4b. Serious Overdue Report (Day 20 of 15) -> Criminal Offense Breach Flag
  const resAdrOverdue = auditAdrReporting({
    therapeuticProductName: 'Enoxaparin Sodium Injection',
    severity: 'SERIOUS_OTHER',
    dateReceived: '2026-10-30',
    dateAssessed: '2026-11-19',
    causalityFactors: {
      plausibleTimeSequence: true,
      dechallenge: 'POSITIVE',
      rechallenge: 'POSITIVE',
      alternativeCause: false,
      informationComplete: true
    }
  });

  assert.strictEqual(resAdrOverdue.timelineStatus.isOverdue, true);
  assert.strictEqual(resAdrOverdue.whoUmcCausality.causalityLevel, 'CERTAIN');
  assert.ok(resAdrOverdue.hsaVcbActions.some(a => a.includes('OVERDUE_BREACH')));

  // 4c. Non-Serious Report -> 180-day / Periodic Reporting
  const resAdrNonSerious = auditAdrReporting({
    therapeuticProductName: 'Cetirizine 10mg Oral Solution',
    severity: 'NON_SERIOUS',
    dateReceived: '2026-11-01',
    dateAssessed: '2026-11-19'
  });

  assert.strictEqual(resAdrNonSerious.statutoryMaxCalendarDays, 180);
  assert.strictEqual(resAdrNonSerious.timelineStatus.isOverdue, false);

  // -------------------------------------------------------------
  // Test 5: ACE HTA & MOH Standard Drug List (SDL/MAF) Pricing Engine
  // -------------------------------------------------------------
  console.log("  [5/6] Testing ACE HTA & MOH Standard Drug List Reimbursement Modeler...");

  // Ex-factory: 200 SGD, Branded Standard (12% hospital markup), Wholesale (7%)
  // Wholesale price = 200 * 1.07 = 214.00 SGD
  // List price before subsidy = 214.00 * 1.12 = 239.68 SGD
  // MOH Subsidy (SDL 50%) = 239.68 * 0.50 = 119.84 SGD
  // Patient share before GST = 239.68 - 119.84 = 119.84 SGD
  // GST 9% on patient share = 119.84 * 0.09 = 10.79 SGD
  // Final patient out-of-pocket = 119.84 + 10.79 = 130.63 SGD
  const resPricingSdl = modelReimbursementPricing({
    exFactoryPriceSgd: 200.0,
    drugTier: 'brandedStandard',
    subsidyScheme: 'SDL',
    isPioneerOrEnhancedMeansTested: false,
    annualPatientVolume: 1000
  });

  assert.strictEqual(resPricingSdl.unitPricingWaterfallSgd.exFactoryPrice, 200.0);
  assert.strictEqual(resPricingSdl.unitPricingWaterfallSgd.wholesalePriceToHospital, 214.0);
  assert.strictEqual(resPricingSdl.unitPricingWaterfallSgd.listPriceBeforeSubsidy, 239.68);
  assert.strictEqual(resPricingSdl.unitPricingWaterfallSgd.mohGovernmentSubsidy, 119.84);
  assert.strictEqual(resPricingSdl.unitPricingWaterfallSgd.patientGst9Percent, 10.79);
  assert.strictEqual(resPricingSdl.unitPricingWaterfallSgd.patientFinalOutOfPocketCoPay, 130.63);
  assert.strictEqual(resPricingSdl.annualVolumeImpactSgd.annualTotalMohSubsidy, 119840.0);

  // Enhanced Pioneer subsidy (75% subsidy)
  const resPricingPioneer = modelReimbursementPricing({
    exFactoryPriceSgd: 200.0,
    drugTier: 'brandedStandard',
    subsidyScheme: 'MAF',
    isPioneerOrEnhancedMeansTested: true
  });

  assert.strictEqual(resPricingPioneer.subsidyPercentage, 75);
  assert.strictEqual(resPricingPioneer.unitPricingWaterfallSgd.mohGovernmentSubsidy, 179.76); // 239.68 * 0.75

  // -------------------------------------------------------------
  // Test 6: Clinical Trial HBRA & Health PDPA Privacy Auditor Engine
  // -------------------------------------------------------------
  console.log("  [6/6] Testing Clinical Trial HBRA & Health PDPA Privacy Auditor Engine...");

  // 6a. Compliant CTA Trial with Local Sponsor & Cross-Border Transfer
  const resTrialCompliant = auditClinicalTrialHbra({
    isInvestigationalMedicinalProduct: true,
    hasLocalSponsor: true,
    hasIrbApproval: true,
    hasDocumentedInformedConsent: true,
    isHealthDataPseudonymised: true,
    crossBorderTransferContemplated: true,
    hasAdequateCrossBorderSafeguards: true,
    plannedSubjectCount: 120
  });

  assert.strictEqual(resTrialCompliant.hsaRegulatoryPathway.pathway, 'CTA');
  assert.strictEqual(resTrialCompliant.hsaRegulatoryPathway.slaWorkingDays, 30);
  assert.strictEqual(resTrialCompliant.complianceScorePercent, 100);
  assert.strictEqual(resTrialCompliant.isTrialAuthorizedToCommence, true);
  assert.strictEqual(resTrialCompliant.overallStatus, 'READY_TO_SUBMIT_OR_COMMENCE');
  assert.strictEqual(resTrialCompliant.criticalGaps.length, 0);

  // 6b. CTN Trial with Unapproved Cross-Border Transfer Breach (PDPA Section 26)
  const resTrialBreach = auditClinicalTrialHbra({
    isInvestigationalMedicinalProduct: false,
    hasLocalSponsor: true,
    hasIrbApproval: true,
    hasDocumentedInformedConsent: true,
    isHealthDataPseudonymised: false, // Breach!
    crossBorderTransferContemplated: true,
    hasAdequateCrossBorderSafeguards: false // Breach!
  });

  assert.strictEqual(resTrialBreach.hsaRegulatoryPathway.pathway, 'CTN');
  assert.strictEqual(resTrialBreach.hsaRegulatoryPathway.slaWorkingDays, 15);
  assert.strictEqual(resTrialBreach.isTrialAuthorizedToCommence, false);
  assert.strictEqual(resTrialBreach.overallStatus, 'STATUTORY_DEFICIENCIES_COMMENCEMENT_BLOCKED');
  assert.ok(resTrialBreach.criticalGaps.some(g => g.includes('PDPA-01')));
  assert.ok(resTrialBreach.criticalGaps.some(g => g.includes('PDPA-02')));

  console.log("✅ All Singapore Pharmaceutical Engine tests passed 100%!\n");
}

if (require.main === module) {
  runPharmaEngineTests();
}

module.exports = { runPharmaEngineTests };

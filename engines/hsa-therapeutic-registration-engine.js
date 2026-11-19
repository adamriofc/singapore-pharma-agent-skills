/**
 * HSA Therapeutic Product Registration & Regulatory Pathway Evaluation Engine (`engines/hsa-therapeutic-registration-engine.js`)
 *
 * Implements deterministic calculation of Health Sciences Authority (HSA) statutory
 * screening and evaluation fees under the Health Products Act 2007 (Cap. 122D) and
 * Health Products (Therapeutic Products) Regulations 2016.
 *
 * Evaluates registration pathways:
 *   - Verification Pathway (60 working days SLA)
 *   - Abridged Pathway (180 working days SLA)
 *   - Full Scientific Evaluation Pathway (270 working days SLA)
 *
 * Audits Common Technical Document (ICH-CTD Modules 1-5 / ACTD Parts I-IV) completeness.
 *
 * DOCTRINE: Pure numerical computation and statutory ruleset lookup.
 * ZERO prescriptive text / ZERO subjective advice.
 * Pure Node.js, zero external runtime dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let HSA_RULES = null;

function getRules() {
  if (!HSA_RULES) {
    const rulesPath = path.join(__dirname, 'rules/hsa-fees.json');
    if (fs.existsSync(rulesPath)) {
      HSA_RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    } else {
      HSA_RULES = {
        screeningFee: 545,
        fees: {
          NDA_1: { full_evaluation: 94500, abridged_evaluation: 59850, verification_evaluation: 23100 },
          NDA_2: { full_evaluation: 65100, abridged_evaluation: 42000, verification_evaluation: 16800 },
          NDA_3: { full_evaluation: 39900, abridged_evaluation: 25200, verification_evaluation: 10500 },
          GDA_1: { abridged_evaluation: 12600, verification_evaluation: 5250 },
          GDA_2: { abridged_evaluation: 7350, verification_evaluation: 3150 },
          VARIATION_MAV_1: { evaluation: 7350 },
          VARIATION_MIV_1: { evaluation: 2100 },
          VARIATION_MIV_2: { evaluation: 735 },
          ANNUAL_RETENTION: { fee: 525 }
        },
        serviceLevelAgreements: {
          VERIFICATION: { maxWorkingDays: 60, qualifyingCriteria: ["two_reference_agency_approvals"] },
          ABRIDGED: { maxWorkingDays: 180, qualifyingCriteria: ["single_reference_agency_approval", "or_gda_with_be_study"] },
          FULL: { maxWorkingDays: 270, qualifyingCriteria: ["no_reference_approval_available"] }
        }
      };
    }
  }
  return HSA_RULES;
}

/**
 * Evaluate HSA Therapeutic Product Registration pathway, fees, and dossier completeness.
 *
 * @param {Object} input
 * @param {string} input.category Application category (e.g. "NDA_1", "NDA_2", "NDA_3", "GDA_1", "GDA_2", "VARIATION_MAV_1")
 * @param {string} [input.pathwayPreference] Explicit pathway ("VERIFICATION", "ABRIDGED", "FULL")
 * @param {Array<string>} [input.referenceAgencies] List of reference regulatory agency approvals (e.g. ["US_FDA", "EMA", "TGA_AUSTRALIA"])
 * @param {boolean} [input.includeScreeningFee=true] Whether to include statutory screening fee (SGD 545)
 * @param {Object} [input.dossier] Dossier checklist (ctdModules or actdParts)
 * @returns {Object} Comprehensive evaluation receipt
 */
function evaluateHsaRegistration(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT: Input must be a valid parameters object');
  }

  const category = String(input.category || 'NDA_1').toUpperCase().trim();
  const rules = getRules();

  if (!rules.fees[category]) {
    const validCategories = Object.keys(rules.fees).join(', ');
    throw new Error(`INVALID_INPUT: Category '${category}' not recognized. Valid categories: ${validCategories}`);
  }

  const categoryFees = rules.fees[category];
  const referenceAgencies = Array.isArray(input.referenceAgencies)
    ? input.referenceAgencies.map(a => String(a).toUpperCase().trim())
    : [];

  const includeScreeningFee = input.includeScreeningFee !== undefined
    ? Boolean(input.includeScreeningFee)
    : (!category.startsWith('VARIATION_MIV_2') && category !== 'ANNUAL_RETENTION');

  // Determine eligible pathway
  let determinedPathway = 'FULL';
  let matchedCriteria = [];

  if (category === 'ANNUAL_RETENTION' || category.startsWith('VARIATION_')) {
    determinedPathway = 'NOT_APPLICABLE';
  } else if (input.pathwayPreference) {
    const requested = String(input.pathwayPreference).toUpperCase().trim();
    if (rules.serviceLevelAgreements[requested]) {
      determinedPathway = requested;
      matchedCriteria.push(`user_specified_${requested.toLowerCase()}`);
    } else {
      throw new Error(`INVALID_INPUT: Pathway '${requested}' not recognized. Valid: VERIFICATION, ABRIDGED, FULL`);
    }
  } else {
    // Dynamic determination based on reference agencies count and category
    const validRefAgencies = rules.referenceAgencies || [
      'US_FDA', 'EMA', 'TGA_AUSTRALIA', 'HEALTH_CANADA', 'MHRA_UK', 'PMDA_JAPAN', 'SWISSMEDIC'
    ];
    const qualifiedRefs = referenceAgencies.filter(ra => validRefAgencies.includes(ra));

    if (qualifiedRefs.length >= 2 && categoryFees.verification_evaluation !== undefined) {
      determinedPathway = 'VERIFICATION';
      matchedCriteria = qualifiedRefs;
    } else if (qualifiedRefs.length >= 1 && categoryFees.abridged_evaluation !== undefined) {
      determinedPathway = 'ABRIDGED';
      matchedCriteria = qualifiedRefs;
    } else if (category.startsWith('GDA_')) {
      determinedPathway = 'ABRIDGED';
      matchedCriteria = ['standard_generic_track'];
    } else {
      determinedPathway = categoryFees.full_evaluation !== undefined ? 'FULL' : 'ABRIDGED';
      matchedCriteria = ['standard_full_dossier_assessment'];
    }
  }

  // Calculate fees
  let evaluationFeeSgd = 0;
  if (category === 'ANNUAL_RETENTION') {
    evaluationFeeSgd = categoryFees.fee || 525;
  } else if (category.startsWith('VARIATION_')) {
    evaluationFeeSgd = categoryFees.evaluation || 0;
  } else {
    if (determinedPathway === 'VERIFICATION') {
      evaluationFeeSgd = categoryFees.verification_evaluation || categoryFees.abridged_evaluation || 0;
    } else if (determinedPathway === 'ABRIDGED') {
      evaluationFeeSgd = categoryFees.abridged_evaluation || categoryFees.full_evaluation || 0;
    } else {
      evaluationFeeSgd = categoryFees.full_evaluation || categoryFees.abridged_evaluation || 0;
    }
  }

  const screeningFeeSgd = includeScreeningFee ? (rules.screeningFee || 545) : 0;
  const totalStatutoryFeeSgd = evaluationFeeSgd + screeningFeeSgd;

  // SLA details
  const slaInfo = rules.serviceLevelAgreements[determinedPathway] || {
    maxWorkingDays: determinedPathway === 'NOT_APPLICABLE' ? 14 : 270,
    description: determinedPathway === 'NOT_APPLICABLE' ? 'Variation / Retention Process' : 'Standard Full Evaluation'
  };

  // Dossier audit if provided
  let dossierAudit = null;
  const dossier = input.dossier;
  if (dossier && typeof dossier === 'object') {
    if (dossier.ctdModules && typeof dossier.ctdModules === 'object') {
      const m1 = Boolean(dossier.ctdModules.module1Admin);
      const m2 = Boolean(dossier.ctdModules.module2Summaries);
      const m3 = Boolean(dossier.ctdModules.module3Quality);
      const m4 = Boolean(dossier.ctdModules.module4Nonclinical);
      const m5 = Boolean(dossier.ctdModules.module5Clinical);

      const isGeneric = category.startsWith('GDA_');
      const isComplete = isGeneric ? (m1 && m2 && m3) : (m1 && m2 && m3 && m4 && m5);
      const checkedParts = (m1 ? 1 : 0) + (m2 ? 1 : 0) + (m3 ? 1 : 0) + (m4 ? 1 : 0) + (m5 ? 1 : 0);
      const denominator = isGeneric ? 3 : 5;

      dossierAudit = {
        format: 'ICH_CTD',
        isComplete,
        readinessScorePercent: Math.min(100, Math.round((checkedParts / denominator) * 100)),
        moduleStatus: {
          module1Administrative: m1 ? 'COMPLETE' : 'MISSING',
          module2Summaries: m2 ? 'COMPLETE' : 'MISSING',
          module3Quality: m3 ? 'COMPLETE' : 'MISSING',
          module4Nonclinical: m4 ? 'COMPLETE' : (isGeneric ? 'EXEMPT_FOR_GENERIC' : 'MISSING'),
          module5Clinical: m5 ? 'COMPLETE' : (isGeneric ? 'EXEMPT_OR_BE_STUDY_REQUIRED' : 'MISSING')
        }
      };
    } else if (dossier.actdParts && typeof dossier.actdParts === 'object') {
      const p1 = Boolean(dossier.actdParts.part1Admin);
      const p2 = Boolean(dossier.actdParts.part2Quality);
      const p3 = Boolean(dossier.actdParts.part3Nonclinical);
      const p4 = Boolean(dossier.actdParts.part4Clinical);

      const isGeneric = category.startsWith('GDA_');
      const isComplete = isGeneric ? (p1 && p2) : (p1 && p2 && p3 && p4);
      const checkedParts = (p1 ? 1 : 0) + (p2 ? 1 : 0) + (p3 ? 1 : 0) + (p4 ? 1 : 0);
      const denominator = isGeneric ? 2 : 4;

      dossierAudit = {
        format: 'ACTD',
        isComplete,
        readinessScorePercent: Math.min(100, Math.round((checkedParts / denominator) * 100)),
        partsStatus: {
          part1Administrative: p1 ? 'COMPLETE' : 'MISSING',
          part2Quality: p2 ? 'COMPLETE' : 'MISSING',
          part3Nonclinical: p3 ? 'COMPLETE' : (isGeneric ? 'EXEMPT_FOR_GENERIC' : 'MISSING'),
          part4Clinical: p4 ? 'COMPLETE' : (isGeneric ? 'EXEMPT_OR_BE_STUDY_REQUIRED' : 'MISSING')
        }
      };
    }
  }

  return {
    category,
    categoryName: categoryFees.name || category,
    pathway: determinedPathway,
    evaluationSlaWorkingDays: slaInfo.maxWorkingDays,
    slaDescription: slaInfo.description,
    totalStatutoryFeeSgd,
    feeBreakdownSgd: {
      screeningFee: screeningFeeSgd,
      evaluationFee: evaluationFeeSgd
    },
    referenceAgenciesQualified: matchedCriteria,
    dossierAudit,
    statutoryBasis: 'Health Products Act 2007 & Health Products (Therapeutic Products) Regulations 2016'
  };
}

module.exports = {
  evaluateHsaRegistration
};

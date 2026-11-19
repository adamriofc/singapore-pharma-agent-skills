/**
 * ACE HTA & Standard Drug List (SDL/MAF) Reimbursement Modeler (`engines/ace-hta-reimbursement-modeler.js`)
 *
 * Implements deterministic pricing waterfall, public hospital tender modeling,
 * and subsidy allocations for Singapore healthcare institutions (SingHealth, NHG, NUHS):
 *   - Ministry of Health (MOH) Standard Drug List (SDL)
 *   - Medication Assistance Fund (MAF)
 *   - Non-subsidised formulary pricing
 *   - Statutory Singapore Goods and Services Tax (GST 9%)
 *   - Distributor wholesale and hospital pharmacy margins
 *
 * DOCTRINE: Pure numerical computation and statutory ruleset lookup.
 * ZERO prescriptive text / ZERO subjective advice.
 * Pure Node.js, zero external runtime dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let ACE_RULES = null;

function getRules() {
  if (!ACE_RULES) {
    const rulesPath = path.join(__dirname, 'rules/ace-reimbursement.json');
    if (fs.existsSync(rulesPath)) {
      ACE_RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    } else {
      ACE_RULES = {
        taxRates: { gstRate: 0.09 },
        subsidySchemes: {
          SDL: { name: 'Standard Drug List', standardSubsidyPct: 0.50, pioneerOrEnhancedSubsidyPct: 0.75 },
          MAF: { name: 'Medication Assistance Fund', standardSubsidyPct: 0.50, enhancedMeansTestedSubsidyPct: 0.75 },
          NON_SUBSIDISED: { name: 'Non-Subsidised', standardSubsidyPct: 0.0 }
        },
        commercialMargins: {
          defaultWholesaleDistributorMargin: 0.07,
          hospitalHandlingTiers: { genericStandard: 0.15, brandedStandard: 0.12, specialtyHighCostBiologic: 0.08 }
        }
      };
    }
  }
  return ACE_RULES;
}

/**
 * Model Singapore public tender pricing, wholesale margin, hospital markup, and MOH co-payment.
 *
 * @param {Object} input
 * @param {number} input.exFactoryPriceSgd Base ex-factory price in SGD
 * @param {string} [input.drugTier="brandedStandard"] Drug handling tier ("genericStandard", "brandedStandard", "specialtyHighCostBiologic")
 * @param {string} [input.subsidyScheme="SDL"] Subsidy scheme ("SDL", "MAF", "NON_SUBSIDISED")
 * @param {boolean} [input.isPioneerOrEnhancedMeansTested=false] Whether patient qualifies for enhanced 75% subsidy
 * @param {number} [input.customDistributorMargin] Optional custom distributor margin (e.g. 0.08 for 8%)
 * @param {number} [input.annualPatientVolume=1] Annual estimated packs/units for annual budget impact
 * @param {string} [input.hospitalCluster="SINGHEALTH"] Cluster ("SINGHEALTH", "NHG", "NUHS")
 * @returns {Object} Comprehensive pricing waterfall and patient co-pay audit
 */
function modelReimbursementPricing(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT: Input must be a valid parameters object');
  }

  const exFactory = Number(input.exFactoryPriceSgd);
  if (isNaN(exFactory) || exFactory <= 0) {
    throw new Error('INVALID_INPUT: exFactoryPriceSgd must be a positive number.');
  }

  const rules = getRules();
  const gstRate = rules.taxRates ? rules.taxRates.gstRate : 0.09;
  const drugTier = String(input.drugTier || 'brandedStandard');
  const subsidyScheme = String(input.subsidyScheme || 'SDL').toUpperCase().trim();
  const isEnhanced = Boolean(input.isPioneerOrEnhancedMeansTested);
  const cluster = String(input.hospitalCluster || 'SINGHEALTH').toUpperCase().trim();

  let volume = 1;
  if (input.annualPatientVolume !== undefined) {
    const v = Number(input.annualPatientVolume);
    if (isNaN(v) || !Number.isFinite(v) || v <= 0) {
      throw new Error('INVALID_INPUT: annualPatientVolume must be a positive number');
    }
    volume = v;
  }

  // Margins
  const distMarginRate = typeof input.customDistributorMargin === 'number' && input.customDistributorMargin >= 0
    ? input.customDistributorMargin
    : (rules.commercialMargins ? rules.commercialMargins.defaultWholesaleDistributorMargin : 0.07);

  const handlingTiers = rules.commercialMargins && rules.commercialMargins.hospitalHandlingTiers
    ? rules.commercialMargins.hospitalHandlingTiers
    : { genericStandard: 0.15, brandedStandard: 0.12, specialtyHighCostBiologic: 0.08 };

  if (handlingTiers[drugTier] === undefined) {
    const validTiers = Object.keys(handlingTiers).join(', ');
    throw new Error(`INVALID_INPUT: drugTier '${drugTier}' not recognized. Valid: ${validTiers}`);
  }

  const hospitalMarginRate = handlingTiers[drugTier];

  // Waterfall Calculation
  // 1. Wholesale Price to Hospital
  const distributorMarginAmountSgd = exFactory * distMarginRate;
  const wholesalePriceSgd = exFactory + distributorMarginAmountSgd;

  // 2. Hospital Dispensing Retail Price (before subsidy and GST)
  const hospitalHandlingAmountSgd = wholesalePriceSgd * hospitalMarginRate;
  const listPriceBeforeSubsidySgd = wholesalePriceSgd + hospitalHandlingAmountSgd;

  // 3. Subsidy Percentage
  let subsidyPct = 0;
  const schemeInfo = rules.subsidySchemes ? rules.subsidySchemes[subsidyScheme] : null;
  if (!schemeInfo) {
    const validSchemes = Object.keys(rules.subsidySchemes || {}).join(', ');
    throw new Error(`INVALID_INPUT: subsidyScheme '${subsidyScheme}' not recognized. Valid: ${validSchemes}`);
  }

  if (subsidyScheme === 'SDL') {
    subsidyPct = isEnhanced ? schemeInfo.pioneerOrEnhancedSubsidyPct : schemeInfo.standardSubsidyPct;
  } else if (subsidyScheme === 'MAF') {
    subsidyPct = isEnhanced ? schemeInfo.enhancedMeansTestedSubsidyPct : schemeInfo.standardSubsidyPct;
  } else {
    subsidyPct = 0;
  }

  // 4. Government Subsidy & Patient Co-pay
  const mohSubsidyAmountSgd = listPriceBeforeSubsidySgd * subsidyPct;
  const patientPreGstAmountSgd = listPriceBeforeSubsidySgd - mohSubsidyAmountSgd;
  const patientGstAmountSgd = patientPreGstAmountSgd * gstRate;
  const patientFinalCoPaySgd = patientPreGstAmountSgd + patientGstAmountSgd;

  // 5. Total Cost with GST
  const totalGstAmountSgd = listPriceBeforeSubsidySgd * gstRate;
  const totalGrossHospitalBillSgd = listPriceBeforeSubsidySgd + totalGstAmountSgd;

  return {
    hospitalCluster: cluster,
    subsidyScheme,
    subsidySchemeName: schemeInfo.name || subsidyScheme,
    isEnhancedSubsidy: isEnhanced,
    subsidyPercentage: Math.round(subsidyPct * 100),
    drugTier,
    unitPricingWaterfallSgd: {
      exFactoryPrice: Math.round(exFactory * 100) / 100,
      distributorMarginRate: Math.round(distMarginRate * 1000) / 10,
      distributorMarginAmount: Math.round(distributorMarginAmountSgd * 100) / 100,
      wholesalePriceToHospital: Math.round(wholesalePriceSgd * 100) / 100,
      hospitalHandlingMarginRate: Math.round(hospitalMarginRate * 1000) / 10,
      hospitalHandlingAmount: Math.round(hospitalHandlingAmountSgd * 100) / 100,
      listPriceBeforeSubsidy: Math.round(listPriceBeforeSubsidySgd * 100) / 100,
      mohGovernmentSubsidy: Math.round(mohSubsidyAmountSgd * 100) / 100,
      patientPreGstShare: Math.round(patientPreGstAmountSgd * 100) / 100,
      patientGst9Percent: Math.round(patientGstAmountSgd * 100) / 100,
      patientFinalOutOfPocketCoPay: Math.round(patientFinalCoPaySgd * 100) / 100
    },
    annualVolumeImpactSgd: {
      volumeUnits: volume,
      annualTotalMohSubsidy: Math.round(mohSubsidyAmountSgd * volume * 100) / 100,
      annualTotalPatientCoPay: Math.round(patientFinalCoPaySgd * volume * 100) / 100,
      annualGrossHospitalSpend: Math.round(totalGrossHospitalBillSgd * volume * 100) / 100
    },
    statutoryBasis: 'MOH Standard Drug List (SDL) / Medication Assistance Fund (MAF) & Singapore GST Act (9%)'
  };
}

module.exports = {
  modelReimbursementPricing
};

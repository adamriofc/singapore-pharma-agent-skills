/**
 * Singapore Pharmaceutical, Biomedical & Healthcare Agent Skills Extension (`index.js`)
 *
 * Satellite on-demand domain vertical extension for `singapore-business-agent-skills`.
 * Pure Node.js, zero external runtime dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Computational Engines
const { evaluateHsaRegistration } = require('./engines/hsa-therapeutic-registration-engine');
const { auditCleanroom, auditGmpGdpChecklist } = require('./engines/hsa-gmp-gdp-auditor-engine');
const { evaluateColdChainMkt, calculateHaynesMkt } = require('./engines/mkt-cold-chain-engine');
const { evaluateWhoUmcCausality, auditAdrReporting } = require('./engines/hsa-adr-pharmacovigilance-engine');
const { modelReimbursementPricing } = require('./engines/ace-hta-reimbursement-modeler');
const { auditClinicalTrialHbra } = require('./engines/clinical-trial-hbra-engine');

// Rulesets
const rulesDir = path.join(__dirname, 'engines/rules');
const hsaFees = JSON.parse(fs.readFileSync(path.join(rulesDir, 'hsa-fees.json'), 'utf8'));
const gmpGdpRequirements = JSON.parse(fs.readFileSync(path.join(rulesDir, 'gmp-gdp-requirements.json'), 'utf8'));
const coldChainSpecs = JSON.parse(fs.readFileSync(path.join(rulesDir, 'cold-chain-specs.json'), 'utf8'));
const adrCausality = JSON.parse(fs.readFileSync(path.join(rulesDir, 'adr-causality.json'), 'utf8'));
const aceReimbursement = JSON.parse(fs.readFileSync(path.join(rulesDir, 'ace-reimbursement.json'), 'utf8'));

// Base Manifest
const baseManifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'extension-manifest.json'), 'utf8'));

// Full Pluggable Manifest with executable engine functions and rules
const manifest = {
  ...baseManifest,
  engines: {
    evaluateHsaRegistration,
    auditCleanroom,
    auditGmpGdpChecklist,
    evaluateColdChainMkt,
    calculateHaynesMkt,
    evaluateWhoUmcCausality,
    auditAdrReporting,
    modelReimbursementPricing,
    auditClinicalTrialHbra
  },
  rules: {
    hsaFees,
    gmpGdpRequirements,
    coldChainSpecs,
    adrCausality,
    aceReimbursement
  }
};

/**
 * Register this extension into a singapore-business-agent-skills core runtime.
 * @param {Object} [coreRegistry] Optional core extension registry; if omitted, attempts to require from core.
 * @returns {Object} Registration receipt
 */
function register(coreRegistry) {
  let reg = coreRegistry;
  if (!reg) {
    try {
      const core = require('singapore-business-agent-skills');
      reg = core.extensions || core;
    } catch {
      throw new Error(
        'Could not auto-resolve "singapore-business-agent-skills". Please pass the core registry to register(coreRegistry).'
      );
    }
  }

  if (typeof reg.registerExtension === 'function') {
    return reg.registerExtension(manifest);
  }
  throw new Error('Invalid core registry provided: missing registerExtension function.');
}

module.exports = {
  manifest,
  register,
  evaluateHsaRegistration,
  auditCleanroom,
  auditGmpGdpChecklist,
  evaluateColdChainMkt,
  calculateHaynesMkt,
  evaluateWhoUmcCausality,
  auditAdrReporting,
  modelReimbursementPricing,
  auditClinicalTrialHbra,
  engines: manifest.engines,
  rules: manifest.rules
};

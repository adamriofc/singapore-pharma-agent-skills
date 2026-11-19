/**
 * HSA Adverse Drug Reaction (ADR) & Vigilance Engine (`engines/hsa-adr-pharmacovigilance-engine.js`)
 *
 * Implements deterministic auditing of adverse drug reactions under:
 *   - Health Products Act 2007 (Cap. 122D)
 *   - Health Products (Therapeutic Products) Regulations 2016 Part 6 (Duties of Registrants)
 *   - HSA Guidance on Post-Marketing Vigilance for Therapeutic Products
 *   - WHO-UMC System for Standardised Case Causality Assessment
 *
 * Enforces HSA Vigilance and Compliance Branch (VCB) 15-calendar-day expedited fatal / life-threatening
 * statutory notification deadlines and WHO-UMC causality grading.
 *
 * Pure Node.js, zero external runtime dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let ADR_RULES = null;

function getRules() {
  if (!ADR_RULES) {
    const rulesPath = path.join(__dirname, 'rules/adr-causality.json');
    if (fs.existsSync(rulesPath)) {
      ADR_RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    } else {
      ADR_RULES = {
        reportingTimelines: {
          SERIOUS_FATAL_OR_LIFE_THREATENING: { maxCalendarDays: 15, escalationRequired: true },
          SERIOUS_OTHER: { maxCalendarDays: 15, escalationRequired: true },
          NON_SERIOUS: { maxCalendarDays: 180, escalationRequired: false }
        }
      };
    }
  }
  return ADR_RULES;
}

/**
 * Determine WHO-UMC Causality Level based on standardized diagnostic criteria.
 *
 * @param {Object} factors
 * @param {boolean} factors.plausibleTimeSequence Plausible temporal relationship to drug intake
 * @param {string} factors.dechallenge Dechallenge result: "POSITIVE", "NEGATIVE", "NOT_APPLICABLE", "UNKNOWN"
 * @param {string} factors.rechallenge Rechallenge result: "POSITIVE", "NEGATIVE", "NOT_APPLICABLE", "UNKNOWN"
 * @param {boolean} factors.alternativeCause Plausible alternative cause (underlying disease or concurrent medication)
 * @param {boolean} factors.informationComplete Whether necessary clinical verification data is complete
 * @returns {Object} { causalityLevel: string, rationale: string }
 */
function evaluateWhoUmcCausality(factors = {}) {
  const timeSeq = Boolean(factors.plausibleTimeSequence);
  const dechallenge = String(factors.dechallenge || 'UNKNOWN').toUpperCase();
  const rechallenge = String(factors.rechallenge || 'UNKNOWN').toUpperCase();
  const altCause = Boolean(factors.alternativeCause);
  const infoComplete = factors.informationComplete !== undefined ? Boolean(factors.informationComplete) : true;

  if (!infoComplete) {
    return {
      causalityLevel: 'CONDITIONAL_UNCLASSIFIED',
      rationale: 'Event reported but clinical verification or laboratory confirmation data is currently insufficient.'
    };
  }

  if (!timeSeq) {
    return {
      causalityLevel: 'UNLIKELY',
      rationale: 'Temporal relationship to drug administration makes a causal connection improbable.'
    };
  }

  if (rechallenge === 'POSITIVE' && dechallenge === 'POSITIVE' && !altCause) {
    return {
      causalityLevel: 'CERTAIN',
      rationale: 'Plausible time sequence, unequivocal improvement on dechallenge, recurrence on rechallenge, and no alternative explanation.'
    };
  }

  if (dechallenge === 'POSITIVE' && !altCause) {
    return {
      causalityLevel: 'PROBABLE',
      rationale: 'Reasonable time sequence, clinically plausible dechallenge response, and unlikely to be attributed to disease or other drugs.'
    };
  }

  if (altCause) {
    return {
      causalityLevel: 'POSSIBLE',
      rationale: 'Reasonable time sequence, but event could also be explained by concurrent disease or other medicinal products.'
    };
  }

  return {
    causalityLevel: 'POSSIBLE',
    rationale: 'Temporal relationship plausible, but dechallenge is unclear or rechallenge not performed.'
  };
}

/**
 * Audit ADR report against HSA Vigilance and Compliance Branch (VCB) reporting deadlines.
 *
 * @param {Object} input
 * @param {string} input.severity Severity class ("SERIOUS_FATAL_OR_LIFE_THREATENING", "SERIOUS_OTHER", "NON_SERIOUS")
 * @param {string|Date} input.dateReceived Date when marketing authorization holder first received the report
 * @param {string|Date} [input.dateAssessed] Date of current evaluation (defaults to now)
 * @param {Object} [input.causalityFactors] Diagnostic factors for WHO-UMC causality evaluation
 * @param {string} [input.therapeuticProductName] Name of the medicinal product
 * @returns {Object} Comprehensive pharmacovigilance evaluation receipt
 */
function auditAdrReporting(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT: Input must be a valid parameters object');
  }

  const severity = String(input.severity || 'SERIOUS_FATAL_OR_LIFE_THREATENING').toUpperCase().trim();
  const rules = getRules();
  const timelines = rules.reportingTimelines;

  if (!timelines[severity]) {
    const validSeverities = Object.keys(timelines).join(', ');
    throw new Error(`INVALID_INPUT: Severity '${severity}' not recognized. Valid: ${validSeverities}`);
  }

  const timelineInfo = timelines[severity];
  const maxDays = timelineInfo.maxCalendarDays;

  // Date parsing
  if (!input.dateReceived) {
    throw new Error('INVALID_INPUT: dateReceived is required for statutory deadline calculation.');
  }

  const receivedDate = new Date(input.dateReceived);
  if (isNaN(receivedDate.getTime())) {
    throw new Error(`INVALID_INPUT: dateReceived '${input.dateReceived}' is not a valid date.`);
  }

  const assessedDate = input.dateAssessed ? new Date(input.dateAssessed) : new Date();
  if (isNaN(assessedDate.getTime())) {
    throw new Error(`INVALID_INPUT: dateAssessed '${input.dateAssessed}' is not a valid date.`);
  }

  const diffTimeMs = assessedDate.getTime() - receivedDate.getTime();
  if (diffTimeMs < 0) {
    throw new Error('INVALID_INPUT: dateAssessed cannot be earlier than dateReceived');
  }
  const daysElapsed = Math.floor(diffTimeMs / (1000 * 60 * 60 * 24));
  const daysRemaining = maxDays - daysElapsed;
  const isOverdue = daysRemaining < 0;

  // Statutory deadline date
  const deadlineDate = new Date(receivedDate.getTime() + maxDays * 24 * 60 * 60 * 1000);
  const deadlineDateString = deadlineDate.toISOString().split('T')[0];

  // WHO-UMC Causality
  const causalityAudit = evaluateWhoUmcCausality(input.causalityFactors || {});

  // Mandatory actions
  const actions = [];
  if (isOverdue) {
    actions.push(`OVERDUE_BREACH: Statutory ${maxDays}-day deadline exceeded by ${Math.abs(daysRemaining)} days. Immediate expedited submission to HSA PRISM portal mandated.`);
    actions.push('File a late submission explanation letter to HSA Vigilance and Compliance Branch (VCB).');
  } else if (daysRemaining <= 3 && timelineInfo.escalationRequired) {
    actions.push(`URGENT_ACTION: ${daysRemaining} days remaining before statutory ${maxDays}-day deadline. Prioritize case narrative finalization and electronic CIOMS XML upload.`);
  } else if (timelineInfo.escalationRequired) {
    actions.push(`Expedited electronic submission to HSA PRISM required within ${daysRemaining} days.`);
  } else {
    actions.push('Aggregate and archive for Periodic Benefit-Risk Evaluation Report (PBRER) submission.');
  }

  return {
    therapeuticProductName: input.therapeuticProductName || 'Unspecified Product',
    severity,
    statutoryMaxCalendarDays: maxDays,
    reportingCategory: timelineInfo.escalationRequired ? 'EXPEDITED_MANDATORY_15_DAYS' : 'PERIODIC_PBRER',
    timelineStatus: {
      dateReceived: receivedDate.toISOString().split('T')[0],
      statutoryDeadlineDate: deadlineDateString,
      daysElapsed,
      daysRemaining: Math.max(0, daysRemaining),
      isOverdue
    },
    whoUmcCausality: causalityAudit,
    hsaVcbActions: actions,
    statutoryBasis: 'Health Products (Therapeutic Products) Regulations 2016 Part 6 & HSA VCB Guidance'
  };
}

module.exports = {
  evaluateWhoUmcCausality,
  auditAdrReporting
};

/**
 * HSA PIC/S GMP & SS 585 GDP Compliance Auditor Engine (`engines/hsa-gmp-gdp-auditor-engine.js`)
 *
 * Implements deterministic auditing of pharmaceutical facilities against:
 *   - PIC/S Guide to Good Manufacturing Practice for Medicinal Products (PE 009-17)
 *   - Singapore Standard SS 585:2013 Good Distribution Practice for Medical Devices & Pharmaceuticals
 *   - Cleanroom Classification Standards (ISO 14644-1 & PIC/S Annex 1 for Grades A, B, C, D)
 *
 * Pure Node.js, zero external runtime dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let GMP_GDP_RULES = null;

function getRules() {
  if (!GMP_GDP_RULES) {
    const rulesPath = path.join(__dirname, 'rules/gmp-gdp-requirements.json');
    if (fs.existsSync(rulesPath)) {
      GMP_GDP_RULES = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
    } else {
      GMP_GDP_RULES = {
        cleanroomClasses: {
          GRADE_A: { maxParticles05AtRest: 3520, maxParticles05InOperation: 3520, maxParticles50AtRest: 20, maxParticles50InOperation: 20, recommendedAirVelocityMps: 0.45, differentialPressurePa: 15 },
          GRADE_B: { maxParticles05AtRest: 3520, maxParticles05InOperation: 352000, maxParticles50AtRest: 29, maxParticles50InOperation: 2900, differentialPressurePa: 15, airChangesPerHourMin: 20 },
          GRADE_C: { maxParticles05AtRest: 352000, maxParticles05InOperation: 3520000, maxParticles50AtRest: 2900, maxParticles50InOperation: 29000, differentialPressurePa: 10, airChangesPerHourMin: 20 },
          GRADE_D: { maxParticles05AtRest: 3520000, maxParticles05InOperation: null, maxParticles50AtRest: 29000, maxParticles50InOperation: null, differentialPressurePa: 10, airChangesPerHourMin: 20 }
        }
      };
    }
  }
  return GMP_GDP_RULES;
}

/**
 * Audit cleanroom environmental monitoring data against PIC/S Annex 1 & ISO 14644-1.
 *
 * @param {Object} input
 * @param {string} input.grade Cleanroom grade ("GRADE_A", "GRADE_B", "GRADE_C", "GRADE_D")
 * @param {number} input.particles05AtRest Observed 0.5 µm particle count per m3 (at-rest)
 * @param {number} [input.particles05InOperation] Observed 0.5 µm particle count per m3 (in-operation)
 * @param {number} [input.particles50AtRest] Observed 5.0 µm particle count per m3 (at-rest)
 * @param {number} [input.particles50InOperation] Observed 5.0 µm particle count per m3 (in-operation)
 * @param {number} [input.differentialPressurePa] Measured positive differential pressure in Pascals
 * @param {number} [input.airVelocityMps] Measured laminar air flow velocity in m/s (for Grade A)
 * @param {number} [input.microbialAirCfuM3] Measured active air settle/sampler CFU per m3
 * @returns {Object} Cleanroom qualification verdict
 */
function auditCleanroom(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT: Input must be a valid parameters object');
  }

  const grade = String(input.grade || 'GRADE_B').toUpperCase().trim();
  const rules = getRules();
  const limits = rules.cleanroomClasses[grade];

  if (!limits) {
    const validGrades = Object.keys(rules.cleanroomClasses).join(', ');
    throw new Error(`INVALID_INPUT: Grade '${grade}' not recognized. Valid grades: ${validGrades}`);
  }

  // Validate numeric fields are valid and non-negative
  const numericFields = [
    { key: 'particles05AtRest', name: '0.5 µm particle count at-rest' },
    { key: 'particles05InOperation', name: '0.5 µm particle count in-operation' },
    { key: 'particles50AtRest', name: '5.0 µm particle count at-rest' },
    { key: 'particles50InOperation', name: '5.0 µm particle count in-operation' },
    { key: 'differentialPressurePa', name: 'Differential pressure (Pa)' },
    { key: 'airVelocityMps', name: 'Air velocity (m/s)' },
    { key: 'microbialAirCfuM3', name: 'Microbial air count (CFU/m3)' }
  ];

  for (const field of numericFields) {
    if (input[field.key] !== undefined) {
      const val = input[field.key];
      if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val) || val < 0) {
        throw new Error(`INVALID_INPUT: ${field.name} must be a valid non-negative number`);
      }
    }
  }

  const breaches = [];
  const observations = [];

  // 1. Particulate 0.5 µm at-rest
  if (typeof input.particles05AtRest === 'number') {
    if (limits.maxParticles05AtRest !== null && input.particles05AtRest > limits.maxParticles05AtRest) {
      breaches.push(`PARTICLE_05_AT_REST_EXCEEDED: Measured ${input.particles05AtRest} particles/m3 exceeds statutory limit of ${limits.maxParticles05AtRest}`);
    } else {
      observations.push(`0.5 µm at-rest particles compliant (${input.particles05AtRest}/${limits.maxParticles05AtRest})`);
    }
  }

  // 2. Particulate 0.5 µm in-operation
  if (typeof input.particles05InOperation === 'number' && limits.maxParticles05InOperation !== null) {
    if (input.particles05InOperation > limits.maxParticles05InOperation) {
      breaches.push(`PARTICLE_05_IN_OP_EXCEEDED: Measured ${input.particles05InOperation} particles/m3 exceeds operational limit of ${limits.maxParticles05InOperation}`);
    }
  }

  // 3. Particulate 5.0 µm at-rest
  if (typeof input.particles50AtRest === 'number' && limits.maxParticles50AtRest !== null) {
    if (input.particles50AtRest > limits.maxParticles50AtRest) {
      breaches.push(`PARTICLE_50_AT_REST_EXCEEDED: Measured ${input.particles50AtRest} particles/m3 exceeds statutory limit of ${limits.maxParticles50AtRest}`);
    }
  }

  // 4. Differential Pressure Delta-P
  if (typeof input.differentialPressurePa === 'number') {
    const requiredDp = limits.differentialPressurePa || 10;
    if (input.differentialPressurePa < requiredDp) {
      breaches.push(`PRESSURE_CASCADE_INSUFFICIENT: Measured differential pressure ${input.differentialPressurePa} Pa is below mandated ${requiredDp} Pa cascade`);
    } else {
      observations.push(`Differential pressure cascade verified at ${input.differentialPressurePa} Pa (min ${requiredDp} Pa)`);
    }
  }

  // 5. Air velocity for Grade A LAF
  if (grade === 'GRADE_A' && typeof input.airVelocityMps === 'number') {
    // 0.45 m/s ± 20% -> 0.36 to 0.54 m/s
    if (input.airVelocityMps < 0.36 || input.airVelocityMps > 0.54) {
      breaches.push(`LAF_VELOCITY_OUT_OF_SPEC: Laminar airflow velocity ${input.airVelocityMps} m/s outside acceptable 0.36 - 0.54 m/s range`);
    } else {
      observations.push(`Laminar airflow velocity compliant at ${input.airVelocityMps} m/s`);
    }
  }

  // 6. Microbial air count
  if (typeof input.microbialAirCfuM3 === 'number' && limits.microbiologicalAirCfuM3 !== null) {
    if (input.microbialAirCfuM3 > limits.microbiologicalAirCfuM3) {
      breaches.push(`BIOBURDEN_AIR_EXCEEDED: Measured viable air count ${input.microbialAirCfuM3} CFU/m3 exceeds statutory limit of ${limits.microbiologicalAirCfuM3} CFU/m3`);
    }
  }

  const isCompliant = breaches.length === 0;

  return {
    grade,
    isCompliant,
    verdict: isCompliant ? 'QUALIFIED_COMPLIANT' : 'NON_CONFORMING_BREACH',
    riskLevel: breaches.length === 0 ? 'LOW' : (grade === 'GRADE_A' || grade === 'GRADE_B' ? 'CRITICAL' : 'MAJOR'),
    breaches,
    observations,
    standardReference: 'PIC/S PE 009-17 Annex 1 & ISO 14644-1 Cleanroom Standards'
  };
}

/**
 * Audit overall GMP or GDP facility checklists.
 *
 * @param {Object} input
 * @param {string} input.standard Type of audit ("PICS_GMP" or "SS585_GDP")
 * @param {Array<Object>} input.checklistResponses Array of { id, status: "PASS"|"FAIL"|"NA", notes }
 * @returns {Object} Comprehensive audit report
 */
function auditGmpGdpChecklist(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT: Input must be a valid parameters object');
  }

  const standard = String(input.standard || 'PICS_GMP').toUpperCase().trim();
  const rules = getRules();
  const fullChecklist = rules.auditChecklists ? rules.auditChecklists[standard] : null;

  if (!fullChecklist) {
    throw new Error(`INVALID_INPUT: Standard '${standard}' not recognized. Valid: PICS_GMP, SS585_GDP`);
  }

  if (input.checklistResponses !== undefined && !Array.isArray(input.checklistResponses)) {
    throw new Error('INVALID_INPUT: checklistResponses must be an array of response objects');
  }

  const responses = Array.isArray(input.checklistResponses) ? input.checklistResponses : [];
  const responseMap = new Map();
  responses.forEach(r => {
    if (r && r.id) responseMap.set(String(r.id).toUpperCase(), r);
  });

  const criticalFindings = [];
  const majorFindings = [];
  const minorFindings = [];
  let passedCount = 0;
  let totalEvaluated = 0;

  fullChecklist.forEach(item => {
    const res = responseMap.get(item.id.toUpperCase());
    totalEvaluated++;
    if (!res || res.status === 'FAIL') {
      const finding = {
        id: item.id,
        clause: item.clause,
        title: item.title,
        criticality: item.criticality,
        criteria: item.criteria,
        observedFailure: res && res.notes ? res.notes : 'Requirement not satisfied or evidence missing'
      };
      if (item.criticality === 'CRITICAL') {
        criticalFindings.push(finding);
      } else if (item.criticality === 'MAJOR') {
        majorFindings.push(finding);
      } else {
        minorFindings.push(finding);
      }
    } else if (res.status === 'PASS') {
      passedCount++;
    }
  });

  const complianceScorePercent = totalEvaluated > 0
    ? Math.round((passedCount / totalEvaluated) * 100)
    : 100;

  let auditVerdict = 'PASSED';
  let licenseRecommendation = 'RECOMMEND_ISSUANCE_OR_RETENTION';

  if (criticalFindings.length > 0) {
    auditVerdict = 'CRITICAL_DEFICIENCIES_DETECTED';
    licenseRecommendation = 'REJECT_OR_SUSPEND_LICENSE_PENDING_REINSPECTION';
  } else if (majorFindings.length > 2) {
    auditVerdict = 'MAJOR_DEFICIENCIES_DETECTED';
    licenseRecommendation = 'CONDITIONAL_APPROVAL_PENDING_30_DAY_CAPA';
  } else if (majorFindings.length > 0 || minorFindings.length > 0) {
    auditVerdict = 'SUBSTANTIALLY_COMPLIANT_WITH_OBSERVATIONS';
    licenseRecommendation = 'APPROVE_SUBJECT_TO_CAPA_CLOSEOUT';
  }

  return {
    standard,
    totalRequirements: totalEvaluated,
    passedCount,
    complianceScorePercent,
    auditVerdict,
    licenseRecommendation,
    findingsSummary: {
      criticalCount: criticalFindings.length,
      majorCount: majorFindings.length,
      minorCount: minorFindings.length
    },
    criticalFindings,
    majorFindings,
    minorFindings,
    statutoryBasis: standard === 'PICS_GMP'
      ? 'PIC/S Guide to Good Manufacturing Practice for Medicinal Products (PE 009-17)'
      : 'Singapore Standard SS 585:2013 Code of Practice for Good Distribution Practice'
  };
}

module.exports = {
  auditCleanroom,
  auditGmpGdpChecklist
};

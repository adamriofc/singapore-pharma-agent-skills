/**
 * Tropical Cold Chain Mean Kinetic Temperature (MKT) Engine (`engines/mkt-cold-chain-engine.js`)
 *
 * Implements deterministic Mean Kinetic Temperature (MKT) calculation per Haynes (1971),
 * USP <1079> Good Storage & Shipping Practices, and evaluation of temperature excursions
 * under Singapore Standard SS 585:2013 Good Distribution Practice.
 *
 * Specifically models Singapore equatorial ambient heat excursions (30.5°C mean / 80% RH)
 * encountered during Changi Airport tarmac transit and local hospital deliveries.
 *
 * Pure Node.js, zero external runtime dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

let COLD_CHAIN_SPECS = null;

function getSpecs() {
  if (!COLD_CHAIN_SPECS) {
    const specsPath = path.join(__dirname, 'rules/cold-chain-specs.json');
    if (fs.existsSync(specsPath)) {
      COLD_CHAIN_SPECS = JSON.parse(fs.readFileSync(specsPath, 'utf8'));
    } else {
      COLD_CHAIN_SPECS = {
        defaultConstants: {
          activationEnergyDeltaH: 83144.0,
          gasConstantR: 8.314472,
          deltaHOverR: 10000.0,
          absoluteZeroOffset: 273.15,
          singaporeAmbientMeanCelsius: 30.5,
          singaporeAmbientPeakCelsius: 32.0,
          singaporeRelativeHumidityPct: 80.0
        },
        storageConditions: {
          COLD_CHAIN_2_8: {
            name: "Chilled Cold Chain (2°C - 8°C)",
            minCelsius: 2.0,
            maxCelsius: 8.0,
            freezeRiskThresholdCelsius: 0.0,
            criticalExcursionUpperCelsius: 15.0,
            maxTolerableExcursionHours: 24.0
          },
          CONTROLLED_ROOM_15_25: {
            name: "Controlled Room Temperature (15°C - 25°C)",
            minCelsius: 15.0,
            maxCelsius: 25.0,
            freezeRiskThresholdCelsius: 8.0,
            criticalExcursionUpperCelsius: 30.0,
            maxTolerableExcursionHours: 72.0
          }
        }
      };
    }
  }
  return COLD_CHAIN_SPECS;
}

/**
 * Calculate Mean Kinetic Temperature (MKT) and evaluate Singapore GDP cold-chain compliance.
 *
 * @param {Object} params
 * @param {Array<number|Object>} params.readings Array of temperatures in Celsius, or array of objects with tempCelsius property.
 * @param {string} [params.storageCondition="COLD_CHAIN_2_8"] Storage condition identifier (e.g. COLD_CHAIN_2_8, CONTROLLED_ROOM_15_25, DEEP_FREEZE_MINUS_20).
 * @param {Object} [params.customSpecification] Custom { minCelsius, maxCelsius, freezeRiskThresholdCelsius, criticalExcursionUpperCelsius, maxTolerableExcursionHours }.
 * @param {number} [params.samplingIntervalMinutes=15] Interval between consecutive readings in minutes.
 * @param {number} [params.activationEnergyDeltaH=83144] Activation energy in J/mol (default 83.144 kJ/mol).
 * @param {boolean} [params.freezeSensitive=true] Whether the biological/pharmaceutical product is freeze-sensitive (e.g. vaccines, monoclonals).
 * @param {string} [params.productName] Product name / batch identifier for the compliance receipt.
 * @returns {Object} Comprehensive MKT audit and GDP compliance evaluation.
 */
function evaluateColdChainMkt(params) {
  if (!params || typeof params !== 'object') {
    throw new Error('INVALID_INPUT: params must be a non-null object.');
  }

  const {
    readings,
    storageCondition = 'COLD_CHAIN_2_8',
    customSpecification,
    samplingIntervalMinutes = 15,
    activationEnergyDeltaH,
    freezeSensitive = true,
    productName = null
  } = params;

  if (!Array.isArray(readings) || readings.length < 2) {
    throw new Error('INVALID_INPUT: readings must be an array containing at least 2 temperature entries.');
  }

  if (typeof samplingIntervalMinutes !== 'number' || samplingIntervalMinutes <= 0 || isNaN(samplingIntervalMinutes)) {
    throw new Error('INVALID_INPUT: samplingIntervalMinutes must be a positive number.');
  }

  const specs = getSpecs();
  const constants = specs.defaultConstants;
  const deltaH = typeof activationEnergyDeltaH === 'number' && activationEnergyDeltaH > 0
    ? activationEnergyDeltaH
    : constants.activationEnergyDeltaH;
  const R = constants.gasConstantR;
  const deltaHOverR = deltaH / R;
  const kelvinOffset = constants.absoluteZeroOffset;

  let spec = null;
  if (customSpecification && typeof customSpecification === 'object') {
    if (typeof customSpecification.minCelsius !== 'number' || typeof customSpecification.maxCelsius !== 'number' ||
        customSpecification.minCelsius >= customSpecification.maxCelsius) {
      throw new Error('INVALID_INPUT: customSpecification must have numeric minCelsius < maxCelsius.');
    }
    spec = {
      name: customSpecification.name || 'Custom Storage Specification',
      minCelsius: customSpecification.minCelsius,
      maxCelsius: customSpecification.maxCelsius,
      freezeRiskThresholdCelsius: typeof customSpecification.freezeRiskThresholdCelsius === 'number'
        ? customSpecification.freezeRiskThresholdCelsius
        : (customSpecification.minCelsius <= 2.0 ? 0.0 : null),
      criticalExcursionUpperCelsius: typeof customSpecification.criticalExcursionUpperCelsius === 'number'
        ? customSpecification.criticalExcursionUpperCelsius
        : (customSpecification.maxCelsius + 10.0),
      maxTolerableExcursionHours: typeof customSpecification.maxTolerableExcursionHours === 'number'
        ? customSpecification.maxTolerableExcursionHours
        : 24.0
    };
  } else {
    spec = specs.storageConditions[storageCondition];
    if (!spec) {
      const validConditions = Object.keys(specs.storageConditions).join(', ');
      throw new Error(`INVALID_INPUT: storageCondition "${storageCondition}" not recognized. Valid: ${validConditions}`);
    }
  }

  // Parse and validate temperatures
  const temps = [];
  for (let i = 0; i < readings.length; i++) {
    const item = readings[i];
    let val = null;
    if (typeof item === 'number') {
      val = item;
    } else if (item && typeof item === 'object' && typeof item.tempCelsius === 'number') {
      val = item.tempCelsius;
    } else if (item && typeof item === 'object' && typeof item.temperature === 'number') {
      val = item.temperature;
    } else {
      throw new Error(`INVALID_INPUT: reading at index ${i} is not a valid numeric temperature.`);
    }

    if (isNaN(val) || !isFinite(val)) {
      throw new Error(`INVALID_INPUT: reading at index ${i} contains NaN or non-finite temperature.`);
    }

    // Absolute zero safety check
    if (val < -kelvinOffset) {
      throw new Error(`INVALID_INPUT: temperature ${val}°C is below absolute zero (-273.15°C).`);
    }

    temps.push(val);
  }

  const n = temps.length;
  let sumExp = 0;
  let arithmeticSum = 0;
  let minObserved = Infinity;
  let maxObserved = -Infinity;

  let upperExcursionCount = 0;
  let lowerExcursionCount = 0;
  let criticalUpperCount = 0;
  let freezeCount = 0;
  let tropicalAmbientExcursionCount = 0; // Singapore outdoor heat >= 30.0°C

  for (let i = 0; i < n; i++) {
    const tC = temps[i];
    const tK = tC + kelvinOffset;

    arithmeticSum += tC;
    if (tC < minObserved) minObserved = tC;
    if (tC > maxObserved) maxObserved = tC;

    // Arrhenius exponential term: e^(-(ΔH/R) / T)
    const exponent = -deltaHOverR / tK;
    sumExp += Math.exp(exponent);

    // Excursion counters
    if (tC > spec.maxCelsius) {
      upperExcursionCount++;
      if (spec.criticalExcursionUpperCelsius !== null && tC >= spec.criticalExcursionUpperCelsius) {
        criticalUpperCount++;
      }
    } else if (tC < spec.minCelsius) {
      lowerExcursionCount++;
    }

    if (spec.freezeRiskThresholdCelsius !== null && tC <= spec.freezeRiskThresholdCelsius) {
      freezeCount++;
    }

    if (tC >= 30.0) {
      tropicalAmbientExcursionCount++;
    }
  }

  // Mean Kinetic Temperature (Kelvin):
  // Tk = (ΔH/R) / -ln( sumExp / n )
  const meanExp = sumExp / n;
  const tkKelvin = deltaHOverR / -Math.log(meanExp);
  const mktCelsius = tkKelvin - kelvinOffset;
  const arithmeticMeanCelsius = arithmeticSum / n;

  // Duration calculations
  const totalDurationMinutes = n * samplingIntervalMinutes;
  const totalDurationHours = Math.round((totalDurationMinutes / 60) * 100) / 100;

  const upperExcursionMinutes = upperExcursionCount * samplingIntervalMinutes;
  const upperExcursionHours = Math.round((upperExcursionMinutes / 60) * 100) / 100;

  const lowerExcursionMinutes = lowerExcursionCount * samplingIntervalMinutes;
  const lowerExcursionHours = Math.round((lowerExcursionMinutes / 60) * 100) / 100;

  const totalExcursionHours = Math.round(((upperExcursionMinutes + lowerExcursionMinutes) / 60) * 100) / 100;
  const criticalUpperHours = Math.round(((criticalUpperCount * samplingIntervalMinutes) / 60) * 100) / 100;
  const freezeHours = Math.round(((freezeCount * samplingIntervalMinutes) / 60) * 100) / 100;
  const tropicalAmbientHours = Math.round(((tropicalAmbientExcursionCount * samplingIntervalMinutes) / 60) * 100) / 100;

  // Evaluate Compliance Classification
  let complianceStatus = 'COMPLIANT';
  let riskLevel = 'LOW';
  const complianceViolations = [];
  const requiredActions = [];

  const isFreezeEvent = freezeSensitive && freezeCount > 0;
  const isMktExceeded = mktCelsius > spec.maxCelsius || mktCelsius < spec.minCelsius;
  const isCriticalUpperExceeded = criticalUpperCount > 0;
  const isDurationExceeded = totalExcursionHours > spec.maxTolerableExcursionHours;

  if (isFreezeEvent) {
    complianceStatus = 'BREACH_QUARANTINE_MANDATED';
    riskLevel = 'CRITICAL';
    complianceViolations.push(
      `FREEZE_BREACH: Product experienced ${freezeHours} hours at or below ${spec.freezeRiskThresholdCelsius}°C. Freeze-sensitive biologics risk irreversible protein denaturation.`
    );
    requiredActions.push('Segregate and apply immediate physical & ERP warehouse quarantine (Status: QUARANTINED).');
    requiredActions.push('Perform analytical potency / particulate testing or contact Marketing Authorization Holder.');
  }

  if (isCriticalUpperExceeded) {
    complianceStatus = 'BREACH_QUARANTINE_MANDATED';
    riskLevel = 'CRITICAL';
    complianceViolations.push(
      `CRITICAL_TEMPERATURE_SPIKE: Temperature reached ${maxObserved}°C (critical threshold: ${spec.criticalExcursionUpperCelsius}°C) for ${criticalUpperHours} hours.`
    );
    if (!requiredActions.includes('Segregate and apply immediate physical & ERP warehouse quarantine (Status: QUARANTINED).')) {
      requiredActions.push('Segregate and apply immediate physical & ERP warehouse quarantine (Status: QUARANTINED).');
    }
  }

  if (tropicalAmbientHours > 0 && spec.maxCelsius <= 8.0) {
    complianceViolations.push(
      `TROPICAL_HEAT_EXPOSURE: Product exposed to Singapore ambient tarmac heat (≥30.0°C) for ${tropicalAmbientHours} hours.`
    );
  }

  if (isMktExceeded) {
    complianceStatus = 'BREACH_QUARANTINE_MANDATED';
    if (riskLevel !== 'CRITICAL') {
      riskLevel = 'HIGH';
    }
    complianceViolations.push(
      `MKT_SPEC_EXCEEDED: Calculated MKT is ${Math.round(mktCelsius * 100) / 100}°C, which exceeds the specified range of [${spec.minCelsius}°C, ${spec.maxCelsius}°C].`
    );
    if (!requiredActions.includes('Segregate and apply immediate physical & ERP warehouse quarantine (Status: QUARANTINED).')) {
      requiredActions.push('Segregate and apply immediate physical & ERP warehouse quarantine (Status: QUARANTINED).');
    }
  }

  if (isDurationExceeded && complianceStatus !== 'BREACH_QUARANTINE_MANDATED') {
    complianceStatus = 'BREACH_QUARANTINE_MANDATED';
    riskLevel = 'HIGH';
    complianceViolations.push(
      `EXCURSION_DURATION_EXCEEDED: Cumulative excursion time (${totalExcursionHours} hrs) exceeds standard stability limit of ${spec.maxTolerableExcursionHours} hrs.`
    );
    requiredActions.push('Segregate and apply immediate physical & ERP warehouse quarantine (Status: QUARANTINED).');
  }

  // If there were excursions but MKT is still within spec and no critical spikes
  if (complianceStatus === 'COMPLIANT' && (upperExcursionCount > 0 || lowerExcursionCount > 0)) {
    complianceStatus = 'ACCEPTABLE_WITH_JUSTIFICATION';
    riskLevel = 'MEDIUM';
    complianceViolations.push(
      `TRANSIENT_EXCURSION: Temperature drifted outside [${spec.minCelsius}°C, ${spec.maxCelsius}°C] for ${totalExcursionHours} hours, but MKT (${Math.round(mktCelsius * 100) / 100}°C) remains within limits.`
    );
    requiredActions.push('Log incident in SS 585 Temperature Excursion Deviation Register.');
    requiredActions.push('Initiate internal deviation report & CAPA investigation per SS 585:2013 Clause 4.');
    requiredActions.push('Obtain formal release authorization from Responsible Person (RP) before distribution.');
  }

  if (complianceStatus === 'COMPLIANT') {
    requiredActions.push('Archive datalogger records in GDP repository for minimum 5 years per Singapore statutory guidelines.');
  } else if (complianceStatus === 'BREACH_QUARANTINE_MANDATED') {
    requiredActions.push('Notify HSA and Principal / Product Licence Holder if batch has entered public hospital distribution channels.');
  }

  return {
    productName,
    storageCondition,
    specification: {
      name: spec.name,
      minCelsius: spec.minCelsius,
      maxCelsius: spec.maxCelsius,
      freezeRiskThresholdCelsius: spec.freezeRiskThresholdCelsius,
      criticalExcursionUpperCelsius: spec.criticalExcursionUpperCelsius,
      maxTolerableExcursionHours: spec.maxTolerableExcursionHours
    },
    metrics: {
      totalReadings: n,
      samplingIntervalMinutes,
      totalDurationHours,
      minObservedCelsius: Math.round(minObserved * 100) / 100,
      maxObservedCelsius: Math.round(maxObserved * 100) / 100,
      arithmeticMeanCelsius: Math.round(arithmeticMeanCelsius * 100) / 100,
      mktCelsius: Math.round(mktCelsius * 100) / 100,
      mktKelvin: Math.round(tkKelvin * 100) / 100,
      deltaMktVsArithmetic: Math.round((mktCelsius - arithmeticMeanCelsius) * 100) / 100
    },
    excursions: {
      hasExcursions: upperExcursionCount > 0 || lowerExcursionCount > 0,
      upperExcursionCount,
      upperExcursionHours,
      lowerExcursionCount,
      lowerExcursionHours,
      totalExcursionHours,
      criticalUpperCount,
      criticalUpperHours,
      freezeCount,
      freezeHours,
      tropicalAmbientHours
    },
    auditVerdict: {
      complianceStatus,
      riskLevel,
      isCompliant: complianceStatus === 'COMPLIANT',
      requiresQuarantine: complianceStatus === 'BREACH_QUARANTINE_MANDATED',
      violations: complianceViolations,
      mandatedActions: requiredActions
    },
    statutoryFramework: {
      gdpStandard: 'Singapore Standard SS 585:2013 Code of Practice for Good Distribution Practice',
      internationalStandards: ['USP <1079>', 'WHO TRS 961 Annex 9'],
      mktFormula: 'Haynes (1971): ΔH/R = 10,000 K (Activation Energy = 83.144 kJ/mol)'
    }
  };
}

/**
 * Pure calculation of Mean Kinetic Temperature (MKT) via Haynes (1971) formula.
 *
 * @param {Array<number>} temperaturesCelsius Array of temperatures in Celsius
 * @param {number} [deltaHOverR=10000.0] Ratio of activation energy to gas constant ΔH/R (Kelvin)
 * @returns {Object} { mktCelsius, mktKelvin, readingsCount, deltaHOverR }
 */
function calculateHaynesMkt(temperaturesCelsius, deltaHOverR = 10000.0) {
  if (!Array.isArray(temperaturesCelsius) || temperaturesCelsius.length === 0) {
    throw new Error('INVALID_INPUT: temperaturesCelsius must be a non-empty array of numbers.');
  }
  const kelvinOffset = 273.15;
  const n = temperaturesCelsius.length;
  let sumExp = 0;
  for (let i = 0; i < n; i++) {
    const tC = Number(temperaturesCelsius[i]);
    if (isNaN(tC) || !Number.isFinite(tC)) {
      throw new Error(`INVALID_INPUT: Temperature reading at index ${i} is not a valid finite number.`);
    }
    const tK = tC + kelvinOffset;
    if (tK <= 0) {
      throw new Error(`INVALID_INPUT: Temperature ${tC}°C is at or below absolute zero.`);
    }
    sumExp += Math.exp(-deltaHOverR / tK);
  }
  const meanExp = sumExp / n;
  const tkKelvin = deltaHOverR / -Math.log(meanExp);
  const mktCelsius = tkKelvin - kelvinOffset;
  return {
    mktCelsius: Math.round(mktCelsius * 100) / 100,
    mktKelvin: Math.round(tkKelvin * 100) / 100,
    readingsCount: n,
    deltaHOverR
  };
}

module.exports = {
  evaluateColdChainMkt,
  calculateHaynesMkt
};

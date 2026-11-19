/**
 * TypeScript Typings for `singapore-pharma-agent-skills`
 */

export interface ExtensionSkill {
  id: string;
  name: string;
  description: string;
  path: string;
  risk_level?: string;
  rule_type?: string;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  domain: string;
  author?: string;
  license?: string;
  description: string;
  statutoryFrameworks?: string[];
  skills: ExtensionSkill[];
  engines: Record<string, (...args: any[]) => any>;
  rules: Record<string, any>;
}

export interface HsaRegistrationParams {
  category: "NDA_1" | "NDA_2" | "NDA_3" | "GDA_1" | "GDA_2" | "VARIATION_MAV_1" | "VARIATION_MIV_1" | "VARIATION_MIV_2" | "ANNUAL_RETENTION";
  pathwayPreference?: "VERIFICATION" | "ABRIDGED" | "FULL";
  referenceAgencies?: string[];
  includeScreeningFee?: boolean;
  dossier?: {
    ctdModules?: {
      module1Admin?: boolean;
      module2Summaries?: boolean;
      module3Quality?: boolean;
      module4Nonclinical?: boolean;
      module5Clinical?: boolean;
    };
    actdParts?: {
      part1Admin?: boolean;
      part2Quality?: boolean;
      part3Nonclinical?: boolean;
      part4Clinical?: boolean;
    };
  };
}

export interface HsaRegistrationResult {
  category: string;
  categoryName: string;
  pathway: string;
  evaluationSlaWorkingDays: number;
  slaDescription: string;
  totalStatutoryFeeSgd: number;
  feeBreakdownSgd: {
    screeningFee: number;
    evaluationFee: number;
  };
  referenceAgenciesQualified: string[];
  dossierAudit: {
    format: "ICH_CTD" | "ACTD";
    isComplete: boolean;
    readinessScorePercent: number;
    moduleStatus?: Record<string, string>;
    partsStatus?: Record<string, string>;
  } | null;
  statutoryBasis: string;
}

export interface CleanroomAuditParams {
  grade: "GRADE_A" | "GRADE_B" | "GRADE_C" | "GRADE_D";
  particles05AtRest: number;
  particles05InOperation?: number;
  particles50AtRest?: number;
  particles50InOperation?: number;
  differentialPressurePa?: number;
  airVelocityMps?: number;
  microbialAirCfuM3?: number;
}

export interface CleanroomAuditResult {
  grade: string;
  isCompliant: boolean;
  verdict: string;
  riskLevel: string;
  breaches: string[];
  observations: string[];
  standardReference: string;
}

export interface GmpGdpChecklistParams {
  standard: "PICS_GMP" | "SS585_GDP";
  checklistResponses: Array<{
    id: string;
    status: "PASS" | "FAIL" | "NA";
    notes?: string;
  }>;
}

export interface GmpGdpChecklistResult {
  standard: string;
  totalRequirements: number;
  passedCount: number;
  complianceScorePercent: number;
  auditVerdict: string;
  licenseRecommendation: string;
  findingsSummary: {
    criticalCount: number;
    majorCount: number;
    minorCount: number;
  };
  criticalFindings: any[];
  majorFindings: any[];
  minorFindings: any[];
  statutoryBasis: string;
}

export interface ColdChainMktParams {
  readings: Array<number | { tempCelsius: number } | { temperature: number }>;
  storageCondition?: "COLD_CHAIN_2_8" | "DEEP_FREEZE_MINUS_20" | "ULTRA_COLD_MINUS_80" | "COOL_STORAGE_8_15" | "CONTROLLED_ROOM_15_25";
  customSpecification?: {
    name?: string;
    minCelsius: number;
    maxCelsius: number;
    freezeRiskThresholdCelsius?: number;
    criticalExcursionUpperCelsius?: number;
    maxTolerableExcursionHours?: number;
  };
  samplingIntervalMinutes?: number;
  activationEnergyDeltaH?: number;
  freezeSensitive?: boolean;
  productName?: string;
}

export interface ColdChainMktResult {
  productName: string | null;
  storageCondition: string;
  specification: {
    name: string;
    minCelsius: number;
    maxCelsius: number;
    freezeRiskThresholdCelsius: number | null;
    criticalExcursionUpperCelsius: number | null;
    maxTolerableExcursionHours: number;
  };
  metrics: {
    totalReadings: number;
    samplingIntervalMinutes: number;
    totalDurationHours: number;
    minObservedCelsius: number;
    maxObservedCelsius: number;
    arithmeticMeanCelsius: number;
    mktCelsius: number;
    mktKelvin: number;
    deltaMktVsArithmetic: number;
  };
  excursions: {
    hasExcursions: boolean;
    upperExcursionCount: number;
    upperExcursionHours: number;
    lowerExcursionCount: number;
    lowerExcursionHours: number;
    totalExcursionHours: number;
    criticalUpperCount: number;
    criticalUpperHours: number;
    freezeCount: number;
    freezeHours: number;
    tropicalAmbientHours: number;
  };
  auditVerdict: {
    complianceStatus: string;
    riskLevel: string;
    isCompliant: boolean;
    requiresQuarantine: boolean;
    violations: string[];
    mandatedActions: string[];
  };
  statutoryFramework: {
    gdpStandard: string;
    internationalStandards: string[];
    mktFormula: string;
  };
}

export interface AdrAuditParams {
  severity: "SERIOUS_FATAL_OR_LIFE_THREATENING" | "SERIOUS_OTHER" | "NON_SERIOUS";
  dateReceived: string | Date;
  dateAssessed?: string | Date;
  causalityFactors?: {
    plausibleTimeSequence?: boolean;
    dechallenge?: "POSITIVE" | "NEGATIVE" | "NOT_APPLICABLE" | "UNKNOWN";
    rechallenge?: "POSITIVE" | "NEGATIVE" | "NOT_APPLICABLE" | "UNKNOWN";
    alternativeCause?: boolean;
    informationComplete?: boolean;
  };
  therapeuticProductName?: string;
}

export interface AdrAuditResult {
  therapeuticProductName: string;
  severity: string;
  statutoryMaxCalendarDays: number;
  reportingCategory: string;
  timelineStatus: {
    dateReceived: string;
    statutoryDeadlineDate: string;
    daysElapsed: number;
    daysRemaining: number;
    isOverdue: boolean;
  };
  whoUmcCausality: {
    causalityLevel: string;
    rationale: string;
  };
  hsaVcbActions: string[];
  statutoryBasis: string;
}

export interface ReimbursementPricingParams {
  exFactoryPriceSgd: number;
  drugTier?: "genericStandard" | "brandedStandard" | "specialtyHighCostBiologic";
  subsidyScheme?: "SDL" | "MAF" | "NON_SUBSIDISED";
  isPioneerOrEnhancedMeansTested?: boolean;
  customDistributorMargin?: number;
  annualPatientVolume?: number;
  hospitalCluster?: "SINGHEALTH" | "NHG" | "NUHS";
}

export interface ReimbursementPricingResult {
  hospitalCluster: string;
  subsidyScheme: string;
  subsidySchemeName: string;
  isEnhancedSubsidy: boolean;
  subsidyPercentage: number;
  drugTier: string;
  unitPricingWaterfallSgd: {
    exFactoryPrice: number;
    distributorMarginRate: number;
    distributorMarginAmount: number;
    wholesalePriceToHospital: number;
    hospitalHandlingMarginRate: number;
    hospitalHandlingAmount: number;
    listPriceBeforeSubsidy: number;
    mohGovernmentSubsidy: number;
    patientPreGstShare: number;
    patientGst9Percent: number;
    patientFinalOutOfPocketCoPay: number;
  };
  annualVolumeImpactSgd: {
    volumeUnits: number;
    annualTotalMohSubsidy: number;
    annualTotalPatientCoPay: number;
    annualGrossHospitalSpend: number;
  };
  statutoryBasis: string;
}

export interface ClinicalTrialHbraParams {
  isInvestigationalMedicinalProduct: boolean;
  hasLocalSponsor: boolean;
  hasIrbApproval: boolean;
  hasDocumentedInformedConsent: boolean;
  isHealthDataPseudonymised: boolean;
  crossBorderTransferContemplated: boolean;
  hasAdequateCrossBorderSafeguards?: boolean;
  plannedSubjectCount?: number;
}

export interface ClinicalTrialHbraResult {
  hsaRegulatoryPathway: {
    pathway: "CTA" | "CTN";
    slaWorkingDays: number;
    rationale: string;
  };
  enrolledSubjectCount: number;
  complianceScorePercent: number;
  isTrialAuthorizedToCommence: boolean;
  overallStatus: string;
  criticalGapsCount: number;
  criticalGaps: string[];
  majorGaps: string[];
  remediationRoadmap: string[];
  statutoryFramework: string[];
}

export declare const manifest: ExtensionManifest;
export declare function register(coreRegistry?: any): any;
export declare function evaluateHsaRegistration(input: HsaRegistrationParams): HsaRegistrationResult;
export declare function auditCleanroom(input: CleanroomAuditParams): CleanroomAuditResult;
export declare function auditGmpGdpChecklist(input: GmpGdpChecklistParams): GmpGdpChecklistResult;
export declare function evaluateColdChainMkt(params: ColdChainMktParams): ColdChainMktResult;
export declare function calculateHaynesMkt(temperaturesCelsius: number[], deltaHOverR?: number): {
  mktCelsius: number;
  mktKelvin: number;
  readingsCount: number;
  deltaHOverR: number;
};
export declare function evaluateWhoUmcCausality(factors: any): { causalityLevel: string; rationale: string };
export declare function auditAdrReporting(input: AdrAuditParams): AdrAuditResult;
export declare function modelReimbursementPricing(input: ReimbursementPricingParams): ReimbursementPricingResult;
export declare function auditClinicalTrialHbra(input: ClinicalTrialHbraParams): ClinicalTrialHbraResult;
export declare const engines: Record<string, (...args: any[]) => any>;
export declare const rules: Record<string, any>;

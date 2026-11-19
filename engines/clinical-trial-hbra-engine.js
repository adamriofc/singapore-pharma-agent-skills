/**
 * Clinical Trial HBRA & Health PDPA Privacy Auditor Engine (`engines/clinical-trial-hbra-engine.js`)
 *
 * Implements deterministic auditing of clinical research protocols, biomedical studies,
 * and clinical trial data governance in Singapore under:
 *   - Human Biomedical Research Act 2015 (HBRA)
 *   - HSA Clinical Trial Authorisation (CTA) / Clinical Trial Notification (CTN) Framework
 *   - Personal Data Protection Act 2012 (PDPA) & Advisory Guidelines for the Healthcare Sector
 *   - Cross-Border Health Data Transfer Restrictions (Section 26 PDPA)
 *
 * DOCTRINE: Pure numerical computation and statutory ruleset lookup.
 * ZERO prescriptive text / ZERO subjective advice.
 * Pure Node.js, zero external runtime dependencies.
 */

'use strict';

/**
 * Audit Clinical Trial regulatory path (CTA vs CTN) and HBRA/PDPA compliance.
 *
 * @param {Object} input
 * @param {boolean} input.isInvestigationalMedicinalProduct Whether trial involves an unapproved drug/biologic or off-label unapproved indication
 * @param {boolean} input.hasLocalSponsor Whether there is an authorized local Singapore trial sponsor / CRO
 * @param {boolean} input.hasIrbApproval Institutional Review Board (DSRB / CIRB) formal ethics approval
 * @param {boolean} input.hasDocumentedInformedConsent Complete informed consent process documented per HBRA Section 12-14
 * @param {boolean} input.isHealthDataPseudonymised All clinical datasets stripped of direct identifiers (NRIC, FIN, patient name, exact MRN)
 * @param {boolean} input.crossBorderTransferContemplated Whether patient trial data will be transferred to overseas sponsors / labs
 * @param {boolean} [input.hasAdequateCrossBorderSafeguards=false] Adequate cross-border contractual safeguards (SCC / BCR) per Section 26 PDPA
 * @param {number} [input.plannedSubjectCount=0] Number of enrolled human subjects
 * @returns {Object} Comprehensive Clinical Trial & Health PDPA compliance receipt
 */
function auditClinicalTrialHbra(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT: Input must be a valid parameters object');
  }

  const isImp = Boolean(input.isInvestigationalMedicinalProduct);
  const hasLocalSponsor = Boolean(input.hasLocalSponsor);
  const hasIrb = Boolean(input.hasIrbApproval);
  const hasConsent = Boolean(input.hasDocumentedInformedConsent);
  const isPseudonymised = Boolean(input.isHealthDataPseudonymised);
  const isCrossBorder = Boolean(input.crossBorderTransferContemplated);
  const hasCrossBorderSafeguards = Boolean(input.hasAdequateCrossBorderSafeguards);
  let subjectCount = 0;
  if (input.plannedSubjectCount !== undefined) {
    const sc = Number(input.plannedSubjectCount);
    if (isNaN(sc) || !Number.isFinite(sc) || sc < 0) {
      throw new Error('INVALID_INPUT: plannedSubjectCount must be a non-negative number');
    }
    subjectCount = sc;
  }

  // Determine HSA regulatory pathway
  let hsaPathway = 'CTA'; // Clinical Trial Authorisation
  let hsaSlaWorkingDays = 30;
  let pathwayRationale = '';

  if (isImp) {
    hsaPathway = 'CTA';
    hsaSlaWorkingDays = 30;
    pathwayRationale = 'Investigational Medicinal Product (IMP) or unapproved indication requires full HSA Clinical Trial Authorisation (CTA).';
  } else {
    hsaPathway = 'CTN';
    hsaSlaWorkingDays = 15;
    pathwayRationale = 'Locally registered therapeutic products used within approved indications qualify for expedited Clinical Trial Notification (CTN).';
  }

  // Audit Check Items
  const checklist = [
    {
      id: 'HBRA-01',
      title: 'Local Sponsor / CRO Authorization',
      statutoryRef: 'Health Products (Clinical Trials) Regulations 2016',
      compliant: hasLocalSponsor,
      criticality: 'CRITICAL',
      gap: hasLocalSponsor ? null : 'No authorized local Singapore legal entity or sponsor registered with HSA.'
    },
    {
      id: 'HBRA-02',
      title: 'Institutional Review Board (IRB) Ethics Clearance',
      statutoryRef: 'Human Biomedical Research Act 2015 Section 22',
      compliant: hasIrb,
      criticality: 'CRITICAL',
      gap: hasIrb ? null : 'Formal approval from NHG DSRB or SingHealth CIRB is missing or pending.'
    },
    {
      id: 'HBRA-03',
      title: 'Valid Documented Informed Consent Process',
      statutoryRef: 'Human Biomedical Research Act 2015 Sections 12-14',
      compliant: hasConsent,
      criticality: 'CRITICAL',
      gap: hasConsent ? null : 'Informed consent forms do not meet HBRA statutory witness, translation, or withdrawal mandates.'
    },
    {
      id: 'PDPA-01',
      title: 'Patient Health Data De-identification & Pseudonymisation',
      statutoryRef: 'PDPA 2012 & Healthcare Sector Advisory Guidelines',
      compliant: isPseudonymised,
      criticality: 'CRITICAL',
      gap: isPseudonymised ? null : 'Direct patient identifiers (NRIC/FIN/MRN) retained in trial datasets, violating PDPA protection obligations.'
    },
    {
      id: 'PDPA-02',
      title: 'Cross-Border Health Data Transfer Safeguards',
      statutoryRef: 'Personal Data Protection Act 2012 Section 26',
      compliant: !isCrossBorder || hasCrossBorderSafeguards,
      criticality: isCrossBorder ? 'CRITICAL' : 'MINOR',
      gap: (isCrossBorder && !hasCrossBorderSafeguards)
        ? 'Cross-border data transfer to foreign sponsor without Standard Contractual Clauses (SCC) or comparable standard of protection.'
        : null
    }
  ];

  const criticalGaps = [];
  const majorGaps = [];
  let compliantCount = 0;

  checklist.forEach(item => {
    if (item.compliant) {
      compliantCount++;
    } else {
      if (item.criticality === 'CRITICAL') {
        criticalGaps.push(`${item.id}: ${item.gap}`);
      } else {
        majorGaps.push(`${item.id}: ${item.gap}`);
      }
    }
  });

  const complianceScorePercent = Math.round((compliantCount / checklist.length) * 100);
  const isTrialAuthorizedToCommence = criticalGaps.length === 0;

  let overallStatus = 'READY_TO_SUBMIT_OR_COMMENCE';
  if (criticalGaps.length > 0) {
    overallStatus = 'STATUTORY_DEFICIENCIES_COMMENCEMENT_BLOCKED';
  } else if (majorGaps.length > 0) {
    overallStatus = 'CONDITIONALLY_COMPLIANT_SUBJECT_TO_SAFEGUARDS';
  }

  const remediationRoadmap = [];
  if (!hasLocalSponsor) {
    remediationRoadmap.push('Appoint a registered Singapore legal entity or contract research organization (CRO) as local trial sponsor.');
  }
  if (!hasIrb) {
    remediationRoadmap.push('Submit comprehensive clinical protocol and investigator brochure (IB) to CIRB/DSRB.');
  }
  if (!hasConsent) {
    remediationRoadmap.push('Harmonize Patient Information Sheet & Informed Consent Form (PIS/ICF) with HBRA Section 12 requirements.');
  }
  if (!isPseudonymised) {
    remediationRoadmap.push('Implement automated pseudonymisation pipeline replacing NRIC/FIN with cryptographically salted Subject IDs.');
  }
  if (isCrossBorder && !hasCrossBorderSafeguards) {
    remediationRoadmap.push('Execute Singapore Standard Contractual Clauses (SCC) with overseas sponsor/analytical laboratory per Section 26 PDPA.');
  }

  return {
    hsaRegulatoryPathway: {
      pathway: hsaPathway,
      slaWorkingDays: hsaSlaWorkingDays,
      rationale: pathwayRationale
    },
    enrolledSubjectCount: subjectCount,
    complianceScorePercent,
    isTrialAuthorizedToCommence,
    overallStatus,
    criticalGapsCount: criticalGaps.length,
    criticalGaps,
    majorGaps,
    remediationRoadmap,
    statutoryFramework: [
      'Human Biomedical Research Act 2015 (HBRA)',
      'Health Products (Clinical Trials) Regulations 2016',
      'Personal Data Protection Act 2012 (PDPA) & Healthcare Sector Advisory Guidelines'
    ]
  };
}

module.exports = {
  auditClinicalTrialHbra
};

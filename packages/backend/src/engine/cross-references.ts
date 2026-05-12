import type { OrphanReference, PolicyChain, TechnicalProfile, UserJourney } from '@policy-analyzer/shared';
import { normalizeId } from './xml.js';

export function validateCrossReferences(chain: PolicyChain): OrphanReference[] {
  const technicalProfiles = new Map(
    chain.resolvedTechnicalProfiles.map((profile) => [normalizeId(profile.id), profile] as const),
  );
  const claimsSchema = new Set(chain.resolvedClaimsSchema.map((claim) => normalizeId(claim.id)));
  const transformations = new Set(
    chain.resolvedClaimsTransformations.map((transformation) => normalizeId(transformation.id)),
  );
  const journeys = new Set(chain.resolvedJourneys.map((journey) => normalizeId(journey.id)));
  const orphans: OrphanReference[] = [];

  if (chain.defaultUserJourneyId !== undefined && !journeys.has(normalizeId(chain.defaultUserJourneyId))) {
    orphans.push({
      referencedPolicyId: chain.defaultUserJourneyId,
      referencedFromFileId: chain.rpFileId,
      referenceType: 'UserJourney',
      message: `Default user journey "${chain.defaultUserJourneyId}" is referenced but not defined.`,
    });
  }

  for (const journey of chain.resolvedJourneys) {
    populateStepClaims(journey, technicalProfiles, claimsSchema, orphans, chain.rpFileId);
  }

  for (const profile of chain.resolvedTechnicalProfiles) {
    validateTechnicalProfile(profile, technicalProfiles, claimsSchema, transformations, orphans);
  }

  for (const transformation of chain.resolvedClaimsTransformations) {
    for (const claim of [...transformation.inputClaims, ...transformation.outputClaims]) {
      if (!claimsSchema.has(normalizeId(claim.claimTypeReferenceId))) {
        orphans.push({
          referencedPolicyId: claim.claimTypeReferenceId,
          referencedFromFileId: transformation.definedInFileId,
          referenceType: 'ClaimType',
          message: `Claims transformation "${transformation.id}" references claim type "${claim.claimTypeReferenceId}" which is not defined.`,
        });
      }
    }
  }

  return dedupeOrphans(orphans);
}

function populateStepClaims(
  journey: UserJourney,
  technicalProfiles: Map<string, TechnicalProfile>,
  claimsSchema: Set<string>,
  orphans: OrphanReference[],
  fallbackFileId: string,
): void {
  for (let index = 0; index < journey.steps.length; index++) {
    const step = journey.steps[index]!;
    const referencedTpIds = collectReferencedTechnicalProfileIds(journey, index);
    const inputClaims = new Set<string>();
    const outputClaims = new Set<string>();

    for (const tpId of referencedTpIds) {
      const profile = technicalProfiles.get(normalizeId(tpId));
      if (profile === undefined) {
        orphans.push({
          referencedPolicyId: tpId,
          referencedFromFileId: fallbackFileId,
          referenceType: 'TechnicalProfile',
          message: `Technical profile "${tpId}" is referenced but not defined.`,
        });
        continue;
      }

      for (const claim of profile.inputClaims) {
        inputClaims.add(claim.claimTypeReferenceId);
        if (!claimsSchema.has(normalizeId(claim.claimTypeReferenceId))) {
          orphans.push({
            referencedPolicyId: claim.claimTypeReferenceId,
            referencedFromFileId: profile.definedInFileId,
            referenceType: 'ClaimType',
            message: `Technical profile "${profile.id}" references claim type "${claim.claimTypeReferenceId}" which is not defined.`,
          });
        }
      }

      for (const claim of profile.outputClaims) {
        outputClaims.add(claim.claimTypeReferenceId);
        if (!claimsSchema.has(normalizeId(claim.claimTypeReferenceId))) {
          orphans.push({
            referencedPolicyId: claim.claimTypeReferenceId,
            referencedFromFileId: profile.definedInFileId,
            referenceType: 'ClaimType',
            message: `Technical profile "${profile.id}" references claim type "${claim.claimTypeReferenceId}" which is not defined.`,
          });
        }
      }
    }

    step.inputClaimNames = [...inputClaims];
    step.outputClaimNames = [...outputClaims];
    if (step.technicalProfileReferenceId === undefined && referencedTpIds.length === 1) {
      const technicalProfileReferenceId = referencedTpIds[0];
      if (technicalProfileReferenceId !== undefined) {
        step.technicalProfileReferenceId = technicalProfileReferenceId;
      }
    }
  }
}

function collectReferencedTechnicalProfileIds(journey: UserJourney, stepIndex: number): string[] {
  const step = journey.steps[stepIndex]!;
  const direct = step.claimsExchanges.map((exchange) => exchange.technicalProfileReferenceId);
  if (direct.length > 0) return direct;

  if (step.technicalProfileReferenceId !== undefined) {
    return [step.technicalProfileReferenceId];
  }

  if (step.targetClaimsExchangeIds === undefined || step.targetClaimsExchangeIds.length === 0) {
    return [];
  }

  const matches = new Set<string>();
  for (let nextIndex = stepIndex + 1; nextIndex < journey.steps.length; nextIndex++) {
    for (const exchange of journey.steps[nextIndex]!.claimsExchanges) {
      if (step.targetClaimsExchangeIds.includes(exchange.id)) {
        matches.add(exchange.technicalProfileReferenceId);
      }
    }
  }

  return [...matches];
}

function validateTechnicalProfile(
  profile: TechnicalProfile,
  technicalProfiles: Map<string, TechnicalProfile>,
  claimsSchema: Set<string>,
  transformations: Set<string>,
  orphans: OrphanReference[],
): void {
  for (const claim of [...profile.inputClaims, ...profile.outputClaims]) {
    if (!claimsSchema.has(normalizeId(claim.claimTypeReferenceId))) {
      orphans.push({
        referencedPolicyId: claim.claimTypeReferenceId,
        referencedFromFileId: profile.definedInFileId,
        referenceType: 'ClaimType',
        message: `Technical profile "${profile.id}" references claim type "${claim.claimTypeReferenceId}" which is not defined.`,
      });
    }
  }

  for (const transformation of [
    ...profile.inputClaimsTransformations,
    ...profile.outputClaimsTransformations,
  ]) {
    if (!transformations.has(normalizeId(transformation.referenceId))) {
      orphans.push({
        referencedPolicyId: transformation.referenceId,
        referencedFromFileId: profile.definedInFileId,
        referenceType: 'ClaimsTransformation',
        message: `Technical profile "${profile.id}" references claims transformation "${transformation.referenceId}" which is not defined.`,
      });
    }
  }

  for (const validationProfile of profile.validationTechnicalProfiles) {
    if (!technicalProfiles.has(normalizeId(validationProfile.referenceId))) {
      orphans.push({
        referencedPolicyId: validationProfile.referenceId,
        referencedFromFileId: profile.definedInFileId,
        referenceType: 'TechnicalProfile',
        message: `Technical profile "${profile.id}" references validation technical profile "${validationProfile.referenceId}" which is not defined.`,
      });
    }
  }

  if (
    profile.includeClaimsFromTechnicalProfileId !== undefined &&
    !technicalProfiles.has(normalizeId(profile.includeClaimsFromTechnicalProfileId))
  ) {
    orphans.push({
      referencedPolicyId: profile.includeClaimsFromTechnicalProfileId,
      referencedFromFileId: profile.definedInFileId,
      referenceType: 'TechnicalProfile',
      message: `Technical profile "${profile.id}" includes technical profile "${profile.includeClaimsFromTechnicalProfileId}" which is not defined.`,
    });
  }
}

function dedupeOrphans(orphans: OrphanReference[]): OrphanReference[] {
  const seen = new Set<string>();
  return orphans.filter((orphan) => {
    const key = [
      orphan.referencedPolicyId,
      orphan.referencedFromFileId,
      orphan.referenceType,
      orphan.message,
    ].join('\x00');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

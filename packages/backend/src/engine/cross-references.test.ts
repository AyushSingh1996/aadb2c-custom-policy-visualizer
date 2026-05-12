import { describe, expect, it } from 'vitest';
import { validateCrossReferences } from './cross-references.js';
import type { PolicyChain, TechnicalProfile, UserJourney } from '@policy-analyzer/shared';

function technicalProfile(overrides: Partial<TechnicalProfile>): TechnicalProfile {
  return {
    id: 'TP',
    protocolCategory: 'OTHER',
    metadata: {},
    cryptographicKeys: [],
    inputClaims: [],
    outputClaims: [],
    persistedClaims: [],
    inputClaimsTransformations: [],
    outputClaimsTransformations: [],
    validationTechnicalProfiles: [],
    definedInFileId: 'file-1',
    isOverride: false,
    overriddenFromFileIds: [],
    resolvedFromMerge: false,
    ...overrides,
  };
}

function journey(stepOverrides: Partial<UserJourney['steps'][number]> = {}): UserJourney {
  return {
    id: 'SignIn',
    definedInFileId: 'file-1',
    isOverride: false,
    steps: [
      {
        order: 1,
        type: 'ClaimsExchange',
        claimsExchanges: [{ id: 'ExchangeA', technicalProfileReferenceId: 'TP-A' }],
        preconditions: [],
        inputClaimNames: [],
        outputClaimNames: [],
        ...stepOverrides,
      },
    ],
  };
}

function chain(overrides: Partial<PolicyChain> = {}): PolicyChain {
  return {
    id: 'chain-1',
    name: 'Sign In Flow',
    fileIds: ['file-1'],
    rpFileId: 'file-1',
    defaultUserJourneyId: 'SignIn',
    resolvedJourneys: [journey()],
    resolvedTechnicalProfiles: [],
    resolvedClaimsSchema: [],
    resolvedClaimsTransformations: [],
    resolvedClaimsProviders: [],
    resolvedLocalizations: [],
    externalDependencies: [],
    orphanReferences: [],
    stats: {
      fileCount: 1,
      userJourneyCount: 1,
      technicalProfileCount: 0,
      orchestrationStepCount: 1,
      externalDependencyCount: 0,
    },
    ...overrides,
  };
}

describe('validateCrossReferences', () => {
  it('reports a missing technical profile reference from a step', () => {
    const orphans = validateCrossReferences(chain());
    expect(orphans[0]).toMatchObject({
      referenceType: 'TechnicalProfile',
      referencedPolicyId: 'TP-A',
    });
  });

  it('reports missing claim type references from technical profiles', () => {
    const orphans = validateCrossReferences(
      chain({
        resolvedTechnicalProfiles: [
          technicalProfile({
            id: 'TP-A',
            inputClaims: [{ claimTypeReferenceId: 'email' }],
          }),
        ],
      }),
    );

    expect(orphans.some((orphan) => orphan.referenceType === 'ClaimType')).toBe(true);
  });

  it('reports missing claims transformations', () => {
    const orphans = validateCrossReferences(
      chain({
        resolvedTechnicalProfiles: [
          technicalProfile({
            id: 'TP-A',
            inputClaimsTransformations: [{ referenceId: 'MissingTransform' }],
          }),
        ],
      }),
    );

    expect(orphans).toContainEqual(
      expect.objectContaining({
        referenceType: 'ClaimsTransformation',
        referencedPolicyId: 'MissingTransform',
      }),
    );
  });

  it('resolves target claims exchange ids transitively and populates step claim names', () => {
    const chained = chain({
      resolvedJourneys: [
        {
          id: 'SignIn',
          definedInFileId: 'file-1',
          isOverride: false,
          steps: [
            {
              order: 1,
              type: 'ClaimsProviderSelection',
              targetClaimsExchangeIds: ['ExchangeA'],
              claimsExchanges: [],
              preconditions: [],
              inputClaimNames: [],
              outputClaimNames: [],
            },
            {
              order: 2,
              type: 'ClaimsExchange',
              claimsExchanges: [{ id: 'ExchangeA', technicalProfileReferenceId: 'TP-A' }],
              preconditions: [],
              inputClaimNames: [],
              outputClaimNames: [],
            },
          ],
        },
      ],
      resolvedTechnicalProfiles: [
        technicalProfile({
          id: 'TP-A',
          inputClaims: [{ claimTypeReferenceId: 'email' }],
          outputClaims: [{ claimTypeReferenceId: 'objectId' }],
        }),
      ],
      resolvedClaimsSchema: [
        { id: 'email', definedInFileId: 'file-1', isOverride: false },
        { id: 'objectId', definedInFileId: 'file-1', isOverride: false },
      ],
    });

    const orphans = validateCrossReferences(chained);
    expect(orphans).toEqual([]);
    expect(chained.resolvedJourneys[0]?.steps[0]).toMatchObject({
      technicalProfileReferenceId: 'TP-A',
      inputClaimNames: ['email'],
      outputClaimNames: ['objectId'],
    });
  });

  it('matches references when declared IDs have surrounding whitespace', () => {
    const orphans = validateCrossReferences(
      chain({
        resolvedJourneys: [
          journey({
            claimsExchanges: [{ id: 'Exchange', technicalProfileReferenceId: 'TP-A' }],
          }),
        ],
        resolvedTechnicalProfiles: [
          technicalProfile({
            id: ' TP-A ',
            inputClaims: [{ claimTypeReferenceId: ' email ' }],
          }),
        ],
        resolvedClaimsSchema: [{ id: '  email  ', definedInFileId: 'file-1', isOverride: false }],
      }),
    );

    expect(orphans.filter((o) => o.referenceType === 'TechnicalProfile')).toEqual([]);
    expect(orphans.filter((o) => o.referenceType === 'ClaimType')).toEqual([]);
  });

  it('matches defaultUserJourneyId with extra whitespace against a normalized journey id', () => {
    const orphans = validateCrossReferences(
      chain({
        defaultUserJourneyId: ' SignIn ',
        resolvedJourneys: [journey()],
      }),
    );

    expect(orphans.filter((o) => o.referenceType === 'UserJourney')).toEqual([]);
  });
});

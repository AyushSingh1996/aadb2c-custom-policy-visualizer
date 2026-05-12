import type { OrchestrationStep, PolicyChain, PolicyFile } from '@policy-analyzer/shared';
import { describe, expect, test } from 'vitest';
import {
  buildPolicyMapSections,
  findPrimaryTechnicalProfile,
  formatPreconditions,
  getDisplayParseError,
  getChainFiles,
  getChainLastModified,
  getMissingTechnicalProfileIdsForStep,
  getChainRelyingPartyCount,
  getClaimDisplaysFromNames,
  getExternalDependenciesForStep,
  getJourneyTechnicalProfileCount,
  getStepDisplayName,
  getTechnicalProfileIds,
} from '../lib/analysis-view.js';

const files: PolicyFile[] = [
  {
    id: 'base',
    fileName: 'TrustFrameworkBase.xml',
    sizeBytes: 100,
    lastModified: '2026-04-28T09:00:00.000Z',
    category: 'Base',
    rawXml: '<Base />',
    parsedAt: '2026-04-28T09:00:00.000Z',
  },
  {
    id: 'rp',
    fileName: 'SignUpOrSignIn.xml',
    sizeBytes: 80,
    lastModified: '2026-04-28T10:00:00.000Z',
    category: 'RelyingParty',
    rawXml: '<RP />',
    parsedAt: '2026-04-28T10:00:00.000Z',
  },
];

const step: OrchestrationStep = {
  order: 1,
  type: 'ClaimsExchange',
  technicalProfileReferenceId: 'REST-GetLoyaltyId',
  claimsExchanges: [
    {
      id: 'LoyaltyExchange',
      technicalProfileReferenceId: 'REST-GetLoyaltyId',
    },
  ],
  preconditions: [
    {
      type: 'ClaimsExist',
      executeActionsIf: 'true',
      values: ['objectId'],
      action: 'SkipThisOrchestrationStep',
    },
  ],
  inputClaimNames: ['email'],
  outputClaimNames: ['extension_loyaltyId'],
};

const chain: PolicyChain = {
  id: 'chain-1',
  name: 'Sign Up Or Sign In Flow',
  fileIds: ['base', 'rp'],
  rpFileId: 'rp',
  resolvedJourneys: [
    {
      id: 'SignUpOrSignIn',
      definedInFileId: 'rp',
      isOverride: false,
      steps: [step],
    },
  ],
  resolvedTechnicalProfiles: [
    {
      id: 'REST-GetLoyaltyId',
      displayName: 'Get Loyalty ID',
      protocolCategory: 'REST_API',
      metadata: { ServiceUrl: 'https://api.contoso.com/loyalty' },
      cryptographicKeys: [],
      inputClaims: [],
      outputClaims: [{ claimTypeReferenceId: 'extension_loyaltyId' }],
      persistedClaims: [],
      inputClaimsTransformations: [],
      outputClaimsTransformations: [],
      validationTechnicalProfiles: [],
      definedInFileId: 'base',
      isOverride: false,
      overriddenFromFileIds: [],
      resolvedFromMerge: false,
      protocol: { name: 'Proprietary' },
    },
  ],
  resolvedClaimsSchema: [
    {
      id: 'email',
      dataType: 'string',
      displayName: 'Email',
      definedInFileId: 'base',
      isOverride: false,
    },
    {
      id: 'extension_loyaltyId',
      dataType: 'string',
      displayName: 'Loyalty ID',
      definedInFileId: 'base',
      isOverride: false,
    },
  ],
  resolvedClaimsTransformations: [],
  resolvedClaimsProviders: [],
  resolvedLocalizations: [],
  externalDependencies: [
    {
      type: 'RestApi',
      url: 'https://api.contoso.com/loyalty',
      technicalProfileId: 'REST-GetLoyaltyId',
      context: 'ServiceUrl',
      authentication: 'Bearer',
    },
  ],
  orphanReferences: [],
  stats: {
    fileCount: 2,
    userJourneyCount: 1,
    technicalProfileCount: 1,
    orchestrationStepCount: 1,
    externalDependencyCount: 1,
  },
};

describe('analysis view helpers', () => {
  test('resolves chain file order and metadata', () => {
    const chainFiles = getChainFiles(chain, files);

    expect(chainFiles.map((file) => file.id)).toEqual(['base', 'rp']);
    expect(getChainRelyingPartyCount(chainFiles)).toBe(1);
    expect(getChainLastModified(chainFiles)).toBe('2026-04-28T10:00:00.000Z');
  });

  test('groups chains into base and extension graph sections', () => {
    const extensionFile: PolicyFile = {
      id: 'extension',
      fileName: 'TrustFrameworkExtensions.xml',
      sizeBytes: 120,
      lastModified: '2026-04-28T09:30:00.000Z',
      category: 'Extension',
      rawXml: '<Extension />',
      parsedAt: '2026-04-28T09:30:00.000Z',
    };
    const secondRpFile: PolicyFile = {
      id: 'rp-2',
      fileName: 'PasswordReset.xml',
      sizeBytes: 90,
      lastModified: '2026-04-28T10:30:00.000Z',
      category: 'RelyingParty',
      rawXml: '<RP />',
      parsedAt: '2026-04-28T10:30:00.000Z',
    };
    const sections = buildPolicyMapSections(
      [
        chain,
        {
          ...chain,
          fileIds: ['base', 'extension', 'rp'],
        },
        {
          ...chain,
          id: 'chain-2',
          name: 'Password Reset Flow',
          fileIds: ['base', 'extension', 'rp-2'],
          rpFileId: 'rp-2',
        },
      ],
      [files[0]!, extensionFile, files[1]!, secondRpFile],
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]?.baseFile.id).toBe('base');
    expect(sections[0]?.extensions).toHaveLength(1);
    expect(sections[0]?.extensions[0]?.extensionFile.id).toBe('extension');
    expect(sections[0]?.extensions[0]?.relyingParties.map((entry) => entry.chainId)).toEqual([
      'chain-1',
      'chain-2',
    ]);
  });

  test('adds placeholder sections for unresolved base references', () => {
    const sections = buildPolicyMapSections(
      [],
      [],
      [
        {
          referencedPolicyId: 'B2C_1A_MissingBase',
          referencedFromFileId: 'rp',
          referenceType: 'BasePolicy',
          message:
            '"SignIn.xml" references base policy "B2C_1A_MissingBase" which was not found in the upload.',
        },
      ],
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]?.isPlaceholder).toBe(true);
    expect(sections[0]?.baseFile.fileName).toBe('Missing: B2C_1A_MissingBase');
  });

  test('derives technical profile and display information for a step', () => {
    expect(getTechnicalProfileIds(step)).toEqual(['REST-GetLoyaltyId']);
    expect(findPrimaryTechnicalProfile(step, chain)?.displayName).toBe('Get Loyalty ID');
    expect(getStepDisplayName(step, findPrimaryTechnicalProfile(step, chain))).toBe(
      'Get Loyalty ID',
    );
    expect(getJourneyTechnicalProfileCount(chain.resolvedJourneys[0]!)).toBe(1);
  });

  test('formats preconditions and dependencies for details panels', () => {
    expect(formatPreconditions(step)).toContain('ClaimsExist executes when condition is true');
    expect(getExternalDependenciesForStep(chain, step)).toHaveLength(1);
  });

  test('normalizes parse errors and step-level missing technical profile warnings', () => {
    const normalizedRootError = getDisplayParseError({
      ...files[0]!,
      category: 'Error',
      parseError: 'Not a B2C custom policy file. Root element must be <TrustFrameworkPolicy>.',
    });
    const missingProfileIds = getMissingTechnicalProfileIdsForStep(step, {
      ...chain,
      orphanReferences: [
        {
          referencedPolicyId: 'REST-GetLoyaltyId',
          referencedFromFileId: 'rp',
          referenceType: 'TechnicalProfile',
          message: 'Technical profile "REST-GetLoyaltyId" is referenced but not defined.',
        },
      ],
    });

    expect(normalizedRootError).toBe('This file is not an Azure AD B2C custom policy.');
    expect(missingProfileIds).toEqual(['REST-GetLoyaltyId']);
  });

  test('maps claim names to schema entries for display', () => {
    const claims = getClaimDisplaysFromNames(['email', 'missingClaim'], chain);

    expect(claims).toEqual([
      { id: 'email', dataType: 'string', displayName: 'Email' },
      { id: 'missingClaim', dataType: undefined, displayName: undefined },
    ]);
  });
});

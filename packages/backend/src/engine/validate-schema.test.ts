import { describe, expect, it } from 'vitest';
import type {
  PolicyChain,
  PolicyFile,
  SchemaWarning,
  TechnicalProfile,
} from '@policy-analyzer/shared';
import { validateSchema } from './validate-schema.js';

describe('validateSchema', () => {
  it('emits INVALID_PROTOCOL_NAME for unsupported protocol names', () => {
    const warnings = validateSchema(
      chain({
        resolvedTechnicalProfiles: [
          technicalProfile({
            id: 'TP-InvalidProtocol',
            protocol: { name: 'UnknownProtocol' },
          }),
        ],
      }),
      fileMap(),
    );

    expect(warnings).toContainEqual(
      expect.objectContaining<Partial<SchemaWarning>>({
        code: 'INVALID_PROTOCOL_NAME',
        entityId: 'TP-InvalidProtocol',
      }),
    );
  });

  it('emits INVALID_DATA_TYPE for unsupported claim data types', () => {
    const warnings = validateSchema(
      chain({
        resolvedClaimsSchema: [
          {
            id: 'customClaim',
            dataType: 'invalidtype',
            definedInFileId: 'file-1',
            isOverride: false,
          },
        ],
      }),
      fileMap(),
    );

    expect(warnings).toContainEqual(
      expect.objectContaining<Partial<SchemaWarning>>({
        code: 'INVALID_DATA_TYPE',
        entityId: 'customClaim',
      }),
    );
  });

  it('emits INVALID_TRANSFORMATION_METHOD for unsupported transformation methods', () => {
    const warnings = validateSchema(
      chain({
        resolvedClaimsTransformations: [
          {
            id: 'Transform-Bad',
            transformationMethod: 'UnknownTransform',
            inputClaims: [],
            inputParameters: [],
            outputClaims: [],
            definedInFileId: 'file-1',
            isOverride: false,
          },
        ],
      }),
      fileMap(),
    );

    expect(warnings).toContainEqual(
      expect.objectContaining<Partial<SchemaWarning>>({
        code: 'INVALID_TRANSFORMATION_METHOD',
        entityId: 'Transform-Bad',
      }),
    );
  });

  it('emits MISSING_REQUIRED_ATTRIBUTE for REST profiles without ServiceUrl', () => {
    const warnings = validateSchema(
      chain({
        resolvedTechnicalProfiles: [
          technicalProfile({
            id: 'REST-NoServiceUrl',
            protocolCategory: 'REST_API',
            protocol: { name: 'Proprietary', handler: 'Web.TPEngine.Providers.RestfulProvider' },
          }),
        ],
      }),
      fileMap(),
    );

    expect(warnings).toContainEqual(
      expect.objectContaining<Partial<SchemaWarning>>({
        code: 'MISSING_REQUIRED_ATTRIBUTE',
        entityId: 'REST-NoServiceUrl',
      }),
    );
  });

  it('returns no warnings for valid clean-like entities', () => {
    const warnings = validateSchema(
      chain({
        resolvedTechnicalProfiles: [
          technicalProfile({
            id: 'REST-Call',
            protocolCategory: 'REST_API',
            protocol: { name: 'Proprietary', handler: 'Web.TPEngine.Providers.RestfulProvider' },
            metadata: { ServiceUrl: 'https://api.contoso.com' },
          }),
        ],
        resolvedClaimsSchema: [
          {
            id: 'email',
            dataType: 'string',
            definedInFileId: 'file-1',
            isOverride: false,
          },
        ],
        resolvedClaimsTransformations: [
          {
            id: 'CreateDisplayName',
            transformationMethod: 'FormatStringMultipleClaims',
            inputClaims: [],
            inputParameters: [],
            outputClaims: [],
            definedInFileId: 'file-1',
            isOverride: false,
          },
        ],
      }),
      fileMap(),
    );

    expect(warnings).toEqual([]);
  });
});

function fileMap(): Map<string, PolicyFile> {
  return new Map([
    [
      'file-1',
      {
        id: 'file-1',
        fileName: 'TrustFrameworkExtensions.xml',
        sizeBytes: 100,
        lastModified: '2026-05-01T00:00:00.000Z',
        category: 'Extension',
        rawXml: '<xml />',
        parsedAt: '2026-05-01T00:00:00.000Z',
      },
    ],
  ]);
}

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

function chain(overrides: Partial<PolicyChain>): PolicyChain {
  return {
    id: 'chain-1',
    name: 'Test Flow',
    fileIds: ['file-1'],
    rpFileId: 'file-1',
    resolvedJourneys: [],
    resolvedTechnicalProfiles: [],
    resolvedClaimsSchema: [],
    resolvedClaimsTransformations: [],
    resolvedClaimsProviders: [],
    resolvedLocalizations: [],
    externalDependencies: [],
    orphanReferences: [],
    stats: {
      fileCount: 1,
      userJourneyCount: 0,
      technicalProfileCount: 0,
      orchestrationStepCount: 0,
      externalDependencyCount: 0,
    },
    ...overrides,
  };
}

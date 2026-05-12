import { describe, expect, it } from 'vitest';
import { detectExternalDependencies } from './external-deps.js';
import type { TechnicalProfile } from '@policy-analyzer/shared';
import type { AppSettings } from './settings-resolver.js';

function profile(overrides: Partial<TechnicalProfile>): TechnicalProfile {
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

describe('detectExternalDependencies', () => {
  it('detects REST API dependencies with auth mode', () => {
    const deps = detectExternalDependencies([
      profile({
        id: 'REST-Call',
        protocol: { name: 'Proprietary', handler: 'Web.TPEngine.Providers.RestfulProvider' },
        metadata: {
          ServiceUrl: 'https://api.example.com',
          AuthenticationType: 'Bearer',
        },
      }),
    ]);

    expect(deps).toEqual([
      {
        type: 'RestApi',
        url: 'https://api.example.com',
        technicalProfileId: 'REST-Call',
        context: 'ServiceUrl',
        authentication: 'Bearer',
      },
    ]);
  });

  it('detects html templates, OIDC metadata, and SAML partner metadata', () => {
    const deps = detectExternalDependencies([
      profile({
        id: 'SelfAsserted',
        metadata: { LoadUri: 'https://cdn.example.com/template.html' },
      }),
      profile({
        id: 'OIDC',
        protocol: { name: 'OpenIdConnect' },
        metadata: {
          METADATA: 'https://login.example.com/.well-known/openid-configuration',
          OpenIdConnectMetadata: 'https://login.example.com/oidc',
        },
      }),
      profile({
        id: 'SAML',
        protocol: { name: 'SAML2' },
        metadata: { PartnerEntity: 'https://idp.example.com/metadata' },
      }),
    ]);

    expect(deps).toEqual([
      {
        type: 'HtmlTemplate',
        url: 'https://cdn.example.com/template.html',
        technicalProfileId: 'SelfAsserted',
        context: 'LoadUri',
      },
      {
        type: 'OpenIdMetadata',
        url: 'https://login.example.com/.well-known/openid-configuration',
        technicalProfileId: 'OIDC',
        context: 'METADATA',
      },
      {
        type: 'OpenIdMetadata',
        url: 'https://login.example.com/oidc',
        technicalProfileId: 'OIDC',
        context: 'OpenIdConnectMetadata',
      },
      {
        type: 'PartnerMetadata',
        url: 'https://idp.example.com/metadata',
        technicalProfileId: 'SAML',
        context: 'PartnerEntity',
      },
    ]);
  });

  it('returns an empty array when no dependencies are present', () => {
    expect(detectExternalDependencies([profile({ id: 'Local' })])).toEqual([]);
  });

  it('resolves ServiceUrl placeholders from appsettings using the technical profile source file', () => {
    const settings: AppSettings = {
      Environments: [
        {
          Name: 'Development',
          Tenant: 'dev.contoso.onmicrosoft.com',
        },
      ],
    };

    const deps = detectExternalDependencies(
      [
        profile({
          id: 'REST-Call',
          definedInFileId: 'file-1',
          protocol: { name: 'Proprietary', handler: 'Web.TPEngine.Providers.RestfulProvider' },
          metadata: {
            ServiceUrl: 'https://{Settings:Tenant}/{Settings:PolicyFilename}',
          },
        }),
      ],
      settings,
      new Map([
        [
          'file-1',
          {
            id: 'file-1',
            fileName: 'B2C_1A_SignIn.xml',
            sizeBytes: 100,
            lastModified: '2026-05-01T00:00:00.000Z',
            category: 'Extension',
            rawXml: '<xml />',
            parsedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
      ]),
    );

    expect(deps[0]?.url).toBe('https://dev.contoso.onmicrosoft.com/SignIn');
  });
});

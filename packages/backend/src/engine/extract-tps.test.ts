import { describe, expect, it } from 'vitest';
import { extractTechnicalProfiles } from './extract-tps.js';
import type { ParsedFile } from './types.js';

function parsed(ast: Record<string, unknown>): ParsedFile {
  return {
    fileName: 'test.xml',
    policyId: 'B2C_1A_Test',
    tenantId: 'contoso.onmicrosoft.com',
    ast,
    rawXml: '',
  };
}

describe('extractTechnicalProfiles', () => {
  it('extracts a self-asserted TP with metadata and claim references intact', () => {
    const profiles = extractTechnicalProfiles(
      parsed({
        ClaimsProviders: {
          ClaimsProvider: {
            TechnicalProfiles: {
              TechnicalProfile: {
                '@_Id': 'SelfAsserted-LocalAccountSignin-Email',
                DisplayName: 'Local Account Signin',
                Protocol: {
                  '@_Name': 'Proprietary',
                  '@_Handler': 'Web.TPEngine.Providers.SelfAssertedAttributeProvider',
                },
                Metadata: {
                  Item: [
                    { '@_Key': 'setting.operatingMode', '#text': 'Email' },
                    { '@_Key': 'LoadUri', '#text': 'https://example.com/template' },
                  ],
                },
                InputClaims: {
                  InputClaim: { '@_ClaimTypeReferenceId': 'signInName' },
                },
                OutputClaims: {
                  OutputClaim: [
                    { '@_ClaimTypeReferenceId': 'email', '@_Required': 'true' },
                    { '@_ClaimTypeReferenceId': 'objectId' },
                  ],
                },
              },
            },
          },
        },
      }),
      'file-1',
    );

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      id: 'SelfAsserted-LocalAccountSignin-Email',
      displayName: 'Local Account Signin',
      definedInFileId: 'file-1',
      metadata: {
        'setting.operatingMode': 'Email',
        LoadUri: 'https://example.com/template',
      },
    });
    expect(profiles[0]?.inputClaims).toEqual([{ claimTypeReferenceId: 'signInName' }]);
    expect(profiles[0]?.outputClaims[0]).toEqual({
      claimTypeReferenceId: 'email',
      required: true,
    });
  });

  it('extracts REST TP protocol, keys, transformations, and validation TPs', () => {
    const profiles = extractTechnicalProfiles(
      parsed({
        ClaimsProviders: {
          ClaimsProvider: {
            TechnicalProfiles: {
              TechnicalProfile: {
                '@_Id': 'REST-Call',
                Protocol: {
                  '@_Name': 'Proprietary',
                  '@_Handler': 'Web.TPEngine.Providers.RestfulProvider',
                },
                Metadata: {
                  Item: { '@_Key': 'ServiceUrl', '#text': 'https://api.example.com/users' },
                },
                CryptographicKeys: {
                  Key: { '@_Id': 'client_secret', '@_StorageReferenceId': 'B2C_1A_RestSecret' },
                },
                InputClaimsTransformations: {
                  InputClaimsTransformation: { '@_ReferenceId': 'CreatePayload' },
                },
                ValidationTechnicalProfiles: {
                  ValidationTechnicalProfile: {
                    '@_ReferenceId': 'Validate-REST',
                    '@_ContinueOnError': 'false',
                    Preconditions: {
                      Precondition: {
                        '@_Type': 'ClaimsExist',
                        '@_ExecuteActionsIf': 'true',
                        Value: 'email',
                        Action: 'SkipThisValidationTechnicalProfile',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      'file-2',
    );

    expect(profiles[0]?.protocol).toEqual({
      name: 'Proprietary',
      handler: 'Web.TPEngine.Providers.RestfulProvider',
    });
    expect(profiles[0]?.cryptographicKeys).toEqual([
      { id: 'client_secret', storageReferenceId: 'B2C_1A_RestSecret' },
    ]);
    expect(profiles[0]?.inputClaimsTransformations).toEqual([{ referenceId: 'CreatePayload' }]);
    expect(profiles[0]?.validationTechnicalProfiles[0]).toEqual({
      referenceId: 'Validate-REST',
      continueOnError: false,
      preconditions: [
        {
          type: 'ClaimsExist',
          executeActionsIf: 'true',
          values: ['email'],
          action: 'SkipThisValidationTechnicalProfile',
        },
      ],
    });
  });

  it('normalizes Id attribute values with surrounding whitespace', () => {
    const profiles = extractTechnicalProfiles(
      parsed({
        ClaimsProviders: {
          ClaimsProvider: {
            TechnicalProfiles: {
              TechnicalProfile: {
                '@_Id': '  SelfAsserted-Login  ',
                Protocol: { '@_Name': 'Proprietary', '@_Handler': 'Web.TPEngine.Providers.SelfAssertedAttributeProvider' },
              },
            },
          },
        },
      }),
      'file-1',
    );

    expect(profiles[0]?.id).toBe('SelfAsserted-Login');
  });
});

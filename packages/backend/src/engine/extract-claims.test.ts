import { describe, expect, it } from 'vitest';
import {
  extractClaimsProviders,
  extractClaimsSchema,
  extractClaimsTransformations,
} from './extract-claims.js';
import type { ParsedFile } from './types.js';

function parsed(ast: Record<string, unknown>): ParsedFile {
  return {
    fileName: 'claims.xml',
    policyId: 'B2C_1A_Test',
    tenantId: 'contoso.onmicrosoft.com',
    ast,
    rawXml: '',
  };
}

describe('claims extractors', () => {
  it('extracts claim schema entries including restriction enumeration', () => {
    const claims = extractClaimsSchema(
      parsed({
        BuildingBlocks: {
          ClaimsSchema: {
            ClaimType: {
              '@_Id': 'country',
              DisplayName: 'Country',
              DataType: 'string',
              Restriction: {
                Enumeration: [
                  { '@_Value': 'US', '@_Text': 'United States' },
                  { '@_Value': 'CA', '@_Text': 'Canada' },
                ],
              },
            },
          },
        },
      }),
      'file-1',
    );

    expect(claims[0]).toMatchObject({
      id: 'country',
      displayName: 'Country',
      restrictionEnumeration: [
        { value: 'US', text: 'United States' },
        { value: 'CA', text: 'Canada' },
      ],
    });
  });

  it('extracts claims transformations and claims providers', () => {
    const file = parsed({
      BuildingBlocks: {
        ClaimsTransformations: {
          ClaimsTransformation: {
            '@_Id': 'CreateDisplayName',
            '@_TransformationMethod': 'FormatString',
            InputClaims: {
              InputClaim: {
                '@_ClaimTypeReferenceId': 'givenName',
                '@_TransformationClaimType': 'inputClaim1',
              },
            },
            InputParameters: {
              InputParameter: {
                '@_Id': 'stringFormat',
                '@_DataType': 'string',
                '#text': '{0} {1}',
              },
            },
            OutputClaims: {
              OutputClaim: {
                '@_ClaimTypeReferenceId': 'displayName',
                '@_TransformationClaimType': 'outputClaim',
              },
            },
          },
        },
      },
      ClaimsProviders: {
        ClaimsProvider: {
          DisplayName: 'Azure AD',
          Domain: 'aad',
          TechnicalProfiles: {
            TechnicalProfile: [{ '@_Id': 'AAD-Read' }, { '@_Id': 'AAD-Write' }],
          },
        },
      },
    });

    const transformations = extractClaimsTransformations(file, 'file-2');
    const providers = extractClaimsProviders(file, 'file-2');

    expect(transformations[0]).toMatchObject({
      id: 'CreateDisplayName',
      transformationMethod: 'FormatString',
      inputClaims: [
        {
          claimTypeReferenceId: 'givenName',
          transformationClaimType: 'inputClaim1',
        },
      ],
      outputClaims: [
        {
          claimTypeReferenceId: 'displayName',
          transformationClaimType: 'outputClaim',
        },
      ],
    });
    expect(providers[0]).toEqual({
      displayName: 'Azure AD',
      domain: 'aad',
      technicalProfileIds: ['AAD-Read', 'AAD-Write'],
      definedInFileId: 'file-2',
    });
  });

  it('normalizes Id attribute values with surrounding whitespace for claims schema and transformations', () => {
    const claims = extractClaimsSchema(
      parsed({
        BuildingBlocks: {
          ClaimsSchema: {
            ClaimType: { '@_Id': '  email  ', DataType: 'string' },
          },
        },
      }),
      'file-1',
    );

    const transformations = extractClaimsTransformations(
      parsed({
        BuildingBlocks: {
          ClaimsTransformations: {
            ClaimsTransformation: {
              '@_Id': '  CreateDisplayName  ',
              '@_TransformationMethod': 'FormatStringClaim',
            },
          },
        },
      }),
      'file-1',
    );

    expect(claims[0]?.id).toBe('email');
    expect(transformations[0]?.id).toBe('CreateDisplayName');
  });
});

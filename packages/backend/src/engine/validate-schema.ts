import type { PolicyChain, PolicyFile, SchemaWarning } from '@policy-analyzer/shared';
import { KNOWN_PROTOCOL_NAMES } from './schema-catalog.js';

const VALID_DATA_TYPES: ReadonlySet<string> = new Set([
  'string',
  'int',
  'long',
  'boolean',
  'stringCollection',
  'date',
  'dateTime',
  'duration',
  'alternativeSecurityIdCollection',
  'userIdentityCollection',
  'userIdentity',
  'phoneNumber',
]);

const KNOWN_TRANSFORMATION_METHODS: ReadonlySet<string> = new Set([
  'AddItemToAlternativeSecurityIdCollection',
  'AddItemToStringCollection',
  'AddParameterToStringCollection',
  'AndClaims',
  'AssertBooleanClaimIsEqualToValue',
  'AssertDateTimeIsGreaterThan',
  'AssertStringClaimsAreEqual',
  'ChangeCase',
  'CompareClaims',
  'CompareClaimToValue',
  'ConvertDateToDateTimeClaim',
  'ConvertNumberToStringClaim',
  'CopyClaim',
  'CreateAlternativeSecurityId',
  'CreateRandomString',
  'CreateStringClaim',
  'DateTimeComparison',
  'DoesClaimExist',
  'FormatString',
  'FormatStringClaim',
  'FormatStringMultipleClaims',
  'GetClaimFromJson',
  'GetClaimsFromJsonArray',
  'GetCurrentDateTime',
  'GetIdentityProvidersFromAlternativeSecurityIdCollectionTransformation',
  'GetMappedValueFromLocalizedCollection',
  'GetNumericClaimFromJson',
  'GetSingleItemFromStringCollection',
  'GetSingleValueFromJsonArray',
  'Hash',
  'LookupValue',
  'NotClaims',
  'NullClaim',
  'OrClaims',
  'ParseDomain',
  'RemoveAlternativeSecurityIdByIdentityProvider',
  'SetClaimsIfStringsAreEqual',
  'SetClaimsIfStringsMatch',
  'XmlStringToJsonString',
]);

export function validateSchema(
  chain: PolicyChain,
  _fileIdMap: Map<string, PolicyFile>,
): SchemaWarning[] {
  return [
    ...validateTechnicalProfiles(chain),
    ...validateClaimTypes(chain),
    ...validateTransformations(chain),
  ];
}

function validateTechnicalProfiles(chain: PolicyChain): SchemaWarning[] {
  const warnings: SchemaWarning[] = [];

  for (const profile of chain.resolvedTechnicalProfiles) {
    const protocolName = profile.protocol?.name;
    if (protocolName && !KNOWN_PROTOCOL_NAMES.has(protocolName)) {
      warnings.push({
        code: 'INVALID_PROTOCOL_NAME',
        message: `Technical profile "${profile.id}" uses unsupported protocol name "${protocolName}".`,
        entityId: profile.id,
        entityType: 'TechnicalProfile',
        fileId: profile.definedInFileId,
      });
    }

    if (profile.protocolCategory === 'REST_API' && profile.metadata['ServiceUrl'] === undefined) {
      warnings.push({
        code: 'MISSING_REQUIRED_ATTRIBUTE',
        message: `REST technical profile "${profile.id}" is missing required metadata item "ServiceUrl".`,
        entityId: profile.id,
        entityType: 'TechnicalProfile',
        fileId: profile.definedInFileId,
      });
    }
  }

  return warnings;
}

function validateClaimTypes(chain: PolicyChain): SchemaWarning[] {
  return chain.resolvedClaimsSchema.flatMap((claim) => {
    if (claim.dataType === undefined || VALID_DATA_TYPES.has(claim.dataType)) {
      return [];
    }

    return [
      {
        code: 'INVALID_DATA_TYPE',
        message: `Claim type "${claim.id}" uses unsupported data type "${claim.dataType}".`,
        entityId: claim.id,
        entityType: 'ClaimType',
        fileId: claim.definedInFileId,
      } satisfies SchemaWarning,
    ];
  });
}

function validateTransformations(chain: PolicyChain): SchemaWarning[] {
  return chain.resolvedClaimsTransformations.flatMap((transformation) => {
    if (KNOWN_TRANSFORMATION_METHODS.has(transformation.transformationMethod)) {
      return [];
    }

    return [
      {
        code: 'INVALID_TRANSFORMATION_METHOD',
        message: `Claims transformation "${transformation.id}" uses unsupported transformation method "${transformation.transformationMethod}".`,
        entityId: transformation.id,
        entityType: 'ClaimsTransformation',
        fileId: transformation.definedInFileId,
      } satisfies SchemaWarning,
    ];
  });
}

import type {
  ClaimReference,
  CryptographicKey,
  ProtocolInfo,
  TechnicalProfile,
  TransformationReference,
  ValidationTechnicalProfileRef,
} from '@policy-analyzer/shared';
import type { ParsedFile } from './types.js';
import { asArray, copyOptional, normalizeId, readAttr, readBooleanLike, readNode, readText } from './xml.js';

export function extractTechnicalProfiles(parsed: ParsedFile, fileId: string): TechnicalProfile[] {
  const claimsProviders = asArray<Record<string, unknown>>(
    readNode(parsed.ast, ['ClaimsProviders', 'ClaimsProvider']),
  );

  return claimsProviders.flatMap((claimsProvider) =>
    asArray<Record<string, unknown>>(
      readNode(claimsProvider, ['TechnicalProfiles', 'TechnicalProfile']),
    )
      .map((node) => extractTechnicalProfile(node, fileId))
      .filter((tp): tp is TechnicalProfile => tp !== undefined),
  );
}

function extractTechnicalProfile(
  node: Record<string, unknown>,
  fileId: string,
): TechnicalProfile | undefined {
  const rawId = readAttr(node, 'Id');
  if (rawId === undefined) return undefined;
  const id = normalizeId(rawId);

  const profile: TechnicalProfile = {
    id,
    protocolCategory: 'OTHER',
    metadata: extractMetadata(node['Metadata']),
    cryptographicKeys: extractCryptographicKeys(node['CryptographicKeys']),
    inputClaims: extractClaimReferences(node['InputClaims'], 'InputClaim'),
    outputClaims: extractClaimReferences(node['OutputClaims'], 'OutputClaim'),
    persistedClaims: extractClaimReferences(node['PersistedClaims'], 'PersistedClaim'),
    inputClaimsTransformations: extractTransformations(
      node['InputClaimsTransformations'],
      'InputClaimsTransformation',
    ),
    outputClaimsTransformations: extractTransformations(
      node['OutputClaimsTransformations'],
      'OutputClaimsTransformation',
    ),
    validationTechnicalProfiles: extractValidationTechnicalProfiles(
      node['ValidationTechnicalProfiles'],
    ),
    definedInFileId: fileId,
    isOverride: false,
    overriddenFromFileIds: [],
    resolvedFromMerge: false,
  };
  copyOptional(profile, 'displayName', readText(node['DisplayName']));
  copyOptional(profile, 'description', readText(node['Description']));
  copyOptional(profile, 'protocol', extractProtocol(node['Protocol']));
  copyOptional(profile, 'domain', readText(node['Domain']));
  copyOptional(profile, 'includeInSso', readBooleanLike(node['IncludeInSso']));
  copyOptional(
    profile,
    'includeClaimsFromTechnicalProfileId',
    readAttr(node['IncludeTechnicalProfile'], 'ReferenceId'),
  );
  copyOptional(
    profile,
    'useTechnicalProfileForSessionManagement',
    readAttr(node['UseTechnicalProfileForSessionManagement'], 'ReferenceId'),
  );
  copyOptional(profile, 'enabled', readBooleanLike(node['Enabled']));
  return profile;
}

function extractProtocol(node: unknown): ProtocolInfo | undefined {
  const name = readAttr(node, 'Name');
  if (name === undefined) return undefined;
  const protocol: ProtocolInfo = { name };
  copyOptional(protocol, 'handler', readAttr(node, 'Handler'));
  return protocol;
}

function extractMetadata(node: unknown): Record<string, string> {
  const items = asArray<Record<string, unknown>>(readNode(node, ['Item']));
  const metadata: Record<string, string> = {};

  for (const item of items) {
    const key = readAttr(item, 'Key');
    const value = readText(item);
    if (key !== undefined && value !== undefined) metadata[key] = value;
  }

  return metadata;
}

function extractCryptographicKeys(node: unknown): CryptographicKey[] {
  return asArray<Record<string, unknown>>(readNode(node, ['Key']))
    .map((key) => {
      const rawId = readAttr(key, 'Id');
      const storageReferenceId = readAttr(key, 'StorageReferenceId');
      if (rawId === undefined || storageReferenceId === undefined) return undefined;
      return { id: normalizeId(rawId), storageReferenceId };
    })
    .filter((key): key is CryptographicKey => key !== undefined);
}

function extractClaimReferences(node: unknown, itemKey: string): ClaimReference[] {
  const claims: ClaimReference[] = [];
  for (const item of asArray<Record<string, unknown>>(readNode(node, [itemKey]))) {
    const claimTypeReferenceId = readAttr(item, 'ClaimTypeReferenceId');
    if (claimTypeReferenceId === undefined) continue;
    const claim: ClaimReference = { claimTypeReferenceId };
    copyOptional(claim, 'defaultValue', readAttr(item, 'DefaultValue'));
    copyOptional(claim, 'required', readBooleanLike(readAttr(item, 'Required')));
    copyOptional(claim, 'partnerClaimType', readAttr(item, 'PartnerClaimType'));
    claims.push(claim);
  }
  return claims;
}

function extractTransformations(node: unknown, itemKey: string): TransformationReference[] {
  return asArray<Record<string, unknown>>(readNode(node, [itemKey]))
    .map((item) => {
      const referenceId = readAttr(item, 'ReferenceId');
      return referenceId === undefined ? undefined : { referenceId };
    })
    .filter((item): item is TransformationReference => item !== undefined);
}

function extractValidationTechnicalProfiles(node: unknown): ValidationTechnicalProfileRef[] {
  const profiles: ValidationTechnicalProfileRef[] = [];
  for (const item of asArray<Record<string, unknown>>(
    readNode(node, ['ValidationTechnicalProfile']),
  )) {
    const referenceId = readAttr(item, 'ReferenceId');
    if (referenceId === undefined) continue;
    const profile: ValidationTechnicalProfileRef = {
      referenceId,
      preconditions: extractPreconditions(item['Preconditions']),
    };
    copyOptional(profile, 'continueOnError', readBooleanLike(readAttr(item, 'ContinueOnError')));
    profiles.push(profile);
  }
  return profiles;
}

function extractPreconditions(node: unknown): ValidationTechnicalProfileRef['preconditions'] {
  const preconditions: ValidationTechnicalProfileRef['preconditions'] = [];
  for (const precondition of asArray<Record<string, unknown>>(readNode(node, ['Precondition']))) {
    const type = readAttr(precondition, 'Type');
    const executeActionsIf = readAttr(precondition, 'ExecuteActionsIf');
    if (type === undefined || (executeActionsIf !== 'true' && executeActionsIf !== 'false')) {
      continue;
    }

    const item: ValidationTechnicalProfileRef['preconditions'][number] = {
      type,
      executeActionsIf,
      values: asArray<unknown>(precondition['Value'])
        .map((value) => readText(value))
        .filter((value): value is string => value !== undefined),
    };
    copyOptional(item, 'action', readText(precondition['Action']));
    preconditions.push(item);
  }
  return preconditions;
}

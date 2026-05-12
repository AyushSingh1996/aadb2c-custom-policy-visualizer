import type {
  ClaimsProvider,
  ClaimsSchemaEntry,
  ClaimsTransformation,
} from '@policy-analyzer/shared';
import type { ParsedFile } from './types.js';
import { asArray, copyOptional, normalizeId, readAttr, readNode, readText } from './xml.js';

export function extractClaimsSchema(parsed: ParsedFile, fileId: string): ClaimsSchemaEntry[] {
  const claims: ClaimsSchemaEntry[] = [];
  for (const claimType of asArray<Record<string, unknown>>(
    readNode(parsed.ast, ['BuildingBlocks', 'ClaimsSchema', 'ClaimType']),
  )) {
    const rawId = readAttr(claimType, 'Id');
    if (rawId === undefined) continue;
    const id = normalizeId(rawId);

    const claim: ClaimsSchemaEntry = {
      id,
      definedInFileId: fileId,
      isOverride: false,
    };
    copyOptional(claim, 'displayName', readText(claimType['DisplayName']));
    copyOptional(claim, 'dataType', readText(claimType['DataType']));
    copyOptional(claim, 'userInputType', readText(claimType['UserInputType']));
    copyOptional(claim, 'userHelpText', readText(claimType['UserHelpText']));
    copyOptional(claim, 'mask', readText(claimType['Mask']));
    copyOptional(
      claim,
      'predicateValidationReference',
      readText(claimType['PredicateValidationReference']),
    );
    copyOptional(claim, 'restrictionEnumeration', extractRestrictionEnumeration(claimType));
    claims.push(claim);
  }
  return claims;
}

export function extractClaimsTransformations(
  parsed: ParsedFile,
  fileId: string,
): ClaimsTransformation[] {
  return asArray<Record<string, unknown>>(
    readNode(parsed.ast, ['BuildingBlocks', 'ClaimsTransformations', 'ClaimsTransformation']),
  )
    .map((transformation) => {
      const rawId = readAttr(transformation, 'Id');
      const transformationMethod = readAttr(transformation, 'TransformationMethod');
      if (rawId === undefined || transformationMethod === undefined) return undefined;

      return {
        id: normalizeId(rawId),
        transformationMethod,
        inputClaims: extractTransformationClaims(transformation['InputClaims'], 'InputClaim'),
        inputParameters: extractInputParameters(transformation['InputParameters']),
        outputClaims: extractTransformationClaims(transformation['OutputClaims'], 'OutputClaim'),
        definedInFileId: fileId,
        isOverride: false,
      };
    })
    .filter((transformation): transformation is ClaimsTransformation => transformation !== undefined);
}

export function extractClaimsProviders(parsed: ParsedFile, fileId: string): ClaimsProvider[] {
  const providers: ClaimsProvider[] = [];
  for (const claimsProvider of asArray<Record<string, unknown>>(
    readNode(parsed.ast, ['ClaimsProviders', 'ClaimsProvider']),
  )) {
    const displayName = readText(claimsProvider['DisplayName']);
    if (displayName === undefined) continue;

    const provider: ClaimsProvider = {
      displayName,
      technicalProfileIds: asArray<Record<string, unknown>>(
        readNode(claimsProvider, ['TechnicalProfiles', 'TechnicalProfile']),
      )
        .map((tp) => readAttr(tp, 'Id'))
        .filter((id): id is string => id !== undefined)
        .map(normalizeId),
      definedInFileId: fileId,
    };
    copyOptional(provider, 'domain', readText(claimsProvider['Domain']));
    providers.push(provider);
  }
  return providers;
}

function extractRestrictionEnumeration(
  claimType: Record<string, unknown>,
): ClaimsSchemaEntry['restrictionEnumeration'] {
  const items = asArray<Record<string, unknown>>(readNode(claimType, ['Restriction', 'Enumeration']))
    .map((item) => {
      const value = readAttr(item, 'Value') ?? readText(item);
      if (value === undefined) return undefined;
      return {
        value,
        text: readAttr(item, 'Text') ?? value,
      };
    })
    .filter((item): item is { value: string; text: string } => item !== undefined);

  return items.length === 0 ? undefined : items;
}

function extractTransformationClaims(
  node: unknown,
  itemKey: string,
): ClaimsTransformation['inputClaims'] {
  return asArray<Record<string, unknown>>(readNode(node, [itemKey]))
    .map((claim) => {
      const claimTypeReferenceId = readAttr(claim, 'ClaimTypeReferenceId');
      const transformationClaimType = readAttr(claim, 'TransformationClaimType');
      if (claimTypeReferenceId === undefined || transformationClaimType === undefined) {
        return undefined;
      }
      return { claimTypeReferenceId, transformationClaimType };
    })
    .filter(
      (claim): claim is ClaimsTransformation['inputClaims'][number] => claim !== undefined,
    );
}

function extractInputParameters(node: unknown): ClaimsTransformation['inputParameters'] {
  return asArray<Record<string, unknown>>(readNode(node, ['InputParameter']))
    .map((param) => {
      const id = readAttr(param, 'Id');
      const dataType = readAttr(param, 'DataType');
      const value = readAttr(param, 'Value') ?? readText(param);
      if (id === undefined || dataType === undefined || value === undefined) return undefined;
      return { id, dataType, value };
    })
    .filter((param): param is ClaimsTransformation['inputParameters'][number] => param !== undefined);
}

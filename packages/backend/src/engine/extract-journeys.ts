import type {
  ClaimsExchange,
  OrchestrationStep,
  OrchestrationStepType,
  Precondition,
  UserJourney,
} from '@policy-analyzer/shared';
import type { ParsedFile } from './types.js';
import { asArray, copyOptional, normalizeId, readAttr, readNode, readText } from './xml.js';

export function extractUserJourneys(parsed: ParsedFile, fileId: string): UserJourney[] {
  return asArray<Record<string, unknown>>(readNode(parsed.ast, ['UserJourneys', 'UserJourney']))
    .map((journey) => {
      const rawId = readAttr(journey, 'Id');
      if (rawId === undefined) return undefined;

      return {
        id: normalizeId(rawId),
        definedInFileId: fileId,
        isOverride: false,
        steps: extractSteps(journey),
      };
    })
    .filter((journey): journey is UserJourney => journey !== undefined);
}

function extractSteps(journey: Record<string, unknown>): OrchestrationStep[] {
  return asArray<Record<string, unknown>>(readNode(journey, ['OrchestrationSteps', 'OrchestrationStep']))
    .map((step) => extractStep(step))
    .filter((step): step is OrchestrationStep => step !== undefined)
    .sort((a, b) => a.order - b.order);
}

function extractStep(step: Record<string, unknown>): OrchestrationStep | undefined {
  const orderText = readAttr(step, 'Order');
  const typeText = readAttr(step, 'Type');
  if (orderText === undefined || typeText === undefined) return undefined;

  const order = Number(orderText);
  if (!Number.isFinite(order)) return undefined;

  const type = mapStepType(typeText);

  const extracted: OrchestrationStep = {
    order,
    type,
    claimsExchanges: extractClaimsExchanges(step),
    preconditions: extractPreconditions(step),
    inputClaimNames: [],
    outputClaimNames: [],
  };
  copyOptional(extracted, 'rawType', type === 'Other' ? typeText : undefined);
  copyOptional(
    extracted,
    'contentDefinitionReferenceId',
    readAttr(step, 'ContentDefinitionReferenceId') ??
      readText(readNode(step, ['ContentDefinitionReferenceId'])),
  );
  copyOptional(extracted, 'technicalProfileReferenceId', extractTechnicalProfileReferenceId(step, type));
  copyOptional(extracted, 'targetClaimsExchangeIds', extractTargetClaimsExchangeIds(step));
  return extracted;
}

function mapStepType(typeText: string): OrchestrationStepType {
  switch (typeText) {
    case 'ClaimsExchange':
    case 'ClaimsProviderSelection':
    case 'CombinedSignInAndSignUp':
    case 'SendClaims':
    case 'InvokeSubJourney':
    case 'GetClaims':
      return typeText;
    default:
      return 'Other';
  }
}

function extractTechnicalProfileReferenceId(
  step: Record<string, unknown>,
  type: OrchestrationStepType,
): string | undefined {
  if (type === 'SendClaims') {
    return readAttr(step, 'CpimIssuerTechnicalProfileReferenceId');
  }

  const claimsExchanges = extractClaimsExchanges(step);
  if (claimsExchanges.length === 1) return claimsExchanges[0]?.technicalProfileReferenceId;
  return undefined;
}

function extractClaimsExchanges(step: Record<string, unknown>): ClaimsExchange[] {
  return asArray<Record<string, unknown>>(readNode(step, ['ClaimsExchanges', 'ClaimsExchange']))
    .map((exchange) => {
      const rawId = readAttr(exchange, 'Id');
      const technicalProfileReferenceId = readAttr(exchange, 'TechnicalProfileReferenceId');
      if (rawId === undefined || technicalProfileReferenceId === undefined) return undefined;
      return { id: normalizeId(rawId), technicalProfileReferenceId };
    })
    .filter((exchange): exchange is ClaimsExchange => exchange !== undefined);
}

function extractTargetClaimsExchangeIds(step: Record<string, unknown>): string[] | undefined {
  const ids = asArray<Record<string, unknown>>(
    readNode(step, ['ClaimsProviderSelections', 'ClaimsProviderSelection']),
  )
    .map(
      (selection) =>
        readAttr(selection, 'TargetClaimsExchangeId') ??
        readAttr(selection, 'ValidationClaimsExchangeId'),
    )
    .filter((id): id is string => id !== undefined);

  return ids.length === 0 ? undefined : ids;
}

function extractPreconditions(step: Record<string, unknown>): Precondition[] {
  const preconditions: Precondition[] = [];
  for (const precondition of asArray<Record<string, unknown>>(
    readNode(step, ['Preconditions', 'Precondition']),
  )) {
    const type = readAttr(precondition, 'Type');
    const executeActionsIf = readAttr(precondition, 'ExecuteActionsIf');
    if (type === undefined || (executeActionsIf !== 'true' && executeActionsIf !== 'false')) {
      continue;
    }

    const extracted: Precondition = {
      type,
      executeActionsIf,
      values: asArray<unknown>(precondition['Value'])
        .map((value) => readText(value))
        .filter((value): value is string => value !== undefined),
    };
    copyOptional(extracted, 'action', readText(precondition['Action']));
    preconditions.push(extracted);
  }
  return preconditions;
}

import type {
  ClaimReference,
  ClaimsProvider,
  ClaimsSchemaEntry,
  ClaimsTransformation,
  LocalizationEntry,
  PolicyChain,
  TechnicalProfile,
  TransformationReference,
  UserJourney,
  ValidationTechnicalProfileRef,
} from '@policy-analyzer/shared';
import type { ExtractedFileEntities, ResolvedChainEntities } from './types.js';
import { copyOptional } from './xml.js';

export function resolveOverrides(
  chain: PolicyChain,
  extractedByFileId: Map<string, ExtractedFileEntities>,
): ResolvedChainEntities {
  const technicalProfiles = new Map<string, TechnicalProfile>();
  const journeys = new Map<string, UserJourney>();
  const claimsSchema = new Map<string, ClaimsSchemaEntry>();
  const transformations = new Map<string, ClaimsTransformation>();
  const providers = new Map<string, ClaimsProvider>();
  const localizations = new Map<string, LocalizationEntry>();

  for (const fileId of chain.fileIds) {
    const entities = extractedByFileId.get(fileId);
    if (entities === undefined) continue;

    for (const profile of entities.technicalProfiles) {
      const existing = technicalProfiles.get(profile.id);
      technicalProfiles.set(
        profile.id,
        existing === undefined
          ? cloneTechnicalProfile(profile)
          : mergeTechnicalProfiles(existing, profile),
      );
    }

    for (const journey of entities.journeys) {
      const existing = journeys.get(journey.id);
      journeys.set(journey.id, mergeUserJourney(existing, journey));
    }

    for (const claim of entities.claimsSchema) {
      const existing = claimsSchema.get(claim.id);
      claimsSchema.set(claim.id, mergeClaimSchema(existing, claim));
    }

    for (const transformation of entities.claimsTransformations) {
      const existing = transformations.get(transformation.id);
      transformations.set(transformation.id, mergeTransformation(existing, transformation));
    }

    for (const provider of entities.claimsProviders) {
      const existing = providers.get(provider.displayName);
      providers.set(provider.displayName, mergeClaimsProvider(existing, provider));
    }

    for (const localization of entities.localizations) {
      localizations.set(localization.resourceId, cloneLocalization(localization));
    }
  }

  const resolvedTechnicalProfiles = [...technicalProfiles.values()];
  const resolvedTechnicalProfileIds = new Set(
    resolvedTechnicalProfiles.map((profile) => profile.id),
  );
  const resolvedClaimsProviders = [...providers.values()].map((provider) => ({
    ...provider,
    technicalProfileIds: provider.technicalProfileIds.filter((id) =>
      resolvedTechnicalProfileIds.has(id),
    ),
  }));

  return {
    resolvedJourneys: [...journeys.values()],
    resolvedTechnicalProfiles,
    resolvedClaimsSchema: [...claimsSchema.values()],
    resolvedClaimsTransformations: [...transformations.values()],
    resolvedClaimsProviders,
    resolvedLocalizations: [...localizations.values()],
  };
}

function mergeTechnicalProfiles(
  existing: TechnicalProfile,
  incoming: TechnicalProfile,
): TechnicalProfile {
  const ancestorFileIds = dedupeFileIds([
    ...existing.overriddenFromFileIds,
    existing.definedInFileId,
  ]);

  const merged: TechnicalProfile = {
    id: existing.id,
    protocolCategory: incoming.protocolCategory,
    metadata: { ...existing.metadata, ...incoming.metadata },
    cryptographicKeys:
      incoming.cryptographicKeys.length > 0
        ? cloneKeys(incoming.cryptographicKeys)
        : cloneKeys(existing.cryptographicKeys),
    inputClaims: mergeClaimReferences(existing.inputClaims, incoming.inputClaims),
    outputClaims: mergeClaimReferences(existing.outputClaims, incoming.outputClaims),
    persistedClaims: mergeClaimReferences(existing.persistedClaims, incoming.persistedClaims),
    inputClaimsTransformations: mergeTransformRefs(
      existing.inputClaimsTransformations,
      incoming.inputClaimsTransformations,
    ),
    outputClaimsTransformations: mergeTransformRefs(
      existing.outputClaimsTransformations,
      incoming.outputClaimsTransformations,
    ),
    validationTechnicalProfiles: mergeValidationProfiles(
      existing.validationTechnicalProfiles,
      incoming.validationTechnicalProfiles,
    ),
    definedInFileId: incoming.definedInFileId,
    isOverride: true,
    overriddenFromFileIds: ancestorFileIds,
    resolvedFromMerge: true,
  };

  copyOptional(merged, 'displayName', incoming.displayName ?? existing.displayName);
  copyOptional(merged, 'description', incoming.description ?? existing.description);
  copyOptional(merged, 'protocol', incoming.protocol ?? existing.protocol);
  copyOptional(merged, 'domain', incoming.domain ?? existing.domain);
  copyOptional(merged, 'includeInSso', selectDefined(incoming.includeInSso, existing.includeInSso));
  copyOptional(
    merged,
    'includeClaimsFromTechnicalProfileId',
    selectDefined(
      incoming.includeClaimsFromTechnicalProfileId,
      existing.includeClaimsFromTechnicalProfileId,
    ),
  );
  copyOptional(
    merged,
    'useTechnicalProfileForSessionManagement',
    selectDefined(
      incoming.useTechnicalProfileForSessionManagement,
      existing.useTechnicalProfileForSessionManagement,
    ),
  );
  copyOptional(merged, 'enabled', selectDefined(incoming.enabled, existing.enabled));

  return merged;
}

function mergeUserJourney(existing: UserJourney | undefined, incoming: UserJourney): UserJourney {
  if (existing === undefined) return cloneJourney(incoming);
  return {
    ...cloneJourney(incoming),
    isOverride: true,
  };
}

function mergeClaimSchema(
  existing: ClaimsSchemaEntry | undefined,
  incoming: ClaimsSchemaEntry,
): ClaimsSchemaEntry {
  if (existing === undefined) return cloneClaimSchema(incoming);

  const merged: ClaimsSchemaEntry = {
    id: incoming.id,
    definedInFileId: incoming.definedInFileId,
    isOverride: true,
  };

  copyOptional(merged, 'displayName', incoming.displayName ?? existing.displayName);
  copyOptional(merged, 'dataType', incoming.dataType ?? existing.dataType);
  copyOptional(merged, 'userInputType', incoming.userInputType ?? existing.userInputType);
  copyOptional(merged, 'userHelpText', incoming.userHelpText ?? existing.userHelpText);
  copyOptional(merged, 'mask', incoming.mask ?? existing.mask);
  copyOptional(
    merged,
    'predicateValidationReference',
    incoming.predicateValidationReference ?? existing.predicateValidationReference,
  );
  copyOptional(
    merged,
    'restrictionEnumeration',
    incoming.restrictionEnumeration ?? existing.restrictionEnumeration,
  );

  return merged;
}

function mergeTransformation(
  existing: ClaimsTransformation | undefined,
  incoming: ClaimsTransformation,
): ClaimsTransformation {
  if (existing === undefined) return cloneTransformation(incoming);
  return {
    ...cloneTransformation(incoming),
    isOverride: true,
  };
}

function mergeClaimsProvider(
  existing: ClaimsProvider | undefined,
  incoming: ClaimsProvider,
): ClaimsProvider {
  if (existing === undefined) return cloneClaimsProvider(incoming);

  const merged: ClaimsProvider = {
    displayName: incoming.displayName,
    technicalProfileIds: dedupeStrings([
      ...existing.technicalProfileIds,
      ...incoming.technicalProfileIds,
    ]),
    definedInFileId: incoming.definedInFileId,
  };
  copyOptional(merged, 'domain', incoming.domain ?? existing.domain);
  return merged;
}

function mergeClaimReferences(
  existing: ClaimReference[],
  incoming: ClaimReference[],
): ClaimReference[] {
  const merged = new Map<string, ClaimReference>();
  for (const claim of existing) {
    merged.set(claim.claimTypeReferenceId, cloneClaimReference(claim));
  }
  for (const claim of incoming) {
    const prior = merged.get(claim.claimTypeReferenceId);
    merged.set(
      claim.claimTypeReferenceId,
      prior === undefined ? cloneClaimReference(claim) : mergeClaimReference(prior, claim),
    );
  }
  return [...merged.values()];
}

function mergeTransformRefs(
  existing: TransformationReference[],
  incoming: TransformationReference[],
): TransformationReference[] {
  const merged = new Map<string, TransformationReference>();
  for (const item of existing) {
    merged.set(item.referenceId, { ...item });
  }
  for (const item of incoming) {
    merged.set(item.referenceId, { ...item });
  }
  return [...merged.values()];
}

function mergeValidationProfiles(
  existing: ValidationTechnicalProfileRef[],
  incoming: ValidationTechnicalProfileRef[],
): ValidationTechnicalProfileRef[] {
  const merged = new Map<string, ValidationTechnicalProfileRef>();
  for (const item of existing) {
    merged.set(item.referenceId, cloneValidationProfile(item));
  }
  for (const item of incoming) {
    const prior = merged.get(item.referenceId);
    merged.set(
      item.referenceId,
      prior === undefined ? cloneValidationProfile(item) : mergeValidationProfile(prior, item),
    );
  }
  return [...merged.values()];
}

function cloneTechnicalProfile(profile: TechnicalProfile): TechnicalProfile {
  const cloned: TechnicalProfile = {
    id: profile.id,
    protocolCategory: profile.protocolCategory,
    metadata: { ...profile.metadata },
    cryptographicKeys: cloneKeys(profile.cryptographicKeys),
    inputClaims: profile.inputClaims.map(cloneClaimReference),
    outputClaims: profile.outputClaims.map(cloneClaimReference),
    persistedClaims: profile.persistedClaims.map(cloneClaimReference),
    inputClaimsTransformations: profile.inputClaimsTransformations.map((item) => ({ ...item })),
    outputClaimsTransformations: profile.outputClaimsTransformations.map((item) => ({ ...item })),
    validationTechnicalProfiles: profile.validationTechnicalProfiles.map(cloneValidationProfile),
    definedInFileId: profile.definedInFileId,
    isOverride: profile.isOverride,
    overriddenFromFileIds: [...profile.overriddenFromFileIds],
    resolvedFromMerge: profile.resolvedFromMerge,
  };

  copyOptional(cloned, 'displayName', profile.displayName);
  copyOptional(cloned, 'description', profile.description);
  copyOptional(cloned, 'protocol', profile.protocol ? { ...profile.protocol } : undefined);
  copyOptional(cloned, 'domain', profile.domain);
  copyOptional(cloned, 'includeInSso', profile.includeInSso);
  copyOptional(
    cloned,
    'includeClaimsFromTechnicalProfileId',
    profile.includeClaimsFromTechnicalProfileId,
  );
  copyOptional(
    cloned,
    'useTechnicalProfileForSessionManagement',
    profile.useTechnicalProfileForSessionManagement,
  );
  copyOptional(cloned, 'enabled', profile.enabled);

  return cloned;
}

function cloneJourney(journey: UserJourney): UserJourney {
  return {
    ...journey,
    steps: journey.steps.map((step) => ({
      ...cloneStep(step),
    })),
  };
}

function cloneClaimSchema(claim: ClaimsSchemaEntry): ClaimsSchemaEntry {
  const cloned: ClaimsSchemaEntry = { ...claim };
  copyOptional(
    cloned,
    'restrictionEnumeration',
    claim.restrictionEnumeration?.map((item) => ({ ...item })),
  );
  return cloned;
}

function cloneTransformation(transformation: ClaimsTransformation): ClaimsTransformation {
  return {
    ...transformation,
    inputClaims: transformation.inputClaims.map((claim) => ({ ...claim })),
    inputParameters: transformation.inputParameters.map((param) => ({ ...param })),
    outputClaims: transformation.outputClaims.map((claim) => ({ ...claim })),
  };
}

function cloneClaimsProvider(provider: ClaimsProvider): ClaimsProvider {
  const cloned: ClaimsProvider = {
    ...provider,
    technicalProfileIds: [...provider.technicalProfileIds],
  };
  copyOptional(cloned, 'domain', provider.domain);
  return cloned;
}

function cloneLocalization(localization: LocalizationEntry): LocalizationEntry {
  return {
    ...localization,
    localizedStrings: localization.localizedStrings.map((item) => ({ ...item })),
    localizedCollections: localization.localizedCollections.map((collection) => ({
      ...collection,
      items: collection.items.map((item) => ({ ...item })),
    })),
  };
}

function cloneClaimReference(claim: ClaimReference): ClaimReference {
  const cloned: ClaimReference = {
    claimTypeReferenceId: claim.claimTypeReferenceId,
  };
  copyOptional(cloned, 'defaultValue', claim.defaultValue);
  copyOptional(cloned, 'required', claim.required);
  copyOptional(cloned, 'partnerClaimType', claim.partnerClaimType);
  return cloned;
}

function mergeClaimReference(existing: ClaimReference, incoming: ClaimReference): ClaimReference {
  const merged: ClaimReference = {
    claimTypeReferenceId: incoming.claimTypeReferenceId,
  };
  copyOptional(merged, 'defaultValue', incoming.defaultValue ?? existing.defaultValue);
  copyOptional(merged, 'required', selectDefined(incoming.required, existing.required));
  copyOptional(merged, 'partnerClaimType', incoming.partnerClaimType ?? existing.partnerClaimType);
  return merged;
}

function cloneValidationProfile(
  profile: ValidationTechnicalProfileRef,
): ValidationTechnicalProfileRef {
  const cloned: ValidationTechnicalProfileRef = {
    referenceId: profile.referenceId,
    preconditions: profile.preconditions.map((precondition) => ({
      ...precondition,
      values: [...precondition.values],
    })),
  };
  copyOptional(cloned, 'continueOnError', profile.continueOnError);
  return cloned;
}

function mergeValidationProfile(
  existing: ValidationTechnicalProfileRef,
  incoming: ValidationTechnicalProfileRef,
): ValidationTechnicalProfileRef {
  const merged: ValidationTechnicalProfileRef = {
    referenceId: incoming.referenceId,
    preconditions:
      incoming.preconditions.length > 0 ? [...incoming.preconditions] : [...existing.preconditions],
  };
  copyOptional(
    merged,
    'continueOnError',
    selectDefined(incoming.continueOnError, existing.continueOnError),
  );
  return merged;
}

function cloneStep(journeyStep: UserJourney['steps'][number]): UserJourney['steps'][number] {
  const step: UserJourney['steps'][number] = {
    order: journeyStep.order,
    type: journeyStep.type,
    claimsExchanges: journeyStep.claimsExchanges.map((exchange) => ({ ...exchange })),
    preconditions: journeyStep.preconditions.map((precondition) => ({
      ...precondition,
      values: [...precondition.values],
    })),
    inputClaimNames: [...journeyStep.inputClaimNames],
    outputClaimNames: [...journeyStep.outputClaimNames],
  };
  copyOptional(step, 'rawType', journeyStep.rawType);
  copyOptional(step, 'contentDefinitionReferenceId', journeyStep.contentDefinitionReferenceId);
  copyOptional(step, 'technicalProfileReferenceId', journeyStep.technicalProfileReferenceId);
  copyOptional(
    step,
    'targetClaimsExchangeIds',
    journeyStep.targetClaimsExchangeIds ? [...journeyStep.targetClaimsExchangeIds] : undefined,
  );
  return step;
}

function cloneKeys(
  keys: TechnicalProfile['cryptographicKeys'],
): TechnicalProfile['cryptographicKeys'] {
  return keys.map((key) => ({ ...key }));
}

function dedupeFileIds(fileIds: string[]): string[] {
  return [...new Set(fileIds)];
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function selectDefined<T>(preferred: T | undefined, fallback: T | undefined): T | undefined {
  return preferred !== undefined ? preferred : fallback;
}

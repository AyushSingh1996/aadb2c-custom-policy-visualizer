import type {
  ClaimReference,
  ClaimsSchemaEntry,
  ExternalDependency,
  FileCategory,
  OrphanReference,
  OrchestrationStep,
  PolicyChain,
  PolicyFile,
  TechnicalProfile,
  UserJourney,
} from '@policy-analyzer/shared';
import { getFileDisplayPath } from './format.js';

export interface PolicyMapRelyingPartyNode {
  chainId: string;
  flowName: string;
  rpFile: PolicyFile;
}

export interface PolicyMapExtensionGroup {
  extensionFile: PolicyFile;
  relyingParties: PolicyMapRelyingPartyNode[];
}

export interface PolicyMapBaseSection {
  baseFile: PolicyFile;
  extensions: PolicyMapExtensionGroup[];
  isPlaceholder?: boolean;
}

export interface ClaimDisplay {
  id: string;
  dataType?: string;
  displayName?: string;
  defaultValue?: string;
  required?: boolean;
}

export function getChainFiles(chain: PolicyChain, files: PolicyFile[]): PolicyFile[] {
  const fileMap = new Map(files.map((file) => [file.id, file] as const));
  return chain.fileIds.flatMap((fileId) => {
    const file = fileMap.get(fileId);
    return file ? [file] : [];
  });
}

export function getChainRelyingPartyCount(chainFiles: PolicyFile[]): number {
  return chainFiles.filter((file) => file.category === 'RelyingParty').length;
}

export function getChainLastModified(chainFiles: PolicyFile[]): string | undefined {
  const latest = [...chainFiles]
    .map((file) => new Date(file.lastModified).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => right - left)[0];

  return latest !== undefined ? new Date(latest).toISOString() : undefined;
}

export function buildPolicyMapSections(
  chains: PolicyChain[],
  files: PolicyFile[],
  orphanReferences: PolicyChain['orphanReferences'] | OrphanReference[] = [],
): PolicyMapBaseSection[] {
  const fileMap = new Map(files.map((file) => [file.id, file] as const));
  const fileOrder = new Map(files.map((file, index) => [file.id, index] as const));
  const sections = new Map<
    string,
    {
      baseFile: PolicyFile;
      extensions: Map<string, PolicyMapExtensionGroup>;
    }
  >();
  const placeholderSections: PolicyMapBaseSection[] = [];

  for (const chain of chains) {
    const chainFiles = getChainFiles(chain, files);
    const baseFile = chainFiles.find((file) => file.category === 'Base');
    const extensionFile = [...chainFiles]
      .reverse()
      .find((file) => file.category === 'Extension');
    const rpFile = fileMap.get(chain.rpFileId) ?? chainFiles.find((file) => file.category === 'RelyingParty');

    if (!baseFile || !extensionFile || !rpFile) {
      continue;
    }

    const baseSection =
      sections.get(baseFile.id) ??
      {
        baseFile,
        extensions: new Map<string, PolicyMapExtensionGroup>(),
      };
    sections.set(baseFile.id, baseSection);

    const extensionGroup =
      baseSection.extensions.get(extensionFile.id) ??
      {
        extensionFile,
        relyingParties: [],
      };
    baseSection.extensions.set(extensionFile.id, extensionGroup);

    extensionGroup.relyingParties.push({
      chainId: chain.id,
      flowName: chain.name,
      rpFile,
    });
  }

  const resolvedSections = [...sections.values()]
    .sort(
      (left, right) =>
        (fileOrder.get(left.baseFile.id) ?? Number.MAX_SAFE_INTEGER) -
        (fileOrder.get(right.baseFile.id) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((section) => ({
      baseFile: section.baseFile,
      extensions: [...section.extensions.values()]
        .sort(
          (left, right) =>
            (fileOrder.get(left.extensionFile.id) ?? Number.MAX_SAFE_INTEGER) -
            (fileOrder.get(right.extensionFile.id) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((extension) => ({
          extensionFile: extension.extensionFile,
          relyingParties: [...extension.relyingParties].sort(
            (left, right) =>
              (fileOrder.get(left.rpFile.id) ?? Number.MAX_SAFE_INTEGER) -
              (fileOrder.get(right.rpFile.id) ?? Number.MAX_SAFE_INTEGER),
          ),
        })),
    }));
  for (const orphan of orphanReferences) {
    if (orphan.referenceType !== 'BasePolicy') {
      continue;
    }

    const orphanSourceFile = fileMap.get(orphan.referencedFromFileId);
    placeholderSections.push({
      baseFile: {
        id: `missing-base:${orphan.referencedPolicyId}:${orphan.referencedFromFileId}`,
        fileName: `Missing: ${orphan.referencedPolicyId}`,
        sizeBytes: 0,
        lastModified: orphanSourceFile?.lastModified ?? new Date(0).toISOString(),
        category: 'Error',
        rawXml: '',
        parsedAt: orphanSourceFile?.parsedAt ?? new Date(0).toISOString(),
        parseError: orphan.message,
      },
      extensions: [],
      isPlaceholder: true,
    });
  }

  return [...resolvedSections, ...placeholderSections];
}

export function getDisplayParseError(file: PolicyFile): string | undefined {
  if (!file.parseError) {
    return undefined;
  }

  if (file.parseError.startsWith('Not a B2C custom policy file.')) {
    return 'This file is not an Azure AD B2C custom policy.';
  }

  if (file.parseError.startsWith('Cycle detected in inheritance chain:')) {
    const cycleNames = file.parseError.replace('Cycle detected in inheritance chain:', '').trim();
    const otherNames = cycleNames
      .split(/->|→/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0 && name !== getFileDisplayPath(file));

    return `Cyclic inheritance with: ${otherNames.join(', ')}.`;
  }

  return file.parseError;
}

export function getMissingTechnicalProfileIdsForStep(
  step: OrchestrationStep,
  chain: PolicyChain,
): string[] {
  const stepReferences = new Set(getTechnicalProfileIds(step));
  return chain.orphanReferences
    .filter((orphan) => orphan.referenceType === 'TechnicalProfile')
    .map((orphan) => orphan.referencedPolicyId)
    .filter((referenceId) => stepReferences.has(referenceId));
}

export function getCategoryLabel(category: FileCategory): string {
  switch (category) {
    case 'Base':
      return 'Base File';
    case 'Extension':
      return 'Extension File';
    case 'RelyingParty':
      return 'Relying Party File';
    case 'Localization':
      return 'Localization File';
    case 'Error':
    default:
      return 'Error';
  }
}

export function getCategoryColor(category: FileCategory): string {
  switch (category) {
    case 'Base':
      return 'var(--color-base)';
    case 'Extension':
      return 'var(--color-extension)';
    case 'RelyingParty':
      return 'var(--color-rp)';
    case 'Localization':
      return 'var(--color-localization)';
    case 'Error':
    default:
      return 'var(--color-error)';
  }
}

export function getPrimaryTechnicalProfileId(step: OrchestrationStep): string | undefined {
  return step.technicalProfileReferenceId ?? step.claimsExchanges[0]?.technicalProfileReferenceId;
}

export function getTechnicalProfileIds(step: OrchestrationStep): string[] {
  return [
    ...new Set(
      [
        step.technicalProfileReferenceId,
        ...step.claimsExchanges.map((exchange) => exchange.technicalProfileReferenceId),
      ].filter(isNonEmptyString),
    ),
  ];
}

export function findTechnicalProfilesForStep(
  step: OrchestrationStep,
  chain: PolicyChain,
): TechnicalProfile[] {
  const references = new Set(getTechnicalProfileIds(step));
  return chain.resolvedTechnicalProfiles.filter((profile) => references.has(profile.id));
}

export function findPrimaryTechnicalProfile(
  step: OrchestrationStep,
  chain: PolicyChain,
): TechnicalProfile | undefined {
  const primaryId = getPrimaryTechnicalProfileId(step);
  return primaryId
    ? chain.resolvedTechnicalProfiles.find((profile) => profile.id === primaryId)
    : undefined;
}

export function getJourneyTechnicalProfileCount(journey: UserJourney): number {
  const references = new Set<string>();

  for (const step of journey.steps) {
    for (const referenceId of getTechnicalProfileIds(step)) {
      references.add(referenceId);
    }
  }

  return references.size;
}

export function getStepDisplayName(step: OrchestrationStep, technicalProfile?: TechnicalProfile): string {
  if (technicalProfile?.displayName) {
    return technicalProfile.displayName;
  }

  if (technicalProfile?.id) {
    return technicalProfile.id;
  }

  if (step.claimsExchanges[0]?.id) {
    return step.claimsExchanges[0].id;
  }

  return getStepTypeLabel(step);
}

export function getStepTypeLabel(step: OrchestrationStep): string {
  return step.type === 'Other' && step.rawType ? step.rawType : step.type;
}

export function getStepPurpose(technicalProfile?: TechnicalProfile): string {
  if (!technicalProfile) {
    return 'No linked technical profile.';
  }

  return (
    technicalProfile.displayName ??
    technicalProfile.description ??
    technicalProfile.metadata['Description'] ??
    technicalProfile.id
  );
}

export function getClaimDisplaysFromNames(
  claimNames: string[],
  chain: PolicyChain,
): ClaimDisplay[] {
  const schemaById = new Map(chain.resolvedClaimsSchema.map((entry) => [entry.id, entry] as const));
  return claimNames.map((claimName) => claimDisplayFromSchema(claimName, schemaById.get(claimName)));
}

export function getClaimDisplaysFromReferences(
  references: ClaimReference[],
  chain: PolicyChain,
): ClaimDisplay[] {
  const schemaById = new Map(chain.resolvedClaimsSchema.map((entry) => [entry.id, entry] as const));
  return references.map((reference) => {
    const claimDisplay = claimDisplayFromSchema(
      reference.claimTypeReferenceId,
      schemaById.get(reference.claimTypeReferenceId),
    );

    return {
      ...claimDisplay,
      ...(reference.defaultValue !== undefined ? { defaultValue: reference.defaultValue } : {}),
      ...(reference.required !== undefined ? { required: reference.required } : {}),
    };
  });
}

export function formatPreconditions(step: OrchestrationStep): string {
  if (step.preconditions.length === 0) {
    return 'None';
  }

  return step.preconditions
    .map((precondition) => {
      const values = precondition.values.length > 0 ? ` for ${precondition.values.join(', ')}` : '';
      const action = precondition.action ? `, then ${precondition.action}` : '';
      return `${precondition.type} executes when condition is ${precondition.executeActionsIf}${values}${action}`;
    })
    .join('; ');
}

export function getExternalDependenciesForStep(
  chain: PolicyChain,
  step: OrchestrationStep,
): ExternalDependency[] {
  const references = new Set(getTechnicalProfileIds(step));
  return chain.externalDependencies.filter((dependency) => references.has(dependency.technicalProfileId));
}

function claimDisplayFromSchema(
  claimId: string,
  schemaEntry: ClaimsSchemaEntry | undefined,
): ClaimDisplay {
  return {
    id: claimId,
    ...(schemaEntry?.dataType !== undefined ? { dataType: schemaEntry.dataType } : {}),
    ...(schemaEntry?.displayName !== undefined ? { displayName: schemaEntry.displayName } : {}),
  };
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

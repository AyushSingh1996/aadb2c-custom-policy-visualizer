import { randomUUID } from 'node:crypto';
import type {
  AnalysisResult,
  AnalysisStats,
  ChainStats,
  ParseError,
  PolicyChain,
  PolicyFile,
  SchemaWarning,
} from '@policy-analyzer/shared';
import { classifyFile } from './classifier.js';
import { groupIntoChains } from './chains.js';
import { validateCrossReferences } from './cross-references.js';
import { lookupClaimTypeDocs, lookupTechnicalProfileDocs } from './documentation-catalog.js';
import { detectExternalDependencies } from './external-deps.js';
import {
  extractClaimsProviders,
  extractClaimsSchema,
  extractClaimsTransformations,
} from './extract-claims.js';
import { extractUserJourneys } from './extract-journeys.js';
import { extractLocalization } from './extract-localization.js';
import { extractTechnicalProfiles } from './extract-tps.js';
import { buildInheritanceGraph } from './inheritance.js';
import { resolveOverrides } from './overrides.js';
import { isParsedFile, parseFile } from './parser.js';
import { classifyTechnicalProfile } from './schema-catalog.js';
import type { AppSettings } from './settings-resolver.js';
import type { ExtractedFileEntities, ParsedFile, UploadedFile } from './types.js';
import { validateSchema } from './validate-schema.js';

export async function runAnalysis(
  files: UploadedFile[],
  appSettings: AppSettings | null = null,
): Promise<AnalysisResult> {
  const parsedByFileId = new Map<string, ParsedFile>();
  const extractedByFileId = new Map<string, ExtractedFileEntities>();
  const parseErrors: ParseError[] = [];

  const policyFiles = await Promise.all(
    files.map(async (file, index) => {
      const result = parseFile(file.buffer, file.fileName, file.relativePath);
      const id = `file-${index + 1}`;

      if (!isParsedFile(result)) {
        parseErrors.push(result);
        return {
          id,
          fileName: file.fileName,
          ...(file.relativePath ? { relativePath: file.relativePath } : {}),
          sizeBytes: file.sizeBytes,
          lastModified: file.lastModified,
          category: 'Error' as const,
          rawXml: file.buffer.toString('utf-8'),
          parsedAt: new Date().toISOString(),
          parseError: result.message,
        };
      }

      const policyFile: PolicyFile = {
        id,
        fileName: file.fileName,
        ...(file.relativePath ? { relativePath: file.relativePath } : {}),
        sizeBytes: file.sizeBytes,
        lastModified: file.lastModified,
        category: classifyFile(result),
        rawXml: result.rawXml,
        parsedAt: new Date().toISOString(),
      };

      copyOptional(policyFile, 'policyId', result.policyId);
      copyOptional(policyFile, 'tenantId', result.tenantId);
      copyOptional(policyFile, 'basePolicyId', result.basePolicyId);
      copyOptional(policyFile, 'basePolicyTenantId', result.basePolicyTenantId);

      parsedByFileId.set(id, result);
      return policyFile;
    }),
  );

  const parsedPolicyFiles = policyFiles.filter((file) => file.category !== 'Error');
  const graph = buildInheritanceGraph(parsedPolicyFiles);
  parseErrors.push(...graph.cycleErrors.map(({ error }) => error));

  const cycleErrorByFileId = new Map(
    graph.cycleErrors.map(({ fileId, error }) => [fileId, error.message] as const),
  );
  const normalizedPolicyFiles = policyFiles.map((file) => {
    const cycleMessage = cycleErrorByFileId.get(file.id);
    if (cycleMessage === undefined) return file;

    return {
      ...file,
      category: 'Error' as const,
      parseError: cycleMessage,
    };
  });

  const analyzableFiles = normalizedPolicyFiles.filter(
    (file) => file.category !== 'Error' && !graph.cycleFileIds.includes(file.id),
  );

  for (const file of analyzableFiles) {
    const parsed = parsedByFileId.get(file.id);
    if (parsed === undefined) continue;
    extractedByFileId.set(file.id, {
      technicalProfiles: extractTechnicalProfiles(parsed, file.id),
      journeys: extractUserJourneys(parsed, file.id),
      claimsSchema: extractClaimsSchema(parsed, file.id),
      claimsTransformations: extractClaimsTransformations(parsed, file.id),
      claimsProviders: extractClaimsProviders(parsed, file.id),
      localizations: extractLocalization(parsed, file.id),
    });
  }

  const fileById = new Map(normalizedPolicyFiles.map((file) => [file.id, file] as const));
  const finalized = groupIntoChains(analyzableFiles, graph, parsedByFileId).map((draftChain) =>
    finalizeChain(draftChain, extractedByFileId, fileById, appSettings),
  );
  const chains = finalized.map(({ chain }) => chain);
  const schemaWarnings = finalized.flatMap(({ schemaWarnings: chainWarnings }) => chainWarnings);

  return {
    sessionId: randomUUID(),
    uploadedAt: new Date().toISOString(),
    files: normalizedPolicyFiles,
    chains,
    orphanReferences: graph.orphanReferences,
    parseErrors,
    schemaWarnings,
    stats: computeStats(normalizedPolicyFiles, chains, schemaWarnings.length),
  };
}

function finalizeChain(
  draftChain: PolicyChain,
  extractedByFileId: Map<string, ExtractedFileEntities>,
  fileById: Map<string, PolicyFile>,
  appSettings: AppSettings | null,
): { chain: PolicyChain; schemaWarnings: SchemaWarning[] } {
  const resolved = resolveOverrides(draftChain, extractedByFileId);
  const resolvedTechnicalProfiles = resolved.resolvedTechnicalProfiles.map((profile) => ({
    ...profile,
    ...mapCatalogEntry(lookupTechnicalProfileDocs(profile.id)),
    protocolCategory: classifyTechnicalProfile(
      profile.protocol?.name,
      profile.protocol?.handler,
      profile.id,
    ),
  }));
  const resolvedClaimsSchema = resolved.resolvedClaimsSchema.map((entry) => ({
    ...entry,
    ...mapCatalogEntry(lookupClaimTypeDocs(entry.id)),
  }));
  const chain: PolicyChain = {
    ...draftChain,
    resolvedJourneys: resolved.resolvedJourneys,
    resolvedTechnicalProfiles,
    resolvedClaimsSchema,
    resolvedClaimsTransformations: resolved.resolvedClaimsTransformations,
    resolvedClaimsProviders: resolved.resolvedClaimsProviders,
    resolvedLocalizations: resolved.resolvedLocalizations,
    externalDependencies: detectExternalDependencies(
      resolvedTechnicalProfiles,
      appSettings,
      fileById,
    ),
    orphanReferences: [],
    stats: emptyChainStats(draftChain.fileIds.length),
  };

  chain.orphanReferences = validateCrossReferences(chain);
  const schemaWarnings = validateSchema(chain, fileById);
  chain.stats = computeChainStats(chain);
  return { chain, schemaWarnings };
}

function computeStats(
  files: PolicyFile[],
  chains: PolicyChain[],
  schemaWarningCount: number,
): AnalysisStats {
  const journeyIds = new Set<string>();
  const technicalProfileIds = new Set<string>();

  for (const chain of chains) {
    for (const journey of chain.resolvedJourneys) journeyIds.add(journey.id);
    for (const profile of chain.resolvedTechnicalProfiles) technicalProfileIds.add(profile.id);
  }

  return {
    policyChains: chains.length,
    filesAnalyzed: files.filter((file) => file.category !== 'Error').length,
    filesSkipped: files.filter((file) => file.category === 'Error').length,
    userJourneys: journeyIds.size,
    technicalProfiles: technicalProfileIds.size,
    externalDependencies: chains.reduce((sum, chain) => sum + chain.externalDependencies.length, 0),
    schemaWarningCount,
  };
}

function computeChainStats(chain: PolicyChain): ChainStats {
  return {
    fileCount: chain.fileIds.length,
    userJourneyCount: chain.resolvedJourneys.length,
    technicalProfileCount: chain.resolvedTechnicalProfiles.length,
    orchestrationStepCount: chain.resolvedJourneys.reduce(
      (sum, journey) => sum + journey.steps.length,
      0,
    ),
    externalDependencyCount: chain.externalDependencies.length,
  };
}

function emptyChainStats(fileCount: number): ChainStats {
  return {
    fileCount,
    userJourneyCount: 0,
    technicalProfileCount: 0,
    orchestrationStepCount: 0,
    externalDependencyCount: 0,
  };
}

function copyOptional<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function mapCatalogEntry(
  entry:
    | {
        description: string;
        docsUrl: string;
      }
    | undefined,
): {
  catalogDescription?: string;
  catalogDocsUrl?: string;
} {
  if (entry === undefined) {
    return {};
  }

  return {
    catalogDescription: entry.description,
    catalogDocsUrl: entry.docsUrl,
  };
}

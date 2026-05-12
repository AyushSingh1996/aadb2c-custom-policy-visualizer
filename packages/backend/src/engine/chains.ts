import { randomUUID } from 'node:crypto';
import type { ChainStats, PolicyChain, PolicyFile } from '@policy-analyzer/shared';
import type { InheritanceGraph, ParsedFile } from './types.js';
import { prettifyId } from '../util/prettify.js';
import { copyOptional } from './xml.js';

type ParsedLookup = Map<string, ParsedFile>;

export function groupIntoChains(
  files: PolicyFile[],
  graph: InheritanceGraph,
  parsedByFileId: ParsedLookup,
): PolicyChain[] {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const cycleFileIds = new Set(graph.cycleFileIds);

  return files
    .filter((file) => file.category === 'RelyingParty' && !cycleFileIds.has(file.id))
    .map((rpFile) => {
      const fileIds = collectLineage(rpFile.id, graph, fileById);
      const parsed = parsedByFileId.get(rpFile.id);
      const defaultUserJourneyId = findDefaultUserJourneyId(parsed);
      const chain: PolicyChain = {
        id: randomUUID(),
        name: deriveChainName(rpFile, parsed, defaultUserJourneyId),
        fileIds,
        rpFileId: rpFile.id,
        resolvedJourneys: [],
        resolvedTechnicalProfiles: [],
        resolvedClaimsSchema: [],
        resolvedClaimsTransformations: [],
        resolvedClaimsProviders: [],
        resolvedLocalizations: [],
        externalDependencies: [],
        orphanReferences: [],
        stats: emptyChainStats(fileIds.length),
      };

      copyOptional(chain, 'description', deriveChainDescription(parsed));
      copyOptional(chain, 'defaultUserJourneyId', defaultUserJourneyId);

      return chain;
    });
}

function collectLineage(
  startFileId: string,
  graph: InheritanceGraph,
  fileById: Map<string, PolicyFile>,
): string[] {
  const lineage: string[] = [];
  let currentFileId: string | undefined = startFileId;

  while (currentFileId !== undefined) {
    const file = fileById.get(currentFileId);
    if (file === undefined) break;
    lineage.push(currentFileId);
    currentFileId = graph.parentIds.get(currentFileId);
  }

  return lineage.reverse();
}

function deriveChainName(
  rpFile: PolicyFile,
  parsed: ParsedFile | undefined,
  defaultUserJourneyId: string | undefined,
): string {
  const mfaJourneyId = findMfaJourneyId(parsed);
  if (mfaJourneyId !== undefined) {
    return `${prettifyId(mfaJourneyId)} Flow`;
  }

  if (defaultUserJourneyId !== undefined) {
    return `${prettifyId(defaultUserJourneyId)} Flow`;
  }

  if (rpFile.policyId !== undefined) {
    const prettifiedPolicyId = prettifyId(rpFile.policyId);
    if (prettifiedPolicyId !== '') return prettifiedPolicyId;
  }

  const fileStem = rpFile.fileName.replace(/\.[^.]+$/, '');
  return prettifyId(fileStem) || fileStem;
}

function deriveChainDescription(parsed: ParsedFile | undefined): string | undefined {
  const rp = getRelyingParty(parsed);
  const endpointDescription = firstNonEmptyString(
    readNode(rp, ['Endpoints', 'Endpoint', 'Description']),
  );
  if (endpointDescription !== undefined) return endpointDescription;

  return firstNonEmptyString(
    readNode(rp, ['UserJourneyBehaviors', 'JourneyInsights', 'Description']),
  );
}

function findDefaultUserJourneyId(parsed: ParsedFile | undefined): string | undefined {
  const rp = getRelyingParty(parsed);
  const defaultUserJourney = readNode(rp, ['DefaultUserJourney']);
  return firstNonEmptyString([
    readAttr(defaultUserJourney, 'ReferenceId'),
    readNode(defaultUserJourney, ['ReferenceId']),
  ]);
}

function findMfaJourneyId(parsed: ParsedFile | undefined): string | undefined {
  const rp = getRelyingParty(parsed);
  const mfa = readNode(rp, ['UserJourneyBehaviors', 'MultiFactorAuthentication']);
  return firstNonEmptyString([
    readAttr(mfa, 'ReferenceId'),
    readNode(mfa, ['ReferenceId']),
    readNode(mfa, ['UserJourneyReferenceId']),
    readNode(mfa, ['JourneyId']),
  ]);
}

function getRelyingParty(parsed: ParsedFile | undefined): unknown {
  return parsed?.ast['RelyingParty'];
}

function readNode(root: unknown, path: string[]): unknown {
  let current = root;
  for (const segment of path) {
    if (current == null) return undefined;
    if (Array.isArray(current)) {
      current = current[0];
    }
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function readAttr(node: unknown, attrName: string): unknown {
  if (node == null) return undefined;
  if (Array.isArray(node)) return readAttr(node[0], attrName);
  if (typeof node !== 'object') return undefined;
  return (node as Record<string, unknown>)[`@_${attrName}`];
}

function firstNonEmptyString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = firstNonEmptyString(item);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return undefined;
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

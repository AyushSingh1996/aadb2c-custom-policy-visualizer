import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PolicyChain, PolicyFile } from '@policy-analyzer/shared';
import { classifyFile } from './classifier.js';
import { extractClaimsProviders, extractClaimsSchema, extractClaimsTransformations } from './extract-claims.js';
import { extractUserJourneys } from './extract-journeys.js';
import { extractLocalization } from './extract-localization.js';
import { extractTechnicalProfiles } from './extract-tps.js';
import { buildInheritanceGraph } from './inheritance.js';
import { resolveOverrides } from './overrides.js';
import { parseFile, isParsedFile } from './parser.js';
import { groupIntoChains } from './chains.js';
import type { ExtractedFileEntities, ParsedFile } from './types.js';

describe('resolveOverrides', () => {
  it('keeps non-overridden base technical profiles without override flags', () => {
    const resolved = loadOverrideScenario();
    const helper = resolved.resolvedTechnicalProfiles.find((tp) => tp.id === 'Base-Helper');

    expect(helper).toMatchObject({
      isOverride: false,
      resolvedFromMerge: false,
      definedInFileId: resolved.chain.fileIds[0],
    });
  });

  it('merges TP metadata across the chain without losing untouched keys', () => {
    const resolved = loadOverrideScenario();
    const shared = findProfile(resolved.chain, resolved.resolvedTechnicalProfiles, 'TP-Shared');

    expect(shared.metadata).toEqual({
      A: 'extension-one',
      B: 'rp-two',
    });
  });

  it('replaces the Protocol element instead of merging it', () => {
    const resolved = loadOverrideScenario();
    const profile = findProfile(resolved.chain, resolved.resolvedTechnicalProfiles, 'Protocol-Swap');

    expect(profile.protocol).toEqual({
      name: 'Proprietary',
      handler: 'ExtensionHandler',
    });
  });

  it('fully replaces a user journey when the RP redefines it', () => {
    const resolved = loadOverrideScenario();
    const journey = resolved.resolvedJourneys.find((item) => item.id === 'SignIn');

    expect(journey?.steps).toHaveLength(1);
    expect(journey?.steps[0]?.claimsExchanges).toEqual([
      { id: 'RpExchange', technicalProfileReferenceId: 'TP-Shared' },
    ]);
    expect(journey?.isOverride).toBe(true);
  });

  it('uses the extension claim default value when a child overrides it', () => {
    const resolved = loadOverrideScenario();
    const shared = findProfile(resolved.chain, resolved.resolvedTechnicalProfiles, 'TP-Shared');
    const emailClaim = shared.inputClaims.find((claim) => claim.claimTypeReferenceId === 'email');

    expect(emailClaim?.defaultValue).toBe('extension@example.com');
  });

  it('preserves extension-only claims referenced by descendant technical profiles', () => {
    const resolved = loadOverrideScenario();
    const shared = findProfile(resolved.chain, resolved.resolvedTechnicalProfiles, 'TP-Shared');

    expect(shared.outputClaims.some((claim) => claim.claimTypeReferenceId === 'extension_loyaltyId')).toBe(
      true,
    );
  });

  it('replaces cryptographic keys when the child specifies new ones', () => {
    const resolved = loadOverrideScenario();
    const shared = findProfile(resolved.chain, resolved.resolvedTechnicalProfiles, 'TP-Shared');

    expect(shared.cryptographicKeys).toEqual([
      { id: 'issuer_secret', storageReferenceId: 'B2C_1A_RpSecret' },
    ]);
    expect(shared.isOverride).toBe(true);
    expect(shared.resolvedFromMerge).toBe(true);
  });
});

function loadOverrideScenario(): {
  chain: PolicyChain;
  resolvedTechnicalProfiles: ReturnType<typeof resolveOverrides>['resolvedTechnicalProfiles'];
  resolvedJourneys: ReturnType<typeof resolveOverrides>['resolvedJourneys'];
} {
  const fixtureDir = fileURLToPath(new URL('../../tests/fixtures/override', import.meta.url));
  const fileNames = readdirSync(fixtureDir).filter((name) => name.endsWith('.xml')).sort();

  const parsedByFileId = new Map<string, ParsedFile>();
  const extractedByFileId = new Map<string, ExtractedFileEntities>();
  const policyFiles: PolicyFile[] = [];

  for (const [index, fileName] of fileNames.entries()) {
    const filePath = join(fixtureDir, fileName);
    const buffer = readFileSync(filePath);
    const stats = statSync(filePath);
    const result = parseFile(buffer, fileName);
    if (!isParsedFile(result)) {
      throw new Error(`Fixture ${fileName} failed to parse: ${result.message}`);
    }

    const id = `file-${index + 1}`;
    const policyFile: PolicyFile = {
      id,
      fileName,
      sizeBytes: stats.size,
      lastModified: stats.mtime.toISOString(),
      category: classifyFile(result),
      rawXml: result.rawXml,
      parsedAt: '2026-04-28T00:00:00.000Z',
    };
    policyFile.policyId = result.policyId;
    policyFile.tenantId = result.tenantId;
    if (result.basePolicyId !== undefined) {
      policyFile.basePolicyId = result.basePolicyId;
    }
    if (result.basePolicyTenantId !== undefined) {
      policyFile.basePolicyTenantId = result.basePolicyTenantId;
    }

    policyFiles.push(policyFile);
    parsedByFileId.set(id, result);
    extractedByFileId.set(id, {
      technicalProfiles: extractTechnicalProfiles(result, id),
      journeys: extractUserJourneys(result, id),
      claimsSchema: extractClaimsSchema(result, id),
      claimsTransformations: extractClaimsTransformations(result, id),
      claimsProviders: extractClaimsProviders(result, id),
      localizations: extractLocalization(result, id),
    });
  }

  const graph = buildInheritanceGraph(policyFiles);
  const chain = groupIntoChains(policyFiles, graph, parsedByFileId)[0];
  if (chain === undefined) throw new Error('Override fixture did not produce a chain');

  const resolved = resolveOverrides(chain, extractedByFileId);
  return {
    chain,
    resolvedTechnicalProfiles: resolved.resolvedTechnicalProfiles,
    resolvedJourneys: resolved.resolvedJourneys,
  };
}

function findProfile(chain: PolicyChain, profiles: ReturnType<typeof resolveOverrides>['resolvedTechnicalProfiles'], id: string) {
  const profile = profiles.find((item) => item.id === id);
  if (profile === undefined) {
    throw new Error(`Expected profile ${id} in chain ${chain.name}`);
  }
  return profile;
}

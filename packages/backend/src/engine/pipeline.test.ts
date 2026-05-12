import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runAnalysis } from './pipeline.js';
import type { UploadedFile } from './types.js';

describe('runAnalysis', () => {
  it('returns a complete analysis result for the bundled sample set', async () => {
    const result = await runAnalysis(loadDir('../../samples'));
    const fileById = new Map(result.files.map((file) => [file.id, file] as const));
    const chainLineages = result.chains.map((chain) =>
      chain.fileIds.map((fileId) => fileById.get(fileId)?.fileName ?? fileId),
    );
    const longestJourneyLength = Math.max(
      ...result.chains.flatMap((chain) =>
        chain.resolvedJourneys.map((journey) => journey.steps.length),
      ),
    );

    expect(result.chains).toHaveLength(12);
    expect(result.stats.policyChains).toBe(12);
    expect(result.stats.filesAnalyzed).toBe(20);
    expect(result.stats.userJourneys).toBe(12);
    expect(result.parseErrors).toEqual([]);
    expect(result.stats.schemaWarningCount).toBe(result.schemaWarnings.length);
    expect(result.stats.externalDependencies).toBeGreaterThan(0);
    expect(longestJourneyLength).toBeGreaterThanOrEqual(5);
    expect(
      chainLineages.filter((lineage) =>
        lineage.includes('TrustFrameworkExtensions-LocalAccounts-MFA.xml'),
      ),
    ).toHaveLength(4);
    expect(
      chainLineages.filter((lineage) =>
        lineage.includes('TrustFrameworkExtensions-LocalAccounts-Profile.xml'),
      ),
    ).toHaveLength(3);
    expect(
      chainLineages.filter((lineage) =>
        lineage.includes('TrustFrameworkExtensions-SocialAccounts-Linking.xml'),
      ),
    ).toHaveLength(2);
    expect(
      chainLineages.filter((lineage) =>
        lineage.includes('TrustFrameworkExtensions-B2B-Invitations.xml'),
      ),
    ).toHaveLength(2);
    expect(
      chainLineages.filter((lineage) =>
        lineage.includes('TrustFrameworkExtensions-B2B-StepUpMFA.xml'),
      ),
    ).toHaveLength(1);

    const restfulProfile = result.chains
      .flatMap((chain) => chain.resolvedTechnicalProfiles)
      .find((profile) => profile.id === 'REST-LinkSocialAccount');
    expect(restfulProfile?.protocolCategory).toBe('REST_API');
  });

  it('keeps malformed files in parseErrors while still analyzing valid input', async () => {
    const result = await runAnalysis([
      ...loadDir('../../tests/fixtures/clean'),
      ...loadDir('../../tests/fixtures/malformed'),
    ]);

    expect(result.parseErrors.length).toBe(1);
    expect(result.files.some((file) => file.category === 'Error')).toBe(true);
    expect(result.chains).toHaveLength(1);
  });

  it('preserves relative paths on parse errors for malformed files', async () => {
    const result = await runAnalysis(
      loadDir('../../tests/fixtures/malformed', {
        rootDir: 'tenant-a',
      }),
    );

    expect(result.parseErrors).toHaveLength(1);
    expect(result.parseErrors[0]?.relativePath).toBe('tenant-a/Broken.xml');
  });

  it('surfaces unresolved base policy references without aborting chain construction', async () => {
    const result = await runAnalysis(
      loadDir('../../tests/fixtures/missing-base', {
        rootDir: 'tenant-a',
      }),
    );

    expect(result.orphanReferences).toHaveLength(1);
    expect(result.chains).toHaveLength(1);
    expect(result.chains[0]?.fileIds).toHaveLength(2);
    expect(result.orphanReferences[0]?.message).toContain(
      'tenant-a/TrustFrameworkExtensions.xml',
    );
  });

  it('excludes cyclic files from chains and reports cycle parse errors', async () => {
    const result = await runAnalysis(
      loadDir('../../tests/fixtures/cycle', {
        rootDir: 'tenant-a',
      }),
    );

    expect(result.chains).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(2);
    expect(result.files.every((file) => file.category === 'Error')).toBe(true);
    expect(result.parseErrors[0]?.message).toContain('tenant-a/A.xml');
    expect(result.parseErrors[0]?.message).toContain('tenant-a/B.xml');
  });

  it('annotates clean fixture technical profiles with protocol categories', async () => {
    const result = await runAnalysis(loadDir('../../tests/fixtures/clean'));
    const technicalProfiles = result.chains.flatMap((chain) => chain.resolvedTechnicalProfiles);
    const claims = result.chains.flatMap((chain) => chain.resolvedClaimsSchema);

    expect(
      technicalProfiles.find((profile) => profile.id === 'REST-GetLoyaltyId')?.protocolCategory,
    ).toBe('REST_API');
    expect(technicalProfiles.find((profile) => profile.id === 'JwtIssuer')?.protocolCategory).toBe(
      'OIDC_IDP',
    );
    expect(technicalProfiles.find((profile) => profile.id === 'REST-GetLoyaltyId')).toMatchObject({
      catalogDescription: expect.any(String),
      catalogDocsUrl: expect.stringMatching(/^https:\/\//),
    });
    expect(claims.find((claim) => claim.id === 'email')).toMatchObject({
      catalogDescription: expect.any(String),
      catalogDocsUrl: expect.stringMatching(/^https:\/\//),
    });
    expect(result.schemaWarnings).toEqual([]);
    expect(result.stats.schemaWarningCount).toBe(0);
  });

  it('surfaces structural schema warnings for invalid fixture data', async () => {
    const result = await runAnalysis(loadDir('../../tests/fixtures/schema-errors'));
    const warningCodes = result.schemaWarnings.map((warning) => warning.code);

    expect(result.schemaWarnings).toHaveLength(3);
    expect(warningCodes).toEqual(
      expect.arrayContaining([
        'INVALID_PROTOCOL_NAME',
        'INVALID_DATA_TYPE',
        'INVALID_TRANSFORMATION_METHOD',
      ]),
    );
    expect(result.stats.schemaWarningCount).toBe(3);
  });
});

function loadDir(
  relativeDir: string,
  options: { rootDir?: string } = {},
): UploadedFile[] {
  const dir = fileURLToPath(new URL(relativeDir, import.meta.url));
  return readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.xml'))
    .sort()
    .map((fileName) => {
      const filePath = join(dir, fileName);
      const stats = statSync(filePath);
      return {
        fileName,
        ...(options.rootDir ? { relativePath: `${options.rootDir}/${fileName}` } : {}),
        buffer: readFileSync(filePath),
        sizeBytes: stats.size,
        lastModified: stats.mtime.toISOString(),
      };
    });
}

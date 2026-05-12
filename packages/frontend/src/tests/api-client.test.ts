import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AnalysisResult } from '@policy-analyzer/shared';
import { analyze, fetchSample } from '../api/client.js';
import type { SelectedUploadFile } from '../lib/upload.js';

const mockResult: AnalysisResult = {
  sessionId: 'session-1',
  uploadedAt: '2026-04-28T00:00:00.000Z',
  files: [],
  chains: [],
  orphanReferences: [],
  parseErrors: [],
  schemaWarnings: [],
  stats: {
    policyChains: 0,
    filesAnalyzed: 0,
    filesSkipped: 0,
    userJourneys: 0,
    technicalProfiles: 0,
    externalDependencies: 0,
    schemaWarningCount: 0,
  },
};

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('analyze posts the selected files and optional appsettings to the analyze endpoint', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(mockResult), { status: 200 }));
    const file = new File(['<xml />'], 'TrustFrameworkBase.xml', { type: 'application/xml' });
    const appSettings = new File(['{}'], 'appsettings.json', { type: 'application/json' });
    const selectedFiles: SelectedUploadFile[] = [
      { file, relativePath: 'tenant-a/TrustFrameworkBase.xml' },
    ];

    const result = await analyze(selectedFiles, appSettings);

    expect(result.sessionId).toBe('session-1');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/analyze',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );

    const [, requestInit] = fetchSpy.mock.calls[0] ?? [];
    const body = requestInit?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).getAll('files')).toHaveLength(1);
    expect((body as FormData).get('fileManifest')).toBe(
      JSON.stringify([{ relativePath: 'tenant-a/TrustFrameworkBase.xml' }]),
    );
    expect((body as FormData).get('appsettings')).toMatchObject({
      name: 'appsettings.json',
      type: 'application/json',
    });
  });

  test('fetchSample maps backend 5xx responses to the generic analysis failure copy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'INTERNAL_ERROR', message: 'sample failed' }), {
        status: 500,
      }),
    );

    await expect(fetchSample()).rejects.toThrow(
      'Analysis failed unexpectedly. Please try again or report this.',
    );
  });

  test('analyze maps network failures to the backend unreachable copy', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));
    const file = new File(['<xml />'], 'TrustFrameworkBase.xml', { type: 'application/xml' });

    await expect(analyze([{ file }])).rejects.toThrow(
      'Cannot reach the analysis service. Please try again.',
    );
  });
});

import { beforeEach, describe, expect, test } from 'vitest';
import type { AnalysisResult } from '@policy-analyzer/shared';
import { createInitialAnalysisState, useAnalysisStore } from '../store/analysis.js';

const mockResult: AnalysisResult = {
  sessionId: 'session-2',
  uploadedAt: '2026-04-28T00:00:00.000Z',
  files: [],
  chains: [],
  orphanReferences: [],
  parseErrors: [],
  schemaWarnings: [
    {
      code: 'INVALID_PROTOCOL_NAME',
      message: 'unsupported protocol',
      entityId: 'TP-1',
      entityType: 'TechnicalProfile',
      fileId: 'file-1',
    },
  ],
  stats: {
    policyChains: 1,
    filesAnalyzed: 3,
    filesSkipped: 0,
    userJourneys: 2,
    technicalProfiles: 4,
    externalDependencies: 0,
    schemaWarningCount: 1,
  },
};

describe('analysis store', () => {
  beforeEach(() => {
    useAnalysisStore.setState({
      ...createInitialAnalysisState(),
      setResult: useAnalysisStore.getState().setResult,
      clearResult: useAnalysisStore.getState().clearResult,
      setAnalyzing: useAnalysisStore.getState().setAnalyzing,
      setError: useAnalysisStore.getState().setError,
    });
  });

  test('stores and clears analysis results', () => {
    useAnalysisStore.getState().setResult(mockResult);
    expect(useAnalysisStore.getState().result?.sessionId).toBe('session-2');
    expect(useAnalysisStore.getState().schemaWarnings).toHaveLength(1);

    useAnalysisStore.getState().clearResult();
    expect(useAnalysisStore.getState().result).toBeNull();
    expect(useAnalysisStore.getState().schemaWarnings).toEqual([]);
    expect(useAnalysisStore.getState().error).toBeNull();
  });

  test('tracks analyzing and error state', () => {
    useAnalysisStore.getState().setAnalyzing(true);
    useAnalysisStore.getState().setError('backend unavailable');

    expect(useAnalysisStore.getState().isAnalyzing).toBe(true);
    expect(useAnalysisStore.getState().error).toBe('backend unavailable');
  });
});

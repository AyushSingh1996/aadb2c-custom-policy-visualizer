import type { AnalysisResult } from '@policy-analyzer/shared';
import { create } from 'zustand';

export interface AnalysisState {
  result: AnalysisResult | null;
  schemaWarnings: AnalysisResult['schemaWarnings'];
  isAnalyzing: boolean;
  error: string | null;
  setResult: (result: AnalysisResult | null) => void;
  clearResult: () => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  setError: (error: string | null) => void;
}

export function createInitialAnalysisState() {
  return {
    result: null,
    schemaWarnings: [],
    isAnalyzing: false,
    error: null,
  };
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...createInitialAnalysisState(),
  setResult: (result) => set({ result, schemaWarnings: result?.schemaWarnings ?? [] }),
  clearResult: () => set({ result: null, schemaWarnings: [], error: null, isAnalyzing: false }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setError: (error) => set({ error }),
}));

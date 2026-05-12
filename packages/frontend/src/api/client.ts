import type { AnalysisResult } from '@policy-analyzer/shared';
import type { SelectedUploadFile } from '../lib/upload.js';

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  if (response.status >= 500) {
    throw new Error('Analysis failed unexpectedly. Please try again or report this.');
  }

  let message = `Request failed with status ${response.status}.`;

  try {
    const payload = (await response.json()) as ApiErrorPayload;
    if (typeof payload.message === 'string' && payload.message.length > 0) {
      message = payload.message;
    }
  } catch {
    // Fall back to the HTTP status message if the backend payload is unavailable.
    if (response.statusText) {
      message = response.statusText;
    }
  }

  throw new Error(message);
}

export async function analyze(
  files: SelectedUploadFile[],
  appSettingsFile?: File | null,
): Promise<AnalysisResult> {
  const formData = new FormData();
  const shouldIncludeManifest = files.some((file) => file.relativePath !== undefined);

  for (const file of files) {
    formData.append('files', file.file, file.file.name);
  }
  if (shouldIncludeManifest) {
    formData.append(
      'fileManifest',
      JSON.stringify(
        files.map((file) => (file.relativePath ? { relativePath: file.relativePath } : {})),
      ),
    );
  }
  if (appSettingsFile) {
    formData.append('appsettings', appSettingsFile, appSettingsFile.name);
  }

  let response: Response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error('Cannot reach the analysis service. Please try again.');
  }

  return parseJsonResponse<AnalysisResult>(response);
}

export async function fetchSample(): Promise<AnalysisResult> {
  let response: Response;
  try {
    response = await fetch('/api/sample', {
      method: 'GET',
    });
  } catch {
    throw new Error('Cannot reach the analysis service. Please try again.');
  }

  return parseJsonResponse<AnalysisResult>(response);
}

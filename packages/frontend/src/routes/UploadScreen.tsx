import type { PolicyFile } from '@policy-analyzer/shared';
import { AlertTriangle, FlaskConical, LoaderCircle, Settings2, Trash2, X } from 'lucide-react';
import { type ChangeEvent, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyze, fetchSample } from '../api/client.js';
import { DetectedFilesTable } from '../components/DetectedFilesTable.js';
import { DropZone } from '../components/DropZone.js';
import { EmptyState } from '../components/EmptyState.js';
import {
  hasRelyingPartyFile,
  mergeFiles,
  type SelectedUploadFile,
  validateFilesForUpload,
} from '../lib/upload.js';
import { useAnalysisStore } from '../store/analysis.js';

function detectTableFiles(resultFiles: PolicyFile[] | undefined): PolicyFile[] {
  return resultFiles ?? [];
}

interface UploadNotice {
  tone: 'warning' | 'error';
  message: string;
}

export function UploadScreen(): JSX.Element {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<SelectedUploadFile[]>([]);
  const [appSettingsFile, setAppSettingsFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<UploadNotice | null>(null);
  const appSettingsInputRef = useRef<HTMLInputElement | null>(null);
  const result = useAnalysisStore((state) => state.result);
  const isAnalyzing = useAnalysisStore((state) => state.isAnalyzing);
  const error = useAnalysisStore((state) => state.error);
  const setResult = useAnalysisStore((state) => state.setResult);
  const clearResult = useAnalysisStore((state) => state.clearResult);
  const setAnalyzing = useAnalysisStore((state) => state.setAnalyzing);
  const setError = useAnalysisStore((state) => state.setError);

  const tableFiles = useMemo(() => detectTableFiles(result?.files), [result?.files]);
  const canAnalyze = result !== null && hasRelyingPartyFile(tableFiles);
  const appSettingsError = error && error.toLowerCase().includes('appsettings.json') ? error : null;
  const generalError = appSettingsError ? null : error;

  const runPreviewAnalysis = useCallback(
    async (files: SelectedUploadFile[], currentAppSettingsFile: File | null) => {
      setAnalyzing(true);
      setError(null);

      try {
        const analysisResult = await analyze(files, currentAppSettingsFile);
        setResult(analysisResult);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : 'Analysis failed unexpectedly.';
        setError(message);
      } finally {
        setAnalyzing(false);
      }
    },
    [setAnalyzing, setError, setResult],
  );

  const handleFilesSelected = useCallback(
    async (incomingFiles: SelectedUploadFile[]) => {
      const validation = validateFilesForUpload(selectedFiles, incomingFiles);
      if (validation.errors.length > 0) {
        setNotice({ tone: 'warning', message: validation.errors.join(' ') });
      } else {
        setNotice(null);
      }

      if (validation.acceptedFiles.length === 0) {
        return;
      }

      const mergedFiles = mergeFiles(selectedFiles, validation.acceptedFiles);
      setSelectedFiles(mergedFiles);
      await runPreviewAnalysis(mergedFiles, appSettingsFile);
    },
    [appSettingsFile, runPreviewAnalysis, selectedFiles, setError],
  );

  const handleAppSettingsSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] ?? null;
      setAppSettingsFile(nextFile);
      setError(null);

      if (selectedFiles.length > 0) {
        await runPreviewAnalysis(selectedFiles, nextFile);
      }
    },
    [runPreviewAnalysis, selectedFiles, setError],
  );

  const handleClearAppSettings = useCallback(async () => {
    setAppSettingsFile(null);
    setError(null);
    if (appSettingsInputRef.current) {
      appSettingsInputRef.current.value = '';
    }

    if (selectedFiles.length > 0) {
      await runPreviewAnalysis(selectedFiles, null);
    }
  }, [runPreviewAnalysis, selectedFiles, setError]);

  const handleTrySample = useCallback(async () => {
    setAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await fetchSample();
      setSelectedFiles([]);
      setAppSettingsFile(null);
      setResult(analysisResult);
      setNotice(null);
      navigate('/map');
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Analysis failed unexpectedly. Please try again or report this.';
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  }, [navigate, setAnalyzing, setError, setResult]);

  const handleClearAll = useCallback(() => {
    setSelectedFiles([]);
    setAppSettingsFile(null);
    setNotice(null);
    setError(null);
    if (appSettingsInputRef.current) {
      appSettingsInputRef.current.value = '';
    }
    clearResult();
  }, [clearResult, setError]);

  return (
    <section className="screen-shell upload-screen__content">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Upload Policy Files</h1>
          <p className="page-header__subtitle">
            Upload your Azure AD B2C custom policy XML files or nested folders to analyze their
            relationships and structure.
          </p>
        </div>
      </header>

      {notice ? (
        <div className={`message-banner message-banner--${notice.tone}`} role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{notice.message}</span>
        </div>
      ) : null}

      {generalError ? (
        <div className="message-banner message-banner--error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{generalError}</span>
        </div>
      ) : null}

      <DropZone disabled={isAnalyzing} onFilesSelected={handleFilesSelected} />

      <section className="surface-card upload-appsettings">
        <div className="upload-appsettings__header">
          <div className="upload-appsettings__copy">
            <h2 className="upload-appsettings__title">Optional: appsettings.json</h2>
            <p className="support-copy">
              Upload your appsettings.json to resolve {'{Settings:*}'} placeholders in external
              dependency URLs. Folder uploads do not auto-detect this file.
            </p>
          </div>
          <div className="upload-appsettings__actions">
            <input
              ref={appSettingsInputRef}
              type="file"
              accept=".json,application/json"
              className="upload-appsettings__input"
              data-upload-input="appsettings"
              onChange={(event) => void handleAppSettingsSelected(event)}
            />
            <button
              type="button"
              className="button button--secondary"
              onClick={() => appSettingsInputRef.current?.click()}
              disabled={isAnalyzing}
            >
              <Settings2 size={16} aria-hidden="true" />
              <span>Select appsettings.json</span>
            </button>
          </div>
        </div>

        {appSettingsFile ? (
          <div className="upload-appsettings__selected">
            <span className="upload-appsettings__chip">{appSettingsFile.name}</span>
            <button
              type="button"
              className="button button--ghost upload-appsettings__clear"
              onClick={() => void handleClearAppSettings()}
              disabled={isAnalyzing}
            >
              <X size={14} aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>
        ) : null}

        {appSettingsError ? (
          <div className="upload-appsettings__error" role="alert">
            {appSettingsError}
          </div>
        ) : null}
      </section>

      <div>
        <button
          type="button"
          className="inline-link"
          onClick={() => void handleTrySample()}
          aria-disabled={isAnalyzing}
        >
          {isAnalyzing ? <LoaderCircle size={16} className="spin" /> : <FlaskConical size={16} />}
          <span>Try with sample policies</span>
        </button>
      </div>

      {tableFiles.length > 0 ? (
        <section className="screen-shell">
          <div className="section-header">
            <h2 className="section-header__title">Detected Files ({tableFiles.length})</h2>
            <button type="button" className="button button--ghost" onClick={handleClearAll}>
              <Trash2 size={16} aria-hidden="true" />
              <span>Clear All</span>
            </button>
          </div>
          <DetectedFilesTable files={tableFiles} />
        </section>
      ) : (
        <EmptyState
          icon={<FlaskConical size={26} />}
          title="No files detected yet"
          subtitle="Upload one or more XML policies, select a policy folder, or load the bundled sample set to preview classification results."
        />
      )}

      <div className="page-header__actions">
        <button
          type="button"
          className="button button--secondary"
          aria-disabled="true"
          title="Export available in a future release."
        >
          Export Map
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            if (canAnalyze && !isAnalyzing) {
              navigate('/map');
            }
          }}
          aria-disabled={!canAnalyze || isAnalyzing}
          title={
            canAnalyze ? undefined : 'Upload at least one Relying Party file to enable analysis.'
          }
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Policies'}
        </button>
      </div>
    </section>
  );
}

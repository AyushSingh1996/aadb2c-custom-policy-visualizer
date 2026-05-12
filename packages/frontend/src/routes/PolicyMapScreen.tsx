import { ScanSearch, Search, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.js';
import { PolicyMapGraph } from '../components/PolicyMapGraph.js';
import { StatCard } from '../components/StatCard.js';
import { WarningBanner } from '../components/WarningBanner.js';
import { buildPolicyMapSections } from '../lib/analysis-view.js';
import { useAnalysisStore } from '../store/analysis.js';

export function PolicyMapScreen(): JSX.Element {
  const result = useAnalysisStore((state) => state.result);
  const schemaWarnings = useAnalysisStore((state) => state.schemaWarnings);
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(1);

  if (!result) {
    return <Navigate to="/" replace />;
  }

  const sections = useMemo(
    () => buildPolicyMapSections(result.chains, result.files, result.orphanReferences),
    [result.chains, result.files, result.orphanReferences],
  );
  const allBaseIds = useMemo(() => sections.map((section) => section.baseFile.id), [sections]);
  const allExtensionIds = useMemo(
    () =>
      sections.flatMap((section) =>
        section.extensions.map((extension) => extension.extensionFile.id),
      ),
    [sections],
  );
  const [expandedBaseIds, setExpandedBaseIds] = useState<Set<string>>(() => new Set());
  const [expandedExtensionIds, setExpandedExtensionIds] = useState<Set<string>>(() => new Set());
  const baseFileCount = result.files.filter((file) => file.category === 'Base').length;
  const extensionFileCount = result.files.filter((file) => file.category === 'Extension').length;
  const rpFileCount = result.files.filter((file) => file.category === 'RelyingParty').length;
  const totalGraphNodeCount = baseFileCount + extensionFileCount + rpFileCount;

  useEffect(() => {
    setExpandedBaseIds(new Set());
    setExpandedExtensionIds(new Set());
    setZoom(1);
  }, [result.sessionId]);

  function handleToggleBase(baseId: string): void {
    const section = sections.find((entry) => entry.baseFile.id === baseId);
    const childExtensionIds =
      section?.extensions.map((extension) => extension.extensionFile.id) ?? [];
    const isExpanded = expandedBaseIds.has(baseId);

    setExpandedBaseIds((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.delete(baseId);
      } else {
        next.add(baseId);
      }
      return next;
    });

    if (isExpanded) {
      setExpandedExtensionIds((extensions) => {
        const nextExtensions = new Set(extensions);
        for (const extensionId of childExtensionIds) {
          nextExtensions.delete(extensionId);
        }
        return nextExtensions;
      });
    }
  }

  function handleToggleExtension(extensionId: string): void {
    setExpandedExtensionIds((current) => {
      const next = new Set(current);
      if (next.has(extensionId)) {
        next.delete(extensionId);
      } else {
        next.add(extensionId);
      }
      return next;
    });
  }

  function handleExpandAll(): void {
    setExpandedBaseIds(new Set(allBaseIds));
    setExpandedExtensionIds(new Set(allExtensionIds));
    setZoom(1);
  }

  function handleCollapseAll(): void {
    setExpandedBaseIds(new Set());
    setExpandedExtensionIds(new Set());
    setZoom(1);
  }

  return (
    <section className="screen-shell">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Policy Map</h1>
          <p className="page-header__subtitle">
            Visual overview of policy chains and their relationships.
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="button button--secondary"
            aria-disabled="true"
            title="Export available in a future release."
          >
            Export Map
          </button>
        </div>
      </header>

      {result.orphanReferences.length > 0 ? (
        <WarningBanner
          message={`${result.orphanReferences.length} unresolved file reference${
            result.orphanReferences.length === 1 ? '' : 's'
          } detected.`}
        />
      ) : null}

      {schemaWarnings.length > 0 ? <WarningBanner schemaWarnings={schemaWarnings} /> : null}

      {result.parseErrors.length > 0 ? (
        <WarningBanner
          message={`${result.parseErrors.length} file${
            result.parseErrors.length === 1 ? '' : 's'
          } could not be parsed and ${result.parseErrors.length === 1 ? 'was' : 'were'} marked as errors.`}
        />
      ) : null}

      {totalGraphNodeCount > 100 ? (
        <WarningBanner message="Large policy map detected. Use Expand All, Collapse All, or Fit to View to navigate the graph efficiently." />
      ) : null}

      <div className="stats-grid stats-grid--policy-map">
        <StatCard label="Base Files" value={baseFileCount} />
        <StatCard label="Extension Files" value={extensionFileCount} />
        <StatCard label="Relying Party Files" value={rpFileCount} />
        <StatCard label="User Journeys" value={result.stats.userJourneys} />
        <StatCard label="Technical Profiles" value={result.stats.technicalProfiles} />
      </div>

      <section className="surface-card map-panel">
        <div className="map-panel__header">
          <div className="map-panel__legend">
            <LegendItem label="Base File" color="var(--color-base)" />
            <LegendItem label="Extension File" color="var(--color-extension)" />
            <LegendItem label="Relying Party File" color="var(--color-rp)" />
          </div>

          <div className="map-panel__controls">
            <button
              type="button"
              className="map-panel__control map-panel__control--text"
              onClick={handleExpandAll}
              title="Expand all policy branches"
            >
              <span>Expand All</span>
            </button>
            <button
              type="button"
              className="map-panel__control map-panel__control--text"
              onClick={handleCollapseAll}
              title="Collapse all policy branches"
            >
              <span>Collapse All</span>
            </button>
            <button
              type="button"
              className="map-panel__control map-panel__control--text"
              onClick={() => setZoom(1)}
              title="Fit to View"
            >
              <ScanSearch size={16} aria-hidden="true" />
              <span>Fit to View</span>
            </button>
            <button
              type="button"
              className="map-panel__control"
              onClick={() =>
                setZoom((current) => Math.max(0.8, Number((current - 0.1).toFixed(2))))
              }
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <div className="map-panel__zoom-readout">{Math.round(zoom * 100)}%</div>
            <button
              type="button"
              className="map-panel__control"
              onClick={() =>
                setZoom((current) => Math.min(1.3, Number((current + 0.1).toFixed(2))))
              }
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {sections.length > 0 ? (
          <div className="map-panel__body">
            <PolicyMapGraph
              sections={sections}
              zoom={zoom}
              expandedBaseIds={expandedBaseIds}
              expandedExtensionIds={expandedExtensionIds}
              onToggleBase={handleToggleBase}
              onToggleExtension={handleToggleExtension}
              onSelectChain={(chainId) => navigate(`/detail/${chainId}`)}
            />
          </div>
        ) : (
          <EmptyState
            icon={<Search size={24} />}
            title="No policy chains detected"
            subtitle="Make sure your upload includes at least one Relying Party file."
          />
        )}
      </section>

      <p className="map-panel__tip">
        Base files expand extensions, extension files expand relying party files, and relying party
        files open policy details.
      </p>
    </section>
  );
}

function LegendItem({ label, color }: { label: string; color: string }): JSX.Element {
  return (
    <div className="map-panel__legend-item">
      <span className="map-panel__legend-swatch" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

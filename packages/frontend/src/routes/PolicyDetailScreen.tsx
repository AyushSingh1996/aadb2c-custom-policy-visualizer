import * as Accordion from '@radix-ui/react-accordion';
import * as Dialog from '@radix-ui/react-dialog';
import { FileCode2, Files, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.js';
import { JourneyAccordion } from '../components/JourneyAccordion.js';
import { NodeCard } from '../components/NodeCard.js';
import { StepDetailsPanel } from '../components/StepDetailsPanel.js';
import { WarningBanner } from '../components/WarningBanner.js';
import { getChainFiles, getChainLastModified } from '../lib/analysis-view.js';
import { formatTimestamp, getFileDisplayPath } from '../lib/format.js';
import { useAnalysisStore } from '../store/analysis.js';

export function PolicyDetailScreen(): JSX.Element {
  const { chainId } = useParams<{ chainId: string }>();
  const result = useAnalysisStore((state) => state.result);
  const navigate = useNavigate();

  if (!result) {
    return <Navigate to="/" replace />;
  }

  const chain = result.chains.find((entry) => entry.id === chainId);
  if (!chain) {
    return result.chains.length > 0 ? <Navigate to="/map" replace /> : <Navigate to="/" replace />;
  }

  const activeChain = chain;

  const chainFiles = getChainFiles(activeChain, result.files);
  const rpFile = result.files.find((file) => file.id === activeChain.rpFileId);
  const [expandedJourneyIds, setExpandedJourneyIds] = useState<string[]>(() =>
    activeChain.resolvedJourneys[0] ? [activeChain.resolvedJourneys[0].id] : [],
  );
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(
    activeChain.resolvedJourneys[0]?.id ?? null,
  );
  const [selectedStepOrder, setSelectedStepOrder] = useState<number | null>(
    activeChain.resolvedJourneys[0]?.steps[0]?.order ?? null,
  );
  const [isXmlOpen, setIsXmlOpen] = useState(false);

  const selectedJourney =
    activeChain.resolvedJourneys.find((journey) => journey.id === selectedJourneyId) ??
    activeChain.resolvedJourneys[0] ??
    null;
  const selectedStep =
    selectedJourney?.steps.find((step) => step.order === selectedStepOrder) ??
    selectedJourney?.steps[0] ??
    null;

  const expandAll = expandedJourneyIds.length === activeChain.resolvedJourneys.length;
  const chainLastModified = getChainLastModified(chainFiles);

  const dataFlowSelections = useMemo(() => {
    const selections = new Map<string, number | null>();
    for (const journey of activeChain.resolvedJourneys) {
      selections.set(
        journey.id,
        journey.id === selectedJourney?.id
          ? selectedStep?.order ?? journey.steps[0]?.order ?? null
          : journey.steps[0]?.order ?? null,
      );
    }
    return selections;
  }, [activeChain.resolvedJourneys, selectedJourney?.id, selectedStep?.order]);

  function toggleJourney(journeyId: string): void {
    const journey = activeChain.resolvedJourneys.find((entry) => entry.id === journeyId);
    if (!journey) {
      return;
    }

    setSelectedJourneyId(journeyId);
    setSelectedStepOrder((current) => current ?? journey.steps[0]?.order ?? null);
  }

  function handleSelectStep(journeyId: string, stepOrder: number): void {
    setSelectedJourneyId(journeyId);
    setSelectedStepOrder(stepOrder);
  }

  return (
    <section className="screen-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/" className="breadcrumb__link">
          Upload
        </Link>
        <span className="breadcrumb__separator">›</span>
        <button type="button" className="breadcrumb__link" onClick={() => navigate('/map')}>
          Policy Map
        </button>
        <span className="breadcrumb__separator">›</span>
        <span className="breadcrumb__current">{activeChain.name}</span>
      </nav>

      {activeChain.orphanReferences.length > 0 ? (
        <WarningBanner
          message={`${activeChain.orphanReferences.length} orphan reference${
            activeChain.orphanReferences.length === 1 ? '' : 's'
          } detected in this chain.`}
        />
      ) : null}

      <div className="policy-detail-layout">
        <section className="policy-detail-sidebar">
          <div className="surface-card policy-detail-panel">
            <div className="policy-detail-panel__header">
              <h2 className="policy-detail-panel__title">Policy Chain</h2>
            </div>
            <div className="policy-detail-panel__stack">
              {chainFiles.map((file) => (
                <NodeCard key={file.id} file={file} compact />
              ))}
            </div>
          </div>

          <div className="surface-card policy-detail-panel">
            <div className="policy-detail-panel__header">
              <h2 className="policy-detail-panel__title">Chain Overview</h2>
            </div>
            <div className="policy-detail-panel__meta">
              <DetailMeta label="Chain Name" value={activeChain.name} />
              <DetailMeta label="Description" value={activeChain.description ?? 'No description'} />
              <DetailMeta
                label="User Journeys"
                value={String(activeChain.stats.userJourneyCount)}
              />
              <DetailMeta
                label="Technical Profiles"
                value={String(activeChain.stats.technicalProfileCount)}
              />
              <DetailMeta
                label="Last Modified"
                value={chainLastModified ? formatTimestamp(chainLastModified) : 'Unknown'}
              />
            </div>
          </div>
        </section>

        <section className="policy-detail-main">
          <div className="surface-card policy-detail-panel">
            <div className="policy-detail-panel__header">
              <h2 className="policy-detail-panel__title">
                User Journeys ({activeChain.resolvedJourneys.length})
              </h2>
              <div className="policy-detail-panel__actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() =>
                    setExpandedJourneyIds(
                      expandAll ? [] : activeChain.resolvedJourneys.map((journey) => journey.id),
                    )
                  }
                >
                  {expandAll ? 'Collapse All' : 'Expand All'}
                </button>

                <Dialog.Root open={isXmlOpen} onOpenChange={setIsXmlOpen}>
                  <Dialog.Trigger asChild>
                    <button type="button" className="button button--secondary">
                      <FileCode2 size={16} aria-hidden="true" />
                      <span>View XML</span>
                    </button>
                  </Dialog.Trigger>
                  <Dialog.Portal>
                    <Dialog.Overlay className="dialog-overlay" />
                    <Dialog.Content className="dialog-content">
                      <div className="dialog-content__header">
                        <div>
                          <Dialog.Title className="dialog-content__title">
                            {rpFile ? getFileDisplayPath(rpFile) : 'RP XML'}
                          </Dialog.Title>
                          <Dialog.Description className="dialog-content__description">
                            Raw XML from the chain&apos;s Relying Party file.
                          </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                          <button
                            type="button"
                            className="dialog-content__close"
                            aria-label="Close XML viewer"
                          >
                            <X size={18} aria-hidden="true" />
                          </button>
                        </Dialog.Close>
                      </div>
                      <pre className="dialog-content__pre">{rpFile?.rawXml ?? 'No XML available.'}</pre>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
              </div>
            </div>

            {activeChain.resolvedJourneys.length > 0 ? (
              <Accordion.Root
                type="multiple"
                value={expandedJourneyIds}
                onValueChange={setExpandedJourneyIds}
                className="journey-accordion-list"
              >
                {activeChain.resolvedJourneys.map((journey) => (
                  <JourneyAccordion
                    key={journey.id}
                    chain={activeChain}
                    journey={journey}
                    selectedStepOrder={
                      selectedJourneyId === journey.id ? selectedStepOrder : null
                    }
                    dataFlowStepOrder={dataFlowSelections.get(journey.id) ?? null}
                    onToggle={toggleJourney}
                    onSelectStep={handleSelectStep}
                  />
                ))}
              </Accordion.Root>
            ) : (
              <EmptyState
                icon={<Files size={24} />}
                title="No user journeys resolved for this chain"
                subtitle="Chains without resolved journeys cannot populate the step explorer."
              />
            )}
          </div>
        </section>

        <div className="policy-detail-right">
          <StepDetailsPanel
            chain={activeChain}
            step={selectedStep}
            journeyStepCount={selectedJourney?.steps.length ?? 0}
          />
        </div>
      </div>
    </section>
  );
}

function DetailMeta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="policy-detail-panel__meta-row">
      <div className="policy-detail-panel__meta-label">{label}</div>
      <div className="policy-detail-panel__meta-value">{value}</div>
    </div>
  );
}

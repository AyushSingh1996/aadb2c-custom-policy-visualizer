import * as Accordion from '@radix-ui/react-accordion';
import type { PolicyChain, UserJourney } from '@policy-analyzer/shared';
import { ChevronDown } from 'lucide-react';
import { getJourneyTechnicalProfileCount } from '../lib/analysis-view.js';
import { DataFlowPanel } from './DataFlowPanel.js';
import { StepsStrip } from './StepsStrip.js';

export interface JourneyAccordionProps {
  chain: PolicyChain;
  journey: UserJourney;
  selectedStepOrder: number | null;
  dataFlowStepOrder: number | null;
  onToggle: (journeyId: string) => void;
  onSelectStep: (journeyId: string, stepOrder: number) => void;
}

export function JourneyAccordion({
  chain,
  journey,
  selectedStepOrder,
  dataFlowStepOrder,
  onToggle,
  onSelectStep,
}: JourneyAccordionProps): JSX.Element {
  const technicalProfileCount = getJourneyTechnicalProfileCount(journey);
  const selectedFlowStep =
    journey.steps.find((step) => step.order === dataFlowStepOrder) ?? journey.steps[0] ?? null;

  return (
    <Accordion.Item value={journey.id} className="journey-accordion">
      <Accordion.Header>
        <Accordion.Trigger
          className="journey-accordion__trigger"
          onClick={() => onToggle(journey.id)}
        >
          <div className="journey-accordion__identity">
            <div className="journey-accordion__title-row">
              <ChevronDown className="journey-accordion__icon" size={18} aria-hidden="true" />
              <code className="journey-accordion__title">{journey.id}</code>
            </div>
            <div className="journey-accordion__subtitle">
              Defined in {journey.definedInFileId}
              {journey.isOverride ? ' • Override' : ''}
            </div>
          </div>
          <div className="journey-accordion__pills">
            <span className="journey-accordion__pill">{journey.steps.length} steps</span>
            <span className="journey-accordion__pill">{technicalProfileCount} TPs</span>
          </div>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="journey-accordion__content">
        <div className="journey-accordion__body">
          <StepsStrip
            steps={journey.steps}
            chain={chain}
            selectedStepOrder={selectedStepOrder}
            onSelectStep={(stepOrder) => onSelectStep(journey.id, stepOrder)}
          />
          {selectedFlowStep ? <DataFlowPanel chain={chain} step={selectedFlowStep} /> : null}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}

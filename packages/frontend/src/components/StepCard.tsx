import type { OrchestrationStep, PolicyChain } from '@policy-analyzer/shared';
import { AlertTriangle } from 'lucide-react';
import { forwardRef, type KeyboardEventHandler } from 'react';
import {
  findPrimaryTechnicalProfile,
  getClaimDisplaysFromNames,
  getMissingTechnicalProfileIdsForStep,
  getStepDisplayName,
  getStepTypeLabel,
} from '../lib/analysis-view.js';

export interface StepCardProps {
  step: OrchestrationStep;
  chain: PolicyChain;
  selected: boolean;
  onSelect: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}

function previewClaims(claimNames: string[]): string[] {
  return claimNames.slice(0, 4);
}

export const StepCard = forwardRef<HTMLButtonElement, StepCardProps>(function StepCard(
  { step, chain, selected, onSelect, onKeyDown },
  ref,
): JSX.Element {
  const technicalProfile = findPrimaryTechnicalProfile(step, chain);
  const inputClaims = getClaimDisplaysFromNames(previewClaims(step.inputClaimNames), chain);
  const outputClaims = getClaimDisplaysFromNames(previewClaims(step.outputClaimNames), chain);
  const missingTechnicalProfileIds = getMissingTechnicalProfileIdsForStep(step, chain);
  const missingTechnicalProfileId = missingTechnicalProfileIds[0];

  return (
    <button
      ref={ref}
      type="button"
      className={`step-card${selected ? ' step-card--selected' : ''}`}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      aria-label={`Select step ${step.order}: ${getStepDisplayName(step, technicalProfile)}`}
    >
      <div className={`step-card__order${selected ? ' step-card__order--selected' : ''}`}>
        {step.order}
      </div>
      <div className="step-card__title-row">
        <div className="step-card__title">{getStepDisplayName(step, technicalProfile)}</div>
        {missingTechnicalProfileId ? (
          <span
            className="step-card__warning"
            title={`Technical profile ${missingTechnicalProfileId} is referenced but not defined.`}
            aria-label={`Technical profile ${missingTechnicalProfileId} is referenced but not defined.`}
          >
            <AlertTriangle size={14} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className="step-card__type">{getStepTypeLabel(step)}</div>
      <div className="step-card__claims">
        <div className="step-card__claims-label">Inputs</div>
        {inputClaims.length > 0 ? (
          inputClaims.map((claim) => (
            <code key={`input-${claim.id}`} className="step-card__claim">
              {claim.id}
            </code>
          ))
        ) : (
          <span className="step-card__claim step-card__claim--empty">None</span>
        )}
      </div>
      <div className="step-card__claims">
        <div className="step-card__claims-label">Outputs</div>
        {outputClaims.length > 0 ? (
          outputClaims.map((claim) => (
            <code key={`output-${claim.id}`} className="step-card__claim">
              {claim.id}
            </code>
          ))
        ) : (
          <span className="step-card__claim step-card__claim--empty">None</span>
        )}
      </div>
    </button>
  );
});

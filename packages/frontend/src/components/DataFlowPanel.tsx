import type { OrchestrationStep, PolicyChain } from '@policy-analyzer/shared';
import { ArrowRight } from 'lucide-react';
import type { ClaimDisplay } from '../lib/analysis-view.js';
import {
  findPrimaryTechnicalProfile,
  getClaimDisplaysFromNames,
  getStepDisplayName,
} from '../lib/analysis-view.js';

export interface DataFlowPanelProps {
  chain: PolicyChain;
  step: OrchestrationStep;
}

function ClaimList({ claims }: { claims: ClaimDisplay[] }): JSX.Element {
  if (claims.length === 0) {
    return <div className="data-flow-panel__empty">None</div>;
  }

  return (
    <div className="data-flow-panel__list">
      {claims.map((claim) => (
        <div key={claim.id} className="data-flow-panel__claim">
          <code>{claim.id}</code>
          <span>{claim.dataType ?? 'unknown'}</span>
        </div>
      ))}
    </div>
  );
}

export function DataFlowPanel({ chain, step }: DataFlowPanelProps): JSX.Element {
  const technicalProfile = findPrimaryTechnicalProfile(step, chain);
  const inputClaims = getClaimDisplaysFromNames(step.inputClaimNames, chain);
  const outputClaims = getClaimDisplaysFromNames(step.outputClaimNames, chain);

  return (
    <div className="surface-card data-flow-panel">
      <div className="data-flow-panel__box">
        <div className="data-flow-panel__heading">Inputs</div>
        <ClaimList claims={inputClaims} />
      </div>
      <div className="data-flow-panel__arrow" aria-hidden="true">
        <ArrowRight size={18} />
      </div>
      <div className="data-flow-panel__box">
        <div className="data-flow-panel__heading">Technical Profile</div>
        <div className="data-flow-panel__profile-title">
          {getStepDisplayName(step, technicalProfile)}
        </div>
        <code className="data-flow-panel__profile-id">
          {technicalProfile?.id ?? step.technicalProfileReferenceId ?? 'None'}
        </code>
      </div>
      <div className="data-flow-panel__arrow" aria-hidden="true">
        <ArrowRight size={18} />
      </div>
      <div className="data-flow-panel__box">
        <div className="data-flow-panel__heading">Outputs</div>
        <ClaimList claims={outputClaims} />
      </div>
    </div>
  );
}

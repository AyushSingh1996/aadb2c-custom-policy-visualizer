import * as Tooltip from '@radix-ui/react-tooltip';
import type { OrchestrationStep, PolicyChain } from '@policy-analyzer/shared';
import { ExternalLink, Info, Link2 } from 'lucide-react';
import type { ClaimDisplay } from '../lib/analysis-view.js';
import {
  findPrimaryTechnicalProfile,
  formatPreconditions,
  getClaimDisplaysFromNames,
  getClaimDisplaysFromReferences,
  getExternalDependenciesForStep,
  getStepDisplayName,
  getStepPurpose,
  getStepTypeLabel,
  getTechnicalProfileIds,
} from '../lib/analysis-view.js';
import { EmptyState } from './EmptyState.js';
import { ProtocolCategoryBadge } from './ProtocolCategoryBadge.js';

export interface StepDetailsPanelProps {
  chain: PolicyChain;
  journeyStepCount: number;
  step: OrchestrationStep | null;
}

function ClaimList({ claims, limit = 6 }: { claims: ClaimDisplay[]; limit?: number }): JSX.Element {
  if (claims.length === 0) {
    return <div className="step-details__empty">None</div>;
  }

  const visibleClaims = claims.slice(0, limit);
  const hiddenCount = claims.length - visibleClaims.length;

  return (
    <div className="step-details__claim-list">
      {visibleClaims.map((claim) => (
        <div key={`${claim.id}-${claim.dataType ?? 'unknown'}`} className="step-details__claim-row">
          <code>{claim.id}</code>
          <span>{claim.dataType ?? 'unknown'}</span>
        </div>
      ))}
      {hiddenCount > 0 ? <div className="step-details__more">+{hiddenCount} more</div> : null}
    </div>
  );
}

export function StepDetailsPanel({
  chain,
  journeyStepCount,
  step,
}: StepDetailsPanelProps): JSX.Element {
  if (!step) {
    return (
      <div className="surface-card step-details">
        <EmptyState
          icon={<Link2 size={24} />}
          title="Select a step"
          subtitle="Choose an orchestration step to inspect its technical profile, claims, and dependencies."
        />
      </div>
    );
  }

  const technicalProfile = findPrimaryTechnicalProfile(step, chain);
  const technicalProfileIds = getTechnicalProfileIds(step);
  const inputClaimsFromStep = getClaimDisplaysFromNames(step.inputClaimNames, chain);
  const outputClaimsFromStep = getClaimDisplaysFromNames(step.outputClaimNames, chain);
  const inputClaims =
    technicalProfile && technicalProfile.inputClaims.length > 0
      ? getClaimDisplaysFromReferences(technicalProfile.inputClaims, chain)
      : inputClaimsFromStep;
  const outputClaims =
    technicalProfile && technicalProfile.outputClaims.length > 0
      ? getClaimDisplaysFromReferences(technicalProfile.outputClaims, chain)
      : outputClaimsFromStep;
  const dependencies = getExternalDependenciesForStep(chain, step);
  const hasDocumentation =
    technicalProfile?.catalogDescription !== undefined ||
    technicalProfile?.catalogDocsUrl !== undefined;

  return (
    <aside className="surface-card step-details">
      <div className="step-details__header">
        <div className="step-details__eyebrow">
          Step {step.order} of {journeyStepCount}
        </div>
        <h2 className="step-details__title">{getStepDisplayName(step, technicalProfile)}</h2>
      </div>

      <div className="step-details__grid">
        <Section label="Type">
          <span>{getStepTypeLabel(step)}</span>
        </Section>

        <Section label="Technical Profile">
          {technicalProfileIds.length > 0 ? (
            technicalProfileIds.map((referenceId) => <code key={referenceId}>{referenceId}</code>)
          ) : (
            <span>None</span>
          )}
        </Section>

        <Section label="Category">
          {technicalProfile ? (
            <ProtocolCategoryBadge category={technicalProfile.protocolCategory} />
          ) : (
            <span>None</span>
          )}
        </Section>

        <Section label="Purpose">
          <span>{getStepPurpose(technicalProfile)}</span>
        </Section>

        {technicalProfile && hasDocumentation ? (
          <Section label="Documentation">
            <div className="step-details__documentation">
              {technicalProfile.catalogDescription ? (
                <Tooltip.Provider delayDuration={120}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        type="button"
                        className="step-details__icon-button"
                        aria-label="Show technical profile documentation summary"
                      >
                        <Info size={16} />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content side="top" sideOffset={8} className="tooltip-content">
                        {technicalProfile.catalogDescription}
                        <Tooltip.Arrow className="tooltip-arrow" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              ) : null}
              {technicalProfile.catalogDocsUrl ? (
                <a
                  className="inline-link"
                  href={technicalProfile.catalogDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Learn more</span>
                  <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
          </Section>
        ) : null}

        <Section label="Inputs">
          <ClaimList claims={inputClaims} />
        </Section>

        <Section label="Outputs">
          <ClaimList claims={outputClaims} />
        </Section>

        <Section label="Precondition">
          <span>{formatPreconditions(step)}</span>
        </Section>

        {dependencies.length > 0 ? (
          <Section label="External dependency">
            <div className="step-details__dependency-list">
              {dependencies.map((dependency) => (
                <div
                  key={`${dependency.type}-${dependency.url}`}
                  className="step-details__dependency"
                >
                  <span>{dependency.type}</span>
                  <code>{dependency.url}</code>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </aside>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: JSX.Element | JSX.Element[] | string;
}): JSX.Element {
  return (
    <section className="step-details__section">
      <div className="step-details__label">{label}</div>
      <div className="step-details__content">{children}</div>
    </section>
  );
}

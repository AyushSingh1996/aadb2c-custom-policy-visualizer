import type { OrchestrationStep, PolicyChain } from '@policy-analyzer/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { StepCard } from './StepCard.js';

export interface StepsStripProps {
  steps: OrchestrationStep[];
  chain: PolicyChain;
  selectedStepOrder: number | null;
  onSelectStep: (stepOrder: number) => void;
}

export function StepsStrip({
  steps,
  chain,
  selectedStepOrder,
  onSelectStep,
}: StepsStripProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stepButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function scrollByAmount(delta: number): void {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  function focusStep(index: number): void {
    const target = stepButtonRefs.current[index];
    target?.focus();
  }

  function handleStepKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusStep(Math.min(index + 1, steps.length - 1));
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusStep(Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      focusStep(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      focusStep(steps.length - 1);
    }
  }

  return (
    <div className="steps-strip">
      <div className="steps-strip__header">
        <button
          type="button"
          className="steps-strip__button"
          onClick={() => scrollByAmount(-240)}
          aria-label="Scroll orchestration steps left"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="steps-strip__button"
          onClick={() => scrollByAmount(240)}
          aria-label="Scroll orchestration steps right"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="steps-strip__viewport" ref={scrollRef}>
        {steps.map((step, index) => (
          <StepCard
            key={step.order}
            step={step}
            chain={chain}
            selected={selectedStepOrder === step.order}
            onSelect={() => onSelectStep(step.order)}
            ref={(element) => {
              stepButtonRefs.current[index] = element;
            }}
            onKeyDown={(event) => handleStepKeyDown(event, index)}
          />
        ))}
      </div>
    </div>
  );
}

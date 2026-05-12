import type { SchemaWarning } from '@policy-analyzer/shared';
import { AlertTriangle } from 'lucide-react';

export interface WarningBannerProps {
  message?: string;
  schemaWarnings?: SchemaWarning[];
}

export function WarningBanner({ message, schemaWarnings = [] }: WarningBannerProps): JSX.Element {
  if (schemaWarnings.length > 0) {
    return (
      <details className="warning-banner warning-banner--collapsible">
        <summary className="warning-banner__summary">
          <span className="warning-banner__summary-main">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>Schema warnings ({schemaWarnings.length})</span>
          </span>
          <span className="warning-banner__summary-hint">
            Review structural validation findings
          </span>
        </summary>
        <ul className="warning-banner__list">
          {schemaWarnings.map((warning, index) => (
            <li
              key={`${warning.code}-${warning.entityId ?? warning.fileId}-${index}`}
              className="warning-banner__item"
            >
              <span>
                [{warning.code}] {warning.message}
              </span>
              {warning.entityId ? (
                <code className="warning-banner__entity">{warning.entityId}</code>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    );
  }

  return (
    <div className="warning-banner" role="status">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

import type { PolicyFile } from '@policy-analyzer/shared';
import { FileText } from 'lucide-react';
import { getCategoryColor, getCategoryLabel } from '../lib/analysis-view.js';
import { formatBytes, getFileDirectory, getFileDisplayPath } from '../lib/format.js';

export interface NodeCardProps {
  file: PolicyFile;
  compact?: boolean;
  onClick?: () => void;
  showSize?: boolean;
  metaLabel?: string;
  detailLabel?: string;
  title?: string;
  expanded?: boolean;
}

export function NodeCard({
  file,
  compact = false,
  onClick,
  showSize = true,
  metaLabel,
  detailLabel,
  title,
  expanded,
}: NodeCardProps): JSX.Element {
  const Component = onClick ? 'button' : 'div';
  const directory = getFileDirectory(file);
  const displayPath = getFileDisplayPath(file);

  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={`node-card node-card--${file.category}${compact ? ' node-card--compact' : ''}${onClick ? ' node-card--interactive' : ''}`}
      style={{ ['--node-accent' as string]: getCategoryColor(file.category) }}
      onClick={onClick}
      title={title ?? displayPath}
      aria-expanded={typeof expanded === 'boolean' ? expanded : undefined}
    >
      <div className="node-card__title-row">
        <FileText size={14} aria-hidden="true" />
        <code className="node-card__filename">{file.fileName}</code>
      </div>
      {directory ? <div className="node-card__path">{directory}/</div> : null}
      <div className={`node-card__meta node-card__meta--${file.category}`}>
        {getCategoryLabel(file.category)}
      </div>
      {metaLabel ? <div className="node-card__submeta">{metaLabel}</div> : null}
      {detailLabel ? <div className="node-card__detail">{detailLabel}</div> : null}
      {showSize ? <div className="node-card__submeta">{formatBytes(file.sizeBytes)}</div> : null}
    </Component>
  );
}

import type { FileCategory } from '@policy-analyzer/shared';
import { categoryLabel } from '../lib/format.js';

export interface FileTypeBadgeProps {
  category: FileCategory;
  title?: string;
}

export function FileTypeBadge({ category, title }: FileTypeBadgeProps): JSX.Element {
  return (
    <span className={`badge badge--${category}`} title={title}>
      {categoryLabel(category)}
    </span>
  );
}

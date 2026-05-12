import type { CSSProperties } from 'react';
import type { PolicyFile } from '@policy-analyzer/shared';
import { FileText } from 'lucide-react';
import { getDisplayParseError } from '../lib/analysis-view.js';
import {
  categoryLabel,
  formatBytes,
  formatTimestamp,
  getFileDirectory,
  getFileDisplayPath,
} from '../lib/format.js';
import { FileTypeBadge } from './FileTypeBadge.js';

export interface DetectedFilesTableProps {
  files: PolicyFile[];
}

function categoryDotClass(category: PolicyFile['category']): CSSProperties {
  switch (category) {
    case 'Base':
      return { background: 'var(--color-base)' };
    case 'Extension':
      return { background: 'var(--color-extension)' };
    case 'RelyingParty':
      return { background: 'var(--color-rp)' };
    case 'Localization':
      return { background: 'var(--color-localization)' };
    case 'Error':
    default:
      return { background: 'var(--color-error)' };
  }
}

export function DetectedFilesTable({ files }: DetectedFilesTableProps): JSX.Element {
  const zebraClass = files.length > 12 ? ' file-table--zebra' : '';

  return (
    <div className={`surface-card file-table${zebraClass}`}>
      <div className="file-table__head">
        <div>File Name</div>
        <div>Type</div>
        <div>Category</div>
        <div className="file-table__cell--numeric">Size</div>
        <div>Last Modified</div>
      </div>
      <div className="file-table__body">
        {files.map((file) => {
          const parseErrorTitle = getDisplayParseError(file);
          const directory = getFileDirectory(file);
          return (
            <div
              className="file-table__row"
              key={file.id}
              tabIndex={0}
              aria-label={`${getFileDisplayPath(file)}, ${categoryLabel(file.category)}, ${formatBytes(file.sizeBytes)}`}
            >
              <div className="file-table__name" title={getFileDisplayPath(file)}>
                <FileText size={14} aria-hidden="true" />
                <span className="file-table__name-copy">
                  {directory ? <span className="file-table__path">{directory}/</span> : null}
                  <code>{file.fileName}</code>
                </span>
              </div>
              <div>
                <FileTypeBadge
                  category={file.category}
                  {...(parseErrorTitle ? { title: parseErrorTitle } : {})}
                />
              </div>
              <div className="category-pill">
                <span className="category-pill__dot" style={categoryDotClass(file.category)} />
                <span>{categoryLabel(file.category)}</span>
              </div>
              <div className="file-table__cell--numeric">{formatBytes(file.sizeBytes)}</div>
              <div>{formatTimestamp(file.lastModified)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

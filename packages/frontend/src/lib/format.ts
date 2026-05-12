import type { FileCategory, PolicyFile } from '@policy-analyzer/shared';

const categoryLabels: Record<FileCategory, string> = {
  Base: 'Base File',
  Extension: 'Extension File',
  RelyingParty: 'Relying Party File',
  Localization: 'Localization File',
  Error: 'Error',
};

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function categoryLabel(category: FileCategory): string {
  return categoryLabels[category];
}

export function getFileDisplayPath(file: Pick<PolicyFile, 'fileName' | 'relativePath'>): string {
  return file.relativePath ?? file.fileName;
}

export function getFileDirectory(
  file: Pick<PolicyFile, 'fileName' | 'relativePath'>,
): string | undefined {
  if (!file.relativePath) {
    return undefined;
  }

  const lastSlashIndex = file.relativePath.lastIndexOf('/');
  return lastSlashIndex > 0 ? file.relativePath.slice(0, lastSlashIndex) : undefined;
}

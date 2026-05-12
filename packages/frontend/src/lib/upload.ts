import type { PolicyFile } from '@policy-analyzer/shared';

export const MAX_UPLOAD_FILES = 200;
export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export interface SelectedUploadFile {
  file: File;
  relativePath?: string;
}

export interface UploadValidationResult {
  acceptedFiles: SelectedUploadFile[];
  errors: string[];
}

interface UploadValidationOptions {
  maxFiles: number;
  maxFileSizeBytes: number;
}

const defaultValidationOptions: UploadValidationOptions = {
  maxFiles: MAX_UPLOAD_FILES,
  maxFileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES,
};

export function mergeFiles(
  existingFiles: SelectedUploadFile[],
  nextFiles: SelectedUploadFile[],
): SelectedUploadFile[] {
  const merged = new Map<string, SelectedUploadFile>();

  for (const file of [...existingFiles, ...nextFiles]) {
    merged.set(selectedUploadFileKey(file), file);
  }

  return [...merged.values()];
}

export function validateFilesForUpload(
  existingFiles: SelectedUploadFile[],
  nextFiles: SelectedUploadFile[],
  options: UploadValidationOptions = defaultValidationOptions,
): UploadValidationResult {
  const errors: string[] = [];
  const acceptedByKey = new Map<string, SelectedUploadFile>();
  const existingKeys = new Set(existingFiles.map(selectedUploadFileKey));

  for (const incomingFile of nextFiles) {
    const normalized = normalizeSelectedUploadFile(incomingFile);

    if ('error' in normalized) {
      errors.push(normalized.error);
      continue;
    }

    const { file } = normalized;
    if (!file.file.name.toLowerCase().endsWith('.xml')) {
      errors.push(`${getSelectedUploadDisplayPath(file)} is not an XML file and was skipped.`);
      continue;
    }

    if (file.file.size > options.maxFileSizeBytes) {
      errors.push(
        `${getSelectedUploadDisplayPath(file)} exceeds the ${(options.maxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB size limit and was skipped.`,
      );
      continue;
    }

    acceptedByKey.set(selectedUploadFileKey(file), file);
  }

  const acceptedFiles: SelectedUploadFile[] = [];
  let remainingCapacity = Math.max(options.maxFiles - existingFiles.length, 0);
  let droppedCount = 0;

  for (const [key, file] of acceptedByKey) {
    if (existingKeys.has(key)) {
      acceptedFiles.push(file);
      continue;
    }

    if (remainingCapacity > 0) {
      acceptedFiles.push(file);
      remainingCapacity -= 1;
      continue;
    }

    droppedCount += 1;
  }

  if (droppedCount > 0) {
    errors.push(
      `Cannot upload more than ${options.maxFiles} files. ${droppedCount} files were not added.`,
    );
  }

  return { acceptedFiles, errors };
}

export function hasRelyingPartyFile(files: PolicyFile[]): boolean {
  return files.some((file) => file.category === 'RelyingParty');
}

export function normalizeRelativePath(rawRelativePath: string): string | null {
  const normalized = rawRelativePath.replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
  if (normalized.length === 0) {
    return null;
  }

  const segments = normalized.split('/');
  if (
    segments.some(
      (segment: string) => segment.length === 0 || segment === '.' || segment === '..',
    )
  ) {
    return null;
  }

  return segments.join('/');
}

export function getSelectedUploadDisplayPath(file: SelectedUploadFile): string {
  return file.relativePath ?? file.file.name;
}

function normalizeSelectedUploadFile(
  file: SelectedUploadFile,
): { file: SelectedUploadFile } | { error: string } {
  if (!file.relativePath) {
    return { file };
  }

  const normalizedRelativePath = normalizeRelativePath(file.relativePath);
  if (!normalizedRelativePath) {
    return {
      error: `${file.relativePath} has an invalid relative path and was skipped.`,
    };
  }

  return {
    file: {
      file: file.file,
      relativePath: normalizedRelativePath,
    },
  };
}

function selectedUploadFileKey(file: SelectedUploadFile): string {
  if (file.relativePath) {
    return `path:${file.relativePath}`;
  }

  return `file:${file.file.name}:${file.file.lastModified}:${file.file.size}`;
}

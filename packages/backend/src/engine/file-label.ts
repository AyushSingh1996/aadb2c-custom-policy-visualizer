import type { ParseError, PolicyFile } from '@policy-analyzer/shared';
import type { UploadedFile } from './types.js';

type FileLabelTarget =
  | Pick<PolicyFile, 'fileName' | 'relativePath'>
  | Pick<ParseError, 'fileName' | 'relativePath'>
  | Pick<UploadedFile, 'fileName' | 'relativePath'>;

export function getFileLabel(file: FileLabelTarget): string {
  return file.relativePath ?? file.fileName;
}

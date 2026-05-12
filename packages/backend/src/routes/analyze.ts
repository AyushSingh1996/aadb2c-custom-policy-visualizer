import { buffer as streamToBuffer } from 'node:stream/consumers';
import type { FastifyInstance } from 'fastify';
import type { MultipartFile, MultipartValue } from '@fastify/multipart';
import { AppError } from '../errors.js';
import { runAnalysis } from '../engine/pipeline.js';
import {
  parseAppSettings,
  SettingsParseError,
  type AppSettings,
} from '../engine/settings-resolver.js';
import type { UploadedFile } from '../engine/types.js';
import type { SessionStore } from '../session-store.js';

const MAX_APPSETTINGS_SIZE_BYTES = 100 * 1024;
const EXPECTED_FIELDS_ERROR =
  'Expected uploaded files under the "files" field, optional path metadata under the "fileManifest" field, or optional appsettings.json under the "appsettings" field.';

export interface AnalyzeRouteOptions {
  maxFilesPerUpload: number;
  maxFileSizeBytes: number;
  sessionStore: SessionStore;
}

export async function registerAnalyzeRoute(
  app: FastifyInstance,
  options: AnalyzeRouteOptions,
): Promise<void> {
  app.post('/api/analyze', async (request, reply) => {
    if (!request.isMultipart()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request must be multipart/form-data.');
    }

    const uploadedFiles: UploadedFile[] = [];
    let fileManifestEntries: FileManifestEntry[] | null = null;
    let fileManifestSeen = false;
    let appSettings: AppSettings | null = null;
    let appSettingsSeen = false;

    try {
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          if (part.fieldname === 'fileManifest') {
            if (fileManifestSeen) {
              throw new AppError(
                400,
                'VALIDATION_ERROR',
                'Only one fileManifest field can be uploaded.',
              );
            }

            fileManifestSeen = true;
            fileManifestEntries = parseFileManifest(part);
            continue;
          }

          throw new AppError(400, 'VALIDATION_ERROR', EXPECTED_FIELDS_ERROR);
        }

        if (part.type !== 'file') {
          continue;
        }

        if (part.fieldname === 'files') {
          if (uploadedFiles.length >= options.maxFilesPerUpload) {
            part.file.resume();
            throw new AppError(
              413,
              'TOO_MANY_FILES',
              `Cannot upload more than ${options.maxFilesPerUpload} files.`,
            );
          }

          const fileName = part.filename ?? 'upload.xml';
          if (!fileName.toLowerCase().endsWith('.xml')) {
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              `${fileName} is not an XML file and was skipped.`,
            );
          }

          const content = await readMultipartFile(part, options.maxFileSizeBytes);
          uploadedFiles.push({
            fileName,
            buffer: content,
            sizeBytes: content.byteLength,
            lastModified: new Date().toISOString(),
          });
          continue;
        }

        if (part.fieldname === 'appsettings') {
          if (appSettingsSeen) {
            part.file.resume();
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              'Only one appsettings.json file can be uploaded.',
            );
          }

          appSettingsSeen = true;
          const fileName = part.filename ?? 'appsettings.json';
          if (!fileName.toLowerCase().endsWith('.json')) {
            throw new AppError(
              400,
              'VALIDATION_ERROR',
              'Expected appsettings.json as a JSON file.',
            );
          }

          const content = await readMultipartFile(
            part,
            MAX_APPSETTINGS_SIZE_BYTES,
            'appsettings.json must be under 100 KB.',
          );

          try {
            appSettings = parseAppSettings(content.toString('utf-8'));
          } catch (error) {
            if (error instanceof SettingsParseError) {
              throw new AppError(
                400,
                'VALIDATION_ERROR',
                `Invalid appsettings.json: ${error.message}`,
              );
            }
            throw error;
          }
          continue;
        }

        await rejectUnexpectedField(part);
      }
    } catch (error) {
      if (isMultipartLimitError(error)) {
        throw multipartLimitToAppError(error, options.maxFileSizeBytes, options.maxFilesPerUpload);
      }
      throw error;
    }

    if (uploadedFiles.length === 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'No files were attached under the "files" field.',
      );
    }

    applyFileManifest(uploadedFiles, fileManifestEntries);

    const result = await runAnalysis(uploadedFiles, appSettings);
    options.sessionStore.save(result);
    return reply.send(result);
  });
}

async function rejectUnexpectedField(part: MultipartFile): Promise<void> {
  part.file.resume();
  throw new AppError(
    400,
    'VALIDATION_ERROR',
    EXPECTED_FIELDS_ERROR,
  );
}

async function readMultipartFile(
  part: MultipartFile,
  maxFileSizeBytes: number,
  customTooLargeMessage?: string,
): Promise<Buffer> {
  const content = (await streamToBuffer(part.file)) as Buffer;
  if (content.byteLength > maxFileSizeBytes) {
    throw new AppError(
      customTooLargeMessage ? 400 : 413,
      customTooLargeMessage ? 'VALIDATION_ERROR' : 'FILE_TOO_LARGE',
      customTooLargeMessage ??
        `"${part.filename ?? 'upload.xml'}" exceeded the ${maxFileSizeBytes} byte size limit.`,
    );
  }
  return content;
}

function isMultipartLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ['FST_REQ_FILE_TOO_LARGE', 'FST_FILES_LIMIT', 'FST_PARTS_LIMIT'].includes(
      (error as { code?: string }).code ?? '',
    )
  );
}

function multipartLimitToAppError(
  error: unknown,
  maxFileSizeBytes: number,
  maxFilesPerUpload: number,
): AppError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? (error as { code?: string }).code
      : undefined;

  if (code === 'FST_FILES_LIMIT' || code === 'FST_PARTS_LIMIT') {
    return new AppError(
      413,
      'TOO_MANY_FILES',
      `Cannot upload more than ${maxFilesPerUpload} files.`,
    );
  }

  return new AppError(
    413,
    'FILE_TOO_LARGE',
    `One or more files exceeded the ${maxFileSizeBytes} byte size limit.`,
  );
}

interface FileManifestEntry {
  relativePath?: string;
}

function parseFileManifest(part: MultipartValue<unknown>): FileManifestEntry[] {
  let parsed: unknown;

  if (typeof part.value !== 'string') {
    throw new AppError(400, 'VALIDATION_ERROR', 'fileManifest must be a JSON string.');
  }

  try {
    parsed = JSON.parse(part.value);
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid fileManifest JSON.');
  }

  if (!Array.isArray(parsed)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'fileManifest must be a JSON array.');
  }

  return parsed.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `fileManifest[${index}] must be an object with an optional relativePath.`,
      );
    }

    const relativePath = (entry as Record<string, unknown>)['relativePath'];
    if (relativePath === undefined) {
      return {};
    }

    if (typeof relativePath !== 'string') {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `fileManifest[${index}].relativePath must be a string when provided.`,
      );
    }

    return { relativePath };
  });
}

function applyFileManifest(
  uploadedFiles: UploadedFile[],
  fileManifestEntries: FileManifestEntry[] | null,
): void {
  if (fileManifestEntries === null) {
    return;
  }

  if (fileManifestEntries.length !== uploadedFiles.length) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'fileManifest entry count must match the number of uploaded files.',
    );
  }

  for (const [index, uploadedFile] of uploadedFiles.entries()) {
    const relativePath = fileManifestEntries[index]?.relativePath;
    if (relativePath === undefined) {
      continue;
    }

    uploadedFile.relativePath = normalizeRelativePath(relativePath, `fileManifest[${index}]`);
  }
}

function normalizeRelativePath(rawRelativePath: string, context: string): string {
  const normalized = rawRelativePath.replace(/\\/g, '/').replace(/^\.\/+/, '').trim();
  if (normalized.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', `${context}.relativePath cannot be empty.`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      `${context}.relativePath must not contain empty, ".", or ".." path segments.`,
    );
  }

  return segments.join('/');
}

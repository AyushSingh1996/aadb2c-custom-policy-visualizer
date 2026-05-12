import { describe, expect, test } from 'vitest';
import type { PolicyFile } from '@policy-analyzer/shared';
import {
  getSelectedUploadDisplayPath,
  hasRelyingPartyFile,
  mergeFiles,
  normalizeRelativePath,
  type SelectedUploadFile,
  validateFilesForUpload,
} from '../lib/upload.js';

function createFile(name: string, size: number, lastModified = 1): File {
  return new File(['x'.repeat(size)], name, {
    type: 'application/xml',
    lastModified,
  });
}

function createSelectedUploadFile(
  name: string,
  size: number,
  options: { lastModified?: number; relativePath?: string } = {},
): SelectedUploadFile {
  return {
    file: createFile(name, size, options.lastModified),
    ...(options.relativePath ? { relativePath: options.relativePath } : {}),
  };
}

describe('upload helpers', () => {
  test('filters invalid files and enforces the upload limit', () => {
    const existing = [createSelectedUploadFile('TrustFrameworkBase.xml', 128, { lastModified: 1 })];
    const incoming = [
      createSelectedUploadFile('TrustFrameworkExtensions.xml', 128, { lastModified: 2 }),
      {
        file: new File(['json'], 'notes.json', { type: 'application/json', lastModified: 3 }),
      },
      createSelectedUploadFile('TooLarge.xml', 6 * 1024 * 1024, { lastModified: 4 }),
    ];

    const result = validateFilesForUpload(existing, incoming, {
      maxFiles: 2,
      maxFileSizeBytes: 5 * 1024 * 1024,
    });

    expect(result.acceptedFiles).toHaveLength(1);
    expect(result.acceptedFiles[0]?.file.name).toBe('TrustFrameworkExtensions.xml');
    expect(result.errors).toEqual([
      'notes.json is not an XML file and was skipped.',
      'TooLarge.xml exceeds the 5 MB size limit and was skipped.',
    ]);
  });

  test('reports how many files were not added when the upload limit is exceeded', () => {
    const incoming = [
      createSelectedUploadFile('One.xml', 32, { lastModified: 1 }),
      createSelectedUploadFile('Two.xml', 32, { lastModified: 2 }),
      createSelectedUploadFile('Three.xml', 32, { lastModified: 3 }),
    ];

    const result = validateFilesForUpload([], incoming, {
      maxFiles: 2,
      maxFileSizeBytes: 5 * 1024 * 1024,
    });

    expect(result.acceptedFiles).toHaveLength(2);
    expect(result.errors).toEqual(['Cannot upload more than 2 files. 1 files were not added.']);
  });

  test('keeps same-named files from different folders as distinct uploads', () => {
    const incoming = [
      createSelectedUploadFile('TrustFrameworkBase.xml', 128, {
        lastModified: 1,
        relativePath: 'tenant-a/TrustFrameworkBase.xml',
      }),
      createSelectedUploadFile('TrustFrameworkBase.xml', 128, {
        lastModified: 2,
        relativePath: 'tenant-b/TrustFrameworkBase.xml',
      }),
    ];

    const result = validateFilesForUpload([], incoming);

    expect(result.acceptedFiles).toHaveLength(2);
    expect(result.acceptedFiles.map(getSelectedUploadDisplayPath)).toEqual([
      'tenant-a/TrustFrameworkBase.xml',
      'tenant-b/TrustFrameworkBase.xml',
    ]);
  });

  test('replaces an existing folder-backed file when the same relative path is selected again', () => {
    const first = createSelectedUploadFile('TrustFrameworkBase.xml', 128, {
      lastModified: 1,
      relativePath: 'tenant-a/TrustFrameworkBase.xml',
    });
    const replacement = createSelectedUploadFile('TrustFrameworkBase.xml', 256, {
      lastModified: 2,
      relativePath: 'tenant-a/TrustFrameworkBase.xml',
    });

    const validation = validateFilesForUpload([first], [replacement], {
      maxFiles: 1,
      maxFileSizeBytes: 5 * 1024 * 1024,
    });
    const merged = mergeFiles([first], validation.acceptedFiles);

    expect(validation.acceptedFiles).toHaveLength(1);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.file.size).toBe(256);
  });

  test('normalizes folder-style relative paths and rejects invalid traversal', () => {
    expect(normalizeRelativePath('./tenant-a\\sub/TrustFrameworkBase.xml')).toBe(
      'tenant-a/sub/TrustFrameworkBase.xml',
    );
    expect(normalizeRelativePath('../tenant-a/TrustFrameworkBase.xml')).toBeNull();
    expect(normalizeRelativePath('tenant-a//TrustFrameworkBase.xml')).toBeNull();
  });

  test('merges flat files by stable file identity', () => {
    const first = createSelectedUploadFile('TrustFrameworkBase.xml', 128, { lastModified: 1 });
    const duplicate = createSelectedUploadFile('TrustFrameworkBase.xml', 128, { lastModified: 1 });
    const next = createSelectedUploadFile('SignUpOrSignIn.xml', 64, { lastModified: 2 });

    const merged = mergeFiles([first], [duplicate, next]);

    expect(merged).toHaveLength(2);
    expect(merged.map((file) => file.file.name)).toEqual([
      'TrustFrameworkBase.xml',
      'SignUpOrSignIn.xml',
    ]);
  });

  test('detects whether a preview result includes a relying party file', () => {
    const files: PolicyFile[] = [
      {
        id: '1',
        fileName: 'TrustFrameworkBase.xml',
        sizeBytes: 120,
        lastModified: '2026-04-28T00:00:00.000Z',
        category: 'Base',
        rawXml: '<xml />',
        parsedAt: '2026-04-28T00:00:00.000Z',
      },
      {
        id: '2',
        fileName: 'SignUpOrSignIn.xml',
        sizeBytes: 220,
        lastModified: '2026-04-28T00:00:00.000Z',
        category: 'RelyingParty',
        rawXml: '<xml />',
        parsedAt: '2026-04-28T00:00:00.000Z',
      },
    ];

    expect(hasRelyingPartyFile(files)).toBe(true);
    expect(hasRelyingPartyFile(files.slice(0, 1))).toBe(false);
  });
});

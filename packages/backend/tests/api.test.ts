import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';

const baseConfig: AppConfig = {
  backendPort: 4000,
  frontendPort: 5173,
  maxFilesPerUpload: 200,
  maxFileSizeBytes: 5 * 1024 * 1024,
  sessionTtlSeconds: 3600,
  logLevel: 'silent',
};

const apps: Array<Awaited<ReturnType<typeof createApp>>> = [];

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    if (app !== undefined) {
      await app.close();
    }
  }
});

describe('backend API', () => {
  it('returns health status', async () => {
    const app = await newTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('analyzes uploaded XML files successfully', async () => {
    const app = await newTestApp();
    const files = loadFixtureDir('clean');
    const body = buildMultipartBody(
      files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.chains).toHaveLength(1);
    expect(json.files).toHaveLength(3);
    expect(json.parseErrors).toEqual([]);
  });

  it('preserves relative paths from fileManifest entries in the analysis response', async () => {
    const app = await newTestApp();
    const files = loadFixtureDir('clean');
    const body = buildMultipartBody([
      {
        fieldName: 'fileManifest',
        value: JSON.stringify([
          { relativePath: 'tenant-a/TrustFrameworkBase.xml' },
          { relativePath: 'tenant-a/TrustFrameworkExtensions.xml' },
          { relativePath: 'tenant-a/SignUpOrSignIn.xml' },
        ]),
      },
      ...files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.files.map((file: { relativePath?: string }) => file.relativePath)).toEqual([
      'tenant-a/TrustFrameworkBase.xml',
      'tenant-a/TrustFrameworkExtensions.xml',
      'tenant-a/SignUpOrSignIn.xml',
    ]);
  });

  it('returns 400 when no files are attached', async () => {
    const app = await newTestApp();
    const body = buildMultipartBody([]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'No files were attached under the "files" field.',
    });
  });

  it('returns 200 with parseErrors when malformed input is mixed with valid files', async () => {
    const app = await newTestApp();
    const files = [...loadFixtureDir('clean'), ...loadFixtureDir('malformed')];
    const body = buildMultipartBody(
      files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.parseErrors).toHaveLength(1);
    expect(json.chains).toHaveLength(1);
  });

  it('returns distinct parse errors for duplicate basenames from different folders', async () => {
    const app = await newTestApp();
    const body = buildMultipartBody([
      {
        fieldName: 'fileManifest',
        value: JSON.stringify([
          { relativePath: 'tenant-a/Duplicate.xml' },
          { relativePath: 'tenant-b/Duplicate.xml' },
        ]),
      },
      {
        fieldName: 'files',
        fileName: 'Duplicate.xml',
        contentType: 'application/xml',
        content: Buffer.from('<TrustFrameworkPolicy>'),
      },
      {
        fieldName: 'files',
        fileName: 'Duplicate.xml',
        contentType: 'application/xml',
        content: Buffer.from('<TrustFrameworkPolicy><Broken>'),
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.parseErrors).toHaveLength(2);
    expect(json.parseErrors.map((error: { relativePath?: string }) => error.relativePath)).toEqual([
      'tenant-a/Duplicate.xml',
      'tenant-b/Duplicate.xml',
    ]);
  });

  it('resolves settings placeholders from an optional appsettings.json upload', async () => {
    const app = await newTestApp();
    const files = loadFixtureDir('clean').map((file) =>
      file.fileName === 'TrustFrameworkExtensions.xml'
        ? {
            ...file,
            content: Buffer.from(
              file.content
                .toString('utf-8')
                .replace(
                  'https://api.contoso.com/loyalty',
                  'https://{Settings:Tenant}/{Settings:PolicyFilename}',
                ),
            ),
          }
        : file,
    );
    const body = buildMultipartBody([
      ...files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
      {
        fieldName: 'appsettings',
        fileName: 'appsettings.json',
        contentType: 'application/json',
        content: Buffer.from(
          JSON.stringify({
            Environments: [
              { Name: 'Production', Production: true, Tenant: 'prod.contoso.onmicrosoft.com' },
              { Name: 'Development', Tenant: 'dev.contoso.onmicrosoft.com' },
            ],
          }),
        ),
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.chains[0]?.externalDependencies[0]?.url).toBe(
      'https://dev.contoso.onmicrosoft.com/TrustFrameworkExtensions',
    );
  });

  it('returns 400 when appsettings.json is invalid', async () => {
    const app = await newTestApp();
    const files = loadFixtureDir('clean');
    const body = buildMultipartBody([
      ...files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
      {
        fieldName: 'appsettings',
        fileName: 'appsettings.json',
        contentType: 'application/json',
        content: Buffer.from('{invalid'),
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: expect.stringContaining('Invalid appsettings.json:'),
    });
  });

  it('returns 400 when appsettings.json exceeds the route size limit', async () => {
    const app = await newTestApp();
    const files = loadFixtureDir('clean');
    const body = buildMultipartBody([
      ...files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
      {
        fieldName: 'appsettings',
        fileName: 'appsettings.json',
        contentType: 'application/json',
        content: Buffer.alloc(101 * 1024, 'A'),
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'appsettings.json must be under 100 KB.',
    });
  });

  it('returns 400 when fileManifest is not valid JSON', async () => {
    const app = await newTestApp();
    const files = loadFixtureDir('clean');
    const body = buildMultipartBody([
      {
        fieldName: 'fileManifest',
        value: '{not-json',
      },
      ...files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'Invalid fileManifest JSON.',
    });
  });

  it('returns 400 when fileManifest entry count does not match uploaded files', async () => {
    const app = await newTestApp();
    const files = loadFixtureDir('clean');
    const body = buildMultipartBody([
      {
        fieldName: 'fileManifest',
        value: JSON.stringify([{ relativePath: 'tenant-a/TrustFrameworkBase.xml' }]),
      },
      ...files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'fileManifest entry count must match the number of uploaded files.',
    });
  });

  it('returns 413 when the upload exceeds the max file count', async () => {
    const app = await newTestApp({
      ...baseConfig,
      maxFilesPerUpload: 2,
    });
    const files = loadFixtureDir('clean');
    const body = buildMultipartBody(
      files.map((file) => ({
        fieldName: 'files',
        fileName: file.fileName,
        contentType: 'application/xml',
        content: file.content,
      })),
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: 'TOO_MANY_FILES',
      message: 'Cannot upload more than 2 files.',
    });
  });

  it('returns 413 when an uploaded file exceeds the size limit', async () => {
    const app = await newTestApp({
      ...baseConfig,
      maxFileSizeBytes: 1024,
    });
    const oversizedContent = Buffer.alloc(2048, 'A');
    const body = buildMultipartBody([
      {
        fieldName: 'files',
        fileName: 'TooLarge.xml',
        contentType: 'application/xml',
        content: oversizedContent,
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: body.payload,
      headers: body.headers,
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: 'FILE_TOO_LARGE',
      message: 'One or more files exceeded the 1024 byte size limit.',
    });
  });

  it('returns the bundled sample analysis result', async () => {
    const app = await newTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/sample',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.chains).toHaveLength(12);
    expect(json.files).toHaveLength(20);
    expect(json.stats.policyChains).toBe(12);
    expect(json.stats.userJourneys).toBe(12);
    expect(json.parseErrors).toEqual([]);
  });
});

async function newTestApp(config: AppConfig = baseConfig) {
  const app = await createApp({ config });
  apps.push(app);
  return app;
}

function loadFixtureDir(name: string): Array<{ fileName: string; content: Buffer }> {
  const dir = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
  return readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.xml'))
    .sort()
    .map((fileName) => ({
      fileName,
      content: readFileSync(join(dir, fileName)),
    }));
}

function buildMultipartBody(
  parts: Array<
    | {
        fieldName: string;
        fileName: string;
        contentType: string;
        content: Buffer;
      }
    | {
        fieldName: string;
        value: string;
      }
  >,
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = '----codex-phase4-boundary';
  const buffers: Buffer[] = [];

  for (const part of parts) {
    if ('value' in part) {
      buffers.push(
        Buffer.from(
          `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="${part.fieldName}"\r\n\r\n` +
            `${part.value}\r\n`,
        ),
      );
      continue;
    }

    buffers.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${part.fieldName}"; filename="${part.fileName}"\r\n` +
          `Content-Type: ${part.contentType}\r\n\r\n`,
      ),
    );
    buffers.push(part.content);
    buffers.push(Buffer.from('\r\n'));
  }

  buffers.push(Buffer.from(`--${boundary}--\r\n`));
  const payload = Buffer.concat(buffers);

  return {
    payload,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'content-length': String(payload.byteLength),
    },
  };
}

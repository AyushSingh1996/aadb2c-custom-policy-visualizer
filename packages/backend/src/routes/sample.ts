import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { runAnalysis } from '../engine/pipeline.js';
import type { UploadedFile } from '../engine/types.js';
import type { SessionStore } from '../session-store.js';

export interface SampleRouteOptions {
  sampleDir: string;
  sessionStore: SessionStore;
}

export async function registerSampleRoute(
  app: FastifyInstance,
  options: SampleRouteOptions,
): Promise<void> {
  app.get('/api/sample', async (_request, reply) => {
    const uploadedFiles = await loadSampleFiles(options.sampleDir);
    const result = await runAnalysis(uploadedFiles);
    options.sessionStore.save(result);
    return reply.send(result);
  });
}

async function loadSampleFiles(sampleDir: string): Promise<UploadedFile[]> {
  const directory = resolve(sampleDir);
  const entries = (await readdir(directory))
    .filter((fileName) => fileName.toLowerCase().endsWith('.xml'))
    .sort();

  return Promise.all(
    entries.map(async (fileName) => {
      const filePath = join(directory, fileName);
      const [content, fileStats] = await Promise.all([readFile(filePath), stat(filePath)]);
      return {
        fileName,
        buffer: content,
        sizeBytes: fileStats.size,
        lastModified: fileStats.mtime.toISOString(),
      };
    }),
  );
}

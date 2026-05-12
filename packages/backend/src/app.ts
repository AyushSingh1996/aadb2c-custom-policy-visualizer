import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { loadConfig, type AppConfig } from './config.js';
import { AppError, isAppError } from './errors.js';
import { registerAnalyzeRoute } from './routes/analyze.js';
import { registerHealthRoute } from './routes/health.js';
import { registerSampleRoute } from './routes/sample.js';
import { createSessionStore } from './session-store.js';

export interface CreateAppOptions {
  config?: AppConfig;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    logger: { level: config.logLevel },
  });
  const sessionStore = createSessionStore(config.sessionTtlSeconds);

  await app.register(cors, {
    origin: `http://localhost:${config.frontendPort}`,
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: config.maxFilesPerUpload + 1,
    },
  });

  await registerHealthRoute(app);
  await registerAnalyzeRoute(app, {
    maxFilesPerUpload: config.maxFilesPerUpload,
    maxFileSizeBytes: config.maxFileSizeBytes,
    sessionStore,
  });
  await registerSampleRoute(app, {
    sampleDir: join(__dirname, '../samples'),
    sessionStore,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      reply.status(error.statusCode).send({
        error: error.errorCode,
        message: error.message,
      });
      return;
    }

    if (isMultipartFileLimitError(error)) {
      const errorCode = readMultipartLimitCode(error);
      reply.status(413).send({
        error:
          errorCode === 'FST_FILES_LIMIT' || errorCode === 'FST_PARTS_LIMIT'
            ? 'TOO_MANY_FILES'
            : 'FILE_TOO_LARGE',
        message:
          errorCode === 'FST_FILES_LIMIT' || errorCode === 'FST_PARTS_LIMIT'
            ? `Cannot upload more than ${config.maxFilesPerUpload} files.`
            : `One or more files exceeded the ${config.maxFileSizeBytes} byte size limit.`,
      });
      return;
    }

    app.log.error(error);
    reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Analysis failed unexpectedly. Please try again or report this.',
    });
  });

  app.addHook('onClose', async () => {
    sessionStore.close();
  });

  return app;
}

function isMultipartFileLimitError(error: unknown): boolean {
  const code = readMultipartLimitCode(error);
  return ['FST_REQ_FILE_TOO_LARGE', 'FST_FILES_LIMIT', 'FST_PARTS_LIMIT'].includes(code ?? '');
}

function readMultipartLimitCode(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code?: string }).code
    : undefined;
}

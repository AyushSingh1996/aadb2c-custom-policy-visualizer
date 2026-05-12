import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await createApp({ config });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const indexHtml = path.join(publicDir, 'index.html');

app.log.info(
  { publicDir, indexHtml, publicDirExists: existsSync(publicDir), indexExists: existsSync(indexHtml), NODE_ENV: process.env['NODE_ENV'] },
  'static serving check'
);

if (process.env['NODE_ENV'] === 'production') {
  try {
    await app.register(fastifyStatic, { root: publicDir, prefix: '/' });

    // SPA fallback: non-API routes serve index.html so React Router works.
    // Use createReadStream directly — reply.sendFile() inside setNotFoundHandler
    // triggers a recursive callNotFound() loop in @fastify/static.
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: `Route ${request.url} not found`,
        });
      }
      return reply.type('text/html').send(createReadStream(indexHtml));
    });

    app.log.info({ publicDir }, 'static file serving registered');
  } catch (err) {
    app.log.error({ err, publicDir }, 'failed to register static file serving');
  }
}

try {
  await app.listen({ port: config.backendPort, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

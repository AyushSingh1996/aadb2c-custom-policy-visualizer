export interface AppConfig {
  backendPort: number;
  frontendPort: number;
  maxFilesPerUpload: number;
  maxFileSizeBytes: number;
  sessionTtlSeconds: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    backendPort: readInt(env['BACKEND_PORT'], 4000),
    frontendPort: readInt(env['FRONTEND_PORT'], 5173),
    maxFilesPerUpload: readInt(env['MAX_FILES_PER_UPLOAD'], 200),
    maxFileSizeBytes: readInt(env['MAX_FILE_SIZE_BYTES'], 5 * 1024 * 1024),
    sessionTtlSeconds: readInt(env['SESSION_TTL_SECONDS'], 3600),
    logLevel: readLogLevel(env['LOG_LEVEL']),
  };
}

function readInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readLogLevel(value: string | undefined): AppConfig['logLevel'] {
  switch (value) {
    case 'fatal':
    case 'error':
    case 'warn':
    case 'info':
    case 'debug':
    case 'trace':
    case 'silent':
      return value;
    default:
      return 'info';
  }
}

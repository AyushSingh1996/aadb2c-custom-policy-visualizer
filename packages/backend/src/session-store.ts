import type { AnalysisResult } from '@policy-analyzer/shared';

export interface SessionStore {
  save(result: AnalysisResult): void;
  get(sessionId: string): AnalysisResult | undefined;
  close(): void;
}

export function createSessionStore(ttlSeconds: number): SessionStore {
  const ttlMs = ttlSeconds * 1000;
  const sessions = new Map<string, { result: AnalysisResult; expiresAt: number }>();

  const interval = setInterval(() => {
    sweepExpired(sessions, Date.now());
  }, 60_000);
  interval.unref();

  return {
    save(result) {
      sessions.set(result.sessionId, {
        result,
        expiresAt: Date.now() + ttlMs,
      });
    },
    get(sessionId) {
      const entry = sessions.get(sessionId);
      if (entry === undefined) return undefined;
      if (entry.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return undefined;
      }
      return entry.result;
    },
    close() {
      clearInterval(interval);
      sessions.clear();
    },
  };
}

function sweepExpired(
  sessions: Map<string, { result: AnalysisResult; expiresAt: number }>,
  now: number,
): void {
  for (const [sessionId, entry] of sessions) {
    if (entry.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}

import type { DailyRoutineResponse } from '@uaqa/contracts';
import { ROUTINES_CACHE_TTL_MS } from './routines.constants.ts';

interface RoutineCacheEntry {
  readonly response: DailyRoutineResponse;
  readonly cachedAtMs: number;
}

export class RoutinesCacheRepository {
  private readonly entries = new Map<string, RoutineCacheEntry>();
  private readonly ttlMs: number;
  private readonly nowMs: () => number;

  public constructor(options?: { readonly ttlMs?: number; readonly nowMs?: () => number }) {
    this.ttlMs = options?.ttlMs ?? ROUTINES_CACHE_TTL_MS;
    this.nowMs = options?.nowMs ?? (() => Date.now());
  }

  public getFresh(cacheKey: string): DailyRoutineResponse | null {
    const entry = this.entries.get(cacheKey);
    if (!entry) {
      return null;
    }
    if (this.nowMs() - entry.cachedAtMs > this.ttlMs) {
      this.entries.delete(cacheKey);
      return null;
    }
    return {
      ...entry.response,
      cachedResult: true,
    };
  }

  public set(cacheKey: string, response: DailyRoutineResponse): void {
    this.entries.set(cacheKey, {
      response,
      cachedAtMs: this.nowMs(),
    });
  }

  public invalidateOwner(ownerUid: string): void {
    const prefix = `${ownerUid}::`;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }
}

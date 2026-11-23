import type { IndoorAirGuidanceResponse } from '@uaqa/contracts';
import { INDOOR_CACHE_TTL_MS } from './indoor.constants.ts';

interface IndoorCacheEntry {
  readonly response: IndoorAirGuidanceResponse;
  readonly cachedAtMs: number;
}

export class IndoorCacheRepository {
  private readonly entries = new Map<string, IndoorCacheEntry>();
  private readonly ttlMs: number;
  private readonly nowMs: () => number;

  public constructor(options?: { readonly ttlMs?: number; readonly nowMs?: () => number }) {
    this.ttlMs = options?.ttlMs ?? INDOOR_CACHE_TTL_MS;
    this.nowMs = options?.nowMs ?? (() => Date.now());
  }

  public getFresh(cacheKey: string): IndoorAirGuidanceResponse | null {
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

  public set(cacheKey: string, response: IndoorAirGuidanceResponse): void {
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

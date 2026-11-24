import type { SustainableAlternativesResponse } from '@uaqa/contracts';
import { ALTERNATIVES_CACHE_TTL_MS } from './alternatives.constants.ts';

interface AlternativesCacheEntry {
  readonly response: SustainableAlternativesResponse;
  readonly cachedAtMs: number;
}

const MAX_CACHE_ENTRIES = 500;

export class AlternativesCacheRepository {
  private readonly entries = new Map<string, AlternativesCacheEntry>();
  private readonly ttlMs: number;
  private readonly nowMs: () => number;

  public constructor(options?: { readonly ttlMs?: number; readonly nowMs?: () => number }) {
    this.ttlMs = options?.ttlMs ?? ALTERNATIVES_CACHE_TTL_MS;
    this.nowMs = options?.nowMs ?? (() => Date.now());
  }

  public getFresh(cacheKey: string): SustainableAlternativesResponse | null {
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

  public set(cacheKey: string, response: SustainableAlternativesResponse): void {
    if (this.entries.size >= MAX_CACHE_ENTRIES && !this.entries.has(cacheKey)) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
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

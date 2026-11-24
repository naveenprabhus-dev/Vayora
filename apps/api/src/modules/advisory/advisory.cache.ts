import { ADVISORY_CACHE_TTL_MS } from './advisory.constants.ts';

interface CachedAdvisoryEntry<T> {
  readonly value: T;
  readonly expiresAtMs: number;
}

export class AdvisoryCacheRepository {
  private readonly store = new Map<string, CachedAdvisoryEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly ttlMs: number;

  public constructor(ttlMs = ADVISORY_CACHE_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  public getFresh<T>(key: string, nowMs = Date.now()): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (nowMs >= entry.expiresAtMs) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public set<T>(key: string, value: T, nowMs = Date.now()): void {
    this.store.set(key, {
      value,
      expiresAtMs: nowMs + this.ttlMs,
    });
  }

  public invalidateOwner(ownerUid: string): void {
    const prefix = `${ownerUid}::`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  public clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }

  public hasInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  public runCoalesced<T>(key: string, producer: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = producer().finally(() => {
      if (this.inFlight.get(key) === promise) {
        this.inFlight.delete(key);
      }
    });

    this.inFlight.set(key, promise);
    return promise;
  }
}

import type { AdvisoryOperationalMetrics } from '@uaqa/contracts';

export class AdvisoryMetricsTracker {
  private geminiRequests = 0;
  private geminiSuccesses = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private coalescedRequests = 0;
  private timeouts = 0;
  private validationFailures = 0;
  private fallbackCount = 0;
  private totalLatencyMs = 0;
  private latencySamples = 0;
  private totalTokensUsed = 0;
  private lastFallbackReason: string | null = null;

  public recordCacheHit(): void {
    this.cacheHits += 1;
  }

  public recordCacheMiss(): void {
    this.cacheMisses += 1;
  }

  public recordCoalescedRequest(): void {
    this.coalescedRequests += 1;
  }

  public recordGeminiAttempt(): void {
    this.geminiRequests += 1;
  }

  public recordGeminiSuccess(latencyMs: number, tokensUsed: number | null): void {
    this.geminiSuccesses += 1;
    this.recordLatency(latencyMs);
    if (typeof tokensUsed === 'number' && Number.isFinite(tokensUsed) && tokensUsed >= 0) {
      this.totalTokensUsed += tokensUsed;
    }
  }

  public recordTimeout(latencyMs: number, reason: string): void {
    this.timeouts += 1;
    this.fallbackCount += 1;
    this.lastFallbackReason = reason;
    this.recordLatency(latencyMs);
  }

  public recordValidationFailure(latencyMs: number, reason: string): void {
    this.validationFailures += 1;
    this.fallbackCount += 1;
    this.lastFallbackReason = reason;
    this.recordLatency(latencyMs);
  }

  public recordFallback(latencyMs: number, reason: string): void {
    this.fallbackCount += 1;
    this.lastFallbackReason = reason;
    this.recordLatency(latencyMs);
  }

  private recordLatency(latencyMs: number): void {
    if (Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.totalLatencyMs += latencyMs;
      this.latencySamples += 1;
    }
  }

  public snapshot(): AdvisoryOperationalMetrics {
    return {
      geminiRequests: this.geminiRequests,
      geminiSuccesses: this.geminiSuccesses,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      coalescedRequests: this.coalescedRequests,
      timeouts: this.timeouts,
      validationFailures: this.validationFailures,
      fallbackCount: this.fallbackCount,
      averageLatencyMs:
        this.latencySamples > 0 ? Math.round(this.totalLatencyMs / this.latencySamples) : 0,
      totalTokensUsed: this.totalTokensUsed,
      lastFallbackReason: this.lastFallbackReason,
    };
  }
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {}

  check(key: string): RateLimitDecision {
    const now = Date.now();
    this.pruneExpired(now);
    const entry = this.entries.get(key);

    if (!entry || entry.resetAt <= now) {
      return {
        allowed: true,
        remaining: this.maxRequests,
        retryAfterSeconds: 0,
      };
    }

    return {
      allowed: entry.count < this.maxRequests,
      remaining: Math.max(0, this.maxRequests - entry.count),
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
    };
  }

  consume(key: string): RateLimitDecision {
    const now = Date.now();
    this.pruneExpired(now);
    const entry = this.entries.get(key);
    const activeEntry =
      entry && entry.resetAt > now
        ? entry
        : {
            count: 0,
            resetAt: now + this.windowMs,
          };

    activeEntry.count += 1;
    this.entries.set(key, activeEntry);

    return {
      allowed: activeEntry.count <= this.maxRequests,
      remaining: Math.max(0, this.maxRequests - activeEntry.count),
      retryAfterSeconds: Math.max(1, Math.ceil((activeEntry.resetAt - now) / 1_000)),
    };
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private pruneExpired(now: number): void {
    if (this.entries.size < 10_000) {
      return;
    }

    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

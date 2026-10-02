/**
 * Rate Limiter for Authentication Routes to prevent brute-force attacks.
 */

export interface RateLimitStatus {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

export class AuthRateLimiter {
  private attempts = new Map<string, { count: number; resetTime: number }>();
  private readonly windowMs: number;
  private readonly maxAttempts: number;

  /**
   * @param windowMs Time window in milliseconds (default: 60,000ms / 1 min)
   * @param maxAttempts Max allowed failed attempts in window before blocking (default: 5)
   */
  constructor(windowMs = 60000, maxAttempts = 5) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;

    // Periodic sweep to prevent unbounded memory growth
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.cleanup(), 60000);
      if (timer.unref) timer.unref();
    }
  }

  /**
   * Check if a key (IP or identifier) is currently blocked.
   */
  public check(key: string): RateLimitStatus {
    const now = Date.now();
    const entry = this.attempts.get(key);

    if (!entry || now >= entry.resetTime) {
      return {
        allowed: true,
        remainingAttempts: this.maxAttempts,
        retryAfterSeconds: 0
      };
    }

    if (entry.count >= this.maxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds: retryAfter
      };
    }

    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - entry.count,
      retryAfterSeconds: 0
    };
  }

  /**
   * Record a failed authentication attempt.
   */
  public recordFailure(key: string): RateLimitStatus {
    const now = Date.now();
    let entry = this.attempts.get(key);

    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + this.windowMs
      };
      this.attempts.set(key, entry);
    } else {
      entry.count += 1;
    }

    const retryAfter = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    const allowed = entry.count < this.maxAttempts;
    const remaining = Math.max(0, this.maxAttempts - entry.count);

    return {
      allowed,
      remainingAttempts: remaining,
      retryAfterSeconds: allowed ? 0 : retryAfter
    };
  }

  /**
   * Reset attempts on successful login.
   */
  public recordSuccess(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clear all records (useful for testing).
   */
  public clear(): void {
    this.attempts.clear();
  }

  /**
   * Purge expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (now >= entry.resetTime) {
        this.attempts.delete(key);
      }
    }
  }
}

// Global instance for authentication endpoints
export const authRateLimiter = new AuthRateLimiter(60000, 5);

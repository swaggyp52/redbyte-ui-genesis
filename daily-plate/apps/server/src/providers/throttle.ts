/** Conservative token bucket per provider, plus a Retry-After hold. */
export class Throttle {
  private tokens: number;
  private lastRefill: number;
  private blockedUntil = 0;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.tokens = capacity;
    this.lastRefill = now();
  }

  private refill(): void {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + (t - this.lastRefill) * this.refillPerMs);
    this.lastRefill = t;
  }

  /** Returns true and consumes a token when a request may proceed. */
  take(): boolean {
    if (this.now() < this.blockedUntil) return false;
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  hold(ms: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + ms);
  }

  get available(): number {
    this.refill();
    return this.now() < this.blockedUntil ? 0 : Math.floor(this.tokens);
  }
}

/** USDA documents 1,000/hour/IP; we allow far less. */
export const usdaThrottle = (): Throttle => new Throttle(30, 200 / 3_600_000);
/** Open Food Facts documents 15 product reads per minute per IP. */
export const offThrottle = (): Throttle => new Throttle(5, 10 / 60_000);

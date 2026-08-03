import { afterEach, describe, expect, it } from "vitest";
import { clientIpFromHeaders, rateLimit, rateLimitPeek, resetRateLimitStore } from "./rateLimit";

afterEach(() => {
  resetRateLimitStore();
});

describe("rateLimit", () => {
  it("allows the first request and decrements remaining", () => {
    const r = rateLimit("10.0.0.1", { limit: 3, windowMs: 60_000, now: 1_000 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    expect(r.limit).toBe(3);
    expect(r.retryAfterSec).toBe(0);
  });

  it("allows up to the limit then rejects", () => {
    const key = "10.0.0.2";
    const opts = { limit: 3, windowMs: 60_000, now: 5_000 } as const;
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    const blocked = rateLimit(key, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });

  it("isolates keys", () => {
    const opts = { limit: 1, windowMs: 60_000, now: 10_000 };
    expect(rateLimit("a", opts).allowed).toBe(true);
    expect(rateLimit("a", opts).allowed).toBe(false);
    expect(rateLimit("b", opts).allowed).toBe(true);
  });

  it("slides the window so old hits expire", () => {
    const key = "slide";
    const windowMs = 1_000;
    const limit = 2;
    expect(rateLimit(key, { limit, windowMs, now: 0 }).allowed).toBe(true);
    expect(rateLimit(key, { limit, windowMs, now: 100 }).allowed).toBe(true);
    // Still inside window — blocked
    expect(rateLimit(key, { limit, windowMs, now: 500 }).allowed).toBe(false);
    // After first hit (t=0) leaves window at t=1000; at t=1001 only hit@100 remains
    const after = rateLimit(key, { limit, windowMs, now: 1_001 });
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(0); // 1 prior + this hit = 2
  });

  it("retryAfterSec reflects time until oldest hit expires", () => {
    const key = "retry";
    const windowMs = 10_000;
    const limit = 1;
    rateLimit(key, { limit, windowMs, now: 0 });
    const blocked = rateLimit(key, { limit, windowMs, now: 2_500 });
    expect(blocked.allowed).toBe(false);
    // 0 + 10000 - 2500 = 7500 ms → ceil → 8s
    expect(blocked.retryAfterSec).toBe(8);
  });

  it("defaults to 30/min", () => {
    const r = rateLimit("defaults", { now: 1 });
    expect(r.limit).toBe(30);
    expect(r.windowMs).toBe(60_000);
    expect(r.allowed).toBe(true);
  });

  it("treats blank keys as unknown", () => {
    expect(rateLimit("  ", { limit: 1, windowMs: 60_000, now: 1 }).allowed).toBe(true);
    expect(rateLimit("", { limit: 1, windowMs: 60_000, now: 1 }).allowed).toBe(false);
  });
});

describe("rateLimitPeek", () => {
  it("does not consume quota", () => {
    const key = "peek";
    const opts = { limit: 1, windowMs: 60_000, now: 50 };
    expect(rateLimitPeek(key, opts).allowed).toBe(true);
    expect(rateLimitPeek(key, opts).remaining).toBe(1);
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimitPeek(key, opts).allowed).toBe(false);
  });
});

describe("clientIpFromHeaders", () => {
  it("uses the first X-Forwarded-For hop", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.1");
  });

  it("falls back to X-Real-IP", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.9" });
    expect(clientIpFromHeaders(h)).toBe("198.51.100.9");
  });

  it("prefers X-Forwarded-For over X-Real-IP", () => {
    const h = new Headers({
      "x-forwarded-for": "203.0.113.5",
      "x-real-ip": "198.51.100.9",
    });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.5");
  });

  it("returns unknown when no IP headers", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

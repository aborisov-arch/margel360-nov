// MVP rate limiter — intentionally scoped to a single Deno isolate.
// Supabase spins up multiple isolates under burst load, so this Map is
// per-instance and DOES NOT provide global rate limiting. It only helps
// against a client hammering one warm instance with sequential requests.
//
// Real abuse protection for the edit flow comes from:
//   1. The DB-side edit_count cap (see update-enquiry-by-token).
//   2. Supabase's platform-level edge-function request limits.
//
// Upgrade path if distributed limiting is needed: back this with Upstash
// Redis or a `rate_limit` Postgres table keyed on (key, window_start).
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): {
  ok: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  b.count += 1;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

export function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? req.headers.get("cf-connecting-ip")
      ?? "unknown";
}

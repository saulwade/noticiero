import { timingSafeEqual } from "node:crypto";
import { auth } from "@/auth";
export function localHost(host: string | null): boolean {
  return (
    !process.env.VERCEL &&
    Boolean(host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))
  );
}
export function validCron(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const received = request.headers.get("authorization");
  if (!expected || !received) return false;
  const a = Buffer.from(received),
    b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function allowed(request: Request): Promise<boolean> {
  if (localHost(request.headers.get("host"))) return true;
  if (!process.env.AUTH_SECRET || !process.env.AUTH_ALLOWED_GITHUB_ID)
    return false;
  try {
    return Boolean((await auth())?.user);
  } catch {
    return false;
  }
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

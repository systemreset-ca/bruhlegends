import { timingSafeEqual } from "node:crypto";

export const SCHEDULER_SECRET_HEADER = "x-bruh-scheduler-secret";
export const SCHEDULER_SECRET_MIN_LENGTH = 32;

/**
 * Authenticate maintenance requests with a dedicated server-only credential.
 * Public Supabase client keys must never authorize privileged background work.
 */
export function isAuthorizedSchedulerRequest(request: Request): boolean {
  const expected = process.env["BRUH_SCHEDULER_SECRET"];
  const provided = request.headers.get(SCHEDULER_SECRET_HEADER);

  if (!expected || expected.length < SCHEDULER_SECRET_MIN_LENGTH || !provided) {
    return false;
  }

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)
  );
}

import { afterEach, describe, expect, it } from "vitest";
import {
  isAuthorizedSchedulerRequest,
  SCHEDULER_SECRET_HEADER,
} from "../src/lib/scheduler-auth.server";

const SECRET = "bruh-test-scheduler-secret-at-least-32-characters";

function schedulerRequest(secret?: string): Request {
  return new Request("https://bruh.tips/api/public/hooks/verify-tips", {
    method: "POST",
    headers: secret ? { [SCHEDULER_SECRET_HEADER]: secret } : undefined,
  });
}

afterEach(() => {
  delete process.env["BRUH_SCHEDULER_SECRET"];
  delete process.env["SUPABASE_PUBLISHABLE_KEY"];
  delete process.env["SUPABASE_ANON_KEY"];
});

describe("scheduler authentication", () => {
  it("fails closed when the dedicated server secret is not configured", () => {
    expect(isAuthorizedSchedulerRequest(schedulerRequest(SECRET))).toBe(false);
  });

  it("rejects missing, incorrect, and undersized credentials", () => {
    process.env["BRUH_SCHEDULER_SECRET"] = SECRET;
    expect(isAuthorizedSchedulerRequest(schedulerRequest())).toBe(false);
    expect(isAuthorizedSchedulerRequest(schedulerRequest(`${SECRET}-wrong`))).toBe(false);

    process.env["BRUH_SCHEDULER_SECRET"] = "too-short";
    expect(isAuthorizedSchedulerRequest(schedulerRequest("too-short"))).toBe(false);
  });

  it("does not accept public Supabase keys", () => {
    process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_public-client-key";
    process.env["SUPABASE_ANON_KEY"] = "public-anon-client-key";

    expect(
      isAuthorizedSchedulerRequest(schedulerRequest(process.env["SUPABASE_PUBLISHABLE_KEY"])),
    ).toBe(false);
    expect(isAuthorizedSchedulerRequest(schedulerRequest(process.env["SUPABASE_ANON_KEY"]))).toBe(
      false,
    );
  });

  it("accepts only the exact dedicated secret", () => {
    process.env["BRUH_SCHEDULER_SECRET"] = SECRET;
    expect(isAuthorizedSchedulerRequest(schedulerRequest(SECRET))).toBe(true);
  });
});

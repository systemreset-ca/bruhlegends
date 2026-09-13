import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("../src/lib/db.server", () => ({ admin: mocks.admin }));
import {
  loadParticipation,
  awardParticipation,
  processParticipationJobs,
} from "../src/lib/participation.server";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("participation deployment gate", () => {
  it("disabled reads do not touch an unapplied database or RPC provider", async () => {
    vi.stubEnv("BRUH_PARTICIPATION_STORAGE_ENABLED", "false");
    expect(await loadParticipation("group", "member")).toEqual({
      storageReady: false,
      earningEnabled: false,
      totalPoints: 0,
      pendingTips: 0,
      tipsNeedingReview: 0,
      events: [],
      seasons: [],
    });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects writes while the storage gate is absent or malformed", async () => {
    vi.stubEnv("BRUH_PARTICIPATION_STORAGE_ENABLED", "TRUE");
    await expect(
      awardParticipation({
        seasonId: "season",
        membershipId: "member",
        sourceKind: "tip_sent",
        sourceId: "tip",
      }),
    ).rejects.toThrow("disabled");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not turn a failed membership lookup into a zero balance", async () => {
    vi.stubEnv("BRUH_PARTICIPATION_STORAGE_ENABLED", "true");
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ error: { message: "private provider details" } }),
    };
    mocks.admin.mockResolvedValue({ from: () => query });
    await expect(loadParticipation("group", "member")).rejects.toThrow("membership lookup failed");
  });
});

function ledger(total: unknown, paused = false) {
  const membership = {
    data: {
      group_id: "group",
      is_banned: false,
      participation_opt_out: false,
      groups: { is_paused: paused, removed_at: null },
    },
  };
  const table = (name: string) => {
    const result =
      name === "group_members"
        ? membership
        : {
            data:
              name === "participation_events"
                ? Array.from({ length: 50 }, (_, i) => ({ id: String(i), points: 1 }))
                : [
                    {
                      status: "active",
                      starts_at: new Date(Date.now() - 10000).toISOString(),
                      ends_at: new Date(Date.now() + 10000).toISOString(),
                    },
                  ],
          };
    const promise = Promise.resolve(result);
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: () => promise,
      then: promise.then.bind(promise),
    };
    return q;
  };
  mocks.admin.mockResolvedValue({
    from: table,
    rpc: (fn: string) =>
      Promise.resolve({
        data: fn === "participation_member_total" ? total : { pending: 2, needsReview: 1 },
      }),
  });
}

describe("participation ledger state", () => {
  it("reports a complete total rather than summing its bounded history", async () => {
    vi.stubEnv("BRUH_PARTICIPATION_STORAGE_ENABLED", "true");
    ledger(500);
    const summary = await loadParticipation("group", "member");
    expect(summary.totalPoints).toBe(500);
    expect(summary.events).toHaveLength(50);
    expect(summary.pendingTips).toBe(2);
    expect(summary.tipsNeedingReview).toBe(1);
  });
  it("keeps history readable while a group pause disables earning", async () => {
    vi.stubEnv("BRUH_PARTICIPATION_STORAGE_ENABLED", "true");
    ledger(500, true);
    expect((await loadParticipation("group", "member")).earningEnabled).toBe(false);
  });
  it("rejects a malformed successful total rather than showing zero", async () => {
    vi.stubEnv("BRUH_PARTICIPATION_STORAGE_ENABLED", "true");
    ledger(null);
    await expect(loadParticipation("group", "member")).rejects.toThrow(
      "Invalid participation total",
    );
  });
  it("the disabled worker creates no database calls or outbound traffic", async () => {
    vi.stubEnv("BRUH_PARTICIPATION_STORAGE_ENABLED", "false");
    expect(await processParticipationJobs()).toEqual({ processed: 0, failed: 0 });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
});

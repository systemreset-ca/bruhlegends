import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  sweep: vi.fn(),
  points: vi.fn(),
  announce: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("../src/lib/db.server", () => ({ admin: mocks.admin }));
vi.mock("../src/lib/tips.server", () => ({ sweepTipIntents: mocks.sweep }));
vi.mock("../src/lib/participation.server", () => ({ processParticipationJobs: mocks.points }));
vi.mock("../src/lib/scheduler-auth.server", () => ({ isAuthorizedSchedulerRequest: () => true }));
vi.mock("../src/lib/telegram.server", () => ({ escapeHtml: (value: string) => value }));
vi.mock("../src/lib/announce.server", () => ({
  dispatchAnnouncement: mocks.announce,
  loadGroupAnnounceSettings: async () => ({}),
  publicName: () => "sender",
}));
import { Route } from "../src/routes/api/public/hooks/verify-tips";
const handler = (
  Route as unknown as {
    server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.sweep.mockResolvedValue({ checked: 1, confirmed: [{ intentId: "tip" }], expired: 0 });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: "tip",
        group_id: "group",
        privacy: "public",
        amount_display: "1",
        asset_symbol: "SOL",
        sender_membership_id: "sender",
        recipient_membership_id: "recipient",
      },
    }),
    in: vi.fn().mockResolvedValue({
      data: [
        { id: "sender", display_name: "Alice" },
        { id: "recipient", display_name: "Bob" },
      ],
    }),
  };
  mocks.admin.mockResolvedValue({ from: () => query });
  mocks.announce.mockResolvedValue("send");
});
describe("tip notification failure boundary", () => {
  it("announces confirmed tips before points processing and reports an outage without leaking errors", async () => {
    mocks.points.mockImplementation(async () => {
      expect(mocks.announce).toHaveBeenCalledOnce();
      throw new Error("sensitive database diagnostic");
    });
    const response = await handler({
      request: new Request("https://example.test", { method: "POST" }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      confirmed: 1,
      announced: 1,
      participationAvailable: false,
      participationProcessed: null,
      participationFailed: null,
    });
    expect(JSON.stringify(body)).not.toContain("sensitive");
  });
  it("returns successful worker counts without changing the tip result", async () => {
    mocks.points.mockResolvedValue({ processed: 3, failed: 1 });
    const body = await (
      await handler({ request: new Request("https://example.test", { method: "POST" }) })
    ).json();
    expect(body).toMatchObject({
      announced: 1,
      participationAvailable: true,
      participationProcessed: 3,
      participationFailed: 1,
    });
  });
});

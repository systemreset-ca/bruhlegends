import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), admin: vi.fn(), ledger: vi.fn() }));
vi.mock("../src/lib/session.server", () => ({ resolveSession: mocks.session }));
vi.mock("../src/lib/db.server", () => ({ admin: mocks.admin }));
vi.mock("../src/lib/participation.server", () => ({ loadParticipation: mocks.ledger }));
import { loadMyParticipation } from "../src/lib/miniapp.server";

beforeEach(() => vi.clearAllMocks());
function membership(telegramUserId: number) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "member-a", group_id: "group-a", telegram_user_id: telegramUserId },
    }),
  };
  mocks.admin.mockResolvedValue({ from: () => query });
}
describe("participation session ownership", () => {
  it("rejects expired identity before accessing membership or history", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(
      loadMyParticipation({ session: "expired", membershipId: "member-a" }),
    ).rejects.toThrow("Session expired");
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.ledger).not.toHaveBeenCalled();
  });
  it("cannot read another Telegram user's membership", async () => {
    mocks.session.mockResolvedValue({ telegramUserId: 1 });
    membership(2);
    await expect(
      loadMyParticipation({ session: "valid", membershipId: "member-a" }),
    ).rejects.toThrow("isn't yours");
    expect(mocks.ledger).not.toHaveBeenCalled();
  });
  it("derives group scope from the owned membership, not client input", async () => {
    mocks.session.mockResolvedValue({ telegramUserId: 1 });
    membership(1);
    mocks.ledger.mockResolvedValue({ totalPoints: 9 });
    await expect(
      loadMyParticipation({ session: "valid", membershipId: "member-a" }),
    ).resolves.toEqual({ totalPoints: 9 });
    expect(mocks.ledger).toHaveBeenCalledWith("group-a", "member-a");
  });
});

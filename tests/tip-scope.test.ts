import { describe, expect, it } from "vitest";
import {
  isTipIntentExpired,
  tipMembershipScopeError,
  type TipMembership,
} from "../src/lib/tips.server";

const GROUP_A = "00000000-0000-4000-8000-000000000001";
const GROUP_B = "00000000-0000-4000-8000-000000000002";
const SENDER = "00000000-0000-4000-8000-000000000003";
const RECIPIENT = "00000000-0000-4000-8000-000000000004";

function member(id: string, groupId: string, isBanned = false): TipMembership {
  return { id, group_id: groupId, is_banned: isBanned };
}

const input = {
  groupId: GROUP_A,
  senderMembershipId: SENDER,
  recipientMembershipId: RECIPIENT,
};

describe("tip membership isolation", () => {
  it("accepts two available memberships from the requested group", () => {
    expect(
      tipMembershipScopeError(input, [member(SENDER, GROUP_A), member(RECIPIENT, GROUP_A)]),
    ).toBeNull();
  });

  it("rejects a recipient membership from another group", () => {
    expect(
      tipMembershipScopeError(input, [member(SENDER, GROUP_A), member(RECIPIENT, GROUP_B)]),
    ).toBe("membership_group_mismatch");
  });

  it("rejects a sender membership from another group", () => {
    expect(
      tipMembershipScopeError(input, [member(SENDER, GROUP_B), member(RECIPIENT, GROUP_A)]),
    ).toBe("membership_group_mismatch");
  });

  it("rejects missing and banned memberships", () => {
    expect(tipMembershipScopeError(input, [member(SENDER, GROUP_A)])).toBe(
      "membership_group_mismatch",
    );
    expect(
      tipMembershipScopeError(input, [member(SENDER, GROUP_A), member(RECIPIENT, GROUP_A, true)]),
    ).toBe("membership_unavailable");
  });
});

describe("tip intent expiry", () => {
  const now = Date.parse("2026-09-12T00:00:00.000Z");

  it("expires before or exactly at the deadline", () => {
    expect(isTipIntentExpired("2026-09-11T23:59:59.999Z", now)).toBe(true);
    expect(isTipIntentExpired("2026-09-12T00:00:00.000Z", now)).toBe(true);
  });

  it("keeps a valid future intent and fails closed on an invalid deadline", () => {
    expect(isTipIntentExpired("2026-09-12T00:00:00.001Z", now)).toBe(false);
    expect(isTipIntentExpired("not-a-date", now)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { announceDecision, inQuietHours, publicName } from "../src/lib/announce.server";

const base = {
  id: "g1",
  telegram_chat_id: 1,
  is_paused: false,
  removed_at: null,
  announce_tips: true,
  announcement_mode: "immediate",
  quiet_hours_start: null as number | null,
  quiet_hours_end: null as number | null,
};

const at = (hour: number) => new Date(Date.UTC(2026, 1, 1, hour, 0, 0));

describe("quiet hours", () => {
  it("is off when either bound is missing", () => {
    expect(inQuietHours(null, 6, at(3))).toBe(false);
    expect(inQuietHours(22, null, at(3))).toBe(false);
  });

  it("handles a same-day window", () => {
    expect(inQuietHours(9, 17, at(12))).toBe(true);
    expect(inQuietHours(9, 17, at(8))).toBe(false);
    expect(inQuietHours(9, 17, at(17))).toBe(false);
  });

  it("handles a window that wraps past midnight", () => {
    expect(inQuietHours(22, 6, at(23))).toBe(true);
    expect(inQuietHours(22, 6, at(2))).toBe(true);
    expect(inQuietHours(22, 6, at(12))).toBe(false);
  });
});

describe("announcement gating", () => {
  it("drops everything for removed, paused or unknown groups", () => {
    expect(announceDecision(null, "milestone")).toBe("drop");
    expect(announceDecision({ ...base, removed_at: "2026-01-01" }, "milestone")).toBe("drop");
    expect(announceDecision({ ...base, is_paused: true }, "milestone")).toBe("drop");
  });

  it("respects the per-kind tip switch without touching milestones", () => {
    const group = { ...base, announce_tips: false };
    expect(announceDecision(group, "tip")).toBe("drop");
    expect(announceDecision(group, "milestone")).toBe("send");
  });

  it("queues instead of dropping during quiet hours", () => {
    const group = { ...base, quiet_hours_start: 22, quiet_hours_end: 6 };
    expect(announceDecision(group, "milestone", at(23))).toBe("queue");
    expect(announceDecision(group, "milestone", at(12))).toBe("send");
  });

  it("queues digest modes and drops only when off", () => {
    expect(announceDecision({ ...base, announcement_mode: "hourly" }, "tip")).toBe("queue");
    expect(announceDecision({ ...base, announcement_mode: "daily" }, "tip")).toBe("queue");
    expect(announceDecision({ ...base, announcement_mode: "off" }, "tip")).toBe("drop");
  });
});

describe("tip privacy names", () => {
  const member = { id: "abcdef12", display_name: "@satoshi", pseudonym: "night-owl" };

  it("never leaks a name for private tips", () => {
    expect(publicName("private", member)).toBeNull();
  });

  it("maps each mode to the right public identity", () => {
    expect(publicName("public", member)).toBe("@satoshi");
    expect(publicName("anonymous", member)).toBe("someone");
    expect(publicName("pseudonymous", member)).toBe("night-owl");
    expect(publicName("pseudonymous", { id: "abcdef12" })).toBe("member-abcd");
  });
});

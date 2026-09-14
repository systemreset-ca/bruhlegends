import { describe, expect, it } from "vitest";
import {
  secureActionPasswordError,
  newSecureActionPasswordError,
} from "../src/lib/secure-action-password";

describe("secure action password policy", () => {
  it("accepts lowercase passphrases and spaces without composition requirements", () => {
    expect(secureActionPasswordError("a lowercase passphrase")).toBeNull();
    expect(secureActionPasswordError("abcdefghijklmno", "abcdefghijklmno")).toBeNull();
  });
  it("identifies length, byte limits and exact confirmation mismatch", () => {
    expect(secureActionPasswordError("a".repeat(14))).toContain("at least 15");
    expect(secureActionPasswordError("a".repeat(129))).toContain("128");
    expect(secureActionPasswordError("界".repeat(86))).toContain("256 UTF-8 bytes");
    expect(secureActionPasswordError("界".repeat(85))).toBeNull();
    expect(secureActionPasswordError("abcdefghijklmno", "abcdefghijklmno ")).toContain(
      "match exactly",
    );
  });
});

it("enforces the owner composition policy only on new passwords", () => {
  expect(newSecureActionPasswordError("CapitalizedWords!")).toBeNull();
  expect(newSecureActionPasswordError("Capitalized1234!")).toBeNull();
  expect(newSecureActionPasswordError("lowercasewords!")).toContain("capitalized");
  expect(newSecureActionPasswordError("CapitalizedWords")).toContain("special");
  for (const value of [
    "Capitalized Words!",
    "CapitalizedWords!😀",
    "CapitalizedWords!界",
    "CapitalizedWords!\n",
  ])
    expect(newSecureActionPasswordError(value)).toContain("No spaces");
  expect(newSecureActionPasswordError("CapitalizedWords!", "CapitalizedWords?")).toContain(
    "match exactly",
  );
  expect(secureActionPasswordError("previous password with spaces")).toBeNull();
});

import { describe, expect, it } from "vitest";
import { secureActionPasswordError } from "../src/lib/secure-action-password";

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

export const secureActionPasswordRules =
  "15–128 characters. No capital letter, number or special character is required. Spaces are allowed and count. Maximum 256 UTF-8 bytes (some emoji and non-English characters use multiple bytes). Confirmation must match exactly.";

export function secureActionPasswordError(password: string, confirmation?: string): string | null {
  if (password.length < 15) return "Use at least 15 characters.";
  if (password.length > 128) return "Use no more than 128 characters.";
  if (new TextEncoder().encode(password).length > 256)
    return "This password exceeds 256 UTF-8 bytes. Use fewer emoji or multibyte characters.";
  if (confirmation !== undefined && password !== confirmation)
    return "Passwords do not match exactly.";
  return null;
}

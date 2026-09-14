export const secureActionPasswordRules =
  "15 characters minimum. At least one capitalized letter, any mix of alpha-numeric and at least one special character is required. No spaces or weird shit.";

// Keep established passwords usable; the stricter policy applies to new enrollment.
export function secureActionPasswordError(password: string, confirmation?: string): string | null {
  if (password.length < 15) return "Use at least 15 characters.";
  if (password.length > 128) return "Use no more than 128 characters.";
  if (new TextEncoder().encode(password).length > 256)
    return "This password exceeds 256 UTF-8 bytes.";
  if (confirmation !== undefined && password !== confirmation)
    return "Passwords do not match exactly.";
  return null;
}

export function newSecureActionPasswordError(
  password: string,
  confirmation?: string,
): string | null {
  const error = secureActionPasswordError(password, confirmation);
  if (error) return error;
  if (!/^[\x21-\x7e]+$/.test(password))
    return "No spaces, emoji, non-English characters or control characters. Use standard keyboard letters, numbers and punctuation.";
  if (!/[A-Z]/.test(password)) return "Include at least one capitalized letter (A–Z).";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Include at least one special character, such as !, @, # or $.";
  return null;
}

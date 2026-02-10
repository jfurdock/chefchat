export function normalizeTextForWake(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasWakePhrase(value: string): boolean {
  const normalized = normalizeTextForWake(value);
  if (!normalized) return false;
  return /\b(?:(?:hey|uh|um|ok|okay)\s+)?chef(?:\s*chat)?\b/.test(normalized);
}

export function stripLeadingWakePhrase(value: string): string {
  if (!value) return '';
  return value
    .trim()
    .replace(
      /^(?:(?:hey|uh|um|ok|okay)\s+)?chef(?:\s*chat)?(?:[\s,:;.!?-]+|$)/i,
      '',
    )
    .trim();
}

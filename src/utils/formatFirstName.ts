export function formatFirstName(
  displayName?: string | null,
  email?: string | null,
  phone?: string | null,
): string {
  const fromDisplay = (displayName || '').trim().split(/\s+/)[0];
  if (fromDisplay) return fromDisplay;

  const fromEmail = (email || '').split('@')[0]?.trim();
  if (fromEmail) return fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1);

  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 4) return `Chef ${digits.slice(-4)}`;
  return 'Chef';
}

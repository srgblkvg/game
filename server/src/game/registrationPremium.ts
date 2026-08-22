export const REGISTRATION_PREMIUM_SECONDS = 86400;

export function grantRegistrationPremium(currentUntil: unknown, now: number): number {
  const parsedUntil = Number(currentUntil);
  const validUntil = Number.isFinite(parsedUntil) ? parsedUntil : 0;
  return Math.max(validUntil, now) + REGISTRATION_PREMIUM_SECONDS;
}

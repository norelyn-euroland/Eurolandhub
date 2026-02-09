/**
 * Custom error class for locked account registration attempts
 */
export class LockedAccountError extends Error {
  public readonly remainingDays: number;
  public readonly lockedUntil: string;
  public readonly field: 'email' | 'phone' | 'name';

  constructor(
    message: string,
    remainingDays: number,
    lockedUntil: string,
    field: 'email' | 'phone' | 'name'
  ) {
    super(message);
    this.name = 'LockedAccountError';
    this.remainingDays = remainingDays;
    this.lockedUntil = lockedUntil;
    this.field = field;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LockedAccountError);
    }
  }
}

/**
 * Calculate remaining days until lockout expires
 */
export function calculateRemainingDays(lockedUntil: string): number {
  const lockDate = new Date(lockedUntil);
  const now = new Date();
  const diffMs = lockDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}






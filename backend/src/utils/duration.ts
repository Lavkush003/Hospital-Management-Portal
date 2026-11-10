const DURATION_UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);

  if (!match) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit ? DURATION_UNITS[unit] : undefined;

  if (!Number.isSafeInteger(amount) || amount <= 0 || !multiplier) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  return amount * multiplier;
}

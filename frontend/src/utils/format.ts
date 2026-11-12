export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '—';

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
    }
  }

  return formatDate(value);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString(undefined, { timeStyle: 'short' });
}

export function formatTimeOfDay(value: string | null | undefined): string {
  if (!value) return '—';

  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;

  const [, hours, minutes] = match;
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString(undefined, { timeStyle: 'short' });
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTimeOfDay(start)} – ${formatTimeOfDay(end)}`;
}

export function formatDateTimeRange(start: string, end: string): string {
  return `${formatDateTime(start)} – ${formatTime(end)}`;
}

export function formatMoney(
  value: string | number | null | undefined,
  currency = 'USD',
): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(amount)) return '—';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—';

  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function initials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  const value = `${first}${last}`.toUpperCase();
  return value || '?';
}

export function fullName(person: { firstName: string; lastName: string } | null | undefined): string {
  if (!person) return '—';
  return `${person.firstName} ${person.lastName}`.trim();
}

export function getAge(dateOfBirth: string | null | undefined): string {
  if (!dateOfBirth) return '—';

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return '—';

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return `${age} yrs`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function truncate(value: string | null | undefined, length = 80): string {
  if (!value) return '—';
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function formatUptime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length < 2 && (remainingSeconds > 0 || parts.length === 0)) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ');
}

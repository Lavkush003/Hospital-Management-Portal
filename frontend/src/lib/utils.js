export function cn(...values) {
  return values.filter(Boolean).join(' ');
}

export function titleCase(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function initials(firstName = '', lastName = '') {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
}

export function formatDate(value) {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTime(value) {
  if (!value) return '—';
  const [hours, minutes] = String(value).split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function daysAgoKey(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function calcAge(dateOfBirth) {
  if (!dateOfBirth) return '—';
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return `${age} yrs`;
}

export function fullName(person) {
  if (!person) return '—';
  if (typeof person === 'string') return person;
  return `${person.firstName || ''} ${person.lastName || ''}`.trim() || '—';
}

export function doctorName(doctor) {
  return `Dr. ${fullName(doctor)}`;
}

export function toInputDate(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function summarizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return '—';
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(', ');
}

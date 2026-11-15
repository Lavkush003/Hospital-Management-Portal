import { describe, expect, it } from 'vitest';
import {
  buildQuery,
  calcAge,
  doctorName,
  formatCurrency,
  formatDate,
  formatTime,
  fullName,
  summarizeMetadata,
  titleCase,
  toInputDate,
} from './utils';

describe('formatting helpers', () => {
  it('formats dates and plain date keys', () => {
    expect(formatDate('2026-02-14')).toBe('Feb 14, 2026');
    expect(formatDate('')).toBe('—');
    expect(toInputDate('2026-02-14T10:20:00.000Z')).toBe('2026-02-14');
  });

  it('formats times and currency', () => {
    expect(formatTime('09:05')).toBe('9:05 AM');
    expect(formatTime('17:30')).toBe('5:30 PM');
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats names and labels', () => {
    expect(fullName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
    expect(doctorName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Dr. Ada Lovelace');
    expect(titleCase('PARTIALLY_PAID')).toBe('Partially Paid');
  });

  it('calculates age', () => {
    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - 30);
    expect(calcAge(birth.toISOString())).toBe('30 yrs');
  });
});

describe('query and metadata helpers', () => {
  it('drops empty query values', () => {
    expect(buildQuery({ page: 2, search: '', status: undefined, sortBy: 'createdAt' })).toBe('?page=2&sortBy=createdAt');
  });

  it('summarizes nested metadata', () => {
    expect(summarizeMetadata({ patient: 'PAT-1', fields: ['a', 'b'] })).toContain('patient: PAT-1');
    expect(summarizeMetadata(null)).toBe('—');
  });
});

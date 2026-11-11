import { z } from 'zod';

const DAY_IN_MILLISECONDS = 86_400_000;
export const MAX_AVAILABILITY_RANGE_DAYS = 31;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function paginationWindow(
  page: number,
  pageSize: number,
): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function isValidDateOnly(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getTime() <= Date.now()
  );
}

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine(isValidDateOnly, 'Date must be valid and must not be in the future')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use 24-hour HH:mm format')
  .transform((value) => {
    const [hours, minutes] = value.split(':').map(Number);
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
  });

export const availabilityRangeSchema = z
  .object({
    start: isoDateTimeSchema,
    end: isoDateTimeSchema,
  })
  .refine((value) => value.end > value.start, {
    message: 'end must be after start',
    path: ['end'],
  })
  .refine(
    (value) =>
      value.end.getTime() - value.start.getTime() <=
      MAX_AVAILABILITY_RANGE_DAYS * DAY_IN_MILLISECONDS,
    {
      message: `Availability range cannot exceed ${MAX_AVAILABILITY_RANGE_DAYS} days`,
      path: ['end'],
    },
  );

export function serializeTimeOfDay(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(
    2,
    '0',
  )}`;
}

export function minutesSinceMidnight(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

export function atUtcTime(day: Date, time: Date): Date {
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      time.getUTCHours(),
      time.getUTCMinutes(),
      0,
      0,
    ),
  );
}

export function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

export function utcDayStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export const idSchema = z.string().trim().min(1).max(64);

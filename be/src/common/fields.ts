import { ValidationError } from './errorHandler.js';
import { assertOnlyFields } from './utils.js';

// Typed body fields that used to reach Prisma as-is, where a wrong type came
// back 500. Each parser leaves `undefined` (not sent) and `null` (clear it)
// alone, and throws a 406 naming the field for anything else it can't use.

const isUnset = (value: unknown): value is undefined | null => value === undefined || value === null;

// album.year is an Int column; a release year is a whole number, 1–9999.
export const parseYear = (value: unknown): number | null | undefined => {
  if (isUnset(value)) return value;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 9999) {
    throw new ValidationError('year must be a whole number between 1 and 9999.');
  }
  return value;
};

const DATE = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/;

// copy.dateAcquired: `YYYY-MM-DD` (stored as midnight UTC) or a full ISO
// timestamp. The calendar date is checked too, since `Date` would quietly roll
// 2024-02-31 over into March.
export const parseDate = (value: unknown, field: string): Date | null | undefined => {
  if (isUnset(value)) return value;
  const match = typeof value === 'string' ? DATE.exec(value) : null;
  const invalid = () => new ValidationError(`${field} must be a date (YYYY-MM-DD) or an ISO timestamp.`);
  if (!match) throw invalid();
  const [, y, m, d, time] = match;
  const day = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (day.getUTCFullYear() !== Number(y) || day.getUTCMonth() !== Number(m) - 1 || day.getUTCDate() !== Number(d)) {
    throw invalid();
  }
  if (!time) return day;
  const stamp = new Date(value as string);
  if (Number.isNaN(stamp.getTime())) throw invalid();
  return stamp;
};

// copy.price is Decimal(10, 2): at most 8 digits before the point and 2 after,
// never negative. Returned as a string so Prisma stores the exact decimal.
const PRICE = /^\d{1,8}(\.\d{1,2})?$/;

export const parsePrice = (value: unknown): string | null | undefined => {
  if (isUnset(value)) return value;
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string' || !PRICE.test(text)) {
    throw new ValidationError('price must be a non-negative amount with at most 2 decimal places.');
  }
  return text;
};

// A new album sent inside another request (found-it today, #129 item 2).
// Picked field by field and type-checked: a request object spread into
// Prisma `data` could choose the collection or write relations
// (`copies: { connect }`). Anything not listed here is a 406.
const ALBUM_FIELDS = ['title', 'format', 'year', 'genre', 'notes', 'coverImageUrl'] as const;
export type AlbumFields = { title: string; format?: string; year?: number | null; genre?: string; notes?: string; coverImageUrl?: string };

export const parseAlbumFields = (value: unknown, field = 'album'): AlbumFields => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ValidationError(`${field} must be an object.`);
  assertOnlyFields(value, ALBUM_FIELDS, (m) => new ValidationError(`${field}: ${m}`));
  const { title, format, year, genre, notes, coverImageUrl } = value as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim()) throw new ValidationError(`${field}.title is required.`);
  const text = (v: unknown, name: string) => {
    if (isUnset(v)) return undefined;
    if (typeof v !== 'string') throw new ValidationError(`${field}.${name} must be text.`);
    return v;
  };
  return {
    title: title.trim(),
    format: text(format, 'format'),
    year: parseYear(year),
    genre: text(genre, 'genre'),
    notes: text(notes, 'notes'),
    coverImageUrl: text(coverImageUrl, 'coverImageUrl'),
  };
};

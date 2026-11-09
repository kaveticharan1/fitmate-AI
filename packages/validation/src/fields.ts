import { z } from 'zod';

/**
 * Error messages are translation keys (see the app's i18n files), so every
 * language shows its own wording. `{{min}}`/`{{max}}` are filled in by the UI.
 */
export const ERR = {
  required: 'errors.required',
  number: 'errors.number',
  min: 'errors.min',
  max: 'errors.max',
  date: 'errors.date',
  minor: 'errors.minor',
  tooLong: 'errors.tooLong',
  pinFormat: 'errors.pinFormat',
  pinMismatch: 'errors.pinMismatch',
  consent: 'errors.consent',
  passwordShort: 'errors.passwordShort',
} as const;

/** Accepts "72.5" and "72,5" (comma decimal), trims spaces. */
const toNumber = (v: string) => Number(v.replace(',', '.'));

/** A required number typed into a text field. */
export const requiredNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, ERR.required)
    .refine((v) => Number.isFinite(toNumber(v)), ERR.number)
    .transform(toNumber)
    .pipe(z.number().min(min, ERR.min).max(max, ERR.max));

/** An optional number typed into a text field; empty → undefined. */
export const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || Number.isFinite(toNumber(v)), ERR.number)
    .transform((v) => (v === '' ? undefined : toNumber(v)))
    .pipe(z.number().min(min, ERR.min).max(max, ERR.max).optional());

/** Free text, optional, length-limited. Empty → undefined. */
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, ERR.tooLong)
    .transform((v) => (v === '' ? undefined : v));

/** Comma-separated list typed by the user → trimmed, de-duplicated array. */
export const commaList = (maxItems = 30) =>
  z
    .string()
    .trim()
    .max(500, ERR.tooLong)
    .transform((v) =>
      Array.from(
        new Set(
          v
            .split(/[,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ).slice(0, maxItems),
    );

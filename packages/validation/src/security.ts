import { z } from 'zod';
import { ERR } from './fields';

/** PINs that are too easy to guess are rejected. */
const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '1212', '6969', '2580', '123456', '654321', '000000', '111111',
]);

export const pinField = z
  .string()
  .regex(/^\d{4,8}$/, ERR.pinFormat)
  .refine((v) => !WEAK_PINS.has(v), 'errors.pinWeak');

export const setPinSchema = z
  .object({ pin: pinField, confirmPin: z.string() })
  .refine((v) => v.pin === v.confirmPin, { path: ['confirmPin'], message: ERR.pinMismatch });

/** Backup passwords protect data outside the phone, so they need real length. */
export const backupPasswordSchema = z
  .object({ password: z.string().min(10, ERR.passwordShort).max(128, ERR.tooLong), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'errors.passwordMismatch' });

export const consentSchema = z.object({
  isAdult: z.literal(true, { error: ERR.consent }),
  acceptsPrivacyNotice: z.literal(true, { error: ERR.consent }),
});

import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { nowIso } from '../lib/time';
import { getDb } from './client';
import { coachMemory, coachMessages } from './schema';

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  flags: string[];
  createdAt: string;
}

const parseFlags = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** The most recent messages, oldest first. */
export function recentMessages(limit = 100): CoachMessage[] {
  const rows = getDb()
    .select()
    .from(coachMessages)
    .where(isNull(coachMessages.deletedAt))
    .orderBy(desc(coachMessages.createdAt), desc(coachMessages.id))
    .limit(limit)
    .all();
  return rows.reverse().map((r) => ({ id: r.id, role: r.role, text: r.text, flags: parseFlags(r.flags), createdAt: r.createdAt }));
}

export function addMessage(role: 'user' | 'coach', text: string, flags: string[] = []): CoachMessage {
  const now = nowIso();
  const id = randomUUID();
  getDb().insert(coachMessages).values({ id, role, text, flags: JSON.stringify(flags), createdAt: now, updatedAt: now }).run();
  return { id, role, text, flags, createdAt: now };
}

/** Deletes the whole chat (memory is kept; it is managed separately). */
export function clearMessages(): void {
  getDb().delete(coachMessages).run();
}

/** User messages sent since the given ISO time (for the daily counter). */
export function userMessagesSince(iso: string): number {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(coachMessages)
    .where(and(eq(coachMessages.role, 'user'), isNull(coachMessages.deletedAt), gte(coachMessages.createdAt, iso)))
    .get();
  return row?.n ?? 0;
}

export function listMemory() {
  return getDb().select().from(coachMemory).where(isNull(coachMemory.deletedAt)).orderBy(asc(coachMemory.createdAt)).all();
}

export const MAX_MEMORY = 30;

/** Saves a fact unless an identical one exists or the list is full. Returns whether it was saved. */
export function addMemory(text: string): boolean {
  const t = text.trim().slice(0, 200);
  if (!t) return false;
  const existing = listMemory();
  if (existing.length >= MAX_MEMORY || existing.some((m) => m.text.toLowerCase() === t.toLowerCase())) return false;
  const now = nowIso();
  getDb().insert(coachMemory).values({ id: randomUUID(), text: t, createdAt: now, updatedAt: now }).run();
  return true;
}

export function deleteMemory(id: string): void {
  getDb().delete(coachMemory).where(eq(coachMemory.id, id)).run();
}

import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Your buddy-group membership. The secret proves to the server that you are
 * this member; it is kept in the phone's secure storage and never shown.
 */
export interface Membership {
  memberId: string;
  secret: string;
  groupId: string;
  code: string;
}

const KEY = 'fm.buddy.v1';
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export function newSecret(): string {
  return Array.from(getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getMembership(): Promise<Membership | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY, OPTS);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Membership>;
    return v.memberId && v.secret && v.groupId && v.code ? (v as Membership) : null;
  } catch {
    return null;
  }
}

export const saveMembership = (m: Membership) => SecureStore.setItemAsync(KEY, JSON.stringify(m), OPTS);
export const clearMembership = () => SecureStore.deleteItemAsync(KEY, OPTS);

import { offProductUrl, parseOffProduct, type PackagedProduct } from '@fitmate/food-data';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import {
  addCustomEntry,
  addPhotoEntries,
  deleteCustomFood,
  findByBarcode,
  getCustomFood,
  listCustomFoods,
  saveCustomFood,
  updateCustomEntry,
  type CustomFoodInput,
  type PhotoEntryItem,
} from '../../db/customFoodRepo';
import type { CustomFoodRow, Meal } from '../../db/schema';

export type LookupResult =
  | { kind: 'saved'; food: CustomFoodRow }
  | { kind: 'found'; product: PackagedProduct }
  | { kind: 'not_found'; barcode: string };

export class LookupError extends Error {
  constructor(readonly kind: 'network' | 'timeout' | 'server') {
    super(kind);
  }
}

type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Open Food Facts asks apps to identify themselves; no personal details are sent. */
const USER_AGENT = `FitMate/${Constants.expoConfig?.version ?? '0'} (Android; personal fitness app)`;

/** Looks a barcode up: saved packaged foods first (works offline), then Open Food Facts. */
export async function lookupBarcode(barcode: string, fetchFn: FetchLike = (u, i) => fetch(u, i), timeoutMs = 15000): Promise<LookupResult> {
  const saved = findByBarcode(barcode);
  if (saved) return { kind: 'saved', food: saved };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(offProductUrl(barcode), { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: controller.signal });
    if (res.status === 404) return { kind: 'not_found', barcode };
    if (!res.ok) throw new LookupError('server');
    const product = parseOffProduct(barcode, await res.json());
    return product ? { kind: 'found', product } : { kind: 'not_found', barcode };
  } catch (e) {
    if (e instanceof LookupError) throw e;
    throw new LookupError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

export const packagedKeys = { list: ['customFoods'] as const, one: (id: string) => ['customFoods', id] as const };

export const useCustomFoods = () => useQuery({ queryKey: packagedKeys.list, queryFn: () => listCustomFoods() });
export const useCustomFood = (id: string | undefined) =>
  useQuery({ queryKey: packagedKeys.one(id ?? ''), queryFn: () => (id ? getCustomFood(id) : null), enabled: !!id });

export const useLookupBarcode = () => useMutation({ mutationFn: (barcode: string) => lookupBarcode(barcode) });

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['customFoods'] });
    qc.invalidateQueries({ queryKey: ['diary'] });
    qc.invalidateQueries({ queryKey: ['progress'] });
  };
}

export function useSaveCustomFood() {
  const done = useInvalidate();
  return useMutation({ mutationFn: async (input: CustomFoodInput) => saveCustomFood(input), onSuccess: done });
}

export function useDeleteCustomFood() {
  const done = useInvalidate();
  return useMutation({ mutationFn: async (id: string) => deleteCustomFood(id), onSuccess: done });
}

export function useLogCustomFood() {
  const done = useInvalidate();
  return {
    add: useMutation({ mutationFn: async (v: { date: string; meal: Meal; customFoodId: string; grams: number }) => addCustomEntry(v), onSuccess: done }),
    update: useMutation({ mutationFn: async (v: { entryId: string; grams: number; meal: Meal }) => updateCustomEntry(v.entryId, v.grams, v.meal), onSuccess: done }),
  };
}

export function useAddPhotoEntries() {
  const done = useInvalidate();
  return useMutation({ mutationFn: async (v: { date: string; meal: Meal; items: PhotoEntryItem[] }) => addPhotoEntries(v.date, v.meal, v.items), onSuccess: done });
}

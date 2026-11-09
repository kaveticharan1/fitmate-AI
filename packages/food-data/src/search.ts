import { FOODS } from './foods';
import type { Food } from './types';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[()/,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface Indexed {
  food: Food;
  terms: string[];
}

const INDEX: Indexed[] = FOODS.map((food) => ({
  food,
  terms: [food.name, food.nameTe ?? '', ...(food.aliases ?? [])].filter(Boolean).map(norm),
}));

/**
 * Searches by English name, Telugu name and aliases (Roman-letter Telugu, Hindi).
 * Ranking: exact term > term starts with query > a word starts with query > contains.
 * Cooked/ready foods rank above raw ingredients unless `includeRaw` is preferred.
 */
export function searchFoods(query: string, opts: { limit?: number; preferRaw?: boolean } = {}): Food[] {
  const q = norm(query);
  const limit = opts.limit ?? 30;
  if (!q) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const { food, terms } of INDEX) {
    let best = 0;
    for (const term of terms) {
      if (term === q) best = Math.max(best, 100);
      else if (term.startsWith(q)) best = Math.max(best, 80);
      else if (term.split(' ').some((w) => w.startsWith(q))) best = Math.max(best, 60);
      else if (term.includes(q)) best = Math.max(best, 40);
    }
    if (best > 0) {
      const rawPenalty = food.category === 'raw' ? (opts.preferRaw ? -5 : 15) : 0;
      scored.push({ food, score: best - rawPenalty });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((s) => s.food);
}

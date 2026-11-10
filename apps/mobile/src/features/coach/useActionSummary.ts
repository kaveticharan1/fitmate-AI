import type { CoachAction } from '@fitmate/coach';
import { useTranslation } from 'react-i18next';
import { useFoodName, useQuantityLabel } from '../food/ui';
import { resolveFoodItems } from './actionRunner';

/** Plain-language lines describing a coach action (first line is the headline). */
export function useActionSummary() {
  const { t } = useTranslation();
  const name = useFoodName();
  const qty = useQuantityLabel();
  return (a: CoachAction): string[] => {
    switch (a.type) {
      case 'log_food':
        return [
          t('agent.logFood', { meal: t(`meals.${a.meal}`) }),
          ...resolveFoodItems(a.items).map((r) =>
            r.food && r.measureKey ? `• ${name(r.food, r.food.name)} — ${qty(r.measureKey, r.count ?? 1)} · ${r.kcal} kcal` : `• ${r.name} — ${t('agent.notFound')}`,
          ),
        ];
      case 'log_water':
        return [t('agent.logWater', { ml: a.ml })];
      case 'log_weight':
        return [t('agent.logWeight', { kg: a.kg })];
      case 'log_sleep':
        return [t('agent.logSleep', { bed: a.bed, wake: a.wake })];
      case 'set_reminder':
        return [t('agent.setReminder', { label: a.label, time: a.time })];
    }
  };
}


import { completionRate, summariseWeek } from '@fitmate/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { Header } from '../components/Header';
import { Card, ChoiceGroup, Screen } from '../components/ui';
import { useTargets } from '../features/food/hooks';
import { useFoodHistory, useHabits, useSleepHistory, useWaterHistory, useWeightHistory } from '../features/progress/hooks';
import { hoursText } from '../features/progress/SleepHabits';
import { addDays, localDate } from '../lib/time';
import { space } from '../theme/tokens';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export default function Report() {
  const { t } = useTranslation();
  const [range, setRange] = useState<'7' | '30'>('7');
  const days = Number(range);
  const today = localDate();
  const start = addDays(today, -days + 1);
  const targets = useTargets();
  const { data: weights = [] } = useWeightHistory(days * 2);
  const { data: food = [] } = useFoodHistory(days);
  const { data: water = [] } = useWaterHistory(days);
  const { data: sleep = [] } = useSleepHistory(days);
  const { data: habits = [] } = useHabits();

  // Weight: average of this period vs the period before (averages hide daily water swings).
  const cur = avg(weights.filter((w) => w.date >= start).map((w) => w.value));
  const prev = avg(weights.filter((w) => w.date < start).map((w) => w.value));
  const food7 = targets ? summariseWeek(food, { kcal: targets.targetKcal, protein: targets.proteinG }) : null;
  const waterAvg = avg(water.map((w) => w.ml));
  const sleepAvg = avg(sleep.filter((s) => s.wokeOn >= start).map((s) => s.minutes));

  const row = (label: string, value: string, testID?: string) => (
    <View key={testID ?? label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }} testID={testID}>
      <AppText tone="secondary" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText weight="bold" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
  const none = t('report.noData');

  return (
    <Screen testID="report">
      <Header title={t('report.title')} />
      <ChoiceGroup<'7' | '30'>
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: t('report.week') },
          { value: '30', label: t('report.month') },
        ]}
      />
      <Card>
        {row(
          t('dashboard.weight'),
          cur == null ? none : prev == null ? `${cur.toFixed(1)} kg` : `${cur.toFixed(1)} kg (${cur - prev > 0 ? '+' : ''}${(cur - prev).toFixed(1)})`,
          'report-weight',
        )}
        {row(t('report.foodDays'), food7 ? `${food7.daysLogged} / ${days}` : none)}
        {row(t('report.avgKcal'), food7?.avgKcal != null ? `${food7.avgKcal} / ${targets!.targetKcal} kcal` : none, 'report-kcal')}
        {row(t('report.avgProtein'), food7?.avgProtein != null ? `${food7.avgProtein} / ${targets!.proteinG} g` : none)}
        {row(t('report.water'), waterAvg != null ? `${(waterAvg / 1000).toFixed(1)} L / ${((targets?.waterMl ?? 0) / 1000).toFixed(1)} L` : none)}
        {row(t('report.sleep'), sleepAvg != null ? hoursText(Math.round(sleepAvg)) : none)}
      </Card>
      {habits.length ? (
        <Card>
          <AppText variant="heading">{t('habits.title')}</AppText>
          {habits.map((h) => row(h.name, `${Math.round(completionRate(h.doneDates, today, days) * 100)}%`, `report-habit-${h.name}`))}
        </Card>
      ) : null}
      <AppText variant="caption" tone="muted">
        {t('report.note')}
      </AppText>
    </Screen>
  );
}

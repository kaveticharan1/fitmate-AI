import { Ionicons } from '@expo/vector-icons';
import { getFood, type PlannedMeal } from '@fitmate/food-data';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, Card, Screen } from '../../components/ui';
import type { Meal } from '../../db/schema';
import { useDayPlan, useLogPlannedMeal, useSwapMeal } from '../../features/food/hooks';
import { NutrientBar, useFoodName, useQuantityLabel } from '../../features/food/ui';
import { addDays, localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_TE = ['ఆది', 'సోమ', 'మంగళ', 'బుధ', 'గురు', 'శుక్ర', 'శని'];

export default function PlanTab() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const today = localDate();
  const [date, setDate] = useState(today);
  const { plan, choices } = useDayPlan(date);
  const swap = useSwapMeal(date);
  const log = useLogPlannedMeal(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const weekday = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    const w = new Date(y, m - 1, d).getDay();
    return (i18n.language === 'te' ? WEEKDAYS_TE : WEEKDAYS_EN)[w];
  };

  return (
    <Screen testID="plan">
      <View style={{ gap: space.xs, paddingTop: space.sm }}>
        <AppText variant="title">{t('plan.title')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('plan.note')}
        </AppText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {days.map((d) => {
          const selected = d === date;
          return (
            <Pressable
              key={d}
              testID={`plan-day-${d}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setDate(d)}
              style={{
                width: 56,
                paddingVertical: space.sm,
                borderRadius: radius.md,
                alignItems: 'center',
                backgroundColor: selected ? colors.accentSoft : colors.surface,
                borderWidth: 1,
                borderColor: selected ? colors.accent : colors.border,
              }}
            >
              <AppText variant="caption" tone={selected ? 'accent' : 'secondary'}>
                {d === today ? t('diary.today') : weekday(d)}
              </AppText>
              <AppText variant="heading" tone={selected ? 'accent' : 'primary'}>
                {Number(d.slice(8))}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {plan ? (
        <>
          <Card testID="plan-totals">
            <NutrientBar label={t('dashboard.calorieTarget')} value={plan.totals.kcal} target={plan.targetKcal} unit="kcal" />
            <NutrientBar label={t('dashboard.protein')} value={plan.totals.protein} target={plan.targetProteinG} unit="g" />
          </Card>
          {plan.meals.map((m) => (
            <PlannedMealCard
              key={m.slot}
              meal={m}
              eaten={!!choices?.[m.slot as Meal]?.eatenAt}
              canLog={date <= today}
              onSwap={() => swap.mutate(m.slot as Meal)}
              onLog={() => log.mutate(m)}
            />
          ))}
          <Button testID="open-grocery" variant="secondary" label={t('plan.grocery')} onPress={() => router.push('/food/grocery')} />
        </>
      ) : (
        <AppText tone="secondary">{t('plan.noPlan')}</AppText>
      )}
    </Screen>
  );
}

function PlannedMealCard({ meal, eaten, canLog, onSwap, onLog }: { meal: PlannedMeal; eaten: boolean; canLog: boolean; onSwap: () => void; onLog: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = useFoodName();
  const qty = useQuantityLabel();
  return (
    <Card testID={`planned-${meal.slot}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">{t(`meals.${meal.slot}`)}</AppText>
        <AppText variant="label" tone="secondary">
          {meal.totals.kcal} kcal · {Math.round(meal.totals.protein)} g {t('diary.proteinShort')}
        </AppText>
      </View>
      {meal.items.map((i) => (
        <View key={i.foodId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <AppText style={{ flex: 1 }}>{name(getFood(i.foodId), i.foodId)}</AppText>
          <AppText tone="secondary">
            {qty(i.measure.key, i.measure.count)}
            {i.measure.key !== 'g' ? ` (${i.grams} g)` : ''}
          </AppText>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {meal.options > 1 && !eaten ? (
          <View style={{ flex: 1 }}>
            <Button testID={`swap-${meal.slot}`} variant="secondary" label={t('plan.swap')} onPress={onSwap} icon={<Ionicons name="shuffle" size={18} color={colors.text} />} />
          </View>
        ) : null}
        {canLog ? (
          <View style={{ flex: 1 }}>
            {eaten ? (
              <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs }}>
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                <AppText tone="accent" weight="bold">
                  {t('plan.eaten')}
                </AppText>
              </View>
            ) : (
              <Button testID={`ate-${meal.slot}`} label={t('plan.ate')} onPress={onLog} />
            )}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

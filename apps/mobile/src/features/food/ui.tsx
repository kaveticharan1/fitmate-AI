import { Ionicons } from '@expo/vector-icons';
import { getFood, type Food } from '@fitmate/food-data';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { isoToDisplayDate, localDate, addDays } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, TOUCH } from '../../theme/tokens';

/** Food name in the app language (Telugu name when available). */
export function useFoodName() {
  const { i18n } = useTranslation();
  return (food: Pick<Food, 'name' | 'nameTe'> | undefined, fallback = '') =>
    food ? (i18n.language === 'te' && food.nameTe ? food.nameTe : food.name) : fallback;
}

/** "2 piece" → "2 idli pieces"-style label using translated measure names. */
export function useQuantityLabel() {
  const { t } = useTranslation();
  return (key: string, count: number) => {
    const n = Number.isInteger(count) ? String(count) : count.toFixed(1);
    if (key === 'g') return `${n} g`;
    return `${n} ${t(`measures.${key}`, { count, defaultValue: key })}`;
  };
}

export function DayNavigator({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = localDate();
  const label = date === today ? t('diary.today') : date === addDays(today, -1) ? t('diary.yesterday') : date === addDays(today, 1) ? t('diary.tomorrow') : isoToDisplayDate(date);
  const arrow = (icon: 'chevron-back' | 'chevron-forward', d: string, a11y: string, testID: string) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => onChange(d)}
      style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {arrow('chevron-back', addDays(date, -1), t('diary.previousDay'), 'day-prev')}
      <Pressable accessibilityRole="button" onPress={() => onChange(today)} style={{ alignItems: 'center', minHeight: TOUCH, justifyContent: 'center' }}>
        <AppText variant="heading" testID="day-label">
          {label}
        </AppText>
        {date !== today ? (
          <AppText variant="caption" tone="accent">
            {t('diary.backToToday')}
          </AppText>
        ) : null}
      </Pressable>
      {arrow('chevron-forward', addDays(date, 1), t('diary.nextDay'), 'day-next')}
    </View>
  );
}

/** Progress bar with "value / target unit", turning amber when over target. */
export function NutrientBar({ label, value, target, unit, testID }: { label: string; value: number; target: number; unit: string; testID?: string }) {
  const { colors } = useTheme();
  const pct = target > 0 ? value / target : 0;
  const over = pct > 1.05;
  return (
    <View style={{ gap: 4 }} testID={testID}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="caption" tone="secondary">
          {label}
        </AppText>
        <AppText variant="caption" tone={over ? 'warning' : 'secondary'}>
          {Math.round(value)} / {Math.round(target)} {unit}
        </AppText>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.min(100, Math.round(pct * 100)) }}
        style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' }}
      >
        <View style={{ width: `${Math.min(1, pct) * 100}%`, height: 6, borderRadius: 3, backgroundColor: over ? colors.warning : colors.accent }} />
      </View>
    </View>
  );
}

export function Stepper({ value, onChange, step = 0.5, min = 0.5, max = 50, testID }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; testID?: string }) {
  const { colors } = useTheme();
  const btn = (label: string, delta: number, a11y: string) => (
    <Pressable
      testID={testID ? `${testID}-${delta > 0 ? 'plus' : 'minus'}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => onChange(Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100)))}
      style={{ width: TOUCH, height: TOUCH, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}
    >
      <AppText variant="title" weight="regular">
        {label}
      </AppText>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {btn('−', -step, 'Less')}
      <AppText variant="title" testID={testID ? `${testID}-value` : undefined} style={{ minWidth: 56, textAlign: 'center' }}>
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </AppText>
      {btn('+', step, 'More')}
    </View>
  );
}

/** A tappable row for a food in search results or lists. */
export function FoodRow({ foodId, onPress, right, testID }: { foodId: string; onPress: () => void; right?: string; testID?: string }) {
  const { colors } = useTheme();
  const name = useFoodName();
  const qty = useQuantityLabel();
  const food = getFood(foodId);
  if (!food) return null;
  const m = food.measures[0]!;
  const kcal = Math.round((food.per100g.kcal * m.grams) / 100);
  return (
    <Pressable
      testID={testID ?? `food-${foodId}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH + 8,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
      })}
    >
      <View style={{ flex: 1 }}>
        <AppText>{name(food)}</AppText>
        <AppText variant="caption" tone="secondary">
          {right ?? `${qty(m.key, m.key === 'g' ? 100 : 1)} · ${m.key === 'g' ? food.per100g.kcal : kcal} kcal`}
        </AppText>
      </View>
      <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
    </Pressable>
  );
}

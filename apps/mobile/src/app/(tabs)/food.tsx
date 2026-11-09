import { Ionicons } from '@expo/vector-icons';
import { getFood } from '@fitmate/food-data';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Banner, Card, ListGroup, Screen } from '../../components/ui';
import { totalsOf } from '../../db/foodRepo';
import { MEALS, type FoodLogEntryRow, type Meal } from '../../db/schema';
import { useCopyMeal, useDiary, useTargets } from '../../features/food/hooks';
import { DayNavigator, NutrientBar, useFoodName, useQuantityLabel } from '../../features/food/ui';
import { addDays, localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { space, TOUCH } from '../../theme/tokens';

export default function FoodDiary() {
  const { t } = useTranslation();
  const [date, setDate] = useState(localDate());
  const { data: entries = [] } = useDiary(date);
  const { data: yesterday = [] } = useDiary(addDays(date, -1));
  const targets = useTargets();
  const copy = useCopyMeal();
  const [notice, setNotice] = useState<string | null>(null);
  const totals = totalsOf(entries);

  const remaining = targets ? targets.targetKcal - totals.kcal : 0;

  return (
    <Screen testID="food-diary">
      <DayNavigator
        date={date}
        onChange={(d) => {
          setDate(d);
          setNotice(null);
        }}
      />

      {targets ? (
        <Card testID="diary-totals">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <View>
              <AppText variant="caption" tone="secondary">
                {t('diary.eaten')}
              </AppText>
              <AppText variant="title" testID="eaten-kcal">
                {totals.kcal.toLocaleString('en-IN')} kcal
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption" tone="secondary">
                {remaining >= 0 ? t('diary.remaining') : t('diary.over')}
              </AppText>
              <AppText variant="heading" tone={remaining >= 0 ? 'accent' : 'warning'} testID="remaining-kcal">
                {Math.abs(Math.round(remaining)).toLocaleString('en-IN')} kcal
              </AppText>
            </View>
          </View>
          <NutrientBar label={t('dashboard.calorieTarget')} value={totals.kcal} target={targets.targetKcal} unit="kcal" />
          <NutrientBar label={t('dashboard.protein')} value={totals.protein} target={targets.proteinG} unit="g" testID="protein-bar" />
          <NutrientBar label={t('dashboard.carbs')} value={totals.carbs} target={targets.carbsG} unit="g" />
          <NutrientBar label={t('dashboard.fat')} value={totals.fat} target={targets.fatG} unit="g" />
        </Card>
      ) : null}

      {notice ? <Banner tone="accent" text={notice} /> : null}

      {MEALS.map((meal) => (
        <MealSection
          key={meal}
          meal={meal}
          entries={entries.filter((e) => e.meal === meal)}
          canRepeat={yesterday.some((e) => e.meal === meal)}
          onAdd={() => router.push({ pathname: '/food/add', params: { meal, date } })}
          onRepeat={async () => {
            const n = await copy.mutateAsync({ from: addDays(date, -1), to: date, meal });
            setNotice(t('diary.copied', { count: n }));
          }}
          onOpen={(e) =>
            e.foodId
              ? router.push({ pathname: '/food/item', params: { foodId: e.foodId, meal, date, entryId: e.id } })
              : e.recipeId
                ? router.push({ pathname: '/food/recipes', params: { meal, date, entryId: e.id } })
                : router.push({ pathname: '/food/custom', params: { entryId: e.id } })
          }
        />
      ))}

      <AppText variant="caption" tone="muted">
        {t('diary.approxNote')}
      </AppText>
    </Screen>
  );
}

function MealSection({
  meal,
  entries,
  canRepeat,
  onAdd,
  onRepeat,
  onOpen,
}: {
  meal: Meal;
  entries: FoodLogEntryRow[];
  canRepeat: boolean;
  onAdd: () => void;
  onRepeat: () => void;
  onOpen: (e: FoodLogEntryRow) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = useFoodName();
  const qty = useQuantityLabel();
  const totals = totalsOf(entries);
  return (
    <View style={{ gap: space.sm }} testID={`meal-${meal}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="heading">{t(`meals.${meal}`)}</AppText>
        <AppText variant="label" tone="secondary">
          {totals.kcal} kcal · {Math.round(totals.protein)} g {t('diary.proteinShort')}
        </AppText>
      </View>
      {entries.length > 0 ? (
        <ListGroup>
          {entries.map((e) => (
            <Pressable
              key={e.id}
              testID={`entry-${e.id}`}
              accessibilityRole="button"
              onPress={() => onOpen(e)}
              style={({ pressed }) => ({
                minHeight: TOUCH + 8,
                paddingHorizontal: space.lg,
                paddingVertical: space.sm,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
              })}
            >
              <View style={{ flex: 1 }}>
                <AppText>{e.foodId ? name(getFood(e.foodId), e.name) : e.name}</AppText>
                <AppText variant="caption" tone="secondary">
                  {qty(e.measureKey, e.measureCount)}
                  {e.oilLevel !== 'normal' ? ` · ${t(`food.oil_${e.oilLevel}`)}` : ''}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="label" weight="bold">
                  {Math.round(e.kcal)} kcal
                </AppText>
                <AppText variant="caption" tone="secondary">
                  {Math.round(e.proteinG)} g {t('diary.proteinShort')}
                </AppText>
              </View>
            </Pressable>
          ))}
        </ListGroup>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Pressable
          testID={`add-${meal}`}
          accessibilityRole="button"
          onPress={onAdd}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: TOUCH, paddingRight: space.md }}
        >
          <Ionicons name="add-circle" size={22} color={colors.accent} />
          <AppText tone="accent" weight="bold">
            {t('diary.add')}
          </AppText>
        </Pressable>
        {canRepeat ? (
          <Pressable
            testID={`repeat-${meal}`}
            accessibilityRole="button"
            onPress={onRepeat}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: TOUCH }}
          >
            <Ionicons name="repeat" size={20} color={colors.textSecondary} />
            <AppText tone="secondary">{t('diary.sameAsYesterday')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

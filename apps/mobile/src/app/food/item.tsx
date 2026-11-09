import { Ionicons } from '@expo/vector-icons';
import { getFood, gramsFor, nutrientsFor, roundNutrients, type MeasureKey, type OilLevel } from '@fitmate/food-data';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ChoiceGroup, Screen } from '../../components/ui';
import { getEntry } from '../../db/foodRepo';
import { MEALS, type Meal } from '../../db/schema';
import { useAddFood, useDeleteEntry, useFavourites, useToggleFavourite, useUpdateFood } from '../../features/food/hooks';
import { Stepper, useFoodName } from '../../features/food/ui';
import { localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { space, TOUCH } from '../../theme/tokens';

export default function FoodItem() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = useFoodName();
  const params = useLocalSearchParams<{ foodId: string; meal?: string; date?: string; entryId?: string }>();
  const food = getFood(params.foodId);
  const date = params.date ?? localDate();
  const existing = useMemo(() => (params.entryId ? getEntry(params.entryId) : null), [params.entryId]);

  const firstMeasure = (food?.measures[0]?.key ?? 'g') as MeasureKey;
  const [meal, setMeal] = useState<Meal>((existing?.meal ?? params.meal ?? 'breakfast') as Meal);
  const [measure, setMeasure] = useState<MeasureKey>((existing?.measureKey as MeasureKey) ?? firstMeasure);
  const [count, setCount] = useState<number>(existing?.measureCount ?? (firstMeasure === 'g' ? 100 : 1));
  const [oil, setOil] = useState<OilLevel>((existing?.oilLevel as OilLevel) ?? 'normal');
  const [error, setError] = useState<string | null>(null);

  const add = useAddFood();
  const update = useUpdateFood();
  const del = useDeleteEntry();
  const { data: favourites = [] } = useFavourites();
  const toggleFav = useToggleFavourite();

  if (!food) {
    return (
      <Screen>
        <Header title="" />
        <Banner tone="danger" text={t('errors.generic')} />
      </Screen>
    );
  }

  const grams = gramsFor(food, measure, count);
  const n = roundNutrients(nutrientsFor(food, grams, oil));
  const isFav = favourites.includes(food.id);

  const save = async () => {
    setError(null);
    try {
      if (existing) await update.mutateAsync({ id: existing.id, patch: { meal, foodId: food.id, measureKey: measure, count, oil } });
      else await add.mutateAsync({ date, meal, foodId: food.id, measureKey: measure, count, oil });
      router.back();
    } catch {
      setError(t('errors.generic'));
    }
  };

  return (
    <Screen
      testID="food-item"
      footer={
        <View style={{ gap: space.sm }}>
          <Button
            testID="food-save"
            label={existing ? t('common.save') : t('food.addTo', { meal: t(`meals.${meal}`) })}
            onPress={save}
            loading={add.isPending || update.isPending}
          />
          {existing ? (
            <Button
              testID="food-delete"
              variant="ghost"
              label={t('food.delete')}
              onPress={async () => {
                await del.mutateAsync(existing.id);
                router.back();
              }}
            />
          ) : null}
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Header title={name(food)} />
        </View>
        <Pressable
          testID="food-favourite"
          accessibilityRole="button"
          accessibilityLabel={isFav ? t('food.unfavourite') : t('food.favourite')}
          accessibilityState={{ selected: isFav }}
          onPress={() => toggleFav.mutate({ foodId: food.id, on: !isFav })}
          style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={isFav ? 'star' : 'star-outline'} size={24} color={isFav ? colors.warning : colors.textSecondary} />
        </Pressable>
      </View>
      {food.nameTe ? (
        <AppText tone="secondary" style={{ marginTop: -space.md }}>
          {food.name} · {food.nameTe}
        </AppText>
      ) : null}

      <Card>
        <ChoiceGroup<MeasureKey>
          testID="measure"
          label={t('food.unit')}
          value={measure}
          onChange={(m) => {
            setMeasure(m);
            setCount(m === 'g' ? Math.round(grams) || 100 : 1);
          }}
          options={food.measures.map((m) => ({
            value: m.key,
            label: m.key === 'g' ? t('measures.g') : `${t(`measures.${m.key}`, { count: 1 })} (${m.grams} g)`,
          }))}
        />
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <Stepper
            testID="count"
            value={count}
            onChange={setCount}
            step={measure === 'g' ? 10 : measure === 'piece' || measure === 'slice' ? 1 : 0.5}
            min={measure === 'g' ? 10 : measure === 'piece' || measure === 'slice' ? 1 : 0.5}
            max={measure === 'g' ? 2000 : 30}
          />
          <AppText variant="caption" tone="secondary" testID="grams">
            = {Math.round(grams)} g
          </AppText>
        </View>
      </Card>

      {food.oilPer100g ? (
        <Card>
          <ChoiceGroup<OilLevel>
            testID="oil"
            label={t('food.oil')}
            value={oil}
            onChange={setOil}
            options={(['less', 'normal', 'more'] as const).map((o) => ({ value: o, label: t(`food.oil_${o}`) }))}
          />
          <AppText variant="caption" tone="muted">
            {t('food.oilHint')}
          </AppText>
        </Card>
      ) : null}

      <Card testID="food-nutrition">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <AppText variant="display" testID="food-kcal">
            {n.kcal}
          </AppText>
          <AppText tone="secondary">kcal</AppText>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {(
            [
              ['dashboard.protein', n.protein],
              ['dashboard.carbs', n.carbs],
              ['dashboard.fat', n.fat],
              ['food.fiber', n.fiber],
            ] as const
          ).map(([k, v]) => (
            <View key={k} style={{ alignItems: 'center' }}>
              <AppText variant="heading">{v} g</AppText>
              <AppText variant="caption" tone="secondary">
                {t(k)}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" tone="muted">
          {food.state === 'cooked' ? t('food.homeCookedNote') : t('food.approx')}
        </AppText>
      </Card>

      {existing ? (
        <ChoiceGroup<Meal> label={t('food.meal')} value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(`meals.${m}`) }))} />
      ) : null}
      {error ? <Banner tone="danger" text={error} /> : null}
    </Screen>
  );
}

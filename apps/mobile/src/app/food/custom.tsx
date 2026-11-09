import { per100For } from '@fitmate/food-data';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ChoiceGroup, Screen, TextField } from '../../components/ui';
import { per100Of } from '../../db/customFoodRepo';
import { getEntry } from '../../db/foodRepo';
import { MEALS, type Meal } from '../../db/schema';
import { useDeleteEntry } from '../../features/food/hooks';
import { useCustomFood, useLogCustomFood } from '../../features/food/packaged';
import { NutrientBar } from '../../features/food/ui';
import { localDate } from '../../lib/time';
import { space } from '../../theme/tokens';

/**
 * A packaged food's portion screen (log or edit), or — for a food-photo entry —
 * a read-only view of what was saved.
 */
export default function CustomFoodScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ customFoodId?: string; entryId?: string; meal?: string; date?: string }>();
  const [entry] = useState(() => (params.entryId ? getEntry(params.entryId) : null));
  const customFoodId = params.customFoodId ?? entry?.customFoodId ?? undefined;
  const { data: food } = useCustomFood(customFoodId);
  const log = useLogCustomFood();
  const del = useDeleteEntry();
  const date = params.date ?? entry?.loggedOn ?? localDate();
  const [meal, setMeal] = useState<Meal>((entry?.meal ?? params.meal ?? 'snack') as Meal);
  const [grams, setGrams] = useState(() => (entry ? String(entry.quantityG) : ''));

  const remove = () => entry && del.mutate(entry.id, { onSuccess: () => router.back() });

  // Food-photo entries have no packaged food behind them.
  if (entry && !entry.customFoodId) {
    return (
      <Screen testID="custom-food">
        <Header title={entry.name} />
        <Card testID="photo-entry">
          <AppText>{t('photo.entrySummary', { grams: entry.quantityG, kcal: Math.round(entry.kcal), protein: Math.round(entry.proteinG) })}</AppText>
          <AppText variant="caption" tone="secondary">
            {t('photo.estimateNote')}
          </AppText>
        </Card>
        <Button testID="delete-entry" variant="danger" label={t('food.delete')} onPress={remove} />
      </Screen>
    );
  }

  if (!food) return <Screen testID="custom-food">{null}</Screen>;

  const per100 = per100Of(food);
  const parsed = Number(grams.replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 5000;
  const n = per100For(per100, valid ? parsed : 0);
  const quick = [...(food.servingG ? [food.servingG] : []), 25, 50, 100, 150, 200].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);

  const save = () => {
    if (!valid) return;
    if (entry) log.update.mutate({ entryId: entry.id, grams: parsed, meal }, { onSuccess: () => router.back() });
    else log.add.mutate({ date, meal, customFoodId: food.id, grams: parsed }, { onSuccess: () => router.back() });
  };

  return (
    <Screen testID="custom-food" footer={<Button testID="custom-save" label={entry ? t('common.save') : t('food.addTo', { meal: t(`meals.${meal}`) })} onPress={save} disabled={!valid} loading={log.add.isPending || log.update.isPending} />}>
      <Header title={food.name} />
      {food.brand ? <AppText tone="secondary">{food.brand}</AppText> : null}
      <AppText variant="label" tone="secondary" testID="custom-per100">
        {t('scan.per100', { kcal: per100.kcal, protein: per100.protein, carbs: per100.carbs, fat: per100.fat })}
      </AppText>

      <ChoiceGroup
        options={MEALS.map((m) => ({ value: m, label: t(`meals.${m}`) }))}
        value={meal}
        onChange={setMeal}
      />
      <TextField testID="custom-grams" label={t('scan.amount')} unit="g" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {quick.map((g) => (
          <Button
            key={g}
            testID={`grams-${g}`}
            variant="secondary"
            label={food.servingG === g ? t('scan.oneServing', { grams: g }) : `${g} g`}
            onPress={() => setGrams(String(g))}
          />
        ))}
      </View>

      <Card testID="custom-totals">
        <AppText variant="display">{n.kcal} kcal</AppText>
        <NutrientBar label={t('dashboard.protein')} value={n.protein} target={Math.max(n.protein, 1)} unit="g" />
        <AppText tone="secondary">{t('scan.macros', { carbs: n.carbs, fat: n.fat, fiber: n.fiber })}</AppText>
      </Card>
      {log.add.isError || log.update.isError ? <Banner tone="danger" text={t('errors.generic')} /> : null}
      {entry ? <Button testID="delete-entry" variant="danger" label={t('food.delete')} onPress={remove} /> : null}
    </Screen>
  );
}

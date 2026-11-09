import { recipeNutrition, roundNutrients } from '@fitmate/food-data';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ChoiceGroup, Screen } from '../../components/ui';
import { getEntry, type RecipeWithIngredients } from '../../db/foodRepo';
import type { Meal } from '../../db/schema';
import { useAddRecipeEntry, useDeleteEntry, useRecipes } from '../../features/food/hooks';
import { Stepper } from '../../features/food/ui';
import { localDate } from '../../lib/time';
import { space } from '../../theme/tokens';

export default function Recipes() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ meal?: string; date?: string; entryId?: string }>();
  const meal = (params.meal ?? 'lunch') as Meal;
  const date = params.date ?? localDate();
  const { data: recipes = [] } = useRecipes();
  const [openId, setOpenId] = useState<string | null>(null);
  const entry = useMemo(() => (params.entryId ? getEntry(params.entryId) : null), [params.entryId]);
  const del = useDeleteEntry();

  return (
    <Screen testID="recipes">
      <Header title={t('recipes.myRecipes')} />
      <AppText tone="secondary">{t('recipes.intro')}</AppText>

      {entry ? (
        <Card tone="accent">
          <AppText weight="bold">{entry.name}</AppText>
          <AppText variant="label" tone="secondary">
            {Math.round(entry.kcal)} kcal · {Math.round(entry.proteinG)} g {t('diary.proteinShort')}
          </AppText>
          <Button
            variant="secondary"
            label={t('food.delete')}
            onPress={async () => {
              await del.mutateAsync(entry.id);
              router.back();
            }}
          />
        </Card>
      ) : null}

      {recipes.length === 0 ? <Banner tone="accent" text={t('recipes.empty')} /> : null}

      {recipes.map((r) => (
        <RecipeCard
          key={r.id}
          recipe={r}
          open={openId === r.id}
          onToggle={() => setOpenId(openId === r.id ? null : r.id)}
          meal={meal}
          date={date}
        />
      ))}

      <Button testID="new-recipe" variant="secondary" label={t('recipes.new')} onPress={() => router.push('/food/recipe-edit')} />
    </Screen>
  );
}

function RecipeCard({ recipe, open, onToggle, meal, date }: { recipe: RecipeWithIngredients; open: boolean; onToggle: () => void; meal: Meal; date: string }) {
  const { t } = useTranslation();
  const add = useAddRecipeEntry();
  const weighed = recipe.totalCookedG != null;
  const [by, setBy] = useState<'servings' | 'grams'>('servings');
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(200);
  const n = recipeNutrition({ ingredients: recipe.ingredients, servings: recipe.servings, totalCookedGrams: recipe.totalCookedG });
  const per = roundNutrients(n.perServing);
  const share =
    by === 'grams' && n.per100g
      ? roundNutrients({ ...n.per100g, kcal: (n.per100g.kcal * grams) / 100, protein: (n.per100g.protein * grams) / 100, carbs: (n.per100g.carbs * grams) / 100, fat: (n.per100g.fat * grams) / 100, fiber: (n.per100g.fiber * grams) / 100 })
      : roundNutrients({ kcal: n.perServing.kcal * servings, protein: n.perServing.protein * servings, carbs: n.perServing.carbs * servings, fat: n.perServing.fat * servings, fiber: n.perServing.fiber * servings });

  return (
    <Card testID={`recipe-${recipe.id}`}>
      <Pressable accessibilityRole="button" onPress={onToggle} style={{ gap: 2 }}>
        <AppText variant="heading">{recipe.name}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('recipes.perServing', { kcal: per.kcal, protein: Math.round(per.protein), servings: recipe.servings })}
        </AppText>
      </Pressable>
      {open ? (
        <View style={{ gap: space.md }}>
          {weighed ? (
            <ChoiceGroup<'servings' | 'grams'>
              value={by}
              onChange={setBy}
              options={[
                { value: 'servings', label: t('recipes.byServings') },
                { value: 'grams', label: t('recipes.byGrams') },
              ]}
            />
          ) : null}
          <View style={{ alignItems: 'center' }}>
            {by === 'grams' && weighed ? (
              <Stepper value={grams} onChange={setGrams} step={25} min={25} max={3000} />
            ) : (
              <Stepper testID="share-servings" value={servings} onChange={setServings} step={0.5} min={0.5} max={recipe.servings * 2} />
            )}
            <AppText variant="caption" tone="secondary">
              {by === 'grams' && weighed ? 'g' : t('recipes.servingsLabel')}
            </AppText>
          </View>
          <AppText variant="label" center testID="share-kcal">
            {share.kcal} kcal · {Math.round(share.protein)} g {t('diary.proteinShort')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label={t('recipes.edit')} onPress={() => router.push({ pathname: '/food/recipe-edit', params: { id: recipe.id } })} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                testID="log-share"
                label={t('recipes.logShare')}
                loading={add.isPending}
                onPress={async () => {
                  await add.mutateAsync({ date, meal, recipeId: recipe.id, ...(by === 'grams' && weighed ? { grams } : { servings }) });
                  router.back();
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { getFood, recipeNutrition, roundNutrients, searchFoods } from '@fitmate/food-data';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ListGroup, Screen, TextField } from '../../components/ui';
import { getRecipe } from '../../db/foodRepo';
import { useDeleteRecipe, useSaveRecipe } from '../../features/food/hooks';
import { FoodRow, useFoodName } from '../../features/food/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { space, TOUCH } from '../../theme/tokens';

interface Ing {
  foodId: string;
  grams: string;
}

export default function RecipeEdit() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = useFoodName();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => (id ? getRecipe(id) : null), [id]);

  const [title, setTitle] = useState(existing?.name ?? '');
  const [servings, setServings] = useState(existing ? String(existing.servings) : '4');
  const [cooked, setCooked] = useState(existing?.totalCookedG ? String(existing.totalCookedG) : '');
  const [ings, setIngs] = useState<Ing[]>(existing?.ingredients.map((i) => ({ foodId: i.foodId, grams: String(i.grams) })) ?? []);
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useSaveRecipe();
  const del = useDeleteRecipe();

  const results = useMemo(() => searchFoods(query, { limit: 8, preferRaw: true }), [query]);
  const parsed = ings.map((i) => ({ foodId: i.foodId, grams: Number(i.grams.replace(',', '.')) }));
  const valid = parsed.filter((i) => i.grams > 0);
  const nServ = Number(servings.replace(',', '.'));
  const preview = valid.length && nServ > 0 ? roundNutrients(recipeNutrition({ ingredients: valid, servings: nServ }).perServing) : null;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = t('errors.required');
    if (!(nServ > 0 && nServ <= 50)) e.servings = t('errors.max', { max: 50 });
    const cookedN = cooked.trim() ? Number(cooked.replace(',', '.')) : null;
    if (cookedN != null && !(cookedN > 0 && cookedN <= 50000)) e.cooked = t('errors.number');
    if (valid.length === 0) e.ings = t('recipes.needIngredient');
    if (parsed.some((i) => !(i.grams > 0 && i.grams <= 20000))) e.ings = t('recipes.badGrams');
    setErrors(e);
    if (Object.keys(e).length) return;
    await save.mutateAsync({ input: { name: title.trim(), servings: nServ, totalCookedG: cookedN, ingredients: valid }, id: existing?.id });
    router.back();
  };

  return (
    <Screen
      testID="recipe-edit"
      footer={
        <View style={{ gap: space.sm }}>
          <Button testID="recipe-save" label={t('common.save')} onPress={submit} loading={save.isPending} />
          {existing ? (
            <Button
              variant="ghost"
              label={t('recipes.delete')}
              onPress={() =>
                Alert.alert(t('recipes.delete'), existing.name, [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('recipes.delete'),
                    style: 'destructive',
                    onPress: async () => {
                      await del.mutateAsync(existing.id);
                      router.back();
                    },
                  },
                ])
              }
            />
          ) : null}
        </View>
      }
    >
      <Header title={existing ? t('recipes.edit') : t('recipes.new')} />
      <AppText tone="secondary">{t('recipes.intro')}</AppText>
      <TextField testID="recipe-name" label={t('recipes.name')} placeholder={t('recipes.namePlaceholder')} value={title} onChangeText={setTitle} error={errors.title} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <TextField testID="recipe-servings" label={t('recipes.servings')} value={servings} onChangeText={setServings} keyboardType="decimal-pad" error={errors.servings} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label={t('recipes.cooked')} value={cooked} onChangeText={setCooked} keyboardType="decimal-pad" unit="g" optional error={errors.cooked} />
        </View>
      </View>
      <AppText variant="caption" tone="muted" style={{ marginTop: -space.sm }}>
        {t('recipes.cookedHint')}
      </AppText>

      <AppText variant="heading">{t('recipes.ingredients')}</AppText>
      {ings.length ? (
        <ListGroup>
          {ings.map((ing, idx) => (
            <View key={`${ing.foodId}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingLeft: space.lg, gap: space.sm }}>
              <AppText style={{ flex: 1 }}>{name(getFood(ing.foodId), ing.foodId)}</AppText>
              <View style={{ width: 110 }}>
                <TextField
                  testID={`ing-grams-${idx}`}
                  label=""
                  value={ing.grams}
                  onChangeText={(v) => setIngs(ings.map((x, i) => (i === idx ? { ...x, grams: v } : x)))}
                  keyboardType="decimal-pad"
                  unit="g"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('food.delete')}
                onPress={() => setIngs(ings.filter((_, i) => i !== idx))}
                style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </ListGroup>
      ) : null}
      {errors.ings ? <Banner tone="danger" text={errors.ings} /> : null}

      <TextField testID="ing-search" label={t('recipes.addIngredient')} placeholder={t('recipes.ingredientPlaceholder')} value={query} onChangeText={setQuery} autoCorrect={false} />
      {query.trim() && results.length ? (
        <ListGroup>
          {results.map((f) => (
            <FoodRow
              key={f.id}
              foodId={f.id}
              right={`${f.per100g.kcal} kcal / 100 g`}
              onPress={() => {
                setIngs([...ings, { foodId: f.id, grams: '100' }]);
                setQuery('');
              }}
            />
          ))}
        </ListGroup>
      ) : null}

      {preview ? (
        <Card tone="accent">
          <AppText variant="label" tone="accent" testID="recipe-preview">
            {t('recipes.perServing', { kcal: preview.kcal, protein: Math.round(preview.protein), servings: nServ })}
          </AppText>
        </Card>
      ) : null}
    </Screen>
  );
}

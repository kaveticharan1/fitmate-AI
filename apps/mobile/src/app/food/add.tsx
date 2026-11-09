import { FOODS, searchFoods } from '@fitmate/food-data';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Button, ListGroup, ListRow, Screen, TextField } from '../../components/ui';
import type { Meal } from '../../db/schema';
import { useFavourites, useRecentFoods } from '../../features/food/hooks';
import { useCustomFoods } from '../../features/food/packaged';
import { FoodRow } from '../../features/food/ui';
import { localDate } from '../../lib/time';
import { space } from '../../theme/tokens';

const POPULAR = ['idli', 'dosa', 'rice_cooked', 'pappu', 'sambar', 'chapati', 'chicken_curry', 'boiled_egg', 'curd', 'banana', 'tea', 'upma'];

export default function AddFood() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const meal = (params.meal ?? 'breakfast') as Meal;
  const date = params.date ?? localDate();
  const [query, setQuery] = useState('');
  const { data: recent = [] } = useRecentFoods();
  const { data: favourites = [] } = useFavourites();
  const results = useMemo(() => searchFoods(query, { limit: 40 }), [query]);
  const { data: packaged = [] } = useCustomFoods();
  const q = query.trim().toLowerCase();
  const packagedShown = q ? packaged.filter((f) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(q)) : packaged.slice(0, 8);
  const openPackaged = (customFoodId: string) => router.push({ pathname: '/food/custom', params: { customFoodId, meal, date } });
  const packagedSection = packagedShown.length ? (
    <View style={{ gap: space.sm }} testID="packaged">
      <AppText variant="label" tone="secondary" weight="bold">
        {t('scan.savedFoods')}
      </AppText>
      <ListGroup>
        {packagedShown.map((f) => (
          <ListRow key={f.id} testID={`packaged-${f.id}`} label={f.brand ? `${f.name} · ${f.brand}` : f.name} value={`${Math.round(f.kcal100)} kcal/100 g`} onPress={() => openPackaged(f.id)} />
        ))}
      </ListGroup>
    </View>
  ) : null;

  const open = (foodId: string) => router.push({ pathname: '/food/item', params: { foodId, meal, date } });

  const section = (title: string, ids: string[], testID: string) =>
    ids.length ? (
      <View style={{ gap: space.sm }} testID={testID}>
        <AppText variant="label" tone="secondary" weight="bold">
          {title}
        </AppText>
        <ListGroup>
          {ids.map((id) => (
            <FoodRow key={id} foodId={id} onPress={() => open(id)} />
          ))}
        </ListGroup>
      </View>
    ) : null;

  return (
    <Screen testID="add-food">
      <Header title={t('addFood.title', { meal: t(`meals.${meal}`) })} />
      <TextField
        testID="food-search"
        label={t('addFood.search')}
        placeholder={t('addFood.placeholder')}
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button testID="open-scan" variant="secondary" label={t('scan.button')} onPress={() => router.push({ pathname: '/food/scan', params: { meal, date } })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="open-photo" variant="secondary" label={t('photo.button')} onPress={() => router.push({ pathname: '/food/photo', params: { meal, date } })} />
        </View>
      </View>
      <Button testID="open-kitchen" variant="ghost" label={t('kitchen.open')} onPress={() => router.push({ pathname: '/food/kitchen', params: { meal, date } })} />
      {packagedSection}
      {query.trim() ? (
        results.length || packagedShown.length ? (
          section(t('addFood.results'), results.map((f) => f.id), 'search-results')
        ) : (
          <View style={{ gap: space.md }}>
            <AppText tone="secondary">{t('addFood.noResults')}</AppText>
            <Button variant="secondary" label={t('recipes.new')} onPress={() => router.push('/food/recipe-edit')} />
          </View>
        )
      ) : (
        <>
          {section(t('addFood.favourites'), favourites.slice(0, 10), 'favourites')}
          {section(t('addFood.recent'), recent.filter((id) => !favourites.includes(id)).slice(0, 10), 'recent')}
          {section(
            t('addFood.popular'),
            POPULAR.filter((id) => !recent.includes(id) && !favourites.includes(id) && FOODS.some((f) => f.id === id)),
            'popular',
          )}
          <Button
            testID="open-recipes"
            variant="secondary"
            label={t('recipes.myRecipes')}
            onPress={() => router.push({ pathname: '/food/recipes', params: { meal, date } })}
          />
        </>
      )}
    </Screen>
  );
}

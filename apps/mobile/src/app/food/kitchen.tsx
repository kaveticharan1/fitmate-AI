import { kitchenIngredients, kitchenQuestion, suggestDishes, type DietType, type DishMatch } from '@fitmate/food-data';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Button, ListGroup, ListRow, Screen, TextField } from '../../components/ui';
import { getSetting, setSetting } from '../../db/repositories';
import { useAiStatus } from '../../features/coach/hooks';
import { openCoach } from '../../features/coach/open';
import { useFoodName } from '../../features/food/ui';
import { useProfile } from '../../features/profile/hooks';
import { localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

export default function Kitchen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const meal = params.meal ?? 'lunch';
  const date = params.date ?? localDate();
  const { data: profile } = useProfile();
  const { data: ai } = useAiStatus();
  const name = useFoodName();
  const all = useMemo(() => kitchenIngredients(), []);
  const [have, setHave] = useState<string[]>(() => getSetting<string[]>('kitchenHave', []));
  const [query, setQuery] = useState('');

  const toggle = (id: string) =>
    setHave((h) => {
      const next = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
      setSetting('kitchenHave', next);
      return next;
    });

  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((f) => `${f.name} ${f.nameTe ?? ''} ${(f.aliases ?? []).join(' ')}`.toLowerCase().includes(q)) : all;
  const result = profile
    ? suggestDishes(have, { dietType: profile.dietType as DietType, allergies: profile.allergies, dislikes: profile.dislikedFoods })
    : { canMake: [], missingOne: [] };

  const open = (foodId: string) => router.push({ pathname: '/food/item', params: { foodId, meal, date } });
  const row = (m: DishMatch) => (
    <ListRow
      key={m.food.id}
      testID={`dish-${m.food.id}`}
      label={m.missing.length ? `${name(m.food, m.food.name)} · ${t('kitchen.need', { item: m.missing.map((id) => name(all.find((f) => f.id === id), id)).join(', ') })}` : name(m.food, m.food.name)}
      value={t('kitchen.per100', { kcal: Math.round(m.food.per100g.kcal), protein: m.food.per100g.protein })}
      onPress={() => open(m.food.id)}
    />
  );

  return (
    <Screen testID="kitchen">
      <Header title={t('kitchen.title')} />
      <AppText tone="secondary">{t('kitchen.intro')}</AppText>

      <TextField testID="kitchen-search" label={t('kitchen.search')} value={query} onChangeText={setQuery} autoCorrect={false} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} testID="ingredients">
        {shown.map((f) => {
          const on = have.includes(f.id);
          return (
            <Pressable
              key={f.id}
              testID={`have-${f.id}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(f.id)}
              style={{
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
                backgroundColor: on ? colors.accentSoft : colors.surface,
              }}
            >
              <AppText variant="label" tone={on ? 'accent' : 'primary'}>
                {name(f, f.name).replace(/\s*\((raw|uncooked)\)/i, '')}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {have.length ? (
        <Button testID="kitchen-clear" variant="ghost" label={t('kitchen.clear', { count: have.length })} onPress={() => { setHave([]); setSetting('kitchenHave', []); }} />
      ) : null}

      {have.length === 0 ? (
        <AppText tone="secondary">{t('kitchen.pickFirst')}</AppText>
      ) : (
        <>
          <View style={{ gap: space.sm }} testID="can-make">
            <AppText variant="heading">{t('kitchen.canMake')}</AppText>
            {result.canMake.length ? <ListGroup>{result.canMake.map(row)}</ListGroup> : <AppText tone="secondary">{t('kitchen.none')}</AppText>}
          </View>
          {result.missingOne.length ? (
            <View style={{ gap: space.sm }} testID="missing-one">
              <AppText variant="heading">{t('kitchen.missingOne')}</AppText>
              <ListGroup>{result.missingOne.map(row)}</ListGroup>
            </View>
          ) : null}
          <AppText variant="caption" tone="muted">
            {t('kitchen.note')}
          </AppText>
          {ai?.connected ? (
            <Button
              testID="kitchen-ask-coach"
              variant="secondary"
              label={t('kitchen.askCoach')}
              onPress={() => openCoach({ prefill: kitchenQuestion(have, i18n.language === 'te' ? 'te' : 'en') })}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

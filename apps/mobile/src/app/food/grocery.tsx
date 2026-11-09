import { Ionicons } from '@expo/vector-icons';
import { groceryList, type GroceryGroup, type GroceryItem } from '@fitmate/food-data';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Button, ListGroup, Screen } from '../../components/ui';
import { useWeekPlan } from '../../features/food/hooks';
import { localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { space, TOUCH } from '../../theme/tokens';

export default function Grocery() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const week = useWeekPlan(localDate());
  const items = useMemo(() => (week ? groceryList(week) : []), [week]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const te = i18n.language === 'te';

  const label = (i: GroceryItem) => (te && i.nameTe ? i.nameTe : i.name);
  const amount = (i: GroceryItem) => `${i.amount.value} ${i.amount.unit === 'pcs' ? t('grocery.pcs') : i.amount.unit}`;

  const groups = items.reduce<Record<string, GroceryItem[]>>((acc, i) => {
    (acc[i.group] ??= []).push(i);
    return acc;
  }, {});

  const share = async () => {
    const lines = Object.entries(groups).flatMap(([g, list]) => [
      `*${t(`grocery.groups.${g}`)}*`,
      ...list.filter((i) => !done.has(i.foodId)).map((i) => `• ${label(i)} — ${amount(i)}`),
      '',
    ]);
    await Share.share({ message: `${t('grocery.title')}\n\n${lines.join('\n')}`.trim() });
  };

  return (
    <Screen testID="grocery" footer={<Button testID="grocery-share" label={t('grocery.share')} onPress={share} />}>
      <Header title={t('grocery.title')} />
      <AppText variant="caption" tone="secondary">
        {t('grocery.note')}
      </AppText>
      {(Object.keys(groups) as GroceryGroup[]).map((g) => (
        <View key={g} style={{ gap: space.sm }}>
          <AppText variant="label" tone="secondary" weight="bold">
            {t(`grocery.groups.${g}`)}
          </AppText>
          <ListGroup>
            {groups[g]!.map((i) => {
              const checked = done.has(i.foodId);
              return (
                <Pressable
                  key={i.foodId}
                  testID={`grocery-${i.foodId}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => {
                    const next = new Set(done);
                    if (checked) next.delete(i.foodId);
                    else next.add(i.foodId);
                    setDone(next);
                  }}
                  style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, backgroundColor: colors.surface }}
                >
                  <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.accent : colors.textMuted} />
                  <AppText style={{ flex: 1, textDecorationLine: checked ? 'line-through' : 'none' }} tone={checked ? 'muted' : 'primary'}>
                    {label(i)}
                  </AppText>
                  <AppText tone="secondary">{amount(i)}</AppText>
                </Pressable>
              );
            })}
          </ListGroup>
        </View>
      ))}
    </Screen>
  );
}

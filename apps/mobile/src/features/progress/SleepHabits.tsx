import { Ionicons } from '@expo/vector-icons';
import { forgivingStreak, sleepMinutes } from '@fitmate/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, Card, ListGroup, TextField } from '../../components/ui';
import { localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { space, TOUCH } from '../../theme/tokens';
import { useHabitActions, useHabits, useLogSleep, useSleepHistory } from './hooks';

export const hoursText = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

export function SleepCard() {
  const { t } = useTranslation();
  const { data: nights = [] } = useSleepHistory(7);
  const log = useLogSleep();
  const today = nights.find((n) => n.wokeOn === localDate());
  const [bed, setBed] = useState(today?.bedTime ?? '23:00');
  const [wake, setWake] = useState(today?.wakeTime ?? '06:30');
  const [error, setError] = useState<string | null>(null);
  const avg = nights.length ? Math.round(nights.reduce((s, n) => s + n.minutes, 0) / nights.length) : null;

  const save = async () => {
    if (sleepMinutes(bed, wake) == null) {
      setError(t('reminders.badTime'));
      return;
    }
    setError(null);
    await log.mutateAsync({ bed, wake });
  };

  return (
    <Card testID="sleep-card">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">{t('sleep.title')}</AppText>
        {avg != null ? (
          <AppText variant="label" tone="secondary" testID="sleep-avg">
            {t('sleep.avg', { time: hoursText(avg), count: nights.length })}
          </AppText>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <TextField testID="sleep-bed" label={t('sleep.bed')} value={bed} onChangeText={setBed} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField testID="sleep-wake" label={t('sleep.wake')} value={wake} onChangeText={setWake} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button testID="sleep-save" variant="secondary" label={today ? t('sleep.update') : t('sleep.save')} onPress={save} loading={log.isPending} />
      {today ? (
        <AppText variant="caption" tone="accent">
          {t('sleep.lastNight', { time: hoursText(today.minutes) })}
        </AppText>
      ) : null}
    </Card>
  );
}

export function HabitsCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: habits = [] } = useHabits();
  const { add, remove, toggle } = useHabitActions();
  const [name, setName] = useState('');
  const today = localDate();

  return (
    <Card testID="habits-card">
      <AppText variant="heading">{t('habits.title')}</AppText>
      <AppText variant="caption" tone="secondary">
        {t('habits.hint')}
      </AppText>
      {habits.length ? (
        <ListGroup>
          {habits.map((h) => {
            const done = h.doneDates.includes(today);
            const streak = forgivingStreak(h.doneDates, today);
            return (
              <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface }}>
                <Pressable
                  testID={`habit-${h.name}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  onPress={() => toggle.mutate({ id: h.id, done: !done })}
                  style={{ flex: 1, minHeight: TOUCH + 4, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg }}
                >
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={done ? colors.accent : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <AppText>{h.name}</AppText>
                    {streak > 0 ? (
                      <AppText variant="caption" tone="accent">
                        {t('habits.streak', { count: streak })}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('food.delete')}
                  onPress={() => remove.mutate(h.id)}
                  style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          })}
        </ListGroup>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField testID="habit-name" label={t('habits.new')} placeholder={t('habits.placeholder')} value={name} onChangeText={setName} maxLength={40} />
        </View>
        <View style={{ width: 90 }}>
          <Button
            testID="habit-add"
            label={t('habits.add')}
            disabled={!name.trim()}
            onPress={async () => {
              await add.mutateAsync(name);
              setName('');
            }}
          />
        </View>
      </View>
    </Card>
  );
}

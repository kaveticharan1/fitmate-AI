import { averageSteps, stepsToKcal, stepsToKm } from '@fitmate/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Banner, Button, Card, ProgressBar, TextField } from '../../components/ui';
import { addDays, localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { useProfile } from '../profile/hooks';
import { useActivityPermission, useLiveSteps, useRequestActivityPermission, useStepSource } from '../steps/hooks';
import { useAutoSync, useHealthSettings, useManualSteps, useStepGoal, useStepHistory } from './hooks';

const fmt = (n: number) => n.toLocaleString('en-IN');

function syncedAgo(iso: string | null, now: number): number | null {
  return iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 60000)) : null;
}

export function StepsCard() {
  const { t } = useTranslation();
  const { data: settings } = useHealthSettings();
  const { data: days = [] } = useStepHistory(7);
  const { data: profile } = useProfile();
  const goal = useStepGoal(settings);
  const { data: src } = useStepSource();
  const phone = src?.source === 'phone' && src.sensor;
  const { data: permitted } = useActivityPermission();
  const allow = useRequestActivityPermission();
  const live = useLiveSteps(!!phone && permitted === true);
  const sync = useAutoSync(settings?.enabled && !phone);
  const manual = useManualSteps();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [now] = useState(() => Date.now());

  const today = localDate();
  const row = days.find((d) => d.day === today);
  // Typed-in totals win; otherwise the live phone count, then whatever is saved.
  const steps = row?.source === 'manual' ? row.steps : (live ?? row?.steps ?? 0);
  const ago = syncedAgo(settings?.lastSync ?? null, now);
  const parsed = Number(value.replace(/[,\s]/g, ''));
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 200000 && value.trim() !== '';

  const save = () => {
    if (!valid) return;
    manual.set.mutate({ day: today, steps: parsed }, { onSuccess: () => setEditing(false) });
  };

  return (
    <Card testID="steps-card">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">{t('steps.title')}</AppText>
        <AppText variant="label" tone="secondary" testID="steps-goal">
          {t('steps.goal', { goal: fmt(goal) })}
        </AppText>
      </View>
      <AppText variant="display" testID="steps-today">
        {fmt(steps)}
      </AppText>
      <ProgressBar value={goal > 0 ? steps / goal : 0} testID="steps-progress" />
      {steps > 0 && profile ? (
        <AppText variant="caption" tone="secondary">
          {t('steps.extra', { km: stepsToKm(steps, profile.heightCm), kcal: stepsToKcal(steps, profile.weightKg) })}
        </AppText>
      ) : null}
      {row?.flags.length ? <Banner tone="warning" text={t('steps.flagged')} /> : null}
      {row?.source === 'manual' ? (
        <AppText variant="caption" tone="secondary">
          {t('steps.typedIn')}
        </AppText>
      ) : phone ? (
        permitted === false ? null : (
          <AppText variant="caption" tone="success" testID="steps-phone">
            {live != null ? t('steps.phoneLive') : t('steps.phoneCounting')}
          </AppText>
        )
      ) : settings?.enabled ? (
        <AppText variant="caption" tone="secondary" testID="steps-synced">
          {sync.isPending ? t('steps.syncing') : ago == null ? t('steps.notSynced') : ago < 1 ? t('steps.syncedNow') : t('steps.syncedAgo', { minutes: ago })}
        </AppText>
      ) : null}
      {sync.data?.status === 'no_permission' ? <Banner tone="warning" text={t('steps.noPermission')} /> : null}
      {phone && permitted === false ? (
        <View style={{ gap: space.sm }} testID="steps-permission">
          <AppText variant="label" tone="secondary">
            {allow.data === false ? t('steps.permissionDenied') : t('steps.permissionWhy')}
          </AppText>
          {allow.data === false ? (
            <Button testID="steps-open-settings" variant="secondary" label={t('steps.openSettings')} onPress={() => Linking.openSettings()} />
          ) : (
            <Button testID="steps-allow" label={t('steps.allow')} onPress={() => allow.mutate()} loading={allow.isPending} />
          )}
        </View>
      ) : null}
      {src && !src.sensor && !settings?.enabled ? (
        <AppText variant="caption" tone="secondary" testID="steps-no-sensor">
          {t('steps.noSensor')}
        </AppText>
      ) : null}

      {editing ? (
        <View style={{ gap: space.sm }}>
          <TextField testID="steps-input" label={t('steps.enterLabel')} value={value} onChangeText={setValue} keyboardType="number-pad" />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label={t('common.cancel')} onPress={() => setEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button testID="steps-save" label={t('common.save')} onPress={save} disabled={!valid} />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {phone ? null : settings?.enabled ? (
            <View style={{ flex: 1 }}>
              <Button testID="steps-sync" variant="secondary" label={t('steps.sync')} onPress={() => sync.mutate(true)} loading={sync.isPending} />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Button testID="steps-connect" label={t('steps.connect')} onPress={() => router.push('/settings/health')} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button
              testID="steps-enter"
              variant="secondary"
              label={t('steps.enter')}
              onPress={() => {
                setValue(steps ? String(steps) : '');
                setEditing(true);
              }}
            />
          </View>
        </View>
      )}
      {row?.source === 'manual' && (settings?.enabled || phone) ? (
        <Button
          testID="steps-use-sync"
          variant="ghost"
          label={phone ? t('steps.usePhone') : t('steps.useSynced')}
          onPress={() => manual.clear.mutate(today, { onSuccess: () => (phone ? allow.mutate() : sync.mutate(true)) })}
        />
      ) : null}
    </Card>
  );
}

const WEEKDAYS_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAYS_TE = ['ఆ', 'సో', 'మం', 'బు', 'గు', 'శు', 'శ'];

/** Last 7 days as bars, with 7- and 30-day averages. */
export function StepsWeekCard() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { data: settings } = useHealthSettings();
  const { data: month = [] } = useStepHistory(30);
  const goal = useStepGoal(settings);
  const today = localDate();
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, steps: month.find((d) => d.day === day)?.steps ?? 0 };
  });
  const max = Math.max(goal, ...week.map((d) => d.steps), 1);
  const avg7 = averageSteps(week);
  const avg30 = averageSteps(month);
  const daysAtGoal = week.filter((d) => d.steps >= goal).length;
  const letters = i18n.language === 'te' ? WEEKDAYS_TE : WEEKDAYS_EN;

  return (
    <Card testID="steps-week">
      <AppText variant="heading">{t('steps.weekTitle')}</AppText>
      {avg7 == null ? (
        <AppText tone="secondary">{t('steps.noData')}</AppText>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: space.xs }}>
            {week.map((d) => {
              const [y, m, dd] = d.day.split('-').map(Number) as [number, number, number];
              const wd = new Date(y, m - 1, dd).getDay();
              const h = Math.max(2, Math.round((d.steps / max) * 96));
              return (
                <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: space.xs }} accessibilityLabel={`${d.day}: ${d.steps}`}>
                  <View style={{ width: '70%', height: h, borderRadius: radius.sm, backgroundColor: d.steps >= goal ? colors.accent : colors.surfaceRaised }} />
                  <AppText variant="caption" tone={d.day === today ? 'accent' : 'muted'}>
                    {letters[wd]}
                  </AppText>
                </View>
              );
            })}
          </View>
          <AppText testID="steps-avg">{t('steps.averages', { avg7: fmt(avg7), avg30: fmt(avg30 ?? avg7) })}</AppText>
          <AppText variant="caption" tone="secondary">
            {t('steps.daysAtGoal', { count: daysAtGoal, goal: fmt(goal) })}
          </AppText>
        </>
      )}
    </Card>
  );
}

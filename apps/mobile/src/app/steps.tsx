import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Header } from '../components/Header';
import { Banner, Card, Chip, ProgressBar, Screen } from '../components/ui';
import { useHealthSettings, useStepGoal, useStepHistory } from '../features/health/hooks';
import { useActivityPermission, useLiveSteps, useStepHours, useStepSource } from '../features/steps/hooks';
import { ACTIVE_HOUR_STEPS, hourLabel, summarizeHours } from '../features/steps/hourly';
import { addDays, isoToDisplayDate, localDate } from '../lib/time';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, TOUCH } from '../theme/tokens';

const fmt = (n: number) => n.toLocaleString('en-IN');
const CHART_H = 140;

/** Hour-by-hour log of the steps FitMate's own counter recorded. */
export default function StepLog() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = localDate();
  const [day, setDay] = useState(today);
  const [picked, setPicked] = useState<number | null>(null);
  const isToday = day === today;

  const { data: src } = useStepSource();
  const phone = src?.source === 'phone' && src.sensor;
  const { data: permitted } = useActivityPermission();
  useLiveSteps(!!phone && permitted === true && isToday);
  const { data: hours = Array.from({ length: 24 }, () => 0) } = useStepHours(day);
  const { data: settings } = useHealthSettings();
  const goal = useStepGoal(settings);
  const { data: days = [] } = useStepHistory(40);
  const row = days.find((d) => d.day === day);

  const s = summarizeHours(hours);
  const max = Math.max(...hours, ACTIVE_HOUR_STEPS);
  const nowHour = new Date().getHours();
  const typed = row?.source === 'manual';
  const dayTotal = typed ? row!.steps : Math.max(s.total, row?.steps ?? 0);
  const go = (n: number) => {
    setPicked(null);
    setDay(addDays(day, n));
  };

  return (
    <Screen testID="step-log">
      <Header title={t('stepLog.title')} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable testID="step-log-prev" accessibilityRole="button" accessibilityLabel={t('stepLog.prevDay')} onPress={() => go(-1)} disabled={day <= addDays(today, -34)} style={navBtn(colors)}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <AppText variant="heading" testID="step-log-day">
          {isToday ? t('stepLog.today') : day === addDays(today, -1) ? t('stepLog.yesterday') : isoToDisplayDate(day)}
        </AppText>
        <Pressable
          testID="step-log-next"
          accessibilityRole="button"
          accessibilityLabel={t('stepLog.nextDay')}
          accessibilityState={{ disabled: isToday }}
          onPress={() => !isToday && go(1)}
          style={[navBtn(colors), { opacity: isToday ? 0.35 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      {!phone ? <Banner tone="warning" text={t('stepLog.needsPhone')} /> : null}
      {phone && permitted === false ? <Banner tone="warning" text={t('steps.permissionWhy')} /> : null}

      <Card testID="step-log-summary">
        <AppText variant="display" testID="step-log-total">
          {fmt(dayTotal)}
        </AppText>
        <ProgressBar value={goal > 0 ? dayTotal / goal : 0} color={colors.success} />
        <AppText variant="label" tone="secondary">
          {t('steps.goal', { goal: fmt(goal) })}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {s.busiest ? (
            <Chip testID="step-log-busiest" tone="accent" label={t('stepLog.busiest', { hour: hourLabel(s.busiest.hour), steps: fmt(s.busiest.steps) })} />
          ) : null}
          <Chip tone="success" label={t('stepLog.activeHours', { count: s.activeHours })} />
        </View>
        {typed ? (
          <AppText variant="caption" tone="secondary">
            {t('stepLog.typedNote')}
          </AppText>
        ) : null}
      </Card>

      <Card testID="step-log-chart">
        <AppText weight="bold">{t('stepLog.byHour')}</AppText>
        <View style={{ height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }} accessibilityLabel={t('stepLog.chartLabel', { total: fmt(s.total) })}>
          {hours.map((n, h) => {
            const future = isToday && h > nowHour;
            const active = picked === h;
            return (
              <Pressable
                key={h}
                testID={`step-bar-${h}`}
                accessibilityRole="button"
                accessibilityLabel={t('stepLog.hourRange', { from: hourLabel(h), to: hourLabel((h + 1) % 24), steps: fmt(n) })}
                onPress={() => setPicked(active ? null : h)}
                style={{ flex: 1, height: CHART_H, justifyContent: 'flex-end' }}
              >
                <View
                  style={{
                    height: n > 0 ? Math.max(4, (n / max) * (CHART_H - 8)) : 2,
                    borderRadius: 3,
                    backgroundColor: active ? colors.accent : future ? colors.track : n >= ACTIVE_HOUR_STEPS ? colors.success : n > 0 ? colors.info : colors.border,
                    opacity: future ? 0.4 : 1,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[0, 6, 12, 18, 23].map((h) => (
            <AppText key={h} variant="caption" tone="muted">
              {hourLabel(h)}
            </AppText>
          ))}
        </View>
        <AppText variant="label" tone={picked != null ? 'accent' : 'muted'} testID="step-log-picked">
          {picked != null ? t('stepLog.hourRange', { from: hourLabel(picked), to: hourLabel((picked + 1) % 24), steps: fmt(hours[picked] ?? 0) }) : t('stepLog.tapBar')}
        </AppText>
      </Card>

      <Card testID="step-log-list">
        <AppText weight="bold">{t('stepLog.hourByHour')}</AppText>
        {s.hours.length === 0 ? (
          <AppText tone="secondary" testID="step-log-empty">
            {isToday ? t('stepLog.emptyToday') : t('stepLog.empty')}
          </AppText>
        ) : (
          s.hours.map(({ hour, steps }) => (
            <View key={hour} testID={`step-hour-${hour}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40 }}>
              <AppText style={{ width: 120 }} tone={isToday && hour === nowHour ? 'accent' : 'primary'}>
                {`${hourLabel(hour)} – ${hourLabel((hour + 1) % 24)}`}
              </AppText>
              <View style={{ flex: 1 }}>
                <ProgressBar value={steps / max} color={steps >= ACTIVE_HOUR_STEPS ? colors.success : colors.info} />
              </View>
              <AppText weight="bold" style={{ width: 64, textAlign: 'right' }}>
                {fmt(steps)}
              </AppText>
            </View>
          ))
        )}
      </Card>

      <AppText variant="caption" tone="muted">
        {t('stepLog.note')}
      </AppText>
    </Screen>
  );
}

const navBtn = (colors: { surfaceRaised: string }) => ({
  width: TOUCH,
  height: TOUCH,
  borderRadius: radius.pill,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: colors.surfaceRaised,
});

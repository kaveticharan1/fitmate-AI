import { rollingAverage, summariseWeek, weeklyRate } from '@fitmate/core';
import { optionalNumber } from '@fitmate/validation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Banner, Button, Card, ChoiceGroup, Screen, TextField } from '../../components/ui';
import { useTargets } from '../../features/food/hooks';
import { useProfile } from '../../features/profile/hooks';
import { HabitsCard, SleepCard } from '../../features/progress/SleepHabits';
import { TrendChart } from '../../features/progress/TrendChart';
import { router } from 'expo-router';
import { useLogMeasurements, useMeasurementHistory, useWaistHistory, useWeekFood, useWeightHistory } from '../../features/progress/hooks';
import { space } from '../../theme/tokens';

const FIELDS = [
  { key: 'waistCm', col: 'waist', label: 'onboarding.body.waist', range: [40, 250] },
  { key: 'hipCm', col: 'hip', label: 'onboarding.body.hip', range: [40, 250] },
  { key: 'chestCm', col: 'chest', label: 'progress.chest', range: [40, 250] },
  { key: 'armCm', col: 'arm', label: 'progress.arm', range: [10, 80] },
] as const;

export default function Progress() {
  const { t } = useTranslation();
  const [range, setRange] = useState<'30' | '90' | '365'>('90');
  const { data: profile } = useProfile();
  const targets = useTargets();
  const { data: weights = [] } = useWeightHistory(Number(range));
  const { data: waist = [] } = useWaistHistory(Number(range));
  const { data: week = [] } = useWeekFood();

  const trend = rollingAverage(weights);
  const rate = weeklyRate(weights);
  const summary = targets ? summariseWeek(week, { kcal: targets.targetKcal, protein: targets.proteinG }) : null;

  return (
    <Screen testID="progress">
      <AppText variant="title" style={{ paddingTop: space.sm }}>
        {t('progress.title')}
      </AppText>
      <ChoiceGroup<'30' | '90' | '365'>
        value={range}
        onChange={setRange}
        options={[
          { value: '30', label: t('progress.d30') },
          { value: '90', label: t('progress.d90') },
          { value: '365', label: t('progress.d365') },
        ]}
      />

      <Card testID="weight-trend">
        <AppText variant="heading">{t('dashboard.weight')}</AppText>
        {weights.length >= 2 ? (
          <>
            <TrendChart points={weights} trend={trend} target={profile?.targetWeightKg} />
            <AppText variant="label" testID="weight-rate">
              {rate == null ? t('progress.needWeek') : rate < 0 ? t('progress.losing', { kg: Math.abs(rate) }) : rate > 0 ? t('progress.gaining', { kg: rate }) : t('progress.steady')}
            </AppText>
            <AppText variant="caption" tone="muted">
              {t('progress.chartKey')}
            </AppText>
          </>
        ) : (
          <AppText tone="secondary">{t('progress.weightEmpty')}</AppText>
        )}
      </Card>

      <Button testID="open-report" label={t('report.open')} onPress={() => router.push('/report')} />

      <MeasurementsCard waist={waist} days={Number(range)} />
      <SleepCard />
      <HabitsCard />

      {summary ? (
        <Card testID="week-summary">
          <AppText variant="heading">{t('progress.weekTitle')}</AppText>
          {summary.daysLogged === 0 ? (
            <AppText tone="secondary">{t('progress.weekEmpty')}</AppText>
          ) : (
            <View style={{ gap: space.xs }}>
              <AppText>{t('progress.daysLogged', { count: summary.daysLogged })}</AppText>
              <AppText>{t('progress.avgKcal', { kcal: summary.avgKcal, target: targets!.targetKcal })}</AppText>
              <AppText>{t('progress.avgProtein', { g: summary.avgProtein, target: targets!.proteinG })}</AppText>
              <AppText tone="secondary">{t('progress.onTarget', { kcalDays: summary.daysOnTarget, proteinDays: summary.daysProteinMet, count: summary.daysLogged })}</AppText>
            </View>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

function MeasurementsCard({ waist, days }: { waist: { date: string; value: number }[]; days: number }) {
  const { t } = useTranslation();
  const save = useLogMeasurements();
  const { data: rows = [] } = useMeasurementHistory(days);
  const [text, setText] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const out: Record<string, number> = {};
    const errs: Record<string, string> = {};
    for (const f of FIELDS) {
      const r = optionalNumber(f.range[0], f.range[1]).safeParse(text[f.key] ?? '');
      if (!r.success) errs[f.key] = t(r.error.issues[0]!.message, { min: f.range[0], max: f.range[1] });
      else if (r.data != null) out[f.key] = r.data;
    }
    if (!Object.keys(errs).length && !Object.keys(out).length) errs.waistCm = t('progress.measureOne');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await save.mutateAsync(out);
    setText({});
  };

  // First and latest value of each measurement in the selected period.
  const changes = FIELDS.map((f) => {
    const vals = rows.map((r) => r[f.col]).filter((v): v is number => v != null);
    return { f, first: vals[0], last: vals[vals.length - 1], n: vals.length };
  }).filter((c) => c.n > 0);

  return (
    <Card testID="measurements-card">
      <AppText variant="heading">{t('progress.measurements')}</AppText>
      {waist.length >= 2 ? <TrendChart points={waist} trend={rollingAverage(waist, 14)} /> : null}
      {changes.length ? (
        changes.map(({ f, first, last, n }) => (
          <AppText key={f.key} variant="label" testID={`change-${f.col}`}>
            {t(f.label)}: {n >= 2 ? t('progress.waistChange', { from: first, to: last, diff: Math.round((last! - first!) * 10) / 10 }) : `${last} cm`}
          </AppText>
        ))
      ) : (
        <AppText tone="secondary">{t('progress.waistEmpty')}</AppText>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {FIELDS.map((f) => (
          <View key={f.key} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <TextField
              testID={`measure-${f.col}`}
              label={t(f.label)}
              value={text[f.key] ?? ''}
              onChangeText={(v) => {
                setText({ ...text, [f.key]: v });
                setErrors({});
              }}
              keyboardType="decimal-pad"
              unit="cm"
              optional={f.key !== 'waistCm'}
              error={errors[f.key]}
            />
          </View>
        ))}
      </View>
      <Button testID="measure-save" label={t('common.save')} onPress={submit} loading={save.isPending} />
      <AppText variant="caption" tone="muted">
        {t('progress.measureHint')}
      </AppText>
      {save.isError ? <Banner tone="danger" text={t('errors.generic')} /> : null}
    </Card>
  );
}

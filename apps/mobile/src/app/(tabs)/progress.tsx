import { rollingAverage, summariseWeek, weeklyRate } from '@fitmate/core';
import { optionalNumber } from '@fitmate/validation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Banner, Button, Card, ChoiceGroup, Screen, TextField } from '../../components/ui';
import { useTargets } from '../../features/food/hooks';
import { useProfile } from '../../features/profile/hooks';
import { TrendChart } from '../../features/progress/TrendChart';
import { useLogWaist, useWaistHistory, useWeekFood, useWeightHistory } from '../../features/progress/hooks';
import { space } from '../../theme/tokens';

const waistField = optionalNumber(40, 250);

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

      <WaistCard points={waist} />

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

function WaistCard({ points }: { points: { date: string; value: number }[] }) {
  const { t } = useTranslation();
  const logWaist = useLogWaist();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const save = async () => {
    const r = waistField.safeParse(text);
    if (!r.success || r.data == null) {
      setError(r.success ? t('errors.required') : t(r.error.issues[0]!.message, { min: 40, max: 250 }));
      return;
    }
    await logWaist.mutateAsync(r.data);
    setText('');
    setError(undefined);
  };
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <Card testID="waist-trend">
      <AppText variant="heading">{t('onboarding.body.waist')}</AppText>
      {points.length >= 2 ? <TrendChart points={points} trend={rollingAverage(points, 14)} /> : null}
      {first && last && points.length >= 2 ? (
        <AppText variant="label">{t('progress.waistChange', { from: first.value, to: last.value, diff: Math.round((last.value - first.value) * 10) / 10 })}</AppText>
      ) : (
        <AppText tone="secondary">{t('progress.waistEmpty')}</AppText>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField testID="waist-input" label={t('progress.logWaist')} value={text} onChangeText={(v) => { setText(v); setError(undefined); }} keyboardType="decimal-pad" unit="cm" error={error} />
        </View>
        <View style={{ width: 100, paddingBottom: error ? 22 : 0 }}>
          <Button testID="waist-save" label={t('common.save')} onPress={save} loading={logWaist.isPending} />
        </View>
      </View>
      <AppText variant="caption" tone="muted">
        {t('onboarding.body.waistHint')}
      </AppText>
      {logWaist.isError ? <Banner tone="danger" text={t('errors.generic')} /> : null}
    </Card>
  );
}

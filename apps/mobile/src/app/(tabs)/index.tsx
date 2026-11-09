import type { NutritionTargets } from '@fitmate/core';
import { requiredNumber } from '@fitmate/validation';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Banner, Button, Card, ProgressBar, Screen, TextField, useErrorText } from '../../components/ui';
import { router } from 'expo-router';
import { totalsOf } from '../../db/foodRepo';
import { useDiary } from '../../features/food/hooks';
import { NutrientBar } from '../../features/food/ui';
import { useLogWeight, useProfile, useRecentWeights } from '../../features/profile/hooks';
import { targetsForProfile } from '../../features/profile/targets';
import { isoToDisplayDate, localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

const weightField = requiredNumber(25, 350);

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const targets = useMemo(() => (profile ? targetsForProfile(profile) : null), [profile]);
  if (!profile || !targets) return <Screen>{null}</Screen>;

  return (
    <Screen testID="dashboard">
      <View style={{ gap: space.xs, paddingTop: space.sm }}>
        <AppText variant="caption" tone="secondary">
          {isoToDisplayDate(localDate())}
        </AppText>
        <AppText variant="title">{t('dashboard.hello', { name: profile.name })}</AppText>
      </View>

      <TodayCard targets={targets} />
      <CalorieCard targets={targets} />
      <MacroRow targets={targets} />
      {targets.flags.map((f) => (
        <Banner key={f} tone="warning" text={t(`dashboard.flags.${f}`)} />
      ))}
      <WeightCard current={profile.weightKg} target={profile.targetWeightKg} targets={targets} />
      <BmiCard targets={targets} />

      <AppText variant="caption" tone="muted">
        {t('dashboard.estimatesNote')}
      </AppText>
    </Screen>
  );
}

function TodayCard({ targets }: { targets: NutritionTargets }) {
  const { t } = useTranslation();
  const { data: entries = [] } = useDiary(localDate());
  const eaten = totalsOf(entries);
  return (
    <Card testID="today-card">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="heading">{t('diary.today')}</AppText>
        <AppText variant="label" tone="secondary">
          {t('dashboard.eatenOf', { eaten: eaten.kcal.toLocaleString('en-IN'), target: targets.targetKcal.toLocaleString('en-IN') })}
        </AppText>
      </View>
      <NutrientBar label={t('dashboard.calorieTarget')} value={eaten.kcal} target={targets.targetKcal} unit="kcal" />
      <NutrientBar label={t('dashboard.protein')} value={eaten.protein} target={targets.proteinG} unit="g" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button testID="open-diary" variant="secondary" label={t('dashboard.openDiary')} onPress={() => router.navigate('/food')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="open-plan" variant="secondary" label={t('dashboard.openPlan')} onPress={() => router.navigate('/plan')} />
        </View>
      </View>
    </Card>
  );
}

function CalorieCard({ targets }: { targets: NutritionTargets }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const delta = targets.dailyDeltaKcal;
  const weekly = Math.abs(targets.expectedWeeklyChangeKg).toFixed(2);
  const line =
    Math.abs(delta) < 10
      ? t('dashboard.atMaintenance')
      : delta > 0
        ? t('dashboard.belowMaintenance', { kcal: delta, kg: weekly })
        : t('dashboard.aboveMaintenance', { kcal: -delta, kg: weekly });
  return (
    <Card testID="calorie-card">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText tone="secondary">{t('dashboard.calorieTarget')}</AppText>
        <View style={{ backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 }}>
          <AppText variant="caption" tone="secondary">
            {t('dashboard.estimate')}
          </AppText>
        </View>
      </View>
      <AppText variant="display" testID="target-kcal">
        {targets.targetKcal.toLocaleString('en-IN')}{' '}
        <AppText variant="heading" tone="secondary" weight="regular">
          {t('common.kcal')}
        </AppText>
      </AppText>
      <AppText variant="label" tone="secondary">
        {line}
      </AppText>
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <Stat label={t('dashboard.maintenance')} value={`${targets.maintenanceKcal.toLocaleString('en-IN')} ${t('common.kcal')}`} />
        <Stat label={t('dashboard.bmr')} value={`${targets.bmrKcal.toLocaleString('en-IN')} ${t('common.kcal')}`} />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="label" weight="bold">
        {value}
      </AppText>
    </View>
  );
}

function MacroRow({ targets }: { targets: NutritionTargets }) {
  const { t } = useTranslation();
  const items = [
    { label: t('dashboard.protein'), value: `${targets.proteinG} ${t('common.g')}` },
    { label: t('dashboard.carbs'), value: `${targets.carbsG} ${t('common.g')}` },
    { label: t('dashboard.fat'), value: `${targets.fatG} ${t('common.g')}` },
    { label: t('dashboard.water'), value: `${(targets.waterMl / 1000).toFixed(1)} ${t('common.litres')}` },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {items.map((i) => (
        <Card key={i.label} style={{ flexGrow: 1, flexBasis: '45%', padding: space.md, gap: space.xs }}>
          <AppText variant="caption" tone="secondary">
            {i.label}
          </AppText>
          <AppText variant="heading">{i.value}</AppText>
        </Card>
      ))}
    </View>
  );
}

function WeightCard({ current, target, targets }: { current: number; target: number | null; targets: NutritionTargets }) {
  const { t } = useTranslation();
  const errText = useErrorText();
  const { data: weights } = useRecentWeights();
  const logWeight = useLogWeight();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  const start = weights && weights.length > 0 ? weights[weights.length - 1]!.weightKg : current;
  const remaining = target != null ? Math.round((current - target) * 10) / 10 : null;
  const progress = target != null && start !== target ? (start - current) / (start - target) : 0;
  const last = weights?.[0];

  const save = async () => {
    const r = weightField.safeParse(text);
    if (!r.success) {
      setError(errText(r.error.issues[0]?.message, [25, 350]));
      return;
    }
    await logWeight.mutateAsync(r.data);
    setOpen(false);
    setText('');
    setError(undefined);
  };

  return (
    <Card testID="weight-card">
      <AppText variant="heading">{t('dashboard.weight')}</AppText>
      <View style={{ flexDirection: 'row', gap: space.xl }}>
        <Stat label={t('dashboard.current')} value={`${current} ${t('common.kg')}`} />
        {target != null ? <Stat label={t('dashboard.target')} value={`${target} ${t('common.kg')}`} /> : null}
      </View>
      {target != null ? (
        <>
          <ProgressBar value={progress} />
          <AppText variant="label" tone="secondary">
            {remaining != null && Math.abs(remaining) < 0.1
              ? t('dashboard.reached')
              : t('dashboard.toGo', { kg: Math.abs(remaining ?? 0) })}
            {targets.estimatedWeeksToTarget != null ? `  ·  ${t('dashboard.weeks', { count: targets.estimatedWeeksToTarget })}` : ''}
          </AppText>
        </>
      ) : null}
      {last ? (
        <AppText variant="caption" tone="muted">
          {t('dashboard.lastLogged', { date: isoToDisplayDate(last.measuredOn) })}
        </AppText>
      ) : null}
      {open ? (
        <View style={{ gap: space.sm }}>
          <TextField
            testID="weight-input"
            label={t('dashboard.logWeightTitle')}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(undefined);
            }}
            keyboardType="decimal-pad"
            unit={t('common.kg')}
            error={error}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label={t('common.cancel')} onPress={() => setOpen(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button testID="weight-save" label={t('common.save')} onPress={save} loading={logWeight.isPending} />
            </View>
          </View>
        </View>
      ) : (
        <Button testID="weight-log" variant="secondary" label={t('dashboard.logWeight')} onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

function BmiCard({ targets }: { targets: NutritionTargets }) {
  const { t } = useTranslation();
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText tone="secondary">{t('dashboard.bmi')}</AppText>
        <AppText variant="heading">{targets.bmi.toFixed(1)}</AppText>
      </View>
      <AppText variant="label">{t(`options.bmi.${targets.bmiCategory}`)}</AppText>
      <AppText variant="caption" tone="muted">
        {t('dashboard.bmiNote')}
      </AppText>
    </Card>
  );
}

import { getIngredient } from '@fitmate/skin';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, CheckRow, ChoiceGroup, Screen, TextField } from '../../components/ui';
import type { SkincareStepRow } from '../../db/schema';
import { useGenerateRoutine, useRoutineDone, useRoutineSteps, useSaveSteps, useSkinProfile, useTickRoutine } from '../../features/skin/hooks';
import { localDate } from '../../lib/time';
import { space } from '../../theme/tokens';

function StepDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const ing = getIngredient(id);
  if (!ing) return null;
  return (
    <View style={{ gap: space.xs }} testID={`detail-${id}`}>
      <AppText>{ing.what}</AppText>
      <AppText tone="secondary">{`${t('skin.how')}: ${ing.howToUse}`}</AppText>
      <AppText tone="secondary">{`${t('skin.start')}: ${ing.start}`}</AppText>
      {ing.precautions.map((p, i) => (
        <AppText key={i} tone="warning">{`⚠ ${p}`}</AppText>
      ))}
      {ing.avoidWith.length ? <AppText tone="secondary">{t('skin.notWith', { list: ing.avoidWith.map((a) => getIngredient(a)?.name ?? a).join(', ') })}</AppText> : null}
      {ing.pregnancy !== 'ok' ? <AppText tone="warning">{t(`skin.pregnancyNote.${ing.pregnancy}`)}</AppText> : null}
      {ing.seeProfessional ? <AppText tone="secondary">{ing.seeProfessional}</AppText> : null}
      {ing.sources.map((s) => (
        <AppText key={s.url} variant="caption" tone="accent" onPress={() => Linking.openURL(s.url)}>
          {`${t('skin.source')}: ${s.name}`}
        </AppText>
      ))}
    </View>
  );
}

export default function RoutineScreen() {
  const { t } = useTranslation();
  const { data: profile } = useSkinProfile();
  const { data: steps = [] } = useRoutineSteps();
  const { data: done = [] } = useRoutineDone();
  const generate = useGenerateRoutine();
  const saveSteps = useSaveSteps();
  const tick = useTickRoutine();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<'am' | 'pm' | null>(null);
  const [newStep, setNewStep] = useState('');
  const [newProduct, setNewProduct] = useState('');
  const today = localDate();

  if (!profile) {
    return (
      <Screen testID="routine">
        <Header title={t('skin.routineTitle')} />
        <Card>
          <AppText>{t('skin.needProfile')}</AppText>
          <Button testID="routine-make-profile" label={t('skin.profileTitle')} onPress={() => router.push('/wellness/skin-profile')} />
        </Card>
      </Screen>
    );
  }

  const asInput = (s: SkincareStepRow) => ({ slot: s.slot, step: s.step, product: s.product, ingredient: s.ingredient, frequency: s.frequency });
  const remove = (id: string) => saveSteps.mutate(steps.filter((s) => s.id !== id).map(asInput));
  const add = () => {
    if (!adding || !newStep.trim()) return;
    saveSteps.mutate([...steps.map(asInput), { slot: adding, step: newStep, product: newProduct || null, ingredient: null, frequency: 'daily' }], {
      onSuccess: () => {
        setAdding(null);
        setNewStep('');
        setNewProduct('');
      },
    });
  };
  const slotDone = (slot: 'am' | 'pm') => done.some((d) => d.day === today && d.slot === slot);
  const week = (slot: 'am' | 'pm') => done.filter((d) => d.slot === slot).length;

  return (
    <Screen testID="routine">
      <Header title={t('skin.routineTitle')} />
      {steps.length === 0 ? (
        <Card testID="routine-empty">
          <AppText>{t('skin.noRoutine')}</AppText>
          <Button testID="routine-generate" label={t('skin.generate')} onPress={() => generate.mutate()} loading={generate.isPending} />
        </Card>
      ) : null}
      {generate.data?.seeProfessional ? <Banner tone="accent" text={t('skin.seeDerm')} /> : null}
      {generate.data ? (
        <Card testID="routine-notes">
          {generate.data.notes.map((n, i) => (
            <AppText key={i} tone="secondary">{`• ${n}`}</AppText>
          ))}
        </Card>
      ) : null}

      {(['am', 'pm'] as const).map((slot) => {
        const list = steps.filter((s) => s.slot === slot);
        if (!list.length && steps.length === 0) return null;
        return (
          <Card key={slot} testID={`routine-${slot}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="heading">{t(`skin.slot.${slot}`)}</AppText>
              <AppText variant="caption" tone="secondary">
                {t('skin.week', { count: week(slot) })}
              </AppText>
            </View>
            {list.map((s, i) => (
              <View key={s.id} style={{ gap: space.xs }}>
                <AppText weight="bold">{`${i + 1}. ${t(`skin.stepKind.${s.step}`, { defaultValue: s.step })}`}</AppText>
                {s.product ? <AppText tone="secondary">{s.product}</AppText> : null}
                <AppText variant="caption" tone="secondary">
                  {s.frequency}
                </AppText>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {s.ingredient ? <Button testID={`step-more-${s.id}`} variant="ghost" label={open === s.id ? t('face.hide') : t('skin.more')} onPress={() => setOpen(open === s.id ? null : s.id)} /> : null}
                  <Button testID={`step-remove-${s.id}`} variant="ghost" label={t('skin.remove')} onPress={() => remove(s.id)} />
                </View>
                {open === s.id && s.ingredient ? <StepDetail id={s.ingredient} /> : null}
              </View>
            ))}
            <CheckRow testID={`tick-${slot}`} label={t('skin.doneToday')} value={slotDone(slot)} onChange={(v) => tick.mutate({ slot, done: v })} />
            <Button testID={`add-step-${slot}`} variant="secondary" label={t('skin.addStep')} onPress={() => setAdding(slot)} />
          </Card>
        );
      })}

      {adding ? (
        <Card testID="add-step-card">
          <ChoiceGroup<'am' | 'pm'> options={(['am', 'pm'] as const).map((x) => ({ value: x, label: t(`skin.slot.${x}`) }))} value={adding} onChange={setAdding} />
          <TextField testID="new-step" label={t('skin.stepName')} value={newStep} onChangeText={setNewStep} />
          <TextField testID="new-product" label={t('skin.productName')} value={newProduct} onChangeText={setNewProduct} optional />
          <Button testID="add-step-save" label={t('common.save')} onPress={add} disabled={!newStep.trim()} />
        </Card>
      ) : null}

      {steps.length ? <Button testID="routine-regenerate" variant="ghost" label={t('skin.regenerate')} onPress={() => generate.mutate()} /> : null}
      <AppText variant="caption" tone="muted">
        {t('skin.disclaimer')}
      </AppText>
    </Screen>
  );
}

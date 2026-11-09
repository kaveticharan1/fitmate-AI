import {
  ACTIVITY_LEVELS,
  BUDGETS,
  COACH_PERSONALITIES,
  COOKING_TIME,
  DIET_TYPES,
  GOALS,
  LANGUAGES,
  profileSchema,
  SEXES,
  WORKOUT_PREFERENCES,
  type Profile,
  type ProfileInput,
} from '@fitmate/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Banner, Button, ChoiceGroup, ProgressBar, Screen, TextField, ToggleRow, useErrorText } from '../../components/ui';
import type { ProfileRow } from '../../db/schema';
import { isoToDisplayDate } from '../../lib/time';
import { space } from '../../theme/tokens';

export const EMPTY_PROFILE: ProfileInput = {
  name: '',
  dateOfBirth: '',
  sex: 'unspecified',
  heightCm: '',
  weightKg: '',
  targetWeightKg: '',
  waistCm: '',
  hipCm: '',
  goal: 'fat_loss',
  activityLevel: 'sedentary',
  occupation: '',
  sleepHours: '',
  workoutPreference: 'walking',
  equipment: '',
  coachPersonality: 'friendly',
  dietType: 'non_vegetarian',
  allergies: '',
  dislikedFoods: '',
  cookingTime: 'under_30',
  budget: 'medium',
  isPregnantOrBreastfeeding: false,
  hasEatingDisorderHistory: false,
  hasMedicalCondition: false,
  healthNotes: '',
  injuries: '',
  aiLanguage: 'en',
};

const num = (v: number | null | undefined) => (v == null ? '' : String(v));

export function profileRowToInput(p: ProfileRow): ProfileInput {
  return {
    name: p.name,
    dateOfBirth: isoToDisplayDate(p.dateOfBirth),
    sex: p.sex,
    heightCm: num(p.heightCm),
    weightKg: num(p.weightKg),
    targetWeightKg: num(p.targetWeightKg),
    waistCm: num(p.waistCm),
    hipCm: num(p.hipCm),
    goal: p.goal as ProfileInput['goal'],
    activityLevel: p.activityLevel as ProfileInput['activityLevel'],
    occupation: p.occupation ?? '',
    sleepHours: num(p.sleepHours),
    workoutPreference: p.workoutPreference as ProfileInput['workoutPreference'],
    equipment: p.equipment.join(', '),
    coachPersonality: p.coachPersonality as ProfileInput['coachPersonality'],
    dietType: p.dietType as ProfileInput['dietType'],
    allergies: p.allergies.join(', '),
    dislikedFoods: p.dislikedFoods.join(', '),
    cookingTime: p.cookingTime as ProfileInput['cookingTime'],
    budget: p.budget as ProfileInput['budget'],
    isPregnantOrBreastfeeding: p.isPregnantOrBreastfeeding,
    hasEatingDisorderHistory: p.hasEatingDisorderHistory,
    hasMedicalCondition: p.hasMedicalCondition,
    healthNotes: p.healthNotes ?? '',
    injuries: p.injuries ?? '',
    aiLanguage: p.aiLanguage as ProfileInput['aiLanguage'],
  };
}

type Field = FieldPath<ProfileInput>;

const STEP_FIELDS: Field[][] = [
  ['name', 'dateOfBirth', 'sex'],
  ['heightCm', 'weightKg', 'targetWeightKg', 'waistCm', 'hipCm'],
  ['goal', 'activityLevel', 'occupation', 'sleepHours', 'workoutPreference', 'equipment', 'coachPersonality'],
  ['dietType', 'allergies', 'dislikedFoods', 'cookingTime', 'budget'],
  ['isPregnantOrBreastfeeding', 'hasEatingDisorderHistory', 'hasMedicalCondition', 'healthNotes', 'injuries', 'aiLanguage'],
];
const STEP_TITLES = ['about', 'body', 'goal', 'food', 'health'] as const;

export function ProfileWizard({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ProfileInput;
  submitLabel: string;
  onSubmit: (p: Profile) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const { control, trigger, handleSubmit, setValue } = useForm<ProfileInput, unknown, Profile>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
    mode: 'onTouched',
  });
  const sex = useWatch({ control, name: 'sex' });
  useEffect(() => {
    // The pregnancy question is hidden for men; make sure it can't stay switched on.
    if (sex === 'male') setValue('isPregnantOrBreastfeeding', false);
  }, [sex, setValue]);
  const last = step === STEP_FIELDS.length - 1;

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step]!, { shouldFocus: true });
    if (ok) setStep((s) => s + 1);
  };

  const submit = handleSubmit(
    async (values) => {
      setSaving(true);
      setFailure(null);
      try {
        await onSubmit(values);
      } catch {
        setFailure(t('errors.generic'));
      } finally {
        setSaving(false);
      }
    },
    (errors) => {
      // Jump back to the first step that has a problem.
      const idx = STEP_FIELDS.findIndex((fields) => fields.some((f) => f in errors));
      if (idx >= 0) setStep(idx);
    },
  );

  return (
    <Screen
      testID={`wizard-step-${step}`}
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {step > 0 ? (
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label={t('common.back')} onPress={() => setStep((s) => s - 1)} />
            </View>
          ) : onCancel ? (
            <View style={{ flex: 1 }}>
              <Button variant="secondary" label={t('common.cancel')} onPress={onCancel} />
            </View>
          ) : null}
          <View style={{ flex: 2 }}>
            <Button
              testID={last ? 'wizard-submit' : 'wizard-next'}
              label={last ? submitLabel : t('common.continue')}
              onPress={last ? submit : next}
              loading={saving}
            />
          </View>
        </View>
      }
    >
      <View style={{ gap: space.sm }}>
        <AppText variant="caption" tone="secondary">
          {t('onboarding.stepOf', { step: step + 1, total: STEP_FIELDS.length })}
        </AppText>
        <ProgressBar value={(step + 1) / STEP_FIELDS.length} />
        <AppText variant="title">{t(`onboarding.${STEP_TITLES[step]!}.title`)}</AppText>
      </View>
      {step === 0 ? <AboutStep control={control} /> : null}
      {step === 1 ? <BodyStep control={control} /> : null}
      {step === 2 ? <GoalStep control={control} /> : null}
      {step === 3 ? <FoodStep control={control} /> : null}
      {step === 4 ? <HealthStep control={control} showPregnancy={sex !== 'male'} /> : null}
      {failure ? <Banner tone="danger" text={failure} /> : null}
    </Screen>
  );
}

type C = { control: Control<ProfileInput, unknown, Profile> };

function TextInputField({
  control,
  name,
  label,
  range,
  unit,
  hint,
  optional,
  numeric,
  testID,
  multiline,
}: C & {
  name: Field;
  label: string;
  range?: [number, number];
  unit?: string;
  hint?: string;
  optional?: boolean;
  numeric?: boolean;
  testID?: string;
  multiline?: boolean;
}) {
  const errText = useErrorText();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          testID={testID ?? `field-${name}`}
          label={label}
          value={String(field.value ?? '')}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          ref={field.ref}
          keyboardType={numeric ? 'decimal-pad' : 'default'}
          unit={unit}
          hint={hint}
          optional={optional}
          multiline={multiline}
          error={errText(fieldState.error?.message, range)}
        />
      )}
    />
  );
}

function ChoiceField<T extends string>({
  control,
  name,
  label,
  values,
  labelKey,
  hintKey,
  layout,
}: C & { name: Field; label: string; values: readonly T[]; labelKey: string; hintKey?: string; layout?: 'chips' | 'rows' }) {
  const { t } = useTranslation();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChoiceGroup<T>
          testID={`field-${name}`}
          label={label}
          value={field.value as T}
          onChange={field.onChange}
          layout={layout}
          options={values.map((v) => ({ value: v, label: t(`${labelKey}.${v}` as string), hint: hintKey ? t(`${hintKey}.${v}` as string) : undefined }))}
        />
      )}
    />
  );
}

function AboutStep({ control }: C) {
  const { t } = useTranslation();
  return (
    <>
      <TextInputField control={control} name="name" label={t('onboarding.about.name')} />
      <TextInputField
        control={control}
        name="dateOfBirth"
        label={t('onboarding.about.dob')}
        hint={t('onboarding.about.dobHint')}
        numeric
      />
      <Controller
        control={control}
        name="sex"
        render={({ field }) => (
          <View style={{ gap: space.xs }}>
            <ChoiceGroup
              testID="field-sex"
              label={t('onboarding.about.sex')}
              value={field.value}
              onChange={field.onChange}
              options={SEXES.map((s) => ({ value: s, label: t(`onboarding.about.${s}`) }))}
            />
            <AppText variant="caption" tone="muted">
              {t('onboarding.about.sexHint')}
            </AppText>
          </View>
        )}
      />
    </>
  );
}

function BodyStep({ control }: C) {
  const { t } = useTranslation();
  return (
    <>
      <TextInputField control={control} name="heightCm" label={t('onboarding.body.height')} unit={t('common.cm')} range={[100, 250]} numeric />
      <TextInputField control={control} name="weightKg" label={t('onboarding.body.weight')} unit={t('common.kg')} range={[25, 350]} numeric />
      <TextInputField control={control} name="targetWeightKg" label={t('onboarding.body.target')} unit={t('common.kg')} range={[25, 350]} numeric optional />
      <TextInputField
        control={control}
        name="waistCm"
        label={t('onboarding.body.waist')}
        unit={t('common.cm')}
        range={[40, 250]}
        hint={t('onboarding.body.waistHint')}
        numeric
        optional
      />
      <TextInputField control={control} name="hipCm" label={t('onboarding.body.hip')} unit={t('common.cm')} range={[40, 250]} numeric optional />
    </>
  );
}

function GoalStep({ control }: C) {
  const { t } = useTranslation();
  return (
    <>
      <ChoiceField control={control} name="goal" label={t('onboarding.goal.goal')} values={GOALS} labelKey="options.goal" layout="rows" />
      <ChoiceField control={control} name="activityLevel" label={t('onboarding.goal.activity')} values={ACTIVITY_LEVELS} labelKey="options.activity" layout="rows" />
      <TextInputField control={control} name="occupation" label={t('onboarding.goal.occupation')} hint={t('onboarding.goal.occupationHint')} optional />
      <TextInputField control={control} name="sleepHours" label={t('onboarding.goal.sleep')} unit={t('common.hours')} range={[3, 14]} numeric optional />
      <ChoiceField control={control} name="workoutPreference" label={t('onboarding.goal.workout')} values={WORKOUT_PREFERENCES} labelKey="options.workout" />
      <TextInputField control={control} name="equipment" label={t('onboarding.goal.equipment')} hint={t('onboarding.goal.equipmentHint')} optional />
      <ChoiceField
        control={control}
        name="coachPersonality"
        label={t('onboarding.goal.coach')}
        values={COACH_PERSONALITIES}
        labelKey="options.coach"
        hintKey="options.coachHint"
        layout="rows"
      />
    </>
  );
}

function FoodStep({ control }: C) {
  const { t } = useTranslation();
  return (
    <>
      <ChoiceField control={control} name="dietType" label={t('onboarding.food.diet')} values={DIET_TYPES} labelKey="options.diet" />
      <TextInputField control={control} name="allergies" label={t('onboarding.food.allergies')} hint={t('onboarding.food.listHint')} optional />
      <TextInputField control={control} name="dislikedFoods" label={t('onboarding.food.dislikes')} hint={t('onboarding.food.listHint')} optional />
      <ChoiceField control={control} name="cookingTime" label={t('onboarding.food.cooking')} values={COOKING_TIME} labelKey="options.cooking" />
      <ChoiceField control={control} name="budget" label={t('onboarding.food.budget')} values={BUDGETS} labelKey="options.budget" />
    </>
  );
}

function HealthStep({ control, showPregnancy }: C & { showPregnancy: boolean }) {
  const { t } = useTranslation();
  const toggle = (name: 'isPregnantOrBreastfeeding' | 'hasEatingDisorderHistory' | 'hasMedicalCondition', label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ToggleRow testID={`field-${name}`} label={label} value={Boolean(field.value)} onChange={field.onChange} />
      )}
    />
  );
  return (
    <>
      <AppText tone="secondary">{t('onboarding.health.intro')}</AppText>
      {showPregnancy ? toggle('isPregnantOrBreastfeeding', t('onboarding.health.pregnancy')) : null}
      {toggle('hasEatingDisorderHistory', t('onboarding.health.eatingDisorder'))}
      {toggle('hasMedicalCondition', t('onboarding.health.medical'))}
      <TextInputField control={control} name="healthNotes" label={t('onboarding.health.notes')} optional multiline />
      <TextInputField control={control} name="injuries" label={t('onboarding.health.injuries')} optional multiline />
      <ChoiceField control={control} name="aiLanguage" label={t('onboarding.health.aiLanguage')} values={LANGUAGES} labelKey="options.language" />
    </>
  );
}

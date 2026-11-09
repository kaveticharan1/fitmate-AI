import { checkPer100, type Per100 } from '@fitmate/food-data';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, TextField } from '../../components/ui';
import { space } from '../../theme/tokens';

export interface LabelValues {
  name: string;
  brand: string;
  per100: Per100;
  servingG: number | null;
}

const toText = (v: number | null | undefined) => (v == null ? '' : String(v));
const toNum = (s: string) => {
  const t = s.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/** Name and nutrition per 100 g, as printed on Indian packs ("Nutritional information per 100 g"). */
export function LabelForm({
  initial,
  submitLabel,
  onSubmit,
  loading,
}: {
  initial: { name?: string; brand?: string | null; per100?: Partial<Per100>; servingG?: number | null };
  submitLabel: string;
  onSubmit: (v: LabelValues) => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial.name ?? '');
  const [brand, setBrand] = useState(initial.brand ?? '');
  const [vals, setVals] = useState<Record<keyof Per100, string>>({
    kcal: toText(initial.per100?.kcal),
    protein: toText(initial.per100?.protein),
    carbs: toText(initial.per100?.carbs),
    fat: toText(initial.per100?.fat),
    fiber: toText(initial.per100?.fiber),
  });
  const [serving, setServing] = useState(toText(initial.servingG));
  const [tried, setTried] = useState(false);

  const parsed: Partial<Per100> = {};
  let bad = false;
  for (const k of Object.keys(vals) as (keyof Per100)[]) {
    const n = toNum(vals[k]);
    if (Number.isNaN(n)) bad = true;
    else if (n != null) parsed[k] = n;
  }
  const check = checkPer100(parsed);
  const servingN = toNum(serving);
  const servingBad = Number.isNaN(servingN) || (servingN != null && (servingN < 1 || servingN > 2000));
  const nameBad = name.trim().length === 0;
  const ok = !bad && check.ok && !servingBad && !nameBad;
  const err = (k: keyof Per100) => (tried && (check.problems.includes(k) || Number.isNaN(toNum(vals[k]))) ? t('scan.valueError') : undefined);

  const submit = () => {
    setTried(true);
    if (!ok) return;
    onSubmit({
      name: name.trim(),
      brand: brand.trim(),
      per100: { kcal: parsed.kcal!, protein: parsed.protein!, carbs: parsed.carbs!, fat: parsed.fat!, fiber: parsed.fiber ?? 0 },
      servingG: servingN ?? null,
    });
  };

  const field = (k: keyof Per100, unit: string, optional = false) => (
    <TextField
      key={k}
      testID={`label-${k}`}
      label={t(`scan.fields.${k}`)}
      unit={unit}
      value={vals[k]}
      onChangeText={(v) => setVals((p) => ({ ...p, [k]: v }))}
      keyboardType="decimal-pad"
      optional={optional}
      error={err(k)}
    />
  );

  return (
    <View style={{ gap: space.md }} testID="label-form">
      <TextField testID="label-name" label={t('scan.fields.name')} value={name} onChangeText={setName} error={tried && nameBad ? t('scan.nameError') : undefined} />
      <TextField testID="label-brand" label={t('scan.fields.brand')} value={brand} onChangeText={setBrand} optional />
      <AppText variant="label" tone="secondary">
        {t('scan.per100Hint')}
      </AppText>
      {field('kcal', 'kcal')}
      {field('protein', 'g')}
      {field('carbs', 'g')}
      {field('fat', 'g')}
      {field('fiber', 'g', true)}
      <TextField
        testID="label-serving"
        label={t('scan.fields.serving')}
        unit="g"
        value={serving}
        onChangeText={setServing}
        keyboardType="decimal-pad"
        optional
        error={tried && servingBad ? t('scan.servingError') : undefined}
      />
      {tried && !bad && !check.ok && check.problems.length === 1 && check.problems[0] === 'carbs' && parsed.carbs != null ? (
        <AppText tone="danger">{t('scan.macrosTooHigh')}</AppText>
      ) : null}
      <Button testID="label-save" label={submitLabel} onPress={submit} loading={loading} />
    </View>
  );
}

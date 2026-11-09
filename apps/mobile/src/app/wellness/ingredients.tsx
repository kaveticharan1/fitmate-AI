import { analyseIngredients, compareLists, getIngredient, type ListAnalysis, type ProfileForAnalysis } from '@fitmate/skin';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ChoiceGroup, Screen, TextField } from '../../components/ui';
import { useAiStatus } from '../../features/coach/hooks';
import { coachErrorKey } from '../../features/coach/errors';
import { useReadLabel, useRoutineSteps, useSkinProfile } from '../../features/skin/hooks';
import { space } from '../../theme/tokens';

function Result({ a, testID }: { a: ListAnalysis; testID: string }) {
  const { t } = useTranslation();
  const name = (id: string) => getIngredient(id)?.name ?? id;
  return (
    <View style={{ gap: space.sm }} testID={testID}>
      <AppText tone="secondary">{t('skin.itemsRead', { count: a.items.length })}</AppText>
      {a.allergyMatches.length ? <Banner tone="danger" text={t('skin.allergyMatch', { list: a.allergyMatches.join(', ') })} /> : null}
      {a.pregnancyWarnings.length ? <Banner tone="danger" text={t('skin.pregnancyWarn', { list: a.pregnancyWarnings.map((x) => x.name).join(', ') })} /> : null}
      <AppText variant="label">{t('skin.actives')}</AppText>
      {a.actives.length ? (
        a.actives.map((x) => <AppText key={x.id}>{`• ${x.name} — ${x.what}`}</AppText>)
      ) : (
        <AppText tone="secondary">{t('skin.noActives')}</AppText>
      )}
      {a.irritants.length ? (
        <>
          <AppText variant="label">{t('skin.irritants')}</AppText>
          {a.irritants.map((i) => (
            <AppText key={i.id} tone="warning">{`• ${i.label} (${i.found})`}</AppText>
          ))}
        </>
      ) : null}
      {a.conflicts.map((c, i) => (
        <AppText key={i} tone="warning">
          {c.withRoutine ? t('skin.conflictRoutine', { a: name(c.a), b: name(c.b) }) : t('skin.conflictSelf', { a: name(c.a), b: name(c.b) })}
        </AppText>
      ))}
      {a.cautions.map((x) => (
        <AppText key={x.id} tone="secondary">{`• ${t('skin.cautionFor', { name: x.name })}`}</AppText>
      ))}
    </View>
  );
}

export default function IngredientAssistant() {
  const { t } = useTranslation();
  const { data: profile } = useSkinProfile();
  const { data: steps = [] } = useRoutineSteps();
  const { data: ai } = useAiStatus();
  const readLabel = useReadLabel();
  const [mode, setMode] = useState<'one' | 'two'>('one');
  const [names, setNames] = useState(['', '']);
  const [lists, setLists] = useState(['', '']);
  const [checked, setChecked] = useState(false);
  const [labelFor, setLabelFor] = useState<number | null>(null);
  const [labelMsg, setLabelMsg] = useState<string | null>(null);

  const p: ProfileForAnalysis = {
    skinType: profile?.skinType ?? 'unsure',
    sensitive: profile?.sensitive ?? false,
    fragranceFree: profile?.fragranceFree ?? false,
    pregnant: profile?.pregnant ?? false,
    allergies: profile?.allergies ?? null,
    routineIngredients: steps.map((s) => s.ingredient).filter((x): x is string => !!x),
  };
  const count = mode === 'one' ? 1 : 2;
  const missingList = Array.from({ length: count }, (_, i) => !lists[i]!.trim());
  const nameOnly = Array.from({ length: count }, (_, i) => !!names[i]!.trim() && missingList[i]);

  const setAt = (arr: string[], i: number, v: string) => arr.map((x, j) => (j === i ? v : x));

  const photo = async (i: number) => {
    setLabelMsg(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
      const r = perm.granted ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const uri = r.canceled ? null : r.assets[0]?.uri;
      if (!uri) return;
      setLabelFor(i);
      readLabel.mutate(uri, {
        onSuccess: (res) => {
          if (res.found) {
            setLists((l) => setAt(l, i, res.ingredients));
            if (res.productName && !names[i]) setNames((n) => setAt(n, i, res.productName!));
            setLabelMsg(t('skin.labelRead'));
          } else setLabelMsg(t('skin.labelNotFound'));
        },
      });
    } catch {
      setLabelMsg(t('photo.pickError'));
    }
  };

  const compared = checked && mode === 'two' && !missingList.some(Boolean) ? compareLists(lists[0]!, lists[1]!, p) : null;
  const single = checked && mode === 'one' && !missingList[0] ? analyseIngredients(lists[0]!, p) : null;

  return (
    <Screen testID="ingredients">
      <Header title={t('skin.ingredientsTitle')} />
      <AppText tone="secondary">{t('skin.ingredientsIntro')}</AppText>
      {!profile ? <Banner tone="accent" text={t('skin.noProfileForCheck')} /> : null}
      <ChoiceGroup<'one' | 'two'>
        testID="ing-mode"
        options={[
          { value: 'one', label: t('skin.checkOne') },
          { value: 'two', label: t('skin.compareTwo') },
        ]}
        value={mode}
        onChange={(v) => {
          setMode(v);
          setChecked(false);
        }}
      />
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} testID={`product-${i}`}>
          {mode === 'two' ? <AppText variant="heading">{t('skin.productN', { n: i + 1 })}</AppText> : null}
          <TextField testID={`ing-name-${i}`} label={t('skin.productName')} value={names[i]!} onChangeText={(v) => setNames((n) => setAt(n, i, v))} optional />
          <TextField
            testID={`ing-list-${i}`}
            label={t('skin.ingredientList')}
            value={lists[i]!}
            onChangeText={(v) => {
              setLists((l) => setAt(l, i, v));
              setChecked(false);
            }}
            multiline
            placeholder="Aqua, Glycerin, Niacinamide, …"
          />
          {ai?.connected ? (
            <Button testID={`ing-photo-${i}`} variant="secondary" label={t('skin.readLabel')} loading={readLabel.isPending && labelFor === i} onPress={() => photo(i)} />
          ) : (
            <AppText variant="caption" tone="secondary">
              {t('skin.labelNeedsAi')}
            </AppText>
          )}
        </Card>
      ))}
      {labelMsg ? <Banner tone="accent" text={labelMsg} /> : null}
      {readLabel.isError ? <Banner tone="danger" text={t(coachErrorKey(readLabel.error))} /> : null}
      <Button testID="ing-check" label={mode === 'one' ? t('skin.check') : t('skin.compare')} onPress={() => setChecked(true)} />
      {checked && nameOnly.some(Boolean) ? <Banner tone="warning" text={t('skin.needList')} /> : null}
      {checked && !nameOnly.some(Boolean) && missingList.some(Boolean) ? <Banner tone="warning" text={t('skin.pasteFirst')} /> : null}

      {single ? (
        <Card>
          <Result a={single} testID="ing-result" />
        </Card>
      ) : null}
      {compared ? (
        <Card testID="ing-compare">
          <AppText variant="heading">{t('skin.compareSummary')}</AppText>
          <AppText>{t('skin.shared', { list: compared.shared.map((x) => getIngredient(x)?.name ?? x).join(', ') || '—' })}</AppText>
          <AppText testID="ing-gentler">{t(`skin.gentler.${compared.gentler}`, { a: names[0] || t('skin.productN', { n: 1 }), b: names[1] || t('skin.productN', { n: 2 }) })}</AppText>
          <AppText variant="heading">{names[0] || t('skin.productN', { n: 1 })}</AppText>
          <Result a={compared.a} testID="ing-result-a" />
          <AppText variant="heading">{names[1] || t('skin.productN', { n: 2 })}</AppText>
          <Result a={compared.b} testID="ing-result-b" />
        </Card>
      ) : null}
      <AppText variant="caption" tone="muted">
        {t('skin.ingredientDisclaimer')}
      </AppText>
    </Screen>
  );
}

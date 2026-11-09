import { scaleItem, type PhotoItem } from '@fitmate/coach';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ChoiceGroup, Screen, TextField } from '../../components/ui';
import { MEALS, type Meal } from '../../db/schema';
import { coachErrorKey } from '../../features/coach/errors';
import { useAiStatus } from '../../features/coach/hooks';
import { useAddPhotoEntries } from '../../features/food/packaged';
import { useAnalyzePhoto } from '../../features/food/photo';
import { localDate } from '../../lib/time';
import { space } from '../../theme/tokens';

type Row = PhotoItem & { key: number; gramsText: string };

export default function FoodPhoto() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const date = params.date ?? localDate();
  const [meal, setMeal] = useState<Meal>((params.meal ?? 'lunch') as Meal);
  const { data: status } = useAiStatus();
  const analyze = useAnalyzePhoto();
  const save = useAddPhotoEntries();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  if (status && !status.connected) {
    return (
      <Screen testID="food-photo">
        <Header title={t('photo.title')} />
        <Card testID="photo-setup">
          <AppText>{t('photo.needsCoach')}</AppText>
          <Button testID="photo-setup-button" label={t('coach.setupButton')} onPress={() => router.push('/settings/ai')} />
        </Card>
      </Screen>
    );
  }

  const pick = async (from: 'camera' | 'gallery') => {
    setPickError(null);
    setRows(null);
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setPickError(t('photo.cameraDenied'));
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
      const result = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      const uri = result.canceled ? null : result.assets[0]?.uri;
      if (!uri) return;
      analyze.mutate(uri, {
        onSuccess: (e) => setRows(e.items.map((it, i) => ({ ...it, key: i, gramsText: String(it.grams) }))),
      });
    } catch {
      setPickError(t('photo.pickError'));
    }
  };

  const setGrams = (key: number, text: string) =>
    setRows((rs) =>
      (rs ?? []).map((r) => {
        if (r.key !== key) return r;
        const g = Number(text.replace(',', '.'));
        return Number.isFinite(g) && g >= 1 && g <= 2000 ? { ...scaleItem(r, g), key, gramsText: text } : { ...r, gramsText: text };
      }),
    );

  const estimate = analyze.data;
  const gramsOk = (r: Row) => {
    const g = Number(r.gramsText.replace(',', '.'));
    return Number.isFinite(g) && g >= 1 && g <= 2000;
  };
  const valid = rows != null && rows.length > 0 && rows.every(gramsOk);
  const total = (rows ?? []).reduce((s, r) => ({ kcal: s.kcal + r.kcal, protein: s.protein + r.protein }), { kcal: 0, protein: 0 });

  return (
    <Screen testID="food-photo">
      <Header title={t('photo.title')} />
      <AppText variant="label" tone="secondary">
        {t('photo.privacy')}
      </AppText>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button testID="photo-camera" label={t('photo.take')} onPress={() => pick('camera')} disabled={analyze.isPending} />
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="photo-gallery" variant="secondary" label={t('photo.gallery')} onPress={() => pick('gallery')} disabled={analyze.isPending} />
        </View>
      </View>
      {pickError ? <Banner tone="warning" text={pickError} /> : null}
      {analyze.isPending ? (
        <Card testID="photo-analyzing">
          <AppText>{t('photo.analyzing')}</AppText>
        </Card>
      ) : null}
      {analyze.isError ? <Banner tone="danger" text={t(coachErrorKey(analyze.error))} /> : null}

      {estimate && rows ? (
        rows.length === 0 ? (
          <Card tone="warning" testID="photo-nothing">
            <AppText>{estimate.note ?? t('photo.nothing')}</AppText>
          </Card>
        ) : (
          <>
            <Banner tone={estimate.confidence === 'high' ? 'accent' : 'warning'} text={t(`photo.confidence.${estimate.confidence}`)} />
            {estimate.note ? <AppText tone="secondary">{estimate.note}</AppText> : null}
            {rows.map((r) => (
              <Card key={r.key} testID={`photo-item-${r.key}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                  <AppText variant="heading" style={{ flex: 1 }}>
                    {r.name}
                  </AppText>
                  <AppText weight="bold">{r.kcal} kcal</AppText>
                </View>
                <AppText tone="secondary">{t('photo.itemMacros', { protein: r.protein, carbs: r.carbs, fat: r.fat })}</AppText>
                <TextField testID={`photo-grams-${r.key}`} label={t('photo.portion')} unit="g" value={r.gramsText} onChangeText={(v) => setGrams(r.key, v)} keyboardType="decimal-pad" />
                <Button testID={`photo-remove-${r.key}`} variant="ghost" label={t('photo.remove')} onPress={() => setRows((rs) => (rs ?? []).filter((x) => x.key !== r.key))} />
              </Card>
            ))}
            <Card testID="photo-total">
              <AppText variant="heading">{t('photo.total', { kcal: total.kcal, protein: Math.round(total.protein) })}</AppText>
              <ChoiceGroup options={MEALS.map((m) => ({ value: m, label: t(`meals.${m}`) }))} value={meal} onChange={setMeal} />
              <Button
                testID="photo-save"
                label={t('food.addTo', { meal: t(`meals.${meal}`) })}
                disabled={!valid}
                loading={save.isPending}
                onPress={() =>
                  valid &&
                  save.mutate(
                    { date, meal, items: rows.map(({ key: _k, gramsText: _g, ...it }) => it) },
                    { onSuccess: () => router.back() },
                  )
                }
              />
              <AppText variant="caption" tone="secondary">
                {t('photo.estimateNote')}
              </AppText>
            </Card>
          </>
        )
      ) : null}
    </Screen>
  );
}

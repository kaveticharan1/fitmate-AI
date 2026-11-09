import { CONCERNS, type Concern, type SkinType } from '@fitmate/skin';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Button, CheckRow, ChoiceGroup, Screen, TextField, ToggleRow } from '../../components/ui';
import { useDeleteSkinData, useSaveSkinProfile, useSkinProfile } from '../../features/skin/hooks';
import { space } from '../../theme/tokens';

const TYPES: SkinType[] = ['oily', 'dry', 'combination', 'sensitive', 'normal', 'unsure'];

export default function SkinProfileScreen() {
  const { t } = useTranslation();
  const { data: existing } = useSkinProfile();
  const save = useSaveSkinProfile();
  const del = useDeleteSkinData();
  const [type, setType] = useState<SkinType | undefined>(existing?.skinType);
  const [sensitive, setSensitive] = useState(existing?.sensitive ?? false);
  const [concerns, setConcerns] = useState<Concern[]>(existing?.concerns ?? []);
  const [allergies, setAllergies] = useState(existing?.allergies ?? '');
  const [products, setProducts] = useState(existing?.products ?? '');
  const [budget, setBudget] = useState<'low' | 'medium' | 'high'>(existing?.budget ?? 'medium');
  const [fragranceFree, setFragranceFree] = useState(existing?.fragranceFree ?? true);
  const [experience, setExperience] = useState<'beginner' | 'some' | 'experienced'>(existing?.experience ?? 'beginner');
  const [pregnant, setPregnant] = useState(existing?.pregnant ?? false);
  const [goals, setGoals] = useState(existing?.goals ?? '');
  const [share, setShare] = useState(existing?.shareWithCoach ?? true);
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = (c: Concern) => setConcerns((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const submit = () => {
    setTried(true);
    if (!type) return;
    save.mutate(
      { skinType: type, sensitive, concerns, allergies, products, budget, fragranceFree, experience, pregnant, goals, shareWithCoach: share },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen testID="skin-profile" footer={<Button testID="skin-save" label={t('common.save')} onPress={submit} loading={save.isPending} />}>
      <Header title={t('skin.profileTitle')} />
      <AppText tone="secondary">{t('skin.profileIntro')}</AppText>
      <ChoiceGroup
        testID="skin-type"
        label={t('skin.type')}
        options={TYPES.map((x) => ({ value: x, label: t(`skin.types.${x}`) }))}
        value={type}
        onChange={setType}
        error={tried && !type ? t('errors.required') : undefined}
      />
      <AppText variant="caption" tone="secondary">
        {t('skin.typeHint')}
      </AppText>
      <ToggleRow testID="skin-sensitive" label={t('skin.sensitive')} value={sensitive} onChange={setSensitive} />
      <View style={{ gap: space.sm }}>
        <AppText variant="label">{t('skin.concerns')}</AppText>
        {CONCERNS.map((c) => (
          <CheckRow key={c} testID={`concern-${c}`} label={t(`skin.concern.${c}`)} value={concerns.includes(c)} onChange={() => toggle(c)} />
        ))}
      </View>
      <TextField testID="skin-allergies" label={t('skin.allergies')} value={allergies} onChangeText={setAllergies} optional hint={t('skin.allergiesHint')} />
      <TextField testID="skin-products" label={t('skin.products')} value={products} onChangeText={setProducts} optional multiline />
      <ChoiceGroup<'beginner' | 'some' | 'experienced'>
        testID="skin-experience"
        label={t('skin.experience')}
        options={(['beginner', 'some', 'experienced'] as const).map((x) => ({ value: x, label: t(`skin.exp.${x}`) }))}
        value={experience}
        onChange={setExperience}
      />
      <ChoiceGroup<'low' | 'medium' | 'high'>
        testID="skin-budget"
        label={t('skin.budget')}
        options={(['low', 'medium', 'high'] as const).map((x) => ({ value: x, label: t(`skin.budgets.${x}`) }))}
        value={budget}
        onChange={setBudget}
      />
      <ToggleRow testID="skin-fragrance" label={t('skin.fragranceFree')} value={fragranceFree} onChange={setFragranceFree} />
      <ToggleRow testID="skin-pregnant" label={t('skin.pregnant')} description={t('skin.pregnantHint')} value={pregnant} onChange={setPregnant} />
      <TextField testID="skin-goals" label={t('skin.goals')} value={goals} onChangeText={setGoals} optional />
      <ToggleRow testID="skin-share" label={t('skin.share')} description={t('skin.shareHint')} value={share} onChange={setShare} />
      {existing ? (
        <Button
          testID="skin-delete"
          variant={confirmDelete ? 'danger' : 'ghost'}
          label={confirmDelete ? t('skin.deleteConfirm') : t('skin.delete')}
          onPress={() => (confirmDelete ? del.mutate(undefined, { onSuccess: () => router.back() }) : setConfirmDelete(true))}
        />
      ) : null}
    </Screen>
  );
}

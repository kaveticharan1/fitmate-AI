import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, CheckRow, ChoiceGroup, Screen, TextField } from '../../components/ui';
import type { FaceCheckinRow } from '../../db/schema';
import { useSaveCheckin, useTodayCheckin } from '../../features/face/hooks';
import { AREAS, PUFFINESS, SYMPTOMS, TIMES } from '../../features/face/logic';
import { localDate } from '../../lib/time';
import { space } from '../../theme/tokens';

type YesNo = 'yes' | 'no' | 'skip';
const yn = (b: boolean | null | number | undefined): YesNo => (b == null ? 'skip' : b ? 'yes' : 'no');
const fromYn = (v: YesNo) => (v === 'skip' ? null : v === 'yes');

export default function FaceCheckin() {
  const { t } = useTranslation();
  const { data: existing } = useTodayCheckin();
  const save = useSaveCheckin();
  const [puff, setPuff] = useState<string | undefined>(existing ? PUFFINESS[existing.puffiness] : undefined);
  const [areas, setAreas] = useState<string[]>(existing?.areas ?? []);
  const [time, setTime] = useState<string | undefined>(existing?.timeOfDay ?? undefined);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const [stress, setStress] = useState<string>(existing?.stress != null ? String(existing.stress) : 'skip');
  const [salty, setSalty] = useState<YesNo>(yn(existing?.saltyYesterday));
  const [alcohol, setAlcohol] = useState<YesNo>(yn(existing?.alcoholYesterday));
  const [note, setNote] = useState(existing?.note ?? '');
  const [tried, setTried] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const emergency = symptoms.includes('lips_tongue_throat') || symptoms.includes('breathing');
  const level = puff ? PUFFINESS.indexOf(puff as (typeof PUFFINESS)[number]) : -1;

  const submit = () => {
    setTried(true);
    if (level < 0) return;
    save.mutate(
      {
        day: localDate(),
        puffiness: level,
        areas: level === 0 ? [] : areas,
        timeOfDay: (time ?? null) as FaceCheckinRow['timeOfDay'],
        symptoms,
        stress: stress === 'skip' ? null : Number(stress),
        saltyYesterday: fromYn(salty),
        alcoholYesterday: fromYn(alcohol),
        note: note.trim() || null,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen testID="face-checkin" footer={<Button testID="checkin-save" label={t('common.save')} onPress={submit} loading={save.isPending} />}>
      <Header title={t('face.checkinTitle')} />
      <AppText tone="secondary">{t('face.checkinIntro')}</AppText>

      {emergency ? (
        <Card tone="danger" testID="checkin-emergency">
          <AppText weight="bold">{t('face.emergencyTitle')}</AppText>
          <AppText>{t('face.emergencyBody')}</AppText>
          <Button testID="checkin-call-112" variant="danger" label={t('coach.call112')} onPress={() => Linking.openURL('tel:112')} />
        </Card>
      ) : null}

      <ChoiceGroup
        testID="puffiness"
        label={t('face.puffiness')}
        layout="rows"
        options={PUFFINESS.map((p) => ({ value: p, label: t(`face.level.${p}`) }))}
        value={puff}
        onChange={setPuff}
        error={tried && level < 0 ? t('errors.required') : undefined}
      />
      {level > 0 ? (
        <>
          <View style={{ gap: space.sm }}>
            <AppText variant="label">{t('face.areas')}</AppText>
            {AREAS.map((a) => (
              <CheckRow key={a} testID={`area-${a}`} label={t(`face.area.${a}`)} value={areas.includes(a)} onChange={() => toggle(areas, setAreas, a)} />
            ))}
          </View>
          <ChoiceGroup testID="time-of-day" label={t('face.when')} options={TIMES.map((x) => ({ value: x, label: t(`face.time.${x}`) }))} value={time} onChange={setTime} />
        </>
      ) : null}

      <View style={{ gap: space.sm }}>
        <AppText variant="label">{t('face.symptoms')}</AppText>
        <AppText variant="caption" tone="secondary">
          {t('face.optional')}
        </AppText>
        {SYMPTOMS.map((s) => (
          <CheckRow key={s} testID={`symptom-${s}`} label={t(`face.symptom.${s}`)} value={symptoms.includes(s)} onChange={() => toggle(symptoms, setSymptoms, s)} />
        ))}
      </View>
      {symptoms.includes('pain') && !emergency ? <Banner tone="warning" text={t('face.painNote')} /> : null}

      <ChoiceGroup<string>
        testID="stress"
        label={t('face.stress')}
        options={[
          { value: 'skip', label: t('face.skip') },
          { value: '0', label: t('face.stressLevel.0') },
          { value: '1', label: t('face.stressLevel.1') },
          { value: '2', label: t('face.stressLevel.2') },
        ]}
        value={stress}
        onChange={setStress}
      />
      <ChoiceGroup<YesNo>
        testID="salty"
        label={t('face.salty')}
        options={(['skip', 'no', 'yes'] as const).map((v) => ({ value: v, label: t(`face.${v}`) }))}
        value={salty}
        onChange={setSalty}
      />
      <ChoiceGroup<YesNo>
        testID="alcohol"
        label={t('face.alcohol')}
        options={(['skip', 'no', 'yes'] as const).map((v) => ({ value: v, label: t(`face.${v}`) }))}
        value={alcohol}
        onChange={setAlcohol}
      />
      <TextField testID="checkin-note" label={t('face.note')} value={note} onChangeText={setNote} optional maxLength={300} />
      <AppText variant="caption" tone="muted">
        {t('face.dataNote')}
      </AppText>
    </Screen>
  );
}

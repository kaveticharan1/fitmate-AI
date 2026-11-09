import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, CheckRow, Screen, TextField } from '../../components/ui';
import type { FacePhotoRow } from '../../db/schema';
import { useAiStatus } from '../../features/coach/hooks';
import { coachErrorKey } from '../../features/coach/errors';
import { useFaceConsent, useFaceConsentActions, usePhotoActions, usePhotoImage, usePhotos } from '../../features/face/hooks';
import { readObservation } from '../../features/face/service';
import { radius, space } from '../../theme/tokens';

function Thumb({ id, size = 160 }: { id: string; size?: number }) {
  const { t } = useTranslation();
  const { data: uri, isLoading } = usePhotoImage(id);
  if (isLoading) return <AppText tone="muted">{t('face.loadingPhoto')}</AppText>;
  if (!uri) return <AppText tone="muted">{t('face.photoMissing')}</AppText>;
  return <Image testID={`photo-image-${id}`} source={{ uri }} style={{ width: size, height: size * 1.25, borderRadius: radius.md }} accessibilityLabel={t('face.photoAlt')} />;
}

export default function FacePhotos() {
  const { t } = useTranslation();
  const { data: photos = [] } = usePhotos();
  const { data: ai } = useAiStatus();
  const { data: consented = false } = useFaceConsent();
  const consent = useFaceConsentActions();
  const actions = usePhotoActions();
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (from: 'camera' | 'gallery') => {
    setError(null);
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError(t('face.cameraDenied'));
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, allowsEditing: false, cameraType: ImagePicker.CameraType.front };
      const r = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const uri = r.canceled ? null : r.assets[0]?.uri;
      if (uri) {
        setPending(uri);
        setNote('');
      }
    } catch {
      setError(t('face.cameraUnavailable'));
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1]!, id] : [...s, id]));

  const analysed = actions.analyze.data;
  const canAnalyse = ai?.connected && consented && selected.length >= 1;

  return (
    <Screen testID="face-photos">
      <Header title={t('face.photosTitle')} />
      <Card>
        <AppText variant="heading">{t('face.howTitle')}</AppText>
        {(['how1', 'how2', 'how3', 'how4', 'how5'] as const).map((k) => (
          <AppText key={k} variant="label" tone="secondary">{`• ${t(`face.${k}`)}`}</AppText>
        ))}
        <AppText variant="caption" tone="secondary">
          {t('face.privacy')}
        </AppText>
      </Card>

      {pending ? (
        <Card testID="photo-preview">
          <Image source={{ uri: pending }} style={{ width: 200, height: 250, borderRadius: radius.md, alignSelf: 'center' }} accessibilityLabel={t('face.photoAlt')} />
          <TextField testID="photo-note" label={t('face.note')} value={note} onChangeText={setNote} optional maxLength={300} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button testID="photo-retake" variant="secondary" label={t('face.retake')} onPress={() => { setPending(null); pick('camera'); }} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                testID="photo-save"
                label={t('common.save')}
                loading={actions.save.isPending}
                onPress={() => actions.save.mutate({ uri: pending, note: note.trim() || null }, { onSuccess: () => setPending(null), onError: () => setError(t('errors.generic')) })}
              />
            </View>
          </View>
          <Button testID="photo-discard" variant="ghost" label={t('face.discard')} onPress={() => setPending(null)} />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button testID="photo-take" label={t('face.take')} onPress={() => pick('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button testID="photo-choose" variant="secondary" label={t('face.choose')} onPress={() => pick('gallery')} />
          </View>
        </View>
      )}
      {error ? <Banner tone="warning" text={error} /> : null}

      {photos.length ? (
        <Card testID="analysis-card">
          <AppText variant="heading">{t('face.analyseTitle')}</AppText>
          <AppText variant="label" tone="secondary">
            {t('face.analyseHint')}
          </AppText>
          {!ai?.connected ? (
            <Button testID="photo-setup-ai" variant="secondary" label={t('coach.setupButton')} onPress={() => router.push('/settings/ai')} />
          ) : !consented ? (
            <View style={{ gap: space.sm }} testID="face-consent">
              <AppText>{t('face.consentBody')}</AppText>
              <CheckRow testID="face-consent-check" label={t('face.consentCheck')} value={agree} onChange={setAgree} />
              <Button testID="face-consent-give" label={t('face.consentGive')} disabled={!agree} onPress={() => agree && consent.give.mutate()} />
            </View>
          ) : (
            <>
              <Button
                testID="photo-analyse"
                label={selected.length === 2 ? t('face.compareTwo') : t('face.analyseOne')}
                disabled={!canAnalyse}
                loading={actions.analyze.isPending}
                onPress={() => canAnalyse && actions.analyze.mutate(selected)}
              />
              <Button testID="face-consent-withdraw" variant="ghost" label={t('face.consentWithdraw')} onPress={() => consent.withdraw.mutate()} />
            </>
          )}
          {actions.analyze.isError ? <Banner tone="danger" text={t(coachErrorKey(actions.analyze.error))} /> : null}
          {analysed && !analysed.usable ? (
            <Banner
              tone="warning"
              text={analysed.issues.length ? t('face.retakeNeeded', { issues: analysed.issues.map((i) => t(`face.issue.${i}`)).join(', ') }) : t('face.retakeGeneric')}
            />
          ) : null}
        </Card>
      ) : null}

      <View style={{ gap: space.md }} testID="photo-list">
        {photos.length === 0 ? <AppText tone="secondary">{t('face.noPhotos')}</AppText> : null}
        {photos.map((p) => (
          <PhotoRow
            key={p.id}
            p={p}
            selected={selected.includes(p.id)}
            onSelect={() => toggleSelect(p.id)}
            open={open === p.id}
            onToggleOpen={() => setOpen(open === p.id ? null : p.id)}
            confirmDelete={confirmDelete === p.id}
            onDelete={() => {
              if (confirmDelete === p.id) {
                actions.remove.mutate(p.id);
                setSelected((s) => s.filter((x) => x !== p.id));
                setConfirmDelete(null);
              } else setConfirmDelete(p.id);
            }}
            onVerdict={(v) => actions.verdict.mutate({ id: p.id, verdict: v })}
          />
        ))}
      </View>
    </Screen>
  );
}

function PhotoRow({
  p,
  selected,
  onSelect,
  open,
  onToggleOpen,
  confirmDelete,
  onDelete,
  onVerdict,
}: {
  p: FacePhotoRow;
  selected: boolean;
  onSelect: () => void;
  open: boolean;
  onToggleOpen: () => void;
  confirmDelete: boolean;
  onDelete: () => void;
  onVerdict: (v: 'agree' | 'disagree') => void;
}) {
  const { t } = useTranslation();
  const obs = readObservation(p.aiObservation);
  return (
    <Card testID={`photo-${p.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <AppText weight="bold">{new Date(p.takenAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</AppText>
          {p.note ? <AppText tone="secondary">{p.note}</AppText> : null}
        </View>
        <CheckRow testID={`photo-select-${p.id}`} label={t('face.select')} value={selected} onChange={onSelect} />
      </View>
      <Button testID={`photo-view-${p.id}`} variant="ghost" label={open ? t('face.hide') : t('face.view')} onPress={onToggleOpen} />
      {open ? <Thumb id={p.id} /> : null}
      {obs ? (
        <View style={{ gap: space.xs }} testID={`photo-obs-${p.id}`}>
          <AppText variant="label" tone="secondary">
            {t('face.aiSays')}
          </AppText>
          {obs.observations.map((o, i) => (
            <AppText key={i}>{`• ${o}`}</AppText>
          ))}
          {obs.comparison ? <AppText>{obs.comparison}</AppText> : null}
          {obs.conditionsDiffer ? <AppText tone="warning">{t('face.conditionsDiffer')}</AppText> : null}
          <AppText variant="caption" tone="muted">
            {t('face.aiLimits')}
          </AppText>
          {p.userVerdict ? (
            <AppText variant="caption" tone="secondary">
              {t(`face.verdict.${p.userVerdict}`)}
            </AppText>
          ) : (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button testID={`photo-agree-${p.id}`} variant="secondary" label={t('face.agree')} onPress={() => onVerdict('agree')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button testID={`photo-disagree-${p.id}`} variant="secondary" label={t('face.disagree')} onPress={() => onVerdict('disagree')} />
              </View>
            </View>
          )}
        </View>
      ) : null}
      <Button testID={`photo-delete-${p.id}`} variant={confirmDelete ? 'danger' : 'ghost'} label={confirmDelete ? t('face.confirmDelete') : t('face.delete')} onPress={onDelete} />
    </Card>
  );
}

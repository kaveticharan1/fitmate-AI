import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { Header } from '../components/Header';
import { Mascot } from '../components/Mascot';
import { Banner, Button, Card, Screen } from '../components/ui';
import { appSizeMb, canShareFile, DOWNLOAD_URL, shareAppFile, shareAppLink } from '../features/share/shareApp';
import { space } from '../theme/tokens';

/** Share FitMate with friends: the app file itself, or a download link. */
export default function ShareApp() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<'file' | 'link' | null>(null);
  const [error, setError] = useState(false);
  const [size] = useState(() => appSizeMb());
  const fileOk = canShareFile();

  const run = async (kind: 'file' | 'link') => {
    if (busy) return;
    setBusy(kind);
    setError(false);
    try {
      const message = t('share.message', { link: DOWNLOAD_URL });
      if (kind === 'file') await shareAppFile(message, t('share.chooser'));
      else await shareAppLink(message);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen testID="share-app">
      <Header title={t('share.title')} />
      <Card tone="accent">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Mascot size={84} mood="cheer" />
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="heading">{t('share.heroTitle')}</AppText>
            <AppText variant="label" tone="secondary">
              {t('share.heroBody')}
            </AppText>
          </View>
        </View>
      </Card>

      {fileOk ? (
        <Card testID="share-file-card">
          <AppText weight="bold">{t('share.fileTitle')}</AppText>
          <AppText variant="label" tone="secondary">
            {size ? t('share.fileBodySize', { mb: size }) : t('share.fileBody')}
          </AppText>
          <Button testID="share-file" label={t('share.sendFile')} onPress={() => run('file')} loading={busy === 'file'} />
        </Card>
      ) : null}

      <Card testID="share-link-card">
        <AppText weight="bold">{t('share.linkTitle')}</AppText>
        <AppText variant="label" tone="secondary">
          {t('share.linkBody')}
        </AppText>
        <AppText variant="caption" tone="accent" selectable testID="share-url">
          {DOWNLOAD_URL}
        </AppText>
        <Button testID="share-link" variant={fileOk ? 'secondary' : 'primary'} label={t('share.sendLink')} onPress={() => run('link')} loading={busy === 'link'} />
      </Card>

      {error ? <Banner tone="danger" text={t('share.error')} /> : null}

      <Card>
        <AppText weight="bold">{t('share.howTitle')}</AppText>
        {[t('share.how1'), t('share.how2'), t('share.how3')].map((line, i) => (
          <AppText key={i} variant="label" tone="secondary">
            {`${i + 1}. ${line}`}
          </AppText>
        ))}
      </Card>
      <AppText variant="caption" tone="muted">
        {t('share.privacy')}
      </AppText>
    </Screen>
  );
}

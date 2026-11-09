import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, Screen, TextField } from '../../components/ui';
import { exportReadableCopy } from '../../features/backup/backupService';
import { useSession } from '../../security/SessionProvider';
import { space } from '../../theme/tokens';

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { wipeEverything } = useSession();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const doExport = async () => {
    setError(null);
    setExporting(true);
    try {
      await exportReadableCopy(t('privacy.exportShare'));
    } catch {
      setError(t('errors.generic'));
    } finally {
      setExporting(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await wipeEverything();
    } catch {
      setError(t('errors.generic'));
      setDeleting(false);
    }
  };

  return (
    <Screen testID="settings-privacy">
      <Header title={t('profile.privacy')} />
      <Card>
        <AppText variant="heading">{t('privacy.noticeTitle')}</AppText>
        {(['privacy1', 'privacy2', 'privacy3', 'privacy4'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', gap: space.sm }}>
            <AppText tone="accent">•</AppText>
            <AppText variant="label" tone="secondary" style={{ flex: 1 }}>
              {t(`welcome.${k}`)}
            </AppText>
          </View>
        ))}
      </Card>
      <Card>
        <AppText variant="heading">{t('privacy.exportTitle')}</AppText>
        <AppText variant="label" tone="secondary">
          {t('privacy.exportBody')}
        </AppText>
        <Button testID="export-readable" variant="secondary" label={t('privacy.export')} onPress={doExport} loading={exporting} />
      </Card>
      <Card tone="danger">
        <AppText variant="heading" tone="danger">
          {t('privacy.deleteTitle')}
        </AppText>
        <AppText variant="label">{t('privacy.deleteBody')}</AppText>
        <TextField testID="delete-confirm" label={t('privacy.deleteType')} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" />
        <Button testID="delete-all" variant="danger" label={t('privacy.deleteButton')} onPress={doDelete} disabled={confirmText.trim() !== 'DELETE'} loading={deleting} />
      </Card>
      {error ? <Banner tone="danger" text={error} /> : null}
    </Screen>
  );
}

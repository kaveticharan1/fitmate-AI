import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../components/AppText';
import { Header } from '../components/Header';
import { Banner, Button, Card, ProgressBar, Screen } from '../components/ui';
import { useUpdateCheck, useUpdater } from '../features/update/hooks';
import { canSelfUpdate, installedApp, LATEST_APK_URL, toMb } from '../features/update/updates';
import { space } from '../theme/tokens';

/** "App updates": download the newest FitMate and install it over this one, keeping all data. */
export default function UpdateScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ start?: string }>();
  const check = useUpdateCheck();
  const latest = check.data?.latest;
  const { phase, progress, error, start } = useUpdater(latest);
  const autoStarted = useRef(false);
  const current = check.data?.current ?? installedApp();

  // Opened from the Home "Download & install" button: begin straight away.
  useEffect(() => {
    if (params.start === '1' && check.data?.available && !autoStarted.current) {
      autoStarted.current = true;
      void start();
    }
  }, [params.start, check.data?.available, start]);

  if (!canSelfUpdate()) {
    return (
      <Screen testID="update-screen">
        <Header title={t('update.title')} />
        <Card>
          <AppText variant="label" tone="secondary">
            {t('update.unsupported')}
          </AppText>
          <AppText variant="caption" tone="accent" selectable>
            {LATEST_APK_URL}
          </AppText>
        </Card>
      </Screen>
    );
  }

  const mb = toMb(latest?.bytes);
  const busy = phase === 'downloading' || phase === 'installing';
  let status: string;
  if (check.isLoading) status = t('update.checking');
  else if (check.isError) status = t('update.checkFailed');
  else if (!check.data?.available) status = t('update.upToDate');
  else status = mb ? t('update.availableSize', { version: latest?.version, mb }) : t('update.available', { version: latest?.version });

  return (
    <Screen testID="update-screen">
      <Header title={t('update.title')} />
      <Card>
        <AppText variant="label" tone="secondary" testID="update-current">
          {t('update.current', { version: current?.versionName ?? '—' })}
        </AppText>
        <AppText weight="bold" testID="update-status">
          {status}
        </AppText>

        {check.data?.available ? (
          <View style={{ gap: space.sm }}>
            {phase === 'downloading' ? (
              <View style={{ gap: space.xs }}>
                <ProgressBar value={progress} testID="update-progress" />
                <AppText variant="caption" tone="muted" testID="update-percent">
                  {t('update.downloading', { pct: Math.round(progress * 100) })}
                </AppText>
              </View>
            ) : null}
            {phase === 'permission' ? <Banner tone="accent" text={t('update.permissionHint')} /> : null}
            {phase === 'opened' ? <Banner tone="accent" text={t('update.openedHint')} /> : null}
            <Button
              testID="update-go"
              label={phase === 'opened' || phase === 'error' ? t('update.tryAgain') : t('update.downloadInstall')}
              onPress={() => void start()}
              loading={busy}
            />
          </View>
        ) : (
          <Button testID="update-check" variant="secondary" label={t('update.checkNow')} onPress={() => void check.refetch()} loading={check.isFetching} />
        )}
        {error ? <Banner tone="danger" text={t(`update.errors.${error}`)} /> : null}
      </Card>

      <Card>
        <AppText weight="bold">{t('update.safeTitle')}</AppText>
        {[t('update.safe1'), t('update.safe2'), t('update.safe3')].map((line, i) => (
          <AppText key={i} variant="label" tone="secondary">
            {`• ${line}`}
          </AppText>
        ))}
      </Card>
    </Screen>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, Screen, TextField, ToggleRow } from '../../components/ui';
import { openHealthSettings } from '../../features/health/healthConnect';
import {
  useConnectHealth,
  useDisconnectHealth,
  useHealthAvailability,
  useHealthSettings,
  useSetHealthSetting,
  useStepGoal,
  useSyncHealth,
} from '../../features/health/hooks';
import { space } from '../../theme/tokens';

const HC_PLAY_URL = 'market://details?id=com.google.android.apps.healthdata';

export default function HealthSettings() {
  const { t } = useTranslation();
  const { data: availability } = useHealthAvailability();
  const { data: settings } = useHealthSettings();
  const goal = useStepGoal(settings);
  const connect = useConnectHealth();
  const disconnect = useDisconnectHealth();
  const setSetting = useSetHealthSetting();
  const sync = useSyncHealth();
  const [goalText, setGoalText] = useState<string | null>(null);

  const goalValue = goalText ?? String(goal);
  const parsedGoal = Number(goalValue);
  const goalValid = Number.isInteger(parsedGoal) && parsedGoal >= 1000 && parsedGoal <= 50000;

  return (
    <Screen testID="settings-health">
      <Header title={t('health.title')} />

      <Card>
        <AppText variant="heading">{t('health.whatTitle')}</AppText>
        <AppText variant="label" tone="secondary">
          {t('health.whatBody')}
        </AppText>
        <AppText variant="label" tone="secondary">
          {t('health.sources')}
        </AppText>
      </Card>

      {availability === 'unavailable' ? (
        <Card tone="warning" testID="hc-unavailable">
          <AppText>{t('health.unavailable')}</AppText>
          <Button variant="secondary" label={t('health.getApp')} onPress={() => Linking.openURL(HC_PLAY_URL)} />
        </Card>
      ) : availability === 'update_required' ? (
        <Card tone="warning" testID="hc-update">
          <AppText>{t('health.updateRequired')}</AppText>
          <Button variant="secondary" label={t('health.update')} onPress={() => Linking.openURL(HC_PLAY_URL)} />
        </Card>
      ) : settings?.enabled ? (
        <Card tone="accent" testID="hc-connected">
          <AppText variant="heading">{t('health.connected')}</AppText>
          <AppText variant="label" tone="secondary" testID="hc-last-sync">
            {settings.lastSync ? t('health.lastSync', { time: new Date(settings.lastSync).toLocaleString('en-IN') }) : t('steps.notSynced')}
          </AppText>
          {sync.data?.status === 'synced' ? (
            <AppText variant="label" testID="hc-sync-result">
              {t('health.syncResult', { days: sync.data.days, weights: sync.data.weights, nights: sync.data.nights })}
            </AppText>
          ) : null}
          {sync.data?.status === 'no_permission' ? <Banner tone="warning" text={t('steps.noPermission')} /> : null}
          {sync.isError ? <Banner tone="danger" text={t('health.syncError')} /> : null}
          <Button testID="hc-sync" label={t('steps.sync')} onPress={() => sync.mutate(true)} loading={sync.isPending} />
          <ToggleRow
            testID="hc-import-weight"
            label={t('health.importWeight')}
            description={t('health.importWeightHint')}
            value={settings.importWeight}
            onChange={(v) => setSetting.mutate({ key: 'healthImportWeight', value: v })}
          />
          <ToggleRow
            testID="hc-import-sleep"
            label={t('health.importSleep')}
            description={t('health.importSleepHint')}
            value={settings.importSleep}
            onChange={(v) => setSetting.mutate({ key: 'healthImportSleep', value: v })}
          />
          <Button testID="hc-open" variant="secondary" label={t('health.openHc')} onPress={() => openHealthSettings()} />
          <Button testID="hc-disconnect" variant="danger" label={t('health.disconnect')} onPress={() => disconnect.mutate()} />
          <AppText variant="caption" tone="secondary">
            {t('health.disconnectNote')}
          </AppText>
        </Card>
      ) : (
        <Card testID="hc-connect-card">
          <AppText variant="heading">{t('health.connectTitle')}</AppText>
          <AppText variant="label" tone="secondary">
            {t('health.connectBody')}
          </AppText>
          <Button testID="hc-connect" label={t('health.connect')} onPress={() => connect.mutate()} loading={connect.isPending} />
          {connect.data && !connect.data.steps ? <Banner tone="warning" text={t('health.denied')} /> : null}
          {connect.isError ? <Banner tone="danger" text={t('health.connectError')} /> : null}
        </Card>
      )}

      <Card testID="step-goal-card">
        <AppText variant="heading">{t('health.goalTitle')}</AppText>
        <View style={{ gap: space.sm }}>
          <TextField
            testID="step-goal"
            label={t('health.goalLabel')}
            value={goalValue}
            onChangeText={setGoalText}
            keyboardType="number-pad"
            error={goalValid ? undefined : t('health.goalError')}
            hint={settings?.stepGoal == null ? t('health.goalDefault') : undefined}
          />
          <Button
            testID="step-goal-save"
            variant="secondary"
            label={t('common.save')}
            disabled={!goalValid || goalText == null}
            onPress={() => setSetting.mutate({ key: 'stepGoal', value: parsedGoal }, { onSuccess: () => setGoalText(null) })}
          />
        </View>
      </Card>
    </Screen>
  );
}

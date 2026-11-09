import { cleanKey } from '@fitmate/coach';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, CheckRow, Screen, TextField } from '../../components/ui';
import { AI_STUDIO_KEYS_URL, coachErrorKey } from '../../features/coach/errors';
import { useAiStatus, useClearChat, useCoachMemory, useConnectAi, useDeleteMemory, useDisconnectAi } from '../../features/coach/hooks';
import { space } from '../../theme/tokens';

export default function AiSettings() {
  const { t } = useTranslation();
  const { data: status } = useAiStatus();
  const { data: memory = [] } = useCoachMemory();
  const connect = useConnectAi();
  const disconnect = useDisconnectAi();
  const clearChat = useClearChat();
  const delMemory = useDeleteMemory();
  const [agreed, setAgreed] = useState(false);
  const [key, setKey] = useState('');
  const [cleared, setCleared] = useState(false);

  const doConnect = () => {
    const k = cleanKey(key);
    if (k.length < 20) return;
    connect.mutate(k, { onSuccess: () => setKey('') });
  };

  return (
    <Screen testID="settings-ai">
      <Header title={t('coach.settingsTitle')} />

      {status?.connected ? (
        <>
          <Card tone="accent" testID="ai-connected">
            <AppText variant="heading">{t('coach.connected')}</AppText>
            <AppText tone="secondary">{t('coach.model', { model: status.model })}</AppText>
            <Button testID="open-coach" label={t('coach.openChat')} onPress={() => router.push('/coach')} />
          </Card>
          <Card>
            <AppText variant="heading">{t('coach.styleTitle')}</AppText>
            <AppText variant="label" tone="secondary">
              {t('coach.styleBody')}
            </AppText>
            <Button testID="edit-style" variant="secondary" label={t('profile.edit')} onPress={() => router.push('/edit-profile')} />
          </Card>
          <Card testID="memory-card">
            <AppText variant="heading">{t('coach.memoryTitle')}</AppText>
            <AppText variant="label" tone="secondary">
              {t('coach.memoryBody')}
            </AppText>
            {memory.length === 0 ? <AppText tone="muted">{t('coach.memoryEmpty')}</AppText> : null}
            {memory.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <AppText style={{ flex: 1 }}>{m.text}</AppText>
                <Button testID={`forget-${m.id}`} variant="ghost" label={t('coach.forget')} onPress={() => delMemory.mutate(m.id)} />
              </View>
            ))}
          </Card>
          <Card>
            <Button
              testID="clear-chat"
              variant="secondary"
              label={cleared ? t('coach.chatCleared') : t('coach.clearChat')}
              disabled={cleared}
              onPress={() => clearChat.mutate(undefined, { onSuccess: () => setCleared(true) })}
            />
            <Button testID="disconnect-ai" variant="danger" label={t('coach.disconnect')} onPress={() => disconnect.mutate()} loading={disconnect.isPending} />
            <AppText variant="caption" tone="secondary">
              {t('coach.disconnectNote')}
            </AppText>
          </Card>
        </>
      ) : (
        <>
          <Card testID="ai-consent">
            <AppText variant="heading">{t('coach.consentTitle')}</AppText>
            {(['consent1', 'consent2', 'consent3', 'consent4'] as const).map((k) => (
              <View key={k} style={{ flexDirection: 'row', gap: space.sm }}>
                <AppText tone="accent">•</AppText>
                <AppText variant="label" tone="secondary" style={{ flex: 1 }}>
                  {t(`coach.${k}`)}
                </AppText>
              </View>
            ))}
            <CheckRow testID="ai-agree" label={t('coach.agree')} value={agreed} onChange={setAgreed} />
          </Card>
          {agreed ? (
            <Card testID="ai-key-card">
              <AppText variant="heading">{t('coach.keyTitle')}</AppText>
              {(['keyStep1', 'keyStep2', 'keyStep3'] as const).map((k, i) => (
                <AppText key={k} variant="label" tone="secondary">{`${i + 1}. ${t(`coach.${k}`)}`}</AppText>
              ))}
              <Button testID="open-ai-studio" variant="secondary" label={t('coach.openStudio')} onPress={() => Linking.openURL(AI_STUDIO_KEYS_URL)} />
              <TextField
                testID="ai-key"
                label={t('coach.keyLabel')}
                value={key}
                onChangeText={setKey}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                hint={t('coach.keyHint')}
              />
              <Button testID="ai-connect" label={t('coach.connect')} onPress={doConnect} disabled={cleanKey(key).length < 20} loading={connect.isPending} />
              {connect.isError ? <Banner tone="danger" text={t(coachErrorKey(connect.error))} /> : null}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
